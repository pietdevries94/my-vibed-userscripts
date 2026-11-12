// ==UserScript==
// @name         Fix Azure DevOps
// @namespace    https://github.com/pietdevries94/my-vibed-userscripts
// @version      1.0.0
// @description  Adds missing features to Azure DevOps. Shows the pipeline status of each pull request in the list.
// @match        https://dev.azure.com/*
// @match        https://*.visualstudio.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/pietdevries94/my-vibed-userscripts/main/dist/azure-devops.user.js
// ==/UserScript==
"use strict";
(() => {
  // azure-devops/src/pull-request-link.ts
  function apiBasePath(location2) {
    let firstPathSegment = location2.pathname.split("/")[1] ?? "";
    return location2.hostname.endsWith(".visualstudio.com") ? firstPathSegment === "DefaultCollection" ? "/DefaultCollection" : "" : `/${firstPathSegment}`;
  }
  function pathSegments(pathname) {
    return pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  }
  function projectOf(segments, gitIndex, basePath2) {
    let apiBaseSegmentCount = basePath2.split("/").filter(Boolean).length;
    return gitIndex > apiBaseSegmentCount ? segments[gitIndex - 1] : segments[gitIndex + 1];
  }
  function parsePullRequestHref(href, basePath2) {
    let segments = pathSegments(new URL(href, "https://relative.invalid").pathname), gitIndex = segments.indexOf("_git"), pullRequestIndex = segments.indexOf("pullrequest"), pullRequestId = Number(segments[pullRequestIndex + 1]), repository = segments[gitIndex + 1], project = projectOf(segments, gitIndex, basePath2);
    return !(gitIndex !== -1 && pullRequestIndex !== -1 && Number.isInteger(pullRequestId)) || repository === void 0 || project === void 0 ? null : { project, pullRequestId, repository };
  }
  function parsePullRequestListLocation(location2, basePath2) {
    let segments = pathSegments(location2.pathname), gitIndex = segments.indexOf("_git"), repository = segments[gitIndex + 1];
    if (gitIndex === -1 || repository === void 0 || segments[gitIndex + 2] !== "pullrequests" || segments.length !== gitIndex + 3)
      return null;
    let project = projectOf(segments, gitIndex, basePath2) ?? repository, tab = new URLSearchParams(location2.search).get("_a");
    return { project, repository, status: tab === "completed" || tab === "abandoned" ? tab : "active" };
  }

  // azure-devops/src/board.ts
  var CARD_SELECTOR = ".wit-card[data-itemid]";
  function isBoardLocation(location2) {
    return location2.pathname.includes("/_boards/board/");
  }
  function findBoardCardIds(root) {
    let ids = /* @__PURE__ */ new Set();
    for (let card of root.querySelectorAll(CARD_SELECTOR)) {
      let id = Number(card.dataset.itemid);
      Number.isInteger(id) && id > 0 && ids.add(id);
    }
    return [...ids];
  }
  function hasBoardChanged(loaded, current) {
    for (let [id, workItem] of current.workItems) {
      let loadedWorkItem = loaded.workItems.get(id), isChanged = loadedWorkItem !== void 0 && loadedWorkItem.rev !== workItem.rev, isMyOwnChange = current.myUserId !== null && workItem.changedById === current.myUserId;
      if (isChanged && !isMyOwnChange)
        return !0;
    }
    return !1;
  }
  function watchBoard(client2, location2, cardIds) {
    return {
      // Cards render as the user scrolls, and the user adds cards. Start comparing those too.
      extendLoaded: (loaded, current) => ({
        myUserId: current.myUserId,
        workItems: new Map([...current.workItems, ...loaded.workItems])
      }),
      async fetchSnapshot() {
        let [{ workItems, retryAfterSeconds }, myUserId] = await Promise.all([
          client2.getWorkItems(cardIds),
          client2.getAuthenticatedUserId()
        ]);
        return {
          retryAfterSeconds,
          snapshot: {
            myUserId,
            workItems: new Map(workItems.map((workItem) => [workItem.id, workItem]))
          }
        };
      },
      hasChanged: hasBoardChanged,
      key: `board:${location2.pathname}${location2.search}`
    };
  }

  // azure-devops/src/reviewers.ts
  var EMAIL_ADDRESS = /^(?<localPart>[^\s@]+)@[^\s@]+$/u;
  function personOrTeamName(displayName) {
    return displayName.replace(/^\[[^\]]*\]\\/u, "").replaceAll(/\([^)]*\)/gu, "").trim();
  }
  function wordsOf(text) {
    return text.split(/\s+/u).filter(Boolean);
  }
  function firstCharacter(word) {
    let codePoint = (word ?? "").codePointAt(0);
    return codePoint === void 0 ? "" : String.fromCodePoint(codePoint);
  }
  function initialsOf(displayName) {
    let localPart = EMAIL_ADDRESS.exec(displayName.trim())?.groups?.localPart, name = localPart === void 0 ? personOrTeamName(displayName) : localPart.replaceAll(/[._-]+/gu, " "), commaIndex = name.indexOf(","), isSurnameFirst = commaIndex !== -1, firstNames = wordsOf(isSurnameFirst ? name.slice(commaIndex + 1) : name), surnameWords = isSurnameFirst ? wordsOf(name.slice(0, commaIndex)) : firstNames.slice(1);
    return [firstNames[0], surnameWords.at(-1)].map((word) => firstCharacter(word)).join("").toUpperCase();
  }
  function hueOf(name) {
    let hash = 2166136261;
    for (let character of name.trim().toLowerCase())
      hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16777619) >>> 0;
    return hash % 360;
  }
  function namesOf(reviewer) {
    let { displayName } = reviewer;
    return displayName === void 0 || displayName === "" ? [] : [displayName, personOrTeamName(displayName)];
  }
  function findReviewerByLabel(avatarLabel, reviewers) {
    let label = avatarLabel.toLowerCase(), bestMatch = null, bestMatchLength = 0;
    for (let reviewer of reviewers)
      for (let name of namesOf(reviewer))
        name.length > bestMatchLength && label.includes(name.toLowerCase()) && (bestMatch = reviewer, bestMatchLength = name.length);
    return bestMatch;
  }

  // azure-devops/src/avatars.ts
  var AVATAR_SELECTOR = ".bolt-coin, .vss-Persona:not(.project-persona)";
  function avatarName(avatar) {
    let label = avatar.getAttribute("aria-label") ?? "", imageAlt = avatar.querySelector("img")?.getAttribute("alt") ?? "";
    return (label === "" ? imageAlt : label).trim();
  }
  function markAvatar(avatar, initials, hue) {
    initials ? avatar.dataset.fixAdoInitials = initials : delete avatar.dataset.fixAdoInitials, avatar.style.setProperty("--fix-ado-hue", hue || null), initials && avatar.offsetWidth > 0 && avatar.style.setProperty("--fix-ado-avatar-size", `${avatar.offsetWidth}px`);
  }
  function showInitialsOnAvatars(root) {
    for (let avatar of root.querySelectorAll(AVATAR_SELECTOR)) {
      let name = avatarName(avatar), initials = initialsOf(name), shownInitials = avatar.dataset.fixAdoInitials ?? "", hue = initials ? String(hueOf(name)) : "";
      shownInitials === initials && avatar.style.getPropertyValue("--fix-ado-hue") === hue || markAvatar(avatar, initials, hue);
    }
  }

  // azure-devops/src/pipeline-status-icon.ts
  var PIPELINE_STATUS_ICON_CLASS = "fix-ado-pipeline-status", SVG_NAMESPACE = "http://www.w3.org/2000/svg", LABELS = {
    expired: "Pipeline result expired",
    failed: "Pipeline failed",
    notStarted: "Pipeline not started",
    queued: "Pipeline queued",
    running: "Pipeline running",
    succeeded: "Pipeline succeeded"
  }, DISC = ["circle", { cx: "8", cy: "8", fill: "currentColor", r: "8" }], RING = [
    "circle",
    { cx: "8", cy: "8", fill: "none", r: "7", stroke: "currentColor", "stroke-width": "2" }
  ], SPINNER = [
    "circle",
    {
      cx: "8",
      cy: "8",
      fill: "none",
      r: "6.5",
      stroke: "currentColor",
      "stroke-dasharray": "28 13",
      "stroke-linecap": "round",
      "stroke-width": "2.5"
    }
  ];
  function line(pathData, stroke) {
    return ["path", { d: pathData, ...{
      fill: "none",
      stroke,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "stroke-width": "1.75"
    } }];
  }
  var SHAPES = {
    expired: [DISC, line("M8 4v5M8 11.9v.1", "#fff")],
    failed: [DISC, line("M5.5 5.5l5 5M10.5 5.5l-5 5", "#fff")],
    notStarted: [RING],
    queued: [RING, line("M8 4.5V8l2.5 1.5", "currentColor")],
    running: [SPINNER],
    succeeded: [DISC, line("M4.5 8.3l2.3 2.3 4.7-5", "#fff")]
  };
  function setAttributes(element, attributes) {
    for (let [name, value] of Object.entries(attributes))
      element.setAttribute(name, value);
  }
  function createShape(document2, [tag, attributes]) {
    let shape = document2.createElementNS(SVG_NAMESPACE, tag);
    return setAttributes(shape, attributes), shape;
  }
  function createPipelineStatusIcon(document2, status, pullRequestId) {
    let icon = document2.createElementNS(SVG_NAMESPACE, "svg");
    setAttributes(icon, {
      "aria-label": LABELS[status],
      class: PIPELINE_STATUS_ICON_CLASS,
      height: "16",
      role: "img",
      viewBox: "0 0 16 16",
      width: "16"
    }), icon.dataset.status = status, icon.dataset.pullRequestId = String(pullRequestId);
    let title = document2.createElementNS(SVG_NAMESPACE, "title");
    return title.textContent = LABELS[status], icon.append(title, ...SHAPES[status].map((shape) => createShape(document2, shape))), icon;
  }

  // azure-devops/src/pr-list.ts
  var PULL_REQUEST_ROW_SELECTOR = 'a.bolt-table-row[href*="/pullrequest/"]', TITLE_LINE_SELECTOR = ".bolt-table-two-line-cell-item";
  function findPullRequestRows(root, apiBasePath2) {
    let rows = [];
    for (let row of root.querySelectorAll(PULL_REQUEST_ROW_SELECTOR)) {
      let pullRequest = parsePullRequestHref(row.getAttribute("href") ?? "", apiBasePath2);
      pullRequest && rows.push({ pullRequest, row });
    }
    return rows;
  }
  function showPipelineStatus(row, pullRequestId, status) {
    let shownIcon = row.querySelector(`.${PIPELINE_STATUS_ICON_CLASS}`);
    if ((shownIcon ? shownIcon.dataset.status === status && shownIcon.dataset.pullRequestId === String(pullRequestId) : status === null) || (shownIcon?.remove(), status === null))
      return;
    row.querySelector(TITLE_LINE_SELECTOR)?.firstElementChild?.after(createPipelineStatusIcon(row.ownerDocument, status, pullRequestId));
  }
  var REVIEWER_SELECTOR = ".pr-reviewer";
  function markRequiredReviewers(row, reviewers) {
    for (let reviewerElement of row.querySelectorAll(REVIEWER_SELECTOR)) {
      let avatar = reviewerElement.querySelector(AVATAR_SELECTOR), reviewer = avatar ? findReviewerByLabel(avatarName(avatar), reviewers) : null;
      reviewerElement.toggleAttribute("data-fix-ado-required", reviewer?.isRequired ?? !1), reviewerElement.parentElement?.toggleAttribute("data-fix-ado-reviewers", !0);
    }
  }

  // azure-devops/src/ado-client.ts
  var AdoRequestError = class extends Error {
    httpStatus;
    retryAfterSeconds;
    constructor(httpStatus, retryAfterSeconds) {
      super(`Azure DevOps request failed with HTTP ${httpStatus}`), this.name = "AdoRequestError", this.httpStatus = httpStatus, this.retryAfterSeconds = retryAfterSeconds;
    }
  };
  function retryAfterSecondsOf(response) {
    let retryAfter = Number(response.headers.get("Retry-After"));
    return response.headers.has("Retry-After") && Number.isFinite(retryAfter) ? retryAfter : null;
  }
  async function getJson(options, path) {
    let response = await options.fetch(options.origin + options.apiBasePath + path, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      method: "GET"
    }), retryAfterSeconds = retryAfterSecondsOf(response);
    if (!response.ok)
      throw new AdoRequestError(response.status, retryAfterSeconds);
    return { body: await response.json(), retryAfterSeconds };
  }
  function createProjectIdCache(options) {
    let projectIdRequests = /* @__PURE__ */ new Map();
    return async (project) => {
      let request = projectIdRequests.get(project);
      return request || (request = getJson(
        options,
        `/_apis/projects/${encodeURIComponent(project)}?api-version=7.1`
      ).then(({ body }) => String(body.id)), request.catch(() => projectIdRequests.delete(project)), projectIdRequests.set(project, request)), request;
    };
  }
  function toBoardWorkItems(values) {
    return values.flatMap(
      (workItem) => workItem === null ? [] : [
        {
          changedById: workItem.fields?.["System.ChangedBy"]?.id ?? null,
          id: workItem.id,
          rev: workItem.rev
        }
      ]
    );
  }
  async function getWorkItems(options, ids) {
    let workItems = [], retryAfterSeconds = null;
    for (let start = 0; start < ids.length; start += 200) {
      let idsInRequest = ids.slice(start, start + 200), response = await getJson(
        options,
        `/_apis/wit/workitems?ids=${idsInRequest.join(",")}&fields=System.Rev,System.ChangedBy&errorPolicy=Omit&api-version=7.1`
      );
      retryAfterSeconds = response.retryAfterSeconds ?? retryAfterSeconds, workItems.push(...toBoardWorkItems(response.body.value));
    }
    return { retryAfterSeconds, workItems };
  }
  function createAdoClient(options) {
    let getProjectId = createProjectIdCache(options), authenticatedUserIdRequest = null;
    return {
      async getAuthenticatedUserId() {
        return authenticatedUserIdRequest ??= getJson(options, "/_apis/connectionData").then(({ body }) => body.authenticatedUser?.id ?? null).catch(() => null), authenticatedUserIdRequest;
      },
      async getPolicyEvaluations(pullRequest) {
        let projectId = await getProjectId(pullRequest.project), artifactId = `vstfs:///CodeReview/CodeReviewId/${projectId}/${pullRequest.pullRequestId}`, { body, retryAfterSeconds } = await getJson(
          options,
          `/${projectId}/_apis/policy/evaluations?artifactId=${encodeURIComponent(artifactId)}&api-version=7.1-preview.1`
        );
        return { evaluations: body.value, retryAfterSeconds };
      },
      async getPullRequests({ project, repository, status }) {
        let { body, retryAfterSeconds } = await getJson(
          options,
          `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullrequests?searchCriteria.status=${status}&$top=200&api-version=7.1`
        );
        return { pullRequests: body.value, retryAfterSeconds };
      },
      async getWorkItems(ids) {
        return getWorkItems(options, ids);
      }
    };
  }

  // azure-devops/src/page-reloader.ts
  var PAGE_CHECK_INTERVAL_MS = 3e4, FAILED_PAGE_CHECK_RETRY_MS = 6e4, MS_PER_SECOND = 1e3;
  function isCheckDue(state, page, immediately) {
    return state.loadedSnapshots.has(page.key) ? !state.options.isTabActive() || state.options.now() < state.pausedUntil ? !1 : immediately || state.options.now() >= state.nextCheckAt : !0;
  }
  function pauseFor(state, retryAfterSeconds) {
    retryAfterSeconds !== null && (state.pausedUntil = state.options.now() + retryAfterSeconds * MS_PER_SECOND);
  }
  function compareWithLoaded(state, { page, hasLoadedSnapshot }, snapshot) {
    hasLoadedSnapshot ? page.hasChanged(state.loadedSnapshots.get(page.key), snapshot) ? state.options.reload() : page.extendLoaded && state.loadedSnapshots.set(
      page.key,
      page.extendLoaded(state.loadedSnapshots.get(page.key), snapshot)
    ) : state.loadedSnapshots.set(page.key, snapshot);
  }
  function recordFailure(state, error) {
    error instanceof AdoRequestError && pauseFor(state, error.retryAfterSeconds), state.nextCheckAt = state.options.now() + FAILED_PAGE_CHECK_RETRY_MS;
  }
  async function runCheck(state, page) {
    let checkedPage = { hasLoadedSnapshot: state.loadedSnapshots.has(page.key), page };
    state.isChecking = !0;
    try {
      let { snapshot, retryAfterSeconds } = await page.fetchSnapshot();
      pauseFor(state, retryAfterSeconds), state.nextCheckAt = state.options.now() + PAGE_CHECK_INTERVAL_MS, compareWithLoaded(state, checkedPage, snapshot);
    } catch (error) {
      recordFailure(state, error);
    } finally {
      state.isChecking = !1;
    }
  }
  function createPageReloader(options) {
    let state = {
      isChecking: !1,
      loadedSnapshots: /* @__PURE__ */ new Map(),
      nextCheckAt: 0,
      options,
      pausedUntil: 0
    };
    return {
      async check({ immediately = !1 } = {}) {
        let page = options.currentPage();
        !page || state.isChecking || !isCheckDue(state, page, immediately) || await runCheck(state, page);
      }
    };
  }

  // azure-devops/src/pipeline-status.ts
  var BUILD_POLICY_TYPE_ID = "0609b952-1397-4640-95ec-e00a01b2c241";
  function hasStatus(evaluations, status) {
    return evaluations.some((evaluation) => evaluation.status === status);
  }
  var STATUS_RULES = [
    [
      "failed",
      (evaluations) => hasStatus(evaluations, "rejected") || hasStatus(evaluations, "broken")
    ],
    ["running", (evaluations) => hasStatus(evaluations, "running")],
    [
      "expired",
      (evaluations) => evaluations.some((evaluation) => !!evaluation.context?.isExpired)
    ],
    [
      "queued",
      (evaluations) => evaluations.some(
        (evaluation) => evaluation.status === "queued" && (evaluation.context?.buildId ?? null) !== null
      )
    ],
    ["notStarted", (evaluations) => hasStatus(evaluations, "queued")],
    ["succeeded", (evaluations) => hasStatus(evaluations, "approved")]
  ];
  function pipelineStatusOf(evaluations) {
    let buildEvaluations = evaluations.filter(
      (evaluation) => evaluation.configuration.type.id === BUILD_POLICY_TYPE_ID
    ), requiredBuildEvaluations = buildEvaluations.filter(
      (evaluation) => evaluation.configuration.isBlocking
    ), decisiveEvaluations = requiredBuildEvaluations.length > 0 ? requiredBuildEvaluations : buildEvaluations;
    return STATUS_RULES.find(([, matches]) => matches(decisiveEvaluations))?.[0] ?? null;
  }
  function isInProgress(status) {
    return status === "running" || status === "queued";
  }

  // azure-devops/src/pipeline-status-poller.ts
  var IN_PROGRESS_POLL_INTERVAL_MS = 2e4, SETTLED_POLL_INTERVAL_MS = 18e4, FAILED_REQUEST_RETRY_MS = 6e4, MS_PER_SECOND2 = 1e3;
  function showFetchedStatuses(state) {
    for (let { row, pullRequest } of state.options.findRows()) {
      let polled = state.polledPullRequests.get(pullRequest.pullRequestId);
      polled?.hasBeenFetched === !0 && state.options.showStatus(row, pullRequest.pullRequestId, polled.status);
    }
  }
  function duePullRequests(state) {
    let due = /* @__PURE__ */ new Map();
    for (let { pullRequest } of state.options.findRows()) {
      let polled = state.polledPullRequests.get(pullRequest.pullRequestId);
      (!polled || polled.nextPollAt <= state.options.now()) && due.set(pullRequest.pullRequestId, pullRequest);
    }
    return [...due.values()];
  }
  function recordStatus(state, polled, evaluations) {
    polled.status = pipelineStatusOf(evaluations), polled.hasBeenFetched = !0;
    let interval = isInProgress(polled.status) ? IN_PROGRESS_POLL_INTERVAL_MS : SETTLED_POLL_INTERVAL_MS;
    polled.nextPollAt = state.options.now() + interval;
  }
  async function fetchAndRecordStatus(state, pullRequest, polled) {
    let retryAfterSeconds = null;
    try {
      let response = await state.options.client.getPolicyEvaluations(pullRequest);
      ({ retryAfterSeconds } = response), recordStatus(state, polled, response.evaluations);
    } catch (error) {
      error instanceof AdoRequestError && ({ retryAfterSeconds } = error), polled.nextPollAt = state.options.now() + FAILED_REQUEST_RETRY_MS;
    }
    return retryAfterSeconds;
  }
  async function fetchStatus(state, pullRequest) {
    let polled = state.polledPullRequests.get(pullRequest.pullRequestId) ?? {
      hasBeenFetched: !1,
      nextPollAt: 0,
      status: null
    };
    state.polledPullRequests.set(pullRequest.pullRequestId, polled);
    let retryAfterSeconds = await fetchAndRecordStatus(state, pullRequest, polled);
    retryAfterSeconds !== null && (state.pausedUntil = state.options.now() + retryAfterSeconds * MS_PER_SECOND2);
  }
  async function fetchDueStatuses(state) {
    for (let pullRequest of duePullRequests(state)) {
      if (state.options.now() < state.pausedUntil)
        break;
      await fetchStatus(state, pullRequest), showFetchedStatuses(state);
    }
  }
  function createPipelineStatusPoller(options) {
    let state = {
      isFetching: !1,
      options,
      pausedUntil: 0,
      polledPullRequests: /* @__PURE__ */ new Map()
    };
    return {
      async sync() {
        if (showFetchedStatuses(state), !state.isFetching) {
          state.isFetching = !0;
          try {
            await fetchDueStatuses(state);
          } finally {
            state.isFetching = !1;
          }
        }
      }
    };
  }

  // azure-devops/src/style.css
  var style_default = `.fix-ado-pipeline-status {
  flex-shrink: 0;
  align-self: center;
  margin-left: 8px;
}

.fix-ado-pipeline-status[data-status="succeeded"] {
  color: var(--component-status-success, rgb(85, 163, 98));
}
.fix-ado-pipeline-status[data-status="failed"] {
  color: var(--component-status-error, rgb(205, 74, 69));
}
.fix-ado-pipeline-status[data-status="expired"] {
  color: var(--component-status-warning, rgb(214, 119, 48));
}
.fix-ado-pipeline-status[data-status="running"] {
  color: var(--component-status-info, rgb(0, 120, 212));
}
.fix-ado-pipeline-status[data-status="queued"],
.fix-ado-pipeline-status[data-status="notStarted"] {
  color: var(--component-status-neutral, rgb(102, 102, 102));
}

.fix-ado-pipeline-status[data-status="running"] {
  animation: fix-ado-spin 1.5s linear infinite;
}

@keyframes fix-ado-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fix-ado-pipeline-status[data-status="running"] {
    animation: none;
  }
}

/* Avatars as initials. avatars.ts sets the data attribute, the hue and the size. */
[data-fix-ado-initials] {
  position: relative;
  border-radius: 50%;
  background: hsl(var(--fix-ado-hue, 210) 45% 38%);
}

[data-fix-ado-initials] > .bolt-coin-content,
[data-fix-ado-initials] > .vss-Persona-content {
  visibility: hidden;
}

[data-fix-ado-initials]::after {
  content: attr(data-fix-ado-initials);
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: calc(var(--fix-ado-avatar-size, 24px) * 0.42);
  line-height: 1;
  font-weight: 600;
  letter-spacing: 0.02em;
}

/* Required reviewers in the pull request list. pr-list.ts sets the data attributes. */

/* A glow that spills outside the circle, so the circle keeps its full size. */
.pr-reviewer[data-fix-ado-required] .bolt-coin {
  border-radius: 50%;
  box-shadow:
    0 0 0 2px var(--communication-background, rgb(0, 120, 212)),
    0 0 6px 3px var(--communication-background, rgb(0, 120, 212));
}

/* Required reviewers first. Even spacing whatever the visual order. */
[data-fix-ado-reviewers] > .pr-reviewer {
  margin: 0 8px 0 0 !important;
}

[data-fix-ado-reviewers] > .pr-reviewer[data-fix-ado-required] {
  order: -1;
}
`;

  // azure-devops/src/pr-list-changes.ts
  function snapshotOf(pullRequests) {
    return new Map(
      pullRequests.map((pullRequest) => [
        pullRequest.pullRequestId,
        JSON.stringify([
          pullRequest.title,
          pullRequest.isDraft,
          pullRequest.status,
          pullRequest.targetRefName,
          pullRequest.lastMergeSourceCommit?.commitId,
          pullRequest.autoCompleteSetBy?.id,
          (pullRequest.reviewers ?? []).map((reviewer) => `${reviewer.id}:${reviewer.vote}:${reviewer.isRequired ?? !1}`).toSorted()
        ])
      ])
    );
  }
  function hasListChanged(before, after, onScreenPullRequestIds) {
    if (before.size !== after.size)
      return !0;
    for (let pullRequestId of before.keys())
      if (!after.has(pullRequestId))
        return !0;
    for (let pullRequestId of onScreenPullRequestIds)
      if (before.has(pullRequestId) && before.get(pullRequestId) !== after.get(pullRequestId))
        return !0;
    return !1;
  }

  // azure-devops/src/pr-list-watch.ts
  function watchPullRequestList(client2, listPage, onScreenPullRequestIds) {
    return {
      async fetchSnapshot() {
        let { pullRequests, retryAfterSeconds } = await client2.getPullRequests(listPage);
        return { retryAfterSeconds, snapshot: snapshotOf(pullRequests) };
      },
      hasChanged: (loaded, current) => hasListChanged(loaded, current, onScreenPullRequestIds()),
      key: `pull-request-list:${JSON.stringify(listPage)}`
    };
  }

  // azure-devops/src/main.ts
  GM_addStyle(style_default);
  var DOM_SETTLE_MS = 200, TIMER_INTERVAL_MS = 5e3, MIN_TIME_BETWEEN_RELOADS_MS = 15e3, LAST_RELOAD_STORAGE_KEY = "fix-ado-last-page-reload", basePath = apiBasePath(location), client = createAdoClient({
    apiBasePath: basePath,
    fetch: async (url, init) => fetch(url, init),
    origin: location.origin
  }), isTabActive = () => document.visibilityState === "visible", poller = createPipelineStatusPoller({
    client,
    findRows: () => findPullRequestRows(document, basePath),
    now: () => Date.now(),
    showStatus: showPipelineStatus
  }), reviewersByPullRequestId = /* @__PURE__ */ new Map();
  function markRequiredReviewersOnAllRows() {
    for (let { row, pullRequest } of findPullRequestRows(document, basePath)) {
      let reviewers = reviewersByPullRequestId.get(pullRequest.pullRequestId);
      reviewers && markRequiredReviewers(row, reviewers);
    }
  }
  var pullRequestListClient = {
    // The list check already fetches the reviewers. Keep them to mark the required ones.
    async getPullRequests(listPage) {
      let response = await client.getPullRequests(listPage);
      for (let pullRequest of response.pullRequests)
        reviewersByPullRequestId.set(pullRequest.pullRequestId, pullRequest.reviewers ?? []);
      return markRequiredReviewersOnAllRows(), response;
    }
  };
  function currentWatchedPage() {
    let listPage = parsePullRequestListLocation(location, basePath);
    if (listPage)
      return watchPullRequestList(
        pullRequestListClient,
        listPage,
        () => findPullRequestRows(document, basePath).map(({ pullRequest }) => pullRequest.pullRequestId)
      );
    if (isBoardLocation(location)) {
      let cardIds = findBoardCardIds(document);
      return cardIds.length > 0 ? watchBoard(client, location, cardIds) : null;
    }
    return null;
  }
  var reloader = createPageReloader({
    currentPage: currentWatchedPage,
    isTabActive,
    now: () => Date.now(),
    reload: reloadPage
  });
  function isUserBusy() {
    let isTyping = document.activeElement?.matches("input, textarea, [contenteditable]") ?? !1, hasOpenDialog = document.querySelector('[role="dialog"]') !== null;
    return isTyping || hasOpenDialog;
  }
  function claimReload() {
    try {
      let lastReloadAt = Number(sessionStorage.getItem(LAST_RELOAD_STORAGE_KEY));
      return Date.now() - lastReloadAt < MIN_TIME_BETWEEN_RELOADS_MS ? !1 : (sessionStorage.setItem(LAST_RELOAD_STORAGE_KEY, String(Date.now())), !0);
    } catch {
      return !1;
    }
  }
  function reloadPage() {
    !isUserBusy() && claimReload() && location.reload();
  }
  function sync() {
    showInitialsOnAvatars(document), markRequiredReviewersOnAllRows(), isTabActive() && poller.sync(), reloader.check();
  }
  var settleTimer = null;
  new MutationObserver(() => {
    settleTimer !== null && clearTimeout(settleTimer), settleTimer = setTimeout(sync, DOM_SETTLE_MS);
  }).observe(document.body, { childList: !0, subtree: !0 });
  setInterval(sync, TIMER_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    isTabActive() && (poller.sync(), reloader.check({ immediately: !0 }));
  });
  sync();
})();
