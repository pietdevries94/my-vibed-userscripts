import {
  apiBasePath,
  isPullRequestInboxLocation,
  parsePullRequestHref,
  parsePullRequestListLocation,
} from "./pull-request-link.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("the API base path is the organisation on dev.azure.com", () => {
  assert.equal(
    apiBasePath({
      hostname: "dev.azure.com",
      pathname: "/my-org/my-project/_git/my-repo/pullrequests",
    }),
    "/my-org",
  );
});

test("the API base path is empty on a visualstudio.com host", () => {
  assert.equal(
    apiBasePath({
      hostname: "my-org.visualstudio.com",
      pathname: "/my-project/_git/my-repo/pullrequests",
    }),
    "",
  );
  assert.equal(
    apiBasePath({
      hostname: "my-org.visualstudio.com",
      pathname: "/DefaultCollection/my-project/_pulls",
    }),
    "/DefaultCollection",
  );
});

test("a pull request link gives project, repository and id", () => {
  assert.deepEqual(
    parsePullRequestHref("/my-org/my%20project/_git/my-repo/pullrequest/42", "/my-org"),
    {
      project: "my project",
      pullRequestId: 42,
      repository: "my-repo",
    },
  );
  assert.deepEqual(
    parsePullRequestHref(
      "https://my-org.visualstudio.com/my-project/_git/my-repo/pullrequest/42?_a=files",
      "",
    ),
    {
      project: "my-project",
      pullRequestId: 42,
      repository: "my-repo",
    },
  );
});

test("a link without a project segment uses the repository name as project", () => {
  assert.deepEqual(parsePullRequestHref("/my-org/_git/shared/pullrequest/7", "/my-org"), {
    project: "shared",
    pullRequestId: 7,
    repository: "shared",
  });
});

test("other links are not pull requests", () => {
  assert.equal(
    parsePullRequestHref("/my-org/my-project/_git/my-repo/pullrequests", "/my-org"),
    null,
  );
  assert.equal(parsePullRequestHref("/my-org/my-project/_build/results", "/my-org"), null);
});

test("a repository pull request list location", () => {
  assert.deepEqual(
    parsePullRequestListLocation(
      { pathname: "/my-org/my%20project/_git/my-repo/pullrequests", search: "?_a=mine" },
      "/my-org",
    ),
    { project: "my project", repository: "my-repo", status: "active" },
  );
  assert.deepEqual(
    parsePullRequestListLocation(
      { pathname: "/my-org/my-project/_git/my-repo/pullrequests", search: "?_a=completed" },
      "/my-org",
    )?.status,
    "completed",
  );
  assert.deepEqual(
    parsePullRequestListLocation(
      { pathname: "/my-org/_git/shared/pullrequests", search: "" },
      "/my-org",
    ),
    { project: "shared", repository: "shared", status: "active" },
  );
});

test("other locations are not a repository pull request list", () => {
  assert.equal(
    parsePullRequestListLocation(
      { pathname: "/my-org/my-project/_git/my-repo/pullrequest/42", search: "" },
      "/my-org",
    ),
    null,
  );
  assert.equal(
    parsePullRequestListLocation({ pathname: "/my-org/_pulls", search: "" }, "/my-org"),
    null,
  );
  assert.equal(
    parsePullRequestListLocation(
      { pathname: "/my-org/my-project/_git/my-repo", search: "" },
      "/my-org",
    ),
    null,
  );
});

test("the pull request inbox location", () => {
  assert.equal(isPullRequestInboxLocation({ pathname: "/my-org/_pulls" }), true);
  assert.equal(isPullRequestInboxLocation({ pathname: "/my-org/my-project/_pulls/" }), true);
  assert.equal(isPullRequestInboxLocation({ pathname: "/_pulls" }), true, "on visualstudio.com");
  assert.equal(
    isPullRequestInboxLocation({ pathname: "/my-org/my-project/_git/my-repo/pullrequests" }),
    false,
  );
});
