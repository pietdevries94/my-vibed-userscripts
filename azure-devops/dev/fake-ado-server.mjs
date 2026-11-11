// A local stand-in for Azure DevOps, built from the captured fixtures.
//
//   npm run fake-ado
//   http://localhost:8787/fake-org/project-1/_git/repo-1/pullrequests
//
// Change the build status of a pull request while the page is open:
//   http://localhost:8787/__dev/set-build-status?pullRequestId=1012&status=running
// Statuses: queued, running, approved, rejected, broken. `reset` restores the fixture.
//
// Change a pull request, so the list page reloads itself:
//   http://localhost:8787/__dev/change-pull-request?pullRequestId=1012
//
// The fake board, and a change to one of its cards (by someone else, or by=me):
//   http://localhost:8787/fake-org/project-1/_boards/board/t/team-1/Stories
//   http://localhost:8787/__dev/change-work-item?id=5001
//
// Other dev endpoints: /__dev/requests lists the API requests received.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const PORT = 8787;
const BUILD_POLICY_TYPE_ID = "0609b952-1397-4640-95ec-e00a01b2c241";
const repositoryRoot = new URL("..", import.meta.url);
const readRepositoryFile = (path) => readFile(new URL(path, repositoryRoot), "utf8");

const fixture = JSON.parse(await readRepositoryFile("fixtures/policy-evaluations-repository-pull-requests.json"));
const buildStatusOverrides = new Map();
const apiRequests = [];
const pullRequestRevisions = new Map(Object.keys(fixture.evaluationsByPullRequestId).map((pullRequestId) => [pullRequestId, 1]));

// The capture scrubs names, so the fake page labels each avatar with one of these.
const FAKE_REVIEWERS = [
  { id: "reviewer-1", displayName: "Mira Holt", vote: 0 },
  { id: "reviewer-2", displayName: "Tomas van Elst", vote: 10, isRequired: true },
  { id: "reviewer-3", displayName: "[project-1]\\Backend Team", vote: 0, isRequired: true },
];

// No list response was captured. These are the documented fields the extension reads.
const listedPullRequests = () => [...pullRequestRevisions].map(([pullRequestId, revision]) => ({
  pullRequestId: Number(pullRequestId),
  title: `Pull request ${pullRequestId}, revision ${revision}`,
  isDraft: false,
  status: "active",
  targetRefName: "refs/heads/main",
  reviewers: FAKE_REVIEWERS,
  lastMergeSourceCommit: { commitId: `commit-${revision}` },
}));

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>Fake Azure DevOps</title>
<style>
  body { font: 14px system-ui, sans-serif; margin: 24px; ${Object.entries(fixture.meta.statusColors).map(([name, value]) => `${name}: ${value};`).join(" ")} }
  .flex-row { display: flex; } .flex-column { display: flex; flex-direction: column; } .flex-center { align-items: center; }
  .flex-grow { flex-grow: 1; } .invisible, .visually-hidden, [hidden] { display: none; }
  a.bolt-table-row { display: table-row; color: inherit; text-decoration: none; }
  td { padding: 8px 4px; border-bottom: 1px solid #ddd; } .secondary-text { color: #666; }
  .bolt-card { border: 1px solid #ccc; border-radius: 4px; margin-bottom: 16px; padding: 8px; }
  .bolt-pill { border: 1px solid #999; border-radius: 10px; padding: 0 8px; margin-left: 4px; }
  .bolt-coin { width: 24px; height: 24px; border-radius: 50%; background: #bbb; } img { display: none; }
</style>
<div id="app">Loading…</div>
<script type="module">
  import { buildFixtureDom } from "/__dev/fixture-dom.mjs";
  const fixtureHtml = await (await fetch("/__dev/pr-list.html")).text();
  const app = buildFixtureDom(document, fixtureHtml);
  const reviewerNames = ${JSON.stringify(["Mira Holt", "Tomas van Elst", "Backend Team"])};
  for (const row of app.querySelectorAll("a.bolt-table-row")) {
    row.querySelectorAll(".pr-reviewer .bolt-coin").forEach((avatar, index) => avatar.setAttribute("aria-label", reviewerNames[index % reviewerNames.length]));
  }
  document.getElementById("app").replaceWith(app);
</script>`;

// The capture masks ids and names, so the fake board numbers its cards and names its avatars.
const FIRST_FAKE_WORK_ITEM_ID = 5001;
const FAKE_USER_ID = "fake-user-me";
const workItemChanges = new Map();
const BOARD_PAGE = `<!doctype html>
<meta charset="utf-8">
<title>Fake Azure DevOps board</title>
<style>
  body { font: 13px system-ui, sans-serif; margin: 0; }
  .flex-row { display: flex; } .flex-column { display: flex; flex-direction: column; } .flex-center { align-items: center; }
  .kanban-board-content { display: flex; gap: 8px; align-items: flex-start; } .kanban-board-column { width: 260px; }
  .wit-card { border: 1px solid #ccc; border-radius: 4px; margin: 4px; padding: 6px; background: #fff; }
  .card-flag { width: 4px; margin-right: 6px; } .identity-view { display: flex; align-items: center; gap: 6px; }
  .vss-Persona { width: 20px; height: 20px; display: inline-block; flex-shrink: 0; } .vss-Persona.small { width: 24px; height: 24px; }
  .vss-Persona-content { width: 100%; height: 100%; border-radius: 50%; background: #bbb; display: block; }
  nav, header, .region-header, .project-navigation { display: none; }
</style>
<body>Loading…</body>
<script type="module">
  const fixtureHtml = await (await fetch("/__dev/page-board.html")).text();
  const page = document.createElement("div");
  page.innerHTML = fixtureHtml;
  const names = ["Holt, Mira", "Elst, Tomas van", "Brandt, Ivo", "Okafor, Lena"];
  page.querySelectorAll(".wit-card").forEach((card, index) => {
    card.setAttribute("data-itemid", String(${FIRST_FAKE_WORK_ITEM_ID} + index));
    card.classList.remove("hidden");
    card.querySelector(".vss-Persona")?.setAttribute("aria-label", names[index % names.length]);
  });
  document.body.replaceChildren(...page.childNodes);
</script>`;

function policyEvaluations(pullRequestId) {
  const captured = fixture.evaluationsByPullRequestId[pullRequestId];
  if (!captured) return null;
  const body = structuredClone(captured.body);
  const overriddenStatus = buildStatusOverrides.get(pullRequestId);
  for (const evaluation of body.value) {
    if (overriddenStatus && evaluation.configuration.type.id === BUILD_POLICY_TYPE_ID) {
      evaluation.status = overriddenStatus;
      evaluation.context = { ...evaluation.context, buildId: evaluation.context?.buildId ?? 1, isExpired: false };
    }
  }
  return body;
}

const send = (response, status, contentType, body) => {
  response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
  response.end(body);
};
const sendJson = (response, status, body) => send(response, status, "application/json", JSON.stringify(body, null, 2));

createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  if (path.includes("/_apis/")) apiRequests.push(`${request.method} ${path}${url.search}`);
  if (request.method !== "GET") return sendJson(response, 405, { message: "The fake ADO accepts GET only." });

  const isApiRequest = path.includes("/_apis/");
  if (!isApiRequest && (path.endsWith("/pullrequests") || path.endsWith("/_pulls"))) return send(response, 200, "text/html", PAGE);
  if (path.includes("/_boards/board/")) return send(response, 200, "text/html", BOARD_PAGE);

  const projectMatch = path.match(/^\/fake-org\/_apis\/projects\/([^/]+)$/);
  if (projectMatch) {
    const id = fixture.meta.projectGuids[decodeURIComponent(projectMatch[1])];
    return id ? sendJson(response, 200, { id }) : sendJson(response, 404, { message: "Unknown project" });
  }

  if (/^\/fake-org\/[^/]+\/_apis\/policy\/evaluations$/.test(path)) {
    const pullRequestId = (url.searchParams.get("artifactId") ?? "").split("/").pop();
    const body = policyEvaluations(pullRequestId);
    return body ? sendJson(response, 200, body) : sendJson(response, 404, { message: "Unknown pull request" });
  }

  if (/^\/fake-org\/[^/]+\/_apis\/git\/repositories\/[^/]+\/pullrequests$/.test(path)) {
    const isActiveList = url.searchParams.get("searchCriteria.status") === "active";
    const value = isActiveList ? listedPullRequests() : [];
    return sendJson(response, 200, { value, count: value.length });
  }

  if (path === "/fake-org/_apis/wit/workitems") {
    const value = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean).map((id) => {
      const change = workItemChanges.get(id) ?? { rev: 1, changedById: "fake-user-other" };
      return { id: Number(id), rev: change.rev, fields: { "System.Rev": change.rev, "System.ChangedBy": { id: change.changedById } } };
    });
    return sendJson(response, 200, { count: value.length, value });
  }
  if (path === "/fake-org/_apis/connectionData") return sendJson(response, 200, { authenticatedUser: { id: FAKE_USER_ID } });

  if (path === "/__dev/change-work-item") {
    const id = url.searchParams.get("id");
    const rev = (workItemChanges.get(id)?.rev ?? 1) + 1;
    workItemChanges.set(id, { rev, changedById: url.searchParams.get("by") === "me" ? FAKE_USER_ID : "fake-user-other" });
    return sendJson(response, 200, Object.fromEntries(workItemChanges));
  }
  if (path === "/__dev/page-board.html") return send(response, 200, "text/html", await readRepositoryFile("fixtures/page-board.html"));

  if (path === "/__dev/change-pull-request") {
    const pullRequestId = url.searchParams.get("pullRequestId");
    pullRequestRevisions.set(pullRequestId, (pullRequestRevisions.get(pullRequestId) ?? 0) + 1);
    return sendJson(response, 200, listedPullRequests());
  }

  if (path === "/__dev/set-build-status") {
    const pullRequestId = url.searchParams.get("pullRequestId");
    const status = url.searchParams.get("status");
    if (status === "reset") buildStatusOverrides.delete(pullRequestId);
    else buildStatusOverrides.set(pullRequestId, status);
    return sendJson(response, 200, Object.fromEntries(buildStatusOverrides));
  }
  if (path === "/__dev/requests") return sendJson(response, 200, apiRequests);
  if (path === "/__dev/pr-list.html") return send(response, 200, "text/html", await readRepositoryFile("fixtures/pr-list-repository-pull-requests.html"));
  if (path === "/__dev/fixture-dom.mjs") return send(response, 200, "text/javascript", await readRepositoryFile("dev/fixture-dom.mjs"));
  if (path === "/__dev/content.js") return send(response, 200, "text/javascript", await readRepositoryFile("dist/dev/content.js"));
  if (path === "/__dev/content.css") return send(response, 200, "text/css", await readRepositoryFile("dist/dev/content.css"));

  sendJson(response, 404, { message: "Not found" });
}).listen(PORT, () => {
  console.log(`Fake ADO: http://localhost:${PORT}/fake-org/project-1/_git/repo-1/pullrequests`);
});
