import assert from "node:assert/strict";
import { inSequence } from "./in-sequence.ts";
import { test } from "node:test";

test("each item starts after the one before it has finished, and results keep their order", async () => {
  const log: string[] = [];
  const results = await inSequence([30, 10, 20], async (ms) => {
    log.push(`start ${ms}`);
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
    log.push(`end ${ms}`);
    return ms * 2;
  });
  assert.deepEqual(results, [60, 20, 40]);
  assert.deepEqual(log, ["start 30", "end 30", "start 10", "end 10", "start 20", "end 20"]);
});
