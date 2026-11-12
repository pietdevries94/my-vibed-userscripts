# PR pipeline status in the Azure DevOps PR list: research

Researched 2026-11-10. Scope: an Azure DevOps userscript in Zen (Firefox) that shows a build-validation status icon in each PR row on `https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequests` and `https://dev.azure.com/{org}/_pulls`, and updates it by polling.

Source shorthand used below:

- **azdo-userscripts**: [alejandro5042/azdo-userscripts](https://github.com/alejandro5042/azdo-userscripts), commit `6ed0a37`, last commit 2026-10-19.
- **unfuck-ado**: [nthomsencph/unfuck-ado](https://github.com/nthomsencph/unfuck-ado), commit `8736abc`, last commit 2026-11-03.

## Summary

- **Data source.** Policy evaluations (`_apis/policy/evaluations`) are the right source. On Azure Repos Git, PR pipelines can only be configured as build-validation branch policies ([docs](https://learn.microsoft.com/en-us/azure/devops/pipelines/repos/azure-repos-git?view=azure-devops)), so every PR pipeline has a policy evaluation. The endpoint is still `7.1-preview.1`. It takes one PR per call. No batch endpoint exists.
- **Cheap change detector.** One Builds list call per project with `reasonFilter=pullRequest` returns builds for all PRs. PR builds have `sourceBranch = refs/pull/{id}/merge`.
- **Auth.** The script runs in the page and calls `/_apis/...` same-origin with the page's session cookie. No PAT and no CSRF header. Two open-source scripts do this in production.
- **Rate limits.** 200 TSTUs per sliding 5 minutes per user. Cost per call is not documented. Read `X-RateLimit-Remaining` and `Retry-After` and back off.
- **DOM.** Rows are `a.bolt-table-row[href*="/pullrequest/"]` inside `table.repos-pr-list`. The PR id is in the href. React re-renders and reuses rows, so every injection must be idempotent and re-applied from a `MutationObserver`.
- **Existing work.** azdo-userscripts already shows build status in PR rows (commit statuses on `lastMergeCommit`, emoji pill, no polling). ADO's own status icon is `svg.bolt-status.{success|failed|warning|active|neutral}` from `azure-devops-ui`.

**Recommendation.** The script reads PR ids from the rows, fetches policy evaluations same-origin with the page's session cookie, renders an inline SVG with the `bolt-status` classes, and polls with `setTimeout` while `document.visibilityState === "visible"`. Poll PRs with a `queued` or `running` evaluation every 15 to 30 s and the rest every 2 to 5 min.

---

## 1. Zen

- Zen's `surfer.json` declares `"product": "firefox", "version": "159.0.1"` and binary name `zen` ([surfer.json, dev branch](https://github.com/zen-browser/desktop/blob/dev/surfer.json)). Latest release at time of writing: 1.24.1b, published 2026-11-06 ([releases](https://github.com/zen-browser/desktop/releases)).
- The Zen docs FAQ states the codebase "is derived from Firefox". It lists no extension API differences. It lists one platform difference: no DRM/Widevine ([Zen FAQ](https://docs.zen-browser.app/faq)).
- Zen workspaces are tab groupings. Cookie isolation comes from container tabs. A workspace can have a default container ([Zen workspaces](https://docs.zen-browser.app/user-manual/workspaces)).

---

## 2. Azure DevOps data: where the PR pipeline status comes from

All URLs also work on `https://{org}.visualstudio.com/...` (section 3).

### 2.1 Pull request list

- By project: `GET https://dev.azure.com/{organization}/{project}/_apis/git/pullrequests?api-version=7.1` ([reference](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests-by-project?view=azure-devops-rest-7.1)).
- By repository: `GET https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repositoryId}/pullrequests?api-version=7.1` ([reference](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests?view=azure-devops-rest-7.1)).
- Filters: `searchCriteria.status` (`active` default, `abandoned`, `completed`, `all`), `searchCriteria.creatorId`, `searchCriteria.reviewerId`, `searchCriteria.repositoryId`, `searchCriteria.targetRefName`, `$top`, `$skip`. Scope `vso.code`.
- Relevant `GitPullRequest` fields: `pullRequestId`, `repository.id`, `repository.project.id`, `isDraft`, `status`, `mergeStatus` (`notSet`, `queued`, `conflicts`, `succeeded`, `rejectedByPolicy`, `failure`), `lastMergeCommit`, `lastMergeSourceCommit`.
- The list response contains **no build or policy status**. `mergeStatus` is the status of the merge job, not of the pipeline.
- `GitPullRequest.artifactId` uses a different template (`vstfs:///Git/PullRequestId/{projectId}/{repositoryId}/{pullRequestId}`) than the one policy evaluations require.
- The script may not need this endpoint. PR ids are in the DOM (section 5). It needs the project GUID once per project.

### 2.2 Policy evaluations (recommended source)

- `GET https://dev.azure.com/{organization}/{project}/_apis/policy/evaluations?artifactId={artifactId}&api-version=7.1-preview.1` ([reference](https://learn.microsoft.com/en-us/rest/api/azure/devops/policy/evaluations/list?view=azure-devops-rest-7.1)).
- Still preview: the 7.1 page lists API version `7.1-preview.1`.
- `artifactId = vstfs:///CodeReview/CodeReviewId/{projectId}/{pullRequestId}`. `projectId` must be the GUID. URL-encode the value.
- Optional: `includeNotApplicable`, `$top`, `$skip`. Scope `vso.code`.
- `PolicyEvaluationStatus`:

| Value           | Meaning (doc text)                                                      |
| --------------- | ----------------------------------------------------------------------- |
| `queued`        | "either queued to run, or is waiting for some event before progressing" |
| `running`       | "currently running"                                                     |
| `approved`      | "has been fulfilled for this pull request"                              |
| `rejected`      | "has rejected this pull request"                                        |
| `notApplicable` | "does not apply to this pull request"                                   |
| `broken`        | "has encountered an unexpected error"                                   |

- Record fields: `evaluationId`, `status`, `startedDate`, `completedDate`, `configuration` (`id`, `isBlocking`, `isEnabled`, `isDeleted`, `settings`, `type.id`, `type.displayName`), `context`.
- **Telling build validation from other policies.** Build policy type id is `0609b952-1397-4640-95ec-e00a01b2c241`. Its settings carry `buildDefinitionId`. Both appear in the sample body of [Policy Configurations - Create](https://learn.microsoft.com/en-us/rest/api/azure/devops/policy/configurations/create?view=azure-devops-rest-7.1). All type ids can be read at runtime from `GET .../_apis/policy/types?api-version=7.1` ([reference](https://learn.microsoft.com/en-us/rest/api/azure/devops/policy/types/list?view=azure-devops-rest-7.1)).
- **Build id.** The reference describes `context` only as "Internal context data of this policy evaluation". The keys are undocumented. Third-party code reads `context.buildId` and `context.buildDefinitionName` on build policies ([SinishaDjukic/worca-cc `src/core/pr/azure.mjs`](https://github.com/SinishaDjukic/worca-cc/blob/main/src/core/pr/azure.mjs)). Treat as unverified until checked against a live response.
- `configuration.isBlocking` separates required from optional policies.
- unfuck-ado calls this endpoint same-origin with `7.1-preview.1` and resolves the project GUID through `GET /{org}/_apis/projects/{project}` ([checks-api.ts](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr/checks-api.ts)).

### 2.3 Pull request statuses

- `GET https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repositoryId}/pullRequests/{pullRequestId}/statuses?api-version=7.1` ([reference](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-statuses/list?view=azure-devops-rest-7.1)). Scopes `vso.code`, `vso.code_status`.
- `GitStatusState`: `notSet`, `pending`, `succeeded`, `failed`, `error`, `notApplicable`. Fields: `context.name`, `context.genre`, `description`, `targetUrl`, `iterationId`.
- What posts here: external services using the Status API. "Pull request statuses integrate into the PR workflow and allow external services to programmatically sign off on a code change." Only the latest status per unique `context` is shown ([PR status concept](https://learn.microsoft.com/en-us/azure/devops/repos/git/pull-request-status?view=azure-devops)).
- A **status policy** turns such a status into a branch policy. It then also appears as a policy evaluation ([same page](https://learn.microsoft.com/en-us/azure/devops/repos/git/pull-request-status?view=azure-devops)).
- The docs do not say that Azure Pipelines build validation posts PR statuses. Build validation is described as a branch policy ([branch policies](https://learn.microsoft.com/en-us/azure/devops/repos/git/branch-policies?view=azure-devops)).

### 2.4 Commit statuses (what azdo-userscripts uses)

- `GET https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repositoryId}/commits/{commitId}/statuses?latestOnly=true&api-version=7.1` ([reference](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/statuses/list?view=azure-devops-rest-7.1)). `latestOnly` groups by `Context.Name` and `Context.Genre`. `top` defaults to 1000.
- azdo-userscripts reads statuses of `pr.lastMergeCommit` and treats them as build results ([source L2115-L2133](https://github.com/alejandro5042/azdo-userscripts/blob/6ed0a3710bca936f7ea088ed10389d321d7d61c7/src/azdo-pr-dashboard.user.js#L2115-L2133)). Its README notes the label is empty if "there isn't a merge commit or a build configured" ([README](https://github.com/alejandro5042/azdo-userscripts/blob/6ed0a3710bca936f7ea088ed10389d321d7d61c7/README.md)).
- Costs two calls per PR (PR by id, then statuses). No queued state before a merge commit exists.

### 2.5 Build API

- `GET https://dev.azure.com/{organization}/{project}/_apis/build/builds?api-version=7.1` ([reference](https://learn.microsoft.com/en-us/rest/api/azure/devops/build/builds/list?view=azure-devops-rest-7.1)). Scope `vso.build`.
- Filters: `branchName`, `reasonFilter`, `statusFilter`, `resultFilter`, `definitions`, `buildIds` (comma-delimited), `repositoryId`, `repositoryType`, `queryOrder`, `$top`, `maxBuildsPerDefinition`, `continuationToken`.
- PR builds have `sourceBranch = refs/pull/{id}/merge`. Documented for `Build.SourceBranch`: "Git repo pull request: `refs/pull/1/merge`" ([predefined variables](https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops)).
- `BuildReason` includes `pullRequest` ("The build was started by a pull request").
- `BuildStatus`: `none`, `inProgress`, `completed`, `cancelling`, `postponed`, `notStarted`, `all`.
- `BuildResult`: `none`, `succeeded`, `partiallySucceeded`, `failed`, `canceled`.
- `triggerInfo` is documented only as "Sourceprovider-specific information about what triggered the build". Third-party models read a `pr.number` key ([BoskoD/ADOMonitor `TriggerInfo.cs`](https://github.com/BoskoD/ADOMonitor/blob/main/ADOMonitor/Models/ADOBuilds/TriggerInfo.cs)). Undocumented.

### 2.6 Batch options

- Policy evaluations: one `artifactId` per call. No batch form in the reference.
- PR statuses and commit statuses: one PR or commit per call.
- Builds list: one call returns builds for many PRs in a project. Use `reasonFilter=pullRequest&queryOrder=queueTimeDescending&$top=N` and group by `sourceBranch`. `buildIds` fetches a known set in one call. This is the only documented multi-PR route.
- PR list: one call per project or repo, but it carries no pipeline status.

### 2.7 Which source is right

- On Azure Repos Git, "you cannot configure a PR trigger in the YAML file. You need to use branch policies" ([docs](https://learn.microsoft.com/en-us/azure/devops/pipelines/repos/azure-repos-git?view=azure-devops)). So a PR pipeline always has a build policy evaluation.
- Policy evaluations give required vs optional, the queued state before a build starts, expiry, and status policies from external CI in the same response.
- Builds on the source branch that run from a CI trigger are not PR builds. They are not in policy evaluations. They show up as builds with `reasonFilter=individualCI`/`batchedCI` on `refs/heads/{branch}`, and possibly as commit statuses on `lastMergeSourceCommit` (not verified).
- Draft PRs "do not trigger a pipeline even if you configure a branch policy" ([docs](https://learn.microsoft.com/en-us/azure/devops/pipelines/repos/azure-repos-git?view=azure-devops)). Expect `queued` or no build there.
- With trigger **Manual**, "users must queue the build themselves" ([branch policies](https://learn.microsoft.com/en-us/azure/devops/repos/git/branch-policies?view=azure-devops)). The evaluation exists without a build.
- Suggested mapping to one icon per PR: any `rejected`/`broken` build evaluation gives failed. Else any `running` gives running. Else any `queued` gives queued. Else all `approved` gives succeeded. No build evaluations gives no icon. Show required and optional separately or prefer required.

### 2.8 What the ADO web UI calls

- Not verified. No logged-in session was available.
- The page embeds initial data in `<script id="dataProviders">`. azdo-userscripts parses it and warns that it "doesn't always get updated when moving between page-to-page" in the SPA ([source L174-L176](https://github.com/alejandro5042/azdo-userscripts/blob/6ed0a3710bca936f7ea088ed10389d321d7d61c7/src/azdo-pr-dashboard.user.js#L174-L176)).
- `POST /{org}/_apis/Contribution/HierarchyQuery?api-version=5.0-preview.1` exists and is used by third-party tools ([github/gh-gei `AdoApi.cs`](https://github.com/github/gh-gei/blob/main/src/Octoshift/Services/AdoApi.cs)). It is **undocumented**. Which data-provider ids the PR pages use was not established.
- unfuck-ado notes that the PR detail checks box "shows only Build policies plus a 'View n checks' link" and fills in the rest from policy evaluations ([checks-api.ts](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr/checks-api.ts)).

---

## 3. Auth from the script

### Same-origin, session cookie

- The script fetches `/{org}/_apis/...` from a dev.azure.com tab with the page's session cookie. The request is same-origin.
- unfuck-ado calls the REST API with `fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" })` and nothing else. Its source records a live check on 2026-08-01 that no CSRF/verification header is needed, even for a PATCH ([api.ts](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/core/api.ts)). It runs in the page context (`@inject-into page`, [banner.txt](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/banner.txt)).
- azdo-userscripts does the same from a userscript-manager context with `$.get` and `fetch`, and builds its base URL from `window.location.origin` "because of CORS" ([source L183-L184](https://github.com/alejandro5042/azdo-userscripts/blob/6ed0a3710bca936f7ea088ed10389d321d7d61c7/src/azdo-pr-dashboard.user.js#L183-L184)).
- A request from the page runs in the tab, so it uses that tab's cookie store, including a container tab's.

### PAT alternative

- Header: `Authorization: Basic BASE64(":" + PAT)`. The username can be empty ([PAT docs](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops)).
- Minimum scopes: **Code (read)** `vso.code` covers PR list, policy evaluations, PR statuses and commit statuses (scope listed on each reference page above). **Build (read)** `vso.build` covers the Builds API. No separate policy scope exists in the scope table ([scope table](https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth?view=azure-devops)).
- Microsoft advises against PATs when another method exists. Global PATs are being retired. The page gives two dates: "stop working on January 27, 2027" and "stop working on December 1, 2026" ([PAT docs](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops)). Admins can restrict PAT creation and scopes.
- A PAT sent from the script on dev.azure.com is same-origin.

### Legacy `{org}.visualstudio.com`

- Both `https://dev.azure.com/{organization}` and `https://{organization}.visualstudio.com` are valid. "Organization-level REST APIs accept either URL form, regardless of when you created the organization." Orgs created before 2018-09-10 default to the legacy form ([work with URLs](https://learn.microsoft.com/en-us/azure/devops/extend/develop/work-with-urls?view=azure-devops)).
- URLs in REST responses use the same base as the request ([same page](https://learn.microsoft.com/en-us/azure/devops/extend/develop/work-with-urls?view=azure-devops)).
- Match patterns used by both scripts: `https://dev.azure.com/*` and `https://*.visualstudio.com/*` ([unfuck-ado banner.txt](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/banner.txt), [azdo-userscripts header](https://github.com/alejandro5042/azdo-userscripts/blob/6ed0a3710bca936f7ea088ed10389d321d7d61c7/src/azdo-pr-dashboard.user.js#L15-L16)).
- On the legacy host the org is the subdomain and the path may start with `DefaultCollection`. The API base is then the origin without an org segment ([unfuck-ado router.ts](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/core/router.ts), [api.ts](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/core/api.ts)).

---

## 4. Rate limits

Source for this section: [Rate and usage limits](https://learn.microsoft.com/en-us/azure/devops/integrate/concepts/rate-limits?view=azure-devops).

- Limit: 200 TSTUs per user in any sliding five-minute window. Session-cookie calls from the script count against the signed-in user, together with their normal web use.
- One TSTU is "the average load generated by a typical Azure DevOps user over five minutes". Normal use spikes to 10 TSTUs or fewer per five minutes, sometimes up to 100.
- "You can't calculate usage in TSTUs for an action with a formula." Actual cost is visible on the org's Usage page.
- Over the limit, requests are delayed "from a few milliseconds per request up to 30 seconds". Blocked requests return HTTP 429 with `TF400733`. The user gets an email and a banner when delayed significantly.
- Headers:

| Header                  | Meaning                                                                       |
| ----------------------- | ----------------------------------------------------------------------------- |
| `Retry-After`           | Seconds to wait before the next request. The response still returns HTTP 200. |
| `X-RateLimit-Resource`  | Service and threshold type. For display only.                                 |
| `X-RateLimit-Delay`     | Seconds this request was delayed.                                             |
| `X-RateLimit-Limit`     | TSTUs allowed before delays.                                                  |
| `X-RateLimit-Remaining` | TSTUs left before delays. 0 when delayed or blocked.                          |
| `X-RateLimit-Reset`     | Unix time when usage returns to 0 if consumption stops.                       |
| `X-RateLimit-Cost`      | If present, TSTUs consumed by this request.                                   |

- All except `X-RateLimit-Delay` are sent before delays start.
- Guidance: honour `Retry-After`, track `X-RateLimit-Remaining`/`X-RateLimit-Limit`, batch where possible ([best practices](https://learn.microsoft.com/en-us/azure/devops/integrate/concepts/integration-bestpractices?view=azure-devops)).

**Safe interval for 20 to 50 PRs.** No documented number exists, because cost per call is not published. Design so the answer does not matter much:

- Fetch only for rows in the DOM.
- Poll PRs with a `queued`/`running` evaluation every 15 to 30 s. Poll the rest every 2 to 5 min.
- Or use one Builds list call per project as the change detector and refetch evaluations only for PRs whose build changed.
- Stop when the tab is hidden. Refresh once on `visibilitychange`.
- On `Retry-After`, wait that long. If `X-RateLimit-Remaining` drops below a threshold, double the interval.
- Measure real cost in the sandbox org with `X-RateLimit-Cost` or the Usage page before fixing defaults.

---

## 5. DOM integration on the PR list

Selectors below come from source code and notes of the two projects, not from a live session in this research. unfuck-ado records live verification dates in its docs.

### Row structure (unfuck-ado, verified live 2026-08-20 on `/_git/{repo}/pullrequests`)

Source: [INTERNALS.md](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/docs/INTERNALS.md), [pr-list design spec](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/docs/specs/2026-08-20-pr-list-design.md), [pr-list.ts](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr-list.ts).

- Container: `table.repos-pr-list.bolt-table.bolt-table-show-lines` inside `.repos-pr-section-card.bolt-card`, under `.page-content`.
- Rows: `a.bolt-table-row[href*="/pullrequest/"]`. The row is an `<a>`.
- PR id: `/\/pullrequest\/(\d+)/` on the row's `href`.
- Row selector used in code: `.repos-pr-list a[href*="/pullrequest/"]`.
- Cells in order: spacer, avatar (`.bolt-coin.size32`), two-line cell (title `.body-l` and meta `.secondary-text.body-s`), reviewers, comments (`.repos-pr-list-comment-count`), time (`time.bolt-time-item`), side action, spacer.
- Title line: `.bolt-table-two-line-cell-item` (first one). Pills sit in `.bolt-pill-group` > `.bolt-pill-group-inner`. Draft pill: `.repos-pr-list-draft-pill`.
- New-activity marker class on the row: `bolt-list-row-marked`.
- The Mine tab renders several `.repos-pr-section-card`s ("Created by me", "Assigned to me") with the same row DOM. Tab ids: `#__bolt-tab-mine`, `-active`, `-completed`, `-abandoned`.
- These classes exist only on the list page. PR detail uses `.repos-pr-details-page`.
- After browser Back from a PR, the URL is the list's while ADO still renders the PR page for a moment. unfuck-ado waits until `.repos-pr-details-page` is gone ([pr-list.ts](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr-list.ts)).

### `_pulls` and row reuse (azdo-userscripts)

Source: [L1900-L1917](https://github.com/alejandro5042/azdo-userscripts/blob/6ed0a3710bca936f7ea088ed10389d321d7d61c7/src/azdo-pr-dashboard.user.js#L1900-L1917), [L1926-L1950](https://github.com/alejandro5042/azdo-userscripts/blob/6ed0a3710bca936f7ea088ed10389d321d7d61c7/src/azdo-pr-dashboard.user.js#L1926-L1950), [L2163-L2188](https://github.com/alejandro5042/azdo-userscripts/blob/6ed0a3710bca936f7ea088ed10389d321d7d61c7/src/azdo-pr-dashboard.user.js#L2163-L2188).

- Runs on URLs matching `/(_pulls|pullrequests)/`.
- Sections: `.repos-pr-section-card`. Section title: `.repos-pr-section-header-title > span`.
- Rows: `a[role="row"]` inside the section. PR id is the last path segment of `row.href`.
- "AzDO re-adds PR rows when it updates them" and "React will re-use this DOM element, so we need to re-enhance." The script stores the id in `row.dataset.pullRequestId`, removes its old annotations when the id changes, and watches each row for any change.
- It waits 333 ms before annotating because "PRs lose their styling shortly after the page loads".
- Injection point: appends a pill to `.bolt-pill-group-inner`. If absent, it creates a `.bolt-pill-group` and inserts it at the end of `.bolt-table-two-line-cell-item`.

### Observers and route changes

- unfuck-ado: one `MutationObserver` on `document.body`, `{ childList: true, subtree: true }`, debounced 100 ms. Every feature's apply step is idempotent ([observe.ts](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/core/observe.ts)).
- unfuck-ado routing: wraps `history.pushState`/`replaceState` and listens to `popstate`. It also rechecks `location` on every DOM settle, "because a sandboxed userscript context may not see the page's own history calls" ([router.ts](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/core/router.ts)).
- So use the observer plus a URL comparison.
- azdo-userscripts: `MutationObserver` on `body > div.full-size`, throttled 400 ms ([L228-L239](https://github.com/alejandro5042/azdo-userscripts/blob/6ed0a3710bca936f7ea088ed10389d321d7d61c7/src/azdo-pr-dashboard.user.js#L228-L239)). Its helper library offers `onUrl`, `onEveryNew(parent, selector, cb)` and `onAnyChangeTo(node, cb)`, built on `MutationObserver` and a `popstate`-driven `locationchange` event ([easy-userscripts.js](https://gist.github.com/alejandro5042/af2ee5b0ad92b271cd2c71615a05da2c)).

### Virtualisation

- unfuck-ado documents virtualisation for the PR Files diff and the backlog grid. It does not say the PR list is virtualised ([INTERNALS.md](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/docs/INTERNALS.md)).
- azdo-userscripts' row-reuse handling shows rows can be recycled for a different PR. Key every injected element by PR id and re-check on mutation.

### Existing scripts that show build status in the PR list

- **azdo-userscripts** does. README: "Reviews show build status" ([README](https://github.com/alejandro5042/azdo-userscripts/blob/6ed0a3710bca936f7ea088ed10389d321d7d61c7/README.md)).
  - Fetch: `GET {org}/_apis/git/pullrequests/{id}?api-version=5.0`, then `GET {pr.lastMergeCommit.url}/statuses?api-version=5.1&latestOnly=true` ([L2115-L2133](https://github.com/alejandro5042/azdo-userscripts/blob/6ed0a3710bca936f7ea088ed10389d321d7d61c7/src/azdo-pr-dashboard.user.js#L2115-L2133), [L2794-L2797](https://github.com/alejandro5042/azdo-userscripts/blob/6ed0a3710bca936f7ea088ed10389d321d7d61c7/src/azdo-pr-dashboard.user.js#L2794-L2797)).
  - Logic: all `succeeded` (or description contains "partially succeeded") gives ✔️. Any `pending` gives ▶️. Else ❌. Tooltip is the joined descriptions.
  - Render: a `.bolt-pill` with `fabric-icon ms-Icon--Build` plus the emoji.
  - Only in the "Assigned to me" and "Created by me" sections. Fetched once per row. No polling.
- **unfuck-ado** does not show build status in the list. It adds ownership labels, tab counts and diffstats there, and shows all policy checks on the PR detail page ([pr-list.ts](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr-list.ts), [pr-checks.ts](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr-checks.ts)).
- Other GitHub results were unrelated to the PR list or empty repositories (`cfe84/ado-userscripts` is empty).

### ADO's own status icon classes

- ADO's status icons are inline SVGs with class `bolt-status` plus a colour class. unfuck-ado observed `svg.bolt-status.{success,failed,active,…}` on the PR detail merge-status card, 24 px in summary rows and 16 px in check rows ([INTERNALS.md](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/docs/INTERNALS.md)).
- `azure-devops-ui` 2.281.0 `Status.css` defines `.bolt-status { fill: currentColor }` and colour classes `success`, `failed`, `warning`, `active`, `neutral`, driven by CSS variables `--component-status-success`, `--component-status-error`, `--component-status-warning`, `--component-status-info`, `--component-status-neutral`. `.bolt-status.animate` spins (8 s) and stops under `prefers-reduced-motion` ([Status.css](https://unpkg.com/azure-devops-ui@2.281.0/Components/Status/Status.css)).
- Sizes: `StatusSize` s = 12, m = 16, l = 24, xl = 32 ([Status.Props.d.ts](https://unpkg.com/azure-devops-ui@2.281.0/Components/Status/Status.Props.d.ts)).
- SVG path data for each status and size is in [Status.js](https://unpkg.com/azure-devops-ui@2.281.0/Components/Status/Status.js). Example, Success at 16 px: a `circle cx=8 cy=8 r=8` plus a white check path.
- Reuse route: inject an `<svg class="bolt-status flex-noshrink success" viewBox="0 0 16 16">` with the paths copied from `Status.js`. The page's CSS and theme variables then colour it. Whether `Status.css` is loaded on the PR list page was not verified. Ship fallback colours.
- The Fluent icon font is present: both scripts use `fabric-icon ms-Icon--{Name}` classes, for example `ms-Icon--Build` ([azdo-userscripts L2131](https://github.com/alejandro5042/azdo-userscripts/blob/6ed0a3710bca936f7ea088ed10389d321d7d61c7/src/azdo-pr-dashboard.user.js#L2131)).

---

## 6. Polling

### Polling from the page

- Requests are same-origin and use the tab's cookies, including a container tab's (section 3).
- Timers: "Firefox Desktop has a minimum timeout of 1 second for inactive tabs" ([MDN setTimeout](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout)). A 15 s or longer poll is unaffected.
- Lifetime equals the tab. State lives in memory next to the DOM it updates.
- Several ADO tabs each poll on their own. Pausing on hidden tabs limits this to one active poller.

### Recommendation

Poll from the script in the page.

1. The only consumer is a visible PR list. Nothing needs updating when no list is on screen.
2. Same-origin cookie auth works in every tab type.
3. Loop: `MutationObserver` finds rows, collects PR ids, fetches evaluations with a small concurrency cap, renders, then schedules the next pass with `setTimeout`. Pause on `visibilitychange` to hidden. Refetch on visible.

---

## 7. Developing without production data

### Free sandbox organisation

- A new organisation includes: first five users free (Basic licence), unlimited private Git repos, Boards, a limited Pipelines allowance, 2 GiB Artifacts ([create organization](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/create-organization?view=azure-devops), [pricing](https://azure.microsoft.com/en-us/pricing/details/devops/azure-devops-services/)).
- "You need an active Azure subscription to create new organizations. Existing organizations and free tier limits aren't affected." Overage is billed to that subscription ([create organization](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/create-organization?view=azure-devops)).
- Pipelines: "The self-hosted free tier is automatically granted, but you must enable the Microsoft-hosted free tier" ([parallel jobs](https://learn.microsoft.com/en-us/azure/devops/pipelines/licensing/concurrent-jobs?view=azure-devops)).
- Microsoft-hosted free tier for private projects: one job, up to 60 minutes per run, 1,800 minutes per month. To receive it, link the org to an Azure subscription by setting up billing. "Once you configure billing, the free grant automatically applies to private projects" ([parallel jobs](https://learn.microsoft.com/en-us/azure/devops/pipelines/licensing/concurrent-jobs?view=azure-devops)).
- Conflicting source: a search summary of the Microsoft-hosted agents page reported that the automatic free grant is "temporarily disabled" for new organisations and must be requested through `aka.ms/azpipelines-parallelism-request`, taking several business days ([hosted agents](https://learn.microsoft.com/en-us/azure/devops/pipelines/agents/hosted?view=azure-devops)). This text was not read directly. Check both pages when creating the org.
- Self-hosted: private projects get one free self-hosted parallel job (plus one per Visual Studio Enterprise subscriber), with no time limit listed ([parallel jobs](https://learn.microsoft.com/en-us/azure/devops/pipelines/licensing/concurrent-jobs?view=azure-devops)). One job runs at a time.

**Smallest setup that yields every state.** Derived from the docs above, not run:

1. One private project, one repo, one YAML pipeline, one self-hosted agent on the dev machine.
2. A build-validation policy on `main`, trigger Automatic, requirement Required ([branch policies](https://learn.microsoft.com/en-us/azure/devops/repos/git/branch-policies?view=azure-devops)).
3. The pipeline reads a file from the PR branch that tells it how long to sleep and which exit code to return.
4. States:
   - **queued**: stop the agent, open or update a PR. The build waits for an agent.
   - **running**: start the agent with a long sleep in the control file.
   - **succeeded**: exit 0.
   - **failed**: exit 1.
   - **cancelled**: cancel the run in the UI or API while it runs. Build result becomes `canceled` ([BuildResult](https://learn.microsoft.com/en-us/rest/api/azure/devops/build/builds/list?view=azure-devops-rest-7.1)). Which policy evaluation status a cancelled build yields is not documented. Record it from the sandbox.
   - **expired**: set build expiration to "Immediately when main is updated" and push to `main`.
   - **not run**: a second policy with trigger Manual, or a draft PR.
5. Add a second, Optional policy to exercise required vs optional.
6. One agent means only one PR build runs at a time. The others stay queued, which is useful for the list view.

### Account isolation

- PATs come in two kinds: organisation-scoped and global. Global PATs "can be used in all accessible organizations rather than a single organization". A tenant policy can restrict them ([PAT policies](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/manage-pats-with-policies-for-administrators?view=azure-devops)). The creation dialog asks to "select one organization". Global PATs are being retired ([PAT docs](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops)).
- Read-only scopes relevant here: `vso.code` Code (read), `vso.build` Build (read), `vso.project` Project and team (read). `vso.code_status` is read and write ([scope table](https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth?view=azure-devops)).
- "A PAT can't grant more permissions than its owner has" ([PAT docs](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops)).
- Browser session: all organisations live under one origin, `https://dev.azure.com`, separated by path. No primary source was found that states whether one sign-in session reaches every organisation the account belongs to. Assume it does.
- Consequence: an agent driving a browser signed in with the user's work account could reach production orgs. Use a separate Microsoft account that is a member of the sandbox org only.
- An org-scoped, read-only PAT for the sandbox is enough for scripted setup checks and fixture capture.

### Testing without any ADO org

- Serve a static HTML fixture that reproduces the row DOM from section 5 and stub `/_apis/...` responses. Requires the script's `@match` to include the fixture host in a dev build.

### Sample response bodies usable as fixtures

| Reference page                                                                                                                                                                    | Full sample response |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| [Pull Requests - Get Pull Requests](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests?view=azure-devops-rest-7.1)                       | Yes (3 samples)      |
| [Pull Requests - Get Pull Requests By Project](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests-by-project?view=azure-devops-rest-7.1) | Yes                  |
| [Pull Request Statuses - List](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-statuses/list?view=azure-devops-rest-7.1)                                 | Yes                  |
| [Statuses - List (commit)](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/statuses/list?view=azure-devops-rest-7.1)                                                  | Yes                  |
| [Policy Configurations - List](https://learn.microsoft.com/en-us/rest/api/azure/devops/policy/configurations/list?view=azure-devops-rest-7.1)                                     | Yes                  |
| [Policy Evaluations - List](https://learn.microsoft.com/en-us/rest/api/azure/devops/policy/evaluations/list?view=azure-devops-rest-7.1)                                           | **No**               |
| [Policy Evaluations - Get](https://learn.microsoft.com/en-us/rest/api/azure/devops/policy/evaluations/get?view=azure-devops-rest-7.1)                                             | **No**               |
| [Builds - List](https://learn.microsoft.com/en-us/rest/api/azure/devops/build/builds/list?view=azure-devops-rest-7.1)                                                             | **No**               |
| [Builds - Get](https://learn.microsoft.com/en-us/rest/api/azure/devops/build/builds/get?view=azure-devops-rest-7.1)                                                               | **No**               |
| [Policy Types - List](https://learn.microsoft.com/en-us/rest/api/azure/devops/policy/types/list?view=azure-devops-rest-7.1)                                                       | **No**               |

The two endpoints the design depends on most have no documented sample. Capture real responses from the sandbox org for each state and commit them as fixtures.

---

## Unverified / open questions

Azure DevOps data

1. Keys inside `PolicyEvaluationRecord.context` (`buildId`, `buildDefinitionName`, expiry flags). Undocumented. Seen only in third-party code.
2. Which evaluation status a cancelled, expired, or not-yet-queued (manual, draft) build produces.
3. `triggerInfo["pr.number"]` on PR builds. Undocumented.
4. Whether `statusFilter` on Builds list accepts several values in one call.
5. Whether Azure Pipelines posts commit statuses on the PR merge commit in all configurations. azdo-userscripts relies on it.
6. What the PR list and PR detail pages call themselves (`HierarchyQuery` data-provider ids). Undocumented and not observed.
7. Documentation status of the org-level `/{org}/_apis/git/pullrequests/{id}` call used by azdo-userscripts.
8. Policy type id of the Status policy. Read it from `_apis/policy/types`.

Auth and limits

9. A `fetch` to `/_apis/...` from the script in the page sends the session cookie and succeeds. Supported by two page-context/userscript projects, not by a test.
10. Whether one dev.azure.com sign-in session reaches every organisation of the account.
11. TSTU cost of a policy-evaluations call or a Builds list call. No published figure.
12. The two different global-PAT retirement dates on the same Microsoft page.

DOM

13. All selectors in section 5 come from third-party source dated 2026-08 to 2026-11. Not re-checked live.
14. Whether the PR list is virtualised or paged for long lists.
15. Whether `_pulls` rows match `.repos-pr-list a[href*="/pullrequest/"]` exactly. azdo-userscripts uses `.repos-pr-section-card a[role="row"]` there.
16. Whether `Status.css` (`.bolt-status` rules) is loaded on the PR list page.

Sandbox and testing

17. Whether a new org gets Microsoft-hosted minutes automatically after linking billing, or must file the parallelism request. Two Microsoft pages appear to disagree.
