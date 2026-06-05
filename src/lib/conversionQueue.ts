export type LimitedConcurrencyResult<TItem> =
  | { item: TItem; status: "fulfilled" }
  | { item: TItem; status: "rejected"; error: unknown };

type LimitedConcurrencyOptions = {
  concurrency: number;
};

export async function runLimitedConcurrency<TItem>(
  items: readonly TItem[],
  worker: (item: TItem, index: number) => Promise<void>,
  options: LimitedConcurrencyOptions,
): Promise<Array<LimitedConcurrencyResult<TItem>>> {
  const concurrency = normalizeConcurrency(options.concurrency);
  if (items.length === 0) return [];

  const results = new Array<LimitedConcurrencyResult<TItem>>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;

      const item = items[index];
      try {
        await worker(item, index);
        results[index] = { item, status: "fulfilled" };
      } catch (error) {
        results[index] = { item, status: "rejected", error };
      }
    }
  };

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, runWorker));

  return results;
}

function normalizeConcurrency(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    throw new Error("Concurrency must be at least 1");
  }
  return Math.floor(value);
}
