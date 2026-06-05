export type DeviceTier = "high" | "mid" | "low";

export type CacheMode = "opfs" | "memory";

export type DeviceProfileProbe = {
  hardwareConcurrency?: number;
  deviceMemoryGB?: number;
  webgpu?: boolean;
  webcodecs?: boolean;
  opfs?: boolean;
  mobile?: boolean;
};

export type DeviceCapabilities = {
  hardwareConcurrency: number;
  deviceMemoryGB: number | null;
  webgpu: boolean;
  webcodecs: boolean;
  opfs: boolean;
  mobile: boolean;
};

export type DeviceProfile = {
  tier: DeviceTier;
  capabilities: DeviceCapabilities;
  maxConcurrentJobs: number;
  workerPoolSize: number;
  cache: {
    preferredMode: CacheMode;
    maxBytes: number;
  };
  reasons: string[];
};

export type AdaptiveConcurrencyOptions = {
  queuedJobs: number;
  memoryPressure?: "normal" | "high";
};

export type ProcessingJobStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export type ProcessingJob<TInput = unknown, TResult = unknown> = {
  id: string;
  kind: string;
  input: TInput;
  status: ProcessingJobStatus;
  progress: number;
  attempts: number;
  maxAttempts: number;
  result?: TResult;
  error?: string;
  cancellationReason?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
};

export type CreateProcessingJobOptions<TInput> = {
  id: string;
  kind: string;
  input: TInput;
  now?: number;
  maxAttempts?: number;
};

export type ProcessingJobEvent<TResult = unknown> =
  | { type: "start"; now?: number }
  | { type: "progress"; progress: number; now?: number }
  | { type: "succeed"; result: TResult; now?: number }
  | { type: "fail"; error: unknown; now?: number }
  | { type: "cancel"; reason?: string; now?: number }
  | { type: "retry"; now?: number };

export const LOCAL_PROCESSING_PROTOCOL = "maibach-local-processing/v1";

export type LocalProcessingWorkerRequest<TPayload = unknown> =
  | {
      protocol: typeof LOCAL_PROCESSING_PROTOCOL;
      type: "run-job";
      requestId: string;
      jobId: string;
      kind: string;
      payload: TPayload;
      deviceProfile: DeviceProfile;
    }
  | {
      protocol: typeof LOCAL_PROCESSING_PROTOCOL;
      type: "cancel-job";
      requestId: string;
      jobId: string;
    };

export type LocalProcessingWorkerResponse<TResult = unknown> =
  | {
      protocol: typeof LOCAL_PROCESSING_PROTOCOL;
      type: "progress";
      requestId: string;
      jobId: string;
      progress: number;
      message?: string;
    }
  | {
      protocol: typeof LOCAL_PROCESSING_PROTOCOL;
      type: "success";
      requestId: string;
      jobId: string;
      result: TResult;
    }
  | {
      protocol: typeof LOCAL_PROCESSING_PROTOCOL;
      type: "failure";
      requestId: string;
      jobId: string;
      error: string;
      recoverable?: boolean;
    }
  | {
      protocol: typeof LOCAL_PROCESSING_PROTOCOL;
      type: "cancelled";
      requestId: string;
      jobId: string;
      reason?: string;
    };

export type LocalProcessingProgressEvent = Extract<LocalProcessingWorkerResponse, { type: "progress" }>;

export type WorkerLike = {
  postMessage(message: LocalProcessingWorkerRequest): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  removeEventListener?: (type: "message", listener: (event: { data: unknown }) => void) => void;
};

export type RunWorkerJobOptions<TPayload> = {
  jobId: string;
  kind: string;
  payload: TPayload;
  deviceProfile: DeviceProfile;
  onProgress?: (event: LocalProcessingProgressEvent) => void;
};

export type WorkerBridgeOptions = {
  idFactory?: () => string;
};

export type CacheManifestEntry = {
  key: string;
  bytes: number;
  checksum?: string;
  contentType?: string;
};

export type CacheManifest = {
  namespace: string;
  version: string;
  entries: CacheManifestEntry[];
  requiredBytes: number;
};

export type CachePlan = {
  mode: CacheMode;
  namespace: string;
  version: string;
  requiredBytes: number;
  fallbackReason?: "opfs-unavailable" | "quota";
};

export type CachePlanOptions = {
  deviceProfile: DeviceProfile;
  quotaBytes?: number;
  usageBytes?: number;
};

export type ProcessingExecutionContext = {
  deviceProfile: DeviceProfile;
  signal: AbortSignal;
  reportProgress: (progress: number, message?: string) => void;
};

export type ProcessingExecutor<TInput, TResult> = (
  job: ProcessingJob<TInput, TResult>,
  context: ProcessingExecutionContext,
) => Promise<TResult>;

export type LocalProcessingEngineOptions<TInput, TResult> = {
  deviceProfile: DeviceProfile;
  executeJob: ProcessingExecutor<TInput, TResult>;
  idFactory?: () => string;
  now?: () => number;
};

export type EnqueueProcessingJobOptions<TInput> = {
  kind: string;
  input: TInput;
  maxAttempts?: number;
};

const MiB = 1024 * 1024;

export function createDeviceProfile(probe: DeviceProfileProbe = {}): DeviceProfile {
  const capabilities: DeviceCapabilities = {
    hardwareConcurrency: normalizeHardwareConcurrency(probe.hardwareConcurrency),
    deviceMemoryGB: normalizeMemory(probe.deviceMemoryGB),
    webgpu: probe.webgpu ?? false,
    webcodecs: probe.webcodecs ?? false,
    opfs: probe.opfs ?? false,
    mobile: probe.mobile ?? false,
  };

  const tier = resolveDeviceTier(capabilities);
  const maxConcurrentJobs = tier === "high" ? 4 : tier === "mid" ? 2 : 1;

  return {
    tier,
    capabilities,
    maxConcurrentJobs,
    workerPoolSize: maxConcurrentJobs,
    cache: {
      preferredMode: capabilities.opfs ? "opfs" : "memory",
      maxBytes: tier === "high" ? 2048 * MiB : tier === "mid" ? 512 * MiB : 128 * MiB,
    },
    reasons: getProfileReasons(capabilities, tier),
  };
}

export function resolveAdaptiveConcurrency(
  profile: DeviceProfile,
  options: AdaptiveConcurrencyOptions,
): number {
  const queuedJobs = Math.max(0, Math.floor(options.queuedJobs));
  if (queuedJobs === 0) return 0;

  const pressureBudget =
    options.memoryPressure === "high" ? Math.max(1, Math.floor(profile.maxConcurrentJobs / 2)) : profile.maxConcurrentJobs;

  return Math.max(1, Math.min(queuedJobs, pressureBudget));
}

export function createProcessingJob<TInput, TResult = unknown>(
  options: CreateProcessingJobOptions<TInput>,
): ProcessingJob<TInput, TResult> {
  const now = options.now ?? Date.now();

  return {
    id: options.id,
    kind: options.kind,
    input: options.input,
    status: "pending",
    progress: 0,
    attempts: 0,
    maxAttempts: Math.max(1, Math.floor(options.maxAttempts ?? 1)),
    createdAt: now,
    updatedAt: now,
  };
}

export function transitionProcessingJob<TInput, TResult>(
  job: ProcessingJob<TInput, TResult>,
  event: ProcessingJobEvent<TResult>,
): ProcessingJob<TInput, TResult> {
  const now = event.now ?? Date.now();

  if (isTerminal(job.status) && event.type !== "retry") {
    return job;
  }

  switch (event.type) {
    case "start":
      if (job.status !== "pending") return job;
      return {
        ...job,
        status: "running",
        attempts: job.attempts + 1,
        updatedAt: now,
        startedAt: now,
        error: undefined,
        cancellationReason: undefined,
      };

    case "progress":
      if (job.status !== "running") return job;
      return {
        ...job,
        progress: clampProgress(event.progress),
        updatedAt: now,
      };

    case "succeed":
      if (job.status !== "running") return job;
      return {
        ...job,
        status: "succeeded",
        progress: 100,
        result: event.result,
        updatedAt: now,
        completedAt: now,
      };

    case "fail":
      if (job.status !== "running") return job;
      return {
        ...job,
        status: "failed",
        error: formatError(event.error),
        updatedAt: now,
        completedAt: now,
      };

    case "cancel":
      if (job.status !== "pending" && job.status !== "running") return job;
      return {
        ...job,
        status: "cancelled",
        cancellationReason: event.reason,
        updatedAt: now,
        completedAt: now,
      };

    case "retry":
      if (job.status !== "failed" && job.status !== "cancelled") return job;
      if (job.attempts >= job.maxAttempts) {
        throw new Error(`Job ${job.id} has no retry attempts remaining`);
      }
      return {
        ...job,
        status: "pending",
        progress: 0,
        result: undefined,
        error: undefined,
        cancellationReason: undefined,
        updatedAt: now,
        startedAt: undefined,
        completedAt: undefined,
      };
  }
}

export function createLocalProcessingWorkerBridge(worker: WorkerLike, options: WorkerBridgeOptions = {}) {
  const idFactory = options.idFactory ?? createRequestId;
  const pending = new Map<
    string,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
      onProgress?: (event: LocalProcessingProgressEvent) => void;
    }
  >();

  const handleMessage = (event: { data: unknown }) => {
    const response = parseWorkerResponse(event.data);
    if (!response) return;

    const pendingRequest = pending.get(response.requestId);
    if (!pendingRequest) return;

    if (response.type === "progress") {
      pendingRequest.onProgress?.(response);
      return;
    }

    pending.delete(response.requestId);

    if (response.type === "success") {
      pendingRequest.resolve(response.result);
      return;
    }

    if (response.type === "cancelled") {
      pendingRequest.reject(new Error(response.reason ?? "Job cancelled"));
      return;
    }

    pendingRequest.reject(new Error(response.error));
  };

  worker.addEventListener("message", handleMessage);

  return {
    runJob<TPayload, TResult>(job: RunWorkerJobOptions<TPayload>): Promise<TResult> {
      const requestId = idFactory();
      const request: LocalProcessingWorkerRequest<TPayload> = {
        protocol: LOCAL_PROCESSING_PROTOCOL,
        type: "run-job",
        requestId,
        jobId: job.jobId,
        kind: job.kind,
        payload: job.payload,
        deviceProfile: job.deviceProfile,
      };

      const promise = new Promise<TResult>((resolve, reject) => {
        pending.set(requestId, {
          resolve: (result) => resolve(result as TResult),
          reject,
          onProgress: job.onProgress,
        });
      });

      worker.postMessage(request);
      return promise;
    },

    cancelJob(jobId: string): string {
      const requestId = idFactory();
      worker.postMessage({
        protocol: LOCAL_PROCESSING_PROTOCOL,
        type: "cancel-job",
        requestId,
        jobId,
      });
      return requestId;
    },

    dispose() {
      worker.removeEventListener?.("message", handleMessage);
      pending.clear();
    },
  };
}

export function createCacheManifest(options: {
  namespace: string;
  version: string;
  entries: readonly CacheManifestEntry[];
}): CacheManifest {
  const entries = options.entries.map((entry) => ({
    ...entry,
    bytes: normalizeBytes(entry.bytes),
  }));

  return {
    namespace: options.namespace,
    version: options.version,
    entries,
    requiredBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
  };
}

export function resolveCachePlan(manifest: CacheManifest, options: CachePlanOptions): CachePlan {
  const base = {
    namespace: manifest.namespace,
    version: manifest.version,
    requiredBytes: manifest.requiredBytes,
  };

  if (!options.deviceProfile.capabilities.opfs || options.deviceProfile.cache.preferredMode !== "opfs") {
    return {
      ...base,
      mode: "memory",
      fallbackReason: "opfs-unavailable",
    };
  }

  const quotaBytes = options.quotaBytes ?? Number.POSITIVE_INFINITY;
  const usageBytes = options.usageBytes ?? 0;
  const availableBytes = Math.min(options.deviceProfile.cache.maxBytes, Math.max(0, quotaBytes - usageBytes));

  if (availableBytes < manifest.requiredBytes) {
    return {
      ...base,
      mode: "memory",
      fallbackReason: "quota",
    };
  }

  return {
    ...base,
    mode: "opfs",
  };
}

export function createLocalProcessingEngine<TInput, TResult>(
  options: LocalProcessingEngineOptions<TInput, TResult>,
) {
  const jobs = new Map<string, ProcessingJob<TInput, TResult>>();
  const queue: string[] = [];
  const controllers = new Map<string, AbortController>();
  const cancellationReasons = new Map<string, string | undefined>();
  const idleResolvers: Array<() => void> = [];
  const idFactory = options.idFactory ?? createJobId;
  const now = options.now ?? Date.now;
  let activeJobs = 0;

  const setJob = (job: ProcessingJob<TInput, TResult>) => {
    jobs.set(job.id, job);
  };

  const resolveIdleIfNeeded = () => {
    if (activeJobs > 0 || queue.length > 0) return;
    const resolvers = idleResolvers.splice(0);
    resolvers.forEach((resolve) => resolve());
  };

  const pump = () => {
    const concurrency = resolveAdaptiveConcurrency(options.deviceProfile, {
      queuedJobs: queue.length + activeJobs,
    });

    while (activeJobs < concurrency && queue.length > 0) {
      const jobId = queue.shift();
      if (!jobId) continue;

      const job = jobs.get(jobId);
      if (!job || job.status !== "pending") continue;

      void startJob(job);
    }

    resolveIdleIfNeeded();
  };

  const startJob = async (job: ProcessingJob<TInput, TResult>) => {
    const controller = new AbortController();
    let runningJob = transitionProcessingJob(job, { type: "start", now: now() });
    setJob(runningJob);
    controllers.set(job.id, controller);
    activeJobs += 1;

    const context: ProcessingExecutionContext = {
      deviceProfile: options.deviceProfile,
      signal: controller.signal,
      reportProgress: (progress) => {
        const current = jobs.get(job.id);
        if (!current || current.status !== "running") return;
        runningJob = transitionProcessingJob(current, { type: "progress", progress, now: now() });
        setJob(runningJob);
      },
    };

    try {
      const result = await options.executeJob(runningJob, context);
      const current = jobs.get(job.id);
      if (current?.status === "running") {
        setJob(transitionProcessingJob(current, { type: "succeed", result, now: now() }));
      }
    } catch (error) {
      const current = jobs.get(job.id);
      if (!current) return;

      if (controller.signal.aborted) {
        if (current.status !== "cancelled") {
          setJob(
            transitionProcessingJob(current, {
              type: "cancel",
              reason: cancellationReasons.get(job.id),
              now: now(),
            }),
          );
        }
      } else if (current.status === "running") {
        setJob(transitionProcessingJob(current, { type: "fail", error, now: now() }));
      }
    } finally {
      activeJobs -= 1;
      controllers.delete(job.id);
      cancellationReasons.delete(job.id);
      pump();
    }
  };

  return {
    enqueue(job: EnqueueProcessingJobOptions<TInput>): ProcessingJob<TInput, TResult> {
      const created = createProcessingJob<TInput, TResult>({
        id: idFactory(),
        kind: job.kind,
        input: job.input,
        maxAttempts: job.maxAttempts,
        now: now(),
      });

      setJob(created);
      queue.push(created.id);
      pump();
      return created;
    },

    cancel(jobId: string, reason?: string): ProcessingJob<TInput, TResult> | undefined {
      const current = jobs.get(jobId);
      if (!current) return undefined;

      cancellationReasons.set(jobId, reason);

      if (current.status === "pending") {
        const index = queue.indexOf(jobId);
        if (index >= 0) queue.splice(index, 1);
        const cancelled = transitionProcessingJob(current, { type: "cancel", reason, now: now() });
        setJob(cancelled);
        resolveIdleIfNeeded();
        return cancelled;
      }

      if (current.status === "running") {
        controllers.get(jobId)?.abort();
        const cancelled = transitionProcessingJob(current, { type: "cancel", reason, now: now() });
        setJob(cancelled);
        return cancelled;
      }

      return current;
    },

    retry(jobId: string): ProcessingJob<TInput, TResult> | undefined {
      const current = jobs.get(jobId);
      if (!current) return undefined;
      const retried = transitionProcessingJob(current, { type: "retry", now: now() });
      setJob(retried);
      queue.push(jobId);
      pump();
      return retried;
    },

    getJob(jobId: string): ProcessingJob<TInput, TResult> | undefined {
      return jobs.get(jobId);
    },

    listJobs(): Array<ProcessingJob<TInput, TResult>> {
      return Array.from(jobs.values());
    },

    whenIdle(): Promise<void> {
      if (activeJobs === 0 && queue.length === 0) return Promise.resolve();
      return new Promise((resolve) => {
        idleResolvers.push(resolve);
      });
    },
  };
}

function resolveDeviceTier(capabilities: DeviceCapabilities): DeviceTier {
  const lowResource =
    capabilities.hardwareConcurrency <= 2 ||
    (capabilities.deviceMemoryGB !== null && capabilities.deviceMemoryGB <= 2);

  if (lowResource || !capabilities.webcodecs) {
    return "low";
  }

  const highResource =
    capabilities.hardwareConcurrency >= 8 &&
    (capabilities.deviceMemoryGB === null || capabilities.deviceMemoryGB >= 8);

  if (highResource && capabilities.webgpu && capabilities.webcodecs && capabilities.opfs && !capabilities.mobile) {
    return "high";
  }

  return "mid";
}

function getProfileReasons(capabilities: DeviceCapabilities, tier: DeviceTier): string[] {
  const reasons = [`tier:${tier}`];
  if (!capabilities.webgpu) reasons.push("webgpu-unavailable");
  if (!capabilities.webcodecs) reasons.push("webcodecs-unavailable");
  if (!capabilities.opfs) reasons.push("opfs-unavailable");
  if (capabilities.hardwareConcurrency <= 2) reasons.push("low-core-count");
  if (capabilities.deviceMemoryGB !== null && capabilities.deviceMemoryGB <= 2) reasons.push("low-memory");
  if (capabilities.mobile) reasons.push("mobile-profile");
  return reasons;
}

function normalizeHardwareConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}

function normalizeMemory(value: number | undefined): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function isTerminal(status: ProcessingJobStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(99, Math.round(progress)));
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function parseWorkerResponse(value: unknown): LocalProcessingWorkerResponse | null {
  if (!isRecord(value)) return null;
  if (value.protocol !== LOCAL_PROCESSING_PROTOCOL) return null;
  if (typeof value.requestId !== "string" || typeof value.jobId !== "string") return null;

  if (value.type === "progress" && typeof value.progress === "number") {
    return {
      protocol: LOCAL_PROCESSING_PROTOCOL,
      type: "progress",
      requestId: value.requestId,
      jobId: value.jobId,
      progress: clampProgress(value.progress),
      message: typeof value.message === "string" ? value.message : undefined,
    };
  }

  if (value.type === "success") {
    return {
      protocol: LOCAL_PROCESSING_PROTOCOL,
      type: "success",
      requestId: value.requestId,
      jobId: value.jobId,
      result: value.result,
    };
  }

  if (value.type === "failure" && typeof value.error === "string") {
    return {
      protocol: LOCAL_PROCESSING_PROTOCOL,
      type: "failure",
      requestId: value.requestId,
      jobId: value.jobId,
      error: value.error,
      recoverable: value.recoverable === true,
    };
  }

  if (value.type === "cancelled") {
    return {
      protocol: LOCAL_PROCESSING_PROTOCOL,
      type: "cancelled",
      requestId: value.requestId,
      jobId: value.jobId,
      reason: typeof value.reason === "string" ? value.reason : undefined,
    };
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createRequestId(): string {
  return `lp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeBytes(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes < 0) return 0;
  return Math.floor(bytes);
}
