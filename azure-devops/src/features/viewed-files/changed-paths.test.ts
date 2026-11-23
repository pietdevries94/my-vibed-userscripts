import assert from "node:assert/strict";
import { loadChangedPaths } from "./changed-paths.ts";
import { test } from "node:test";

const PULL_REQUEST = { project: "shop", pullRequestId: 7, repository: "web" };

test("a deleted file counts as changed: Azure DevOps sends its path as originalPath, with no item path", async () => {
  const paths = await loadChangedPaths(
    {
      getIterationChanges: async () => [
        { changeTrackingId: 1, item: { path: "/api/orders.ts" } },
        { changeTrackingId: 2, item: { path: null }, originalPath: "/api/legacy.ts" },
      ],
      getPullRequestIterationIds: async () => [1],
    },
    PULL_REQUEST,
  );
  assert.deepEqual(paths, ["/api/orders.ts", "/api/legacy.ts"]);
});
