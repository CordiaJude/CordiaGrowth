/** Runs `worker` over `items` with at most `limit` in flight. Preserves order. */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  shouldStop?: () => boolean,
): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      if (shouldStop?.()) return;
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}
