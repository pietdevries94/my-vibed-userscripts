import { log, logEntries } from "./script-log.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("the log keeps message and data, and leaves out missing data", () => {
  log("poll started");
  log("status", { pullRequestId: 7 });
  assert.deepEqual(logEntries().slice(-2), [
    { message: "poll started" },
    { data: { pullRequestId: 7 }, message: "status" },
  ]);
});
