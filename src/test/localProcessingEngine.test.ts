import { describe, expect, it } from "vitest";
import {
  LOCAL_PROCESSING_PROTOCOL,
  createCacheManifest,
  createLocalProcessingEngine,
  createLocalProcessingWorkerBridge,
  createDeviceProfile,
  createProcessingJob,
  resolveAdaptiveConcurrency,
  resolveCachePlan,
  transitionProcessingJob,
} from "@/lib/localProcessingEngine";

const MiB = 1024 * 1024;

describe("local processing engine", () => {
  it("creates a conservative low-tier profile when browser capabilities are weak", () => {
    const profile = createDeviceProfile({
      hardwareConcurrency: 2,
      deviceMemoryGB: 2,
      webgpu: false,
      webcodecs: false,
      opfs: false,
    });

    expect(profile.tier).toBe("low");
    expect(profile.maxConcurrentJobs).toBe(1);
    expect(profile.capabilities).toMatchObject({
      webgpu: false,
      webcodecs: false,
      opfs: false,
    });
    expect(profile.cache.preferredMode).toBe("memory");
  });

  it("keeps adaptive concurrency inside the device profile budget", () => {
    const profile = createDeviceProfile({
      hardwareConcurrency: 12,
      deviceMemoryGB: 16,
      webgpu: true,
      webcodecs: true,
      opfs: true,
    });

    expect(profile.tier).toBe("high");
    expect(resolveAdaptiveConcurrency(profile, { queuedJobs: 10 })).toBe(4);
    expect(resolveAdaptiveConcurrency(profile, { queuedJobs: 2 })).toBe(2);
    expect(resolveAdaptiveConcurrency(profile, { queuedJobs: 10, memoryPressure: "high" })).toBe(2);
  });

  it("moves jobs through progress, failure, retry, success, and cancellation states", () => {
    const pending = createProcessingJob({
      id: "job-1",
      kind: "image-convert",
      input: { fileName: "photo.png" },
      now: 100,
      maxAttempts: 2,
    });

    const running = transitionProcessingJob(pending, { type: "start", now: 110 });
    const progressed = transitionProcessingJob(running, { type: "progress", progress: 42, now: 120 });
    const failed = transitionProcessingJob(progressed, { type: "fail", error: "codec failed", now: 130 });
    const retried = transitionProcessingJob(failed, { type: "retry", now: 140 });
    const secondRun = transitionProcessingJob(retried, { type: "start", now: 150 });
    const succeeded = transitionProcessingJob(secondRun, { type: "succeed", result: { bytes: 1200 }, now: 160 });
    const cancelled = transitionProcessingJob(createProcessingJob({ id: "job-2", kind: "video", input: null }), {
      type: "cancel",
      reason: "user",
      now: 170,
    });

    expect(progressed).toMatchObject({ status: "running", progress: 42, attempts: 1 });
    expect(failed).toMatchObject({ status: "failed", progress: 42, error: "codec failed" });
    expect(retried).toMatchObject({ status: "pending", progress: 0, error: undefined });
    expect(succeeded).toMatchObject({ status: "succeeded", progress: 100, result: { bytes: 1200 } });
    expect(cancelled).toMatchObject({ status: "cancelled", progress: 0, cancellationReason: "user" });
  });

  it("sends typed worker requests and resolves only correlated worker responses", async () => {
    const worker = createFakeWorker();
    const profile = createDeviceProfile({ hardwareConcurrency: 4, webcodecs: true, opfs: true });
    const bridge = createLocalProcessingWorkerBridge(worker, { idFactory: () => "request-1" });
    const progress: number[] = [];

    const result = bridge.runJob({
      jobId: "job-1",
      kind: "image-convert",
      payload: { fileName: "photo.png" },
      deviceProfile: profile,
      onProgress: (event) => progress.push(event.progress),
    });

    expect(worker.messages[0]).toMatchObject({
      protocol: LOCAL_PROCESSING_PROTOCOL,
      type: "run-job",
      requestId: "request-1",
      jobId: "job-1",
      kind: "image-convert",
      payload: { fileName: "photo.png" },
    });

    worker.emit({
      protocol: LOCAL_PROCESSING_PROTOCOL,
      type: "success",
      requestId: "other-request",
      jobId: "job-1",
      result: { ignored: true },
    });
    worker.emit({
      protocol: LOCAL_PROCESSING_PROTOCOL,
      type: "progress",
      requestId: "request-1",
      jobId: "job-1",
      progress: 25,
    });
    worker.emit({
      protocol: LOCAL_PROCESSING_PROTOCOL,
      type: "success",
      requestId: "request-1",
      jobId: "job-1",
      result: { bytes: 1200 },
    });

    await expect(result).resolves.toEqual({ bytes: 1200 });
    expect(progress).toEqual([25]);
  });

  it("plans a versioned OPFS cache and falls back when quota or OPFS is unavailable", () => {
    const profile = createDeviceProfile({
      hardwareConcurrency: 8,
      deviceMemoryGB: 8,
      webgpu: true,
      webcodecs: true,
      opfs: true,
    });
    const manifest = createCacheManifest({
      namespace: "local-models",
      version: "2026-06-slice-1",
      entries: [{ key: "rename/mock-model", bytes: 80 * MiB, checksum: "sha256-test" }],
    });

    expect(resolveCachePlan(manifest, { deviceProfile: profile, quotaBytes: 512 * MiB, usageBytes: 64 * MiB })).toMatchObject({
      mode: "opfs",
      namespace: "local-models",
      version: "2026-06-slice-1",
      requiredBytes: 80 * MiB,
    });
    expect(resolveCachePlan(manifest, { deviceProfile: profile, quotaBytes: 96 * MiB, usageBytes: 40 * MiB })).toMatchObject({
      mode: "memory",
      fallbackReason: "quota",
    });
    expect(
      resolveCachePlan(manifest, {
        deviceProfile: { ...profile, capabilities: { ...profile.capabilities, opfs: false } },
        quotaBytes: 512 * MiB,
        usageBytes: 64 * MiB,
      }),
    ).toMatchObject({
      mode: "memory",
      fallbackReason: "opfs-unavailable",
    });
  });

  it("runs a local processing pipeline with adaptive concurrency, progress, retry, and cancel", async () => {
    let nextId = 0;
    let active = 0;
    let maxActive = 0;
    const started: string[] = [];
    const profile = createDeviceProfile({
      hardwareConcurrency: 4,
      deviceMemoryGB: 4,
      webcodecs: true,
      opfs: true,
    });

    const engine = createLocalProcessingEngine<{ name: string; failOnce?: boolean }, { name: string }>({
      deviceProfile: profile,
      idFactory: () => `job-${++nextId}`,
      executeJob: async (job, context) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        started.push(job.id);
        context.reportProgress(35);

        try {
          await Promise.resolve();
          if (job.input.failOnce && job.attempts === 1) {
            throw new Error("planned failure");
          }
          return { name: job.input.name };
        } finally {
          active -= 1;
        }
      },
    });

    const first = engine.enqueue({ kind: "image", input: { name: "first" } });
    const second = engine.enqueue({ kind: "image", input: { name: "second" } });
    const third = engine.enqueue({ kind: "image", input: { name: "third", failOnce: true }, maxAttempts: 2 });

    await engine.whenIdle();

    expect(maxActive).toBe(2);
    expect(started).toEqual(["job-1", "job-2", "job-3"]);
    expect(engine.getJob(first.id)).toMatchObject({ status: "succeeded", progress: 100 });
    expect(engine.getJob(second.id)).toMatchObject({ status: "succeeded", progress: 100 });
    expect(engine.getJob(third.id)).toMatchObject({ status: "failed", progress: 35, error: "planned failure" });

    engine.retry(third.id);
    await engine.whenIdle();

    expect(engine.getJob(third.id)).toMatchObject({
      status: "succeeded",
      attempts: 2,
      result: { name: "third" },
    });

    const cancelGate = createGate();
    const cancelEngine = createLocalProcessingEngine<{ name: string }, { name: string }>({
      deviceProfile: createDeviceProfile({ hardwareConcurrency: 1, webcodecs: true }),
      idFactory: () => "cancel-job",
      executeJob: async (job, context) => {
        context.reportProgress(45);
        context.signal.addEventListener("abort", () => cancelGate.release());
        await cancelGate.promise;
        if (context.signal.aborted) throw new Error("aborted");
        return { name: job.input.name };
      },
    });

    const cancellable = cancelEngine.enqueue({ kind: "video", input: { name: "clip" }, maxAttempts: 2 });
    await Promise.resolve();
    cancelEngine.cancel(cancellable.id, "user");
    await cancelEngine.whenIdle();

    expect(cancelEngine.getJob(cancellable.id)).toMatchObject({
      status: "cancelled",
      progress: 45,
      cancellationReason: "user",
    });
  });
});

function createGate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

type FakeWorkerListener = (event: { data: unknown }) => void;

function createFakeWorker() {
  const listeners: FakeWorkerListener[] = [];

  return {
    messages: [] as unknown[],
    postMessage(message: unknown) {
      this.messages.push(message);
    },
    addEventListener(_type: "message", listener: FakeWorkerListener) {
      listeners.push(listener);
    },
    removeEventListener(_type: "message", listener: FakeWorkerListener) {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
    emit(data: unknown) {
      listeners.forEach((listener) => listener({ data }));
    },
  };
}
