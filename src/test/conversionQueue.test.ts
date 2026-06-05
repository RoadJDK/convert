import { describe, expect, it } from "vitest";
import { runLimitedConcurrency } from "@/lib/conversionQueue";

function createGate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("conversion queue", () => {
  it("runs every job while respecting the concurrency limit", async () => {
    const gates = [createGate(), createGate(), createGate(), createGate()];
    const started: number[] = [];
    const completed: number[] = [];
    let active = 0;
    let maxActive = 0;

    const run = runLimitedConcurrency(
      [0, 1, 2, 3],
      async (item) => {
        started.push(item);
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gates[item].promise;
        active -= 1;
        completed.push(item);
      },
      { concurrency: 2 },
    );

    await Promise.resolve();
    expect(started).toEqual([0, 1]);

    gates[0].release();
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2]);

    gates[1].release();
    gates[2].release();
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2, 3]);

    gates[3].release();
    const results = await run;

    expect(completed).toEqual([0, 1, 2, 3]);
    expect(maxActive).toBe(2);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
  });

  it("continues later jobs when one job fails", async () => {
    const results = await runLimitedConcurrency(
      [0, 1, 2],
      async (item) => {
        if (item === 1) throw new Error("failed");
      },
      { concurrency: 1 },
    );

    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });
});
