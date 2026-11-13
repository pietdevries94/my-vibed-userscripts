import assert from "node:assert/strict";
import { parsePage } from "./page.ts";
import { test } from "node:test";

const pageAt = (pathname: string, search = ""): ReturnType<typeof parsePage> =>
  parsePage({ pathname, search }, "/my-org");

test("each Azure DevOps location gives its page", () => {
  assert.deepEqual(pageAt("/my-org/my-project/_boards/board/t/my-team/Stories"), {
    kind: "board",
  });
  assert.deepEqual(pageAt("/my-org/my-project/_git/my-repo/pullrequests", "?_a=completed"), {
    kind: "pull-request-list",
    listPage: { project: "my-project", repository: "my-repo", status: "completed" },
  });
  assert.deepEqual(pageAt("/my-org/_pulls"), { kind: "pull-request-inbox" });
  assert.deepEqual(pageAt("/my-org/my-project/_git/my-repo/pullrequest/42"), {
    kind: "pull-request",
    pullRequest: { project: "my-project", pullRequestId: 42, repository: "my-repo" },
  });
  assert.deepEqual(pageAt("/my-org/my-project/_build/results", "?buildId=7"), { kind: "other" });
});
