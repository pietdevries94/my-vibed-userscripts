// ==UserScript==
// @name         Fix Azure DevOps
// @namespace    https://github.com/pietdevries94/my-vibed-userscripts
// @version      1.3.0
// @description  Adds missing features to Azure DevOps: pipeline status on pull requests, a Pipeline tab on each pull request with its runs, stages, steps and logs, required reviewers first, avatar initials (a menu setting, on by default), days in column dots on board cards with a toggle per column, and pull request lists and boards that reload on changes.
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
    return { body: await response.json() ?? {}, retryAfterSeconds };
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
  async function getWorkItemUpdates(options, id) {
    let updates = [], retryAfterSeconds = null;
    for (let skip = 0; ; skip += 200) {
      let response = await getJson(
        options,
        `/_apis/wit/workItems/${id}/updates?$top=200&$skip=${skip}&api-version=7.1`
      );
      retryAfterSeconds = response.retryAfterSeconds ?? retryAfterSeconds;
      let page = response.body.value ?? [];
      if (updates.push(...page), page.length < 200)
        return { retryAfterSeconds, updates };
    }
  }
  async function getPullRequestBuilds(options, { project, pullRequestId }) {
    let branchName = encodeURIComponent(`refs/pull/${pullRequestId}/merge`), { body, retryAfterSeconds } = await getJson(
      options,
      `/${encodeURIComponent(project)}/_apis/build/builds?branchName=${branchName}&queryOrder=queueTimeDescending&$top=50&api-version=7.1`
    );
    return { builds: body.value ?? [], retryAfterSeconds };
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
      getPullRequestBuilds: async (project, pullRequestId) => getPullRequestBuilds(options, { project, pullRequestId }),
      async getPullRequests({ project, repository, status }) {
        let { body, retryAfterSeconds } = await getJson(
          options,
          `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullrequests?searchCriteria.status=${status}&$top=200&api-version=7.1`
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
      getWorkItems: async (ids) => getWorkItems(options, ids)
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
    for (let [id, [element]] of cards) {
      let columnId = columnIdOf(element), lastColumnId = tracker.columnIds.get(id), entry = tracker.entries.get(id);
      lastColumnId !== void 0 && lastColumnId !== columnId && entry !== void 0 && (entry.enteredAt = new Date(tracker.now()).toISOString()), tracker.columnIds.set(id, columnId);
    }
  }
  function showBars(tracker, cards) {
    noteMoves(tracker, cards);
    for (let [id, elements] of cards) {
      let entry = tracker.entries.get(id), enteredAt = entry?.enteredAt ?? null, days = null;
      entry !== void 0 && (days = enteredAt === null ? 0 : daysSince(enteredAt, tracker.now()));
      for (let element of elements)
        showDaysInColumn(element, days);
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
      hiddenColumnIds.delete(columnId) || hiddenColumnIds.add(columnId), storage.save([...hiddenColumnIds]), sync2();
    }
    function sync2() {
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
    return { sync: sync2 };
  }

  // azure-devops/src/on-off-setting.ts
  function createOnOffSetting(options) {
    let { key, label, menu, onChange, storage } = options, isOn = storage.get(key, options.defaultValue);
    function showInMenu() {
      menu.register(`${label}: ${isOn ? "on" : "off"}`, flip, key);
    }
    function flip() {
      isOn = !isOn, storage.set(key, isOn), showInMenu(), onChange(isOn);
    }
    return showInMenu(), { isOn: () => isOn };
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

  // azure-devops/src/pipeline-run-frame.ts
  function createPipelineRunFrame(document2) {
    return parsePipelineRunLocation(document2.location) === null ? null : {
      sync: () => {
        document2.documentElement.dataset.fixAdoRunFrame = "";
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

  // azure-devops/src/closest-element.ts
  function isElement(target) {
    return target !== null && "nodeType" in target && target.nodeType === 1;
  }
  function closestElement(target, selector) {
    return isElement(target) ? target.closest(selector) : null;
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
  var NO_STAGE_ID = "";
  function inRunOrder(records) {
    return records.toSorted((first, second) => (first.order ?? 0) - (second.order ?? 0));
  }
  function stageIdOf(record, byId) {
    let parent = record.parentId === null ? void 0 : byId.get(record.parentId);
    for (; parent !== void 0 && parent.type !== "Stage"; )
      parent = parent.parentId === null ? void 0 : byId.get(parent.parentId);
    return parent?.id ?? NO_STAGE_ID;
  }
  function jobOf(job, records) {
    let steps = inRunOrder(
      records.filter((record) => record.type === "Task" && record.parentId === job.id)
    ).map(({ id, name, result, state }) => ({ id, jobId: job.id, name, result, state }));
    return { id: job.id, name: job.name, result: job.result, state: job.state, steps };
  }
  function stagesOf(records) {
    let byId = new Map(records.map((record) => [record.id, record])), jobs = inRunOrder(records.filter((record) => record.type === "Job")), stages = inRunOrder(records.filter((record) => record.type === "Stage"));
    return (stages.length > 0 || jobs.length === 0 ? stages : [{ id: NO_STAGE_ID, name: "Jobs", result: null, state: "" }]).map(({ id, name, result, state }) => ({
      id,
      jobs: jobs.filter((job) => stageIdOf(job, byId) === id).map((job) => jobOf(job, records)),
      name,
      result,
      state
    }));
  }
  function defaultStepOf(stages) {
    let steps = stages.flatMap((stage) => stage.jobs.flatMap((job) => job.steps));
    return steps.find((step) => step.state === "inProgress") ?? steps.find((step) => step.result === "failed") ?? steps[0] ?? null;
  }

  // azure-devops/src/pipeline-tab-tree.ts
  var DEFAULT_STAGE_NAME = "__default", DATE_FORMAT = { dateStyle: "short", timeStyle: "short" }, NAME_CLASS = "fix-ado-pipeline-item-name";
  function textElement(document2, className, text) {
    let element = document2.createElement("span");
    return element.className = className, element.textContent = text, element;
  }
  function createItemText(document2, item) {
    let text = textElement(document2, "fix-ado-pipeline-item-text", "");
    return text.append(textElement(document2, NAME_CLASS, item.name)), item.details !== void 0 && text.append(textElement(document2, "fix-ado-pipeline-item-details", item.details)), text;
  }
  function foldPick(context, level) {
    let { pick } = context;
    return { ...pick, folded: pick.folded === level ? null : level };
  }
  function createItem(context, item) {
    let { document: document2 } = context, button = document2.createElement("button");
    button.type = "button", button.className = `fix-ado-pipeline-item ${item.className}`, button.setAttribute("aria-current", String(item.isCurrent));
    let text = createItemText(document2, item), icon = item.status === null ? [] : [createStatusIcon(document2, item.status.status, item.status.label)];
    return button.append(...icon, text), button.addEventListener("click", () => {
      let { level } = item;
      context.onPick(item.isCurrent && level !== null ? foldPick(context, level) : item.pick);
    }), button;
  }
  function requiredLabel(isRequired) {
    return isRequired ? "Required" : "Optional";
  }
  function runDetails(run) {
    let kind = run.isRequired === null ? `#${run.buildNumber ?? run.buildId}` : requiredLabel(run.isRequired);
    return run.startedAt === null ? kind : `${kind} · ${new Date(run.startedAt).toLocaleString([], DATE_FORMAT)}`;
  }
  function group(document2, className, children) {
    let element = document2.createElement("div");
    return element.className = className, element.append(...children), element;
  }
  function createJobSteps(context, job) {
    let { run, stage, step } = context.shown, steps = job.steps.map(
      (candidate) => createItem(context, {
        className: "fix-ado-pipeline-step",
        isCurrent: candidate.id === step?.id,
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
  var PANEL_CLASS = "fix-ado-pipeline-panel", TREE_SELECTOR = ":scope > .fix-ado-pipeline-tree", FRAME_SELECTOR = ":scope > .fix-ado-pipeline-frame", LOG_NOTE_SELECTOR = ":scope > .fix-ado-pipeline-log-note";
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
  function placeTree(panel, tree) {
    let oldTree = panel.querySelector(TREE_SELECTOR);
    oldTree === null ? panel.prepend(tree) : oldTree.replaceWith(tree);
  }
  function showRun(panel, runs, content) {
    let { shown } = content;
    if (shown === null) {
      message(panel, "This pull request has no pipeline runs.");
      return;
    }
    panel.querySelector(":scope > .fix-ado-pipeline-message")?.remove();
    let tree = createRunTree({
      document: panel.ownerDocument,
      onPick: content.onPick,
      pick: content.pick,
      runs,
      shown
    });
    placeTree(panel, tree), showLog(panel, shown, content);
  }
  function renderKey({ pick, runs, shown }) {
    return JSON.stringify([runs, shown, pick]);
  }
  function renderPanel(panel, content) {
    let key = renderKey(content);
    panel.dataset.fixAdoRendered !== key && (panel.dataset.fixAdoRendered = key, content.runs.kind === "loading" ? message(panel, "Loading pipeline runs…") : content.runs.kind === "failed" ? message(panel, "Could not load the pipeline runs.") : showRun(panel, content.runs.runs, content));
  }
  function createPanel(document2) {
    let panel = document2.createElement("div");
    return panel.className = PANEL_CLASS, panel.setAttribute("role", "tabpanel"), panel;
  }

  // shared/runtime/script-log.ts
  var entries = [];
  function log(message2, data) {
    entries.push(data === void 0 ? { message: message2 } : { data, message: message2 }), entries.length > 500 && entries.shift();
  }

  // azure-devops/src/pipeline-checks.ts
  function pipelineCheckOf(evaluation) {
    let buildId = evaluation.context?.buildId ?? null;
    return evaluation.configuration.type.id !== BUILD_POLICY_TYPE_ID || buildId === null ? null : {
      buildId,
      isRequired: evaluation.configuration.isBlocking,
      name: evaluation.configuration.settings?.displayName ?? evaluation.context?.buildDefinitionName ?? `Run ${buildId}`,
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

  // azure-devops/src/pipeline-runs.ts
  var RESULT_STATUSES2 = {
    canceled: { label: "Canceled", status: "notStarted" },
    failed: { label: "Failed", status: "failed" },
    partiallySucceeded: { label: "Partly succeeded", status: "expired" },
    succeeded: { label: "Succeeded", status: "succeeded" }
  }, PROGRESS_STATUSES = {
    cancelling: { label: "Canceling", status: "running" },
    inProgress: { label: "Running", status: "running" },
    notStarted: { label: "Queued", status: "queued" },
    postponed: { label: "Queued", status: "queued" }
  };
  function buildStatusOf(build) {
    return (build.result === void 0 ? void 0 : RESULT_STATUSES2[build.result]) ?? PROGRESS_STATUSES[build.status] ?? null;
  }
  function runOfBuild(build, check2) {
    return {
      buildId: build.id,
      buildNumber: build.buildNumber,
      isRequired: check2?.isRequired ?? null,
      name: check2?.name ?? build.definition?.name ?? `Run ${build.buildNumber}`,
      startedAt: build.startTime ?? build.queueTime ?? check2?.startedAt ?? null,
      status: check2?.status === null || check2 === void 0 ? buildStatusOf(build) : { status: check2.status }
    };
  }
  function runOfCheck(check2) {
    let status = check2.status === null ? null : { status: check2.status };
    return { ...check2, buildNumber: null, status };
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
  var RUNS_REFRESH_MS = 3e4, RUNNING_TIMELINE_REFRESH_MS = 5e3, NO_PICK = {
    buildId: null,
    folded: null,
    jobId: null,
    stageId: null,
    stepId: null
  };
  function createTabData(pullRequest) {
    return {
      pick: NO_PICK,
      pullRequest,
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
      log("Pipeline tab: runs loaded", { checkCount: checks.length, runCount: builds.length }), data.runs = { kind: "loaded", runs: pipelineRunsOf(checks, builds) };
    } catch {
      data.runs = data.runs.kind === "loaded" ? data.runs : { kind: "failed" };
    }
    onChange();
  }
  async function loadTimeline(loader, buildId) {
    let { data, onChange, sources } = loader;
    data.timelineLoadedAt.set(buildId, sources.now());
    try {
      let records = await sources.getTimeline(data.pullRequest.project, buildId);
      data.stagesByBuildId.set(buildId, stagesOf(records));
    } catch {
    }
    onChange();
  }
  function isTimelineDue(data, shown, now) {
    let loadedAt = data.timelineLoadedAt.get(shown.run.buildId);
    if (loadedAt === void 0)
      return !0;
    let status = shown.run.status?.status;
    return (status === "running" || status === "queued" || (shown.stages ?? []).some((stage) => stage.state !== "completed") || shown.stages === null) && now - loadedAt >= RUNNING_TIMELINE_REFRESH_MS;
  }
  function loadWhatIsDue(loader) {
    let { data, sources } = loader, now = sources.now();
    now - data.runsLoadedAt >= RUNS_REFRESH_MS && loadRuns(loader);
    let shown = shownRunOfData(data);
    shown !== null && isTimelineDue(data, shown, now) && loadTimeline(loader, shown.run.buildId);
  }
  function expireTimeline(data, buildId) {
    data.timelineLoadedAt.delete(buildId);
  }

  // azure-devops/src/pipeline-tab.ts
  var TAB_CLASS = "fix-ado-pipeline-tab", TAB_LABEL = "Pipeline", OPEN_ATTRIBUTE = "data-fix-ado-pipeline-tab-open", PAGE_SELECTOR = ".repos-pr-details-page", TABBAR_SELECTOR = ".repos-pr-details-page-tabbar", CHECKS_PANEL_SELECTOR = ".bolt-panel", RUN_LINK = 'a[href*="/_build/results?"]', RUN_LINK_SELECTOR = `${PAGE_SELECTOR} ${RUN_LINK}, ${CHECKS_PANEL_SELECTOR} ${RUN_LINK}`;
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
  function render(state) {
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
      pick: data.pick,
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
  function update(state) {
    let { data } = state;
    !state.isOpen || data === null || (render(state), loadWhatIsDue({
      data,
      onChange: () => {
        state.data === data && update(state);
      },
      sources: state.options
    }));
  }
  function selectTab(state) {
    let { document: document2 } = state.options, tab = document2.querySelector(`.${TAB_CLASS}`);
    for (let other of document2.querySelectorAll("[role=tablist] [role=tab].selected"))
      other !== tab && (state.replacedTab = other, setSelected(other, !1));
    tab !== null && setSelected(tab, !0);
  }
  function openTab(state, buildId) {
    state.isOpen = !0, buildId !== null && state.data !== null && (state.data.pick = { buildId, folded: null, jobId: null, stageId: null, stepId: null }), selectTab(state), update(state);
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
  function clickedRunBuildId(event, document2) {
    let link = closestElement(event.target, RUN_LINK_SELECTOR), isPlainClick = event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    if (link === null || !isPlainClick || closestElement(event.target, `.${PANEL_CLASS}`) !== null)
      return null;
    let url = new URL(link.getAttribute("href") ?? "", document2.location.href);
    return parsePipelineRunLocation(url)?.buildId ?? null;
  }
  function onClick(state, event) {
    if (state.data === null)
      return;
    let isPipelineTab = closestElement(event.target, `.${TAB_CLASS}`) !== null, runBuildId = clickedRunBuildId(event, state.options.document);
    isPipelineTab || runBuildId !== null ? (event.preventDefault(), event.stopPropagation(), openTab(state, runBuildId), closeChecksPanel(event.target)) : state.isOpen && closestElement(event.target, "[role=tablist] [role=tab]") !== null && closeTab(state);
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

/* The Pipeline tab on a pull request. pipeline-tab.ts sets the attribute while it is open. */
.repos-pr-details-page[data-fix-ado-pipeline-tab-open]
  > :not(.repos-pr-header, .repos-pr-details-page-tabbar, .fix-ado-pipeline-panel) {
  display: none !important;
}

/* The pull request page is a column that fills the window; the panel takes what the
   header and tabs leave, so the log reaches the bottom. */
.fix-ado-pipeline-panel {
  display: flex;
  flex: 1 0 0;
  gap: 16px;
  min-height: 400px;
  padding-top: 16px;
}

.fix-ado-pipeline-tree {
  display: flex;
  flex: 0 0 400px;
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
  flex: 1 1 auto;
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
  }), isTabActive = () => document.visibilityState === "visible", isInFrame = globalThis.top !== globalThis.self, avatarInitials = createOnOffSetting({
    defaultValue: !0,
    key: "avatar-initials",
    label: "Avatar initials",
    menu: {
      // A frame would add a second menu entry. The top page's entry is enough.
      register: (caption, onClick2, id) => {
        isInFrame || GM_registerMenuCommand(caption, onClick2, { id });
      }
    },
    onChange: (isOn) => {
      isOn ? showInitialsOnAvatars(document) : hideInitialsOnAvatars(document);
    },
    storage: {
      get: (key, defaultValue) => GM_getValue(key, defaultValue),
      set: (key, value) => {
        GM_setValue(key, value);
      }
    }
  }), pipelineRunFrame = isInFrame ? createPipelineRunFrame(document) : null, pipelineTab = isInFrame ? null : createPipelineTab({
    apiBasePath: basePath,
    document,
    getEvaluations: async (pullRequest) => {
      let { evaluations } = await client.getPolicyEvaluations(pullRequest);
      return evaluations;
    },
    getPullRequestBuilds: async ({ project, pullRequestId }) => {
      let { builds } = await client.getPullRequestBuilds(project, pullRequestId);
      return builds;
    },
    getTimeline: async (project, buildId) => {
      let { records } = await client.getTimeline(project, buildId);
      return records;
    },
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
  function sync() {
    pipelineRunFrame?.sync(), pipelineTab?.sync(parsePullRequestHref(location.pathname, basePath)), avatarInitials.isOn() && showInitialsOnAvatars(document), requiredReviewers.markAll(), isBoardLocation(location) && daysInColumnToggles.sync(), isTabActive() && syncFetchingFeatures(), reloader.check();
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
