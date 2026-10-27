const queues = new Map<string, Promise<unknown>>();

/** 按 key 串行化异步写，避免 JSON 文件 read-modify-write 互相覆盖。 */
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  queues.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}
