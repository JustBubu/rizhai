import assert from "node:assert/strict";
import test from "node:test";
import { withLock } from "../src/lib/file-lock.ts";

test("withLock serializes concurrent writers on the same key", async () => {
  const seen: number[] = [];
  let value = 0;
  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      withLock("counter", async () => {
        const current = value;
        await new Promise((resolve) => setTimeout(resolve, 0));
        value = current + 1;
        seen.push(index);
      }),
    ),
  );
  assert.equal(value, 20);
  assert.equal(seen.length, 20);
});
