// ==UserScript==
// @name         Fix Azure DevOps
// @namespace    https://github.com/pietdevries94/my-vibed-userscripts
// @version      1.7.0
// @description  Adds missing features to Azure DevOps: pipeline status on pull requests, a Pipeline tab on each pull request with its runs, stages, steps, warnings, errors and logs and a button to start or cancel a run, the warnings and errors of each check's latest run above the pull request description, required reviewers first, starred reviewers to add as optional or required reviewer in one click, avatar initials (a menu setting, on by default), Light or Dark to match the system (a menu setting, on by default), days in column dots on board cards with a toggle per column, and pull request lists and boards that reload on changes.
// @match        https://dev.azure.com/*
// @match        https://*.visualstudio.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
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
  function isPullRequestInboxLocation(location2) {
    return pathSegments(location2.pathname).at(-1) === "_pulls";
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
  function hideInitialsOnAvatars(root) {
    for (let avatar of root.querySelectorAll("[data-fix-ado-initials]"))
      delete avatar.dataset.fixAdoInitials, avatar.style.removeProperty("--fix-ado-hue"), avatar.style.removeProperty("--fix-ado-avatar-size");
  }

  // azure-devops/src/pipeline-status-icon.ts
  var PIPELINE_STATUS_ICON_CLASS = "fix-ado-pipeline-status", SVG_NAMESPACE = "http://www.w3.org/2000/svg", LABELS = {
    cancelling: "Pipeline cancelling",
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
    cancelling: [RING, line("M5 11l6-6", "currentColor")],
    expired: [DISC, line("M8 4v5M8 11.9v.1", "#fff")],
    failed: [DISC, line("M5.5 5.5l5 5M10.5 5.5l-5 5", "#fff")],
    notStarted: [RING],
    queued: [RING, line("M8 4.5V8l2.5 1.5", "currentColor")],
    running: [SPINNER],
    succeeded: [DISC, line("M4.5 8.3l2.3 2.3 4.7-5", "#fff")]
  };
  function setAttributes(element2, attributes) {
    for (let [name, value] of Object.entries(attributes))
      element2.setAttribute(name, value);
  }
  function createShape(document2, [tag, attributes]) {
    let shape = document2.createElementNS(SVG_NAMESPACE, tag);
    return setAttributes(shape, attributes), shape;
  }
  function createStatusIcon(document2, status, label = LABELS[status]) {
    let icon = document2.createElementNS(SVG_NAMESPACE, "svg");
    setAttributes(icon, {
      "aria-label": label,
      class: PIPELINE_STATUS_ICON_CLASS,
      height: "16",
      role: "img",
      viewBox: "0 0 16 16",
      width: "16"
    }), icon.dataset.status = status;
    let title = document2.createElementNS(SVG_NAMESPACE, "title");
    return title.textContent = label, icon.append(title, ...SHAPES[status].map((shape) => createShape(document2, shape))), icon;
  }
  function createPipelineStatusIcon(document2, status, pullRequestId) {
    let icon = createStatusIcon(document2, status);
    return icon.dataset.pullRequestId = String(pullRequestId), icon;
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

  // azure-devops/src/ado-request.ts
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
  async function sendRequest(options, path, write) {
    let accept = { Accept: "application/json" }, response = await options.fetch(options.origin + options.apiBasePath + path, {
      credentials: "same-origin",
      ...write === void 0 ? { headers: accept, method: "GET" } : {
        body: JSON.stringify(write.body),
        headers: { ...accept, "Content-Type": "application/json" },
        method: write.method
      }
    });
    if (!response.ok)
      throw new AdoRequestError(response.status, retryAfterSecondsOf(response));
    return response;
  }
  async function getJson(options, path) {
    let response = await sendRequest(options, path), retryAfterSeconds = retryAfterSecondsOf(response);
    return { body: await response.json() ?? {}, retryAfterSeconds };
  }

  // shared/runtime/script-log.ts
  var entries = [];
  function log(message2, data) {
    entries.push(data === void 0 ? { message: message2 } : { data, message: message2 }), entries.length > 500 && entries.shift();
  }

  // azure-devops/src/reviewer-requests.ts
  var SEARCH_OPTIONS = { MaxResults: 40, MinResults: 5 }, SEARCH_PROPERTIES = [
    "DisplayName",
    "IsMru",
    "ScopeName",
    "SamAccountName",
    "Active",
    "SubjectDescriptor",
    "Mail",
    "MailNickname",
    "SignInAddress",
    "Guest"
  ];
  function reviewersPath({ project, repository, pullRequestId }) {
    return `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullRequests/${pullRequestId}/reviewers`;
  }
  async function getPullRequestReviewers(options, pullRequest) {
    return ((await (await sendRequest(options, `${reviewersPath(pullRequest)}?api-version=7.1`)).json()).value ?? []).flatMap(
      ({ id, displayName, uniqueName, isContainer }) => id === void 0 ? [] : [
        {
          displayName: displayName ?? "",
          id,
          isGroup: isContainer === !0,
          signInAddress: isContainer === !0 ? "" : uniqueName ?? ""
        }
      ]
    );
  }
  async function addPullRequestReviewer(options, pullRequest, { reviewerId, isRequired }) {
    await sendRequest(
      options,
      `${reviewersPath(pullRequest)}/${encodeURIComponent(reviewerId)}?api-version=7.1`,
      { body: { isRequired, vote: 0 }, method: "PUT" }
    );
  }
  function identityOf(body) {
    let { localId, displayName, signInAddress, mail, entityType } = body;
    if (localId == null || localId === "")
      return [];
    let isGroup = entityType?.toLowerCase() === "group";
    return [
      {
        displayName: displayName ?? "",
        id: localId,
        isGroup,
        signInAddress: isGroup ? "" : signInAddress ?? mail ?? ""
      }
    ];
  }
  async function searchIdentities(options, query) {
    let found = ((await (await sendRequest(
      options,
      "/_apis/IdentityPicker/Identities?api-version=5.0-preview.1",
      {
        body: {
          identityTypes: ["user", "group"],
          operationScopes: ["ims", "source"],
          options: SEARCH_OPTIONS,
          properties: SEARCH_PROPERTIES,
          query
        },
        method: "POST"
      }
    )).json()).results ?? []).flatMap(({ identities }) => identities ?? []);
    return logFound(found), found.flatMap((identity) => identityOf(identity));
  }
  function logFound(found) {
    log("Starred reviewers: search answered", {
      found: found.map((identity) => ({
        entityType: identity.entityType,
        // Field names only: each one maps to true, so the capture keeps them and no value.
        fields: Object.fromEntries(Object.keys(identity).map((key) => [key, !0])),
        hasLocalId: identityOf(identity).length > 0,
        originDirectory: identity.originDirectory
      })),
      foundCount: found.length
    });
  }
  function createReviewerRequests(options) {
    return {
      addPullRequestReviewer: async (pullRequest, reviewer) => addPullRequestReviewer(options, pullRequest, reviewer),
      getPullRequestReviewers: async (pullRequest) => getPullRequestReviewers(options, pullRequest),
      searchIdentities: async (query) => searchIdentities(options, query)
    };
  }

  // azure-devops/src/ado-client.ts
  var MAX_WORK_ITEMS_PER_REQUEST = 200, MAX_UPDATES_PER_REQUEST = 200, MAX_PULL_REQUEST_BUILDS = 50, MAX_LISTED_PULL_REQUESTS = 200, THEME_SETTING_KEY = "WebPlatform/Theme";
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
    for (let start = 0; start < ids.length; start += MAX_WORK_ITEMS_PER_REQUEST) {
      let idsInRequest = ids.slice(start, start + MAX_WORK_ITEMS_PER_REQUEST), response = await getJson(
        options,
        `/_apis/wit/workitems?ids=${idsInRequest.join(",")}&fields=System.Rev,System.ChangedBy&errorPolicy=Omit&api-version=7.1`
      );
      retryAfterSeconds = response.retryAfterSeconds ?? retryAfterSeconds, workItems.push(...toBoardWorkItems(response.body.value));
    }
    return { retryAfterSeconds, workItems };
  }
  async function getWorkItemUpdates(options, id) {
    let updates = [], retryAfterSeconds = null;
    for (let skip = 0; ; skip += MAX_UPDATES_PER_REQUEST) {
      let response = await getJson(
        options,
        `/_apis/wit/workItems/${id}/updates?$top=${MAX_UPDATES_PER_REQUEST}&$skip=${skip}&api-version=7.1`
      );
      retryAfterSeconds = response.retryAfterSeconds ?? retryAfterSeconds;
      let page = response.body.value ?? [];
      if (updates.push(...page), page.length < MAX_UPDATES_PER_REQUEST)
        return { retryAfterSeconds, updates };
    }
  }
  async function getPolicyEvaluations(options, projectId, { pullRequestId }) {
    let artifactId = `vstfs:///CodeReview/CodeReviewId/${projectId}/${pullRequestId}`, { body, retryAfterSeconds } = await getJson(
      options,
      `/${projectId}/_apis/policy/evaluations?artifactId=${encodeURIComponent(artifactId)}&api-version=7.1-preview.1`
    );
    return { evaluations: body.value, retryAfterSeconds };
  }
  async function cancelBuild(options, project, buildId) {
    await sendRequest(
      options,
      `/${encodeURIComponent(project)}/_apis/build/builds/${buildId}?api-version=7.1`,
      { body: { status: "cancelling" }, method: "PATCH" }
    );
  }
  async function saveTheme(options, themeId) {
    await sendRequest(options, "/_apis/Settings/Entries/globalme?api-version=7.1-preview.1", {
      body: { [THEME_SETTING_KEY]: themeId },
      method: "PATCH"
    });
  }
  async function requeuePolicyEvaluation(options, projectId, evaluationId) {
    await sendRequest(
      options,
      `/${projectId}/_apis/policy/evaluations/${encodeURIComponent(evaluationId)}?api-version=7.1-preview.1`,
      { body: { status: "queued" }, method: "PATCH" }
    );
  }
  async function getPullRequestBuilds(options, { project, pullRequestId }) {
    let branchName = encodeURIComponent(`refs/pull/${pullRequestId}/merge`), { body, retryAfterSeconds } = await getJson(
      options,
      `/${encodeURIComponent(project)}/_apis/build/builds?branchName=${branchName}&queryOrder=queueTimeDescending&$top=${MAX_PULL_REQUEST_BUILDS}&api-version=7.1`
    );
    return { builds: body.value ?? [], retryAfterSeconds };
  }
  function createAdoClient(options) {
    let getProjectId = createProjectIdCache(options), authenticatedUserIdRequest = null;
    return {
      cancelBuild: async (project, buildId) => cancelBuild(options, project, buildId),
      async getAuthenticatedUserId() {
        return authenticatedUserIdRequest ??= getJson(options, "/_apis/connectionData").then(({ body }) => body.authenticatedUser?.id ?? null).catch(() => null), authenticatedUserIdRequest;
      },
      getPolicyEvaluations: async (pullRequest) => getPolicyEvaluations(options, await getProjectId(pullRequest.project), pullRequest),
      getPullRequestBuilds: async (project, pullRequestId) => getPullRequestBuilds(options, { project, pullRequestId }),
      async getPullRequests({ project, repository, status }) {
        let { body, retryAfterSeconds } = await getJson(
          options,
          `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullrequests?searchCriteria.status=${status}&$top=${MAX_LISTED_PULL_REQUESTS}&api-version=7.1`
        );
        return { pullRequests: body.value, retryAfterSeconds };
      },
      async getTimeline(project, buildId) {
        let { body, retryAfterSeconds } = await getJson(
          options,
          `/${encodeURIComponent(project)}/_apis/build/builds/${buildId}/timeline?api-version=7.1`
        );
        return { records: body.records ?? [], retryAfterSeconds };
      },
      getWorkItemUpdates: async (id) => getWorkItemUpdates(options, id),
      getWorkItems: async (ids) => getWorkItems(options, ids),
      requeuePolicyEvaluation: async (project, evaluationId) => requeuePolicyEvaluation(options, await getProjectId(project), evaluationId),
      saveTheme: async (themeId) => saveTheme(options, themeId),
      ...createReviewerRequests(options)
    };
  }

  // azure-devops/src/days-in-column.ts
  var CARD_SELECTOR2 = ".wit-card[data-itemid]", COLUMN_SELECTOR = ".kanban-board-column[data-column]", BAR_CLASS = "fix-ado-days-in-column";
  function columnEnteredAt(updates) {
    for (let update2 of updates.toReversed()) {
      let columnChange = update2.fields?.["System.BoardColumn"];
      if (columnChange !== void 0 && columnChange.newValue !== columnChange.oldValue) {
        let changedDate = update2.fields?.["System.ChangedDate"]?.newValue;
        return typeof changedDate == "string" ? changedDate : null;
      }
    }
    return null;
  }
  function daysSince(enteredAt, now) {
    return Math.max(0, Math.floor((now - Date.parse(enteredAt)) / 864e5));
  }
  function dotAge(day) {
    return day <= 7 ? "fresh" : day <= 14 ? "aging" : "old";
  }
  var LOADING_DOT_COUNT = 3;
  function dotsFor(document2, days) {
    return (days === null ? Array.from({ length: LOADING_DOT_COUNT }, () => "loading") : Array.from({ length: Math.min(days, 30) }, (_entry, index) => dotAge(index + 1))).map((age) => {
      let dot = document2.createElement("span");
      return dot.dataset.age = age, dot;
    });
  }
  function captionFor(days) {
    return days === null ? "" : days === 0 ? "Less than a day in this column" : `${days} ${days === 1 ? "day" : "days"} in this column`;
  }
  function createDotBar(document2, days) {
    let bar = document2.createElement("div");
    return bar.className = BAR_CLASS, bar.dataset.days = String(days), bar.title = captionFor(days), days === null ? bar.setAttribute("aria-hidden", "true") : (bar.setAttribute("aria-label", bar.title), bar.setAttribute("role", "img")), bar.append(...dotsFor(document2, days)), bar;
  }
  function showDaysInColumn(card, days) {
    let existing = card.querySelector(`.${BAR_CLASS}`);
    existing?.dataset.days !== String(days) && (existing?.remove(), (card.querySelector(".card-content") ?? card).append(createDotBar(card.ownerDocument, days)));
  }
  function findCards(document2) {
    let cards = /* @__PURE__ */ new Map();
    for (let card of document2.querySelectorAll(CARD_SELECTOR2)) {
      let id = Number(card.dataset.itemid);
      Number.isInteger(id) && id > 0 && cards.set(id, [...cards.get(id) ?? [], card]);
    }
    return cards;
  }
  function columnIdOf(card) {
    return card.closest(COLUMN_SELECTOR)?.dataset.column ?? null;
  }
  function noteMoves(tracker, cards) {
    for (let [id, [element2]] of cards) {
      let columnId = columnIdOf(element2), lastColumnId = tracker.columnIds.get(id), entry = tracker.entries.get(id);
      lastColumnId !== void 0 && lastColumnId !== columnId && entry !== void 0 && (entry.enteredAt = new Date(tracker.now()).toISOString()), tracker.columnIds.set(id, columnId);
    }
  }
  function showBars(tracker, cards) {
    noteMoves(tracker, cards);
    for (let [id, elements] of cards) {
      let entry = tracker.entries.get(id), enteredAt = entry?.enteredAt ?? null, days = null;
      entry !== void 0 && (days = enteredAt === null ? 0 : daysSince(enteredAt, tracker.now()));
      for (let element2 of elements)
        showDaysInColumn(element2, days);
    }
  }
  function pauseIfAsked(tracker, retryAfterSeconds) {
    return retryAfterSeconds === null ? !1 : (tracker.pausedUntil = tracker.now() + retryAfterSeconds * 1e3, !0);
  }
  async function fetchChangedCards(tracker, ids) {
    let { workItems, retryAfterSeconds } = await tracker.client.getWorkItems(ids);
    if (pauseIfAsked(tracker, retryAfterSeconds))
      return;
    let changed = workItems.filter(({ id, rev }) => tracker.entries.get(id)?.rev !== rev);
    for (let { id, rev } of changed) {
      let response = await tracker.client.getWorkItemUpdates(id);
      if (tracker.entries.set(id, { enteredAt: columnEnteredAt(response.updates), rev }), pauseIfAsked(tracker, response.retryAfterSeconds))
        return;
    }
  }
  function isCheckDue(tracker, ids) {
    let now = tracker.now(), isDue = ids.some((id) => !tracker.entries.has(id)) || now - tracker.lastCheckAt >= 6e4;
    return !tracker.isChecking && ids.length > 0 && isDue && now >= tracker.pausedUntil;
  }
  async function check(tracker, ids) {
    tracker.isChecking = !0, tracker.lastCheckAt = tracker.now();
    try {
      await fetchChangedCards(tracker, ids);
    } catch {
      tracker.pausedUntil = tracker.now() + 6e4;
    } finally {
      tracker.isChecking = !1;
    }
  }
  function createDaysInColumn(options) {
    let tracker = {
      client: options.client,
      columnIds: /* @__PURE__ */ new Map(),
      entries: /* @__PURE__ */ new Map(),
      isChecking: !1,
      lastCheckAt: Number.NEGATIVE_INFINITY,
      now: options.now,
      pausedUntil: Number.NEGATIVE_INFINITY
    };
    return {
      async sync() {
        let cards = findCards(options.document);
        showBars(tracker, cards);
        let ids = [...cards.keys()];
        isCheckDue(tracker, ids) && (await check(tracker, ids), showBars(tracker, findCards(options.document)));
      }
    };
  }

  // azure-devops/src/days-in-column-toggle.ts
  var HEADER_SELECTOR = ".kanban-board-column-header", COLUMN_SELECTOR2 = ".kanban-board-column[data-column]", TOGGLE_CLASS = "fix-ado-days-toggle";
  function showColumnState(column, toggle, isHidden) {
    Object.hasOwn(column.dataset, "fixAdoDaysHidden") !== isHidden && (isHidden ? column.dataset.fixAdoDaysHidden = "" : delete column.dataset.fixAdoDaysHidden);
    let pressed = String(!isHidden);
    toggle.getAttribute("aria-pressed") !== pressed && (toggle.setAttribute("aria-pressed", pressed), toggle.title = isHidden ? "Show days in column" : "Hide days in column", toggle.setAttribute("aria-label", toggle.title));
  }
  function createToggle(document2, onClick2) {
    let toggle = document2.createElement("button");
    return toggle.type = "button", toggle.className = TOGGLE_CLASS, toggle.append(...Array.from({ length: 3 }, () => document2.createElement("span"))), toggle.addEventListener("click", (event) => {
      event.preventDefault(), event.stopPropagation(), onClick2();
    }), toggle;
  }
  function findOrAddToggle(header, onClick2) {
    let existing = header.querySelector(`.${TOGGLE_CLASS}`);
    if (existing !== null)
      return existing;
    let toggle = createToggle(header.ownerDocument, onClick2);
    return (header.querySelector(".justify-space-between > .flex-row") ?? header).append(toggle), toggle;
  }
  function createDaysInColumnToggles(options) {
    let { document: document2, storage } = options, hiddenColumnIds = new Set(storage.load());
    function flip(columnId) {
      hiddenColumnIds.delete(columnId) || hiddenColumnIds.add(columnId), storage.save([...hiddenColumnIds]), sync3();
    }
    function sync3() {
      let headers = [...document2.querySelectorAll(HEADER_SELECTOR)], columns = [...document2.querySelectorAll(COLUMN_SELECTOR2)];
      if (headers.length === columns.length)
        for (let [index, header] of headers.entries()) {
          let column = columns[index], columnId = column?.dataset.column;
          if (column !== void 0 && columnId !== void 0) {
            let toggle = findOrAddToggle(header, () => {
              flip(columnId);
            });
            showColumnState(column, toggle, hiddenColumnIds.has(columnId));
          }
        }
    }
    return { sync: sync3 };
  }

  // azure-devops/src/on-off-setting.ts
  function createOnOffSetting(options) {
    let { key, label, menu: menu2, onChange, storage } = options, isOn = storage.get(key, options.defaultValue);
    function showInMenu() {
      menu2.register(`${label}: ${isOn ? "on" : "off"}`, flip, key);
    }
    function flip() {
      isOn = !isOn, storage.set(key, isOn), showInMenu(), onChange(isOn);
    }
    return showInMenu(), { isOn: () => isOn };
  }

  // azure-devops/src/pipeline-issues.ts
  var NO_ISSUES = { errorCount: 0, warningCount: 0 }, COUNT_FIELDS = { error: "errorCount", warning: "warningCount" };
  function isIssueKind(type) {
    return type === "error" || type === "warning";
  }
  function issueKey(issue) {
    return `${issue.type}
${issue.message ?? ""}`;
  }
  function childrenByParentOf(records) {
    let children = /* @__PURE__ */ new Map();
    for (let record of records)
      record.parentId !== null && children.set(record.parentId, [...children.get(record.parentId) ?? [], record]);
    return children;
  }
  function descendantsOf(record, childrenByParent) {
    let descendants = [];
    for (let child of childrenByParent.get(record.id) ?? [])
      descendants.push(child, ...descendantsOf(child, childrenByParent));
    return descendants;
  }
  function ownIssuesOf(records) {
    let childrenByParent = childrenByParentOf(records);
    return new Map(
      records.map((record) => {
        let below = new Set(
          descendantsOf(record, childrenByParent).flatMap(
            (descendant) => (descendant.issues ?? []).map((issue) => issueKey(issue))
          )
        ), own = (record.issues ?? []).filter(
          (issue) => isIssueKind(issue.type) && !below.has(issueKey(issue))
        );
        return [record.id, own];
      })
    );
  }
  function ownCountOf(record, own, kind) {
    let listed = (record.issues ?? []).filter((issue) => issue.type === kind).length, repeated = listed - own.filter((issue) => issue.type === kind).length;
    return Math.max(0, Math.max(record[COUNT_FIELDS[kind]] ?? 0, listed) - repeated);
  }
  function issueCountsOf(records) {
    let childrenByParent = childrenByParentOf(records), ownIssues = ownIssuesOf(records), ownCounts = new Map(
      records.map((record) => {
        let own = ownIssues.get(record.id) ?? [];
        return [
          record.id,
          {
            errorCount: ownCountOf(record, own, "error"),
            warningCount: ownCountOf(record, own, "warning")
          }
        ];
      })
    );
    return new Map(
      records.map((record) => [
        record.id,
        sumIssueCounts(
          [record, ...descendantsOf(record, childrenByParent)].map(
            ({ id }) => ownCounts.get(id) ?? NO_ISSUES
          )
        )
      ])
    );
  }
  function sumIssueCounts(counts) {
    let total = { ...NO_ISSUES };
    for (let count of counts)
      total.errorCount += count.errorCount, total.warningCount += count.warningCount;
    return total;
  }
  function runIssueOf(issue, spot) {
    let place = (spot.job === null ? [spot.stage.name] : [spot.job.name, spot.step?.name]).filter((name) => name != null), lineNumber = Number(issue.data?.logFileLineNumber ?? Number.NaN);
    return {
      jobId: spot.job?.id ?? null,
      kind: issue.type,
      lineNumber: Number.isInteger(lineNumber) ? lineNumber : null,
      message: issue.message ?? "",
      place,
      stageId: spot.stage.id,
      stepId: spot.step?.id ?? null
    };
  }
  function runIssuesAt(spot, issues) {
    return issues.flatMap(
      (issue) => isIssueKind(issue.type) ? [runIssueOf({ ...issue, type: issue.type }, spot)] : []
    );
  }
  function runIssuesOf(stages) {
    let issues = stages.flatMap((stage) => stage.issues);
    return [
      ...issues.filter((issue) => issue.kind === "error"),
      ...issues.filter((issue) => issue.kind === "warning")
    ];
  }

  // azure-devops/src/pipeline-issue-list.ts
  var SVG_NAMESPACE2 = "http://www.w3.org/2000/svg", ICON_SIZES = {
    large: { className: " margin-4", drawing: 32, pixels: 24 },
    small: { className: "", drawing: 16, pixels: 16 }
  }, ICON_MARKS = {
    error: {
      large: "M21.99 9.99a1.5 1.5 0 0 0-2.122 0L16 13.856 12.132 9.99a1.5 1.5 0 0 0-2.121 2.122l3.868 3.868-3.89 3.889a1.5 1.5 0 0 0 2.122 2.121L16 18.1l3.89 3.89a1.5 1.5 0 0 0 2.12-2.122l-3.889-3.89 3.868-3.867a1.5 1.5 0 0 0 0-2.122z",
      small: "M10.984 5.004a.9.9 0 0 1 0 1.272L9.27 7.99l1.74 1.741a.9.9 0 1 1-1.272 1.273l-1.74-1.741-1.742 1.74a.9.9 0 1 1-1.272-1.272l1.74-1.74-1.713-1.714a.9.9 0 0 1 1.273-1.273l1.713 1.713 1.714-1.713a.9.9 0 0 1 1.273 0z"
    },
    warning: {
      large: "M16 7a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-3 0v-9A1.5 1.5 0 0 1 16 7zm-1.5 16a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z",
      small: "M8.91 3.9a.9.9 0 0 0-1.8 0v4.7a.9.9 0 1 0 1.8 0V3.9zm-.95 8.65a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8z"
    }
  }, KIND_STATUSES = { error: "failed", warning: "warning" }, KIND_LABELS = { error: "Error", warning: "Warning" }, LIST_ROW_WRAPPERS = [
    { className: "bolt-list-cell-content flex-row", tag: "div" },
    { className: "bolt-list-cell", tag: "td" },
    { className: "bolt-list-row first-row", role: "listitem", tag: "tr" },
    { className: "relative", tag: "tbody" },
    {
      className: "preview-check-list bolt-list body-m relative scroll-hidden",
      role: "list",
      tag: "table"
    },
    { className: "status-details-container fix-ado-issue-box", tag: "div" }
  ];
  function countText(count, kind) {
    return `${count} ${kind}${count === 1 ? "" : "s"}`;
  }
  function issueSummary(parts) {
    let { errorCount, warningCount } = sumIssueCounts(parts);
    return [
      ...errorCount > 0 ? [countText(errorCount, "error")] : [],
      ...warningCount > 0 ? [countText(warningCount, "warning")] : []
    ].join(", ");
  }
  function worstKindOf(issues) {
    return issues.some((issue) => issue.kind === "error") ? "error" : "warning";
  }
  function createElement(document2, { className, role, tag, text }) {
    let created = document2.createElement(tag);
    return created.className = className, text !== void 0 && (created.textContent = text), role !== void 0 && created.setAttribute("role", role), created;
  }
  function wrapIn(document2, content, wrappers) {
    let wrapped = content;
    for (let wrapper of wrappers) {
      let outer = createElement(document2, wrapper);
      outer.append(wrapped), wrapped = outer;
    }
    return wrapped;
  }
  function setAttributes2(element2, attributes) {
    for (let [name, value] of Object.entries(attributes))
      element2.setAttribute(name, value);
  }
  function createKindIcon(document2, kind, size) {
    let { className, drawing, pixels } = ICON_SIZES[size], icon = document2.createElementNS(SVG_NAMESPACE2, "svg");
    setAttributes2(icon, {
      "aria-label": KIND_LABELS[kind],
      class: `bolt-status flex-noshrink ${KIND_STATUSES[kind]}${className} fix-ado-kind-icon`,
      "data-kind": kind,
      height: String(pixels),
      role: "img",
      viewBox: `0 0 ${drawing} ${drawing}`,
      width: String(pixels)
    });
    let circle = document2.createElementNS(SVG_NAMESPACE2, "circle"), middle = String(drawing / 2);
    setAttributes2(circle, { cx: middle, cy: middle, r: middle });
    let mark = document2.createElementNS(SVG_NAMESPACE2, "path");
    return setAttributes2(mark, { d: ICON_MARKS[kind][size], fill: "#fff" }), icon.append(circle, mark), icon;
  }
  function createIssueCounts(document2, counts) {
    return ["error", "warning"].flatMap((kind) => {
      let count = kind === "error" ? counts.errorCount : counts.warningCount;
      if (count === 0)
        return [];
      let text = String(count), badge = createElement(document2, { className: "fix-ado-issue-count", tag: "span", text });
      return badge.dataset.kind = kind, badge.setAttribute("aria-label", countText(count, kind)), badge.title = countText(count, kind), [badge];
    });
  }
  function createOutputLine(document2, issue) {
    let line2 = createElement(document2, {
      className: "flex-row monospaced-m dark-build-output fix-ado-issue-output",
      tag: "div"
    });
    issue.lineNumber !== null && line2.append(createElement(document2, { className: "line-number padding-horizontal-16", tag: "div", text: String(issue.lineNumber) }));
    let className = `${issue.kind === "error" ? "error-text" : "fix-ado-warning-text"} word-break fix-ado-issue-message`;
    return line2.append(createElement(document2, { className, tag: "div", text: issue.message })), line2;
  }
  function fillIssueLink(link, issue) {
    let { ownerDocument: document2 } = link;
    link.className = "bolt-table-link full-width-link-no-padding no-underline-link bolt-link fix-ado-issue", link.dataset.kind = issue.kind;
    let place = createElement(document2, {
      className: "padding-horizontal-16 padding-vertical-8 text-ellipsis separator-line-top secondary-text body-s fix-ado-issue-place",
      tag: "div",
      text: issue.place.join(" / ")
    }), output = createElement(document2, { className: "flex-column", tag: "div" });
    return output.append(createOutputLine(document2, issue)), link.append(place, output), link;
  }
  function createBoxHeader(document2, box) {
    let text = createElement(document2, {
      className: "pr-completion-status-header flex-row flex-center flex-grow rhythm-horizontal-8 text-ellipsis",
      tag: "div"
    }), { title } = box;
    text.append(
      createElement(document2, {
        className: "text-ellipsis fix-ado-issue-box-title",
        tag: "span",
        text: title
      })
    ), box.details !== null && text.append(createElement(document2, { className: "secondary-text fix-ado-issue-box-details", tag: "span", text: box.details }));
    let header = createElement(document2, {
      className: "flex-row flex-grow flex-center padding-horizontal-16 rhythm-horizontal-8 fix-ado-issue-box-header",
      tag: "div"
    });
    return header.append(createKindIcon(document2, worstKindOf(box.issues), "small"), text), header;
  }
  function createIssueBox(document2, box) {
    let content = createElement(document2, {
      className: "flex-column flex-grow text-ellipsis",
      tag: "div"
    }), links = box.issues.map((issue) => box.createLink(issue));
    return content.append(createBoxHeader(document2, box), ...links), wrapIn(document2, content, LIST_ROW_WRAPPERS);
  }

  // azure-devops/src/pipeline-run-link.ts
  var RUN_PATH_END = "/_build/results";
  function parsePipelineRunLocation(location2) {
    let query = new URLSearchParams(location2.search), buildId = Number(query.get("buildId") ?? Number.NaN);
    if (!location2.pathname.endsWith(RUN_PATH_END) || !Number.isInteger(buildId))
      return null;
    let jobId = query.get("j"), stepId = query.get("t");
    return query.get("view") !== "logs" ? { buildId, jobId: null, stepId: null, view: "summary" } : jobId !== null && stepId !== null ? { buildId, jobId, stepId, view: "log" } : { buildId, jobId: null, stepId: null, view: "steps" };
  }
  function pipelineLogPath(apiBasePath2, project, { buildId, jobId, stepId }) {
    let step = `j=${encodeURIComponent(jobId)}&t=${encodeURIComponent(stepId)}`;
    return `${apiBasePath2}/${encodeURIComponent(project)}${RUN_PATH_END}?buildId=${buildId}&view=logs&${step}`;
  }

  // azure-devops/src/overview-pipeline-issues-card.ts
  var OVERVIEW_ISSUES_CLASS = "fix-ado-overview-issues";
  function runLinkOf({ apiBasePath: apiBasePath2, project }, buildId, { jobId, stepId }) {
    return jobId !== null && stepId !== null ? pipelineLogPath(apiBasePath2, project, { buildId, jobId, stepId }) : `${apiBasePath2}/${encodeURIComponent(project)}/_build/results?buildId=${buildId}`;
  }
  function createCheckIssueBox(document2, content, { check: check2, counts, issues }) {
    return createIssueBox(document2, {
      createLink: (issue) => {
        let link = document2.createElement("a");
        return link.href = runLinkOf(content, check2.buildId, issue), fillIssueLink(link, issue);
      },
      details: issueSummary([counts]),
      issues,
      title: check2.name
    });
  }
  function headingOf(checks) {
    let runs = checks.length === 1 ? "the latest run" : "the latest runs";
    return `${issueSummary(checks.map(({ counts }) => counts))} in ${runs}`;
  }
  var CARD_WRAPPERS = [
    { className: "flex-column flex-grow scroll-hidden", tag: "div" },
    { className: "bolt-card-content flex-row flex-grow bolt-default-horizontal-spacing", tag: "div" },
    {
      className: `bolt-table-card bolt-card flex-column depth-8 bolt-card-white ${OVERVIEW_ISSUES_CLASS}`,
      role: "region",
      tag: "section"
    }
  ];
  function createHeading(document2, checks) {
    let heading = createElement(document2, {
      className: "fix-ado-overview-issues-heading",
      tag: "span",
      text: headingOf(checks)
    }), text = wrapIn(document2, heading, [
      { className: "flex-column flex-grow scroll-hidden", tag: "div" }
    ]), row = createElement(document2, {
      className: "flex-row flex-center rhythm-horizontal-8",
      tag: "div"
    }), kind = worstKindOf(checks.flatMap(({ issues }) => issues));
    return row.append(createKindIcon(document2, kind, "large"), text), row;
  }
  function createIssuesCard(document2, content) {
    let { checks } = content, rows = createElement(document2, {
      className: "padding-vertical-16 padding-horizontal-20 rhythm-vertical-16",
      tag: "div"
    });
    rows.append(
      createHeading(document2, checks),
      ...checks.map((checkIssues) => createCheckIssueBox(document2, content, checkIssues))
    );
    let block = wrapIn(document2, rows, CARD_WRAPPERS);
    return block.setAttribute("aria-label", "Pipeline warnings and errors"), block.dataset.fixAdoRendered = JSON.stringify(checks), block;
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

  // azure-devops/src/pipeline-checks.ts
  function checkNameOf(evaluation, fallback) {
    return evaluation.configuration.settings?.displayName ?? evaluation.context?.buildDefinitionName ?? fallback;
  }
  function pipelineCheckOf(evaluation) {
    let buildId = evaluation.context?.buildId ?? 0;
    return evaluation.configuration.type.id !== BUILD_POLICY_TYPE_ID || buildId <= 0 ? null : {
      buildId,
      isRequired: evaluation.configuration.isBlocking,
      name: checkNameOf(evaluation, `Run ${buildId}`),
      startedAt: evaluation.context?.buildStartedUtc ?? null,
      status: pipelineStatusOf([evaluation])
    };
  }
  function startedAtMs(check2) {
    return check2.startedAt === null ? 0 : Date.parse(check2.startedAt);
  }
  function pipelineChecksOf(evaluations) {
    return evaluations.map((evaluation) => pipelineCheckOf(evaluation)).filter((check2) => check2 !== null).toSorted((first, second) => startedAtMs(second) - startedAtMs(first));
  }
  function startableChecksOf(evaluations) {
    return evaluations.flatMap(
      ({ evaluationId, ...evaluation }) => evaluation.configuration.type.id === BUILD_POLICY_TYPE_ID && evaluationId !== void 0 ? [
        {
          evaluationId,
          isRequired: evaluation.configuration.isBlocking,
          name: checkNameOf(evaluation, "Build check")
        }
      ] : []
    );
  }

  // azure-devops/src/pipeline-timeline.ts
  var RESULT_STATUSES = {
    abandoned: { label: "Canceled", status: "notStarted" },
    canceled: { label: "Canceled", status: "notStarted" },
    failed: { label: "Failed", status: "failed" },
    skipped: { label: "Skipped", status: "notStarted" },
    succeeded: { label: "Succeeded", status: "succeeded" },
    succeededWithIssues: { label: "Succeeded with warnings", status: "expired" }
  };
  function recordStatusOf({ result, state }) {
    return state === "inProgress" ? { label: "Running", status: "running" } : (result === null ? void 0 : RESULT_STATUSES[result]) ?? { label: "Not started", status: "notStarted" };
  }
  var NO_STAGE_ID = "", DEFAULT_STAGE_NAME = "__default";
  function inRunOrder(records) {
    return records.toSorted((first, second) => (first.order ?? 0) - (second.order ?? 0));
  }
  function stageIdOf(record, byId) {
    let parent = record.parentId === null ? void 0 : byId.get(record.parentId);
    for (; parent !== void 0 && parent.type !== "Stage"; )
      parent = parent.parentId === null ? void 0 : byId.get(parent.parentId);
    return parent?.id ?? NO_STAGE_ID;
  }
  function countsOf(index, id) {
    return index.counts.get(id) ?? NO_ISSUES;
  }
  function jobOf(job, index) {
    let steps = inRunOrder(
      index.records.filter((record) => record.type === "Task" && record.parentId === job.id)
    ).map(({ id, name, result, state }) => {
      let { errorCount, warningCount } = countsOf(index, id);
      return { errorCount, id, jobId: job.id, name, result, state, warningCount };
    });
    return {
      id: job.id,
      name: job.name,
      result: job.result,
      state: job.state,
      steps,
      ...countsOf(index, job.id)
    };
  }
  function stageIssuesOf(stage, jobs, index) {
    let ownOf = (id) => index.ownIssues.get(id) ?? [], stageSpot = {
      job: null,
      stage: {
        id: stage.id,
        name: stage.id === NO_STAGE_ID || stage.name === DEFAULT_STAGE_NAME ? null : stage.name
      },
      step: null
    };
    return [
      ...index.records.filter(
        (record) => record.type !== "Job" && record.type !== "Task" && (record.id === stage.id || stageIdOf(record, index.byId) === stage.id)
      ).flatMap((record) => runIssuesAt(stageSpot, ownOf(record.id))),
      ...jobs.flatMap((job) => {
        let jobSpot = { ...stageSpot, job };
        return [
          ...runIssuesAt(jobSpot, ownOf(job.id)),
          ...job.steps.flatMap((step) => runIssuesAt({ ...jobSpot, step }, ownOf(step.id)))
        ];
      })
    ];
  }
  function stagesOf(records) {
    let index = {
      byId: new Map(records.map((record) => [record.id, record])),
      counts: issueCountsOf(records),
      ownIssues: ownIssuesOf(records),
      records
    }, jobs = inRunOrder(records.filter((record) => record.type === "Job")), stages = inRunOrder(records.filter((record) => record.type === "Stage"));
    return (stages.length > 0 || jobs.length === 0 ? stages : [{ id: NO_STAGE_ID, name: "Jobs", result: null, state: "" }]).map((stage) => {
      let stageJobs = jobs.filter((job) => stageIdOf(job, index.byId) === stage.id).map((job) => jobOf(job, index)), { errorCount, warningCount } = stage.id === NO_STAGE_ID ? sumIssueCounts(stageJobs) : countsOf(index, stage.id);
      return {
        errorCount,
        id: stage.id,
        issues: stageIssuesOf(stage, stageJobs, index),
        jobs: stageJobs,
        name: stage.name,
        result: stage.result,
        state: stage.state,
        warningCount
      };
    });
  }
  function defaultStepOf(stages) {
    let steps = stages.flatMap((stage) => stage.jobs.flatMap((job) => job.steps));
    return steps.find((step) => step.state === "inProgress") ?? steps.find((step) => step.result === "failed") ?? steps[0] ?? null;
  }

  // azure-devops/src/overview-pipeline-issues.ts
  var REFRESH_MS = 3e4, DESCRIPTION_SELECTOR = ".repos-pr-description-card", CHECKS_AREA_ERROR_SELECTOR = ".dark-build-output .error-text", RUN_LINK_SELECTOR = 'a[href*="/_build/results?"]';
  function isBusy(check2) {
    return check2.status === "running" || check2.status === "queued";
  }
  function isTimelineDue(data, check2, now) {
    let loaded = data.timelines.get(check2.buildId);
    return loaded === void 0 || loaded.checkStatus !== check2.status || isBusy(check2) && now - loaded.loadedAt >= REFRESH_MS;
  }
  function checksAreaErrorsOf(document2) {
    let errors = /* @__PURE__ */ new Map();
    for (let line2 of document2.querySelectorAll(CHECKS_AREA_ERROR_SELECTOR)) {
      let href = line2.closest(RUN_LINK_SELECTOR)?.getAttribute("href"), run = href == null || line2.closest(`.${OVERVIEW_ISSUES_CLASS}`) !== null ? null : parsePipelineRunLocation(new URL(href, document2.baseURI));
      run !== null && errors.set(run.buildId, (errors.get(run.buildId) ?? /* @__PURE__ */ new Set()).add(line2.textContent.trim()));
    }
    return errors;
  }
  function checkIssuesOf(check2, stages, shownErrors) {
    let all = runIssuesOf(stages), issues = all.filter(
      (issue) => issue.kind !== "error" || !shownErrors.has(issue.message.trim())
    ), { errorCount, warningCount } = sumIssueCounts(stages), hiddenCount = all.length - issues.length;
    return {
      check: check2,
      counts: { errorCount: Math.max(0, errorCount - hiddenCount), warningCount },
      issues
    };
  }
  function checksWithIssues(data, document2) {
    let checksAreaErrors = checksAreaErrorsOf(document2);
    return data.checks.flatMap((check2) => {
      let stages = data.timelines.get(check2.buildId)?.stages ?? [], shownErrors = checksAreaErrors.get(check2.buildId) ?? /* @__PURE__ */ new Set(), checkIssues = checkIssuesOf(check2, stages, shownErrors);
      return checkIssues.issues.length > 0 ? [checkIssues] : [];
    });
  }
  function isBlockShown(block, checks, description) {
    return block?.dataset.fixAdoRendered === JSON.stringify(checks) && block.nextElementSibling === description;
  }
  function render(state) {
    let { data, options } = state, description = options.document.querySelector(DESCRIPTION_SELECTOR), existing = options.document.querySelector(`.${OVERVIEW_ISSUES_CLASS}`), checks = data === null ? [] : checksWithIssues(data, options.document);
    if (description === null || data === null || checks.length === 0) {
      existing?.remove();
      return;
    }
    isBlockShown(existing, checks, description) || (existing?.remove(), description.before(createCard(options, data, checks)));
  }
  function createCard({ apiBasePath: apiBasePath2, document: document2 }, data, checks) {
    return createIssuesCard(document2, { apiBasePath: apiBasePath2, checks, project: data.pullRequest.project });
  }
  function showIfCurrent(state, data) {
    state.data === data && render(state);
  }
  async function loadTimeline(state, data, check2) {
    let { options } = state, loaded = {
      checkStatus: check2.status,
      loadedAt: options.now(),
      stages: data.timelines.get(check2.buildId)?.stages ?? null
    };
    data.timelines.set(check2.buildId, loaded);
    try {
      loaded.stages = stagesOf(await options.getTimeline(data.pullRequest.project, check2.buildId));
    } catch {
    }
    showIfCurrent(state, data);
  }
  async function loadChecks(state, data) {
    let { options } = state;
    data.checksLoadedAt = options.now();
    try {
      data.checks = pipelineChecksOf(await options.getEvaluations(data.pullRequest));
    } catch {
      return;
    }
    let now = options.now();
    for (let check2 of data.checks.filter((candidate) => isTimelineDue(data, candidate, now)))
      loadTimeline(state, data, check2);
    showIfCurrent(state, data);
  }
  function syncOverview(state, pullRequest, canFetch) {
    JSON.stringify(state.data?.pullRequest ?? null) !== JSON.stringify(pullRequest) && (state.data = pullRequest === null ? null : {
      checks: [],
      checksLoadedAt: Number.NEGATIVE_INFINITY,
      pullRequest,
      timelines: /* @__PURE__ */ new Map()
    }), render(state);
    let { data, options } = state, isOnOverview = options.document.querySelector(DESCRIPTION_SELECTOR) !== null;
    data !== null && canFetch && isOnOverview && options.now() - data.checksLoadedAt >= REFRESH_MS && loadChecks(state, data);
  }
  function createOverviewPipelineIssues(options) {
    let state = { data: null, options };
    return {
      sync: (pullRequest, canFetch) => {
        syncOverview(state, pullRequest, canFetch);
      }
    };
  }

  // azure-devops/src/page-reloader.ts
  var PAGE_CHECK_INTERVAL_MS = 3e4, FAILED_PAGE_CHECK_RETRY_MS = 6e4, MS_PER_SECOND = 1e3;
  function isCheckDue2(state, page, immediately) {
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
        !page || state.isChecking || !isCheckDue2(state, page, immediately) || await runCheck(state, page);
      }
    };
  }

  // azure-devops/src/pipeline-run-frame.ts
  function createPipelineRunFrame(document2) {
    return parsePipelineRunLocation(document2.location) === null ? null : {
      sync: () => {
        document2.documentElement.dataset.fixAdoRunFrame = "";
      }
    };
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

  // azure-devops/src/closest-element.ts
  function isElement(target) {
    return target !== null && "nodeType" in target && target.nodeType === 1;
  }
  function closestElement(target, selector) {
    return isElement(target) ? target.closest(selector) : null;
  }
  function isHtmlElement(element2) {
    return "dataset" in element2;
  }
  function closestHtmlElement(target, selector) {
    let found = closestElement(target, selector);
    return found !== null && isHtmlElement(found) ? found : null;
  }

  // azure-devops/src/pipeline-tab-tree.ts
  var DATE_FORMAT = { dateStyle: "short", timeStyle: "short" }, NAME_CLASS = "fix-ado-pipeline-item-name";
  function textElement(document2, className, text) {
    let element2 = document2.createElement("span");
    return element2.className = className, element2.textContent = text, element2;
  }
  function createItemText(document2, item) {
    let text = textElement(document2, "fix-ado-pipeline-item-text", "");
    return text.append(textElement(document2, NAME_CLASS, item.name)), item.details !== void 0 && text.append(textElement(document2, "fix-ado-pipeline-item-details", item.details)), text;
  }
  function createItemParts(document2, item) {
    let icon = item.status === null ? [] : [createStatusIcon(document2, item.status.status, item.status.label)], counts = item.issueCounts === void 0 ? [] : createIssueCounts(document2, item.issueCounts);
    return [...icon, createItemText(document2, item), ...counts];
  }
  function foldPick(context, level) {
    let { pick } = context;
    return { ...pick, folded: pick.folded === level ? null : level };
  }
  function createItem(context, item) {
    let { document: document2 } = context, button = document2.createElement("button");
    return button.type = "button", button.className = `fix-ado-pipeline-item ${item.className}`, button.setAttribute("aria-current", String(item.isCurrent)), button.append(...createItemParts(document2, item)), button.addEventListener("click", () => {
      let { level } = item;
      context.onPick(item.isCurrent && level !== null ? foldPick(context, level) : item.pick);
    }), button;
  }
  function requiredLabel(isRequired) {
    return isRequired ? "Required" : "Optional";
  }
  function runDetails(run) {
    let kind = run.isRequired === null ? `#${run.buildNumber ?? run.buildId}` : requiredLabel(run.isRequired), started = run.startedAt === null ? [] : [new Date(run.startedAt).toLocaleString([], DATE_FORMAT)];
    return [...run.status?.status === "cancelling" ? ["Cancelling"] : [], kind, ...started].join(" · ");
  }
  function group(document2, className, children) {
    let element2 = document2.createElement("div");
    return element2.className = className, element2.append(...children), element2;
  }
  function createJobSteps(context, job) {
    let { run, stage, step } = context.shown, steps = job.steps.map(
      (candidate) => createItem(context, {
        className: "fix-ado-pipeline-step",
        isCurrent: candidate.id === step?.id,
        issueCounts: candidate,
        level: null,
        name: candidate.name,
        pick: {
          buildId: run.buildId,
          folded: null,
          jobId: candidate.jobId,
          stageId: stage?.id ?? null,
          stepId: candidate.id
        },
        status: recordStatusOf(candidate)
      })
    );
    return group(context.document, "fix-ado-pipeline-steps", steps);
  }
  function createJob(context, job) {
    let { shown } = context, isCurrent = shown.step?.jobId === job.id, item = createItem(context, {
      className: "fix-ado-pipeline-job",
      isCurrent,
      issueCounts: job,
      level: "job",
      name: job.name,
      pick: {
        buildId: shown.run.buildId,
        folded: null,
        jobId: job.id,
        stageId: shown.stage?.id ?? null,
        stepId: null
      },
      status: recordStatusOf(job)
    });
    return isCurrent && context.pick.folded === "job" ? [item] : [item, createJobSteps(context, job)];
  }
  function createJobs(context) {
    let items = (context.shown.stage?.jobs ?? []).flatMap((job) => createJob(context, job));
    return group(context.document, "fix-ado-pipeline-jobs", items);
  }
  function stageName(stage) {
    return stage.name === DEFAULT_STAGE_NAME ? "Jobs" : stage.name;
  }
  function createStage(context, stage) {
    let { shown } = context, isCurrent = stage.id === shown.stage?.id, item = createItem(context, {
      className: "fix-ado-pipeline-stage",
      isCurrent,
      issueCounts: stage,
      level: "stage",
      name: stageName(stage),
      pick: {
        buildId: shown.run.buildId,
        folded: null,
        jobId: null,
        stageId: stage.id,
        stepId: null
      },
      status: recordStatusOf(stage)
    });
    return isCurrent && context.pick.folded !== "stage" ? [item, createJobs(context)] : [item];
  }
  function createStages(context) {
    let { document: document2, shown } = context;
    if (shown.stages === null)
      return textElement(document2, "fix-ado-pipeline-note", "Loading stages…");
    if (shown.stages.length === 0)
      return textElement(document2, "fix-ado-pipeline-note", "No stages yet.");
    let items = shown.stages.flatMap((stage) => createStage(context, stage));
    return group(document2, "fix-ado-pipeline-stages", items);
  }
  function createRun(context, run) {
    let isCurrent = run.buildId === context.shown.run.buildId, item = createItem(context, {
      className: "fix-ado-pipeline-run",
      details: runDetails(run),
      isCurrent,
      level: "run",
      name: run.name,
      pick: { buildId: run.buildId, folded: null, jobId: null, stageId: null, stepId: null },
      status: run.status
    });
    return isCurrent && context.pick.folded !== "run" ? [item, createStages(context)] : [item];
  }
  function showCutOffNames(tree) {
    tree.addEventListener("mouseover", (event) => {
      let row = closestElement(event.target, ".fix-ado-pipeline-item"), name = row?.querySelector(`.${NAME_CLASS}`);
      row === null || name === null || name === void 0 || (name.scrollWidth > name.clientWidth ? row.setAttribute("title", name.textContent) : row.removeAttribute("title"));
    });
  }
  function createRunTree(context) {
    let items = context.runs.flatMap((run) => createRun(context, run)), tree = group(context.document, "fix-ado-pipeline-tree", items);
    return tree.setAttribute("role", "navigation"), tree.setAttribute("aria-label", "Pipeline runs"), showCutOffNames(tree), tree;
  }

  // azure-devops/src/pipeline-tab-run-action.ts
  var LABELS2 = {
    cancel: {
      failed: "Could not cancel the run.",
      idle: "Cancel current run",
      waiting: "Cancelling…"
    },
    start: { failed: "Could not start the run.", idle: "Start new run", waiting: "Starting…" }
  }, LOOKS = { cancel: "danger", start: "primary" };
  function textElement2(document2, className, text) {
    let element2 = document2.createElement("span");
    return element2.className = className, element2.textContent = text, element2;
  }
  function createChoice(context, choice) {
    let { document: document2 } = context, row = document2.createElement("button");
    row.type = "button", row.className = "fix-ado-pipeline-item fix-ado-pipeline-run-action-choice";
    let text = textElement2(document2, "fix-ado-pipeline-item-text", "");
    return text.append(
      textElement2(document2, "fix-ado-pipeline-item-name", choice.name),
      textElement2(document2, "fix-ado-pipeline-item-details", choice.details)
    ), row.append(text), row.addEventListener("click", () => {
      context.onPick(context.action, choice.key);
    }), row;
  }
  function createChoices(context) {
    let list = context.document.createElement("div");
    return list.className = "fix-ado-pipeline-run-action-choices", list.append(...context.choices.map((choice) => createChoice(context, choice))), list;
  }
  function onButtonClick({ action, choices, onPick, onToggleList, state }) {
    let [onlyChoice] = choices;
    choices.length === 1 && onlyChoice !== void 0 ? onPick(action, onlyChoice.key) : onToggleList(state !== "choosing");
  }
  function createButton(context) {
    let { action, choices, document: document2, state } = context, isWaiting = state === "waiting", button = Object.assign(document2.createElement("button"), {
      className: `bolt-button ${LOOKS[action]} bolt-focus-treatment ${isWaiting ? "disabled" : "enabled"} fix-ado-pipeline-run-action`,
      disabled: isWaiting,
      type: "button"
    }), label = LABELS2[action][isWaiting ? "waiting" : "idle"];
    return button.append(textElement2(document2, "bolt-button-text body-m", label)), choices.length > 1 && button.setAttribute("aria-expanded", String(state === "choosing")), button.addEventListener("click", () => {
      onButtonClick(context);
    }), button;
  }
  function createRunAction(context) {
    let { action, choices, document: document2, state } = context;
    if (choices.length === 0)
      return null;
    let button = createButton(context);
    return state === "choosing" ? [button, createChoices(context)] : state === "failed" ? [button, textElement2(document2, "fix-ado-pipeline-note", LABELS2[action].failed)] : [button];
  }

  // azure-devops/src/pipeline-log-frame.ts
  var LOG_TITLE_SELECTOR = ".logs-view .log-header .job-header .title-m", TREE_ROW_SELECTOR = ".run-logs-tree .bolt-tree-row", ROW_NAME_SELECTOR = ".job-name-area [role=button]";
  function load(frame, log2) {
    frame.setAttribute("src", log2.path);
  }
  function shownStepName(frame) {
    return frame.contentDocument?.querySelector(LOG_TITLE_SELECTOR)?.textContent.trim() ?? null;
  }
  function showsStep(frame, stepName) {
    return shownStepName(frame) === stepName;
  }
  function stepInTree(document2, log2) {
    let names = [...document2.querySelectorAll(TREE_ROW_SELECTOR)].map((row) => row.querySelector(ROW_NAME_SELECTOR)).filter((name) => name !== null), jobIndex = names.findIndex((name) => name.textContent.trim() === log2.jobName), isStep = (name) => name.textContent.trim() === log2.stepName;
    return names.slice(jobIndex + 1).find((name) => isStep(name)) ?? names.find((name) => isStep(name)) ?? null;
  }
  function waitForSwitch(frame, log2, schedule) {
    let checksLeft = 15, check2 = () => {
      frame.dataset.fixAdoLogPath !== log2.path || showsStep(frame, log2.stepName) || (checksLeft -= 1, checksLeft > 0 ? schedule(check2, 100) : load(frame, log2));
    };
    schedule(check2, 100);
  }
  function stepInFrame(frame, log2) {
    let isSameRun = frame.dataset.fixAdoBuildId === String(log2.buildId), document2 = frame.contentDocument;
    return isSameRun && document2 !== null ? stepInTree(document2, log2) : null;
  }
  function showStepLog(frame, log2, schedule = setTimeout) {
    if (frame.dataset.fixAdoLogPath === log2.path)
      return;
    let step = stepInFrame(frame, log2);
    if (frame.dataset.fixAdoLogPath = log2.path, frame.dataset.fixAdoBuildId = String(log2.buildId), step === null) {
      load(frame, log2);
      return;
    }
    step.click(), waitForSwitch(frame, log2, schedule);
  }
  function watchShownStep(frame, onStep) {
    if (frame.dataset.fixAdoWatched !== void 0)
      return;
    frame.dataset.fixAdoWatched = "";
    let lastStepName = null, report = () => {
      let stepName = shownStepName(frame);
      stepName !== null && stepName !== lastStepName && (lastStepName = stepName, onStep(stepName));
    }, watchPage = () => {
      let view = frame.contentDocument?.defaultView;
      if (frame.contentDocument !== null && view !== null && view !== void 0) {
        let options = { characterData: !0, childList: !0, subtree: !0 };
        new view.MutationObserver(report).observe(frame.contentDocument, options);
      }
    };
    frame.addEventListener("load", watchPage), watchPage();
  }

  // azure-devops/src/pipeline-tab-panel.ts
  var PANEL_CLASS = "fix-ado-pipeline-panel", TREE_SELECTOR = ":scope > .fix-ado-pipeline-tree", FRAME_SELECTOR = ":scope > .fix-ado-pipeline-frame", LOG_NOTE_SELECTOR = ":scope > .fix-ado-pipeline-log-note", ISSUES_SELECTOR = ":scope > .fix-ado-issue-box";
  function message(panel, text) {
    let note = panel.ownerDocument.createElement("p");
    note.className = "fix-ado-pipeline-message", note.textContent = text, panel.replaceChildren(note);
  }
  function frameOf(panel) {
    let existing = panel.querySelector(FRAME_SELECTOR);
    if (existing !== null)
      return existing;
    let frame = panel.ownerDocument.createElement("iframe");
    return frame.className = "fix-ado-pipeline-frame", frame.title = "Step log", panel.append(frame), frame;
  }
  function showLogNote(panel, text) {
    let note = panel.querySelector(LOG_NOTE_SELECTOR);
    if (text === null) {
      note?.remove();
      return;
    }
    note === null && (note = panel.ownerDocument.createElement("p"), note.className = "fix-ado-pipeline-log-note", panel.append(note)), note.textContent = text;
  }
  function stepLogOf(shown, step, content) {
    let { buildId } = shown.run, jobName = shown.stage?.jobs.find((job) => job.id === step.jobId)?.name ?? "";
    return { buildId, jobName, path: content.logPathOf(buildId, step), stepName: step.name };
  }
  function showLog(panel, shown, content) {
    let { step } = shown;
    if (step === null) {
      panel.querySelector(FRAME_SELECTOR)?.setAttribute("hidden", ""), showLogNote(panel, shown.stages === null ? "Loading steps…" : "This run has no steps yet.");
      return;
    }
    showLogNote(panel, null);
    let frame = frameOf(panel);
    frame.removeAttribute("hidden"), showStepLog(frame, stepLogOf(shown, step, content));
  }
  function stepOf(stages, stepId) {
    return stages.flatMap((stage) => stage.jobs.flatMap((job) => job.steps)).find((step) => step.id === stepId);
  }
  function createIssueLink({ document: document2, shown }, issue, content) {
    let { buildId } = shown.run, link = document2.createElement("a"), step = stepOf(shown.stages ?? [], issue.stepId);
    return link.href = step === void 0 ? "#" : content.logPathOf(buildId, step), link.addEventListener("click", (event) => {
      event.preventDefault();
      let { jobId, stageId, stepId } = issue;
      content.onPick({ buildId, folded: null, jobId, stageId, stepId });
    }), fillIssueLink(link, issue);
  }
  function showIssues(panel, tree, content) {
    panel.querySelector(ISSUES_SELECTOR)?.remove();
    let { shown } = content, stages = shown?.stages ?? [], issues = runIssuesOf(stages);
    if (shown === null || issues.length === 0)
      return;
    let context = { document: panel.ownerDocument, shown }, box = createIssueBox(context.document, {
      createLink: (issue) => createIssueLink(context, issue, content),
      details: null,
      issues,
      title: issueSummary(stages)
    });
    tree.after(box);
  }
  function placeTree(panel, tree) {
    panel.querySelector(":scope > .fix-ado-pipeline-message")?.remove();
    let oldTree = panel.querySelector(TREE_SELECTOR);
    oldTree === null ? panel.prepend(tree) : oldTree.replaceWith(tree);
  }
  function runActionOf(runs, checks) {
    let busyRuns = runs.filter((run) => run.isBusy);
    return busyRuns.length > 0 ? {
      action: "cancel",
      choices: busyRuns.map((run) => ({
        details: runDetails(run),
        key: String(run.buildId),
        name: run.name
      }))
    } : {
      action: "start",
      choices: checks.map((check2) => ({
        details: check2.isRequired ? "Required" : "Optional",
        key: check2.evaluationId,
        name: check2.name
      }))
    };
  }
  function runActionElements(panel, { runs, startableChecks }, content) {
    return createRunAction({
      ...runActionOf(runs, startableChecks),
      document: panel.ownerDocument,
      onPick: content.onRunAction,
      onToggleList: content.onRunActionListToggle,
      state: content.runActionState
    }) ?? [];
  }
  function showRun(panel, loaded, content) {
    let { shown } = content;
    if (shown === null) {
      message(panel, "This pull request has no pipeline runs."), panel.prepend(...runActionElements(panel, loaded, content));
      return;
    }
    let tree = createRunTree({
      document: panel.ownerDocument,
      onPick: content.onPick,
      pick: content.pick,
      runs: loaded.runs,
      shown
    });
    tree.prepend(...runActionElements(panel, loaded, content)), placeTree(panel, tree), showIssues(panel, tree, content), showLog(panel, shown, content);
  }
  function renderKey({ pick, runActionState, runs, shown }) {
    return JSON.stringify([runs, shown, pick, runActionState]);
  }
  function renderPanel(panel, content) {
    let key = renderKey(content);
    panel.dataset.fixAdoRendered !== key && (panel.dataset.fixAdoRendered = key, content.runs.kind === "loading" ? message(panel, "Loading pipeline runs…") : content.runs.kind === "failed" ? message(panel, "Could not load the pipeline runs.") : showRun(panel, content.runs, content));
  }
  function createPanel(document2) {
    let panel = document2.createElement("div");
    return panel.className = PANEL_CLASS, panel.setAttribute("role", "tabpanel"), panel;
  }

  // azure-devops/src/pipeline-runs.ts
  var RESULT_STATUSES2 = {
    canceled: { label: "Canceled", status: "notStarted" },
    failed: { label: "Failed", status: "failed" },
    partiallySucceeded: { label: "Partly succeeded", status: "expired" },
    succeeded: { label: "Succeeded", status: "succeeded" }
  }, PROGRESS_STATUSES = {
    cancelling: { label: "Cancelling", status: "cancelling" },
    inProgress: { label: "Running", status: "running" },
    notStarted: { label: "Queued", status: "queued" },
    postponed: { label: "Queued", status: "queued" }
  }, BUSY_BUILD_STATUSES = /* @__PURE__ */ new Set(["inProgress", "notStarted", "postponed"]);
  function buildStatusOf(build) {
    return (build.result === void 0 ? void 0 : RESULT_STATUSES2[build.result]) ?? PROGRESS_STATUSES[build.status] ?? null;
  }
  function runStatusOf(build, check2) {
    let isCancelling = build.status === "cancelling";
    return check2?.status === null || check2 === void 0 || isCancelling ? buildStatusOf(build) : { status: check2.status };
  }
  function runOfBuild(build, check2) {
    return {
      buildId: build.id,
      buildNumber: build.buildNumber,
      isBusy: BUSY_BUILD_STATUSES.has(build.status),
      isRequired: check2?.isRequired ?? null,
      name: check2?.name ?? build.definition?.name ?? `Run ${build.buildNumber}`,
      startedAt: build.startTime ?? build.queueTime ?? check2?.startedAt ?? null,
      status: runStatusOf(build, check2)
    };
  }
  function runOfCheck(check2) {
    let status = check2.status === null ? null : { status: check2.status }, isBusy2 = check2.status === "running" || check2.status === "queued";
    return { ...check2, buildNumber: null, isBusy: isBusy2, status };
  }
  function pipelineRunsOf(checks, builds) {
    let listed = new Set(builds.map((build) => build.id));
    return [
      ...checks.filter((check2) => !listed.has(check2.buildId)).map((check2) => runOfCheck(check2)),
      ...builds.map(
        (build) => runOfBuild(
          build,
          checks.find((check2) => check2.buildId === build.id)
        )
      )
    ];
  }

  // azure-devops/src/pipeline-tab-selection.ts
  function stageWithStep(stages, stepId) {
    return stages.find(
      (stage) => stage.jobs.some((job) => job.steps.some((step) => step.id === stepId))
    );
  }
  function pickedScope(stages, pick) {
    let pickedStage = stages.find((stage) => stage.id === pick.stageId), pickedJob = (pickedStage?.jobs ?? []).find((job) => job.id === pick.jobId);
    return pickedStage !== void 0 && pickedJob !== void 0 ? [{ ...pickedStage, jobs: [pickedJob] }] : pickedStage === void 0 ? stages : [pickedStage];
  }
  function shownStepOf(stages, pick) {
    let scope = pickedScope(stages, pick);
    return scope.flatMap((stage) => stage.jobs.flatMap((job) => job.steps)).find((step) => step.id === pick.stepId) ?? defaultStepOf(scope);
  }
  function shownRunOf(runs, stagesByBuildId, pick) {
    let run = runs.find((candidate) => candidate.buildId === pick.buildId) ?? runs[0];
    if (run === void 0)
      return null;
    let stages = stagesByBuildId.get(run.buildId) ?? null;
    if (stages === null)
      return { run, stage: null, stages, step: null };
    let step = shownStepOf(stages, pick), stage = (step === null ? void 0 : stageWithStep(stages, step.id)) ?? stages.find((candidate) => candidate.id === pick.stageId) ?? stages[0] ?? null;
    return { run, stage, stages, step };
  }

  // azure-devops/src/pipeline-tab-data.ts
  var RUNS_REFRESH_MS = 3e4, ACTED_RUNS_REFRESH_MS = 5e3, ACTED_RUNS_REFRESH_WINDOW_MS = 6e4, RUNNING_TIMELINE_REFRESH_MS = 5e3, NO_PICK = {
    buildId: null,
    folded: null,
    jobId: null,
    stageId: null,
    stepId: null
  };
  function createTabData(pullRequest) {
    return {
      fastRunsRefreshUntil: Number.NEGATIVE_INFINITY,
      pick: NO_PICK,
      pullRequest,
      runActionState: "idle",
      runs: { kind: "loading" },
      runsLoadedAt: Number.NEGATIVE_INFINITY,
      stagesByBuildId: /* @__PURE__ */ new Map(),
      timelineLoadedAt: /* @__PURE__ */ new Map()
    };
  }
  function shownRunOfData(data) {
    return data.runs.kind === "loaded" ? shownRunOf(data.runs.runs, data.stagesByBuildId, data.pick) : null;
  }
  function logRunListFailure(error) {
    return error instanceof AdoRequestError ? log("Pipeline tab: Azure DevOps refused the run list", { httpStatus: error.httpStatus }) : log("Pipeline tab: the run list request failed without an answer"), [];
  }
  async function loadRuns({ data, onChange, sources }) {
    data.runsLoadedAt = sources.now();
    try {
      let [evaluations, builds] = await Promise.all([
        sources.getEvaluations(data.pullRequest),
        sources.getPullRequestBuilds(data.pullRequest).catch(logRunListFailure)
      ]), checks = pipelineChecksOf(evaluations);
      log("Pipeline tab: runs loaded", { checkCount: checks.length, runCount: builds.length }), data.runs = {
        kind: "loaded",
        runs: pipelineRunsOf(checks, builds),
        startableChecks: startableChecksOf(evaluations)
      };
    } catch {
      data.runs = data.runs.kind === "loaded" ? data.runs : { kind: "failed" };
    }
    onChange();
  }
  async function loadTimeline2(loader, buildId) {
    let { data, onChange, sources } = loader;
    data.timelineLoadedAt.set(buildId, sources.now());
    try {
      let records = await sources.getTimeline(data.pullRequest.project, buildId);
      data.stagesByBuildId.set(buildId, stagesOf(records));
    } catch {
    }
    onChange();
  }
  function isTimelineDue2(data, shown, now) {
    let loadedAt = data.timelineLoadedAt.get(shown.run.buildId);
    if (loadedAt === void 0)
      return !0;
    let status = shown.run.status?.status;
    return (status === "running" || status === "queued" || (shown.stages ?? []).some((stage) => stage.state !== "completed") || shown.stages === null) && now - loadedAt >= RUNNING_TIMELINE_REFRESH_MS;
  }
  function loadWhatIsDue(loader) {
    let { data, sources } = loader, now = sources.now(), runsRefreshMs = now < data.fastRunsRefreshUntil ? ACTED_RUNS_REFRESH_MS : RUNS_REFRESH_MS;
    now - data.runsLoadedAt >= runsRefreshMs && loadRuns(loader);
    let shown = shownRunOfData(data);
    shown !== null && isTimelineDue2(data, shown, now) && loadTimeline2(loader, shown.run.buildId);
  }
  async function sendRunAction(loader, action, key) {
    let { data, sources } = loader;
    try {
      return await (action === "start" ? sources.requeueCheck(data.pullRequest, key) : sources.cancelRun(data.pullRequest.project, Number(key))), data.runsLoadedAt = Number.NEGATIVE_INFINITY, data.fastRunsRefreshUntil = sources.now() + ACTED_RUNS_REFRESH_WINDOW_MS, log(
        `Pipeline tab: run action ${action} sent`,
        action === "cancel" ? { buildId: Number(key) } : {}
      ), "idle";
    } catch (error) {
      return log(`Pipeline tab: Azure DevOps refused run action ${action}`, {
        httpStatus: error instanceof AdoRequestError ? error.httpStatus : null
      }), "failed";
    }
  }
  async function performRunAction(loader, action, key) {
    loader.data.runActionState = "waiting", loader.onChange(), loader.data.runActionState = await sendRunAction(loader, action, key), loader.onChange();
  }
  function expireTimeline(data, buildId) {
    data.timelineLoadedAt.delete(buildId);
  }

  // azure-devops/src/pipeline-tab.ts
  var TAB_CLASS = "fix-ado-pipeline-tab", TAB_LABEL = "Pipeline", OPEN_ATTRIBUTE = "data-fix-ado-pipeline-tab-open", PAGE_SELECTOR = ".repos-pr-details-page", TABBAR_SELECTOR = ".repos-pr-details-page-tabbar", CHECKS_PANEL_SELECTOR = ".bolt-panel", RUN_LINK = 'a[href*="/_build/results?"]', RUN_LINK_SELECTOR2 = `${PAGE_SELECTOR} ${RUN_LINK}, ${CHECKS_PANEL_SELECTOR} ${RUN_LINK}`;
  function createTab(document2) {
    let tab = document2.createElement("a");
    return tab.className = `bolt-tab focus-treatment flex-noshrink ${TAB_CLASS}`, tab.setAttribute("role", "tab"), tab.href = "#", tab.innerHTML = `<span class="bolt-tab-inner-container"><span class="bolt-tab-text" data-content="${TAB_LABEL}">${TAB_LABEL}</span></span>`, setSelected(tab, !1), tab;
  }
  function setSelected(tab, isSelected) {
    tab.classList.toggle("selected", isSelected), tab.setAttribute("aria-selected", String(isSelected));
  }
  function isSamePullRequest(data, pullRequest) {
    return JSON.stringify(data?.pullRequest ?? null) === JSON.stringify(pullRequest);
  }
  function panelOf(state, page) {
    let existing = page.querySelector(`.${PANEL_CLASS}`), tabbar = page.querySelector(TABBAR_SELECTOR);
    if (existing !== null || tabbar === null)
      return existing;
    let panel = createPanel(state.options.document);
    return tabbar.after(panel), panel;
  }
  function render2(state) {
    let { data } = state, page = state.options.document.querySelector(PAGE_SELECTOR), panel = page === null ? null : panelOf(state, page);
    if (!state.isOpen || data === null || page === null || panel === null)
      return;
    page.setAttribute(OPEN_ATTRIBUTE, "");
    let { apiBasePath: apiBasePath2 } = state.options, { project } = data.pullRequest;
    renderPanel(panel, {
      logPathOf: (buildId, step) => pipelineLogPath(apiBasePath2, project, { buildId, jobId: step.jobId, stepId: step.id }),
      onPick: (pick) => {
        data.pick = pick, update(state);
      },
      onRunAction: (action, key) => {
        performRunAction(loaderOf(state, data), action, key);
      },
      onRunActionListToggle: (isOpen) => {
        data.runActionState = isOpen ? "choosing" : "idle", update(state);
      },
      pick: data.pick,
      runActionState: data.runActionState,
      runs: data.runs,
      shown: shownRunOfData(data)
    }), watchLog(state, panel);
  }
  function onLogStep(state, stepName) {
    let { data } = state, shown = data === null ? null : shownRunOfData(data);
    data === null || shown === null || data.pick.stepId !== null || shown.step?.name === stepName || (expireTimeline(data, shown.run.buildId), update(state));
  }
  function watchLog(state, panel) {
    let frame = panel.querySelector(".fix-ado-pipeline-frame");
    frame !== null && watchShownStep(frame, (stepName) => {
      onLogStep(state, stepName);
    });
  }
  function loaderOf(state, data) {
    return {
      data,
      onChange: () => {
        state.data === data && update(state);
      },
      sources: state.options
    };
  }
  function update(state) {
    let { data } = state;
    !state.isOpen || data === null || (render2(state), loadWhatIsDue(loaderOf(state, data)));
  }
  function selectTab(state) {
    let { document: document2 } = state.options, tab = document2.querySelector(`.${TAB_CLASS}`);
    for (let other of document2.querySelectorAll("[role=tablist] [role=tab].selected"))
      other !== tab && (state.replacedTab = other, setSelected(other, !1));
    tab !== null && setSelected(tab, !0);
  }
  function openTab(state, run) {
    if (state.isOpen = !0, run !== null && state.data !== null) {
      let { buildId, jobId, stepId } = run;
      state.data.pick = { buildId, folded: null, jobId, stageId: null, stepId };
    }
    selectTab(state), update(state);
  }
  function closeTab(state) {
    let { document: document2 } = state.options;
    state.isOpen = !1;
    let page = document2.querySelector(PAGE_SELECTOR);
    page?.removeAttribute(OPEN_ATTRIBUTE), page?.querySelector(`.${PANEL_CLASS}`)?.remove();
    for (let tab of document2.querySelectorAll(`.${TAB_CLASS}`))
      setSelected(tab, !1);
    state.replacedTab !== null && (setSelected(state.replacedTab, !0), state.replacedTab = null);
  }
  function closeChecksPanel(target) {
    closestElement(target, CHECKS_PANEL_SELECTOR)?.querySelector(".bolt-panel-header .ms-Icon--Clear")?.closest("button")?.click();
  }
  function clickedRun(event, document2) {
    let link = closestElement(event.target, RUN_LINK_SELECTOR2), isPlainClick = event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey, button = closestElement(event.target, "button, [role=button]"), isOnButtonInLink = button !== null && link?.contains(button) === !0;
    if (link === null || !isPlainClick || isOnButtonInLink || closestElement(event.target, `.${PANEL_CLASS}`) !== null)
      return null;
    let url = new URL(link.getAttribute("href") ?? "", document2.location.href);
    return parsePipelineRunLocation(url);
  }
  function onClick(state, event) {
    if (state.data === null)
      return;
    let isPipelineTab = closestElement(event.target, `.${TAB_CLASS}`) !== null, run = clickedRun(event, state.options.document);
    isPipelineTab || run !== null ? (event.preventDefault(), event.stopPropagation(), openTab(state, run), closeChecksPanel(event.target)) : state.isOpen && closestElement(event.target, "[role=tablist] [role=tab]") !== null && closeTab(state);
  }
  function addTab(document2) {
    let tablist = document2.querySelector(`${TABBAR_SELECTOR} [role=tablist]`);
    return tablist === null ? !1 : (tablist.querySelector(`.${TAB_CLASS}`) === null && tablist.append(createTab(document2)), !0);
  }
  function syncTab(state, pullRequest) {
    isSamePullRequest(state.data, pullRequest) || (closeTab(state), state.data = pullRequest === null ? null : createTabData(pullRequest)), state.data !== null && addTab(state.options.document) && state.isOpen && (selectTab(state), update(state));
  }
  function createPipelineTab(options) {
    let state = { data: null, isOpen: !1, options, replacedTab: null };
    return options.document.addEventListener(
      "click",
      (event) => {
        onClick(state, event);
      },
      { capture: !0 }
    ), {
      sync: (pullRequest) => {
        syncTab(state, pullRequest);
      }
    };
  }

  // azure-devops/src/inbox-reviewers.ts
  var REVIEWER_REFRESH_INTERVAL_MS = 12e4, repositoryKey = ({ project, repository }) => JSON.stringify([project, repository]);
  function dueRepositories(options, nextFetchAtByRepository) {
    let due = /* @__PURE__ */ new Map();
    for (let pullRequest of options.findPullRequests()) {
      let key = repositoryKey(pullRequest);
      (nextFetchAtByRepository.get(key) ?? 0) <= options.now() && due.set(key, pullRequest);
    }
    return [...due.values()];
  }
  function createInboxReviewerFetcher(options) {
    let nextFetchAtByRepository = /* @__PURE__ */ new Map(), isFetching = !1;
    async function fetchRepository(pullRequest) {
      let key = repositoryKey(pullRequest);
      try {
        let { pullRequests } = await options.client.getPullRequests({
          project: pullRequest.project,
          repository: pullRequest.repository,
          status: "active"
        });
        for (let listed of pullRequests)
          options.reviewersByPullRequestId.set(listed.pullRequestId, listed.reviewers ?? []);
        nextFetchAtByRepository.set(key, options.now() + REVIEWER_REFRESH_INTERVAL_MS);
      } catch {
        nextFetchAtByRepository.set(key, options.now() + FAILED_REQUEST_RETRY_MS);
      }
    }
    return {
      async sync() {
        if (!isFetching) {
          isFetching = !0;
          try {
            for (let pullRequest of dueRepositories(options, nextFetchAtByRepository))
              await fetchRepository(pullRequest);
          } finally {
            isFetching = !1;
          }
        }
      }
    };
  }

  // azure-devops/src/required-reviewers.ts
  function createRequiredReviewerMarker(options) {
    let reviewersByPullRequestId = /* @__PURE__ */ new Map(), inboxReviewerFetcher = createInboxReviewerFetcher({
      client: options.client,
      findPullRequests: () => options.findRows().map(({ pullRequest }) => pullRequest),
      now: options.now,
      reviewersByPullRequestId
    });
    function markAll() {
      for (let { row, pullRequest } of options.findRows()) {
        let reviewers = reviewersByPullRequestId.get(pullRequest.pullRequestId);
        reviewers && markRequiredReviewers(row, reviewers);
      }
    }
    return {
      markAll,
      remember(pullRequests) {
        for (let pullRequest of pullRequests)
          reviewersByPullRequestId.set(pullRequest.pullRequestId, pullRequest.reviewers ?? []);
        markAll();
      },
      async syncInbox() {
        await inboxReviewerFetcher.sync(), markAll();
      }
    };
  }

  // azure-devops/src/starred-reviewers-markup.ts
  var STARRED_SECTION_CLASS = "fix-ado-starred-reviewers", STAR_BUTTON_CLASS = "fix-ado-star", STAR_PATH = "M8 1.6l1.95 4.02 4.43.58-3.24 3.07.82 4.4L8 11.53l-3.96 2.14.82-4.4L1.62 6.2l4.43-.58z", REQUIRED_RING_PATH = "M8 1.75a6.25 6.25 0 1 0 0 12.5a6.25 6.25 0 1 0 0-12.5z", PLUS_PATH = "M8 5v6M5 8h6", SVG_NAMESPACE3 = "http://www.w3.org/2000/svg";
  function element(document2, tag, { className, text, attributes = {}, children = [] } = {}) {
    let created = document2.createElement(tag);
    className !== void 0 && (created.className = className), text !== void 0 && (created.textContent = text);
    for (let [name, value] of Object.entries(attributes))
      created.setAttribute(name, value);
    return created.append(...children), created;
  }
  function fontIcon(document2, name, size) {
    return element(document2, "span", {
      children: [
        element(document2, "span", {
          attributes: { "aria-hidden": "true" },
          className: `left-icon flex-noshrink fabric-icon ms-Icon--${name} ${size}`
        })
      ],
      className: "fluent-icons-enabled"
    });
  }
  function svgIcon(document2, className, pathData) {
    let svg = document2.createElementNS(SVG_NAMESPACE3, "svg"), attributes = {
      "aria-hidden": "true",
      class: className,
      height: "16",
      viewBox: "0 0 16 16",
      width: "16"
    };
    for (let [name, value] of Object.entries(attributes))
      svg.setAttribute(name, value);
    for (let data of pathData) {
      let path = document2.createElementNS(SVG_NAMESPACE3, "path");
      path.setAttribute("d", data), svg.append(path);
    }
    return svg;
  }
  function createStarButton(document2) {
    return element(document2, "button", {
      attributes: { "aria-pressed": "false", type: "button" },
      children: [svgIcon(document2, "fix-ado-star-icon", [STAR_PATH])],
      className: `${STAR_BUTTON_CLASS} bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment`
    });
  }
  function updateStarButton(button, isStarred) {
    button.getAttribute("aria-pressed") !== String(isStarred) && (button.setAttribute("aria-pressed", String(isStarred)), button.setAttribute("aria-label", isStarred ? "Remove from starred" : "Add to starred"), button.setAttribute("title", isStarred ? "Remove from starred" : "Add to starred"));
  }
  function detailOf(identity) {
    return identity.isGroup ? "Group" : identity.signInAddress;
  }
  function createRequiredButton(document2, identity) {
    return element(document2, "button", {
      attributes: {
        "aria-label": `Add ${identity.displayName} as required reviewer`,
        "data-fix-ado-add": "required",
        title: "Add as required reviewer",
        type: "button"
      },
      children: [svgIcon(document2, "fix-ado-required-icon", [REQUIRED_RING_PATH, PLUS_PATH])],
      className: "bolt-split-button-option flex-self-stretch body-s bolt-button bolt-icon-button enabled icon-only bolt-focus-treatment"
    });
  }
  function createNameColumn(document2, identity) {
    let name = element(document2, "div", {
      className: "body-m flex-grow text-ellipsis",
      text: identity.displayName
    }), detail = element(document2, "div", {
      className: "fix-ado-starred-detail body-s secondary-text text-ellipsis",
      text: detailOf(identity)
    });
    return element(document2, "div", {
      children: [name, detail],
      className: "flex-column flex-grow text-ellipsis icon-large-margin"
    });
  }
  function createAddSplitButton(document2, identity) {
    return element(document2, "div", {
      children: [
        element(document2, "button", {
          attributes: {
            "aria-label": `Add ${identity.displayName} as optional reviewer`,
            "data-fix-ado-add": "optional",
            title: "Add as optional reviewer",
            type: "button"
          },
          children: [fontIcon(document2, "Add", "small")],
          className: "bolt-split-button-main bolt-button bolt-icon-button enabled icon-only bolt-focus-treatment"
        }),
        element(document2, "div", { className: "bolt-split-button-divider flex-noshrink" }),
        element(document2, "div", {
          children: [createRequiredButton(document2, identity)],
          className: "inline-flex-row"
        })
      ],
      className: "fix-ado-add-reviewer bolt-split-button inline-flex-row flex-noshrink icon-large-margin"
    });
  }
  function createAvatar(document2, identity, imageUrl) {
    return element(document2, "div", {
      children: [
        element(document2, "div", {
          attributes: { "aria-label": identity.displayName },
          children: [
            element(document2, "img", {
              attributes: { alt: "", src: imageUrl },
              className: "bolt-coin-content using-image size24"
            })
          ],
          className: "bolt-coin flex-noshrink icon-large-margin size24"
        })
      ]
    });
  }
  function createStarredRow(document2, identity, imageUrl) {
    let star = createStarButton(document2);
    return updateStarButton(star, !0), element(document2, "div", {
      attributes: { "data-fix-ado-identity": identity.id },
      children: [
        createAddSplitButton(document2, identity),
        createAvatar(document2, identity, imageUrl),
        createNameColumn(document2, identity),
        star
      ],
      className: "repos-reviewer flex-row flex-center fix-ado-starred-reviewer"
    });
  }
  var EMPTY_TEXT = "Put people/groups here you often add as pull requests, to add them more easily as optional reviewer";
  function createEmptyWell(document2) {
    return element(document2, "div", {
      className: "repos-pr-no-items-well fix-ado-starred-empty",
      text: EMPTY_TEXT
    });
  }
  function createStarSomeoneButton(document2) {
    return element(document2, "button", {
      attributes: { type: "button" },
      children: [
        fontIcon(document2, "Add", "small"),
        element(document2, "span", {
          className: "bolt-button-text body-s",
          text: "Add person/group to starred"
        })
      ],
      className: "fix-ado-star-someone bolt-button subtle enabled bolt-focus-treatment"
    });
  }
  function createStarredSection(document2) {
    return element(document2, "div", {
      children: [
        element(document2, "div", {
          className: "margin-bottom-8 body-s secondary-text font-weight-semibold",
          text: "Add starred as reviewer"
        }),
        element(document2, "div", { className: "fix-ado-starred-list flex-column" }),
        createStarSomeoneButton(document2)
      ],
      className: `flex-grow flex-column ${STARRED_SECTION_CLASS}`
    });
  }

  // azure-devops/src/starred-reviewers-store.ts
  function isIdentity(value) {
    return typeof value == "object" && value !== null && "id" in value && typeof value.id == "string" && "displayName" in value && typeof value.displayName == "string" && "signInAddress" in value && typeof value.signInAddress == "string" && "isGroup" in value && typeof value.isGroup == "boolean";
  }
  function isNameOf(identity, name) {
    let wanted = name.trim().toLowerCase();
    return [identity.displayName, personOrTeamName(identity.displayName)].some(
      (candidate) => candidate.trim().toLowerCase() === wanted
    );
  }
  function createStarredReviewersStore(storage) {
    function list() {
      let stored = storage.load();
      return Array.isArray(stored) ? stored.filter((value) => isIdentity(value)) : [];
    }
    return {
      findByName: (name) => list().find((identity) => isNameOf(identity, name)) ?? null,
      isStarred: (id) => list().some((identity) => identity.id === id),
      list,
      star(identity) {
        let others = list().filter(({ id }) => id !== identity.id);
        storage.save([...others, identity]);
      },
      unstar(id) {
        storage.save(list().filter((identity) => identity.id !== id));
      }
    };
  }

  // azure-devops/src/reviewer-stars.ts
  var REVIEWER_SECTION_SELECTOR = ".pr-required-reviewers-section, .pr-optional-reviewers-section, .pr-declined-reviewers-section";
  function reviewerRowsOf(document2) {
    let rows = [];
    for (let section of document2.querySelectorAll(REVIEWER_SECTION_SELECTOR))
      rows.push(...section.querySelectorAll(":scope > .repos-reviewer"));
    return rows;
  }
  function nameOfRow(row) {
    return row.querySelector(".flex-column > .body-m")?.textContent?.trim() ?? "";
  }
  function isOnPage(document2, identity) {
    return reviewerRowsOf(document2).some((row) => isNameOf(identity, nameOfRow(row)));
  }
  function insertStar(document2, row, onClick2) {
    let star = createStarButton(document2);
    star.addEventListener("click", (event) => {
      event.stopPropagation(), onClick2();
    });
    let reveal = row.querySelector(":scope > .repos-reviewer-reveal");
    return reveal === null ? row.append(star) : reveal.before(star), star;
  }
  function addStars(document2, store, onStarClick) {
    for (let row of reviewerRowsOf(document2)) {
      let star = row.querySelector(`:scope > .${STAR_BUTTON_CLASS}`) ?? insertStar(document2, row, () => {
        onStarClick(row);
      });
      updateStarButton(star, store.findByName(nameOfRow(row)) !== null);
    }
  }

  // azure-devops/src/star-picker.ts
  var SEARCH_DELAY_MS = 300, SUGGESTED_CLASS = "bolt-suggestions-isSuggested";
  function div(className) {
    return { className, tag: "div" };
  }
  function createPersonaName(document2, identity) {
    let detail = element(document2, "div", {
      className: "fontSize secondary-text text-ellipsis",
      text: detailOf(identity)
    });
    return element(document2, "div", {
      children: [
        element(document2, "div", {
          className: "fontSizeM text-ellipsis",
          text: identity.displayName
        }),
        element(document2, "div", { children: [detail], className: "flex-row" })
      ],
      className: "bolt-picker-persona-name flex-column flex-grow"
    });
  }
  function createSuggestion(options, identity) {
    let { document: document2 } = options, text = element(document2, "div", {
      children: [
        createAvatar(document2, identity, options.imageUrlOf(identity)),
        createPersonaName(document2, identity)
      ],
      className: "bolt-picker-suggesteditem-text flex-row flex-grow flex-center text-ellipsis"
    }), item = wrapIn(document2, text, [
      div("bolt-suggestions-item-button flex-row flex-grow scroll-hidden"),
      div(
        "bolt-identitypickerdropdown-item bolt-suggestions-item flex-row flex-grow cursor-pointer scroll-hidden"
      )
    ]);
    return item.addEventListener("mousedown", (event) => {
      event.preventDefault();
    }), item.addEventListener("click", () => {
      options.onPick(identity);
    }), element(document2, "div", {
      attributes: { role: "option" },
      children: [item],
      className: "flex-noshrink"
    });
  }
  function createNoResults(document2) {
    let text = element(document2, "div", {
      className: "bolt-identitypickerdropdown-noresults flex-row flex-grow flex-center",
      text: "No identities found"
    });
    return element(document2, "div", {
      attributes: { role: "alert" },
      children: [text],
      className: "bolt-suggestions-none-region flex-row flex-grow"
    });
  }
  function createCallout(document2) {
    let list = element(document2, "div", {
      attributes: { role: "listbox" },
      className: "bolt-suggestions-container flex-column flex-grow v-scroll-auto h-scroll-hidden"
    }), callout = wrapIn(document2, list, [
      div("bolt-identitypickerdropdown-list bolt-suggestions flex-row flex-grow"),
      div(
        "bolt-identitypickerdropdown-callout-content flex-row flex-grow bolt-callout-content bolt-callout-shadow"
      ),
      div("fix-ado-star-picker-callout bolt-identitypickerdropdown-callout bolt-callout flex-row")
    ]);
    return callout.hidden = !0, { callout, list };
  }
  function createSearchInput(document2) {
    let input = document2.createElement("input");
    return input.className = "bolt-textfield-input flex-grow bolt-textfield-input-with-prefix", input.type = "text", input.placeholder = "Search people and groups", input.setAttribute("role", "combobox"), input.setAttribute("aria-label", "Search people and groups to star"), input.setAttribute("aria-autocomplete", "list"), input.setAttribute("aria-expanded", "false"), input;
  }
  function createField(document2) {
    let input = createSearchInput(document2), prefix = fontIcon(document2, "Contact", "medium");
    return prefix.firstElementChild?.classList.add("prefix", "bolt-textfield-no-text"), { field: element(document2, "div", {
      children: [prefix, input],
      className: "repos-reviewers-identity-picker bolt-identitypickerdropdown-textField flex-row flex-center bolt-textfield focus-treatment focused"
    }), input };
  }
  function showFound(parts, found) {
    let { options, list, callout, input } = parts, unstarred = found.filter(({ id }) => !options.isStarred(id));
    list.replaceChildren(
      ...unstarred.length === 0 ? [createNoResults(options.document)] : unstarred.map((identity) => createSuggestion(options, identity))
    ), callout.hidden = !1, input.setAttribute("aria-expanded", "true");
  }
  async function search(parts, query) {
    parts.searchCount += 1;
    let thisSearch = parts.searchCount, found = await parts.options.search(query).catch(() => []);
    thisSearch === parts.searchCount && parts.input.value.trim() === query && showFound(parts, found);
  }
  function stopSearch(parts) {
    parts.searchCount += 1, parts.cancelSearch?.(), parts.cancelSearch = null;
  }
  function onInput(parts) {
    stopSearch(parts);
    let query = parts.input.value.trim();
    if (query === "") {
      parts.callout.hidden = !0;
      return;
    }
    parts.cancelSearch = parts.options.schedule(() => {
      search(parts, query);
    }, SEARCH_DELAY_MS);
  }
  function moveSuggestion(list, step) {
    let items = [...list.querySelectorAll(".bolt-suggestions-item")], current = items.findIndex((item) => item.classList.contains(SUGGESTED_CLASS)), next = Math.min(Math.max(current + step, 0), items.length - 1);
    items[current]?.classList.remove(SUGGESTED_CLASS), items[next]?.classList.add(SUGGESTED_CLASS);
  }
  function onKeyDown(parts, event) {
    event.key === "Escape" ? parts.options.onClose() : event.key === "ArrowDown" || event.key === "ArrowUp" ? (event.preventDefault(), moveSuggestion(parts.list, event.key === "ArrowDown" ? 1 : -1)) : event.key === "Enter" && (event.preventDefault(), parts.list.querySelector(`.${SUGGESTED_CLASS}`)?.click());
  }
  function createStarPicker(options) {
    let { document: document2 } = options, { field, input } = createField(document2), { callout, list } = createCallout(document2), parts = { callout, cancelSearch: null, input, list, options, searchCount: 0 };
    input.addEventListener("input", () => {
      onInput(parts);
    }), input.addEventListener("keydown", (event) => {
      onKeyDown(parts, event);
    }), input.addEventListener("blur", () => {
      stopSearch(parts), options.onClose();
    });
    let dropdown = wrapIn(document2, field, [
      div("flex-column bolt-identitypickerdropdown-container flex-grow"),
      div("bolt-identitypickerdropdown flex-row flex-grow")
    ]);
    return { element: element(document2, "div", {
      children: [dropdown, callout],
      className: "fix-ado-star-picker margin-bottom-8"
    }), input };
  }

  // azure-devops/src/starred-reviewers.ts
  var ADDED_REVIEWER_WAIT_MS = 4e3;
  function messageOf(error) {
    return error instanceof Error ? error.message : "unknown error";
  }
  async function toggleStar(state, row) {
    let { store, client: client2 } = state.options, name = nameOfRow(row), starred = store.findByName(name);
    if (starred !== null)
      store.unstar(starred.id);
    else if (state.pullRequest !== null) {
      let reviewer = (await client2.getPullRequestReviewers(state.pullRequest)).find((identity) => isNameOf(identity, name));
      reviewer !== void 0 && store.star(reviewer);
    }
    sync(state);
  }
  function reloadUnlessShown(state, identity) {
    let { document: document2, schedule, reload } = state.options;
    schedule(() => {
      isOnPage(document2, identity) || reload();
    }, ADDED_REVIEWER_WAIT_MS);
  }
  function markBusy(state, id, isBusy2) {
    isBusy2 ? (state.busyIds.add(id), state.errorsById.delete(id)) : state.busyIds.delete(id), sync(state);
  }
  async function addReviewer(state, identity, isRequired) {
    let { pullRequest } = state;
    if (!(pullRequest === null || state.busyIds.has(identity.id))) {
      markBusy(state, identity.id, !0);
      try {
        await state.options.client.addPullRequestReviewer(pullRequest, {
          isRequired,
          reviewerId: identity.id
        }), state.addedIds.add(identity.id), reloadUnlessShown(state, identity);
      } catch (error) {
        state.errorsById.set(identity.id, `Could not add: ${messageOf(error)}`);
      } finally {
        markBusy(state, identity.id, !1);
      }
    }
  }
  function openPicker(state, opener) {
    let { document: document2, store, client: client2, imageUrlOf, schedule } = state.options, close = null, picker = createStarPicker({
      document: document2,
      imageUrlOf,
      isStarred: (id) => store.isStarred(id),
      onClose: () => {
        close?.();
      },
      onPick: (identity) => {
        store.star(identity), close?.(), sync(state);
      },
      schedule,
      search: async (query) => client2.searchIdentities(query)
    });
    close = () => {
      close = null, picker.element.remove(), opener.hidden = !1;
    }, opener.hidden = !0, opener.before(picker.element), picker.input.focus();
  }
  function identityOfRow(state, target) {
    let id = closestHtmlElement(target, "[data-fix-ado-identity]")?.dataset.fixAdoIdentity;
    return state.options.store.list().find((identity) => identity.id === id) ?? null;
  }
  function onRowButton(state, button, identity) {
    button.classList.contains(STAR_BUTTON_CLASS) ? (state.options.store.unstar(identity.id), sync(state)) : addReviewer(state, identity, button.dataset.fixAdoAdd === "required");
  }
  function onSectionClick(state, event) {
    let opener = closestHtmlElement(event.target, ".fix-ado-star-someone");
    if (opener !== null) {
      openPicker(state, opener);
      return;
    }
    let identity = identityOfRow(state, event.target), button = closestHtmlElement(event.target, `[data-fix-ado-add], .${STAR_BUTTON_CLASS}`);
    identity !== null && button !== null && onRowButton(state, button, identity);
  }
  function placeSection(state, anchor) {
    let { document: document2 } = state.options, section = document2.querySelector(`.${STARRED_SECTION_CLASS}`);
    return section === null && (section = createStarredSection(document2), section.addEventListener("click", (event) => {
      onSectionClick(state, event);
    })), anchor.nextElementSibling !== section && anchor.after(section), section;
  }
  function disableAddButtons(row) {
    for (let button of row.querySelectorAll("[data-fix-ado-add]"))
      button.classList.replace("enabled", "disabled"), button.setAttribute("disabled", "");
  }
  function showError(row, error) {
    let detail = row.querySelector(".fix-ado-starred-detail");
    detail !== null && (detail.textContent = error, detail.classList.replace("secondary-text", "error-text"));
  }
  function createShownRow(state, identity) {
    let { document: document2, imageUrlOf } = state.options, row = createStarredRow(document2, identity, imageUrlOf(identity));
    state.busyIds.has(identity.id) && disableAddButtons(row);
    let error = state.errorsById.get(identity.id);
    return error !== void 0 && showError(row, error), row;
  }
  function shownIdentities(state, starred) {
    let { document: document2 } = state.options;
    for (let identity of starred)
      state.addedIds.has(identity.id) && isOnPage(document2, identity) && state.addedIds.delete(identity.id);
    return starred.filter(
      (identity) => !state.addedIds.has(identity.id) && !isOnPage(document2, identity)
    );
  }
  function fillList(state, section) {
    let list = section.querySelector(".fix-ado-starred-list"), starred = state.options.store.list(), shown = shownIdentities(state, starred), signature = JSON.stringify([
      starred.length,
      shown.map(({ id }) => [id, state.busyIds.has(id), state.errorsById.get(id) ?? ""])
    ]);
    list === null || list.dataset.fixAdoSignature === signature || (list.dataset.fixAdoSignature = signature, list.replaceChildren(
      ...starred.length === 0 ? [createEmptyWell(state.options.document)] : shown.map((identity) => createShownRow(state, identity))
    ));
  }
  function sync(state) {
    let { document: document2 } = state.options, anchor = document2.querySelector(".pr-optional-reviewers-section") ?? document2.querySelector(".pr-required-reviewers-section");
    state.pullRequest === null || anchor === null || (addStars(document2, state.options.store, (row) => {
      toggleStar(state, row);
    }), fillList(state, placeSection(state, anchor)));
  }
  function createStarredReviewers(options) {
    let state = {
      addedIds: /* @__PURE__ */ new Set(),
      busyIds: /* @__PURE__ */ new Set(),
      errorsById: /* @__PURE__ */ new Map(),
      options,
      pullRequest: null
    };
    return {
      sync(pullRequest) {
        state.pullRequest = pullRequest, sync(state);
      }
    };
  }

  // azure-devops/src/system-theme.ts
  var LIGHT_THEME_ID = "ms.vss-web.vsts-theme", DARK_THEME_ID = "ms.vss-web.vsts-theme-dark", THEME_CLASS_PREFIX = "ms-vss-web-vsts-theme", PALETTE_VARIABLE = "--palette-neutral-0", LIGHT_THEME_CLASS = "ms-vss-web-vsts-theme", DARK_THEME_CLASS = "ms-vss-web-vsts-theme-dark";
  function currentThemeId(document2) {
    let { body } = document2;
    if (body.dataset.theme !== void 0)
      return body.dataset.theme;
    let themeClasses = [...body.classList].filter((name) => name.startsWith(THEME_CLASS_PREFIX));
    if (!themeClasses.some((name) => name !== LIGHT_THEME_CLASS && name !== DARK_THEME_CLASS))
      return themeClasses.includes(DARK_THEME_CLASS) ? DARK_THEME_ID : themeClasses.includes(LIGHT_THEME_CLASS) ? LIGHT_THEME_ID : void 0;
  }
  function isFollowedTheme(themeId) {
    return themeId === LIGHT_THEME_ID || themeId === DARK_THEME_ID;
  }
  function findRootStyle(document2) {
    return [...document2.head.querySelectorAll("style")].find((style) => {
      let text = style.textContent.trimStart();
      return text.startsWith(":root") && text.includes(PALETTE_VARIABLE);
    }) ?? null;
  }
  function readLook(document2) {
    let rootStyle = findRootStyle(document2);
    return rootStyle === null ? null : {
      bodyClasses: [...document2.body.classList].filter((name) => name.startsWith(THEME_CLASS_PREFIX)),
      rootStyle: rootStyle.textContent
    };
  }
  function applyLook(document2, themeId, look) {
    let rootStyle = findRootStyle(document2);
    if (rootStyle === null)
      return !1;
    rootStyle.textContent = look.rootStyle;
    let { body } = document2;
    return body.classList.remove(
      ...[...body.classList].filter((name) => name.startsWith(THEME_CLASS_PREFIX))
    ), body.classList.add(...look.bodyClasses), body.dataset.theme = themeId, !0;
  }
  function rememberLook({ document: document2, looks }) {
    let themeId = currentThemeId(document2), look = readLook(document2);
    if (!isFollowedTheme(themeId) || look === null)
      return;
    let stored = looks.load();
    JSON.stringify(stored[themeId]) !== JSON.stringify(look) && looks.save({ ...stored, [themeId]: look });
  }
  function themeToSwitchTo(options) {
    let current = currentThemeId(options.document), wanted = options.prefersDark() ? DARK_THEME_ID : LIGHT_THEME_ID;
    return options.isOn() && isFollowedTheme(current) && current !== wanted ? wanted : null;
  }
  async function trySaveTheme(options, themeId) {
    try {
      return await options.saveTheme(themeId), !0;
    } catch (error) {
      return log("System theme: Azure DevOps refused the theme save", {
        httpStatus: error instanceof AdoRequestError ? error.httpStatus : null
      }), !1;
    }
  }
  async function switchToSystemTheme(options, isPageLoad) {
    let wanted = themeToSwitchTo(options);
    if (log("System theme: checked", {
      current: currentThemeId(options.document) ?? null,
      isOn: options.isOn(),
      isPageLoad,
      prefersDark: options.prefersDark(),
      rememberedThemes: Object.keys(options.looks.load())
    }), wanted === null || !await trySaveTheme(options, wanted))
      return;
    let look = options.looks.load()[wanted], isSwitched = look !== void 0 && applyLook(options.document, wanted, look);
    log("System theme: saved", {
      hasRootStyle: findRootStyle(options.document) !== null,
      isSwitched,
      wanted
    }), !isSwitched && isPageLoad && options.reload();
  }
  function createSystemTheme(options) {
    let lastSwitch = Promise.resolve(), seenPrefersDark = options.prefersDark(), isWaitingForTheme = !1;
    function queueSwitch(isPageLoad) {
      lastSwitch = lastSwitch.then(async () => switchToSystemTheme(options, isPageLoad));
    }
    function onPageChange() {
      rememberLook(options), isWaitingForTheme && currentThemeId(options.document) !== void 0 && (isWaitingForTheme = !1, queueSwitch(!0));
    }
    function onSystemThemeChange() {
      onPageChange();
      let prefersDark = options.prefersDark();
      prefersDark !== seenPrefersDark && (seenPrefersDark = prefersDark, queueSwitch(!1));
    }
    return options.onSystemThemeChange(() => {
      log("System theme: the system's theme changed"), onSystemThemeChange();
    }), {
      onPageChange,
      settled: async () => lastSwitch,
      async start() {
        seenPrefersDark = options.prefersDark(), rememberLook(options), isWaitingForTheme = currentThemeId(options.document) === void 0, isWaitingForTheme || queueSwitch(!0), await lastSwitch;
      }
    };
  }

  // azure-devops/src/follow-system-theme.ts
  var THEME_LOOKS_KEY = "system-theme-looks", SETTING_KEY = "follow-system-theme", IS_ON_BY_DEFAULT = !0, SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";
  function followSystemTheme({
    client: client2,
    document: document2,
    menu: menu2,
    reload,
    storage
  }) {
    let systemDark = globalThis.matchMedia(SYSTEM_DARK_QUERY), systemTheme = createSystemTheme({
      document: document2,
      // The menu setting stores every flip, so the stored value is the current one.
      isOn: () => storage.get(SETTING_KEY, IS_ON_BY_DEFAULT),
      looks: {
        load: () => GM_getValue(THEME_LOOKS_KEY, {}),
        save: (looks) => {
          GM_setValue(THEME_LOOKS_KEY, looks);
        }
      },
      onSystemThemeChange: (listener) => {
        systemDark.addEventListener("change", listener);
      },
      prefersDark: () => systemDark.matches,
      reload,
      saveTheme: async (themeId) => client2.saveTheme(themeId)
    });
    createOnOffSetting({
      defaultValue: IS_ON_BY_DEFAULT,
      key: SETTING_KEY,
      label: "Follow system theme",
      menu: menu2,
      onChange: (isOn) => {
        isOn && systemTheme.start();
      },
      storage
    }), new MutationObserver(() => {
      systemTheme.onPageChange();
    }).observe(document2.body, { attributeFilter: ["class", "data-theme"], attributes: !0 }), systemTheme.start();
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
.fix-ado-pipeline-status[data-status="expired"],
.fix-ado-pipeline-status[data-status="cancelling"] {
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

/* The Pipeline tab on a pull request. pipeline-tab.ts sets the attribute while it is open. */
.repos-pr-details-page[data-fix-ado-pipeline-tab-open]
  > :not(.repos-pr-header, .repos-pr-details-page-tabbar, .fix-ado-pipeline-panel) {
  display: none !important;
}

/* The pull request page is a column that fills the window; the panel takes what the
   header and tabs leave, so the log reaches the bottom. */
.fix-ado-pipeline-panel {
  display: grid;
  flex: 1 0 0;
  grid-template-columns: 400px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  gap: 16px;
  min-height: 400px;
  padding-top: 16px;
}

/* The tree runs down the left. The warnings and errors sit above the log on the right. */
.fix-ado-pipeline-panel > .fix-ado-pipeline-message {
  grid-column: 1 / -1;
}

.fix-ado-pipeline-panel > .fix-ado-issue-box {
  grid-column: 2;
  grid-row: 1;
  max-height: 200px;
  overflow-y: auto;
}

.fix-ado-pipeline-panel > .fix-ado-pipeline-frame,
.fix-ado-pipeline-panel > .fix-ado-pipeline-log-note {
  grid-column: 2;
  grid-row: 2;
}

.fix-ado-pipeline-tree {
  display: flex;
  grid-column: 1;
  grid-row: 1 / -1;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.fix-ado-pipeline-item {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  border: 0;
  border-radius: 0 4px 4px 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.fix-ado-pipeline-item:hover {
  background: var(--palette-black-alpha-4, rgba(0, 0, 0, 0.04));
}

/* The picked run, stage, job and step get a bar on the left, as in Azure DevOps's own lists. */
.fix-ado-pipeline-item[aria-current="true"] {
  background: var(--palette-black-alpha-6, rgba(0, 0, 0, 0.06));
  box-shadow: inset 3px 0 0 var(--communication-background, rgb(0, 120, 212));
}

.fix-ado-pipeline-item:focus:not(:focus-visible) {
  outline: none;
}

.fix-ado-pipeline-item .fix-ado-pipeline-status {
  margin-left: 0;
}

.fix-ado-pipeline-item-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.fix-ado-pipeline-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fix-ado-pipeline-run .fix-ado-pipeline-item-name {
  font-weight: 600;
}

.fix-ado-pipeline-item-details {
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
  font-size: 12px;
}

/* Stages sit under their run, jobs under their stage, steps under their job. */
.fix-ado-pipeline-stages,
.fix-ado-pipeline-jobs,
.fix-ado-pipeline-steps {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 16px;
}

/* A line above each run but the first, so the runs stand apart. */
.fix-ado-pipeline-run:not(:first-child) {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--palette-black-alpha-10, rgba(0, 0, 0, 0.1));
  border-radius: 0;
}

/* "Start new run" or "Cancel current run" above the runs. Azure DevOps's button
   classes give its look. */
.fix-ado-pipeline-run-action {
  align-self: flex-start;
  margin: 0 0 4px 12px;
}

/* Red, in case the page has no style for Azure DevOps's danger button. */
.fix-ado-pipeline-run-action.danger {
  background: var(--component-status-error, rgb(205, 74, 69));
  border-color: var(--component-status-error, rgb(205, 74, 69));
  color: #fff;
}

.fix-ado-pipeline-run-action-choices {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 16px;
}

.fix-ado-pipeline-note {
  padding: 6px 10px 2px;
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
  font-size: 12px;
}

.fix-ado-pipeline-log-note {
  flex: 1 1 auto;
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
}

.fix-ado-pipeline-frame[hidden] {
  display: none;
}

.fix-ado-pipeline-frame {
  width: 100%;
  height: 100%;
  min-width: 0;
  border: 1px solid var(--palette-black-alpha-10, rgba(0, 0, 0, 0.1));
  border-radius: 4px;
}

/* The run page inside the Pipeline tab. pipeline-run-frame.ts marks it; only the log stays. */
html[data-fix-ado-run-frame] .project-header,
html[data-fix-ado-run-frame] .navigation-container,
html[data-fix-ado-run-frame] .region-content-header,
html[data-fix-ado-run-frame] .region-content-footer,
html[data-fix-ado-run-frame] .region-footer,
html[data-fix-ado-run-frame] .run-logs-view > .bolt-master-panel {
  display: none !important;
}

/* Azure DevOps shows a focus ring on its tabs only for keyboard focus. */
.fix-ado-pipeline-tab:focus:not(:focus-visible) {
  outline: none;
}

/* Days in column on board cards: a dot per day, grey, then orange, then red. */
.fix-ado-days-in-column {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  /* One row of dots, also when empty, so a card keeps its height. */
  min-height: 5px;
  margin-top: 6px;
}

.fix-ado-days-in-column > span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  /* Azure DevOps keeps its palette as bare "r, g, b" values, so it follows the theme. */
  background: rgb(var(--palette-neutral-20, 200, 200, 200));
}

.fix-ado-days-in-column > span[data-age="aging"] {
  background: var(--component-status-warning, rgb(214, 119, 48));
}

.fix-ado-days-in-column > span[data-age="old"] {
  background: var(--component-status-error, rgb(205, 74, 69));
}

/* Skeleton while the day count loads: three grey dots that pulse one after another. */
.fix-ado-days-in-column > span[data-age="loading"] {
  animation: fix-ado-pulse 1.2s ease-in-out infinite;
}
.fix-ado-days-in-column > span[data-age="loading"]:nth-child(2) {
  animation-delay: 0.2s;
}
.fix-ado-days-in-column > span[data-age="loading"]:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes fix-ado-pulse {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fix-ado-days-in-column > span[data-age="loading"] {
    animation: none;
    opacity: 0.6;
  }
}

.kanban-board-column[data-fix-ado-days-hidden] .fix-ado-days-in-column {
  display: none;
}

/* The days-in-column toggle in a column header. It shows while the header is hovered or focused. */
.fix-ado-days-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 6px;
  padding: 3px 4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  opacity: 0;
}

.kanban-board-column-header:is(:hover, :focus-within) .fix-ado-days-toggle {
  opacity: 1;
}

.fix-ado-days-toggle:hover {
  background: rgba(var(--palette-black-alpha-6, 0, 0, 0, 0.06));
}

.fix-ado-days-toggle > span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--component-status-warning, rgb(214, 119, 48));
}

/* Off: hollow dots. */
.fix-ado-days-toggle[aria-pressed="false"] > span {
  background: transparent;
  box-shadow: inset 0 0 0 1px rgb(var(--palette-neutral-60, 102, 102, 102));
}

/* A run's warnings and errors, in a box like Azure DevOps's check list on a pull
   request's Overview. Azure DevOps's own classes on it style it there; these rules keep
   the look where they do not reach, such as the Pipeline tab. */
.fix-ado-issue-box {
  border: 1px solid rgba(var(--palette-neutral-8, 234, 234, 234), 1);
  border-radius: 4px;
  background: rgba(var(--palette-neutral-2, 248, 248, 248), 1);
}

.fix-ado-issue-box > table {
  width: 100%;
  border-collapse: collapse;
}

.fix-ado-issue-box td {
  padding: 0;
  border: 0;
}

.fix-ado-issue-box-header {
  min-height: 48px;
}

.fix-ado-issue {
  display: block;
  color: inherit;
  text-decoration: none;
}

.fix-ado-issue:hover {
  background: var(--component-grid-row-hover-color, rgba(0, 0, 0, 0.02));
}

.fix-ado-issue-output {
  padding: 8px 0;
  background: rgb(30, 30, 30);
  color: rgb(212, 212, 212);
}

.fix-ado-issue-output > .line-number {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.55);
}

/* A long message wraps, and keeps its own line breaks. */
.fix-ado-issue-message {
  min-width: 0;
  padding-right: 16px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* Without a line number, the message keeps the line number's left padding. */
.fix-ado-issue-message:first-child {
  padding-left: 16px;
}

.fix-ado-issue-output > .error-text {
  color: rgb(241, 112, 112);
}

.fix-ado-warning-text {
  color: rgb(240, 190, 90);
}

.fix-ado-kind-icon[data-kind="error"] {
  fill: var(--component-status-error, rgb(205, 74, 69));
}

.fix-ado-kind-icon[data-kind="warning"] {
  fill: var(--component-status-warning, rgb(214, 127, 60));
}

/* The counts of warnings and errors on a stage, job or step in the run tree. */
.fix-ado-issue-count {
  flex-shrink: 0;
  margin-left: auto;
  padding: 0 6px;
  border-radius: 8px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.fix-ado-issue-count + .fix-ado-issue-count {
  margin-left: 0;
}

.fix-ado-issue-count[data-kind="error"] {
  background: var(--component-status-error, rgb(205, 74, 69));
}

.fix-ado-issue-count[data-kind="warning"] {
  background: var(--component-status-warning, rgb(214, 119, 48));
}

/* Starred reviewers: a star on each reviewer row, shown on hover or when starred. */
.repos-reviewer > .fix-ado-star {
  visibility: hidden;
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
  padding: 4px;
}
.repos-reviewer:hover > .fix-ado-star,
.repos-reviewer.focused > .fix-ado-star,
.repos-reviewer > .fix-ado-star:focus-visible,
.repos-reviewer > .fix-ado-star[aria-pressed="true"] {
  visibility: visible;
}
.fix-ado-star-icon path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.2;
  stroke-linejoin: round;
}
.fix-ado-star[aria-pressed="true"] {
  color: var(--communication-foreground, rgba(0, 90, 158, 1));
}
.fix-ado-star[aria-pressed="true"] .fix-ado-star-icon path {
  fill: currentColor;
}

.fix-ado-starred-reviewers {
  margin-top: 16px;
}
/* The + split button sits where Azure DevOps shows the vote icon, so it stays small. */
.fix-ado-add-reviewer .bolt-split-button-main {
  padding: 3px 5px;
}
.fix-ado-add-reviewer .bolt-split-button-option {
  padding: 3px 4px;
}
.fix-ado-required-icon path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
}
.fix-ado-required-icon path:first-child {
  stroke: var(--communication-background, rgb(0, 120, 212));
}
.fix-ado-starred-empty {
  margin-bottom: 8px;
}
.fix-ado-star-someone {
  align-self: flex-start;
  margin-top: 4px;
  padding: 2px 6px;
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
}
.fix-ado-star-someone[hidden] {
  display: none;
}
.fix-ado-star-someone .bolt-button-text {
  padding-left: 4px;
}
.fix-ado-star-picker {
  position: relative;
}
.fix-ado-star-picker-callout {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
}
.fix-ado-star-picker-callout .bolt-suggestions-container {
  max-height: 320px;
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
  }), isTabActive = () => document.visibilityState === "visible", isInFrame = globalThis.top !== globalThis.self, menu = {
    // A frame would add a second menu entry. The top page's entry is enough.
    register: (caption, onClick2, id) => {
      isInFrame || GM_registerMenuCommand(caption, onClick2, { id });
    }
  }, settingStorage = {
    get: (key, defaultValue) => GM_getValue(key, defaultValue),
    set: (key, value) => {
      GM_setValue(key, value);
    }
  }, avatarInitials = createOnOffSetting({
    defaultValue: !0,
    key: "avatar-initials",
    label: "Avatar initials",
    menu,
    onChange: (isOn) => {
      isOn ? showInitialsOnAvatars(document) : hideInitialsOnAvatars(document);
    },
    storage: settingStorage
  }), getEvaluations = async (pullRequest) => {
    let { evaluations } = await client.getPolicyEvaluations(pullRequest);
    return evaluations;
  }, getTimeline = async (project, buildId) => {
    let { records } = await client.getTimeline(project, buildId);
    return records;
  }, pipelineRunFrame = isInFrame ? createPipelineRunFrame(document) : null, pipelineTab = isInFrame ? null : createPipelineTab({
    apiBasePath: basePath,
    cancelRun: async (project, buildId) => {
      await client.cancelBuild(project, buildId);
    },
    document,
    getEvaluations,
    getPullRequestBuilds: async ({ project, pullRequestId }) => {
      let { builds } = await client.getPullRequestBuilds(project, pullRequestId);
      return builds;
    },
    getTimeline,
    now: () => Date.now(),
    requeueCheck: async ({ project }, evaluationId) => {
      await client.requeuePolicyEvaluation(project, evaluationId);
    }
  }), overviewPipelineIssues = isInFrame ? null : createOverviewPipelineIssues({
    apiBasePath: basePath,
    document,
    getEvaluations,
    getTimeline,
    now: () => Date.now()
  }), poller = createPipelineStatusPoller({
    client,
    findRows: () => findPullRequestRows(document, basePath),
    now: () => Date.now(),
    showStatus: showPipelineStatus
  }), daysInColumn = createDaysInColumn({ client, document, now: () => Date.now() }), HIDDEN_DAYS_COLUMNS_KEY = "days-in-column-hidden-columns", daysInColumnToggles = createDaysInColumnToggles({
    document,
    storage: {
      load: () => GM_getValue(HIDDEN_DAYS_COLUMNS_KEY, []),
      save: (columnIds) => {
        GM_setValue(HIDDEN_DAYS_COLUMNS_KEY, columnIds);
      }
    }
  }), STARRED_REVIEWERS_KEY = `starred-reviewers:${location.host}${basePath}`, starredReviewers = isInFrame ? null : createStarredReviewers({
    client,
    document,
    imageUrlOf: ({ id }) => `${location.origin}${basePath}/_api/_common/identityImage?id=${encodeURIComponent(id)}`,
    reload: () => {
      location.reload();
    },
    schedule: (callback, delayMs) => {
      let timer = setTimeout(callback, delayMs);
      return () => {
        clearTimeout(timer);
      };
    },
    store: createStarredReviewersStore({
      load: () => GM_getValue(STARRED_REVIEWERS_KEY, []),
      save: (starred) => {
        GM_setValue(STARRED_REVIEWERS_KEY, starred);
      }
    })
  }), requiredReviewers = createRequiredReviewerMarker({
    client,
    findRows: () => findPullRequestRows(document, basePath),
    now: () => Date.now()
  }), pullRequestListClient = {
    // The list check already fetches the reviewers. Keep them to mark the required ones.
    async getPullRequests(listPage) {
      let response = await client.getPullRequests(listPage);
      return requiredReviewers.remember(response.pullRequests), response;
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
  function syncFetchingFeatures() {
    poller.sync(), isPullRequestInboxLocation(location) && requiredReviewers.syncInbox(), isBoardLocation(location) && daysInColumn.sync();
  }
  function syncPullRequestFeatures() {
    let pullRequest = parsePullRequestHref(location.pathname, basePath);
    pipelineTab?.sync(pullRequest), starredReviewers?.sync(pullRequest), overviewPipelineIssues?.sync(pullRequest, isTabActive());
  }
  function sync2() {
    pipelineRunFrame?.sync(), syncPullRequestFeatures(), avatarInitials.isOn() && showInitialsOnAvatars(document), requiredReviewers.markAll(), isBoardLocation(location) && daysInColumnToggles.sync(), isTabActive() && syncFetchingFeatures(), reloader.check();
  }
  var settleTimer = null;
  new MutationObserver(() => {
    settleTimer !== null && clearTimeout(settleTimer), settleTimer = setTimeout(sync2, DOM_SETTLE_MS);
  }).observe(document.body, { childList: !0, subtree: !0 });
  setInterval(sync2, TIMER_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    isTabActive() && (poller.sync(), reloader.check({ immediately: !0 }));
  });
  sync2();
  isInFrame || followSystemTheme({ client, document, menu, reload: reloadPage, storage: settingStorage });
})();
