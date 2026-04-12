export async function mapWithConcurrency<T, R>(
  items: T[],
  requestedConcurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const normalizedConcurrency = Math.max(1, Math.min(items.length, Math.floor(requestedConcurrency) || 1));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = items[currentIndex];
      results[currentIndex] = await worker(item as T, currentIndex);
    }
  };

  const runners: Promise<void>[] = [];
  for (let i = 0; i < normalizedConcurrency; i += 1) {
    runners.push(runWorker());
  }

  await Promise.all(runners);
  return results;
}
