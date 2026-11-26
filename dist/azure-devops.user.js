// ==UserScript==
// @name         Fix Azure DevOps
// @namespace    https://github.com/pietdevries94/my-vibed-userscripts
// @version      1.27.0
// @description  Adds missing features to Azure DevOps. A settings panel in the top bar turns each one on or off and marks new ones. Pull request lists: Pipeline status on each pull request; Required reviewers first; How long ago each active pull request was published, in red after two weekdays; The linked work item's id on each pull request, with a switch that groups the lists by work item; The Assigned to me tabs under each other, as cards that fold on their own, so you scroll through them all; A One line switch on the lists that puts each pull request on one line. Pull request: A Pipeline tab with runs, stages, steps, warnings, errors and logs, and buttons to start, cancel or open a run; A pipeline run page's tabs, such as Code Coverage, as tabs of the pull request; Starred reviewers to add in one click, also on a new pull request; Reviews that post your pending comments in one go, with your vote; A Viewed checkbox on each file in the Files tab, as on GitHub, with viewed files and folders collapsed and buttons to expand or collapse them. Pull request Overview: Each check's warnings and errors above the description, in a box that collapses; Oldest first, with a button to flip the order; A button that scrolls to the bottom; Pushes folded to one line, with a button that shows their commits; Lines that add reviewers joined to one; A chip with each thread's status; Threads that collapse, with buttons that collapse or expand all of them, or only the done ones; Resolved, Won't fix and Closed threads that start collapsed, unless a comment is unread; Unread comments that glow, with buttons to the first and next unread; A New chip that glows on pushes and other changes you have not seen. Boards: Days in column dots on cards, with a toggle per column. Everywhere: Avatar initials; Light or Dark to match the system; Pull request lists and boards that reload on changes; A Windows 98 mode, a work in progress and off by default.
// @match        https://dev.azure.com/*
// @match        https://*.visualstudio.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/pietdevries94/my-vibed-userscripts/main/dist/azure-devops.user.js
// ==/UserScript==
"use strict";
(() => {
  // azure-devops/src/features/category-names.ts
  var CATEGORY_NAMES = [
    "Pull request lists",
    "Pull request",
    "Pull request Overview",
    "Boards",
    "Everywhere"
  ];

  // azure-devops/src/pull-requests/reviewers.ts
  var EMAIL_ADDRESS = /^(?<localPart>[^\s@]+)@[^\s@]+$/u, TRAILING_SIGN_IN_ADDRESS = /\s+<?[^\s<>@]+@[^\s<>@]+>?$/u;
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
  function nameInLabel(label) {
    let localPart = EMAIL_ADDRESS.exec(label.trim())?.groups?.localPart;
    return localPart === void 0 ? personOrTeamName(label.trim().replace(TRAILING_SIGN_IN_ADDRESS, "")) : localPart.replaceAll(/[._-]+/gu, " ");
  }
  function initialsOf(displayName) {
    let name = nameInLabel(displayName), commaIndex = name.indexOf(","), isSurnameFirst = commaIndex !== -1, firstNames = wordsOf(isSurnameFirst ? name.slice(commaIndex + 1) : name), surnameWords = isSurnameFirst ? wordsOf(name.slice(0, commaIndex)) : firstNames.slice(1);
    return [firstNames[0], surnameWords.at(-1)].map((word) => firstCharacter(word)).join("").toUpperCase();
  }
  function hueOf(label) {
    let nameKey = wordsOf(nameInLabel(label).replaceAll(",", " ").toLowerCase()).toSorted().join(" "), hash = 2166136261;
    for (let character of nameKey)
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

  // azure-devops/src/pull-requests/avatars.ts
  var AVATAR_SELECTOR = ".bolt-coin, .vss-Persona:not(.project-persona)";
  function avatarName(avatar) {
    let label = avatar.getAttribute("aria-label") ?? "", imageAlt = avatar.querySelector("img")?.getAttribute("alt") ?? "";
    return (label === "" ? imageAlt : label).trim();
  }
  function markAvatar({ avatar, initials, hue, width }) {
    initials ? avatar.dataset.fixAdoInitials = initials : delete avatar.dataset.fixAdoInitials, avatar.style.setProperty("--fix-ado-hue", hue || null), initials && width > 0 && avatar.style.setProperty("--fix-ado-avatar-size", `${width}px`);
  }
  function outdatedAvatars(root) {
    let marks = [];
    for (let avatar of root.querySelectorAll(AVATAR_SELECTOR)) {
      let name = avatarName(avatar), initials = initialsOf(name), hue = initials ? String(hueOf(name)) : "";
      (avatar.dataset.fixAdoInitials ?? "") === initials && avatar.style.getPropertyValue("--fix-ado-hue") === hue || marks.push({ avatar, hue, initials, width: initials ? avatar.offsetWidth : 0 });
    }
    return marks;
  }
  function showInitialsOnAvatars(root) {
    for (let mark of outdatedAvatars(root))
      markAvatar(mark);
  }

  // azure-devops/src/features/avatar-initials/style.css
  var style_default = `/* Avatars as initials. avatars.ts sets the data attribute, the hue and the size. */
[data-fix-ado-initials] {
  position: relative;
  border-radius: 50%;
  /* OKLCH lightness is the same for every hue, so white initials keep 4.5:1 contrast on each. */
  background: oklch(50% 0.11 var(--fix-ado-hue, 250));
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

/* A text field's prefix pads the avatar on the left, which stretches the circle into an oval.
   Margin keeps the avatar in the same spot. Azure DevOps sets padding-left 4px, margin-left 7px. */
.bolt-textfield .prefix[data-fix-ado-initials] {
  padding-left: 0;
  margin-left: 11px;
}
`;

  // azure-devops/src/features/avatar-initials/index.ts
  var avatarInitials = {
    change: { kind: "new", version: "1.7.2" },
    description: "Initials on avatars, in a colour per person.",
    // The key of the earlier menu setting, so the owner's choice stays.
    id: "avatar-initials",
    name: "Avatar initials",
    start: ({ document: document2 }) => ({
      sync() {
        showInitialsOnAvatars(document2);
      }
    }),
    styles: [style_default]
  };

  // azure-devops/src/core/ado-request.ts
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

  // azure-devops/src/features/system-theme/system-theme.ts
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
    return isFollowedTheme(current) && current !== wanted ? wanted : null;
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

  // azure-devops/src/features/system-theme/index.ts
  var THEME_LOOKS_KEY = "system-theme-looks", SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)", followSystemTheme = {
    change: { kind: "new", version: "1.7.2" },
    description: "Azure DevOps shows Light or Dark to match the system.",
    // The key of the earlier menu setting, so the owner's choice stays.
    id: "follow-system-theme",
    name: "Follow system theme",
    start({ client, document: document2, isInFrame: isInFrame2, reloadWhenIdle: reloadWhenIdle2 }) {
      if (isInFrame2)
        return null;
      let systemDark = globalThis.matchMedia(SYSTEM_DARK_QUERY), theme = createSystemTheme({
        document: document2,
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
        reload: reloadWhenIdle2,
        saveTheme: async (themeId) => client.saveTheme(themeId)
      });
      return new MutationObserver(() => {
        theme.onPageChange();
      }).observe(document2.body, { attributeFilter: ["class", "data-theme"], attributes: !0 }), theme.start(), null;
    },
    styles: []
  };

  // azure-devops/src/boards/board.ts
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
  function watchBoard(client, location2, cardIds) {
    return {
      // Cards render as the user scrolls, and the user adds cards. Start comparing those too.
      extendLoaded: (loaded, current) => ({
        myUserId: current.myUserId,
        workItems: new Map([...current.workItems, ...loaded.workItems])
      }),
      async fetchSnapshot() {
        let [{ workItems, retryAfterSeconds }, myUserId] = await Promise.all([
          client.getWorkItems(cardIds),
          client.getAuthenticatedUserId()
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

  // azure-devops/src/pull-requests/assigned-pull-request-requests.ts
  var MAX_ASSIGNED_PULL_REQUESTS = 200;
  function pullRequestsPath(repository) {
    return repository === null ? "/_apis/git/pullrequests" : `/${encodeURIComponent(repository.project)}/_apis/git/repositories/${encodeURIComponent(repository.repository)}/pullrequests`;
  }
  function createAssignedPullRequestRequests(options) {
    return {
      async getPullRequestsAssignedTo(reviewerId, repository) {
        let { body, retryAfterSeconds } = await getJson(
          options,
          `${pullRequestsPath(repository)}?searchCriteria.reviewerId=${encodeURIComponent(reviewerId)}&searchCriteria.status=active&$top=${MAX_ASSIGNED_PULL_REQUESTS}&api-version=7.1`
        );
        return { pullRequests: body.value, retryAfterSeconds };
      }
    };
  }

  // azure-devops/src/pipeline/build-requests.ts
  var MAX_PULL_REQUEST_BUILDS = 50;
  async function getPullRequestBuilds(options, { project, pullRequestId }) {
    let branchName = encodeURIComponent(`refs/pull/${pullRequestId}/merge`), { body, retryAfterSeconds } = await getJson(
      options,
      `/${encodeURIComponent(project)}/_apis/build/builds?branchName=${branchName}&queryOrder=queueTimeDescending&$top=${MAX_PULL_REQUEST_BUILDS}&api-version=7.1`
    );
    return { builds: body.value ?? [], retryAfterSeconds };
  }
  function isBuildPipeline(value) {
    return typeof value == "object" && value !== null && "id" in value && typeof value.id == "number" && "name" in value && typeof value.name == "string";
  }
  async function getBuildPipeline(options, project, buildId) {
    let body = await (await sendRequest(
      options,
      `/${encodeURIComponent(project)}/_apis/build/builds/${buildId}?api-version=7.1`
    )).json(), definition = typeof body == "object" && body !== null && "definition" in body ? body.definition : null;
    if (!isBuildPipeline(definition))
      throw new Error(`Run ${buildId} has no pipeline in Azure DevOps's answer`);
    return { id: definition.id, name: definition.name };
  }
  function createBuildRequests(options) {
    return {
      getBuildPipeline: async (project, buildId) => getBuildPipeline(options, project, buildId),
      getPullRequestBuilds: async (project, pullRequestId) => getPullRequestBuilds(options, { project, pullRequestId })
    };
  }

  // azure-devops/src/pull-requests/review-requests.ts
  var API_VERSION = "api-version=7.1", CHANGES_PER_REQUEST = 500, ACTIVE_THREAD_STATUS = 1, TEXT_COMMENT_TYPE = 1;
  function pullRequestPath({ project, repository, pullRequestId }) {
    return `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullRequests/${pullRequestId}`;
  }
  async function getPullRequest(options, pullRequest) {
    return await (await sendRequest(options, `${pullRequestPath(pullRequest)}?${API_VERSION}`)).json();
  }
  function pageAfter({ nextSkip, nextTop }) {
    return nextSkip !== void 0 && nextSkip > 0 ? { skip: nextSkip, top: nextTop ?? CHANGES_PER_REQUEST } : null;
  }
  async function getIterationChanges(options, pullRequest, iteration) {
    let changes = [], next = { skip: 0, top: CHANGES_PER_REQUEST };
    for (; next !== null; ) {
      let body = await (await sendRequest(
        options,
        `${pullRequestPath(pullRequest)}/iterations/${iteration}/changes?$top=${next.top}&$skip=${next.skip}&${API_VERSION}`
      )).json(), page = body.changeEntries ?? [];
      changes.push(...page), next = page.length === 0 ? null : pageAfter(body);
    }
    return changes;
  }
  function threadBody({ content, iteration, threadContext }) {
    return {
      comments: [{ commentType: TEXT_COMMENT_TYPE, content, parentCommentId: 0 }],
      status: ACTIVE_THREAD_STATUS,
      ...threadContext === void 0 ? {} : { threadContext },
      ...iteration === void 0 ? {} : {
        pullRequestThreadContext: {
          changeTrackingId: iteration.changeTrackingId,
          iterationContext: {
            firstComparingIteration: iteration.id,
            secondComparingIteration: iteration.id
          }
        }
      }
    };
  }
  async function createPullRequestThread(options, pullRequest, thread) {
    return (await (await sendRequest(
      options,
      `${pullRequestPath(pullRequest)}/threads?${API_VERSION}`,
      { body: threadBody(thread), method: "POST" }
    )).json()).id;
  }
  function createReviewRequests(options) {
    return {
      createPullRequestThread: async (pullRequest, thread) => createPullRequestThread(options, pullRequest, thread),
      getIterationChanges: async (pullRequest, iteration) => getIterationChanges(options, pullRequest, iteration),
      getPullRequestCreationDate: async (pullRequest) => getPullRequest(options, pullRequest).then(({ creationDate }) => creationDate ?? ""),
      async getPullRequestIterationIds(pullRequest) {
        let { body } = await getJson(
          options,
          `${pullRequestPath(pullRequest)}/iterations?${API_VERSION}`
        );
        return (body.value ?? []).map(({ id }) => id);
      },
      getPullRequestStatus: async (pullRequest) => getPullRequest(options, pullRequest).then(({ status }) => status ?? ""),
      async getPullRequestThreads(pullRequest) {
        let { body } = await getJson(
          options,
          `${pullRequestPath(pullRequest)}/threads?${API_VERSION}`
        );
        return body.value ?? [];
      },
      async setPullRequestVote(pullRequest, { reviewerId, vote }) {
        await sendRequest(
          options,
          `${pullRequestPath(pullRequest)}/reviewers/${encodeURIComponent(reviewerId)}?${API_VERSION}`,
          { body: { vote }, method: "PUT" }
        );
      }
    };
  }

  // azure-devops/src/pull-requests/reviewer-requests.ts
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

  // azure-devops/src/core/work-item-requests.ts
  var MAX_WORK_ITEMS_PER_REQUEST = 200, MAX_UPDATES_PER_REQUEST = 200;
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
  async function getPullRequestWorkItemIds(options, { project, repository, pullRequestId }) {
    let { body } = await getJson(
      options,
      `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}/pullRequests/${pullRequestId}/workitems?api-version=7.1`
    );
    return (body.value ?? []).map(({ id }) => Number(id));
  }
  async function getWorkItemTitle(options, id) {
    let { body } = await getJson(
      options,
      `/_apis/wit/workitems?ids=${id}&fields=System.Title&errorPolicy=Omit&api-version=7.1`
    ), [workItem] = body.value ?? [];
    return workItem?.fields?.["System.Title"] ?? null;
  }
  function createWorkItemRequests(options) {
    return {
      getPullRequestWorkItemIds: async (pullRequest) => getPullRequestWorkItemIds(options, pullRequest),
      getWorkItemTitle: async (id) => getWorkItemTitle(options, id),
      getWorkItemUpdates: async (id) => getWorkItemUpdates(options, id),
      getWorkItems: async (ids) => getWorkItems(options, ids)
    };
  }

  // azure-devops/src/core/ado-client.ts
  var MAX_LISTED_PULL_REQUESTS = 200, THEME_SETTING_KEY = "WebPlatform/Theme";
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
  function createAdoClient(options) {
    let getProjectId = createProjectIdCache(options), authenticatedUserIdRequest = null;
    return {
      cancelBuild: async (project, buildId) => cancelBuild(options, project, buildId),
      async getAuthenticatedUserId() {
        return authenticatedUserIdRequest ??= getJson(options, "/_apis/connectionData").then(({ body }) => body.authenticatedUser?.id ?? null).catch(() => null), authenticatedUserIdRequest;
      },
      getPolicyEvaluations: async (pullRequest) => getPolicyEvaluations(options, await getProjectId(pullRequest.project), pullRequest),
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
      requeuePolicyEvaluation: async (project, evaluationId) => requeuePolicyEvaluation(options, await getProjectId(project), evaluationId),
      saveTheme: async (themeId) => saveTheme(options, themeId),
      ...createAssignedPullRequestRequests(options),
      ...createBuildRequests(options),
      ...createReviewRequests(options),
      ...createWorkItemRequests(options),
      ...createReviewerRequests(options)
    };
  }

  // azure-devops/src/features/reload-on-changes/page-reloader.ts
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

  // azure-devops/src/pipeline/pipeline-status-icon.ts
  var PIPELINE_STATUS_ICON_CLASS = "fix-ado-pipeline-status", SVG_NAMESPACE = "http://www.w3.org/2000/svg", LABELS = {
    cancelling: "Pipeline cancelling",
    expired: "Pipeline result expired",
    failed: "Pipeline failed",
    loading: "Pipeline status loading",
    none: "No pipeline status",
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
    loading: [DISC],
    none: [DISC],
    notStarted: [RING],
    queued: [RING, line("M8 4.5V8l2.5 1.5", "currentColor")],
    running: [SPINNER],
    succeeded: [DISC, line("M4.5 8.3l2.3 2.3 4.7-5", "#fff")]
  };
  function setAttributes(element4, attributes) {
    for (let [name, value] of Object.entries(attributes))
      element4.setAttribute(name, value);
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

  // azure-devops/src/pull-requests/pull-request-link.ts
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
  function isPullRequestCreateLocation(location2) {
    let segments = pathSegments(location2.pathname);
    return segments.at(-1) === "pullrequestcreate" && segments.at(-3) === "_git";
  }

  // azure-devops/src/pull-requests/pr-list.ts
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
    if (shownIcon?.dataset.status === status && shownIcon.dataset.pullRequestId === String(pullRequestId))
      return;
    shownIcon?.remove(), row.querySelector(TITLE_LINE_SELECTOR)?.firstElementChild?.after(createPipelineStatusIcon(row.ownerDocument, status, pullRequestId));
  }
  var DRAFT_PILL_SELECTOR = ".repos-pr-list-draft-pill", UPDATE_TIME_SELECTOR = "time.bolt-time-item", PUBLISHED_SINCE_CLASS = "fix-ado-published-since", TOO_LONG_AGO_CLASS = "fix-ado-published-since-too-long";
  function isDraftRow(row) {
    return row.querySelector(DRAFT_PILL_SELECTOR) !== null;
  }
  function publishedSinceLine(row) {
    let shown = row.querySelector(`.${PUBLISHED_SINCE_CLASS}`);
    if (shown)
      return shown;
    let updateLine = row.querySelector(UPDATE_TIME_SELECTOR)?.closest(".bolt-table-cell-content > *");
    if (!updateLine)
      return null;
    let line2 = row.ownerDocument.createElement("div");
    return line2.className = PUBLISHED_SINCE_CLASS, updateLine.after(line2), line2;
  }
  function showPublishedSince(row, shown) {
    if (shown === null) {
      row.querySelector(`.${PUBLISHED_SINCE_CLASS}`)?.remove();
      return;
    }
    let line2 = publishedSinceLine(row);
    line2 && (line2.textContent !== shown.text && (line2.textContent = shown.text), line2.classList.contains(TOO_LONG_AGO_CLASS) !== shown.isTooLongAgo && line2.classList.toggle(TOO_LONG_AGO_CLASS, shown.isTooLongAgo));
  }
  var LINE_UNDER_TITLE_SELECTOR = `${TITLE_LINE_SELECTOR}:nth-child(2) .secondary-text`, LINKED_WORK_ITEM_CLASS = "fix-ado-linked-work-item";
  function linkedWorkItemElement(row) {
    let shown = row.querySelector(`.${LINKED_WORK_ITEM_CLASS}`), lineUnderTitle = row.querySelector(LINE_UNDER_TITLE_SELECTOR);
    if (shown !== null || lineUnderTitle === null)
      return shown;
    let label = row.ownerDocument.createElement("span");
    return label.className = LINKED_WORK_ITEM_CLASS, lineUnderTitle.append(label), label;
  }
  function showTooltip(element4, tooltip) {
    tooltip === null ? element4.removeAttribute("title") : element4.getAttribute("title") !== tooltip && element4.setAttribute("title", tooltip);
  }
  function showLinkedWorkItem(row, shown) {
    if (shown === null) {
      row.querySelector(`.${LINKED_WORK_ITEM_CLASS}`)?.remove();
      return;
    }
    let label = linkedWorkItemElement(row);
    label !== null && (label.textContent !== shown.text && (label.textContent = shown.text), showTooltip(label, shown.tooltip));
  }
  var REVIEWER_SELECTOR = ".pr-reviewer";
  function markRequiredReviewers(row, reviewers) {
    for (let reviewerElement of row.querySelectorAll(REVIEWER_SELECTOR)) {
      let avatar = reviewerElement.querySelector(AVATAR_SELECTOR), reviewer = avatar ? findReviewerByLabel(avatarName(avatar), reviewers) : null;
      reviewerElement.toggleAttribute("data-fix-ado-required", reviewer?.isRequired ?? !1), reviewerElement.parentElement?.toggleAttribute("data-fix-ado-reviewers", !0);
    }
  }

  // azure-devops/src/features/reload-on-changes/pr-list-changes.ts
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

  // azure-devops/src/features/reload-on-changes/pr-list-watch.ts
  function watchPullRequestList(client, listPage, onScreenPullRequestIds) {
    return {
      async fetchSnapshot() {
        let { pullRequests, retryAfterSeconds } = await client.getPullRequests(listPage);
        return { retryAfterSeconds, snapshot: snapshotOf(pullRequests) };
      },
      hasChanged: (loaded, current) => hasListChanged(loaded, current, onScreenPullRequestIds()),
      key: `pull-request-list:${JSON.stringify(listPage)}`
    };
  }

  // azure-devops/src/features/reload-on-changes/index.ts
  var reloadOnChanges = {
    change: { kind: "new", version: "1.7.2" },
    description: "Pull request lists and boards reload when their content changes on the server.",
    id: "reload-on-changes",
    name: "Reload on changes",
    start({ basePath: basePath2, client, document: document2, now, reloadWhenIdle: reloadWhenIdle2 }) {
      let shownPage = { kind: "other" };
      function watchedPage() {
        if (shownPage.kind === "pull-request-list")
          return watchPullRequestList(
            client,
            shownPage.listPage,
            () => findPullRequestRows(document2, basePath2).map(
              ({ pullRequest }) => pullRequest.pullRequestId
            )
          );
        if (shownPage.kind === "board") {
          let cardIds = findBoardCardIds(document2);
          return cardIds.length > 0 ? watchBoard(client, location, cardIds) : null;
        }
        return null;
      }
      let isTabActive2 = !1, reloader = createPageReloader({
        currentPage: watchedPage,
        isTabActive: () => isTabActive2,
        now,
        reload: reloadWhenIdle2
      });
      return {
        sync(tick) {
          shownPage = tick.page, { isTabActive: isTabActive2 } = tick, reloader.check({ immediately: tick.reason === "tab-shown" });
        }
      };
    },
    styles: []
  };

  // azure-devops/src/pipeline/pipeline-run-link.ts
  var RUN_PATH_END = "/_build/results";
  function parsePipelineRunLocation(location2) {
    let query = new URLSearchParams(location2.search), buildId = Number(query.get("buildId") ?? Number.NaN);
    if (!location2.pathname.endsWith(RUN_PATH_END) || !Number.isInteger(buildId))
      return null;
    let jobId = query.get("j"), stepId = query.get("t");
    return query.get("view") !== "logs" ? { buildId, jobId: null, stepId: null, view: "summary" } : jobId !== null && stepId !== null ? { buildId, jobId, stepId, view: "log" } : { buildId, jobId: null, stepId: null, view: "steps" };
  }
  function pipelineRunTabViewOf(location2) {
    let view = new URLSearchParams(location2.search).get("view");
    return view === null || view === "" || view === "logs" ? null : view;
  }
  function pipelineRunPath(apiBasePath2, project, buildId) {
    return `${apiBasePath2}/${encodeURIComponent(project)}${RUN_PATH_END}?buildId=${buildId}`;
  }
  function pipelineLogPath(apiBasePath2, project, { buildId, jobId, stepId }) {
    let step = `j=${encodeURIComponent(jobId)}&t=${encodeURIComponent(stepId)}`;
    return `${pipelineRunPath(apiBasePath2, project, buildId)}&view=logs&${step}`;
  }

  // azure-devops/src/features/windows-98-mode/windows-98-mode.ts
  var WORK_ITEM_PATH = /\/_workitems\/edit\/\d+\/?$/u, TOP_BAR_SELECTOR = ".project-header, .top-level-header";
  function windows98PageOf(page, location2) {
    return page.kind !== "other" ? page.kind : parsePipelineRunLocation(location2) ? "pipeline-run" : WORK_ITEM_PATH.test(location2.pathname) ? "work-item" : null;
  }
  function createWindows98Mode(document2) {
    let root = document2.documentElement;
    return {
      sync(page, location2) {
        let windows98Page = windows98PageOf(page, location2) ?? "";
        root.dataset.fixAdoWin98 !== windows98Page && (root.dataset.fixAdoWin98 = windows98Page);
        let topBar = document2.querySelector(TOP_BAR_SELECTOR);
        topBar && topBar.dataset.fixAdoWindowTitle !== document2.title && (topBar.dataset.fixAdoWindowTitle = document2.title);
      }
    };
  }

  // azure-devops/src/features/windows-98-mode/style.css
  var style_default2 = `/* Windows 98 mode. windows-98-mode.ts marks <html> with data-fix-ado-win98: the captured page
   it shows, or empty on any other page. The top bar, side bar, menus and dialogs get the look
   on every page; page content only on captured pages, whose markup is known. */

/* Azure DevOps's theme variables, as Windows 98. Light and Dark both get them, so the dark
   palette is set back to light values. On a captured page they apply to all of it; elsewhere
   only to the top bar, side bar, menus and dialogs. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body,
html[data-fix-ado-win98]
  :is(
    .project-header,
    .top-level-header,
    .navigation-container,
    .bolt-portal-host,
    .fix-ado-settings
  ) {
  --palette-neutral-0: 255, 255, 255 !important;
  /* The lightest grey paints sticky tab bars and headers: the window face, so no strip shows. */
  --palette-neutral-2: 192, 192, 192 !important;
  --palette-neutral-4: 232, 232, 232 !important;
  --palette-neutral-6: 223, 223, 223 !important;
  --palette-neutral-8: 210, 210, 210 !important;
  --palette-neutral-10: 192, 192, 192 !important;
  --palette-neutral-20: 160, 160, 160 !important;
  --palette-neutral-30: 128, 128, 128 !important;
  --palette-neutral-60: 96, 96, 96 !important;
  --palette-neutral-70: 64, 64, 64 !important;
  --palette-neutral-80: 32, 32, 32 !important;
  --palette-neutral-100: 0, 0, 0 !important;
  --palette-black-alpha-0: rgba(0, 0, 0, 0) !important;
  --palette-black-alpha-2: rgba(0, 0, 0, 0.02) !important;
  --palette-black-alpha-4: rgba(0, 0, 0, 0.04) !important;
  --palette-black-alpha-6: rgba(0, 0, 0, 0.06) !important;
  --palette-black-alpha-8: rgba(0, 0, 0, 0.08) !important;
  --palette-black-alpha-10: rgba(0, 0, 0, 0.1) !important;
  --palette-black-alpha-20: rgba(0, 0, 0, 0.2) !important;
  --palette-black-alpha-30: rgba(0, 0, 0, 0.3) !important;
  --palette-black-alpha-60: rgba(0, 0, 0, 0.6) !important;
  --palette-black-alpha-70: rgba(0, 0, 0, 0.7) !important;
  --palette-black-alpha-80: rgba(0, 0, 0, 0.8) !important;
  --palette-black-alpha-100: rgba(0, 0, 0, 1) !important;
  --palette-primary: 0, 0, 128 !important;
  --palette-primary-darken-6: rgba(0, 0, 128, 1) !important;
  --palette-primary-darken-10: rgba(0, 0, 128, 1) !important;
  --palette-primary-darkened-6: 0, 0, 128 !important;
  --palette-primary-darkened-10: 0, 0, 96 !important;
  --palette-primary-shade-10: 0, 0, 128 !important;
  --palette-primary-shade-20: 0, 0, 128 !important;
  --palette-primary-shade-30: 0, 0, 96 !important;
  --palette-primary-tint-10: 16, 132, 208 !important;
  --palette-primary-tint-20: 192, 192, 255 !important;
  --palette-primary-tint-30: 208, 208, 255 !important;
  --palette-primary-tint-40: 232, 232, 255 !important;
  --palette-accent1: 192, 0, 0 !important;
  --palette-accent1-light: 255, 224, 224 !important;
  --palette-accent1-dark: 128, 0, 0 !important;
  --palette-accent2: 0, 128, 0 !important;
  --palette-accent2-light: 224, 255, 224 !important;
  --palette-accent2-dark: 0, 96, 0 !important;
  --palette-accent3: 160, 112, 0 !important;
  --palette-accent3-light: 255, 255, 225 !important;
  --palette-accent3-dark: 112, 80, 0 !important;
  --palette-error: rgba(192, 0, 0, 1) !important;
  --palette-error-6: rgba(160, 0, 0, 1) !important;
  --palette-error-10: rgba(128, 0, 0, 1) !important;
  --background-color: var(--win98-face) !important;
  --border-subtle-color: var(--win98-shadow) !important;
  --callout-background-color: var(--win98-face) !important;
  --callout-filtered-background-color: var(--win98-face) !important;
  --callout-shadow-color: transparent !important;
  --callout-shadow-secondary-color: transparent !important;
  --panel-shadow-color: transparent !important;
  --panel-shadow-secondary-color: transparent !important;
  --communication-background: var(--win98-navy) !important;
  --communication-foreground: var(--win98-navy) !important;
  --text-on-communication-background: #fff !important;
  --focus-border-color: #000 !important;
  --focus-pulse-max-color: transparent !important;
  --focus-pulse-min-color: transparent !important;
  --text-primary-color: #000 !important;
  --text-secondary-color: #404040 !important;
  --text-disabled-color: var(--win98-shadow) !important;
  --nav-header-background: var(--win98-face) !important;
  --nav-header-active-item-background: transparent !important;
  --nav-header-item-hover-background: transparent !important;
  --nav-header-product-color: #000 !important;
  --nav-header-text-primary-color: #000 !important;
  --nav-header-text-secondary-color: #404040 !important;
  --nav-header-text-disabled-color: var(--win98-shadow) !important;
  --nav-vertical-background-color: var(--win98-face) !important;
  --nav-vertical-active-group-background: transparent !important;
  --nav-vertical-active-item-background: var(--win98-navy) !important;
  --nav-vertical-item-hover-background: var(--win98-navy) !important;
  --nav-vertical-text-primary-color: #000 !important;
  --nav-vertical-text-secondary-color: #404040 !important;
  --component-grid-row-hover-color: transparent !important;
  --component-grid-selected-row-color: var(--win98-navy) !important;
  --component-grid-focus-border-color: #000 !important;
  --component-grid-cell-bottom-border-color: transparent !important;
  --component-grid-action-hover-color: var(--win98-face) !important;
  --component-menu-selected-item-background: var(--win98-navy) !important;
  --component-label-default-color: var(--win98-face) !important;
  --component-label-default-color-hover: var(--win98-light) !important;
  --component-htmlEditor-background-color: #fff !important;
  --component-htmlEditor-foreground-color: #000 !important;
  --component-status-error: #c00000 !important;
  --component-status-success: #008000 !important;
  --component-status-warning: #a07000 !important;
  --component-status-info: var(--win98-navy) !important;
  --component-status-neutral: var(--win98-shadow) !important;
  --status-error-foreground: #c00000 !important;
  --status-error-text: #a00000 !important;
  --status-error-strong: #800000 !important;
  --status-error-background: #ffe0e0 !important;
  --status-success-foreground: #008000 !important;
  --status-success-text: #006000 !important;
  --status-success-background: #e0ffe0 !important;
  --status-warning-foreground: #a07000 !important;
  --status-warning-text: #705000 !important;
  --status-warning-icon-foreground: #a07000 !important;
  --status-warning-background: var(--win98-tooltip) !important;
  --status-info-foreground: var(--win98-navy) !important;
  --status-info-background: #e8e8ff !important;
  --splitter-border-color: var(--win98-shadow) !important;
  --diff-color-original: rgba(255, 0, 0, 0.18) !important;
  --diff-color-modified: rgba(0, 160, 0, 0.18) !important;
  --icon-folder-color: #e0c000 !important;
  --search-match-background: #ffff00 !important;
  --search-selected-match-background: var(--win98-navy) !important;

  color-scheme: light;
  accent-color: var(--win98-navy);
  font-family: var(--win98-font);
  -webkit-font-smoothing: none;
  scrollbar-color: #767676 var(--win98-light);
}

/* ===== Top bar: a title bar with the page title, then an Address bar ===== */

html[data-fix-ado-win98] :is(.project-header, .top-level-header) {
  position: relative;
  padding-top: 22px;
  background: var(--win98-face);
  box-shadow: inset 0 -1px var(--win98-shadow);
  color: #000;

  &::before {
    content: attr(data-fix-ado-window-title) / "";
    position: absolute;
    top: 2px;
    left: 2px;
    right: 2px;
    height: 18px;
    padding: 0 58px 0 21px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: #fff;
    font: 700 11px/18px var(--win98-font);
    /* The icon, the minimise, maximise and close buttons, and the title gradient. */
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 18 18' shape-rendering='crispEdges'%3E%3Crect x='1' y='2' width='16' height='11' fill='%23c0c0c0' stroke='%23000'/%3E%3Crect x='3' y='4' width='12' height='7' fill='%23008080'/%3E%3Crect x='6' y='13' width='6' height='2' fill='%23808080'/%3E%3Crect x='4' y='15' width='10' height='2' fill='%23c0c0c0' stroke='%23000'/%3E%3C/svg%3E")
        3px center / 14px no-repeat,
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='14' shape-rendering='crispEdges'%3E%3Cdefs%3E%3Cg id='b'%3E%3Crect width='16' height='14' fill='%23c0c0c0'/%3E%3Cpath d='M0 0h15v1H1v12H0z' fill='%23fff'/%3E%3Cpath d='M15 0h1v14H0v-1h15z' fill='%230a0a0a'/%3E%3Cpath d='M1 1h13v1H2v10H1z' fill='%23dfdfdf'/%3E%3Cpath d='M14 1h1v12H1v-1h13z' fill='%23808080'/%3E%3C/g%3E%3C/defs%3E%3Cuse href='%23b'/%3E%3Cuse href='%23b' x='16'/%3E%3Cuse href='%23b' x='34'/%3E%3Crect x='4' y='9' width='6' height='2'/%3E%3Cpath d='M19 2h9v9h-9zM20 4v6h7V4z' fill-rule='evenodd'/%3E%3Cpath d='M38 3h2l2 2 2-2h2l-3 3.5 3 3.5h-2l-2-2-2 2h-2l3-3.5z'/%3E%3C/svg%3E")
        right 2px center / 50px 14px no-repeat,
      var(--win98-title);
    pointer-events: none;
  }

  :is(.region-header, .region-header-menubar) {
    height: 28px;
    min-height: 28px;
    background: transparent;
    box-shadow: none;
    color: #000;
    font-family: var(--win98-font);
    font-size: 11px;
  }

  :is(.region-header, .region-header-menubar) > * {
    height: 28px;
    min-height: 0;
  }

  /* The logo becomes the Address label. */
  .suite-logo {
    color: #000;
    padding: 0 4px 0 6px;

    & > * {
      display: none;
    }

    &::after {
      content: "Address";
    }
  }

  .region-header > .bolt-breadcrumb-with-items {
    align-self: center;
    height: 22px;
    margin: 0 6px 0 2px;
    padding: 0 4px;
    background: #fff;
    box-shadow: var(--win98-sunken);
    align-items: center;
  }

  .bolt-breadcrumb-item-text,
  .bolt-breadcrumb-item a {
    color: #000;
    font-weight: 400;
    font-size: 11px;
  }

  .bolt-breadcrumb-divider {
    width: auto;
    padding: 0 1px;
    color: #000;
    font-size: 0;

    & > * {
      display: none;
    }

    &::before {
      content: "\\\\";
      font-size: 11px;
    }
  }

  .bolt-breadcrumb .bolt-button {
    min-height: 0;
    padding: 0 2px;
    background: transparent;
    box-shadow: none;
    font-weight: 400;
  }

  .search {
    width: 200px;
    height: 21px;
    border: 0;
    border-radius: 0;
    background: #fff;
    box-shadow: var(--win98-sunken);
    color: #000;
  }

  .expandable-search-header {
    padding: 3px 0;
  }
}

/* ===== Side bar: a Start menu pane with a banner ===== */

html[data-fix-ado-win98] .navigation-container {
  background: var(--win98-face);
  box-shadow: var(--win98-raised);
  font-size: 11px;

  .project-navigation {
    position: relative;
    background: transparent;
    border-right: 0;
    color: #000;

    &.expanded {
      /* 220px with its banner, as in the design. */
      width: 220px;
      padding-left: 22px;

      /* The banner: a gradient strip, and on it a box as long as its text, turned to read
         upwards, 8px from the bottom. */
      &::after {
        content: "";
        position: absolute;
        top: 2px;
        bottom: 2px;
        left: 2px;
        width: 22px;
        background: linear-gradient(180deg, var(--win98-navy), var(--win98-title-end));
      }

      &::before {
        content: "Azure DevOps 98" / "";
        position: absolute;
        z-index: 1;
        bottom: 10px;
        left: 6px;
        width: 14px;
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        color: #fff;
        font: 700 16px/14px var(--win98-font);
        white-space: nowrap;
      }
    }

    .separator {
      height: 2px;
      background: transparent;
      border-top: 1px solid var(--win98-shadow);
      border-bottom: 1px solid #fff;
    }
  }

  /* Items 24px and sub items 20px tall, with 16px icons, as in the design. */
  .navigation-element {
    height: 24px;
    min-height: 0;
    color: #000;

    &.hub:not(.hub-group, .stand-alone) {
      height: 20px;
    }
  }

  .navigation-icon {
    width: 32px;
    padding: 0;
  }

  .contributed-icon-image {
    width: 16px;
    height: 16px;
  }

  .navigation-element {
    &:hover,
    &.displayed.hub,
    &.displayed:not(:has(~ [role="menu"])) {
      background: var(--win98-navy);
      color: #fff;

      .navigation-text,
      .contributed-icon {
        color: #fff;
      }
    }
  }

  .hub-group-container.expanded-container {
    background: transparent;
  }

  .navigation-text {
    font-size: 11px;
  }
}

/* The organization side bar, on organization pages such as the pull request inbox, as in the
   PullRequestsInbox artboard: the project side bar's Start menu pane with its banner. */
html[data-fix-ado-win98] .top-level-navigation {
  position: relative;
  box-sizing: border-box;
  width: 220px;
  min-width: 220px;
  padding: 2px 2px 2px 24px;
  border: 0;
  background: var(--win98-face);
  box-shadow: var(--win98-raised);
  color: #000;
  font-size: 11px;

  &::after {
    content: "";
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 2px;
    width: 22px;
    background: linear-gradient(180deg, var(--win98-navy), var(--win98-title-end));
  }

  &::before {
    content: "Azure DevOps 98" / "";
    position: absolute;
    z-index: 1;
    bottom: 10px;
    left: 6px;
    width: 14px;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    color: #fff;
    font: 700 16px/14px var(--win98-font);
    white-space: nowrap;
  }

  .top-level-section {
    padding: 4px 2px 0 4px;
  }

  /* Items 24px, the organization 34px with its persona; the shown one and the hovered one navy. */
  /* The class three times outweighs the page's blue for links: these are menu items. */
  .top-navigation-item.top-navigation-item.top-navigation-item {
    align-items: center;
    gap: 8px;
    height: 24px;
    min-height: 0;
    margin: 0;
    padding: 0 6px;
    border: 0;
    background: transparent;
    color: #000;
    font-size: 11px;
    text-decoration: none;

    &.host-link {
      height: 34px;
    }

    &::before,
    &::after {
      display: none;
    }

    &:is(.displayed, :hover, :focus) {
      background: var(--win98-navy);
      color: #fff;
    }

    .vss-Persona,
    .fluent-icons-enabled,
    .fluent-icons-enabled > * {
      flex: none;
      margin: 0;
    }

    .fluent-icons-enabled {
      width: 16px;
    }
  }

  /* An etched line under the organizations, and one above the footer. */
  .action-section,
  .navigation-footer {
    margin: 3px 0 0;
    padding: 5px 0 0;
    border: 0;
    box-shadow:
      inset 0 1px var(--win98-shadow),
      inset 0 2px #fff;
  }

  .action-section {
    margin-top: 3px;
  }

  .navigation-footer {
    padding: 5px 2px 4px 4px;
  }
}

/* ===== Everywhere the look applies: controls ===== */

html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body,
html[data-fix-ado-win98]
  :is(
    .project-header,
    .top-level-header,
    .navigation-container,
    .bolt-portal-host,
    .fix-ado-settings
  ) {
  .body-s,
  .body-m,
  .body-l,
  .bolt-button,
  .bolt-tab,
  .bolt-textfield-input,
  .bolt-list,
  .bolt-table {
    font-family: var(--win98-font);
    font-size: 11px;
  }

  /* Push buttons. */
  .bolt-button,
  .bolt-split-button-main,
  .bolt-split-button-option {
    /* 23px tall, as in the design; text buttons at least 75px wide. */
    height: 23px;
    min-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    border: 0;
    border-radius: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
    color: #000;
    font-weight: 400;

    &:not(.icon-only, .subtle, .bolt-split-button-option, .bolt-split-button-main) {
      min-width: 75px;
    }

    &.primary.disabled,
    &.primary:disabled {
      background: var(--win98-face);
      color: var(--win98-shadow);
      text-shadow: 1px 1px #fff;
    }

    &:hover {
      background: var(--win98-face);
    }

    &:active,
    &.active,
    &[aria-pressed="true"],
    &[aria-expanded="true"] {
      background: var(--win98-face);
      box-shadow: var(--win98-pressed);
    }

    &.primary {
      background: var(--win98-face);
      box-shadow: var(--win98-default);
      color: #000;
    }

    /* Disabled: the normal bevel, embossed grey text, at full opacity. */
    &.disabled,
    &:disabled {
      background: var(--win98-face);
      box-shadow: var(--win98-raised);
      color: var(--win98-shadow);
      text-shadow: 1px 1px #fff;
      opacity: 1;
    }

    &.subtle:not(:hover, :active, [aria-expanded="true"]) {
      background: transparent;
      box-shadow: none;
    }

    &.subtle:hover {
      box-shadow: var(--win98-thin);
    }

    &:focus-visible {
      outline: 1px dotted #000;
      outline-offset: -4px;
    }
  }

  /* Text fields and combo boxes. */
  .bolt-textfield,
  .bolt-dropdown-expandable-text-field,
  textarea {
    border: 0;
    border-radius: 0;
    background: #fff;
    box-shadow: var(--win98-sunken);
    color: #000;

    &.focused,
    &:focus-within,
    &.bolt-identitypickerdropdown-textField.focused {
      border: 0;
      box-shadow: var(--win98-sunken);
    }
  }

  /* A one-line field is 21px tall, as in the design. */
  .bolt-textfield:not(:has(textarea)) {
    min-height: 21px;
  }

  .bolt-textfield-input {
    min-height: 0;
    padding-top: 2px;
    padding-bottom: 2px;
    line-height: 15px;
    color: #000;
    background: transparent;
  }

  /* Checkboxes. */
  .bolt-checkbox .bolt-checkmark {
    border: 0;
    border-radius: 0;
    background: #fff;
    box-shadow: var(--win98-sunken);
    color: #000;
  }

  /* Pills: status wells. */
  .bolt-pill {
    border: 0;
    border-radius: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-well);
    color: #000;
    font-size: 11px;
  }

  /* A pull request's status: the well filled with a palette colour, white text. */
  .bolt-pill:is(
    .pr-status-active,
    .pr-status-draft,
    .pr-status-completed,
    .pr-status-abandoned,
    .repos-pr-list-draft-pill,
    .repos-pr-list-auto-complete-pill
  ) {
    color: #fff;
  }

  .bolt-pill.pr-status-active {
    background: var(--win98-navy);
  }

  .bolt-pill:is(.pr-status-draft, .repos-pr-list-draft-pill) {
    background: var(--win98-shadow);
  }

  .bolt-pill.pr-status-completed {
    background: var(--win98-green);
  }

  .bolt-pill.pr-status-abandoned {
    background: var(--win98-maroon);
  }

  .bolt-pill.repos-pr-list-auto-complete-pill {
    background: var(--win98-teal);
  }

  /* Avatars: square tiles. */
  :is(.bolt-coin, .vss-Persona) {
    border-radius: 0;
  }

  :is(.bolt-coin, .vss-Persona) img {
    border-radius: 0;
  }

  /* Links. */
  a.bolt-link:not(.navigation-link, .no-underline-link) {
    color: #0000ee;
  }
}

/* ===== Menus, callouts, panels and dialogs: on every page ===== */

html[data-fix-ado-win98] .bolt-portal-host {
  .bolt-callout-content,
  .bolt-contextual-menu {
    border: 0;
    border-radius: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-menu);
    padding: 3px;
    color: #000;
  }

  .bolt-menuitem-row {
    color: #000;

    &:hover,
    &.focused {
      background: var(--win98-navy);
      color: #fff;

      /* Only the text: a vote's icon keeps its colour. */
      :is(.bolt-menuitem-cell-text, .bolt-menuitem-cell-secondary) {
        color: #fff;
      }
    }

    &.disabled {
      color: var(--win98-shadow);
      text-shadow: 1px 1px #fff;
    }
  }

  /* Win98 menu metrics, as in the Menus artboard: 20px items, a 20px icon column, no spacer
     above or below the items, and an 8px separator with its etched line in the middle. */
  .bolt-menu-spacer {
    display: none;
  }

  .bolt-menuitem-row {
    height: 20px;

    & > .bolt-menuitem-cell {
      height: 20px;
      padding-top: 0;
      padding-bottom: 0;
      border: 0;
    }

    & > .bolt-menuitem-cell:first-child {
      width: 2px;
      min-width: 2px;
      padding: 0;

      & > .bolt-menuitem-cell-content {
        display: none;
      }
    }
  }

  .bolt-menuitem-cell-icon {
    width: 20px;
    height: 20px;
    padding: 0;
    justify-content: center;
  }

  .bolt-menuitem-cell-text {
    height: 20px;
    padding: 0 20px 0 2px;
    align-items: center;
  }

  /* A submenu's arrow: a small black triangle pointing right, white on the highlighted item. */
  .bolt-menuitem-cell-content:has(> .fluent-icons-enabled > .ms-Icon--ChevronRightMed) {
    width: 16px;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='7' shape-rendering='crispEdges'%3E%3Cpath d='M0 0h1v7H0zM1 1h1v5H1zM2 2h1v3H2zM3 3h1v1H3z' fill='%23000'/%3E%3C/svg%3E")
      center / 4px 7px no-repeat;

    & > .fluent-icons-enabled {
      visibility: hidden;
    }
  }

  .bolt-menuitem-row:is(:hover, .focused)
    .bolt-menuitem-cell-content:has(> .fluent-icons-enabled > .ms-Icon--ChevronRightMed) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='7' shape-rendering='crispEdges'%3E%3Cpath d='M0 0h1v7H0zM1 1h1v5H1zM2 2h1v3H2zM3 3h1v1H3z' fill='%23fff'/%3E%3C/svg%3E");
  }

  /* The separator is a row of its own: its cells draw the etched line. */
  .bolt-menuitem-row.bolt-menuitem-divider {
    height: 8px;
    border: 0;
    background: transparent;

    & > .bolt-menuitem-cell {
      height: 8px;
      padding: 0;
      background: linear-gradient(
        transparent 3px,
        var(--win98-shadow) 3px 4px,
        #fff 4px 5px,
        transparent 5px
      );
    }

    & > .bolt-menuitem-cell > * {
      display: none;
    }
  }

  .bolt-list-row.selected,
  .bolt-list-row:hover,
  .bolt-list-row.focused {
    background: var(--win98-navy);
    color: #fff;

    /* Icons keep their colour: a vote or status icon says something. */
    :not(svg, svg *) {
      color: #fff;
    }
  }

  /* Black text, also in Azure DevOps's dark theme, whose body colour the portal inherits. */
  .bolt-panel-callout-content,
  .bolt-dialog-callout-content {
    border: 0;
    border-radius: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-menu);
    color: #000;
  }

  .bolt-panel-header,
  .bolt-dialog-header {
    margin: 3px 3px 0;
    padding: 2px 4px;
    background: var(--win98-title);
    color: #fff;

    .title-m,
    .bolt-header-title {
      color: #fff;
      font: 700 11px/18px var(--win98-font);
    }

    .bolt-button {
      min-width: 16px;
      min-height: 14px;
      padding: 0;
    }
  }

  /* A tooltip is one yellow box: its callout drops the menu's frame, padding and shadow. */
  .bolt-callout-content:has(.bolt-tooltip-content) {
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .bolt-tooltip-content {
    padding: 2px 4px;
    border: 1px solid #000;
    border-radius: 0;
    background: var(--win98-tooltip);
    color: #000;
    font: 11px/14px var(--win98-font);
    box-shadow: none;
  }
}

/* ===== Captured pages: page content ===== */

html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body {
  background: var(--win98-face);
  color: #000;
  font-size: 11px;

  .region-content,
  .bolt-page,
  .page-content {
    background: var(--win98-face);
  }

  :is(.title-m, .title-s, .title-l, .bolt-header-title) {
    font-family: var(--win98-font);
    font-size: 13px;
    font-weight: 700;
  }

  .monospaced-m,
  .monospaced-s,
  code,
  pre {
    font-family: var(--win98-mono);
  }

  /* Tabs: property sheet tabs on top of a raised panel. */
  .bolt-tabbar-tabs {
    align-items: flex-end;
    padding-left: 4px;
    border-bottom: 0;
  }

  .bolt-tab {
    height: 20px;
    margin-right: -1px;
    padding: 0 10px;
    border: 0;
    border-radius: 3px 3px 0 0;
    background: var(--win98-face);
    box-shadow:
      inset 1px 1px #fff,
      inset -1px 0 var(--win98-dark),
      inset -2px 0 var(--win98-shadow);
    color: #000;

    &.selected {
      position: relative;
      z-index: 1;
      height: 23px;
      margin: 0 -1px -2px -3px;
      padding: 0 13px;
    }

    /* After another tab it covers only that tab's 2px edge, as it covers 1px on its right. */
    &.selected:not(:first-child) {
      margin-left: -1px;
    }

    &::after,
    .bolt-tab-focus-indicator,
    .bolt-tab-underline {
      display: none;
    }
  }

  .bolt-tabbar {
    border-bottom: 0;
    box-shadow: inset 0 -1px #fff;
  }

  /* Cards: group boxes on the window face. */
  .bolt-card,
  .bolt-card.bolt-table-card {
    border: 1px solid var(--win98-shadow);
    border-radius: 0;
    background: var(--win98-face);
    box-shadow:
      inset 1px 1px #fff,
      1px 1px #fff;
  }

  .bolt-card-white,
  .depth-8,
  .depth-16 {
    background: var(--win98-face);
  }

  .bolt-card .bolt-header-title {
    font-size: 11px;
  }

  /* Tables: list views with header buttons. */
  .bolt-table-container,
  .bolt-table-card {
    background: #fff;
    box-shadow: var(--win98-sunken);
    padding: 2px;
  }

  .bolt-table {
    background: #fff;
  }

  .bolt-table-header-cell {
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
    color: #000;
    font-weight: 400;
  }

  .bolt-table-row,
  .bolt-list-row {
    &:hover {
      background: transparent;
    }

    &.selected {
      background: var(--win98-navy);
      color: #fff;

      :is(.secondary-text, a, .bolt-link, .text-ellipsis) {
        color: #fff;
      }
    }
  }

  .bolt-table-cell {
    border-bottom: 0;
  }

  /* Trees: +/- boxes. Win98 tree views have no hover state. */
  .bolt-tree-expand-button {
    color: #000;

    &:hover {
      background-color: transparent;
    }
  }

  /* The pull request list, its sections. */
  .repos-pr-section-header {
    font-weight: 700;
  }

  /* Diffs and logs. */
  .repos-diff-contents,
  .monaco-editor,
  .monaco-editor-background {
    background: #fff;
  }

  /* The diff editor's gutter: Win98 grey, as in the Files artboards. */
  .monaco-editor .margin {
    background: var(--win98-light);
  }

  .logs-view,
  .log-reader,
  .run-logs-content {
    background: #000;
    color: var(--win98-face);
    font-family: var(--win98-mono);
  }

  /* Discussion threads: small windows. */
  .repos-discussion-thread,
  .repos-comment-thread {
    border: 0;
    border-radius: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
  }

  .repos-discussion-comment .repos-comment-viewer {
    background: #fff;
    box-shadow: var(--win98-sunken);
    padding: 4px 6px;
  }

  /* Board: columns as windows on the teal desktop, cards as raised white tiles. */
  .kanban-board-content,
  .kanban-board {
    background: var(--win98-desktop);
  }

  .kanban-board-column {
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
  }

  .kanban-board-column-header {
    padding: 2px 4px;
    background: var(--win98-title);
    color: #fff;

    /* Buttons stay grey with black text. */
    :not(svg, svg *, .bolt-button, .bolt-button *) {
      color: #fff;
    }
  }

  /* A card is a raised panel on the window face, its type colour a strip inside the bevel. */
  .wit-card {
    border: 0;
    border-left: 0;
    border-radius: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);

    /* Only the bevel draws the card's edge: the content's own border stays, unseen. */
    .card-content {
      border-color: transparent;
    }

    .card-flag {
      box-sizing: border-box;
      border-block: 2px solid transparent;
      background-clip: padding-box;
      transform: translateX(2px);
    }

    /* Tags: flat white boxes with a grey line, like static fields. */
    .tags-list .bolt-pill {
      box-sizing: border-box;
      padding: 0 5px;
      border: 1px solid var(--win98-shadow);
      background: #fff;
      box-shadow: none;

      .bolt-pill-content {
        padding: 0;
      }
    }
  }

  /* Work item form: a window with group boxes. */
  .work-item-form-header,
  .work-item-form-title {
    background: var(--win98-face);
  }

  .work-item-form-header-title-bar,
  .witform-header {
    background: var(--win98-title);
    color: #fff;
  }
}

/* ===== The script's own parts, as in the design's "Script ·" artboards ===== */

/* Settings panel: a dialog window, on every page. */
/* The settings button's count of new and updated features, as in the SettingsButton artboard:
   a small yellow tag on its top right corner, over the top edge, so the puzzle piece shows. The
   class twice outweighs the top bar's font rule. */
html[data-fix-ado-win98] .fix-ado-settings-button .fix-ado-settings-badge.fix-ado-settings-badge {
  top: -3px;
  right: -1px;
  min-width: 13px;
  height: 11px;
  padding: 0 2px;
  border: 1px solid #000;
  border-radius: 0;
  background: var(--win98-tooltip);
  color: #000;
  font: 700 9px/9px var(--win98-font);
}

/* The settings panel, as in the Settings artboards: a window whose frame is a border image, so
   the features scroll inside it, under a title bar that stays at the top and buttons that stay
   at the bottom. */
html[data-fix-ado-win98] .fix-ado-settings {
  box-sizing: border-box;
  overflow-y: auto;
  border: 3px solid transparent;
  border-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='7' shape-rendering='crispEdges'%3E%3Crect width='7' height='7' fill='%230a0a0a'/%3E%3Cpath d='M0 0h6v1H1v5H0z' fill='%23dfdfdf'/%3E%3Crect x='1' y='1' width='5' height='5' fill='%23808080'/%3E%3Cpath d='M1 1h4v1H2v3H1z' fill='%23fff'/%3E%3Crect x='2' y='2' width='3' height='3' fill='%23c0c0c0'/%3E%3C/svg%3E")
    3 / 3px stretch;
  border-radius: 0;
  padding: 0 7px 7px;
  background: var(--win98-face);
  box-shadow: none;
  color: #000;
  font: 11px/14px var(--win98-font);

  &::backdrop {
    background: transparent;
  }

  .fix-ado-settings-title {
    position: sticky;
    top: 0;
    z-index: 1;
    height: 18px;
    margin: 0 -7px;
    padding: 0 4px;
    background: var(--win98-title);
    color: #fff;
    font: 700 11px/18px var(--win98-font);
  }

  .fix-ado-settings-category,
  .fix-ado-settings-category + .fix-ado-settings-category {
    position: relative;
    margin-top: 14px;
    padding: 12px 8px 6px;
    border: 1px solid var(--win98-shadow);
    box-shadow:
      inset 1px 1px #fff,
      1px 1px #fff;
  }

  .fix-ado-settings-category-name {
    position: absolute;
    top: -7px;
    left: 6px;
    margin: 0;
    padding: 0 3px;
    background: var(--win98-face);
    color: #000;
    font: 400 11px/14px var(--win98-font);
  }

  .fix-ado-settings-feature,
  .fix-ado-settings-feature:hover {
    gap: 6px;
    border: 0;
    border-radius: 0;
    padding: 3px 2px;
    background: transparent;
    box-shadow: none;
  }

  .fix-ado-settings-feature-name {
    font-weight: 700;
  }

  .fix-ado-settings-feature-description {
    color: #404040;
  }

  .fix-ado-settings-checkbox {
    appearance: none;
    width: 13px;
    height: 13px;
    margin: 1px 0 0;
    border: 0;
    border-radius: 0;
    background: #fff;
    box-shadow: var(--win98-sunken);

    &:checked {
      background:
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='7'%3E%3Cpath d='M0 3l2 2 5-5v2L2 7 0 5z'/%3E%3C/svg%3E")
          center / 7px 7px no-repeat,
        #fff;
    }

    &:focus-visible {
      outline: 1px dotted #000;
      outline-offset: 2px;
    }
  }

  /* New: tooltip yellow. Updated: the face grey, so the two read apart. The class twice
     outweighs the 11px font rule of captured pages. */
  .fix-ado-settings-chip.fix-ado-settings-chip {
    margin-left: 6px;
    border: 1px solid #000;
    border-radius: 0;
    padding: 0 4px;
    background: var(--win98-tooltip);
    color: #000;
    font: 700 10px/12px var(--win98-font);
    text-transform: uppercase;
  }

  .fix-ado-settings-chip-updated.fix-ado-settings-chip {
    background: var(--win98-face);
  }

  /* A feature's tag, such as WIP: white, so it reads apart from New and Updated. */
  .fix-ado-settings-chip-tag.fix-ado-settings-chip {
    background: #fff;
  }

  /* The buttons: Save and reload page first as the default, then Cancel, as Win98 orders them. */
  .fix-ado-settings-buttons {
    position: sticky;
    bottom: -7px;
    z-index: 1;
    gap: 6px;
    margin: 0 -7px -7px;
    padding: 8px 7px 7px;
    background: var(--win98-face);

    & > .primary {
      order: -1;
    }

    & > .bolt-button:disabled {
      box-shadow: var(--win98-raised);
      color: var(--win98-shadow);
      text-shadow: 1px 1px #fff;
      opacity: 1;
    }
  }

  .fix-ado-settings-issue-link {
    order: -2;
    color: #0000ee;
    text-decoration: underline;
  }
}

/* The review's Finish your review dialog, as in the ReviewFinish artboard: a window with a
   title bar, a sunken comment field, the votes in a "Your vote" group box, the pending comments
   behind a tree-view box, and Win98 buttons with Submit review as the default. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) .fix-ado-review-dialog {
  box-sizing: border-box;
  width: 560px;
  border: 0;
  border-radius: 0;
  padding: 3px 10px 10px;
  background: var(--win98-face);
  box-shadow: var(--win98-window);
  color: #000;
  font: 11px/14px var(--win98-font);

  &::backdrop {
    background: transparent;
  }

  .fix-ado-review-title {
    height: 18px;
    margin: 0 -7px 8px;
    padding: 0 4px;
    background: var(--win98-title);
    color: #fff;
    font: 700 11px/18px var(--win98-font);
  }

  .fix-ado-review-textarea {
    display: block;
    box-sizing: border-box;
    height: 80px;
    min-height: 0;
    padding: 4px 5px;
    font: 11px/14px var(--win98-font);

    &::placeholder {
      color: var(--win98-shadow);
      opacity: 1;
    }
  }

  .fix-ado-review-votes {
    position: relative;
    gap: 6px;
    min-width: 0;
    margin: 14px 0 0;
    padding: 13px 8px 8px;
    border: 1px solid var(--win98-shadow);
    box-shadow:
      inset 1px 1px #fff,
      1px 1px #fff;

    & > legend {
      position: absolute;
      top: -8px;
      left: 6px;
      inline-size: auto;
      block-size: auto;
      padding: 0 3px;
      overflow: visible;
      clip-path: none;
      background: var(--win98-face);
    }
  }

  .fix-ado-review-vote {
    gap: 6px;
  }

  .fix-ado-review-vote input[type="radio"] {
    appearance: none;
    flex: none;
    width: 12px;
    height: 12px;
    margin: 1px 0 0;
    border: 0;
    border-radius: 0;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Cpath fill='%23808080' d='M4 0h4v1H4zM2 1h2v1H2zM8 1h2v1H8zM1 2h1v1H1zM1 3h1v1H1zM0 4h1v1H0zM0 5h1v1H0zM0 6h1v1H0zM0 7h1v1H0zM1 8h1v1H1zM1 9h1v1H1z'/%3E%3Cpath fill='%230a0a0a' d='M4 1h4v1H4zM2 2h2v1H2zM8 2h2v1H8zM2 3h1v1H2zM1 4h1v1H1zM1 5h1v1H1zM1 6h1v1H1zM1 7h1v1H1zM2 8h1v1H2z'/%3E%3Cpath fill='%23fff' d='M4 2h4v1H4zM10 2h1v1H10zM3 3h6v1H3zM10 3h1v1H10zM2 4h8v1H2zM11 4h1v1H11zM2 5h8v1H2zM11 5h1v1H11zM2 6h8v1H2zM11 6h1v1H11zM2 7h8v1H2zM11 7h1v1H11zM3 8h6v1H3zM10 8h1v1H10zM4 9h4v1H4zM10 9h1v1H10zM2 10h2v1H2zM8 10h2v1H8zM4 11h4v1H4z'/%3E%3Cpath fill='%23dfdfdf' d='M9 3h1v1H9zM10 4h1v1H10zM10 5h1v1H10zM10 6h1v1H10zM10 7h1v1H10zM9 8h1v1H9zM2 9h2v1H2zM8 9h2v1H8zM4 10h4v1H4z'/%3E%3C/svg%3E")
      0 0 / 12px no-repeat;
    box-shadow: none;

    &:checked {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Cpath fill='%23808080' d='M4 0h4v1H4zM2 1h2v1H2zM8 1h2v1H8zM1 2h1v1H1zM1 3h1v1H1zM0 4h1v1H0zM0 5h1v1H0zM0 6h1v1H0zM0 7h1v1H0zM1 8h1v1H1zM1 9h1v1H1z'/%3E%3Cpath fill='%230a0a0a' d='M4 1h4v1H4zM2 2h2v1H2zM8 2h2v1H8zM2 3h1v1H2zM1 4h1v1H1zM1 5h1v1H1zM1 6h1v1H1zM1 7h1v1H1zM2 8h1v1H2z'/%3E%3Cpath fill='%23fff' d='M4 2h4v1H4zM10 2h1v1H10zM3 3h6v1H3zM10 3h1v1H10zM2 4h3v1H2zM7 4h3v1H7zM11 4h1v1H11zM2 5h2v1H2zM8 5h2v1H8zM11 5h1v1H11zM2 6h2v1H2zM8 6h2v1H8zM11 6h1v1H11zM2 7h3v1H2zM7 7h3v1H7zM11 7h1v1H11zM3 8h6v1H3zM10 8h1v1H10zM4 9h4v1H4zM10 9h1v1H10zM2 10h2v1H2zM8 10h2v1H8zM4 11h4v1H4z'/%3E%3Cpath fill='%23dfdfdf' d='M9 3h1v1H9zM10 4h1v1H10zM10 5h1v1H10zM10 6h1v1H10zM10 7h1v1H10zM9 8h1v1H9zM2 9h2v1H2zM8 9h2v1H8zM4 10h4v1H4z'/%3E%3Cpath fill='%23000' d='M5 4h2v1H5zM4 5h4v1H4zM4 6h4v1H4zM5 7h2v1H5z'/%3E%3C/svg%3E");
    }

    &:focus-visible {
      outline: 1px dotted #000;
      outline-offset: 1px;
    }
  }

  .fix-ado-review-pending-list > summary {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 14px;
    margin-top: 10px;
    list-style: none;
    font-weight: 700;

    &::-webkit-details-marker {
      display: none;
    }

    &::before {
      content: "";
      flex: none;
      width: 9px;
      height: 9px;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2zM4 2h1v5H4z'/%3E%3C/svg%3E")
        0 0 / 9px no-repeat;
    }
  }

  .fix-ado-review-pending-list[open] > summary::before {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2z'/%3E%3C/svg%3E");
  }

  .fix-ado-review-pending-item {
    margin: 6px 0 0 14px;
    padding: 0;
    border: 0;

    .fix-ado-review-card-text {
      margin-top: 2px;
    }
  }

  .fix-ado-review-status {
    margin: 10px 0 0;
    min-height: 0;
    color: #800000;

    &:empty {
      display: none;
    }
  }

  /* Save your edits?: a Win98 message box, its buttons centred as Yes, No, Cancel. */
  &.fix-ado-review-unsaved {
    width: 360px;

    /* 14px below the title bar: this margin and the title's 8px collapse into one. */
    & > p {
      margin: 14px 4px 0;
    }

    .fix-ado-review-buttons {
      justify-content: center;
      margin-top: 14px;

      & > :first-child {
        order: 1;
      }
    }
  }

  /* Sending: the progress in black, every control greyed out as Win98 disables it. */
  &[aria-busy] {
    .fix-ado-review-status {
      color: #000;
    }

    .fix-ado-review-textarea {
      background: var(--win98-face);
    }

    .fix-ado-review-vote input[type="radio"] {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Cpath fill='%23808080' d='M4 0h4v1H4zM2 1h2v1H2zM8 1h2v1H8zM1 2h1v1H1zM1 3h1v1H1zM0 4h1v1H0zM0 5h1v1H0zM0 6h1v1H0zM0 7h1v1H0zM1 8h1v1H1zM1 9h1v1H1z'/%3E%3Cpath fill='%230a0a0a' d='M4 1h4v1H4zM2 2h2v1H2zM8 2h2v1H8zM2 3h1v1H2zM1 4h1v1H1zM1 5h1v1H1zM1 6h1v1H1zM1 7h1v1H1zM2 8h1v1H2z'/%3E%3Cpath fill='%23c0c0c0' d='M4 2h4v1H4zM3 3h6v1H3zM2 4h8v1H2zM2 5h8v1H2zM2 6h8v1H2zM2 7h8v1H2zM3 8h6v1H3zM4 9h4v1H4z'/%3E%3Cpath fill='%23fff' d='M10 2h1v1H10zM10 3h1v1H10zM11 4h1v1H11zM11 5h1v1H11zM11 6h1v1H11zM11 7h1v1H11zM10 8h1v1H10zM10 9h1v1H10zM2 10h2v1H2zM8 10h2v1H8zM4 11h4v1H4z'/%3E%3Cpath fill='%23dfdfdf' d='M9 3h1v1H9zM10 4h1v1H10zM10 5h1v1H10zM10 6h1v1H10zM10 7h1v1H10zM9 8h1v1H9zM2 9h2v1H2zM8 9h2v1H8zM4 10h4v1H4z'/%3E%3C/svg%3E");

      &:checked {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Cpath fill='%23808080' d='M4 0h4v1H4zM2 1h2v1H2zM8 1h2v1H8zM1 2h1v1H1zM1 3h1v1H1zM0 4h1v1H0zM5 4h2v1H5zM0 5h1v1H0zM4 5h4v1H4zM0 6h1v1H0zM4 6h4v1H4zM0 7h1v1H0zM5 7h2v1H5zM1 8h1v1H1zM1 9h1v1H1z'/%3E%3Cpath fill='%230a0a0a' d='M4 1h4v1H4zM2 2h2v1H2zM8 2h2v1H8zM2 3h1v1H2zM1 4h1v1H1zM1 5h1v1H1zM1 6h1v1H1zM1 7h1v1H1zM2 8h1v1H2z'/%3E%3Cpath fill='%23c0c0c0' d='M4 2h4v1H4zM3 3h6v1H3zM2 4h3v1H2zM7 4h3v1H7zM2 5h2v1H2zM8 5h2v1H8zM2 6h2v1H2zM8 6h2v1H8zM2 7h3v1H2zM7 7h3v1H7zM3 8h6v1H3zM4 9h4v1H4z'/%3E%3Cpath fill='%23fff' d='M10 2h1v1H10zM10 3h1v1H10zM11 4h1v1H11zM11 5h1v1H11zM11 6h1v1H11zM11 7h1v1H11zM10 8h1v1H10zM10 9h1v1H10zM2 10h2v1H2zM8 10h2v1H8zM4 11h4v1H4z'/%3E%3Cpath fill='%23dfdfdf' d='M9 3h1v1H9zM10 4h1v1H10zM10 5h1v1H10zM10 6h1v1H10zM10 7h1v1H10zM9 8h1v1H9zM2 9h2v1H2zM8 9h2v1H8zM4 10h4v1H4z'/%3E%3C/svg%3E");
      }
    }

    :is(.fix-ado-review-vote, .fix-ado-review-vote .secondary-text, .bolt-button) {
      color: var(--win98-shadow);
      text-shadow: 1px 1px #fff;
    }
  }

  .fix-ado-review-dialog-buttons {
    margin-top: 14px;
  }

  .fix-ado-review-buttons {
    gap: 6px;
    margin: 0;

    & > .primary {
      order: -1;
    }
  }
}

/* Everything below is page content, so only on captured pages. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body {
  /* Pipeline tab, as in the PipelineTab artboard: a sunken tree view beside the log window.
     Start new run sits on a grey toolbar strip at the top of the tree, which scrolls with it. */
  .fix-ado-pipeline-tree {
    gap: 0;
    padding: 3px;
    background:
      linear-gradient(var(--win98-face) 0 0) 0 0 / 100% 31px no-repeat local,
      linear-gradient(var(--win98-shadow) 0 0) 0 31px / 100% 1px no-repeat local,
      #fff;
    box-shadow: var(--win98-sunken);

    & > .fix-ado-pipeline-run-action {
      flex: none;
      align-self: flex-start;
      margin: 2px 2px 6px;
    }
  }

  .fix-ado-pipeline-stages,
  .fix-ado-pipeline-jobs,
  .fix-ado-pipeline-steps {
    gap: 0;
  }

  /* A run is two lines; a dotted line stands between runs. */
  .fix-ado-pipeline-run.fix-ado-pipeline-run {
    margin-top: 0;
    padding: 4px 30px 2px 6px;
    border-top: 0;

    /* Bold only when picked, as below. */
    &:not([aria-current="true"]) .fix-ado-pipeline-item-name {
      font-weight: 400;
    }
  }

  .fix-ado-pipeline-run-row:not(:first-child) {
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
  }

  .fix-ado-pipeline-run-row ~ .fix-ado-pipeline-run-row {
    margin-top: 4px;
    border-top: 1px dotted var(--win98-shadow);
  }

  /* Open run in new tab: a flat toolbar button with a window and an arrow out of it,
     raised under the pointer and sunken while pressed. */
  .fix-ado-pipeline-open-run.fix-ado-pipeline-open-run {
    top: auto;
    inset-inline-end: 4px;
    bottom: 2px;
    width: 22px;
    min-width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' d='M1 5h10v10H1z'/%3E%3Cpath fill='%23000080' d='M1 4h10v2H1z'/%3E%3Cpath d='M0 4h1v12H0zM1 15h11v1H1zM11 9h1v7h-1zM8 1h7v1H8zM14 1h1v7h-1zM13 2h1v1h-1zM12 3h1v1h-1zM11 4h1v1h-1zM10 5h1v1h-1zM9 6h1v1H9zM8 7h1v1H8z'/%3E%3C/svg%3E")
      center / 16px no-repeat;
    box-shadow: none;
    color: #000;

    & > svg {
      display: none;
    }

    &:hover {
      background-color: var(--win98-face);
      box-shadow: var(--win98-raised);
    }

    &:active {
      background-color: var(--win98-face);
      box-shadow: var(--win98-sunken);
    }

    &:focus-visible {
      outline: 1px dotted #000;
      outline-offset: -4px;
    }
  }

  /* A row: a +/- box on a run, stage or job that opens and closes, the status icon, the label.
     Rows without children keep the box's room, so icons line up. */
  .fix-ado-pipeline-item {
    gap: 4px;
    padding: 2px 6px;
    border-radius: 0;
    font-size: 11px;

    &::before {
      content: "";
      flex: none;
      width: 9px;
      height: 9px;
    }

    &[aria-expanded="true"]::before {
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2z'/%3E%3C/svg%3E")
        0 0 / 9px no-repeat;
    }

    &[aria-expanded="false"]::before {
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2zM4 2h1v5H4z'/%3E%3C/svg%3E")
        0 0 / 9px no-repeat;
    }

    &:hover {
      background: transparent;
    }

    .fix-ado-pipeline-item-text {
      padding: 0 2px;
    }

    /* The picked run, stage and job are bold; the deepest pick's label is navy, as in a
       Win98 tree view, which highlights the label and not the row. */
    &[aria-current="true"] {
      background: transparent;
      box-shadow: none;

      .fix-ado-pipeline-item-name {
        font-weight: 700;
      }
    }

    &[aria-current="true"]:not(
        :has(
          ~ :is(.fix-ado-pipeline-stages, .fix-ado-pipeline-jobs, .fix-ado-pipeline-steps)
            [aria-current="true"]
        ),
        .fix-ado-pipeline-run-row:has(~ .fix-ado-pipeline-stages [aria-current="true"]) > *
      ) {
      .fix-ado-pipeline-item-text {
        background: var(--win98-navy);
        color: #fff;
      }

      .fix-ado-pipeline-item-name {
        font-weight: 400;
      }

      .fix-ado-pipeline-item-details {
        color: #fff;
      }
    }

    &:focus-visible {
      outline: 0;

      .fix-ado-pipeline-item-text {
        outline: 1px dotted #000;
        outline-offset: -1px;
      }
    }
  }

  .fix-ado-pipeline-item-details {
    color: #404040;
    font-size: 11px;
    font-weight: 400;
  }

  /* Cancel current run: a plain raised button; Win98 has no red ones. Starting… and
     Cancelling… are greyed out as Win98 disables a button. */
  .fix-ado-pipeline-run-action.danger {
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
    color: #000;
  }

  .fix-ado-pipeline-run-action:is(.disabled, :disabled) {
    box-shadow: var(--win98-raised);
    color: var(--win98-shadow);
    text-shadow: 1px 1px #fff;
  }

  /* With several checks, the button opens a drop-down list under it. */
  .fix-ado-pipeline-run-action-choices {
    flex: none;
    gap: 0;
    margin: 0 2px 6px;
    padding: 1px;
    border: 1px solid #000;
    background: #fff;

    .fix-ado-pipeline-item {
      padding: 2px 4px;

      &::before {
        content: none;
      }
    }
  }

  /* Notes in the tree: under the button when Azure DevOps refused, in maroon; under a run
     while its stages load, indented as stages are. */
  .fix-ado-pipeline-note {
    flex: none;
    padding: 2px 6px;
    color: #404040;
    font-size: 11px;

    &[role="alert"] {
      color: #800000;
    }
  }

  .fix-ado-pipeline-run-row + .fix-ado-pipeline-note {
    padding-left: 22px;
  }

  /* A message in place of the whole panel: an empty Win98 list view holding the text. */
  .fix-ado-pipeline-panel > .fix-ado-pipeline-message {
    grid-row: 1 / -1;
    margin: 0;
    padding: 4px 6px;
    background: #fff;
    box-shadow: var(--win98-sunken);
    color: #000;
    font-size: 11px;

    &[role="alert"] {
      color: #800000;
    }
  }

  /* While there is no step to show, the console holds the note. */
  .fix-ado-pipeline-panel > .fix-ado-pipeline-log-note {
    margin: 0;
    padding: 4px 6px;
    border: 1px solid;
    border-color: var(--win98-dark) var(--win98-light) var(--win98-light) var(--win98-dark);
    background: #000;
    box-shadow:
      -1px -1px var(--win98-shadow),
      1px 1px #fff;
    color: var(--win98-face);
    font-size: 11px;
  }

  /* The warnings and errors, above the log and on the Overview, close with a tree-view +/- box.
     The box is drawn in ::before: the button rules for a focused subtle button clear its
     background. */
  .fix-ado-issue-box-collapse.bolt-button.bolt-button {
    flex: none;
    width: 9px;
    min-width: 9px;
    height: 9px;
    margin: 0;
    padding: 0;
    background: none;
    box-shadow: none;

    &:is(:focus, :hover, :active) {
      background: none;
      box-shadow: none;
    }

    &::before {
      content: "";
      width: 9px;
      height: 9px;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2z'/%3E%3C/svg%3E")
        0 0 / 9px no-repeat;
    }

    &[aria-expanded="false"]::before {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2zM4 2h1v5H4z'/%3E%3C/svg%3E");
    }

    & > * {
      display: none;
    }
  }

  /* Run page tabs in a pull request: the frame sunken as the log's, a missing tab's note in
     a white list view with the info icon, and a disabled tab greyed with an emboss. */
  .fix-ado-run-tab-frame,
  .fix-ado-run-tab-missing {
    border: 1px solid;
    border-color: var(--win98-dark) var(--win98-light) var(--win98-light) var(--win98-dark);
    border-radius: 0;
    box-shadow:
      -1px -1px var(--win98-shadow),
      1px 1px #fff;
  }

  .fix-ado-run-tab-missing {
    flex-direction: row;
    gap: 6px;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 6px 8px;
    background: #fff;
    color: #000;
    font-size: 11px;

    &::before {
      width: 16px;
      height: 16px;
      background: var(--win98-icon-info) center / 16px no-repeat;
      mask: none;
    }
  }

  .fix-ado-run-tab-disabled .bolt-tab-text.bolt-tab-text {
    color: var(--win98-shadow);
    text-shadow: 1px 1px #fff;
  }

  /* A switch (core/switch.css): a Win98 checkbox and its label. */
  .fix-ado-run-tab-toggle {
    margin: 0 8px;
  }

  .fix-ado-switch {
    gap: 6px;
    padding: 0 2px;
    border-radius: 0;
    color: #000;
    font-size: 11px;

    &:disabled {
      color: var(--win98-shadow);
      text-shadow: 1px 1px #fff;
    }

    &:focus-visible {
      outline: 0;

      .fix-ado-switch-text {
        outline: 1px dotted #000;
      }
    }
  }

  .fix-ado-switch-pill.fix-ado-switch-pill {
    width: 13px;
    height: 13px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: #fff;
    box-shadow: var(--win98-sunken);
  }

  .fix-ado-switch[aria-checked="true"] .fix-ado-switch-pill {
    background:
      var(--win98-check) center / 7px 7px no-repeat,
      #fff;
  }

  .fix-ado-switch:disabled .fix-ado-switch-pill {
    background-color: var(--win98-face);
  }

  .fix-ado-switch-knob {
    display: none;
  }

  /* The log: a sunken frame. */
  .fix-ado-pipeline-frame {
    border: 1px solid;
    border-color: var(--win98-dark) var(--win98-light) var(--win98-light) var(--win98-dark);
    box-shadow:
      -1px -1px var(--win98-shadow),
      1px 1px #fff;
  }

  /* Warning and error counts: tooltip-yellow chips. */
  .fix-ado-issue-count {
    border: 1px solid #000;
    border-radius: 0;
    padding: 0 4px;
    background: var(--win98-tooltip);
    color: #000;
    font-weight: 700;
  }

  /* The warnings and errors box: a group box around a sunken list. */
  .fix-ado-issue-box {
    border: 1px solid var(--win98-shadow);
    border-radius: 0;
    background: var(--win98-face);
    box-shadow:
      inset 1px 1px #fff,
      1px 1px #fff;

    & > table {
      background: #fff;
      box-shadow: var(--win98-sunken);
    }
  }

  .fix-ado-issue:hover {
    background: transparent;
  }

  .fix-ado-issue-output {
    font-family: var(--win98-mono);
  }

  /* Go to first unread: the default button while something is unread, greyed out when not. */
  .bolt-button.fix-ado-first-unread:not(:disabled) {
    box-shadow: var(--win98-default);
    font-weight: 700;
  }

  /* Unread comments: one tooltip-yellow box with a black outline per group. The class keeps the
     yellow over the threads' transparent comments further down. */
  .repos-comment-viewer[data-fix-ado-unread],
  [data-fix-ado-unread] .repos-comment-viewer {
    background: var(--win98-tooltip);
  }

  /* The box reaches 2px past the comments, so the coins keep a yellow edge before the outline. */
  .repos-comment-viewer[data-fix-ado-unread] {
    box-shadow: 0 0 0 2px var(--win98-tooltip);
  }

  [data-fix-ado-unread]::after {
    left: -2px;
    right: -2px;
    border-radius: 0;
    background: transparent;
    box-shadow: inset 0 0 0 1px #000;
  }

  [data-fix-ado-unread="first"]::after {
    top: -2px;
  }

  [data-fix-ado-unread="last"]::after {
    bottom: -2px;
  }

  [data-fix-ado-unread="only"]::after {
    inset: -2px;
  }

  /* Go to next unread: a push button at the bottom right of its group, not a bar across it. */
  .bolt-button.fix-ado-next-unread {
    width: auto;
    margin: 8px 6px 6px auto;
  }

  /* Azure DevOps's unread dot: the yellow box says it, and the dot's margin moved the time. */
  .repos-unread-comment-marker {
    display: none;
  }

  /* An open thread without a file header: its first comment header is its navy title bar. */
  [data-fix-ado-thread="open"]:not(.comment-file-header + *)
    > .repos-comment-viewer:first-child
    > .repos-discussion-comment
    .repos-discussion-comment-header {
    margin: 0 0 6px;
    padding: 1px 3px;
    background: var(--win98-title);
    color: #fff;
    font-weight: 700;

    :not(.bolt-button, .bolt-button *, .bolt-pill, .bolt-pill *, svg, svg *) {
      color: #fff;
    }

    .bolt-button {
      background: var(--win98-face);
      box-shadow: var(--win98-raised);
      color: #000;
    }
  }

  /* Fold toggles on threads and pushes: a small +/- box. */
  /* .subtle matches the specificity of the flat-button rule above, so this one wins. */
  .bolt-button.subtle:is(.fix-ado-thread-toggle, .fix-ado-push-toggle) {
    width: 13px;
    min-width: 0;
    height: 13px;
    min-height: 0;
    padding: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);

    & > * {
      display: none;
    }

    &::before {
      content: "+" / "";
      color: #000;
      font: 700 11px/11px var(--win98-mono);
    }

    &[aria-expanded="true"]::before {
      content: "\\2212" / "";
    }
  }

  /* Folded pushes: a plain line in the feed, no box. */
  [data-fix-ado-push="folded"],
  [data-fix-ado-push="folded"] .iteration-card-header {
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  /* Thread chips: status wells, Unresolved in bold. */
  .bolt-pill.fix-ado-thread-chip {
    border: 0;
    border-radius: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-thin);
    color: #000;
    font-weight: 400;
  }

  .bolt-pill.fix-ado-unresolved-chip {
    font-weight: 700;

    .bolt-pill-content {
      font-weight: inherit;
    }
  }

  /* Scroll to bottom: a square push button. */
  .fix-ado-scroll-to-bottom,
  .fix-ado-scroll-to-bottom:hover {
    border: 0;
    border-radius: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
    color: #000;
  }

  /* Stars: a flat toolbar button that raises on hover; yellow when starred. */
  .fix-ado-star {
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;

    &:hover {
      background: var(--win98-face);
      box-shadow: var(--win98-thin);
    }

    &[aria-pressed="true"] .fix-ado-star-icon path {
      fill: #ffd800;
      stroke: #000;
    }
  }

  .fix-ado-starred-empty {
    padding: 8px;
    background: #fff;
    box-shadow: var(--win98-sunken);
    color: #404040;
  }

  /* Required reviewers in a list: a black frame, then a gap before the optional ones. */
  .pr-reviewer[data-fix-ado-required] :is(.bolt-coin, [data-fix-ado-initials]) {
    outline: 2px solid #000;
    outline-offset: 1px;
  }

  [data-fix-ado-reviewers]
    > .pr-reviewer[data-fix-ado-required]
    + .pr-reviewer:not([data-fix-ado-required]) {
    margin-left: 6px;
  }

  /* Review: a pending comment is a small inactive window, as in the ReviewPending artboard.
     Its title bar holds the yellow PENDING tag and Edit and Delete comment as caption buttons;
     the comment sits in a yellow sunken well, the note under it. The header's parts are
     placed on the card's grid, so the title bar is painted on the card. */
  .fix-ado-review-card {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    grid-template-rows: 18px auto auto;
    column-gap: 2px;
    border: 0;
    border-radius: 0;
    padding: 3px;
    background:
      var(--win98-title-inactive) 3px 3px / calc(100% - 6px) 18px no-repeat,
      var(--win98-face);
    box-shadow: var(--win98-window);
  }

  .fix-ado-review-card-header {
    display: contents;

    .fix-ado-review-pending {
      grid-area: 1 / 1;
      align-self: center;
      height: 14px;
      margin-left: 2px;
      padding: 0 4px;
      font-size: 10px;
      line-height: 12px;
    }

    .fix-ado-review-card-note {
      grid-area: 3 / 1 / 4 / -1;
      margin: 4px 3px 3px;
      color: #404040;
      font-size: 11px;
      font-weight: 400;
    }

    & > .bolt-button.bolt-button {
      grid-row: 1;
      align-self: center;
      width: 16px;
      min-width: 16px;
      height: 14px;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: var(--win98-face)
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='14' shape-rendering='crispEdges'%3E%3Cpath d='M10 3h1v1h-1zM11 3h1v1h-1zM9 4h1v1h-1zM11 4h1v1h-1zM8 5h1v1h-1zM10 5h1v1h-1zM7 6h1v1h-1zM9 6h1v1h-1zM6 7h1v1h-1zM8 7h1v1h-1zM5 8h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM5 9h1v1h-1zM6 9h1v1h-1z'/%3E%3C/svg%3E")
        0 0 / 16px 14px no-repeat;
      box-shadow: var(--win98-raised);
      font-size: 0;

      &:active {
        background-position: 1px 1px;
        box-shadow: var(--win98-pressed);
      }
    }

    & > [data-fix-ado-review-action="edit"] {
      grid-column: 3;
    }

    & > [data-fix-ado-review-action="remove"].bolt-button {
      grid-column: 4;
      margin-right: 2px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='14' shape-rendering='crispEdges'%3E%3Cpath d='M4 3h2l2 2 2-2h2l-3 3.5 3 3.5h-2l-2-2-2 2H4l3-3.5z'/%3E%3C/svg%3E");
    }
  }

  :is(.fix-ado-review-card-text, .fix-ado-review-card-editor) {
    grid-area: 2 / 1 / 3 / -1;
    margin: 6px 3px 0;
  }

  .fix-ado-review-card-text {
    padding: 4px 6px;
    background: var(--win98-tooltip);
    box-shadow: var(--win98-sunken);
  }

  .fix-ado-review-card-editor {
    .fix-ado-review-textarea {
      display: block;
      height: 80px;
      min-height: 0;
      padding: 4px 5px;
      font: 11px/14px var(--win98-font);
    }

    .fix-ado-review-buttons {
      gap: 6px;
      margin-top: 6px;

      & > .primary {
        order: -1;
      }
    }
  }

  :is(.fix-ado-review-pending, .fix-ado-review-count) {
    border: 1px solid #000;
    border-radius: 0;
    padding: 0 5px;
    background: var(--win98-tooltip);
    color: #000;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .fix-ado-review-pending-dot {
    border-radius: 0;
    background: var(--win98-tooltip);
    box-shadow: inset 0 0 0 1px #000;
  }

  /* A pending comment's row in the Files tree, as in the ReviewTree artboard: its dot where a
     thread row has its author's coin, and as tall as that row. */
  .fix-ado-review-tree-indent {
    width: 16px;
  }

  .fix-ado-review-tree-row .repos-file-explorer-tree-thread-item {
    height: 20px;
  }

  /* The pending comments in this file, over the single-file view's editor, as in the
     ReviewFileList artboards: a small floating window whose title bar opens and closes it
     with a tree-view box. */
  .fix-ado-review-file-pending {
    border: 0;
    border-radius: 0;
    padding: 3px;
    background: var(--win98-face);
    box-shadow: var(--win98-menu);
    color: #000;
    font: 11px/14px var(--win98-font);

    & > summary {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 18px;
      padding: 0 4px;
      list-style: none;
      background: var(--win98-title);
      color: #fff;
      font-weight: 700;
      white-space: nowrap;

      &::-webkit-details-marker {
        display: none;
      }

      &::before {
        content: "";
        flex: none;
        width: 9px;
        height: 9px;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2zM4 2h1v5H4z'/%3E%3C/svg%3E")
          0 0 / 9px no-repeat;
      }
    }

    &[open] > summary::before {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2z'/%3E%3C/svg%3E");
    }

    .fix-ado-review-card {
      margin: 3px 0 0;
    }
  }

  .fix-ado-review-textarea {
    border: 0;
    border-radius: 0;
    background: #fff;
    box-shadow: var(--win98-sunken);
  }

  /* Published since, too long ago: dark red and bold. */
  .fix-ado-published-since-too-long {
    color: #a00000;
    font-weight: 700;
  }

  /* Avatar initials: square tiles with a 1px bevel. */
  [data-fix-ado-initials] {
    border-radius: 0;
    box-shadow:
      inset 1px 1px rgba(255, 255, 255, 0.55),
      inset -1px -1px rgba(0, 0, 0, 0.6);
  }

  /* Days in column: a progress bar. A 6x5 segment per day in a sunken white track, navy, then
     olive once aging, then maroon once old; sunken while they load. The track takes no room of
     its own, so the card keeps its height. */
  .fix-ado-days-in-column {
    gap: 2px;
    margin: 4px -2px -2px;
    padding: 2px;
    background: #fff;
    box-shadow:
      inset 1px 1px var(--win98-shadow),
      inset -1px -1px #fff;
  }

  .fix-ado-days-in-column > span {
    width: 6px;
    border-radius: 0;
    background: var(--win98-navy);
  }

  .fix-ado-days-in-column > span[data-age="aging"] {
    background: #808000;
  }

  .fix-ado-days-in-column > span[data-age="old"] {
    background: #800000;
  }

  .fix-ado-days-in-column > span[data-age="loading"] {
    background: var(--win98-light);
    box-shadow: inset 1px 1px var(--win98-shadow);
  }

  /* The days toggle, as in the DaysInColumn artboard: a 16x14 caption button in the column's
     title bar, pressed in while the dots show. Caption buttons always show in Win98, so it
     does not wait for the pointer. */
  .kanban-board-column-header .fix-ado-days-toggle {
    justify-content: center;
    gap: 1px;
    width: 16px;
    height: 14px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
    opacity: 1;

    & > span {
      width: 2px;
      height: 2px;
      border-radius: 0;
      background: #000;
      box-shadow: none;
    }

    &[aria-pressed="true"] {
      padding: 1px 0 0 1px;
      box-shadow: var(--win98-pressed);
    }

    &[aria-pressed="false"] > span {
      background: var(--win98-shadow);
    }
  }
}

/* ===== Fonts on captured pages, found by measuring the win98 captures ===== */

/* Many of Azure DevOps's classes set their own font and size, so the body's font does not reach
   them. Every text gets the Win98 font at 11px, except icons, which are fonts too, and the code
   editor, whose cursor depends on its own font. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""])
  body
  :not(
    svg,
    svg *,
    .fabric-icon,
    [class*="ms-Icon"],
    [class*="bowtie"],
    .monaco-editor,
    .monaco-editor *,
    :is(h1, h2, h3, .title-s, .title-m, .title-l, .bolt-header-title),
    :is(h1, h2, h3, .title-s, .title-m, .title-l, .bolt-header-title) *,
    .bolt-breadcrumb-divider
  ) {
  font-family: var(--win98-font);
  font-size: 11px;
  line-height: 14px;
}

/* Headings: 13px bold. The script's dialogs keep their 11px: a title is a title bar there,
   a group name a group box label. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""])
  body
  :is(h1, h2, h3, .title-s, .title-m, .title-l, .bolt-header-title):not(
    .monaco-editor *,
    .fix-ado-review-dialog *,
    .fix-ado-settings *
  ) {
  font-family: var(--win98-font);
  font-size: 13px;
  font-weight: 700;
  line-height: 16px;
}

/* Code, diffs and logs: Courier New. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""])
  body
  :is(
    [class*="monospaced"],
    [class*="monospaced"] *,
    code,
    pre,
    kbd,
    samp,
    .repos-line-content,
    .repos-line-content *,
    .token,
    [class*="prism"],
    .logs-view .pl-reader,
    .logs-view .pl-reader *
  ):not(.monaco-editor *) {
  font-family: var(--win98-mono);
  font-size: 12px;
}

/* ===== Focus, pickers and suggestion lists ===== */

html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body {
  /* A field shows its caret when it has focus, no coloured border, as in Win98. */
  .bolt-tag-picker,
  .bolt-tag-picker.edit,
  .bolt-tag-picker.focused {
    border: 0;
    border-radius: 0;
    animation: none;
    background: #fff;
    box-shadow: var(--win98-sunken);
  }

  .fix-ado-review-textarea:focus,
  .bolt-textfield-input:focus,
  textarea:focus {
    border-color: transparent;
    outline: none;
  }

  /* The star picker: a small window with a title bar around the search field and its list. */
  .fix-ado-star-picker {
    position: relative;
    padding: 24px 6px 6px;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);

    &::before {
      content: "Add person/group to starred" / "";
      position: absolute;
      top: 3px;
      left: 3px;
      right: 3px;
      height: 18px;
      padding: 0 4px;
      background: var(--win98-title);
      color: #fff;
      font: 700 11px/18px var(--win98-font);
    }
  }

  /* Suggestion lists, such as the reviewer search and the star picker: a sunken white list
     whose picked row is navy. */
  .bolt-suggestions-container {
    background: #fff;
  }

  :is(.bolt-suggestions-container, .bolt-callout) .bolt-list-row {
    &:hover,
    &.selected,
    &.focused {
      background: var(--win98-navy);
      color: #fff;

      :not(svg, svg *, [data-fix-ado-initials], .bolt-coin, .vss-Persona) {
        color: #fff;
      }
    }
  }
}

/* Callouts outside the portal, such as the star picker's list: square corners. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body .bolt-callout-content {
  border-radius: 0;
}

html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body {
  /* Azure DevOps pulses a ring around a focused field. Its animation overrides the sunken
     bevel while it runs, and Win98 shows focus with the caret only. */
  .bolt-textfield.focused,
  .focus-treatment:focus,
  .focus-treatment.focused {
    animation: none;
  }

  /* Tabs are never bold, the selected one neither, as in the design. */
  .bolt-tabbar .bolt-tab,
  .bolt-tabbar .bolt-tab .bolt-tab-text {
    font-weight: 400;
  }
}

html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body {
  /* One-line inputs fit the 21px field. */
  input.bolt-textfield-input {
    height: 17px;
    /* Azure DevOps gives an empty combo box input 29px with !important. */
    min-height: 0 !important;
  }

  /* A combo box's arrow is a raised button on the right of the field. */
  .bolt-dropdown-expandable-text-field > .fluent-icons-enabled:last-child {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 17px;
    height: 17px;
    margin-right: 2px;
    background: var(--win98-face);
    box-shadow:
      inset -1px -1px var(--win98-dark),
      inset 1px 1px var(--win98-light),
      inset -2px -2px var(--win98-shadow),
      inset 2px 2px #fff;
    color: #000;
  }
}

/* ===== Pull request list and inbox, as in the design's "Pull request list" artboard ===== */

html[data-fix-ado-win98]:is(
    [data-fix-ado-win98="pull-request-list"],
    [data-fix-ado-win98="pull-request-inbox"]
  )
  body {
  .bolt-page {
    padding: 12px 16px;
  }

  /* The page's own header: the title, then its buttons on the right. */
  .bolt-page > .bolt-header {
    height: 33px;
    margin: 0;
    padding: 0 0 10px;
    align-items: center;

    .bolt-header-title {
      padding: 0;
    }

    .bolt-header-commandbar,
    .bolt-header-commandbar-button-group {
      margin: 0;
      padding: 0;
      gap: 6px;
    }
  }

  /* The tabs, with the filter button at their right. */
  .bolt-page > .bolt-tabbar {
    position: static;
    height: 23px;
    min-height: 0;
    margin: 0;
    padding: 0 0 0 4px;
    align-items: flex-end;
    box-shadow: none;

    .bolt-tabbar-tabs {
      height: 23px;
      padding: 0;
    }

    .bolt-header-commandbar {
      margin: 0 0 2px;
      padding: 0;
    }
  }

  /* The tab panel: raised, holding the sections. */
  .page-content {
    flex: 1;
    margin: 0;
    padding: 14px 12px 12px;
    gap: 14px;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);

    & > * + * {
      margin-top: 0;
    }
  }

  /* A section: a sunken white list with a raised header bar. */
  .repos-pr-section-card {
    margin: 0;
    padding: 2px;
    border: 0;
    background: #fff;
    box-shadow: var(--win98-sunken);

    /* The header row; a list without sections, as on the Active tab, has none. */
    & > .flex-row:first-child:not(.bolt-card-content) {
      height: 34px;
      align-items: center;
      gap: 8px;
      padding: 0 10px;
      background: var(--win98-face);
      box-shadow: var(--win98-thin);
    }

    &:has(.repos-pr-section-tabs) > .flex-row:first-child:not(.bolt-card-content) {
      height: 46px;
      align-items: flex-end;
      padding-bottom: 4px;
    }

    .repos-pr-section-expand-button {
      align-self: center;
      margin: 0;
    }

    .repos-pr-section-header {
      padding: 0;
      margin: 0;
    }

    .repos-pr-section-header .bolt-header-title {
      font-size: 11px;
      font-weight: 700;
      padding: 0;
    }

    .bolt-card-content {
      padding: 0;
    }

    .bolt-card-content > * {
      flex: 1;
      min-width: 0;
    }

    /* The expand button: the design's +/- box, before the title. */
    .bolt-button.repos-pr-section-expand-button {
      width: 13px;
      min-width: 0;
      height: 13px;
      padding: 0;
      background: var(--win98-face);
      box-shadow: var(--win98-raised);

      & > * {
        display: none;
      }

      &::before {
        content: "\\2212" / "";
        color: #000;
        font: 700 11px/11px var(--win98-mono);
      }

      &[aria-expanded="false"]::before {
        content: "+" / "";
      }
    }

    .bolt-table-container,
    .bolt-table {
      box-shadow: none;
      padding: 0;
    }
  }

  /* A row: avatar, title and details, reviewers, comments, times, on one grid. */
  a.bolt-table-row {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr) 120px 70px 160px;
    align-items: center;
    gap: 12px;
    height: 54px;
    padding: 0 12px;

    & > .bolt-table-spacer-cell,
    & > .bolt-table-cell-side-action {
      display: none;
    }

    & > td {
      display: block;
      height: auto;
      padding: 0;
      border: 0;
    }

    .bolt-table-cell-content {
      padding: 0;
    }
  }

  .bolt-list-row-spacer,
  .repos-pr-list > colgroup {
    display: none;
  }

  /* The table and its body are blocks, so each row's grid spans the list. */
  .repos-pr-list,
  .repos-pr-list > tbody {
    display: block;
    width: 100%;
  }

  /* Group by work item: centred in the tab bar, clear of the tab panel's frame. */
  .bolt-tabbar > .fix-ado-group-toggle {
    align-self: center;
  }

  /* A work item's group: its id as a link and its title, then a line to the list's edge. */
  .fix-ado-work-item-group {
    display: block;

    & > td {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 24px;
      padding: 0 12px;
      border-top: 0;
      white-space: nowrap;
      color: #000;

      &::after {
        content: "";
        flex: 1;
        height: 1px;
        margin-left: 2px;
        background: var(--win98-shadow);
      }
    }

    a {
      color: #0000ee;
    }
  }

  .fix-ado-work-item-group-title {
    overflow: hidden;
    text-overflow: ellipsis;
    color: #404040;
  }
}

html[data-fix-ado-win98] {
  /* The search field: the Win98 magnifier, then the text. */
  :is(.project-header, .top-level-header) .search {
    padding: 0 4px;
    gap: 4px;
    align-items: center;

    .search-icon {
      width: 12px;
      height: 12px;
      margin: 0;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Ccircle cx='5' cy='5' r='3.5' fill='%23fff' stroke='%23000' stroke-width='1.5'/%3E%3Cpath d='M7.5 7.5 11 11' stroke='%23000' stroke-width='2'/%3E%3C/svg%3E")
        center / 12px no-repeat;

      & > * {
        display: none;
      }
    }

    .search-input {
      padding: 0;
    }
  }

  /* The menu bar: each item a raised 23px button, 2px apart. */
  :is(.project-header, .top-level-header) .region-header-menubar {
    align-items: center;
    gap: 2px;
    padding-right: 4px;

    & > * {
      height: 23px;
      margin: 0;
    }

    .bolt-button,
    .me-control-div {
      width: 23px;
      min-width: 0;
      height: 23px;
      padding: 0;
      background: var(--win98-face);
      box-shadow: var(--win98-raised);
    }
  }

  /* The side bar's project row: 34px, with a raised + button. */
  .navigation-container .project-item {
    height: 34px;
    font-weight: 700;
  }

  .navigation-container .collapsible-section .bolt-expandable-container {
    width: 19px;
    height: 19px;
    margin-right: 2px;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
  }
}

/* ===== Exact geometry, measured against the design artboards ===== */

html[data-fix-ado-win98] {
  /* Breadcrumbs: no padding of their own, 6px apart, centred in the Address field. */
  :is(.project-header, .top-level-header) .region-header > .bolt-breadcrumb-with-items {
    padding: 0 4px;

    .bolt-breadcrumb,
    .bolt-breadcrumb-container {
      align-items: center;
      gap: 6px;
      padding: 0;
    }

    :is(
      .bolt-breadcrumb-list-item,
      .bolt-breadcrumb-item,
      .bolt-breadcrumb-item a,
      .bolt-breadcrumb-item-text-container,
      .bolt-breadcrumb-item-text,
      .bolt-breadcrumb-divider
    ) {
      margin: 0;
      padding: 0;
    }

    .bolt-breadcrumb-list-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .bolt-breadcrumb-overflow {
      display: none;
    }
  }

  /* Side bar: 6px down for the panel's bevel and padding; top items' text at 36px, sub items'
     at 44px from the side bar's inner edge, selected item bold. */
  .navigation-container .project-navigation {
    padding-top: 6px;

    .separator {
      margin: 3px 0;
    }

    .navigation-element {
      padding-left: 6px;
      gap: 8px;
    }

    .navigation-element.hub:not(.hub-group, .stand-alone) {
      padding-left: 18px;
    }

    .navigation-element.displayed,
    .navigation-element.displayed .navigation-text {
      font-weight: 700;
    }
  }
}

html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body {
  /* Buttons: 10px padding each side, no extra space around their text. */
  .bolt-button {
    padding-left: 10px;
    padding-right: 10px;

    .bolt-button-text {
      margin: 0;
      padding: 0;
    }
  }

  .bolt-button.icon-only {
    padding: 0;
  }

  /* Tabs: 10px padding, the selected one 13px; text centred. */
  .bolt-tab {
    display: inline-flex;
    align-items: center;
    padding: 0 10px;

    .bolt-tab-inner-container {
      height: auto;
      padding: 0;
    }

    .bolt-tab-text {
      height: auto;
      margin: 0;
      padding: 0;
    }

    &.selected {
      padding: 0 13px;
    }
  }

  /* A page's own title: centred on its 23px row. */
  .bolt-page > .bolt-header .bolt-header-title {
    line-height: 23px;
  }
}

html[data-fix-ado-win98]:is(
    [data-fix-ado-win98="pull-request-list"],
    [data-fix-ado-win98="pull-request-inbox"]
  )
  body {
  /* Section headers: the +/- box, 8px, then the title and its count in normal weight. */
  .repos-pr-section-card > .flex-row:first-child:not(.bolt-card-content) {
    .repos-pr-section-header,
    .bolt-header-content-area,
    .bolt-header-title-area,
    .bolt-header-title-row {
      margin: 0;
      padding: 0;
    }

    .repos-pr-section-header-title {
      align-items: center;
      gap: 8px;
    }

    .bolt-pill {
      margin: 0;
      font-weight: 400;
    }
  }

  /* A row's two lines: the first 16px tall, centred, the second 14px. */
  .bolt-table-two-line-cell .bolt-table-two-line-cell-item {
    padding: 0;
  }

  .bolt-table-two-line-cell .bolt-table-two-line-cell-item:first-child {
    height: 16px;
    align-items: center;
  }

  .bolt-table-two-line-cell .bolt-table-two-line-cell-item + .bolt-table-two-line-cell-item {
    height: 14px;
    margin: 0;
  }
}

html[data-fix-ado-win98] .navigation-container .project-navigation.expanded {
  /* Items from 28px to 4px before the edge, as in the design: the banner, 2px, 4px. */
  padding: 6px 4px 6px 28px;

  .navigation-section {
    margin: 0;
  }

  .project-item {
    padding-left: 6px;
    gap: 8px;

    .navigation-icon {
      width: 24px;
    }
  }

  .navigation-element .navigation-icon {
    width: 16px;
  }

  .navigation-element.hub:not(.hub-group, .stand-alone) {
    padding-left: 14px;
  }
}

html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body {
  /* Azure DevOps reserves room for a bold tab label; Win98 tabs are never bold. */
  .bolt-tab :is(.bolt-tab-text, .bolt-tab-inner-container)::after,
  .bolt-tab :is(.bolt-tab-text, .bolt-tab-inner-container)::before {
    display: none;
  }

  .bolt-page > .bolt-header .bolt-button {
    margin: 0;
  }

  .bolt-page > .bolt-header .bolt-header-commandbar {
    align-self: flex-start;
  }

  .bolt-pill {
    height: 16px;
    padding: 0 6px;
  }
}

html[data-fix-ado-win98]:is(
    [data-fix-ado-win98="pull-request-list"],
    [data-fix-ado-win98="pull-request-inbox"]
  )
  body {
  /* The tab row is 25px: the filter button and its 2px below. */
  .bolt-page > .bolt-tabbar {
    height: 25px;
  }

  .repos-pr-section-card .repos-pr-section-header-title {
    padding: 0;
  }

  .repos-pr-section-card .repos-pr-section-header .bolt-header-title {
    margin: 0;
  }
}

html[data-fix-ado-win98] {
  /* Raised buttons in the menu bar and the side bar, also where Azure DevOps marks them flat. */
  :is(.project-header, .top-level-header) .region-header-menubar .bolt-button.subtle,
  .navigation-container .bolt-button.subtle,
  .navigation-container .collapsible-section .bolt-expandable-container {
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
  }

  .navigation-container .bolt-button.subtle {
    width: 19px;
    min-width: 0;
    height: 19px;
    padding: 0;
  }

  /* Breadcrumb text 2px from the field's top, as in the design. */
  :is(.project-header, .top-level-header) .region-header > .bolt-breadcrumb-with-items {
    align-items: flex-start;
    padding-top: 0;

    .bolt-breadcrumb,
    .bolt-breadcrumb-container {
      align-items: flex-start;
      line-height: 14px;
    }
  }
}

html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body {
  /* No room kept for overflow buttons that do not show. */
  .bolt-header-commandbar .overflow-button-empty-div {
    display: none;
  }
}

html[data-fix-ado-win98]:is(
    [data-fix-ado-win98="pull-request-list"],
    [data-fix-ado-win98="pull-request-inbox"]
  )
  body {
  /* A row's first line: title, status icon, pills, 6px apart; the status icon's ring shows. */
  .bolt-table-two-line-cell .bolt-table-two-line-cell-item:first-child {
    gap: 6px;
    overflow: visible;

    & > * {
      margin-left: 0;
      margin-right: 0;
    }
  }

  /* The sub-tabs in a section's header: small property sheet tabs. */
  .repos-pr-section-tabs {
    margin: 0;
    padding: 0;

    .bolt-tabbar-tabs {
      height: 20px;
      padding: 0;
      align-items: flex-end;
    }

    .bolt-tab {
      height: 18px;
      margin: 0 -1px 0 0;
      padding: 0 8px;
      gap: 6px;

      &.selected {
        height: 20px;
        margin: 0 -1px 0 0;
        padding: 0 8px;
      }
    }

    .bolt-tab-badge,
    .bolt-tab .bolt-pill {
      margin: 0;
      font-weight: 400;
    }
  }
}

html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body {
  /* The selected tab's own underline, padding and bold, which Win98 tabs do not have. */
  .bolt-tab .bolt-tab-inner-container {
    border: 0;
    padding: 0;
    font-weight: 400;
  }

  /* Pills fit their text: 6px each side, no minimum width. */
  .bolt-pill {
    min-width: 0;

    .bolt-pill-content {
      height: auto;
      margin: 0;
      padding: 0;
      font-weight: 400;
    }
  }
}

html[data-fix-ado-win98]:is(
    [data-fix-ado-win98="pull-request-list"],
    [data-fix-ado-win98="pull-request-inbox"]
  )
  body {
  .repos-pr-section-card .repos-pr-section-header-title {
    gap: 8px;
  }

  /* A section header with sub-tabs: the +/- box at the bottom, the title 14px high and 3px
     above the tabs. */
  .repos-pr-section-card:has(.repos-pr-section-tabs) {
    .bolt-button.repos-pr-section-expand-button {
      align-self: flex-end;
      margin-bottom: 5px;
    }

    .repos-pr-section-header-title {
      height: 14px;
      margin-bottom: 3px;
    }
  }

  /* A sub-tab's label and count, 6px apart, without the selected tab's extra padding. */
  .repos-pr-section-tabs .bolt-tab .bolt-tab-inner-container,
  .repos-pr-section-tabs .bolt-tab.selected .bolt-tab-inner-container {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
  }
}

html[data-fix-ado-win98] :is(.project-header, .top-level-header) {
  /* The Address row: every part 3px below the row's top, the label's text 5px. */
  :is(.region-header, .region-header-menubar) {
    align-items: flex-start;
  }

  .suite-logo {
    align-items: flex-start;
    padding-top: 5px;
  }

  .region-header > .bolt-breadcrumb-with-items,
  .region-header-menubar > * {
    margin-top: 3px;
  }

  .expandable-search-header {
    margin-right: 6px;
    padding: 3px 0 0;
  }
}

html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body {
  /* Azure DevOps underlines the selected tab with a more specific rule. */
  .bolt-tabbar .bolt-tabbar-tabs .bolt-tab.selected .bolt-tab-inner-container {
    border-bottom: 0;
    padding: 0;
    font-weight: 400;
  }

  /* The status icon's ring may reach past its cell. */
  .bolt-table-two-line-cell,
  .bolt-table-two-line-cell .bolt-table-cell-content {
    overflow: visible;
  }
}

/* Initials in whole pixels and bold, as in the design: 13px on a 32px avatar, 10px on 24px. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body [data-fix-ado-initials]::after {
  font-size: round(down, calc(var(--fix-ado-avatar-size, 24px) * 0.42), 1px);
  font-weight: 700;
}

/* The repository selector in the breadcrumbs: its icon, 4px, then the name, on the text line. */
html[data-fix-ado-win98] .region-header .region-headerBreadcrumb .bolt-button {
  height: auto;
  min-height: 0;
  padding: 0;
  align-items: flex-start;

  .bolt-dropdown-expandable-button-label,
  .bolt-dropdown-expandable-button-label > .flex-row {
    gap: 4px;
    margin: 0;
    padding: 0;
    align-items: flex-start;
  }

  .artifact-dropdown-icon,
  .icon-right {
    margin: 0;
    padding: 0;
  }
}

/* Breadcrumbs: every level aligned to the top, the text where the design has it. */
html[data-fix-ado-win98]
  :is(.project-header, .top-level-header)
  .region-header
  > .bolt-breadcrumb-with-items {
  padding-top: 4px;

  :is(
    .bolt-breadcrumb,
    .bolt-breadcrumb-container,
    .bolt-breadcrumb-list-item,
    .bolt-breadcrumb-item,
    .bolt-breadcrumb-item a,
    .bolt-breadcrumb-item-text-container,
    .region-headerBreadcrumb,
    .repository-selector
  ) {
    height: auto;
    align-items: flex-start;
  }

  .artifact-dropdown-icon {
    display: inline-block;
    width: 12px;
    height: 12px;
  }
}

html[data-fix-ado-win98] {
  /* Menu bar buttons raised; doubled classes outrank the flat-button rule. */
  :is(.project-header, .top-level-header) .region-header-menubar .bolt-button.bolt-button.subtle {
    width: 23px;
    min-width: 0;
    height: 23px;
    padding: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
  }

  /* The project row centres its + button, as in the design. */
  .navigation-container .collapsible-section {
    align-items: center;
  }

  /* No grey bar beside an expanded group. */
  .navigation-container .hub-group-container.expanded-container {
    border: 0;
    box-shadow: none;

    &::before,
    &::after {
      display: none;
    }
  }
}

html[data-fix-ado-win98]:is(
    [data-fix-ado-win98="pull-request-list"],
    [data-fix-ado-win98="pull-request-inbox"]
  )
  body {
  /* Reviewers 8px apart, also before the required reviewers feature has marked the row: the
     rhythm margins that space them natively are off in Windows 98 mode. */
  .rhythm-horizontal-8:has(> .pr-reviewer):not([data-fix-ado-reviewers]) {
    gap: 8px;
  }

  /* The reviewers' cell shows each required reviewer's whole frame. */
  a.bolt-table-row > td,
  a.bolt-table-row .bolt-table-cell-content,
  a.bolt-table-row .pr-reviewer {
    overflow: visible;
  }
}

html[data-fix-ado-win98] {
  /* The repository selector is plain text in the Address field, not a raised button. */
  .region-header .region-headerBreadcrumb .bolt-button.bolt-button {
    background: transparent;
    box-shadow: none;
  }
}

/* Win98 text has no letter spacing; Azure DevOps tightens its titles. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""])
  body
  :is(h1, h2, h3, .title-s, .title-m, .title-l, .bolt-header-title) {
  letter-spacing: normal;
}

/* Pill and tab labels show their first letter whole: no clipping at the left edge. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body :is(.bolt-pill-content, .bolt-tab-text) {
  overflow: visible;
}

/* A dropdown button's label keeps its ellipsis but gets 1px of slack, so its first letter shows
   whole on a half-pixel position. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body .bolt-dropdown-expandable-button-label {
  overflow: clip;
  overflow-clip-margin: 1px;
}

html[data-fix-ado-win98] {
  :is(.project-header, .top-level-header) .region-header > .bolt-breadcrumb-with-items {
    align-self: flex-start;
  }

  /* The account button shows its bevel around the avatar. */
  :is(.project-header, .top-level-header) .me-control-div > * {
    background: transparent;
    box-shadow: none;
  }

  /* Side bar buttons keep 6px to the side bar's edge, as the items' text does. */
  .navigation-container .collapsible-section .bolt-expandable-container {
    margin-right: 6px;
  }
}

html[data-fix-ado-win98] {
  /* The side bar's collapse button: a raised 19px button, like the + button. */
  .navigation-container .hub.stand-alone[role="button"] {
    flex: none;
    align-self: center;
    width: 19px;
    height: 19px;
    margin-right: 6px;
    padding: 0;
    justify-content: center;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
  }

  /* The account control is larger than its 23px button; the button shows what fits. */
  :is(.project-header, .top-level-header) .me-control-div {
    overflow: hidden;
  }
}

/* ===== Pull request Overview, as in the design's "Pull request" artboard ===== */

html[data-fix-ado-win98="pull-request"] body {
  .repos-pr-details-page {
    padding: 12px 16px 0;
  }

  /* The header: the title row, then the details row, 6px apart. */
  .repos-pr-header {
    height: auto;
    margin: 0;
    padding: 0;

    & > .flex-column {
      gap: 6px;
    }

    & > .flex-column > * {
      margin: 0;
      padding: 0;
    }

    & > .flex-column > :first-child {
      height: 23px;
      align-items: center;
      gap: 6px;
    }

    & > .flex-column > :nth-child(2) {
      height: 24px;
      align-items: center;
    }

    .repos-pr-title-row {
      flex: 1;
      height: 23px;
      align-items: center;
      gap: 6px;
      margin: 0;
      padding: 0;

      & > :first-child {
        flex: 1;
        margin: 0;
      }
    }

    .bolt-textfield {
      margin: 0;
    }
  }

  /* Icon buttons in the header: 23px square and raised, also where Azure DevOps marks them flat. */
  .repos-pr-header .bolt-button.bolt-button.subtle,
  .repos-pr-header .bolt-expandable-button .bolt-button.icon-only {
    width: 23px;
    min-width: 0;
    padding: 0;
    justify-content: center;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
  }

  .repos-pr-header .bolt-split-button-main {
    gap: 4px;
    padding: 0 10px;
  }

  /* The details row: everything 6px apart, the branch copy button a raised 19px one. */
  .pr-secondary-title-row,
  .pr-secondary-title-row-persona,
  .pr-header-branches {
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 0;

    & > * {
      margin: 0;
      padding: 0;
    }
  }

  .pr-secondary-title-row {
    height: 24px;
  }

  .pr-header-branches .bolt-clipboard-button {
    width: auto;
  }

  .pr-header-branches .bolt-clipboard-button .bolt-button.bolt-button.subtle {
    width: 19px;
    height: 19px;
  }

  .pr-header-reviewers > * {
    gap: 2px;
  }

  /* The tabs: 6px below the details, on top of the panel. */
  /* The tab bar stays on top while the page scrolls: an opaque strip from the window's top
     edge, the tabs, then the panel's top edge, so the selected tab still joins the panel. */
  .repos-pr-details-page-tabbar {
    top: -12px;
    height: 31px;
    min-height: 0;
    margin: 0 0 -2px;
    padding: 6px 0 2px;
    align-items: flex-end;
    background: var(--win98-face);
    box-shadow: none;

    &::after {
      content: "";
      position: absolute;
      right: 0;
      bottom: -6px;
      left: 0;
      height: 8px;
      background: var(--win98-face);
      box-shadow: var(--win98-raised);
      clip-path: inset(0 0 6px 0);
    }

    .bolt-tabbar-tabs {
      position: relative;
      z-index: 1;
      height: 23px;
      padding: 0 0 0 4px;
      margin: 0;
      background: transparent;
    }
  }

  /* The tab panel: raised, holding the two columns. */
  .repos-pr-details-page > .page-content {
    margin: 0;
    padding: 14px 12px 12px;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);

    & > .flex-row {
      gap: 12px;
      margin: 0;
      padding: 0;
    }

    & > .flex-row > :first-child {
      gap: 14px;
      margin: 0;
      padding: 0;
    }

    & > .flex-row > :first-child > * + *,
    .repos-overview-right-pane > * + * {
      margin-top: 0;
    }
  }

  .repos-overview-right-pane {
    width: 340px;
    gap: 14px;
    margin: 0;
  }

  /* Every card and right-pane block: a group box, 8px 10px inside. */
  .page-content > .flex-row > :first-child > .bolt-card,
  .repos-overview-right-pane > * {
    margin: 0;
    padding: 8px 10px;
    border: 1px solid var(--win98-shadow);
    background: var(--win98-face);
    box-shadow:
      inset 1px 1px #fff,
      1px 1px #fff;
  }

  .page-content > .flex-row > :first-child > .bolt-card > .bolt-card-content,
  .page-content > .flex-row > :first-child > .bolt-card > .bolt-card-header {
    margin: 0;
    padding: 0;
  }
}

html[data-fix-ado-win98="pull-request"] body {
  /* The title's copy button shows on hover only; its room stays. The branch's copy button
     takes its own 19px, so the text after it moves along. */
  .pr-header-branches .bolt-clipboard-button {
    width: 19px;
    height: 19px;
  }

  /* Card and block titles: 11px bold on a 23px row, their buttons 23px square and raised. */
  :is(.bolt-card, .repos-overview-right-pane) .bolt-header {
    height: 23px;
    margin: 0;
    padding: 0;
    align-items: center;

    .bolt-header-content-area,
    .bolt-header-title-area,
    .bolt-header-title-row,
    .bolt-header-commandbar,
    .bolt-header-commandbar-button-group {
      height: 23px;
      margin: 0;
      padding: 0;
      align-items: center;
    }

    .bolt-header-title.bolt-header-title {
      font-size: 11px;
      line-height: 14px;
    }

    .bolt-header-command-item-button.bolt-button.icon-only,
    .bolt-header-command-item-button.bolt-button.bolt-icon-button {
      width: 23px;
      min-width: 0;
      margin: 0;
      padding: 0;
      justify-content: center;
      background: var(--win98-face);
      box-shadow: var(--win98-raised);
    }
  }

  /* The status card: rows of a 24px icon and its text, between etched lines. */
  .page-content > .flex-row > :first-child > .bolt-card:first-child > .bolt-card-content > div {
    & > * {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 0;
    }

    /* A section with a check list: its heading, then the list under it. */
    & > :has(> .status-details-container) {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    & > :first-child {
      padding-top: 0;
    }

    & > :last-child {
      padding-bottom: 0;
    }

    .separator-line-bottom {
      border: 0;
      padding-bottom: 10px;
      box-shadow:
        inset 0 -1px #fff,
        inset 0 -2px var(--win98-shadow);
    }

    /* A completed pull request's banner, as wide as the card: the merge icon, who completed it
       and when, then Cherry-pick and Revert 8px apart at the right end. Under it the merge
       commit and Show details. */
    & > .flex-column:has(.repos-commits-table) {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;

      & > .flex-column > .flex-row {
        min-height: 24px;
        gap: 4px;

        & > * {
          margin: 0;
        }
      }

      .circle-icon {
        display: flex;
        width: 24px;
        height: 24px;
        margin: 0;
        padding: 0;
        align-items: center;
        justify-content: center;
        background: transparent;
        font-size: 16px;
      }

      .fluent-icons-enabled:has(> .circle-icon) {
        flex: none;
      }

      .justify-end > .bolt-button + .bolt-button {
        margin-left: 8px;
      }

      /* Show details is a link, in link blue and underlined like the page's other links. */
      & > div > .bolt-link {
        color: #0000ee;
        text-decoration: underline;
      }

      /* The merge commit: one 44px row, as on the Commits tab, the well tight around it. */
      table.repos-commits-table {
        border: 0;
        border-spacing: 0;
      }
    }
  }

  /* A status heading: the 24px icon, 4px, the text. */
  .bolt-card-content > div > div > div:first-child:has(> svg.bolt-status) {
    height: 24px;
    align-items: center;
    gap: 4px;
    padding: 0;
  }

  .bolt-card-content svg.bolt-status {
    margin: 0;
  }

  /* The check list under a heading: rows on the window face, under the heading's text. With
     every check passed it holds a link to the checks instead of a failing check. */
  .status-details-container:not(.fix-ado-issue-box, table) {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: auto;
    min-height: 0;
    padding-left: 28px;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;

    .preview-check-list,
    .preview-check-list > tbody {
      display: block;
      width: 100%;
    }

    .bolt-list-row-spacer {
      display: none;
    }

    .bolt-list-row,
    .bolt-list-cell,
    .bolt-list-cell-content,
    .bolt-list-cell-content > a,
    .bolt-list-cell-content > a > div,
    .bolt-list-cell-content > div {
      display: block;
      height: 23px;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
    }

    /* A check's row, with or without a link around it: icon, name, state, then its button. */
    .bolt-list-cell-content > a > div > .flex,
    .bolt-list-cell-content > div > .flex {
      height: 23px;
      align-items: center;
      gap: 6px;
      padding: 0;

      & > * {
        margin: 0;
      }
    }

    .pr-completion-status-header {
      padding: 0;
      gap: 6px;
      align-items: center;
    }

    .bolt-button.bolt-button.subtle {
      background: var(--win98-face);
      box-shadow: var(--win98-raised);
    }
  }

  /* The warnings and errors box on the Overview: one sunken list of three 30px rows. */
  .status-details-container.fix-ado-issue-box {
    border: 0;
    padding: 2px;
    background: #fff;
    box-shadow: var(--win98-sunken);

    & > table {
      box-shadow: none;
    }

    .preview-check-list,
    .preview-check-list > tbody,
    .bolt-list-row,
    .bolt-list-cell,
    .bolt-list-cell-content,
    .bolt-list-cell-content > div,
    .bolt-list-cell-content > div > a {
      display: block;
      width: 100%;
      height: auto;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
    }

    /* A collapsed box keeps its header row only; the rule above would show its issues. */
    &[data-collapsed] .bolt-list-cell-content > div > a.fix-ado-issue {
      display: none;
    }

    .fix-ado-issue-box-header {
      height: 30px;
      align-items: center;
      gap: 6px;
      padding: 0 10px;
    }

    .fix-ado-issue-box-header .pr-completion-status-header {
      padding: 0;
      gap: 6px;
      align-items: center;
    }

    .fix-ado-issue-place {
      height: 30px;
      display: flex;
      align-items: center;
      padding: 0 10px;
      border: 0;
      box-shadow: inset 0 1px var(--win98-face);
    }

    /* A log line is at least 30px; a long or many-line message grows the row, wrapping anywhere,
       as a console window does. */
    .fix-ado-issue-output {
      min-height: 30px;
      height: auto;
      display: flex;
      align-items: flex-start;
      padding: 8px 10px;
      background: #000;
      line-height: 14px;
    }

    .fix-ado-issue-message {
      color: #ff0;
    }

    /* Errors in the console's red, warnings in its yellow. */
    .fix-ado-issue-message.error-text {
      color: #f00;
    }

    /* A log line's number before its message, in the console's light grey. */
    .fix-ado-issue-output > .line-number {
      padding: 0 8px 0 0;
      color: var(--win98-face);
    }
  }

  .fix-ado-overview-issues > .bolt-card-content > div > div {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* The description: its title, then the text, 10px apart. */
  .repos-pr-description-card {
    gap: 10px;

    .bolt-card-content,
    .repos-pr-description,
    .markdown-content {
      margin: 0;
      padding: 0;
    }

    .markdown-content > :first-child {
      margin-top: 0;
    }

    h2,
    h3 {
      margin: 0 0 10px;
      padding: 0;
      border: 0;
    }

    h3 {
      margin-top: 4px;
    }

    .task-list {
      margin: 0 0 10px;
      padding: 0;
    }

    .task-list-item {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 14px;
      margin: 0 0 8px;
      padding: 0;
    }

    .task-list-item:last-child {
      margin-bottom: 0;
    }

    .wit-markdown-checkbox-container,
    .pr-markdown-checkbox,
    .pr-markdown-checkbox .bolt-checkmark {
      width: 13px;
      height: 13px;
      margin: 0;
      padding: 0;
    }
  }

  /* The right column: Reviewers, Tags and work items, each a group box. */
  .repos-overview-right-pane > * {
    display: flex;
    flex-direction: column;
    gap: 6px;

    & > * {
      margin: 0;
    }
  }

  .pr-required-reviewers-section,
  .pr-optional-reviewers-section,
  .fix-ado-starred-reviewers {
    gap: 6px;
    margin: 0;
    padding: 0;

    & > * {
      margin: 0;
    }
  }

  .fix-ado-starred-reviewers {
    margin-top: 4px;
  }

  .repos-pr-no-items-well {
    display: flex;
    height: 32px;
    margin: 0;
    padding: 0;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0;
    background: #fff;
    box-shadow: var(--win98-sunken);
    color: #404040;
  }

  .repos-pr-no-items-well.fix-ado-starred-empty {
    display: block;
    height: auto;
    padding: 8px;
  }

  .fix-ado-starred-list {
    margin: 0;
    padding: 0;
  }

  .fix-ado-star-someone.bolt-button {
    align-self: flex-start;
    gap: 4px;
    margin: 0;
    padding: 0 6px;
  }

  /* A reviewer: vote, avatar, name, then the star and menu buttons, 8px apart, 30px tall. */
  .repos-reviewer {
    height: 30px;
    gap: 8px;
    padding: 0 0 0 2px;

    & > * {
      margin: 0;
    }

    & > div:nth-child(2) {
      width: auto;
    }

    .bolt-coin,
    .icon-large-margin {
      margin: 0;
    }
  }

  /* Linked work items: one sunken list. */
  .region-pullRequestDetailsOverviewExtensions > div {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .linked-wit-pr-details {
    display: block;

    colgroup,
    .bolt-list-row-spacer,
    .bolt-table-spacer-cell {
      display: none;
    }

    tbody,
    .bolt-table-row {
      display: block;
    }

    .bolt-table-row {
      display: flex;
      align-items: center;
      padding: 6px 10px;
      border: 0;
    }

    .bolt-table-cell {
      display: block;
      flex: 1;
      height: auto;
      padding: 0;
      border: 0;
    }

    .bolt-table-cell:last-child {
      flex: none;
    }

    .bolt-table-cell-content,
    .bolt-table-two-line-cell-item {
      margin: 0;
      padding: 0;
    }

    .bolt-table-two-line-cell-item:first-child {
      gap: 6px;
      align-items: center;
    }

    .work-item-state {
      gap: 5px;
      align-items: center;
    }

    .work-item-state-circle {
      width: 8px;
      height: 8px;
      margin: 0;
      border: 0;
      border-radius: 0;
      box-shadow: 0 0 0 1px #000;
    }

    .bolt-button.subtle {
      width: 23px;
      min-width: 0;
      padding: 0;
      justify-content: center;
    }
  }

  .bolt-table-container:has(> .linked-wit-pr-details) {
    padding: 0;
  }
}

html[data-fix-ado-win98="pull-request"] body {
  .repos-pr-header .bolt-expandable-button {
    margin: 0;
  }

  /* Icons in header buttons take a whole 12px. */
  .repos-pr-header .bolt-split-button-main > .fluent-icons-enabled {
    flex: none;
    width: 12px;
  }

  /* Titles sit on the left, as in a group box. */
  :is(.bolt-card, .repos-overview-right-pane) .bolt-header .bolt-header-title-area {
    flex: 1;
    justify-content: flex-start;
  }

  .pr-required-reviewers-section > .secondary-text,
  .pr-optional-reviewers-section > .secondary-text,
  .fix-ado-starred-reviewers > .secondary-text {
    font-weight: 400;
  }

  .fix-ado-overview-issues > .bolt-card-content > div > div {
    padding: 0;
  }

  .status-details-container.fix-ado-issue-box .fix-ado-issue-message {
    padding: 0;
  }

  .repos-pr-description-card .task-list .task-list-item.task-list-item {
    height: 14px;
    min-height: 0;
    line-height: 14px;
  }

  .linked-wit-pr-details .bolt-table-row > .bolt-table-spacer-cell {
    display: none;
  }

  .linked-wit-pr-details a.bolt-link {
    color: #0000ee;
  }

  .repos-overview-right-pane .bolt-button .icon-right {
    width: auto;
    padding-left: 4px;
  }
}

html[data-fix-ado-win98="pull-request"] body {
  /* The title area is a column: its title on the left, centred on the row. */
  :is(.bolt-card, .repos-overview-right-pane) .bolt-header .bolt-header-title-area {
    align-items: flex-start;
    justify-content: center;
  }

  .status-details-container:not(.fix-ado-issue-box, table) .bolt-button.bolt-button.subtle {
    min-width: 75px;
  }

  .fix-ado-issue-box .fix-ado-issue-box-header.fix-ado-issue-box-header {
    height: 30px;
    min-height: 0;
    padding: 0 10px;
  }

  .repos-pr-description-card .task-list {
    margin-bottom: 14px;
  }

  .repos-pr-description-card h3 {
    margin-top: 0;
  }

  /* A work item: its 14px type icon and link, then its id, state dot and state, 5px apart. */
  .linked-wit-pr-details .bolt-table-two-line-cell-item {
    &:first-child > span:first-child {
      width: 14px;
      margin: 0;
    }

    & > .secondary-text {
      display: flex;
      align-items: center;
      gap: 5px;
      width: auto;
    }

    & > .secondary-text > *,
    .work-item-state-circle,
    .work-item-state-name {
      flex: none;
      margin: 0;
      padding: 0;
    }
  }

  .repos-overview-right-pane .bolt-button .icon-right {
    width: 9px;
    margin: 0;
    padding: 0;
  }

  .repos-overview-right-pane .bolt-header-commandbar .bolt-button {
    gap: 4px;
  }
}

html[data-fix-ado-win98="pull-request"] body {
  /* The left column shows each group box's white outer edge. */
  .page-content > .flex-row > :first-child {
    overflow: visible;
  }

  .repos-overview-right-pane .bolt-expandable-button {
    margin: 0;
  }

  /* A work item: its two lines take the row, the remove button stays on the right. */
  .linked-wit-pr-details .bolt-table-row > .bolt-table-cell {
    flex: none;
    width: auto;
  }

  .linked-wit-pr-details .bolt-table-row > .bolt-table-two-line-cell {
    flex: 1;
  }

  .linked-wit-pr-details .bolt-table-two-line-cell-item {
    height: 14px;
    line-height: 14px;
  }
}

html[data-fix-ado-win98="pull-request"] body {
  .status-details-container.fix-ado-issue-box .fix-ado-issue-output {
    border-radius: 0;
  }

  /* The work item list's bevel shows around its white table. */
  .bolt-table-container:has(> .linked-wit-pr-details) {
    padding: 2px;
  }

  .linked-wit-pr-details .bolt-table-row.bolt-table-row {
    padding: 4px 8px;
  }
}

html[data-fix-ado-win98="pull-request"] body {
  /* The title's text 4px from the field's left, centred on its line. */
  .repos-pr-title .bolt-textfield-input {
    padding: 0 4px;
    line-height: 14px;
  }

  .fix-ado-star-someone > .fluent-icons-enabled {
    flex: none;
    width: 9px;
  }
}

html[data-fix-ado-win98="pull-request"] body {
  /* No white line under the tabs: the panel's bevel draws the edge. */
  .repos-pr-details-page-tabbar.repos-pr-details-page-tabbar {
    box-shadow: none;
  }
}

/* ===== Pull request Files, as in the design's "Files" artboard ===== */

html[data-fix-ado-win98="pull-request"] body {
  /* The tab panel: the toolbar, 8px, then the tree and the changes side by side. */
  /* Azure DevOps sets this padding with !important utility classes. */
  .repos-pr-details-page > .page-content.page-content:has(.repos-compare-toolbar) {
    padding: 14px 12px 12px !important;

    & > div {
      gap: 8px;
    }
  }

  /* The toolbar: one 23px row, its parts 6px apart. */
  .repos-compare-toolbar {
    height: 23px;
    padding: 0;
    gap: 6px;

    & > div,
    & > div > div {
      gap: 6px;
      margin: 0;
    }

    & > div > div > * + * {
      margin-left: 0;
    }

    .margin-left-16 {
      margin-left: 10px;
    }

    .repos-compare-header-commandbar {
      margin: 0;
      padding: 0;
    }

    .overflow-button-empty-div {
      display: none;
    }

    .bolt-dropdown-expandable .bolt-button {
      gap: 4px;
    }

    .bolt-dropdown-expandable .icon-right {
      width: 9px;
      margin: 0;
      padding: 0;
    }

    .bolt-split-button-main {
      gap: 4px;
      padding: 0 10px;
    }

    .bolt-split-button-main > .fluent-icons-enabled,
    .repos-compare-filter .bolt-button > .fluent-icons-enabled {
      flex: none;
      width: 12px;
    }

    .repos-compare-filter .bolt-button {
      gap: 4px;
    }

    .bolt-header-command-item-button.bolt-button.bolt-button.subtle {
      width: 23px;
      min-width: 0;
      margin: 0;
      padding: 0;
      justify-content: center;
      background: var(--win98-face);
      box-shadow: var(--win98-raised);
    }
  }

  /* The tree and the changes: two sunken white panes, 4px apart. */
  .repos-changes-explorer-splitter {
    background: var(--win98-face);

    .vss-Splitter--pane-fixed,
    .vss-Splitter--pane-flexible {
      background: #fff;
      box-shadow: var(--win98-sunken);
    }

    .vss-Splitter--pane-fixed > .absolute-fill,
    .vss-Splitter--pane-flexible > .absolute-fill {
      inset: 2px;
      background: #fff;
    }

    .vss-Splitter--divider {
      background: var(--win98-face);
    }
  }

  /* The tree's top row: a raised bar with the repository and its menu. */
  .repos-changes-explorer-tree-root {
    background: var(--win98-face);

    & > .bolt-table-row {
      height: 24px;
      gap: 4px;
      padding: 0 4px;
      background: var(--win98-face);
      box-shadow:
        inset -1px -1px var(--win98-shadow),
        inset 1px 1px #fff;
    }

    .bolt-checkbox {
      margin: 0;
    }

    & > .bolt-table-row > div:nth-child(2) {
      flex: 1;
      padding: 0;
      margin: 0;
    }

    .repos-changes-explorer-tree-root-content {
      gap: 4px;
      padding: 0;
      margin: 0;
    }

    .bolt-table-button-more .bolt-button.bolt-button {
      width: 19px;
      height: 19px;
      min-width: 0;
      padding: 0;
      justify-content: center;
      background: var(--win98-face);
      box-shadow: var(--win98-raised);
    }
  }

  /* Tree rows: 20px, a 13px checkbox, the indent and +/- box, the icon and the name. */
  .repos-changes-explorer-tree {
    display: block;

    colgroup,
    td.bolt-table-cell-compact {
      display: none;
    }

    /* The tree draws only the rows in view. Its spacer rows hold the height of the others,
       so the pane scrolls to the last file. */
    & > tbody,
    .bolt-list-row-spacer,
    .bolt-list-cell-spacer {
      display: block;
    }

    tr.bolt-tree-row {
      display: flex;
      align-items: center;
      height: 20px;
      gap: 4px;
      padding-left: 4px;
      border: 0;
      background: transparent;
    }

    tr.bolt-tree-row > td {
      display: block;
      height: auto;
      padding: 0;
      border: 0;
    }

    tr.bolt-tree-row > td:nth-child(2) {
      width: 13px;
      flex: none;
    }

    tr.bolt-tree-row > td:nth-child(2) .bolt-table-cell-content {
      padding: 0;
    }

    .bolt-checkbox {
      margin: 0;
    }

    td.bolt-tree-cell {
      flex: 1;
      min-width: 0;
    }

    td.bolt-tree-cell > .bolt-table-cell-content {
      gap: 4px;
      padding: 0;
    }

    td.bolt-tree-cell > .bolt-table-cell-content > .fluent-icons-enabled {
      height: 20px;
      background-repeat: no-repeat;
      background-position: right 4px center;
      background-size: 9px;
    }

    .bolt-tree-expand-button {
      width: 16px;
      height: 20px;
      margin-right: 0;
      padding: 0;
      color: transparent;
    }

    td.bolt-tree-cell .padding-vertical-8 {
      gap: 4px;
      padding: 0;
    }

    td.bolt-tree-cell .padding-vertical-8 > .fluent-icons-enabled {
      width: 16px;
    }

    td.bolt-tree-cell .padding-vertical-8 .fabric-icon {
      margin: 0;
    }

    .bolt-pill {
      margin: 0;
    }
  }

  /* The +/- box of an open or closed folder, drawn where the arrow was. */
  .repos-changes-explorer-tree
    td.bolt-tree-cell
    > .bolt-table-cell-content
    > .fluent-icons-enabled:has(> .ms-Icon--ChevronDownMed:not(.invisible)) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2z'/%3E%3C/svg%3E");
  }

  .repos-changes-explorer-tree
    td.bolt-tree-cell
    > .bolt-table-cell-content
    > .fluent-icons-enabled:has(> .ms-Icon--ChevronRightMed:not(.invisible)) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2zM4 2h1v5H4z'/%3E%3C/svg%3E");
  }
}

html[data-fix-ado-win98] {
  /* Side bar buttons: a small glyph centred in the 19px button. */
  .navigation-container
    :is(.collapsible-section .bolt-expandable-container, .hub.stand-alone[role="button"]) {
    justify-content: center;

    .fluent-icons-enabled,
    .navigation-icon {
      width: auto;
      height: auto;
      font-size: 9px;
      line-height: 9px;
    }
  }
}

html[data-fix-ado-win98="pull-request"] body {
  /* The tree's checkboxes are 13px, its table has no bevel of its own. */
  :is(.repos-changes-explorer-tree, .repos-changes-explorer-tree-root) .bolt-checkbox,
  :is(.repos-changes-explorer-tree, .repos-changes-explorer-tree-root) .bolt-checkmark {
    width: 13px;
    height: 13px;
  }

  .vss-Splitter--pane-fixed .bolt-table-container {
    padding: 0;
    background: #fff;
    box-shadow: none;
  }

  /* The changes: file cards 8px 10px from the pane's edge, 12px apart. */
  .repos-changes-viewer.repos-changes-viewer {
    gap: 12px;
    padding: 8px 10px;
  }

  /* A file card: white, in a grey line, its header a raised bar. */
  .repos-summary-header.bolt-card {
    flex: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: #fff;
    box-shadow: 0 0 0 1px var(--win98-shadow);

    & > div:first-child {
      height: 40px;
      align-items: stretch;
      gap: 6px;
      padding: 0 6px;
      background: var(--win98-face);
      box-shadow:
        inset -1px -1px var(--win98-shadow),
        inset 1px 1px #fff;
    }

    & > div:first-child > .sticky {
      align-items: flex-start;
      gap: 6px;
      background: transparent;
    }

    .repos-change-summary-file-icon-container,
    .repos-change-summary-file-icon-container > .fluent-icons-enabled {
      width: 16px;
      height: 16px;
      margin: 0;
      padding: 0;
    }

    .repos-change-summary-file-icon {
      background: transparent;
    }

    .repos-change-summary-file-icon-container + div {
      margin: 0;
    }

    .repos-change-summary-file-icon-container + div > :first-child {
      gap: 8px;
    }

    .repos-change-summary-file-icon-container + div > :first-child > * {
      margin: 0;
    }

    .font-weight-semibold {
      font-weight: 700;
    }

    .repos-compare-removed-lines {
      color: #c00000;
    }

    .repos-compare-added-lines {
      color: #008000;
    }

    .repos-compare-removed-lines + .repos-compare-added-lines {
      margin-left: 8px;
    }

    .bolt-card-content {
      margin: 0;
      padding: 0;
    }
  }

  /* The card's fold button: the Win98 +/- box. */
  .repos-summary-header .bolt-button.bolt-card-expand-button {
    flex: none;
    align-self: center;
    width: 9px;
    min-width: 0;
    height: 9px;
    margin: 0 3px;
    padding: 0;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2z'/%3E%3C/svg%3E")
      center / 9px no-repeat;
    box-shadow: none;

    & > * {
      visibility: hidden;
    }

    &[aria-expanded="false"] {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2zM4 2h1v5H4z'/%3E%3C/svg%3E");
    }
  }

  /* Diff lines: a grey gutter with 36px line numbers, then the code. */
  .repos-diff-contents-row > .text-right {
    box-sizing: border-box;
    width: 36px;
    padding: 0 6px 0 0;
    background: var(--win98-light);
    color: #404040;
  }

  .repos-line-content.added {
    background: #cfc;
  }

  .repos-line-content.removed {
    background: #fcc;
  }

  .repos-line-content .added-content {
    background: #9e9;
  }

  .repos-line-content .removed-content {
    background: #f99;
  }

  /* Skipped lines: a 24px etched grey band. */
  .repos-diff-contents-row.repos-elliplis-row {
    height: 24px;
    background: var(--win98-light);
    box-shadow:
      inset 0 1px var(--win98-shadow),
      inset 0 -1px #fff;

    & > * {
      height: 24px;
      border: 0;
      background: transparent;
    }

    & > * > * {
      display: none;
    }
  }
}

html[data-fix-ado-win98] :is(.project-header, .top-level-header) .me-control-div {
  /* The account control fits its 23px button: no frame, a 17px photo in the middle. */
  :is(.mectrl_root, .mectrl_dropdown, .mectrl_trigger, .mectrl_topHeader),
  .mectrl_trigger > div {
    width: 23px;
    height: 23px;
    min-width: 0;
    min-height: 0;
    margin: 0;
    padding: 0;
    border: 0;
    outline: 0;
    box-shadow: none;
  }

  .mectrl_topHeader {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mectrl_topHeader .mectrl_profilepic {
    width: 17px;
    height: 17px;
    margin: 0;
    border: 0;
    border-radius: 0;
    background-size: cover;

    & img {
      width: 17px;
      height: 17px;
      border-radius: 0;
    }
  }
}

html[data-fix-ado-win98="pull-request"] body {
  .repos-changes-explorer-tree
    tr.bolt-tree-row
    > td:is(:first-child, :last-child):not(.bolt-tree-cell) {
    display: none;
  }

  .repos-changes-viewer.repos-changes-viewer {
    padding: 6px 8px;
  }

  .repos-summary-header > div:first-child > .sticky {
    padding: 0;
  }

  .repos-diff-contents-row > .text-right {
    min-width: 36px;
  }
}

html[data-fix-ado-win98="pull-request"] body {
  .repos-summary-header .change-summary-card-content {
    padding: 0;
  }
}

html[data-fix-ado-win98="pull-request"]
  body
  .status-details-container:not(.fix-ado-issue-box, table) {
  .preview-check-list:not(:has(.bolt-list-row:not(.bolt-list-row-spacer))) {
    display: none;
  }

  /* With every check passed: one 23px line, a link to the checks and an info icon. */
  .status-details-container-row:not(:empty) {
    display: flex;
    margin: 0;
    padding: 0;
  }

  .status-details-container-row > div {
    flex: 1;
    align-items: center;
    gap: 6px;
    height: 23px;
    margin: 0;
    padding: 0;
    border: 0;

    & > * {
      margin: 0;
    }
  }

  .status-details-container-row .bolt-link {
    color: #0000ee;
    text-decoration: underline;
  }
}

/* Split buttons: one raised control holding the label and a small black arrow. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body,
html[data-fix-ado-win98] .bolt-portal-host {
  .bolt-split-button {
    gap: 0;
    height: 23px;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
  }

  .bolt-split-button .bolt-button.bolt-button {
    border: 0;
    outline: 0;
    background-color: transparent;
    box-shadow: none;
    color: #000;
  }

  .bolt-split-button .bolt-split-button-main.bolt-split-button-main {
    gap: 4px;
    padding: 0 2px 0 10px;

    & > .fluent-icons-enabled {
      flex: none;
      width: 12px;
    }

    & > .fluent-icons-enabled > .fabric-icon {
      width: 12px;
      font-size: 12px;
    }
  }

  .bolt-split-button .bolt-split-button-divider {
    display: none;
  }

  .bolt-split-button .bolt-split-button-option.bolt-split-button-option {
    width: 15px;
    min-width: 0;
    padding: 0;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='4' shape-rendering='crispEdges'%3E%3Cpath d='M0 0h7v1H0zM1 1h5v1H1zM2 2h3v1H2zM3 3h1v1H3z'/%3E%3C/svg%3E")
      center / 7px 4px no-repeat;

    & > * {
      visibility: hidden;
    }
  }

  /* Pressed: the whole control sinks. */
  .bolt-split-button:has(.bolt-button:active, .bolt-button[aria-expanded="true"]) {
    box-shadow: var(--win98-pressed);
  }

  .bolt-split-button .bolt-button::before,
  .bolt-split-button .bolt-button::after {
    display: none;
  }

  /* Reviewers in the header: 2px apart. */
  .pr-header-reviewers .pr-reviewer {
    margin: 0;
  }
}

html[data-fix-ado-win98="pull-request"] body {
  /* The comment columns and the code sit on white. */
  .repos-summary-header
    .repos-diff-contents-row
    > :is(.repos-add-comment-widget, .repos-collapsed-comment),
  .repos-summary-header .repos-summary-code-diff {
    background: #fff;
  }
}

html[data-fix-ado-win98="pull-request"] body {
  /* The compare menu's label sits in the middle of its button, as on other buttons. */
  .repos-compare-toolbar .bolt-dropdown-expandable-button-label {
    flex-grow: 0;
  }

  .repos-changes-explorer-tree-root-content > .fluent-icons-enabled {
    width: 16px;
  }
}

html[data-fix-ado-win98="pull-request"] body .repos-summary-header > div:first-child {
  /* The card header's parts on whole pixels: box 15px down, icon 12px, text 6px, button 8px. */
  align-items: flex-start;

  .bolt-card-expand-button.bolt-card-expand-button {
    align-self: flex-start;
    margin-top: 15px;
  }

  & > .sticky {
    align-items: flex-start;
  }

  .repos-change-summary-file-icon-container {
    margin-top: 12px;
  }

  .repos-change-summary-file-icon-container + div {
    margin-top: 6px;
  }

  .repos-change-summary-file-icon-container ~ div:last-child {
    margin-top: 8px;
  }
}

html[data-fix-ado-win98="pull-request"] body .repos-summary-header > div:first-child {
  .repos-change-summary-file-icon-container + div > :first-child,
  .repos-change-summary-file-icon-container + div > :first-child > * {
    height: 14px;
    line-height: 14px;
  }

  a.bolt-link-button {
    align-self: flex-start;
  }
}

/* The Viewed toggle: the settings panel's sunken 13px box with a black check, and its label in
   the window font. */
html[data-fix-ado-win98="pull-request"] body .fix-ado-viewed-toggle {
  gap: 4px;
  font: 11px/14px var(--win98-font);
  color: #000;

  & input {
    appearance: none;
    inline-size: 13px;
    block-size: 13px;
    border: 0;
    border-radius: 0;
    background: #fff;
    box-shadow: var(--win98-sunken);

    &:checked {
      background:
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='7'%3E%3Cpath d='M0 3l2 2 5-5v2L2 7 0 5z'/%3E%3C/svg%3E")
          center / 7px 7px no-repeat,
        #fff;
    }

    &:focus-visible {
      outline: 1px dotted #000;
      outline-offset: 2px;
    }
  }
}

html[data-fix-ado-win98="pull-request"] body .repos-summary-header.bolt-card {
  /* Square corners, and no shadow under the sticky header. */
  border-radius: 0;

  & > div:first-child,
  & > div:first-child > .sticky {
    border: 0;
    border-radius: 0;
  }

  & > div:first-child > .sticky {
    box-shadow: none;
  }
}

html[data-fix-ado-win98="pull-request"]
  body
  .repos-changes-explorer-splitter
  .vss-Splitter--divider {
  /* The gap between the panes is plain window face. */
  border: 0;
  background-image: none;
  box-shadow: none;

  &::before,
  &::after {
    display: none;
  }
}

html[data-fix-ado-win98="pull-request"] body {
  /* The file type badge: no grey disc behind it. */
  .repos-change-summary-file-icon-container {
    border-radius: 0;
    background: transparent;
  }

  /* The add-comment button beside a diff line: flat until the pointer is on it. */
  .repos-add-comment-widget .bolt-button.bolt-button:not(:hover, :focus-visible) {
    background: transparent;
    box-shadow: none;
  }
}

/* Windows 98 has no rounded corners: only tabs keep their 3px top corners, and SVG shapes and
   radio buttons stay as drawn. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body,
html[data-fix-ado-win98]
  :is(
    .project-header,
    .top-level-header,
    .navigation-container,
    .bolt-portal-host,
    .fix-ado-settings
  ) {
  :not(svg, svg *, .bolt-tab, [role="radio"], [role="radio"] *, input[type="radio"]),
  :not(svg, svg *, .bolt-tab, [role="radio"], [role="radio"] *)::before,
  :not(svg, svg *, .bolt-tab, [role="radio"], [role="radio"] *)::after {
    border-radius: 0 !important;
  }
}

/* The review's comment box buttons, as in the ReviewComposer artboards: 6px apart, "Add single
   comment" drawn by the review feature in 11px Tahoma on a plain raised button; disabled ones as
   the kit draws them. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""])
  body
  .repos-discussion-thread-reply
  :has(> .fix-ado-review-add) {
  gap: 6px;

  /* "Start a review" or "Add review comment" is the default button once it is enabled. */
  & > .fix-ado-review-add:not(.disabled, :disabled) {
    box-shadow: var(--win98-default);
  }

  & > .bolt-button.primary:not(.fix-ado-review-add) {
    background-color: var(--win98-face);
    box-shadow: var(--win98-raised);
    color: #000;

    &::after {
      font: 11px/14px var(--win98-font);
    }

    &:is(.disabled, :disabled) {
      color: var(--win98-shadow);
      text-shadow: 1px 1px #fff;
    }
  }

  & > .fix-ado-review-add:is(.disabled, :disabled) {
    box-shadow: var(--win98-raised);
    color: var(--win98-shadow);
    text-shadow: 1px 1px #fff;
    opacity: 1;
  }
}

/* ===== Side panels, such as Enable auto-complete: a Win98 dialog window ===== */

html[data-fix-ado-win98] .bolt-portal-host {
  /* Win98 dialogs leave the window behind them as it is. */
  .bolt-callout-modal {
    background: transparent;
  }

  .bolt-panel-callout-content {
    padding: 3px;
  }

  .bolt-panel-root {
    margin: 0;
  }

  /* The title bar: 18px, the title on the left, a close button on the right. */
  .bolt-panel-header.bolt-panel-header {
    height: 18px;
    min-height: 0;
    margin: 0;
    padding: 0 2px 0 4px;

    .bolt-header-content-area,
    .bolt-header-title-area,
    .bolt-header-title-row,
    .bolt-header-commandbar,
    .bolt-header-commandbar-button-group {
      height: 18px;
      margin: 0;
      padding: 0;
      align-items: center;
    }

    .bolt-header-title {
      line-height: 18px;
    }

    .bolt-header-command-item-button.bolt-button.bolt-button {
      width: 16px;
      min-width: 0;
      height: 14px;
      min-height: 0;
      padding: 0;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='14' shape-rendering='crispEdges'%3E%3Crect width='16' height='14' fill='%23c0c0c0'/%3E%3Cpath d='M0 0h15v1H1v12H0z' fill='%23fff'/%3E%3Cpath d='M15 0h1v14H0v-1h15z' fill='%230a0a0a'/%3E%3Cpath d='M1 1h13v1H2v10H1z' fill='%23dfdfdf'/%3E%3Cpath d='M14 1h1v12H1v-1h13z' fill='%23808080'/%3E%3Cpath d='M4 3h2l2 2 2-2h2l-3 3.5 3 3.5h-2l-2-2-2 2H4l3-3.5z'/%3E%3C/svg%3E")
        0 0 / 16px 14px no-repeat;
      box-shadow: none;

      & > * {
        visibility: hidden;
      }
    }
  }

  .bolt-panel-content.bolt-panel-content {
    padding: 10px 12px;
  }

  .bolt-panel-content > div {
    padding: 0;
  }

  .bolt-formitem-label {
    margin: 0 0 4px;
    padding: 0;
    font-weight: 400;
  }

  /* A combo box: a sunken field with a raised arrow button inside its right edge. */
  .bolt-dropdown-expandable-text-field .bolt-textfield {
    position: relative;
    height: 21px;
    min-height: 0;
    padding: 0;
  }

  .bolt-dropdown-expandable-text-field .bolt-textfield-input {
    padding: 0 4px;
  }

  .bolt-dropdown-expandable-text-field .bolt-textfield > .fluent-icons-enabled {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 17px;
    height: 17px;
    background: var(--win98-face)
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='4' shape-rendering='crispEdges'%3E%3Cpath d='M0 0h7v1H0zM1 1h5v1H1zM2 2h3v1H2zM3 3h1v1H3z'/%3E%3C/svg%3E")
      center / 7px 4px no-repeat;
    box-shadow: var(--win98-menu);

    & > * {
      visibility: hidden;
    }
  }

  .repos-merge-animation {
    height: 46px;
    margin: 0;
  }

  /* The options: a group box with its title on the frame. */
  .bolt-panel-content > div > div:has(> .bolt-checkbox) {
    position: relative;
    margin-top: 6px;
    padding: 14px 10px 10px;
    border: 1px solid var(--win98-shadow);
    box-shadow:
      inset 1px 1px #fff,
      1px 1px #fff;

    & > .bolt-formitem-label {
      position: absolute;
      top: -7px;
      left: 8px;
      margin: 0;
      padding: 0 2px;
      background: var(--win98-face);
    }
  }

  .bolt-checkbox.labelled,
  .bolt-panel-content .bolt-checkbox {
    height: 20px;
    gap: 6px;
    margin: 0;
    padding: 0;
    align-items: center;

    .bolt-checkmark {
      width: 13px;
      height: 13px;
      margin: 0;
    }

    .bolt-checkbox-label {
      margin: 0;
      padding: 0;
    }
  }

  /* The info line: its icon, then the text, on the dialog face. */
  .bolt-panel-content .bolt-messagecard {
    margin-top: 6px;
    border: 0;
    background: transparent;
    box-shadow: none;

    .bolt-messagebar,
    .bolt-messagebar-content {
      padding: 0;
      background: transparent;
    }

    .bolt-messagebar-content > div {
      gap: 8px;
      margin: 0;
      align-items: flex-start;
    }

    .bolt-messagebar-icons {
      margin: 0;
    }

    .bolt-messagebar-message {
      margin: 0;
      padding-top: 7px;
    }
  }

  /* The buttons: OK first, then Cancel, 12px from the dialog's edge. */
  .bolt-panel-footer.bolt-panel-footer {
    padding: 12px;
  }

  .bolt-panel-footer-buttons {
    gap: 6px;
    justify-content: flex-end;

    & > * {
      margin: 0;
    }

    & > .primary {
      order: -1;
    }
  }
}

html[data-fix-ado-win98] .bolt-portal-host {
  .bolt-panel-header.bolt-panel-header {
    .bolt-header-title-area {
      align-items: flex-start;
    }

    .bolt-header-title.bolt-header-title {
      font-size: 11px;
    }

    .bolt-header-commandbar-button-group > * {
      margin: 0;
    }
  }

  .bolt-panel-footer.bolt-panel-footer {
    height: auto;
    min-height: 0;
  }

  .bolt-panel-content .bolt-messagebar-icons {
    flex: none;
    width: 28px;
  }
}

html[data-fix-ado-win98]
  .bolt-portal-host
  .bolt-dropdown-expandable-text-field
  .bolt-textfield
  > .fluent-icons-enabled {
  /* A combo box's arrow button: raised, with no drop shadow. */
  box-shadow:
    inset -1px -1px var(--win98-dark),
    inset 1px 1px var(--win98-light),
    inset -2px -2px var(--win98-shadow),
    inset 2px 2px #fff;
}

/* The theme panel, as in the design's ThemePanel artboard: the tiles sit in a sunken white
   large-icon list view, and the selected tile's name is navy, as a selected icon's label. */
html[data-fix-ado-win98] .bolt-portal-host .theme-panel {
  .bolt-panel-content.bolt-panel-content {
    padding: 8px;

    & > div {
      flex: 1;
      padding: 10px;
      background: #fff;
      box-shadow: var(--win98-sunken);
    }
  }

  .theme-management-container {
    align-content: flex-start;
    gap: 8px 4px;
  }

  .theme-tile-container {
    width: 106px;
    margin: 0;
    padding: 4px 0 0;
    border: 0;
  }

  .theme-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }

  .theme-name {
    width: auto;
    padding: 0 2px;
    font-size: 11px;
    line-height: 14px;
  }

  .theme-tile-container.selected .theme-name {
    background: var(--win98-navy);
    color: #fff;
  }

  /* Focus: a dotted rectangle round the name, not round the tile. */
  .theme-tile-container:focus-visible {
    outline: none;

    .theme-name {
      outline: 1px dotted #000;
    }
  }
}

html[data-fix-ado-win98="pull-request"]
  body
  .page-content
  > .flex-row
  > :first-child
  > .bolt-card:first-child
  > .bolt-card-content
  > div
  > :has(.auto-complete-icon) {
  /* Auto-complete set: a Win98 info strip, yellow in a black line, above the checks. */
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 6px 8px;
  border: 1px solid #000;
  background: var(--win98-tooltip);
  box-shadow: none;

  & > * {
    margin: 0;
  }

  & > :first-child > div {
    height: 16px;
    gap: 6px;
  }

  .fluent-icons-enabled {
    flex: none;
    width: 16px;
    height: 16px;
  }

  /* The glyph fills its 16px box, centred on the text line. */
  .circle-icon {
    display: flex;
    width: 16px;
    height: 16px;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    font-size: 16px;
    line-height: 16px;
  }

  .font-weight-semibold:not(.circle-icon) {
    font-weight: 700;
  }

  & > :last-child {
    margin-left: 22px;
  }

  .bolt-link {
    color: #0000ee;
    text-decoration: underline;
  }
}

/* ===== Files with a file selected: its header in the toolbar, the diff editor ===== */

html[data-fix-ado-win98="pull-request"] body {
  /* The toolbar grows to 29px for the file's two-line header; buttons sit 3px down. */
  .repos-compare-toolbar:has(.repos-compare-removed-lines, .repos-compare-added-lines) {
    height: 29px;
    align-items: flex-start;

    & > div,
    & > div > div {
      align-items: flex-start;
    }

    .bolt-button,
    .bolt-split-button {
      margin-top: 3px;
    }

    .bolt-split-button .bolt-button {
      margin-top: 0;
    }
  }

  /* The file's name, counts and path: a sunken grey field filling the toolbar's middle. */
  .repos-compare-toolbar:has(.repos-compare-removed-lines, .repos-compare-added-lines)
    > div
    > div:has(> .margin-left-16) {
    flex: 1;
    min-width: 0;
    height: 29px;
    margin: 0 0 0 4px;

    & > .margin-left-16 {
      flex: 1;
      height: 29px;
      margin: 0;
      padding: 1px 6px 0;
      box-shadow: var(--win98-well);
    }

    .flex-row {
      gap: 8px;
    }

    .repos-compare-removed-lines,
    .repos-compare-added-lines {
      font-weight: 700;
    }

    .repos-compare-removed-lines {
      color: #c00000;
    }

    .repos-compare-added-lines {
      color: #008000;
    }
  }

  .repos-compare-toolbar .bolt-header-commandbar-button-group {
    gap: 2px;
  }

  .repos-compare-toolbar .bolt-header-commandbar-button-group > * {
    margin: 0;
  }

  /* The tree's selected row: navy, its checkbox and menu button drawn as on other rows. */
  .repos-changes-explorer-tree tr.bolt-tree-row.selected {
    background: var(--win98-navy);
    color: #fff;

    .bolt-table-button-more .bolt-button.bolt-button {
      width: 16px;
      height: 16px;
      min-width: 0;
      padding: 0;
      background: var(--win98-face);
      box-shadow: var(--win98-raised);
      color: #000;
    }
  }

  .repos-changes-explorer-tree .bolt-table-button-more .bolt-button {
    width: 16px;
    height: 16px;
    min-width: 0;
    padding: 0;
  }

  /* The diff editor: a grey gutter with Tahoma numbers, then the code in Courier New. */
  .monaco-editor .margin,
  .monaco-editor .margin-view-overlays {
    background: var(--win98-light);
  }

  .monaco-editor .line-numbers {
    color: #404040;
    font-family: var(--win98-font);
    font-size: 11px;
    line-height: 18px;
  }

  /* Code on Monaco's 18px rows, centred as the line numbers are. */
  .monaco-editor .view-line,
  .monaco-editor .view-line * {
    font-family: var(--win98-mono);
    line-height: 18px;
  }

  .monaco-editor .current-line,
  .monaco-editor .current-line-margin-both {
    border: 0;
    background: transparent;
  }

  .monaco-editor .line-insert,
  .monaco-diff-editor .line-insert {
    background: #cfc;
  }

  .monaco-editor .char-insert,
  .monaco-diff-editor .char-insert {
    background: #9e9;
  }

  .monaco-editor .line-delete,
  .monaco-diff-editor .line-delete {
    background: #fcc;
  }

  .monaco-editor .char-delete,
  .monaco-diff-editor .char-delete {
    background: #f99;
  }
}

/* Azure DevOps spaces children with rhythm-* margins; Windows 98 mode spaces them with its own
   gaps instead, so the margins would add up. :where() keeps these below every rule above. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body,
html[data-fix-ado-win98]
  :is(
    .project-header,
    .top-level-header,
    .navigation-container,
    .bolt-portal-host,
    .fix-ado-settings
  ) {
  :where([class*="rhythm-horizontal-"]) > :where(:not(:first-child)) {
    margin-left: 0;
  }

  :where([class*="rhythm-vertical-"]) > :where(:not(:first-child)) {
    margin-top: 0;
  }
}

html[data-fix-ado-win98="pull-request"] body .repos-editor-discussion {
  /* No light frame of its own around the thread window: the code shows up to its edge. */
  border-color: transparent;
  background: transparent;

  /* A thread beside the code: a Win98 small window on the window face. */
  .repos-discussion-thread {
    padding: 3px;
    border: 0;
    border-radius: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
  }

  .repos-comment-viewer,
  .repos-discussion-comment,
  .repos-discussion-thread-reply {
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .repos-discussion-comment-header .padding-right-8 {
    font-weight: 700;
  }

  /* Code in a comment: a sunken white well in Courier New. */
  .markdown-content pre {
    border: 0;
    border-radius: 0;
    background: #fff;
    box-shadow: var(--win98-sunken);
  }

  /* The thread's status: a small raised drop-down button. */
  .repos-discussion-comment-header .bolt-dropdown-expandable .bolt-button.bolt-button {
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
  }
}

html[data-fix-ado-win98="pull-request"]
  body
  .repos-compare-toolbar:has(.repos-compare-removed-lines, .repos-compare-added-lines)
  .bolt-header-command-item-button.bolt-button.bolt-button {
  /* In the 29px toolbar, tool buttons sit 3px down like the others. */
  margin-top: 3px;
}

html[data-fix-ado-win98="pull-request"] body button.repos-changes-explorer-tree-root-content {
  /* The tree's top bar is one flat row on its raised bar, without the browser's button frame. */
  border: 0;
  background: transparent;
}

/* Keyboard focus as in Win98. Azure DevOps draws focus as a box-shadow ring, which replaces the
   bevel. A focused tab keeps its shape, with a dotted rectangle around its label. A focused
   button keeps its bevel, gets a 1px black frame, and a dotted rectangle inside the bevel.
   Azure DevOps marks keyboard focus with a class on body itself, which these nested rules can't
   reach, so they use :focus and :focus-visible. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body,
html[data-fix-ado-win98] .bolt-portal-host {
  .bolt-tab.focus-treatment:is(:focus, .focused) {
    border: 0;
    border-radius: 3px 3px 0 0;
    outline: none;
    box-shadow:
      inset 1px 1px #fff,
      inset -1px 0 var(--win98-dark),
      inset -2px 0 var(--win98-shadow);
    color: #000;
    animation: none;
  }

  .bolt-tab:is(:focus-visible, .focused) .bolt-tab-text {
    outline: 1px dotted #000;
  }

  .bolt-button.bolt-focus-treatment:focus {
    border-color: transparent;
    outline: none;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
    color: #000;
    animation: none;
  }

  .bolt-button:focus-visible,
  .bolt-button.bolt-focus-treatment:focus-visible {
    box-shadow: var(--win98-default);
    outline: 1px dotted #000;
    outline-offset: -4px;
  }

  .bolt-button.bolt-focus-treatment:focus:is(
      :active,
      .active,
      [aria-pressed="true"],
      [aria-expanded="true"]
    ) {
    box-shadow:
      inset 0 0 0 1px #000,
      inset -2px -2px var(--win98-shadow),
      inset 2px 2px var(--win98-shadow);
  }

  .bolt-button.bolt-focus-treatment.subtle:focus:not(:hover, :active, [aria-expanded="true"]) {
    background: transparent;
    box-shadow: none;
    outline-offset: -2px;
  }

  /* A split button: the frame goes around the whole control, the dotted line inside the part. */
  .bolt-split-button .bolt-button.bolt-button:is(:focus, :focus-visible) {
    background: transparent;
    box-shadow: none;
    outline-offset: -3px;
  }

  .bolt-split-button:has(.bolt-button:focus-visible):not(
      :has(.bolt-button:active, .bolt-button[aria-expanded="true"])
    ) {
    box-shadow: var(--win98-default);
  }

  /* Checkboxes, links and pills: only the dotted rectangle, no ring. */
  :is(.bolt-checkbox, .bolt-link, .bolt-pill):focus {
    outline: 1px dotted #000;
    outline-offset: 0;
    animation: none;
  }

  :is(.bolt-checkbox, .bolt-link):focus {
    box-shadow: none;
  }

  /* Links have no hover fill: Win98 has no hover state. */
  .bolt-link:hover {
    background-color: transparent;
  }

  .bolt-pill:focus {
    border-color: transparent;
    box-shadow: var(--win98-well);
  }

  /* The top bar's items: a dotted rectangle on focus, nothing on the selected one. */
  .commandbar-item.selected::after {
    border: 0;
  }

  .commandbar-item:focus::after {
    border: 1px dotted #000;
  }
}

/* A file card's header sticks inside the changes pane's padding, so code would show above it
   and beside it. White bands over the padding hide it; the first four layers redraw the card's
   grey frame around the header. The top band stops 1px short of the 12px gap between cards. */
html[data-fix-ado-win98="pull-request"] body .repos-summary-header.bolt-card > div:first-child {
  box-shadow:
    inset -1px -1px var(--win98-shadow),
    inset 1px 1px #fff,
    0 -1px var(--win98-shadow),
    -1px 0 var(--win98-shadow),
    1px 0 var(--win98-shadow),
    -1px -1px var(--win98-shadow),
    1px -1px var(--win98-shadow),
    0 -11px #fff,
    -10px 0 #fff,
    10px 0 #fff,
    -10px -11px #fff,
    10px -11px #fff;
}

/* With a file selected, the diff editor is a card: no group box frame inside the sunken pane. */
html[data-fix-ado-win98="pull-request"]
  body
  .repos-changes-viewer
  > .bolt-card.no-padding:not(.repos-summary-header) {
  border-color: #fff;
  box-shadow: none;
}

/* The Files tree shows every row's checkbox, as a Win98 checked tree view does, not only on hover. */
html[data-fix-ado-win98="pull-request"]
  body
  .repos-changes-explorer-tree
  .bolt-table-cell-content-reveal {
  visibility: visible;
}

/* While Viewed files reads the tree, face-grey bars stand in for its rows, two to every 40px,
   on the white well. The rows' checkboxes hide with the rows. */
html[data-fix-ado-win98="pull-request"]
  body
  .repos-changes-explorer-splitter
  .v-scroll-auto.fix-ado-viewed-tree-loading {
  background:
    linear-gradient(var(--win98-face) 0 8px, transparent 8px) 24px 8px / 60% 40px repeat-y,
    linear-gradient(var(--win98-face) 0 8px, transparent 8px) 40px 28px / 45% 40px repeat-y,
    #fff;

  .bolt-table-cell-content-reveal {
    visibility: hidden;
  }
}

/* The pull request list draws no lines between rows. The site's 1px cell border would shift
   each row's centred content by half a pixel and blur its text. */
html[data-fix-ado-win98="pull-request-list"]
  body
  .repos-pr-list.bolt-table-show-lines
  .bolt-list-row
  > td {
  border-top-width: 0;
}

/* The description's text: 14px lines, 16px between paragraphs. Mentions are plain hyperlinks
   with their icon, and a work item's state is a small square, as in the work items panel.
   A work item's rich text and comments read the same. */
html[data-fix-ado-win98="pull-request"] body .repos-pr-description-card .markdown-content,
html[data-fix-ado-win98="work-item"] body .markdown-content,
html[data-fix-ado-win98] .work-item-form-dialog .markdown-content {
  line-height: 14px;

  p,
  ul,
  ol {
    margin: 0 0 16px;
  }

  .mention-widget-workitem-state {
    margin: 0;
  }

  /* Inline code is Courier New without a chip; table rows are 18px, list items 4px apart. */
  code {
    padding: 0;
    border-radius: 0;
    background: transparent;
    font: 12px / 14px var(--win98-mono);
    vertical-align: top;
  }

  table {
    margin: 0 0 16px;
    border-collapse: collapse;
    border-spacing: 0;
  }

  tr {
    line-height: 14px;
  }

  :is(td, th) {
    padding: 2px 13px;
    border: 0;
    line-height: 14px;
  }

  /* The header row: bold, with a grey line under it. */
  th {
    padding-bottom: 1px;
    box-shadow: inset 0 -1px var(--win98-shadow);
    font-weight: 700;
    text-align: left;
  }

  li {
    margin: 0 0 4px;
    line-height: 14px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  & > :last-child {
    margin-bottom: 0;
  }

  h2 {
    line-height: 16px;
  }

  :is(.mention-widget-item, .mention-link) {
    display: inline-flex;
    align-items: center;
    height: 14px;
    vertical-align: top;
    padding: 0;
    border: 0;
    background: transparent;
    color: #0000ee;
    text-decoration: underline;
  }

  :is(
    .mention-widget-typeid,
    .mention-widget-title,
    .mention-workitem-id-no-flex,
    .mention-widget-workitem-title
  ) {
    color: #0000ee;
    font-weight: 400;
  }

  .mention-widget-workitem-state-divider {
    display: none;
  }
}

/* A work item's state: a small square with a black edge, as in the work items panel. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body .work-item-state-circle {
  width: 8px;
  height: 8px;
  border: 0;
  border-radius: 0;
  box-shadow: 0 0 0 1px #000;
}

/* Status icons: start */
/* Status icons: Windows 98 pixel icons in place of Azure DevOps's round ones and the script's
   pipeline icons. Each one fills its icon's box, and the round shapes inside are hidden.
   Generated from the pixel maps the design kit draws them from. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body,
html[data-fix-ado-win98] .bolt-portal-host {
  :is(svg.bolt-status, .fix-ado-pipeline-status) {
    border-radius: 0;
    background: center / 100% 100% no-repeat;
    box-shadow: none;
    image-rendering: pixelated;
    animation: none;
    opacity: 1;

    & > * {
      visibility: hidden;
    }
  }

  /* A 24px status icon is the 16px one, centred, so every status icon has one size. */
  svg.bolt-status[width="24"] {
    background-size: 16px 16px;
  }

  :is(svg.bolt-status.success, .fix-ado-pipeline-status[data-status="succeeded"]) {
    background-image: var(--win98-icon-passed);
  }

  :is(svg.bolt-status.failed, .fix-ado-pipeline-status[data-status="failed"]) {
    background-image: var(--win98-icon-failed);
  }

  :is(svg.bolt-status.warning, .fix-ado-pipeline-status[data-status="expired"]) {
    background-image: var(--win98-icon-warning);
  }

  :is(
    svg.bolt-status.active,
    svg.bolt-status.running,
    svg.bolt-status.queued,
    svg.bolt-status.waiting,
    .fix-ado-pipeline-status[data-status="running"],
    .fix-ado-pipeline-status[data-status="queued"]
  ) {
    background-image: var(--win98-icon-waiting);
  }

  :is(
    svg.bolt-status.neutral,
    svg.bolt-status.skipped,
    svg.bolt-status.canceled,
    svg.bolt-status.cancelled,
    .fix-ado-pipeline-status[data-status="notStarted"],
    .fix-ado-pipeline-status[data-status="none"],
    .fix-ado-pipeline-status[data-status="loading"],
    .fix-ado-pipeline-status[data-status="cancelling"]
  ) {
    background-image: var(--win98-icon-none);
  }

  :is(svg.bolt-status.system-task, svg.bolt-status.information, svg.bolt-status.info) {
    background-image: var(--win98-icon-info);
  }

  /* The star of a starred reviewer: yellow when starred, a grey outline when not. */
  .fix-ado-star-icon {
    width: 16px;
    height: 16px;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23808080' d='M7 0h1v1h-1zM6 1h1v1h-1zM8 1h1v1h-1zM6 2h1v1h-1zM8 2h1v1h-1zM5 3h1v1h-1zM9 3h1v1h-1zM0 4h6v1h-6zM9 4h6v1h-6zM1 5h1v1h-1zM13 5h1v1h-1zM2 6h1v1h-1zM12 6h1v1h-1zM3 7h1v1h-1zM11 7h1v1h-1zM4 8h1v1h-1zM10 8h1v1h-1zM4 9h1v1h-1zM10 9h1v1h-1zM3 10h1v1h-1zM7 10h1v1h-1zM11 10h1v1h-1zM3 11h1v1h-1zM6 11h3v1h-3zM11 11h1v1h-1zM2 12h1v1h-1zM5 12h2v1h-2zM8 12h2v1h-2zM12 12h1v1h-1zM2 13h1v1h-1zM4 13h2v1h-2zM9 13h2v1h-2zM12 13h1v1h-1zM1 14h3v1h-3zM11 14h3v1h-3z'/%3E%3C/svg%3E")
      center / 16px no-repeat;

    & > * {
      visibility: hidden;
    }
  }

  :is(.fix-ado-star[aria-pressed="true"] .fix-ado-star-icon, .fix-ado-starred-chips-icon) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000000' d='M7 0h1v1h-1zM6 1h1v1h-1zM8 1h1v1h-1zM6 2h1v1h-1zM8 2h1v1h-1zM5 3h1v1h-1zM9 3h1v1h-1zM0 4h6v1h-6zM9 4h6v1h-6zM1 5h1v1h-1zM13 5h1v1h-1zM2 6h1v1h-1zM12 6h1v1h-1zM3 7h1v1h-1zM11 7h1v1h-1zM4 8h1v1h-1zM10 8h1v1h-1zM4 9h1v1h-1zM10 9h1v1h-1zM3 10h1v1h-1zM7 10h1v1h-1zM11 10h1v1h-1zM3 11h1v1h-1zM6 11h3v1h-3zM11 11h1v1h-1zM2 12h1v1h-1zM5 12h2v1h-2zM8 12h2v1h-2zM12 12h1v1h-1zM2 13h1v1h-1zM4 13h2v1h-2zM9 13h2v1h-2zM12 13h1v1h-1zM1 14h3v1h-3zM11 14h3v1h-3z'/%3E%3Cpath fill='%23ffff00' d='M7 1h1v1h-1zM7 2h1v1h-1zM6 3h3v1h-3zM6 4h3v1h-3zM2 5h11v1h-11zM3 6h9v1h-9zM4 7h7v1h-7zM5 8h5v1h-5zM5 9h5v1h-5zM4 10h3v1h-3zM8 10h3v1h-3zM4 11h2v1h-2zM9 11h2v1h-2zM3 12h2v1h-2zM10 12h2v1h-2zM3 13h1v1h-1zM11 13h1v1h-1z'/%3E%3C/svg%3E");
  }
}
/* Status icons: end */

/* The Commits tab: the commits are a Win98 list box, one two-line row per commit. The title
   is bold; under it the id in Courier, the author's avatar, name and the time, 6px apart. */
html[data-fix-ado-win98="pull-request"] body .bolt-card.bolt-table-card:has(.repos-commits-table) {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;

  .bolt-card-content {
    margin: 0;
    padding: 0;
  }

  .bolt-table-container {
    padding: 2px;
    background: #fff;
    box-shadow: var(--win98-sunken);
  }
}

html[data-fix-ado-win98="pull-request"] body .repos-commits-table {
  :is(colgroup, .bolt-list-row-spacer, .bolt-table-spacer-cell, td.bolt-table-cell-compact) {
    display: none;
  }

  .bolt-table-two-line-cell {
    width: 100%;
  }

  .bolt-table-row {
    height: 44px;
  }

  td {
    padding: 0;
    border: 0;
  }

  .repos-commits-table-content {
    height: 44px;
    justify-content: center;
    gap: 4px;
    padding: 0 10px;
  }

  .bolt-table-two-line-cell-item {
    margin: 0;
    padding: 0;
  }

  .bolt-table-link {
    padding: 0;
    color: #000;
  }

  .commit-title {
    font-weight: 700;
    line-height: 14px;
  }

  .body-s {
    flex-wrap: nowrap;
    height: 16px;
    gap: 6px;
    color: #404040;
    font-size: 11px;
    line-height: 14px;
  }

  .rhythm-horizontal-4 {
    gap: 6px;
  }

  .monospaced-xs {
    color: #000;
    font-family: var(--win98-mono);
    font-size: 12px;
  }

  .bolt-coin.size16 {
    width: 16px;
    height: 16px;
  }
}

/* New pull request: the branches are combo boxes, the tabs sit on a raised panel and the form
   is a group box. The description is a 110px text area, and its toolbar flat toolbar buttons. */
html[data-fix-ado-win98="pull-request-create"] body {
  .repos-pr-create-header {
    margin: 0;
    padding: 12px 16px 0;

    & > .flex-column {
      gap: 6px;
    }

    & > .flex-column > .flex-row {
      height: 23px;
      gap: 6px;
    }

    .margin-right-8,
    .margin-left-8 {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 0;
    }
  }

  .repos-pr-create-header-first-row {
    padding: 0;
    font-size: 13px;
    font-weight: 700;
    line-height: 16px;
  }

  .bolt-tab .bolt-pill {
    margin-left: 0;
  }

  .version-dropdown .bolt-dropdown-expandable-button-label > .flex-row {
    gap: 4px;
  }

  .version-dropdown > .bolt-button.bolt-button.subtle {
    width: 160px;
    height: 21px;
    justify-content: flex-start;
    gap: 4px;
    padding: 0 2px 0 4px;
    background: #fff;
    box-shadow: var(--win98-sunken);
    font-weight: 700;

    & > .fluent-icons-enabled:last-child {
      width: 17px;
      height: 17px;
      margin-left: auto;
      background:
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='4' shape-rendering='crispEdges'%3E%3Cpath d='M0 0h7v1H0zM1 1h5v1H1zM2 2h3v1H2zM3 3h1v1H3z'/%3E%3C/svg%3E")
          center / 7px 4px no-repeat,
        var(--win98-face);
      box-shadow: var(--win98-raised);

      & > * {
        visibility: hidden;
      }
    }
  }

  .repos-pr-create-header .bolt-button.icon-only {
    width: 23px;
    height: 23px;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
  }

  .repos-pr-create-form {
    width: auto;
    max-width: none;
    margin: 0 16px;
    padding: 14px 12px 12px;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);

    & > .bolt-card {
      width: 736px;
      margin: 0;
    }
  }

  textarea.repos-pr-create-description:not(.bolt-textfield-auto-adjust-hidden) {
    min-height: 110px;
  }

  .repos-pr-create-form .bolt-textfield-counter {
    margin-top: 6px;
  }

  .bolt-tabbar {
    margin: 8px 16px 0;
    padding: 0;
  }

  .repos-pr-create-form .bolt-card-content > .flex-grow {
    gap: 10px;

    & > .flex-column {
      gap: 6px;
    }
  }

  .repos-pr-create-form .bolt-header-commandbar {
    height: 14px;
    margin: 0;
    padding: 0;
  }

  .repos-pr-create-form .bolt-formitem-label {
    margin: 0;
  }

  .repos-pr-create-form
    .bolt-card-content
    > .flex-grow
    > .flex-column
    > .flex-row.flex-center:not(.fix-ado-starred-chips) {
    height: 14px;
  }

  .repos-pr-create-form .bolt-formitem-message {
    margin-top: 6px;
  }

  .repos-pr-create-form .markdown-toolbar {
    height: 23px;
    align-items: center;
  }

  .repos-pr-create-form .bolt-tag-picker {
    height: 21px;
    padding: 0 3px;
  }

  .region-createPullRequestOverviewExtensions {
    & > .flex-column {
      gap: 6px;
    }

    & > .flex-column > .flex-row.flex-center {
      height: 16px;
    }

    .bolt-pill {
      margin-left: 4px;
    }

    .bolt-link {
      padding: 0;
      color: #0000ee;
      text-decoration: underline;
    }

    .bolt-table-two-line-cell-item {
      height: 16px;
    }

    .bolt-table-container {
      height: 52px;
    }

    .bolt-table td {
      border-top-width: 0;
    }

    .bolt-table-two-line-cell > .bolt-table-cell-content {
      padding: 4px 12px;
    }
  }

  .repos-pr-create-form .bolt-card-content > .flex-grow > .justify-end {
    gap: 6px;
    margin-top: 2px;

    .bolt-checkbox {
      gap: 6px;
      padding: 0;
    }

    .bolt-checkbox-label {
      padding: 0;
    }
  }

  .markdown-text-container .flex-center {
    gap: 4px;

    .fluent-icons-enabled {
      width: 12px;
    }
  }

  .repos-pr-create-form > .bolt-card {
    padding: 10px 12px;

    & > .bolt-card-content {
      padding: 0;
    }
  }

  .repos-pr-create-form .bolt-header-commandbar .bolt-button.bolt-button {
    margin: 0;
    min-width: 0;
    height: auto;
    gap: 4px;
    padding: 0;
    background: transparent;
    box-shadow: none;
  }

  .markdown-toolbar .bolt-button.bolt-button {
    width: 22px;
    min-width: 0;
    height: 22px;
    padding: 0;
    background: transparent;
    box-shadow: none;
  }
}

/* People search results, such as the reviewer search and the star picker, drop down as a Win98
   list: white in a black frame with a shadow, one 32px row per person with the avatar, name and
   mail. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""])
  :is(.bolt-portal-host, .fix-ado-star-picker-callout) {
  :is(.bolt-tag-picker-callout-content, .bolt-identitypickerdropdown-callout-content) {
    padding: 2px 0;
    background: #fff;
    box-shadow:
      0 0 0 1px #000,
      2px 2px 0 1px rgba(0, 0, 0, 0.35);
  }

  .bolt-suggestion-spacer {
    display: none;
  }

  .bolt-suggestions-item {
    height: 32px;
    padding: 0 8px;
  }

  .bolt-picker-suggesteditem-text {
    gap: 8px;
  }

  .bolt-suggestions-item-button {
    height: 32px;
    padding: 0;

    & > .flex-row {
      height: 32px;
      align-items: center;
    }
  }

  .bolt-picker-suggesteditem {
    height: 32px;
  }

  .bolt-picker-persona-name {
    justify-content: center;

    & > * {
      line-height: 14px;
    }
  }

  .bolt-contact-card-button.bolt-button {
    width: 22px;
    min-width: 0;
    height: 22px;
    padding: 0;
    background: transparent;
    box-shadow: none;
  }
}

/* Starred reviewers on a new pull request: each one a small raised push button with its
   16px avatar and name, after the star. One click adds the person, as before. */
html[data-fix-ado-win98]:not([data-fix-ado-win98=""]) body .fix-ado-starred-chips {
  height: 20px;
  gap: 4px;

  .fix-ado-starred-chip-list {
    gap: 4px;
  }

  .fix-ado-starred-chip.bolt-pill {
    height: 20px;
    margin: 0;
    padding: 0 6px 0 3px;
    gap: 4px;
    border: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
    color: #000;

    &:active {
      box-shadow: var(--win98-pressed);
    }
  }

  .bolt-pill-filled-visual {
    width: 16px;
    height: 16px;
    margin: 0;
  }

  .bolt-coin.size20 {
    width: 16px;
    height: 16px;
  }

  .bolt-pill-content {
    padding: 0;
  }
}

/* A starred person's star lines up with the reviewers' stars above it. */
html[data-fix-ado-win98="pull-request"] body .fix-ado-starred-reviewer > .fix-ado-star {
  margin-right: 20px;
}

/* The Overview's timeline: dotted grey connector lines, as in a Win98 tree view, and each event
   a 7px white square with a grey edge. */
html[data-fix-ado-win98="pull-request"] body .activity-feed-list {
  :is(.bolt-timeline-icon-prefix, .bolt-timeline-icon-suffix) {
    border-left: 1px dotted var(--win98-shadow);
  }

  .activity-feed-timeline-iteration {
    font: 700 11px / 22px var(--win98-font);
  }

  :has(> .text-ellipsis > .activity-card-time) {
    align-self: center;
  }

  /* A push row's time lines up with the other rows' times. */
  .iteration-card-header :has(> .text-ellipsis > .bolt-time-item) {
    margin-right: 20px;
  }

  .activity-feed-timeline-dot {
    width: 7px;
    height: 7px;
    border: 0;
    border-radius: 0;
    background: #fff;
    box-shadow: inset 0 0 0 1px var(--win98-shadow);
  }
}

/* A thread's title bar on the Overview: its action buttons are caption buttons, 16 by 14 and
   2px apart, and its status a small 18px drop-down button. */
html[data-fix-ado-win98="pull-request"] body .activity-feed-list .repos-discussion-comment-header {
  & > .justify-end {
    gap: 2px;
    padding-right: 2px;
  }

  .bolt-button.bolt-button {
    min-width: 16px;
    height: 14px;
    margin: 0;
    padding: 0 2px;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
    color: #000;

    .fluent-icons-enabled {
      height: 12px;
      font-size: 10px;
    }
  }

  .bolt-dropdown-expandable > .bolt-button.bolt-button {
    height: 18px;
    padding: 0 2px 0 6px;
  }
}

/* A comment's buttons on the window face, as in the MainUnread artboard: as tall as the status
   drop-down, 22px wide at least and 4px apart. Title bars keep their caption buttons. */
html[data-fix-ado-win98="pull-request"] body .activity-feed-list {
  .comment-file-header + [data-fix-ado-thread="open"] > .repos-comment-viewer,
  [data-fix-ado-thread="open"]:not(.comment-file-header + *)
    > .repos-comment-viewer:not(:first-child) {
    .repos-discussion-comment-header > .justify-end {
      gap: 4px;
    }

    .repos-discussion-comment-header .bolt-button.bolt-button {
      min-width: 22px;
      height: 18px;
      padding: 0 4px;
    }
  }
}

/* Code in a comment on the Overview: a sunken white well in Courier New, as in the Files tab,
   with its copy button beside it on the window face. */
html[data-fix-ado-win98="pull-request"] body .activity-feed-list .copy-btn-container {
  background: transparent;
}

html[data-fix-ado-win98="pull-request"] body .activity-feed-list .markdown-content pre {
  border: 0;
  border-radius: 0;
  background: #fff;
  box-shadow: var(--win98-sunken);

  code {
    background: transparent;
  }
}

/* Threads on the Overview, as in the MainThreads and MainThreadReply artboards: each a small
   window. Collapsed, it is one grey title bar: +/- box, the author's coin as window icon, name,
   time, and the status chip at the right end. Open, its file header is the navy title bar, the
   code a sunken white well, the comments sit on the window face, and the reply closes it. */
html[data-fix-ado-win98="pull-request"] body .activity-feed-list {
  /* Azure DevOps keeps a thread row at its old height while a reply is open; the window sets it. */
  .padding-bottom-16:has(> .bolt-card [data-fix-ado-thread]) {
    min-height: 0 !important;
  }

  .bolt-card:has(.comment-file-header, [data-fix-ado-thread]) {
    border: 0;
    border-radius: 0;
    background: var(--win98-face);
    box-shadow: var(--win98-window);

    /* The card's own padding is held at 0 by Azure DevOps, so the frame's 3px sit inside it. */
    & > .bolt-card-content {
      padding: 3px;
      border: 0;
      background: transparent;
      box-shadow: none;
    }
  }

  [data-fix-ado-thread] {
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;

    .repos-comment-viewer,
    .repos-discussion-comment,
    .repos-discussion-thread-reply {
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
    }

    /* Unread comments keep their yellow box, 2px past their edges. */
    .repos-comment-viewer[data-fix-ado-unread] {
      background: var(--win98-tooltip);
      box-shadow: 0 0 0 2px var(--win98-tooltip);
    }
  }

  /* The thread clips what spills out; its unread box reaches 2px past the comments. */
  [data-fix-ado-thread]:has([data-fix-ado-unread]) {
    overflow: clip;
    overflow-clip-margin: 2px;
  }

  /* Times stay whole: overflow would cut the left edge of Tahoma's first letter. */
  .text-ellipsis:has(> time) {
    overflow: visible;
  }

  .bolt-pill.fix-ado-thread-chip {
    padding: 0 4px;

    .bolt-pill-content {
      padding: 0;
    }
  }

  .bolt-pill.fix-ado-unresolved-chip {
    font-weight: 700;
  }

  /* The timeline icon of a thread row sits beside its title bar. */
  tr:has([data-fix-ado-thread]) {
    .bolt-timeline-icon-prefix {
      height: 1px;
      min-height: 0;
    }

    .bolt-timeline-icon-suffix {
      min-height: 0;
    }
  }

  /* Collapsed: the first comment's row is the title bar. */
  [data-fix-ado-thread="collapsed"]
    > .repos-comment-viewer:first-child
    > .repos-discussion-comment
    > .flex-column
    > .flex-row {
    height: 18px;
    align-items: center;
    gap: 4px;
    padding: 0 2px 0 3px;
    background: var(--win98-title-inactive);
    color: #fff;

    .fix-ado-thread-toggle {
      margin: 0;
    }

    & > div:has(> .bolt-coin) {
      width: auto;
      display: flex;
    }

    .bolt-coin,
    .bolt-coin-content {
      width: 16px;
      height: 16px;
      margin: 0;
      font-size: 8px;
    }

    .repos-comment-editor-fit {
      padding: 0;
    }

    .repos-discussion-comment-header {
      height: 18px;
      margin: 0;
      padding: 0;
      background: none;

      & > .scroll-hidden {
        flex: 1;
        gap: 4px;
      }

      & > .scroll-hidden > div:last-child {
        flex: 1;
        margin: 0;
        gap: 4px;
      }

      .padding-right-8 {
        padding: 0;
        font-weight: 700;
      }

      :is(.padding-right-8, time) {
        color: #fff;
      }

      time {
        margin: 0;
      }

      .fix-ado-thread-chip {
        height: 14px;
        margin-left: auto;
      }
    }
  }

  /* Open file thread: the file header is the navy title bar. */
  .comment-file-header:has(+ [data-fix-ado-thread="open"]) {
    padding: 0;
    border: 0;
    background: transparent;

    .comment-file-header-title {
      height: 18px;
      margin: 0;
      padding: 0 2px 0 3px;
      align-items: center;
      gap: 4px;
      background: var(--win98-title);
      color: #fff;
      white-space: nowrap;

      .fix-ado-thread-toggle.fix-ado-thread-toggle {
        width: 13px;
        margin: 0;
        padding: 0;
      }

      & > .secondary-text {
        display: flex;
        width: 16px;
        height: 16px;
        margin: 0;
        overflow: hidden;
      }

      & > .flex-column {
        min-width: 0;
        flex-direction: row;
        align-items: center;
        gap: 4px;
      }

      /* A long path ends in an ellipsis before the file name does. */
      .comment-file-header-link {
        min-width: 0;
      }

      .comment-file-header-link + .secondary-text {
        min-width: 0;
        flex-shrink: 1000;
      }

      :is(.comment-file-header-link, .secondary-text, time) {
        margin: 0;
        color: #fff;
        line-height: 14px;
      }

      .comment-file-header-link {
        font-weight: 700;
      }

      & > .flex-row {
        gap: 6px;
      }

      /* The iteration it was made on: a small raised button on the title bar. */
      .bolt-button:not(.fix-ado-thread-toggle) {
        height: 14px;
        min-width: 16px;
        padding: 0 3px;
        background: var(--win98-face);
        box-shadow: var(--win98-raised);
        color: #000;
      }
    }

    /* The code: up/down boxes beside a sunken white well. */
    .comment-file-diff-container {
      margin: 0;
      padding: 6px 3px 0;
      border: 0;
      gap: 4px;
    }

    .code-view-buttons {
      width: 13px;
      padding: 0;
      justify-content: space-between;

      & > div {
        padding: 0;
      }
    }

    .expand-code-button {
      width: 13px;
      height: 13px;
      min-width: 0;
      padding: 0;
      background: var(--win98-face);
      box-shadow: var(--win98-raised);
    }

    .repos-summary-code-diff {
      flex: 1;
      margin: 0;
      padding: 2px;
      background: #fff;
      box-shadow: var(--win98-sunken);
    }
  }

  /* Open thread without a file, as in the ThreadTitleBars artboard: its first comment's header is
     the navy title bar, one line across the whole window: the +/- box, the author's coin, name,
     time and chip. The thread's buttons sit in a toolbar under it, above an etched line. */
  [data-fix-ado-thread="open"]:not(.comment-file-header + *) {
    padding: 0 0 5px;

    & > .repos-comment-viewer:first-child > .repos-discussion-comment > .flex-column > .flex-row {
      position: relative;

      & > div:has(> .bolt-coin) {
        width: 0;
      }

      .fix-ado-thread-toggle {
        position: absolute;
        top: 3px;
        left: 3px;
        margin: 0;
      }

      & > div:has(> .bolt-coin) > .bolt-coin {
        position: absolute;
        top: 1px;
        left: 20px;
        z-index: 1;
        margin: 0;
      }

      .repos-comment-editor-fit {
        min-width: 0;
        padding: 0;
      }

      .repos-discussion-comment-header {
        height: 18px;
        margin: 0;
        padding: 0 2px 0 40px;
        white-space: nowrap;

        & > .scroll-hidden > div:last-child {
          margin: 0;
          gap: 6px;
        }

        time {
          margin: 0;
          font-weight: 400;
        }

        .fix-ado-thread-chip {
          height: 14px;
          margin: 0;
        }
      }

      /* The toolbar: link and work item on the left, the status drop-down at the right end. */
      .repos-discussion-comment-header > .justify-end {
        position: absolute;
        top: 18px;
        right: 0;
        left: 0;
        height: 28px;
        padding: 0 3px 2px;
        gap: 2px;
        box-shadow:
          inset 0 -1px #fff,
          inset 0 -2px var(--win98-shadow);

        .bolt-button.bolt-button {
          min-width: 22px;
          height: 18px;
          padding: 0 4px;
        }

        /* Edit, delete and like show only on hover: they follow the two that always show. */
        & > :not(.repos-discussion-comment-auto-hide-button) {
          order: -1;
        }

        .bolt-dropdown-expandable {
          order: 0;
          margin-left: auto;
        }

        .bolt-dropdown-expandable > .bolt-button.bolt-button {
          padding: 0 2px 0 6px;
          font-weight: 400;
        }
      }

      .markdown-content {
        margin-top: 34px;
        padding: 0 6px;
      }
    }
  }

  /* A title bar is one line, also where Azure DevOps puts the time under a long name: the name
     ends in an ellipsis, the time and chip stay whole, and the coin is 16px, initials too. */
  [data-fix-ado-thread="collapsed"],
  [data-fix-ado-thread="open"]:not(.comment-file-header + *) {
    & > .repos-comment-viewer:first-child > .repos-discussion-comment > .flex-column > .flex-row {
      & > div:has(> .bolt-coin) > .bolt-coin,
      & > div:has(> .bolt-coin) > .bolt-coin > .bolt-coin-content {
        width: 16px;
        height: 16px;
        font-size: 8px;
        line-height: 16px;
      }

      /* The initials feature sized them for the avatar before it shrank. */
      & > div > [data-fix-ado-initials]::after {
        font-size: 8px;
      }

      .repos-discussion-comment-header > .scroll-hidden {
        gap: 4px;
      }
    }
  }

  /* Every comment's header is one line, where Azure DevOps puts the time under a long name:
     the name ends in an ellipsis, the time and chip stay whole. */
  [data-fix-ado-thread] {
    .repos-comment-editor-fit:has(> .repos-discussion-comment-header) {
      min-width: 0;
    }

    .repos-discussion-comment-header > .scroll-hidden {
      min-width: 0;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: center;

      .padding-right-8 {
        min-width: 0;
        margin: 0;
        padding: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      & > div:last-child {
        flex-shrink: 0;
      }
    }
  }

  /* Open thread: comments on the window face, the reply under an etched line. */
  .comment-file-header + [data-fix-ado-thread="open"] {
    padding: 0 3px 5px;

    .repos-discussion-comment {
      margin-top: 8px;

      & > .flex-column > .flex-row > div:has(> .bolt-coin) {
        width: 30px;
      }

      .bolt-coin {
        width: 24px;
        margin: 0;
      }
    }

    .repos-comment-editor-fit {
      padding: 0;
    }

    .repos-discussion-comment-header {
      height: 20px;
      margin: 0;
      padding: 0;

      & > .scroll-hidden {
        gap: 6px;
      }

      & > .scroll-hidden > div:last-child {
        margin: 0;
        gap: 6px;
      }

      .padding-right-8 {
        padding: 0;
        font-weight: 700;
      }

      time {
        margin: 0;
        color: #404040;
      }

      .fix-ado-thread-chip {
        height: 14px;
        margin: 0;
      }
    }

    .markdown-content {
      margin-top: 6px;
      padding: 0;

      & > p {
        margin: 0;
      }

      .copy-btn-container {
        margin-top: 10px;
      }

      pre {
        margin: 0 22px 0 0;
        padding: 8px 6px;

        &,
        * {
          font: 12px / 15px var(--win98-mono);
        }
      }
    }

    .repos-discussion-thread-reply {
      margin-top: 10px;
      padding-top: 10px;
      box-shadow:
        inset 0 1px var(--win98-shadow),
        inset 0 2px #fff;

      & > .flex-row {
        gap: 6px;
        padding: 0;

        & > div:first-child {
          width: 24px;
        }

        .bolt-coin {
          margin: 0;
        }

        & > .flex-row {
          padding: 0;
        }
      }

      .bolt-formitem-message {
        margin-top: 6px;
      }

      .repos-comment-editor-fit > .justify-end {
        margin-top: 4px;

        & > .flex-wrap {
          gap: 6px;
        }
      }
    }
  }
}

/* An unfolded push on the Overview, as in the MainPushOpen artboard: the same one-line header as
   a folded push, and under it its commits in a sunken white list box, indented under the coin. */
html[data-fix-ado-win98="pull-request"] body .activity-feed-list {
  [style*="min-height"]:has(> [data-fix-ado-push="open"]) {
    min-height: 0 !important;
  }

  .bolt-timeline-row:has([data-fix-ado-push="open"]) .activity-feed-sequence {
    .bolt-timeline-icon-prefix {
      min-height: 3px;
    }

    .bolt-timeline-icon-suffix {
      min-height: 0;
    }
  }

  [data-fix-ado-push="open"] {
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;

    .iteration-card-header,
    .iteration-card-header:hover {
      margin: 0;
      background: transparent;
    }

    .iteration-header {
      padding: 2px 0;
      border-bottom: 0;
    }

    .bolt-table-container {
      margin: 2px 4px 0 24px;
      padding: 2px;
      background: #fff;
      box-shadow: var(--win98-sunken);
    }

    .iteration-commits-table {
      border: 0;
      background: transparent;

      .bolt-list-row-spacer,
      .bolt-table-spacer-cell {
        display: none;
      }

      .bolt-table-row {
        height: 44px;
        border: 0;
        background: transparent;
      }

      .bolt-table-cell {
        padding: 0;
        border: 0;
      }

      .bolt-table-two-line-cell {
        box-sizing: border-box;
        height: 44px;
        padding: 7px 6px 0;
        vertical-align: top;
      }

      .commit-title-div {
        height: auto;
        min-height: 0;
        padding: 0;
        justify-content: flex-start;
        gap: 0;
      }

      .commit-title {
        height: 14px;
        line-height: 14px;
        font-weight: 700;
      }

      .bolt-table-two-line-cell-item + .bolt-table-two-line-cell-item {
        height: 16px;
        margin-top: 3px;
      }

      .secondary-text {
        gap: 8px;
        color: #404040;
      }

      .monospaced-xs {
        font: 11px / 14px var(--win98-mono);
        color: var(--win98-navy);
      }
    }
  }
}

/* ===== Work item, as in the design's WorkItem artboards ===== */

/* A document window: a navy title bar with the type, the title field, a toolbar row, the
   State, Reason, Area and Iteration combo boxes with the tabs on the right, and the tab's page
   as a raised property sheet whose sections are group boxes. A work item opened as a pop-up,
   such as from a board, looks the same inside a dialog window (WorkItemPopup artboard). */
:is(html[data-fix-ado-win98="work-item"] body, html[data-fix-ado-win98] .work-item-form-dialog) {
  .work-item-form-header-type-deco {
    display: none;
  }

  .work-item-form-header {
    height: auto;
    padding: 0;
    overflow: visible;
    background: var(--win98-face);

    /* The title bar: the type's icon and name. */
    & > .secondary-text {
      height: 18px;
      margin: 2px 2px 0;
      padding: 0 3px;
      align-items: center;
      background: var(--win98-title);
      color: #fff;
      font: 700 11px / 14px var(--win98-font);

      & > div:first-child {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      a.bolt-link {
        color: #fff;
        font-weight: 700;
      }

      .work-item-type-icon {
        margin: 0;
        color: #fff;
      }
    }

    /* The id, then the title field. */
    & > .body-xl {
      position: relative;
      height: 23px;
      margin: 4px 8px 0;
      padding: 0;
      align-items: center;
      gap: 6px;
      font: 700 13px / 16px var(--win98-font);

      & > div {
        flex: 1;
        min-width: 0;
      }

      & > div > .padding-left-8 {
        flex: 1;
        padding: 0;
      }

      .work-item-title-textfield {
        height: 23px;
        padding: 0;
      }

      .work-item-title-textfield input {
        height: 19px;
        padding: 0 4px;
        font: 700 13px / 20px var(--win98-font);
      }

      .bolt-clipboard-button {
        position: absolute;
        top: 0;
        right: 2px;
      }
    }

    /* Assigned to, comments, tags, and the command bar on the right. */
    & > div:nth-child(3) {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 23px;
      margin: 4px 8px 0;

      & > .work-item-header-command-bar {
        order: 1;
        flex: none;
        margin-left: auto;
        padding: 0;
        height: 23px;
      }

      .bolt-header-commandbar-button-group {
        flex: none;
        gap: 6px;
        padding: 0;
        overflow: visible;
      }

      .bolt-header-command-item-button {
        margin: 0;
      }

      .bolt-header-command-item-button.bolt-icon-button:not(
          .bolt-split-button,
          :has(.bolt-button-text)
        ),
      .bolt-expandable-button .bolt-button {
        width: 23px;
        padding: 0;
        justify-content: center;
      }

      .bolt-header-commandbar-button-group .bolt-button {
        gap: 4px;
      }

      /* Refresh, Undo and More: raised square buttons, as on the top bar. */
      .bolt-header-commandbar-button-group .bolt-button.subtle.subtle {
        background: var(--win98-face);
        box-shadow: var(--win98-raised);
      }
    }

    /* Assigned to: a 21px field with a 16px coin. */
    .work-item-assignment-dropdown {
      height: 21px;
      min-height: 0;
      padding: 0 4px 0 3px;
      align-items: center;

      & > div:first-child {
        width: auto;
        padding: 0;
        margin-right: 4px;
      }

      .bolt-coin {
        width: 16px;
        height: 16px;
        margin: 0;
      }

      input {
        padding: 0;
      }
    }

    .bolt-identitypickerdropdown,
    .bolt-identitypickerdropdown-container {
      height: 21px;
    }

    .wif-comment-count-link {
      & > .fluent-icons-enabled {
        width: 12px;
      }

      align-self: center;
      gap: 0;
      padding: 0 4px;
      color: #0000ee;

      .wif-comment-count-link-text {
        text-decoration: underline;
      }
    }

    .work-item-tag-picker {
      height: 23px;
      align-items: center;
      gap: 4px;
      padding: 0;

      .bolt-pill {
        height: 16px;
        margin: 0;
        padding: 0 3px 0 6px;
        gap: 4px;
      }

      .bolt-pill-content {
        padding: 0;
      }

      .bolt-pill-button {
        width: 8px;
        min-width: 0;
        height: 8px;
        padding: 0;
        background: transparent;
        box-shadow: none;
      }

      & > .bolt-button {
        width: 19px;
        height: 19px;
        margin: 0;
        justify-content: center;
      }
    }
  }

  /* The fields: labels in two columns, combo boxes, and the tabs on the right. */
  .work-item-form-subheader {
    height: 50px;
    margin: 6px 8px 0;
    padding: 0;
    flex-wrap: nowrap;
    gap: 16px;
    overflow: visible;
    background: var(--win98-face);

    & > .padding-left-8:first-child,
    & > .wif-node-dropdowns {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 0;
    }

    & > .wif-node-dropdowns {
      flex: 1;
      min-width: 0;
    }

    & > .wif-node-dropdowns > div,
    & > .wif-node-dropdowns > div > div {
      display: flex;
      width: 100%;
      min-height: 0;
      height: 21px;
    }

    & > .padding-left-8:first-child > div,
    & > .wif-node-dropdowns > div,
    & > .wif-node-dropdowns > div > div,
    & > .padding-left-8:first-child > div > div {
      flex: none;
      height: 21px;
      min-height: 0;
      margin: 0;
    }

    .work-item-control-label {
      height: 21px;
      padding: 0 4px 0 0;
      white-space: nowrap;
      align-items: center;
      color: #000;
      font-size: 11px;

      label {
        color: #000;
      }
    }

    & > .padding-left-8:first-child .work-item-control-label {
      width: 85px;
    }

    & > .wif-node-dropdowns .work-item-control-label {
      width: 125px;
    }

    .wif-label-shortcut-char {
      text-decoration: underline;
    }

    .work-item-control-before-content {
      width: 16px;
      align-items: center;
    }

    .state-circle {
      width: 10px;
      height: 10px;
      margin: 0;
      border: 0;
      border-radius: 0;
      box-shadow: inset 0 0 0 1px #000;
    }

    & > .padding-left-8:first-child .work-item-control-control {
      width: 160px;
      flex: none;
    }

    & > .wif-node-dropdowns .work-item-control-control {
      flex: 1;
      min-width: 0;
    }

    .bolt-textfield {
      position: relative;
      height: 21px;
      min-height: 0;
      padding: 0 4px;
    }

    .bolt-textfield-input {
      padding: 0;
    }

    /* A read-only field is grey with grey text, as Win98 shows a disabled one. */
    .readOnly.bolt-textfield {
      background: var(--win98-face);

      input {
        color: var(--win98-shadow);
      }
    }

    /* The arrow button is drawn by the field, so it shows whatever the icon font does. The
       icon stays on top, invisible, to take the click. */
    .bolt-editable-dropdown .bolt-textfield::after {
      content: "";
      position: absolute;
      top: 2px;
      right: 2px;
      width: 17px;
      height: 17px;
      background: var(--win98-face)
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='4' shape-rendering='crispEdges'%3E%3Cpath d='M0 0h7v1H0zM1 1h5v1H1zM2 2h3v1H2zM3 3h1v1H3z'/%3E%3C/svg%3E")
        center / 7px 4px no-repeat;
      box-shadow:
        inset -1px -1px var(--win98-dark),
        inset 1px 1px var(--win98-light),
        inset -2px -2px var(--win98-shadow),
        inset 2px 2px #fff;
      pointer-events: none;
    }

    .bolt-expandable-textfield-icon {
      position: absolute;
      top: 2px;
      right: 2px;
      z-index: 1;
      width: 17px;
      height: 17px;
      margin: 0;
      padding: 0;
      opacity: 0;
    }

    .wif-tabbar-container {
      flex: none;
      justify-content: space-between;
      padding: 0;
    }

    .wif-tabbar-container > .secondary-text {
      height: 14px;
      color: #404040;

      .text-ellipsis {
        overflow: visible;
      }
    }

    .wif-tabbar {
      height: 23px;
      margin-bottom: -4px;
      background: transparent;
      box-shadow: none;
    }

    /* The last tab ends 1px from the sheet's right bevel, as in the design. */
    .bolt-tabbar-tabs {
      height: 23px;
      padding: 0 1px 0 0;
    }

    .bolt-tab {
      min-width: 0;
      font-size: 11px;
    }

    .bolt-tab-inner-container,
    .bolt-tab .bolt-tab-text.bolt-tab-text,
    .bolt-tab .fluent-icons-enabled {
      gap: 4px;
      padding: 0;
      overflow: visible;
    }

    .bolt-tab .fluent-icons-enabled {
      flex: none;
      width: 12px;
    }

    .bolt-tab .bolt-tab-badge.bolt-tab-badge {
      height: auto;
      margin: 0;
      padding: 0;
      background: transparent;
      box-shadow: none;
    }

    .bolt-tab-badge .bolt-pill-content {
      padding: 0;
    }
  }

  /* The tab's page: a raised property sheet. Its bevel is a border image, so the page scrolls
     inside the bevel instead of over it. */
  .work-item-form-page-content {
    width: auto;
    margin: 4px;
    padding: 12px 10px 10px;
    border: 2px solid;
    border-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='5' height='5' shape-rendering='crispEdges'%3E%3Crect width='5' height='5' fill='%23c0c0c0'/%3E%3Cpath d='M0 0h5v2H0zM0 0h2v5H0z' fill='%23dfdfdf'/%3E%3Cpath d='M0 3h5v2H0zM3 0h2v5H3z' fill='%23808080'/%3E%3Cpath d='M0 0h5v1H0zM0 0h1v5H0z' fill='%23fff'/%3E%3Cpath d='M0 4h5v1H0zM4 0h1v5H4z' fill='%230a0a0a'/%3E%3C/svg%3E")
      2 / 2px stretch;
    background: var(--win98-face);
    box-shadow: none;
  }

  .work-item-grid {
    gap: 0 16px;
  }

  /* Each section is a group box: its name over the top edge, its buttons as caption buttons. */
  .work-item-form-group,
  .wit-discussion-group {
    margin: 0;
    padding: 0 0 14px;
  }

  .work-item-form-collapsible-section {
    position: relative;
    margin-top: 6px;
    padding: 12px 8px 8px;
    border: 1px solid var(--win98-shadow);
    box-shadow:
      inset 1px 1px #fff,
      1px 1px #fff;
  }

  .work-item-form-collapsible-header {
    position: absolute;
    top: -7px;
    left: 6px;
    right: 6px;
    height: 14px;
    margin: 0;
    border: 0;
    align-items: center;

    & > span {
      height: 14px;
      padding: 0 2px;
      background: var(--win98-face);
      font: 400 11px / 14px var(--win98-font);
    }
  }

  .work-item-form-section-controls {
    display: flex;
    gap: 2px;
    padding: 0 2px;
    background: var(--win98-face);
  }

  /* Win98 caption buttons are always there; Azure DevOps shows them on hover. */
  .work-item-form-collapsible-section .work-item-form-toggle.bolt-button.bolt-button {
    opacity: 1;
    width: 16px;
    min-width: 0;
    height: 14px;
    padding: 0;
    justify-content: center;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
  }

  .work-item-form-collapsible-section-content,
  .work-item-form-control-wrapper,
  .work-item-form-control-content-wrapper {
    margin: 0;
    padding: 0;
  }

  /* Rich text: a sunken white well. */
  .work-item-form-control-content.show-markdown-preview {
    padding: 2px;
    background: #fff;
    box-shadow: var(--win98-sunken);
  }

  .markdown-content.markdown-editor-preview,
  .markdown-editor-placeholder {
    padding: 4px 6px;
    font: 11px / 14px var(--win98-font);

    ul,
    ol {
      padding-left: 24px;
    }
  }

  .markdown-editor-placeholder {
    height: 46px;
    padding: 4px 6px;
    color: var(--win98-shadow);
    font-style: normal;
  }

  /* Planning: each label over its field. */
  .workitemcontrol-label {
    color: #000;
    font-size: 11px;
  }

  .work-item-form-control-wrapper + .work-item-form-control-wrapper {
    margin-top: 6px;
  }

  .work-item-form-control-content-wrapper > div:first-child:has(> label) {
    margin-bottom: 2px;
  }

  /* White, as every Win98 text field; a board's pop-up set the face colour through this variable. */
  .work-item-form-control.bolt-textfield {
    --background-color: #fff;
    height: 21px;
    padding: 0 4px;
  }

  .work-item-form-control .bolt-textfield-input {
    padding: 0;
  }

  /* Deployment and Development: text on the face, beside the icon. */
  .deployments-zero-data,
  .links-control-zero-state {
    background: transparent;
  }

  /* The icon keeps its 30px square, also before its image loads. */
  .deployments-zero-data .zero-data-icon {
    width: 30px;
    height: 30px;
  }

  /* Add link: a push button. */
  .work-item-form-control-wrapper .bolt-button.subtle:not(.remove-item-button),
  .work-item-form-control-wrapper
    .bolt-button.subtle:not(.remove-item-button, :hover, :active, [aria-expanded="true"]) {
    min-width: 75px;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
  }

  /* Links are Win98 hyperlinks: blue and underlined. */
  .work-item-form-page-content :is(.bolt-link, .markdown-content a) {
    color: #0000ee;
    text-decoration: underline;
  }

  /* Azure DevOps takes the underline off these links with !important. */
  :is(.artifact-link-link, .bolt-formitem-message .bolt-link).no-underline-link {
    text-decoration: underline !important;
  }

  /* These clip their text for an ellipsis. On a half-pixel column they cut off the first letter's
     edge, and the state square's black edge sits outside the square: 1px of slack shows both. */
  :is(.artifact-link-link, .artifact-details .text-ellipsis) {
    overflow: clip;
    overflow-clip-margin: 1px;
  }

  .preview-mode-container {
    min-height: 0;
  }

  /* Discussion: the new comment field, then each comment as a coin, a header line and its
     text in a sunken white well. */
  :is(.discussion-new-comment, .comment-item) {
    display: flex;
    margin: 0;
    padding: 0;
    background: transparent;
    box-shadow: none;
  }

  .comment-item {
    margin-top: 14px;
  }

  :is(.discussion-new-comment > div:first-child, .comment-item-left) {
    flex: none;
    width: 32px;
    padding: 0;

    /* A flex box, as elsewhere: as a block, the coin sat 4px under its column's top. */
    .bolt-coin {
      display: flex;
      width: 24px;
      height: 24px;
      margin: 0;
    }
  }

  .comment-item-left > div {
    width: 24px;
    margin: 0;
    padding: 0;
  }

  :is(.new-comment-div, .comment-item-right, .comment-viewer, .comment-editor) {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 0;
  }

  :is(
    .markdown-editor-form-item-wrapper,
    .markdown-editor-text-field-container,
    .comment-editor,
    .new-comment-div,
    .discussion-new-comment > div:first-child
  ) {
    height: auto;
    min-height: 0;
  }

  .comment-editor .toolbar-area {
    display: none;
  }

  /* A screen reader's text: no height and no margins, which took a pixel off the new comment.
     It stays relative, as Azure DevOps needs for its scroll bars. */
  .comment-editor .markdown-formatting-announcer.visually-hidden {
    height: 0;
    margin: 0;
  }

  .markdown-editor.enter-new-comment textarea::placeholder {
    color: var(--win98-shadow);
  }

  .markdown-editor.enter-new-comment {
    height: 32px;
    margin: 0;
    padding: 4px 6px;

    textarea {
      padding: 0;
      background: transparent;
      box-shadow: none;
      font: 11px / 14px var(--win98-font);
    }
  }

  .discussion-new-comment .bolt-formitem-message {
    margin-top: 4px;
    color: #404040;

    .markdown-text-container > div {
      gap: 4px;
    }

    .fluent-icons-enabled {
      width: 12px;
    }
  }

  .comment-viewer .comment-header.comment-header {
    height: 23px;
    margin: 0 0 2px;
    padding: 0;
    align-items: center;
  }

  .comment-header-main {
    height: 23px;
    margin: 0;
    gap: 6px;
    align-items: center;

    .user-display-name.user-display-name {
      margin: 0;
      color: #000;
      font-weight: 700;
    }

    .comment-timestamp {
      margin: 0;
      color: #404040;
    }
  }

  .comment-viewer-toolbar .bolt-button {
    width: 20px;
    min-width: 0;
    padding: 0;
    justify-content: center;
  }

  .comment-viewer > div:last-child > .markdown-content {
    margin: 0;
  }

  .comment-viewer > div:last-child {
    padding: 2px;
    background: #fff;
    box-shadow: var(--win98-sunken);
  }

  /* An external link's icon: a 12px glyph, so the text after it lands on whole pixels. */
  .markdown-content .ms-Icon--NavigateExternalInline {
    width: 12px;
    vertical-align: top;
  }

  /* A person's mention: bold, in link blue, without its chip. */
  .mention-preview-person {
    padding: 0;
    background: transparent;
    color: #0000ee;
    font-weight: 700;
  }

  /* Related work: each link type bold, 8px under the Add link button. */
  .compact-links-list {
    margin-top: 8px;
  }

  .link-type-name {
    padding: 0 0 4px;
    font-weight: 700;
  }

  .artifact-link .state-circle {
    width: 8px;
    height: 8px;
    border: 0;
    border-radius: 0;
    box-shadow: 0 0 0 1px #000;
  }

  /* Remove link: a small flat button that shows on hover, as before. */
  .remove-item-button.bolt-button.bolt-button {
    width: 16px;
    min-width: 0;
    height: 16px;
    padding: 0;
    justify-content: center;
    background: transparent;
    box-shadow: none;
  }
}

/* The pop-up's window: a Win98 frame with no drop shadow, as the other dialogs. Its two header
   buttons are caption buttons in the title bar; the resize grip sits in the corner. */
html[data-fix-ado-win98] .bolt-portal-host .work-item-form-dialog {
  box-shadow: var(--win98-window);

  .bolt-dialog-root {
    margin: 0;
  }

  .work-item-form-header > .secondary-text > .bolt-button {
    width: 16px;
    min-width: 0;
    height: 14px;
    margin-left: 2px;
    padding: 0;
    justify-content: center;
    background: var(--win98-face);
    box-shadow: var(--win98-raised);
    color: #000;
  }
}

/* The New chip on a feed row, as in the NewChip artboard: the settings panel's NEW chip, tooltip
   yellow with a black edge, 10px bold capitals, and no glow. Its yellow ties it to unread
   comments. */
html[data-fix-ado-win98="pull-request"] body .bolt-pill.fix-ado-new-chip {
  height: 14px;
  padding: 0 4px;
  border: 1px solid #000;
  border-radius: 0;
  background: var(--win98-tooltip);
  box-shadow: none;
  color: #000;
  font: 700 10px / 12px var(--win98-font);
  text-transform: uppercase;

  .bolt-pill-content.bolt-pill-content {
    padding: 0;
    color: inherit;
    font: inherit;
  }
}

/* Pipeline run, logs view, as in the design's PipelineRunSteps and PipelineRunLog artboards:
   the jobs and steps in one sunken white tree view, the log in a sunken black console under
   a grey strip with the step's name and the buttons. */
html[data-fix-ado-win98="pipeline-run"] body .run-logs-view {
  .bolt-master-panel {
    width: 280px;
    border: 0;
    background: var(--win98-face);
  }

  .bolt-master-panel-header .bolt-header-title-row > * {
    font-size: 11px;
  }

  .bolt-master-panel-content {
    flex: 1;
    min-height: 0;
    margin: 0 4px 4px;
    padding: 4px;
    background: #fff;
    box-shadow: var(--win98-sunken);
  }

  .run-logs-tree {
    .bolt-table-container.bolt-table-container,
    .bolt-table-header-cell.bolt-table-header-cell {
      box-shadow: none;
    }

    table,
    thead,
    tbody,
    tr,
    th,
    td {
      display: block;
      border: 0;
      background: none;
    }

    colgroup,
    .bolt-table-header-border,
    .bolt-table-cell-compact {
      display: none;
    }

    .bolt-table-container {
      overflow: visible;
      padding: 0;
    }

    /* A stage after the first: a dotted line above it, as between runs in the pipeline tab. */
    & > div + div {
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px dotted var(--win98-shadow);
    }

    .bolt-table-header-cell,
    .bolt-tree-cell {
      height: 20px;
      padding: 0 4px;
    }

    .bolt-table-header-cell-content,
    .bolt-table-cell-content {
      height: 20px;
      gap: 4px;
      margin: 0;
      padding: 0;
      border: 0;
    }

    /* Jobs one level in from their stage. */
    .bolt-tree-cell.bolt-tree-cell {
      padding-left: 20px;
      border: 0;
    }

    /* A stage: no +/- box, but its room, so all icons line up. */
    .bolt-table-header-cell-content::before {
      content: "";
      width: 9px;
      flex: none;
      margin: 0;
    }

    .bolt-table-header-cell-text {
      padding: 0 2px;
      color: #000;
      font-weight: 700;
    }

    .bolt-status {
      margin: 0;
    }

    .bolt-tree-expand-button {
      width: 9px;
      height: 9px;
      margin: 0;
      padding: 0;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2z'/%3E%3C/svg%3E")
        0 0 / 9px no-repeat;

      &::before {
        content: none;
      }

      &.invisible {
        visibility: hidden;
      }
    }

    .bolt-tree-row[aria-expanded="false"] .bolt-tree-expand-button {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' shape-rendering='crispEdges'%3E%3Crect x='.5' y='.5' width='8' height='8' fill='%23fff' stroke='%23808080'/%3E%3Cpath d='M2 4h5v1H2zM4 2h1v5H4z'/%3E%3C/svg%3E");
    }

    .job-detail {
      align-items: center;
      gap: 4px;
      margin: 0;
    }

    .job-name-area {
      align-items: center;
      gap: 4px;
      margin: 0;

      & > span {
        padding: 0 2px;
        color: #000;
      }
    }

    .run-job-cell .job-name-area > span {
      font-weight: 700;
    }

    .job-duration {
      width: auto;
      align-self: center;
      margin-left: auto;
      color: #404040;
    }

    .bolt-tree-row:is(.selected, [aria-selected="true"]) {
      background: none;

      .job-name-area > span {
        background: var(--win98-navy);
        color: #fff;
        font-weight: 400;
      }
    }
  }

  .logs-view {
    padding: 0 4px 4px;
    background: var(--win98-face);

    & > div {
      display: flex;
      flex-direction: column;
    }
  }

  .log-header.log-header {
    height: 31px;
    flex: none;
    margin: 0;
    padding: 0 0 0 4px;
    background: none;
    color: #000;

    & > div {
      width: 100%;
      height: 31px;
      margin: 0;
      align-items: center;
    }

    .bolt-header-title {
      margin: 0;
      padding: 0;
      font-weight: 700;
    }

    /* The step's status icon at 16px, as a window's icon. */
    .job-header {
      align-items: center;
      gap: 4px;
      margin: 0;

      .status,
      .bolt-status {
        width: 16px;
        height: 16px;
        margin: 0;
      }

      .title-m {
        font-size: 11px;
        line-height: 14px;
      }
    }

    .reader-actions,
    .reader-actions > * {
      height: 23px;
      gap: 4px;
      margin: 0;
      padding: 0;
    }

    .log-header-button {
      justify-content: center;
      padding: 0 10px;

      .bolt-button-text {
        padding: 0;
      }
    }

    /* The more button's wrapper keeps the console's black: none here. */
    .reader-actions .themed {
      background: none;
    }

    /* Icon buttons: 23px square toolbar buttons. */
    .reader-actions button:not(.log-header-button) {
      width: 23px;
      min-width: 23px;
      justify-content: center;
    }
  }

  .pl-reader {
    container-type: inline-size;
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 6px;
    background: #000;
    border: 1px solid;
    border-color: var(--win98-shadow) #fff #fff var(--win98-shadow);
    box-shadow:
      inset 1px 1px var(--win98-dark),
      inset -1px -1px var(--win98-light);

    /* Azure DevOps places the lines every 20px. */
    .line-row {
      padding: 0;
    }

    .content {
      margin: 0;
    }

    /* A group's triangle sits in the gutter, 4px after the line number and 2px before the
       text, so its text lines up with the others. */
    .group-expand > .fluent-icons-enabled {
      width: 12px;
      margin-left: -14px;

      .group-icon {
        width: 12px;
        padding: 0;
      }
    }

    .line-area {
      align-items: flex-start;
      padding: 0;
    }

    .line {
      width: 36px;
      margin-right: 18px;
      padding: 0;
      color: var(--win98-shadow);
      text-align: right;
    }

    /* The section bar that stays at the top while its step's lines scroll under it. It is as
       wide as the console, not as the lines, which scroll sideways. */
    .sec-sticky .sec-area.sec-area {
      left: 0;
      box-sizing: border-box;
      width: 100cqw;
      height: 20px;
      min-height: 0;
      margin: 0;
      padding: 0 4px;
      border: 0;
      border-bottom: 1px solid var(--win98-shadow);
      background: #000;
      box-shadow: none;
      color: #fff;
      font:
        700 11px / 14px Tahoma,
        "MS Sans Serif",
        Geneva,
        Verdana,
        sans-serif;

      .status-area {
        max-width: 100%;
        height: 19px;
        margin: 0;
        align-items: center;
      }

      .sec-content {
        gap: 4px;
        margin: 0;
      }

      .title {
        margin: 0;
      }

      .bolt-status {
        margin: 0;
      }

      * {
        font: inherit;
      }

      .far-right {
        margin: 0 0 0 auto;
        color: var(--win98-face);
        font-weight: 400;
      }
    }

    .pl-warning {
      color: #ff0;
    }

    .pl-section {
      color: #0f0;
    }

    .pl-command {
      color: #0ff;
    }

    .pl-error {
      color: #f00;
    }
  }
}

/* Pipeline run, summary, as in the design's PipelineRunSummary artboard. */
html[data-fix-ado-win98="pipeline-run"] body .run-details-page {
  /* The run's ⋮ menu: a 23px push button, 4px after the default button. */
  .bolt-header-commandbar .bolt-expandable-button {
    margin: 2px 2px 2px 4px;

    .bolt-button {
      width: 23px;
      min-width: 0;
      height: 23px;
      padding: 0;
      justify-content: center;
      background: var(--win98-face);
      box-shadow: var(--win98-raised);
    }
  }

  .run-view-header .bolt-header-title-row .bolt-header-title * {
    font-size: 11px;
  }

  /* Win98 has no semibold. */
  .stage-title {
    font-weight: 700;
  }

  /* The info message: a yellow tip box with a black line. */
  .bolt-messagecard {
    border-color: #000;
    background: var(--win98-tooltip);
    box-shadow: none;

    .bolt-messagebar {
      background: transparent;
    }
  }

  .pipeline-link:not(.primary-text) {
    color: #0000ee;
  }

  /* The issues tab stands on its line; the list keeps its place. */
  .issues-card-content > .bolt-tabbar {
    margin-bottom: 16px;
    padding-bottom: 0;
  }

  /* No line between the Stages and Jobs tabs and the stages: the tab row has its own. */
  .jobs-card-content {
    border-top: 0;
  }

  /* A stage is a raised box, as a button: it opens the stage's logs. */
  .stage-card {
    border-color: #fff var(--win98-dark) var(--win98-dark) #fff;
    background: var(--win98-face);
    box-shadow:
      inset 1px 1px var(--win98-light),
      inset -1px -1px var(--win98-shadow);
  }

  .stage-progress-row > .text-ellipsis {
    overflow: visible;
  }

  /* The line from one stage to the next. */
  .dtc-canvas-position path {
    stroke: #000;
    stroke-width: 1px;
    shape-rendering: crispEdges;
  }
}

/* Board, as in the design's Board artboard. */
html[data-fix-ado-win98="board"] body {
  /* The board picker: its name in bold. */
  .wit-kanban-board-header-row .directory-selector-dropdown .bolt-button {
    font-weight: 700;
  }

  /* Icon buttons in the headers and filter bar: 23px square toolbar buttons. */
  :is(.wit-kanban-board-header-row, .boards-tabs-header, .vss-FilterBar)
    .bolt-icon-button.icon-only,
  .wit-kanban-board-header-row .title-l .bolt-icon-button,
  .boards-tabs-header .bolt-header-commandbar-button-group > .bolt-icon-button {
    justify-content: center;
    width: 23px;
    min-width: 23px;
    padding: 0;
  }

  /* The pivot tabs stand on a line that runs to the toolbar. */
  .boards-tabs-header .bolt-tabbar {
    align-self: stretch;
  }

  /* The keyword field is white, as every Win98 text field. */
  .vss-FilterBar .bolt-text-filterbaritem.bolt-text-filterbaritem {
    background: #fff;
  }

  /* The board sits in a teal well. */
  .board-wrapper {
    background: var(--win98-desktop);
  }

  /* The board's scroll area is teal too, so the teal runs on under columns scrolled into view. */
  :has(> .board-wrapper) {
    background: var(--win98-desktop) local;
  }

  /* A column is a window: its title bar inside the frame, joined to its body. */
  .kanban-board-column-header-container.kanban-board-column-header-container {
    margin-bottom: 0;
    background: transparent;
  }

  .kanban-board-column-header.kanban-board-column-header {
    height: 22px;
    padding: 3px 3px 1px;
    background:
      var(--win98-title) content-box,
      var(--win98-face);
    box-shadow:
      inset 1px 1px var(--win98-light),
      inset -1px 0 var(--win98-dark),
      inset 2px 2px #fff,
      inset -2px 0 var(--win98-shadow);

    & > .flex-row {
      height: 18px;
      align-items: center;
      padding: 0 2px 0 3px;
    }

    .click-edit-field {
      font-weight: 700;
    }

    .board-column-item-count {
      line-height: 14px;
    }
  }

  .kanban-board-column.kanban-board-column {
    box-shadow:
      inset -1px -1px var(--win98-dark),
      inset 1px 0 var(--win98-light),
      inset -2px -2px var(--win98-shadow),
      inset 2px 0 #fff;
  }

  /* Collapse: a caption button, as the days toggle beside the name. */
  .kanban-board-column-header .kanban-board-column-collapse-button.bolt-button.bolt-button {
    flex: none;
    justify-content: center;
    width: 16px;
    min-width: 0;
    height: 14px;
    padding: 0;
    margin: 2px 2px 0 0;
    box-shadow: var(--win98-raised);
  }

  /* The search button beside New item: a 23px push button. */
  .board-column-button.icon-only {
    justify-content: center;
    width: 23px;
    padding: 0;
  }

  /* A card's type icon, number and title, 4px and 6px apart. */
  .wit-card .card-content > .flex-row:first-child .rhythm-horizontal-8 {
    display: flex;
    gap: 4px;

    .title {
      margin-left: 2px;
    }
  }
}

/* A drop-down that checks several items, such as a board filter, as in the BoardFilter artboard:
   a search field, then a white list box of checkbox rows, then Clear. A checked row stays white
   with a check in its box; only the hovered or focused row is navy. */
html[data-fix-ado-win98]
  .bolt-portal-host
  .bolt-callout-content:has(.bolt-list-row .bolt-checkbox) {
  .bolt-textfield {
    height: 21px;
    padding: 0 4px;
    border: 0;
    border-radius: 0;
    background: #fff;
    box-shadow: var(--win98-sunken);

    /* The 16px magnifier, 4px, then the text. */
    & > .fluent-icons-enabled,
    & > .fluent-icons-enabled > * {
      flex: none;
      width: 16px;
      margin: 0;
      padding: 0;
    }

    input {
      margin: 0;
      padding: 0 0 0 4px;

      &::placeholder {
        color: var(--win98-shadow);
        opacity: 1;
      }
    }
  }

  /* The list box, 4px under the search field when there is one. */
  :has(> .bolt-textfield) + .v-scroll-auto:has(> .bolt-list) {
    margin-top: 4px;
  }

  .v-scroll-auto:has(> .bolt-list) {
    margin-top: 0;
    padding: 2px;
    background: #fff;
    box-shadow: var(--win98-sunken);
  }

  .bolt-list {
    width: 100%;
    border-spacing: 0;
  }

  /* A row is 17px: its checkbox 4px in, then 6px, then the name; every cell fits the row, so the
     hovered row's navy covers its whole name. */
  .bolt-list-row {
    height: 17px;
    align-items: center;
    gap: 6px;
    padding: 0 4px;
    background: #fff;
    color: #000;

    & > .bolt-list-cell {
      flex: none;
      width: auto;
      height: 17px;
      min-height: 0;
      margin: 0;
      padding: 0;
      border: 0;
      display: flex;
      align-items: center;

      &:last-child {
        flex: 1;
        min-width: 0;
      }

      :is(
        .bolt-table-cell-content,
        .bolt-list-box-cell-container,
        .bolt-list-cell-child,
        .flex-row,
        .flex-row-inline
      ):not(.bolt-checkmark) {
        height: 17px;
        min-height: 0;
        margin: 0;
        padding: 0;
        gap: 4px;
        align-items: center;
      }

      /* The checkbox's wrappers are as tall as the box, so it sits on whole pixels. */
      &.bolt-table-cell-select :is(.flex-row, .flex-row-inline) {
        display: flex;
        height: 13px;
      }

      /* A person's 16px avatar, 4px, then the name. A 1px margin under each centres them on
         whole pixels in the 17px row. */
      :is(.identity-view, .identity-avatar) {
        margin: 0;
      }

      :is(.identity-view, .text-ellipsis) {
        margin-bottom: 1px;
      }
    }

    &:hover,
    &.focused {
      background: var(--win98-navy);
      color: #fff;
    }

    /* A checked row is selected, and the menus' rule makes a selected row's text white. */
    &:not(:hover, .focused) :not(svg, svg *) {
      color: #000;
    }
  }

  /* The invented table form of the list, before the real capture, keeps its cell padding. */
  td.bolt-list-cell {
    padding: 0 4px;
  }

  .bolt-list-cell-content {
    gap: 6px;
  }

  .bolt-checkbox {
    flex: none;
    margin: 0;
    padding: 0;
  }

  .bolt-checkmark {
    width: 13px;
    height: 13px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: #fff;
    box-shadow: var(--win98-sunken);

    .fabric-icon {
      visibility: hidden;
    }
  }

  .bolt-checkbox[aria-checked="true"] .bolt-checkmark {
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='7'%3E%3Cpath d='M0 3l2 2 5-5v2L2 7 0 5z'/%3E%3C/svg%3E")
        center / 7px 7px no-repeat,
      #fff;
  }

  /* Clear: a push button at the right, under the list. */
  :has(> .bolt-button):last-child {
    margin-top: 4px;
    padding: 0;
    align-items: flex-end;
    justify-content: flex-end;

    .bolt-button {
      min-width: 75px;
      height: 23px;
      margin: 0;
      justify-content: center;
      gap: 4px;
      padding: 0 10px;
      border-radius: 0;
      background: var(--win98-face);
      box-shadow: var(--win98-raised);
      color: #000;

      & > * {
        margin: 0;
      }

      .fluent-icons-enabled {
        flex: none;
        width: 16px;
      }
    }
  }
}

/* The pull request list's filter bar, as in the PullRequestsMineFilter artboard: when it is open
   it is the tab panel's first row, 14px above the list, so tabs, filter and list are one
   property sheet. Its fields are 21px, sunken and white, 6px apart, and fit the row. The same
   bar shows on the Mine, Active and Completed tabs. */
html[data-fix-ado-win98]:is(
    [data-fix-ado-win98="pull-request-list"],
    [data-fix-ado-win98="pull-request-inbox"]
  )
  body
  .bolt-page
  > div:has(> .vss-FilterBar) {
  margin: 0;
  padding: 14px 12px 0;
  background: var(--win98-face);
  box-shadow:
    inset -1px 0 var(--win98-dark),
    inset 1px 1px #fff,
    inset -2px 0 var(--win98-shadow),
    inset 2px 2px var(--win98-light);

  & + .page-content {
    padding-top: 14px;
    box-shadow:
      inset -1px -1px var(--win98-dark),
      inset 1px 0 #fff,
      inset -2px -2px var(--win98-shadow),
      inset 2px 0 var(--win98-light);
  }

  .vss-FilterBar {
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .vss-FilterBar--list {
    height: 23px;
    gap: 6px;
  }

  .vss-FilterBar--list > .vss-FilterBar--item {
    flex: 0 1 200px;
    min-width: 0;
    max-width: none;
    margin: 0;

    &.vss-FilterBar--item-keyword-container {
      flex: 1 1 auto;
      min-width: 140px;
      width: auto;
      margin: 0;
    }

    &:has(.bolt-dropdown-expandable-text-field) {
      flex-basis: 160px;
    }

    /* Each field fills its item. */
    :is(.bolt-identitypickerdropdown, .bolt-dropdown-expandable-text-field, .flex-column) {
      width: 100%;
      min-width: 0;
    }
  }

  .bolt-textfield.bolt-textfield {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: 21px;
    gap: 4px;
    padding: 3px 4px;
    border: 0;
    border-radius: 0;
    background: #fff;
    box-shadow: var(--win98-sunken);

    .prefix,
    .fluent-icons-enabled:has(> .prefix) {
      flex: none;
      width: 16px;
      margin: 0;
      padding: 0;
    }

    input {
      min-width: 0;
      height: 15px;
      margin: 0;
      padding: 0;

      &::placeholder {
        color: var(--win98-shadow);
        opacity: 1;
      }
    }

    /* The version field is a combo box: its arrow a raised button inside the right edge. */
    &:has(.suffix) {
      padding-right: 2px;
    }

    .fluent-icons-enabled:has(> .suffix) {
      flex: none;
      width: 16px;
      height: 17px;
      margin: 0;
      background:
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='4' shape-rendering='crispEdges'%3E%3Cpath d='M0 0h7v1H0zM1 1h5v1H1zM2 2h3v1H2zM3 3h1v1H3z'/%3E%3C/svg%3E")
          center / 7px 4px no-repeat,
        var(--win98-face);
      box-shadow: var(--win98-raised);

      .suffix {
        visibility: hidden;
      }
    }
  }

  /* Clear: a flat 23px toolbar button, like the filter button by the tabs. */
  .vss-FilterBar--right-items {
    flex: none;
    margin: 0;

    .bolt-button {
      width: 23px;
      height: 23px;
      min-width: 0;
      padding: 0;
      justify-content: center;
      background: transparent;
      box-shadow: none;
    }
  }
}
`;

  // shared/styles/win98/tokens.css
  var tokens_default = `/* Windows 98's visual language as custom properties: colours, bevels, fonts, sizes and the
   16px pixel icons. Components (components.css) and a script's own rules build on these, so a
   look is changed in one place. Import it before the rules that use it. */

:root {
  /* Colours. */
  --win98-face: #c0c0c0;
  --win98-light: #dfdfdf;
  --win98-highlight: #fff;
  --win98-shadow: #808080;
  --win98-dark: #0a0a0a;
  --win98-text: #000;
  --win98-field-face: #fff;
  --win98-navy: #000080;
  --win98-title-end: #1084d0;
  --win98-desktop: var(--win98-teal);
  --win98-tooltip: #ffffe1;
  --win98-link: #0000ee;
  --win98-olive: #808000;
  --win98-maroon: #800000;
  --win98-green: #008000;
  --win98-teal: #008080;
  --win98-title: linear-gradient(90deg, var(--win98-navy), var(--win98-title-end));
  --win98-title-inactive: linear-gradient(90deg, #808080, #b5b5b5);

  /* Bevels, as inset box shadows: the outer line first. */
  --win98-raised:
    inset -1px -1px #0a0a0a, inset 1px 1px #fff, inset -2px -2px #808080, inset 2px 2px #dfdfdf;
  --win98-pressed:
    inset -1px -1px #fff, inset 1px 1px #0a0a0a, inset -2px -2px #dfdfdf, inset 2px 2px #808080;
  --win98-sunken:
    inset -1px -1px #fff, inset 1px 1px #808080, inset -2px -2px #dfdfdf, inset 2px 2px #0a0a0a;
  --win98-thin: inset -1px -1px #808080, inset 1px 1px #fff;
  --win98-window:
    inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf, inset -2px -2px #808080, inset 2px 2px #fff;
  --win98-well: inset -1px -1px #fff, inset 1px 1px #808080;
  --win98-default:
    inset 0 0 0 1px #000, inset -2px -2px #0a0a0a, inset 2px 2px #fff, inset -3px -3px #808080,
    inset 3px 3px #dfdfdf;
  --win98-menu:
    inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf, inset -2px -2px #808080, inset 2px 2px #fff,
    2px 2px 0 rgba(0, 0, 0, 0.35);
  --win98-etched: inset 0 1px #808080, inset 0 2px #fff;

  /* Fonts. */
  --win98-font: Tahoma, "MS Sans Serif", Geneva, Verdana, sans-serif;
  --win98-mono: "Courier New", Courier, monospace;
  --win98-font-size: 11px;

  /* Sizes. */
  --win98-button-height: 23px;
  --win98-button-min-width: 75px;
  --win98-field-height: 21px;
  --win98-row-height: 17px;
  --win98-checkbox-size: 13px;
  --win98-title-height: 18px;
  --win98-gap: 6px;

  /* The 16px pixel icons. In a 24px box they keep 16px, centred. */
  --win98-icon-passed: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000000' d='M13 3h1v1h-1zM12 4h2v1h-2zM11 5h3v1h-3zM2 6h1v1h-1zM10 6h3v1h-3zM2 7h2v1h-2zM9 7h3v1h-3zM2 8h3v1h-3zM8 8h3v1h-3zM3 9h3v1h-3zM7 9h3v1h-3zM4 10h5v1h-5zM5 11h3v1h-3zM6 12h1v1h-1z'/%3E%3C/svg%3E");
  --win98-icon-failed: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23800000' d='M5 0h6v1h-6zM3 1h2v1h-2zM11 1h2v1h-2zM2 2h1v1h-1zM13 2h1v1h-1zM1 3h1v1h-1zM14 3h1v1h-1zM1 4h1v1h-1zM14 4h1v1h-1zM0 5h1v1h-1zM15 5h1v1h-1zM0 6h1v1h-1zM15 6h1v1h-1zM0 7h1v1h-1zM15 7h1v1h-1zM0 8h1v1h-1zM15 8h1v1h-1zM0 9h1v1h-1zM15 9h1v1h-1zM1 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM14 11h1v1h-1zM2 12h1v1h-1zM13 12h1v1h-1zM3 13h2v1h-2zM11 13h2v1h-2zM5 14h6v1h-6z'/%3E%3Cpath fill='%23ff0000' d='M5 1h6v1h-6zM3 2h10v1h-10zM2 3h12v1h-12zM2 4h2v1h-2zM6 4h4v1h-4zM12 4h2v1h-2zM1 5h4v1h-4zM7 5h2v1h-2zM11 5h4v1h-4zM1 6h5v1h-5zM10 6h5v1h-5zM1 7h6v1h-6zM9 7h6v1h-6zM1 8h5v1h-5zM10 8h5v1h-5zM1 9h4v1h-4zM7 9h2v1h-2zM11 9h4v1h-4zM2 10h2v1h-2zM6 10h4v1h-4zM12 10h2v1h-2zM2 11h12v1h-12zM3 12h10v1h-10zM5 13h6v1h-6z'/%3E%3Cpath fill='%23ffffff' d='M4 4h2v1h-2zM10 4h2v1h-2zM5 5h2v1h-2zM9 5h2v1h-2zM6 6h4v1h-4zM7 7h2v1h-2zM6 8h4v1h-4zM5 9h2v1h-2zM9 9h2v1h-2zM4 10h2v1h-2zM10 10h2v1h-2z'/%3E%3C/svg%3E");
  --win98-icon-warning: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000000' d='M7 0h2v1h-2zM6 1h1v1h-1zM9 1h1v1h-1zM6 2h1v1h-1zM9 2h1v1h-1zM5 3h1v1h-1zM10 3h1v1h-1zM5 4h1v1h-1zM10 4h1v1h-1zM4 5h1v1h-1zM7 5h2v1h-2zM11 5h1v1h-1zM4 6h1v1h-1zM7 6h2v1h-2zM11 6h1v1h-1zM3 7h1v1h-1zM7 7h2v1h-2zM12 7h1v1h-1zM3 8h1v1h-1zM7 8h2v1h-2zM12 8h1v1h-1zM2 9h1v1h-1zM13 9h1v1h-1zM2 10h1v1h-1zM7 10h2v1h-2zM13 10h1v1h-1zM1 11h1v1h-1zM7 11h2v1h-2zM14 11h1v1h-1zM1 12h1v1h-1zM14 12h1v1h-1zM0 13h1v1h-1zM15 13h1v1h-1zM0 14h16v1h-16z'/%3E%3Cpath fill='%23ffff00' d='M7 1h2v1h-2zM7 2h2v1h-2zM6 3h4v1h-4zM6 4h4v1h-4zM5 5h2v1h-2zM9 5h2v1h-2zM5 6h2v1h-2zM9 6h2v1h-2zM4 7h3v1h-3zM9 7h3v1h-3zM4 8h3v1h-3zM9 8h3v1h-3zM3 9h10v1h-10zM3 10h4v1h-4zM9 10h4v1h-4zM2 11h5v1h-5zM9 11h5v1h-5zM2 12h12v1h-12zM1 13h14v1h-14z'/%3E%3C/svg%3E");
  --win98-icon-waiting: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000000' d='M3 1h10v1h-10zM4 2h1v1h-1zM11 2h1v1h-1zM4 3h1v1h-1zM11 3h1v1h-1zM5 4h1v1h-1zM10 4h1v1h-1zM6 5h1v1h-1zM9 5h1v1h-1zM7 6h2v1h-2zM6 7h1v1h-1zM9 7h1v1h-1zM5 8h1v1h-1zM10 8h1v1h-1zM4 9h1v1h-1zM11 9h1v1h-1zM4 10h1v1h-1zM11 10h1v1h-1zM4 11h1v1h-1zM11 11h1v1h-1zM3 12h10v1h-10z'/%3E%3Cpath fill='%23ffffff' d='M5 2h6v1h-6zM7 7h1v1h-1zM6 8h2v1h-2zM9 8h1v1h-1zM5 9h3v1h-3zM9 9h2v1h-2zM5 10h2v1h-2z'/%3E%3Cpath fill='%23808000' d='M5 3h6v1h-6zM6 4h4v1h-4zM7 5h2v1h-2zM8 7h1v1h-1zM8 8h1v1h-1zM8 9h1v1h-1zM7 10h4v1h-4zM5 11h6v1h-6z'/%3E%3C/svg%3E");
  --win98-icon-none: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23808080' d='M4 7h8v1h-8zM4 8h8v1h-8z'/%3E%3C/svg%3E");
  --win98-icon-info: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Cpath fill='%23000000' d='M3 0h10v1h-10zM2 1h1v1h-1zM13 1h1v1h-1zM1 2h1v1h-1zM14 2h1v1h-1zM1 3h1v1h-1zM14 3h1v1h-1zM1 4h1v1h-1zM14 4h1v1h-1zM1 5h1v1h-1zM14 5h1v1h-1zM1 6h1v1h-1zM14 6h1v1h-1zM1 7h1v1h-1zM14 7h1v1h-1zM1 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM14 9h1v1h-1zM2 10h1v1h-1zM13 10h1v1h-1zM3 11h4v1h-4zM8 11h5v1h-5zM6 12h1v1h-1zM8 12h1v1h-1zM5 13h1v1h-1zM7 13h1v1h-1zM4 14h2v1h-2z'/%3E%3Cpath fill='%23ffffff' d='M3 1h10v1h-10zM2 2h5v1h-5zM9 2h5v1h-5zM2 3h5v1h-5zM9 3h5v1h-5zM2 4h12v1h-12zM2 5h4v1h-4zM9 5h5v1h-5zM2 6h5v1h-5zM9 6h5v1h-5zM2 7h5v1h-5zM9 7h5v1h-5zM2 8h5v1h-5zM9 8h5v1h-5zM2 9h4v1h-4zM10 9h4v1h-4zM3 10h10v1h-10zM7 11h1v1h-1zM7 12h1v1h-1zM6 13h1v1h-1z'/%3E%3Cpath fill='%230000ff' d='M7 2h2v1h-2zM7 3h2v1h-2zM6 5h3v1h-3zM7 6h2v1h-2zM7 7h2v1h-2zM7 8h2v1h-2zM6 9h4v1h-4z'/%3E%3C/svg%3E");
  --win98-check: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='7'%3E%3Cpath d='M0 3l2 2 5-5v2L2 7 0 5z'/%3E%3C/svg%3E");
  --win98-caret: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='4' shape-rendering='crispEdges'%3E%3Cpath d='M0 0h7v1H0zM1 1h5v1H1zM2 2h3v1H2zM3 3h1v1H3z'/%3E%3C/svg%3E");
}
`;

  // azure-devops/src/features/windows-98-mode/index.ts
  var windows98Mode = {
    change: { kind: "new", version: "1.19.0" },
    description: "Azure DevOps as Windows 98: title bar, Start menu side bar, bevelled buttons and grey windows.",
    id: "windows-98-mode",
    isOffByDefault: !0,
    name: "Windows 98 mode",
    start({ document: document2 }) {
      let mode = createWindows98Mode(document2);
      return mode.sync({ kind: "other" }, document2.location), {
        sync({ page }) {
          mode.sync(page, document2.location);
        }
      };
    },
    styles: [tokens_default, style_default2],
    tag: "WIP"
  };

  // azure-devops/src/features/everywhere-features.ts
  var EVERYWHERE_FEATURES = [
    avatarInitials,
    followSystemTheme,
    reloadOnChanges,
    windows98Mode
  ];

  // azure-devops/src/features/activity-order/activity-order.ts
  var FEED_SELECTOR = ".activity-feed-list", FILTER_SELECTOR = ".repos-activity-filter-dropdown", BUTTON_CLASS = "fix-ado-activity-order", TEXT_CLASS = "bolt-button-text", SVG_NAMESPACE2 = "http://www.w3.org/2000/svg", SORT_ICON_PATHS = ["M5 13V3M2.5 5.5L5 3l2.5 2.5", "M11 3v10M8.5 10.5L11 13l2.5-2.5"], DEFAULT_ORDER = "oldest-first", LABELS2 = {
    "newest-first": "Newest first",
    "oldest-first": "Oldest first"
  }, flipped = (order) => order === "oldest-first" ? "newest-first" : "oldest-first";
  function sortIcon(document2) {
    let svg = document2.createElementNS(SVG_NAMESPACE2, "svg");
    svg.setAttribute("aria-hidden", "true"), svg.setAttribute("class", "fix-ado-activity-order-icon"), svg.setAttribute("viewBox", "0 0 16 16");
    for (let data of SORT_ICON_PATHS) {
      let path = document2.createElementNS(SVG_NAMESPACE2, "path");
      path.setAttribute("d", data), svg.append(path);
    }
    return svg;
  }
  function createButton(document2, onClick3) {
    let button2 = document2.createElement("button");
    button2.type = "button", button2.className = `${BUTTON_CLASS} bolt-button enabled bolt-focus-treatment`;
    let text = document2.createElement("span");
    return text.className = TEXT_CLASS, button2.append(sortIcon(document2), text), button2.addEventListener("click", onClick3), button2;
  }
  function spacingBox(button2) {
    let box = button2.ownerDocument.createElement("div");
    return box.className = "margin-bottom-16 margin-right-8 inline-flex-row", box.append(button2), box;
  }
  function findOrAddButton(document2, onClick3) {
    let existing = document2.querySelector(`.${BUTTON_CLASS}`);
    if (existing !== null)
      return existing;
    let filters = document2.querySelector(FILTER_SELECTOR)?.parentElement;
    if (filters == null)
      return null;
    let button2 = createButton(document2, onClick3);
    return filters.prepend(spacingBox(button2)), button2;
  }
  function renderAllRows(document2) {
    let view = document2.defaultView;
    view !== null && document2.dispatchEvent(
      new view.KeyboardEvent("keydown", { altKey: !0, bubbles: !0, ctrlKey: !0, key: "v" })
    );
  }
  function showOrder(feed, button2, order) {
    feed.dataset.fixAdoActivityOrder !== order && (feed.dataset.fixAdoActivityOrder = order);
    let text = button2?.querySelector(`.${TEXT_CLASS}`);
    button2 !== null && text !== null && text !== void 0 && text.textContent !== LABELS2[order] && (text.textContent = LABELS2[order], button2.title = `Show ${LABELS2[flipped(order)].toLowerCase()}`);
  }
  function createActivityOrder(options) {
    let { document: document2, storage } = options, order = storage.load() ?? DEFAULT_ORDER, fullyRenderedFeeds = /* @__PURE__ */ new WeakSet();
    function flip2() {
      order = flipped(order), storage.save(order), sync4();
    }
    function sync4() {
      let feed = document2.querySelector(FEED_SELECTOR);
      feed !== null && (order === "oldest-first" && !fullyRenderedFeeds.has(feed) && (fullyRenderedFeeds.add(feed), renderAllRows(document2)), showOrder(feed, findOrAddButton(document2, flip2), order));
    }
    return { sync: sync4 };
  }

  // azure-devops/src/features/activity-order/style.css
  var style_default3 = `/* The activity feed on a pull request's Overview, oldest first. Azure DevOps renders the rows
   newest first and keeps them that way in the DOM; the feed lays them out bottom to top. */
.activity-feed-list[data-fix-ado-activity-order="oldest-first"] {
  display: block;
}

/* Tab and screen reader order follow the rows as shown, where reading-flow is supported. */
.activity-feed-list[data-fix-ado-activity-order="oldest-first"] > tbody {
  display: flex;
  flex-direction: column-reverse;
  reading-flow: flex-visual;
}

.activity-feed-list[data-fix-ado-activity-order="oldest-first"] > tbody > tr {
  display: block;
}

/* The timeline line ends at the row that is now on top, and at the one now at the bottom. */
.activity-feed-list[data-fix-ado-activity-order="oldest-first"]
  .bolt-timeline-first-row
  .bolt-timeline-icon-prefix,
.activity-feed-list[data-fix-ado-activity-order="oldest-first"]
  .bolt-timeline-last-row
  .bolt-timeline-icon-suffix {
  visibility: visible;
}

.activity-feed-list[data-fix-ado-activity-order="oldest-first"]
  .bolt-timeline-first-row
  .bolt-timeline-icon-suffix,
.activity-feed-list[data-fix-ado-activity-order="oldest-first"]
  .bolt-timeline-last-row
  .bolt-timeline-icon-prefix {
  visibility: hidden;
}

/* The dashed piece of the line leads to the comment box, which is now the bottom row. */
.activity-feed-list.can-add-comments[data-fix-ado-activity-order="oldest-first"]
  .bolt-timeline-row:nth-child(4)
  .bolt-timeline-icon-prefix {
  border-left-style: solid;
}

.activity-feed-list.can-add-comments[data-fix-ado-activity-order="oldest-first"]
  .bolt-timeline-first-row
  .bolt-timeline-icon-prefix,
.activity-feed-list.can-add-comments[data-fix-ado-activity-order="oldest-first"]
  .bolt-timeline-first-row
  + .bolt-timeline-row
  .bolt-timeline-icon-suffix {
  border-left-style: dashed;
}

/* The sort button's icon, drawn like Azure DevOps's line icons. */
.fix-ado-activity-order-icon {
  flex: none;
  width: 16px;
  height: 16px;
  margin-right: 8px;
  vertical-align: middle;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
`;

  // azure-devops/src/features/activity-order/index.ts
  var ORDER_KEY = "activity-order", activityOrder = {
    change: { kind: "new", version: "1.11.0" },
    description: "The comments and updates on a pull request's Overview run from old to new, with a button to flip them.",
    id: "activity-order",
    name: "Oldest first",
    start({ document: document2, isInFrame: isInFrame2 }) {
      if (isInFrame2)
        return null;
      let order = createActivityOrder({
        document: document2,
        storage: {
          load: () => GM_getValue(ORDER_KEY, null),
          save: (picked) => {
            GM_setValue(ORDER_KEY, picked);
          }
        }
      });
      return {
        sync({ page }) {
          page.kind === "pull-request" && order.sync();
        }
      };
    },
    styles: [style_default3]
  };

  // azure-devops/src/core/fold-toggle.ts
  var CHEVRONS = { folded: "ms-Icon--ChevronRightMed", open: "ms-Icon--ChevronDownMed" };
  function createChevron(document2) {
    let iconFont = document2.createElement("span");
    iconFont.className = "fluent-icons-enabled";
    let chevron = document2.createElement("span");
    return chevron.className = "left-icon flex-noshrink fabric-icon small", chevron.setAttribute("aria-hidden", "true"), iconFont.append(chevron), iconFont;
  }
  function createFoldToggle(document2, className) {
    let toggle = document2.createElement("button");
    return toggle.type = "button", toggle.className = `${className} bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment`, toggle.append(createChevron(document2)), toggle;
  }
  function showFoldToggleState(toggle, isOpen, labels) {
    let expanded = String(isOpen);
    if (toggle.getAttribute("aria-expanded") === expanded)
      return;
    toggle.setAttribute("aria-expanded", expanded), toggle.title = isOpen ? labels.open : labels.folded, toggle.setAttribute("aria-label", labels.name);
    let chevron = toggle.querySelector(".fabric-icon");
    chevron?.classList.toggle(CHEVRONS.open, isOpen), chevron?.classList.toggle(CHEVRONS.folded, !isOpen);
  }

  // azure-devops/src/features/collapsible-threads/bulk-buttons.ts
  var FILTER_SELECTOR2 = ".repos-activity-filter-dropdown", BULK_BOX_CLASS = "fix-ado-thread-bulk-buttons", BULK_BUTTONS = [
    {
      className: "fix-ado-all-threads-button",
      group: "all",
      labels: { collapse: "Collapse all threads", expand: "Expand all threads" }
    },
    {
      className: "fix-ado-done-threads-button",
      group: "done",
      labels: { collapse: "Collapse done threads", expand: "Expand done threads" }
    }
  ], isEveryCollapsed = (feedThreads) => feedThreads.length > 0 && feedThreads.every((feedThread) => feedThread.thread.dataset.fixAdoThread === "collapsed"), doneThreadsOf = (feedThreads) => feedThreads.filter((feedThread) => feedThread.isDone);
  function groupStatesAfter(group2, feedThreads, current) {
    if (group2 === "all") {
      let state = isEveryCollapsed(feedThreads) ? "open" : "collapsed";
      return { done: state, other: state };
    }
    return isEveryCollapsed(doneThreadsOf(feedThreads)) ? { ...current, done: "open" } : { done: "collapsed", other: "open" };
  }
  function createBulkButton(document2, { className, group: group2, labels }, onClick3) {
    let text = Object.assign(document2.createElement("span"), {
      className: "bolt-button-text",
      textContent: labels.collapse
    }), button2 = document2.createElement("button");
    return button2.type = "button", button2.className = `${className} bolt-button enabled bolt-focus-treatment`, button2.append(text), button2.addEventListener("click", () => {
      onClick3(group2);
    }), button2;
  }
  function createBulkBox(document2, onClick3) {
    let box = Object.assign(document2.createElement("div"), {
      className: `${BULK_BOX_CLASS} margin-bottom-16 inline-flex-row`
    });
    return box.append(...BULK_BUTTONS.map((bulkButton) => createBulkButton(document2, bulkButton, onClick3))), box;
  }
  function findOrAddBulkBox(document2, onClick3) {
    let bar = document2.querySelector(FILTER_SELECTOR2)?.parentElement;
    if (bar == null)
      return null;
    let existing = bar.querySelector(`.${BULK_BOX_CLASS}`);
    if (existing !== null)
      return existing;
    let box = createBulkBox(document2, onClick3);
    return bar.prepend(box), box;
  }
  function setHidden(element4, hidden) {
    element4.hidden !== hidden && (element4.hidden = hidden);
  }
  function setLabel(button2, label) {
    let text = button2.querySelector(".bolt-button-text");
    text !== null && text.textContent !== label && (text.textContent = label);
  }
  function showBulkButtons(box, feedThreads) {
    for (let { className, group: group2, labels } of BULK_BUTTONS) {
      let button2 = box.querySelector(`.${className}`), groupThreads = group2 === "all" ? feedThreads : doneThreadsOf(feedThreads);
      button2 !== null && (setLabel(button2, isEveryCollapsed(groupThreads) ? labels.expand : labels.collapse), setHidden(button2, group2 === "done" && groupThreads.length === 0));
    }
  }

  // azure-devops/src/pull-requests/feed-threads.ts
  var FEED_THREAD_SELECTOR = ".activity-feed-list .repos-discussion-thread", HEADER_SELECTOR = ".repos-discussion-comment-header", STATUS_SELECTOR = ".bolt-dropdown-expandable .bolt-dropdown-expandable-button-label", RESOLVED_STATUS = "Resolved", UNREAD_COMMENT_MARKER_SELECTOR = ".repos-unread-comment-marker", UNRESOLVED_STATUSES = /* @__PURE__ */ new Set(["Active", "Pending"]);
  function timeBoxOf(header) {
    let nameAndTime = header.firstElementChild;
    return nameAndTime === null ? null : nameAndTime.querySelector(":scope > :has(time)") ?? nameAndTime;
  }
  function feedThreadOf(thread) {
    let header = thread.querySelector(HEADER_SELECTOR), timeBox = header === null ? null : timeBoxOf(header);
    if (header === null || timeBox === null)
      return null;
    let status = header.querySelector(STATUS_SELECTOR)?.textContent.trim() ?? "", isUnresolved = UNRESOLVED_STATUSES.has(status);
    return {
      hasUnreadComment: thread.querySelector(UNREAD_COMMENT_MARKER_SELECTOR) !== null,
      header,
      isDone: status !== "" && !isUnresolved,
      isResolved: status === RESOLVED_STATUS,
      isUnresolved,
      status,
      thread,
      timeBox
    };
  }
  var feedThreadElements = (document2) => [
    ...document2.querySelectorAll(FEED_THREAD_SELECTOR)
  ];

  // azure-devops/src/features/collapsible-threads/collapsible-threads.ts
  var TOGGLE_CLASS = "fix-ado-thread-toggle", TOGGLE_LABELS = { folded: "Expand thread", name: "Thread", open: "Collapse thread" }, THREAD_ID_PATTERN = /\bthreadId-(?<id>\d+)\b/u, FILE_HEADER_SELECTOR = ".comment-file-header", FILE_TITLE_SELECTOR = ".comment-file-header-title", AUTHOR_COLUMN_SELECTOR = ".repos-comment-editor-fit";
  function threadIdOf(thread, knownIds) {
    let field = thread.querySelector(".repos-discussion-thread-reply input"), id = THREAD_ID_PATTERN.exec(field?.className ?? "")?.groups?.id;
    return id !== void 0 && knownIds.set(thread, id), id ?? knownIds.get(thread) ?? null;
  }
  function fileHeaderOf(thread) {
    let before = thread.previousElementSibling;
    return before?.matches(FILE_HEADER_SELECTOR) === !0 ? before : null;
  }
  function findOrCreateToggle({ header, thread }, onClick3) {
    let existing = thread.querySelector(`.${TOGGLE_CLASS}`) ?? fileHeaderOf(thread)?.querySelector(`.${TOGGLE_CLASS}`);
    if (existing != null)
      return existing;
    let toggle = createFoldToggle(header.ownerDocument, TOGGLE_CLASS);
    return toggle.addEventListener("click", () => {
      onClick3(thread);
    }), toggle;
  }
  function toggleBoxOf({ header, thread }, state) {
    let fileTitle = fileHeaderOf(thread)?.querySelector(FILE_TITLE_SELECTOR) ?? null;
    return state === "open" && fileTitle !== null ? fileTitle : header.closest(AUTHOR_COLUMN_SELECTOR)?.parentElement ?? header;
  }
  function placeToggle(toggle, box) {
    box.firstElementChild !== toggle && box.prepend(toggle);
  }
  function unpickedStateOf(feedThread, groupStates) {
    return (feedThread.isDone ? groupStates.done : groupStates.other) ?? (feedThread.isDone && !feedThread.hasUnreadComment ? "collapsed" : "open");
  }
  function dropPicks({
    feedThreads,
    group: group2,
    knownIds,
    pickedStates
  }) {
    let doneThreads = doneThreadsOf(feedThreads);
    if (group2 !== "done" || !isEveryCollapsed(doneThreads)) {
      pickedStates.clear();
      return;
    }
    for (let { thread } of doneThreads)
      pickedStates.delete(threadIdOf(thread, knownIds) ?? "");
  }
  var loadedFeedThreads = (document2) => feedThreadElements(document2).map((thread) => feedThreadOf(thread)).filter((feedThread) => feedThread !== null);
  function createCollapsibleThreads({ document: document2 }) {
    let pickedStates = /* @__PURE__ */ new Map(), knownIds = /* @__PURE__ */ new WeakMap(), groupStates = { done: null, other: null };
    function stateOf(feedThread) {
      return pickedStates.get(threadIdOf(feedThread.thread, knownIds) ?? "") ?? unpickedStateOf(feedThread, groupStates);
    }
    function applyBulk(group2) {
      let feedThreads = loadedFeedThreads(document2);
      dropPicks({ feedThreads, group: group2, knownIds, pickedStates }), groupStates = groupStatesAfter(group2, feedThreads, groupStates), sync4();
    }
    function flip2(thread) {
      let threadId = threadIdOf(thread, knownIds);
      threadId !== null && (pickedStates.set(threadId, thread.dataset.fixAdoThread === "open" ? "collapsed" : "open"), sync4());
    }
    function syncThread2(feedThread) {
      let state = stateOf(feedThread);
      feedThread.thread.dataset.fixAdoThread !== state && (feedThread.thread.dataset.fixAdoThread = state);
      let toggle = findOrCreateToggle(feedThread, flip2);
      placeToggle(toggle, toggleBoxOf(feedThread, state)), showFoldToggleState(toggle, state === "open", TOGGLE_LABELS);
    }
    function sync4() {
      let box = findOrAddBulkBox(document2, applyBulk), feedThreads = loadedFeedThreads(document2);
      for (let feedThread of feedThreads)
        syncThread2(feedThread);
      box !== null && showBulkButtons(box, feedThreads);
    }
    return { sync: sync4 };
  }

  // azure-devops/src/features/collapsible-threads/style.css
  var style_default4 = `/* The toggle sits before the author of the first comment, level with the avatar, or before the
   file's icon on an open thread on a file. The box it is in gives up some room on the left. */
.fix-ado-thread-toggle {
  flex: none;
  align-self: flex-start;
  margin-right: 4px;
}

.comment-file-header-title > .fix-ado-thread-toggle {
  align-self: center;
}

.repos-discussion-comment:has(> .flex-column > .flex-row > .fix-ado-thread-toggle),
.comment-file-header-title:has(> .fix-ado-thread-toggle) {
  padding-left: 8px;
}

/* Before the author, the toggle keeps the offset it has before a file's icon: the comment's own
   box sits 16px further in (a 4px margin and 12px padding). */
.repos-discussion-comment .fix-ado-thread-toggle {
  margin-left: -16px;
}

/* A collapsed thread shows the header of its first comment: who wrote it, when, and the
   thread's Resolved or Unresolved chip. Its text, the other comments and the reply box hide. */
[data-fix-ado-thread="collapsed"] .repos-comment-viewer:not(:first-child),
[data-fix-ado-thread="collapsed"] .repos-discussion-thread-reply,
[data-fix-ado-thread="collapsed"] .repos-discussion-comment-header ~ * {
  display: none;
}

[data-fix-ado-thread="collapsed"] .repos-discussion-comment-header {
  margin-bottom: 0;
}

/* The actions at the end of the header hide too. The status dropdown among them stays in
   the page, where the script reads the thread's status. */
[data-fix-ado-thread="collapsed"] .repos-discussion-comment-header > :not(:first-child) {
  display: none;
}

/* The card stays, with little room around the one line that is left. */
[data-fix-ado-thread="collapsed"] .repos-comment-viewer {
  padding: 0 12px;
}

/* Azure DevOps gives a first comment with replies its own border and bottom padding, in a rule
   as specific as the plain one. The second selector outranks it. */
[data-fix-ado-thread="collapsed"] .repos-discussion-comment,
[data-fix-ado-thread="collapsed"] .repos-discussion-comment.has-replies {
  padding: 4px 20px;
  border-bottom: 0;
}

[data-fix-ado-thread="collapsed"] .repos-discussion-comment > .flex-column > .flex-row {
  align-items: center;
}

[data-fix-ado-thread="collapsed"] .fix-ado-thread-toggle {
  align-self: center;
}

/* One line, also in a narrow window, where Azure DevOps puts the time under the name. */
[data-fix-ado-thread="collapsed"] .repos-discussion-comment-header > :first-child {
  flex-direction: row;
  align-items: center;
}

[data-fix-ado-thread="collapsed"] .repos-comment-header-persona {
  margin-top: 0;
}

/* A collapsed thread on a file hides the file's name and code too. */
.comment-file-header:has(+ [data-fix-ado-thread="collapsed"]) {
  display: none;
}

/* Azure DevOps keeps the height a thread had when it loaded, as a min-height on its row. A
   collapsed thread drops it. */
.activity-feed-list [style*="min-height"]:has([data-fix-ado-thread="collapsed"]) {
  min-height: 0 !important;
}

/* Collapse all threads and Collapse done threads sit on the left of the bar above the feed.
   The bar puts its filters on the right. */
.fix-ado-thread-bulk-buttons {
  order: -1;
  gap: 8px;
  margin-right: auto;
}

/* A hidden bulk button leaves no gap. Azure DevOps's button classes would show it. */
.fix-ado-thread-bulk-buttons > [hidden] {
  display: none !important;
}
`;

  // azure-devops/src/features/collapsible-threads/index.ts
  var collapsibleThreads = {
    change: { kind: "updated", version: "1.22.0" },
    description: "A button on every thread on a pull request's Overview collapses it. Resolved, Won't fix and Closed threads start collapsed, unless one of their comments is unread. Above the feed, Collapse all threads collapses every thread and turns into Expand all threads. Collapse done threads collapses the done ones, opens the others and turns into Expand done threads, which opens the done ones only. Both also apply to threads that load later.",
    id: "collapsible-threads",
    name: "Collapsible threads",
    start({ document: document2, isInFrame: isInFrame2 }) {
      if (isInFrame2)
        return null;
      let threads = createCollapsibleThreads({ document: document2 });
      return {
        sync({ page }) {
          page.kind === "pull-request" && threads.sync();
        }
      };
    },
    styles: [style_default4]
  };

  // azure-devops/src/features/folded-pushes/folded-pushes.ts
  var HEADER_SELECTOR2 = ".activity-feed-list .iteration-card-header", TITLE_SELECTOR = ".iteration-header .font-weight-semibold", COMMITS_SELECTOR = ".bolt-table-container", TOGGLE_CLASS2 = "fix-ado-push-toggle", TOGGLE_LABELS2 = { folded: "Show commits", name: "Commits", open: "Hide commits" };
  function pushOf(header) {
    let card = header.closest(".bolt-card");
    if (card === null)
      return null;
    let pushedAt = header.querySelector("time")?.getAttribute("datetime") ?? null;
    return { card, header, pushedAt };
  }
  function findOrAddToggle({ header }, onClick3) {
    let existing = header.querySelector(`.${TOGGLE_CLASS2}`);
    if (existing !== null)
      return existing;
    let title = header.querySelector(TITLE_SELECTOR);
    if (title === null)
      return null;
    let toggle = createFoldToggle(header.ownerDocument, TOGGLE_CLASS2);
    return toggle.addEventListener("click", (event) => {
      event.preventDefault(), event.stopPropagation(), onClick3(header);
    }), title.after(toggle), toggle;
  }
  function createFoldedPushes({ document: document2 }) {
    let openPushes = /* @__PURE__ */ new Set();
    function flip2(header) {
      let pushedAt = pushOf(header)?.pushedAt ?? null;
      pushedAt !== null && (openPushes.delete(pushedAt) || openPushes.add(pushedAt), sync4());
    }
    function syncPush(push) {
      let hasCommits = push.card.querySelector(COMMITS_SELECTOR) !== null, state = hasCommits && push.pushedAt !== null && openPushes.has(push.pushedAt) ? "open" : "folded";
      if (push.card.dataset.fixAdoPush !== state && (push.card.dataset.fixAdoPush = state), hasCommits) {
        let toggle = findOrAddToggle(push, flip2);
        toggle !== null && showFoldToggleState(toggle, state === "open", TOGGLE_LABELS2);
      } else
        push.header.querySelector(`.${TOGGLE_CLASS2}`)?.remove();
    }
    function sync4() {
      for (let header of document2.querySelectorAll(HEADER_SELECTOR2)) {
        let push = pushOf(header);
        push !== null && syncPush(push);
      }
    }
    return { sync: sync4 };
  }

  // azure-devops/src/features/folded-pushes/style.css
  var style_default5 = `/* A push in the activity feed of a pull request's Overview. Its header is one line, like the
   feed's other updates: avatar, title, toggle, and the time at the right. */
[data-fix-ado-push] .iteration-header {
  align-items: center;
  padding: 6px 20px;
}

[data-fix-ado-push] .iteration-header > .flex-column {
  flex-direction: row;
  align-items: center;
}

[data-fix-ado-push] .iteration-header .font-weight-semibold {
  font-weight: normal;
}

[data-fix-ado-push] .iteration-header .bolt-coin {
  margin-top: 0;
}

[data-fix-ado-push] .iteration-header .secondary-text {
  flex: none;
  margin-left: auto;
  padding-left: 4px;
  line-height: 32px;
}

.fix-ado-push-toggle {
  flex: none;
  margin: 0 4px;
}

/* Folded: no card around it, no commits under it. */
[data-fix-ado-push="folded"] {
  margin: 0 20px;
  padding: 0;
  background: transparent;
  box-shadow: none;
}

[data-fix-ado-push="folded"] .iteration-card-header,
[data-fix-ado-push="folded"] .iteration-card-header:hover {
  margin: 0;
  background: transparent;
}

[data-fix-ado-push="folded"] .iteration-header {
  padding: 2px 0;
  border-bottom: 0;
}

/* The push number in the timeline needs more room than a dot. A folded push gives it less
   line above and below, so the row is as tall as the feed's other updates and the number
   sits level with the avatar. */
.bolt-timeline-row:has([data-fix-ado-push="folded"])
  .activity-feed-sequence
  .bolt-timeline-icon-prefix {
  min-height: 3px;
}

.bolt-timeline-row:has([data-fix-ado-push="folded"])
  .activity-feed-sequence
  .bolt-timeline-icon-suffix {
  min-height: 0;
}

[data-fix-ado-push="folded"] .iteration-card-header ~ * {
  display: none;
}

/* Azure DevOps keeps the height a push had when it loaded, as a min-height on its row. A
   folded push drops it. */
.activity-feed-list [style*="min-height"]:has([data-fix-ado-push="folded"]) {
  min-height: 0 !important;
}
`;

  // azure-devops/src/features/folded-pushes/index.ts
  var foldedPushes = {
    change: { kind: "new", version: "1.12.0" },
    description: "A push on a pull request's Overview is one line, like its other updates, with a button that shows its commits.",
    id: "folded-pushes",
    name: "Folded pushes",
    start({ document: document2, isInFrame: isInFrame2 }) {
      if (isInFrame2)
        return null;
      let pushes = createFoldedPushes({ document: document2 });
      return {
        sync({ page }) {
          page.kind === "pull-request" && pushes.sync();
        }
      };
    },
    styles: [style_default5]
  };

  // azure-devops/src/features/joined-reviewer-lines/joined-reviewer-lines.ts
  var ROW_SELECTOR = ".activity-feed-list > tbody > .bolt-timeline-row", JOINED_CLASS = "fix-ado-joined-line", LINE_SELECTOR = `.activity-card-subtle:not(.${JOINED_CLASS})`, PERSON_LINE_PART_COUNT = 6, isBlank = (node) => node.nodeType === node.TEXT_NODE && (node.textContent ?? "").trim() === "", isText = (node) => node?.nodeType === node?.TEXT_NODE;
  function avatarNamesOf(line2) {
    let names = [...line2.querySelectorAll(".bolt-coin")].map(
      (avatar) => avatar.getAttribute("aria-label") ?? ""
    ), [actorName, personName] = names;
    return names.length === 2 && actorName !== void 0 && personName !== void 0 ? [actorName, personName] : null;
  }
  function personLineOf(row) {
    let line2 = row.querySelector(LINE_SELECTOR);
    if (line2 === null)
      return null;
    let parts = [...line2.childNodes].filter((node) => !isBlank(node)), [actorAvatar, actorLabel, words, avatar, label, ending] = parts, names = avatarNamesOf(line2);
    return names === null || parts.length !== PERSON_LINE_PART_COUNT || actorAvatar === void 0 || actorLabel === void 0 || avatar === void 0 || label === void 0 || !isText(words) || !isText(ending) ? null : {
      actor: [actorAvatar, actorLabel],
      actorName: names[0],
      ending: ending.textContent ?? "",
      line: line2,
      person: [avatar, label],
      personName: names[1],
      row,
      words: words.textContent ?? ""
    };
  }
  var continuesRun = (run, next) => run[0]?.actorName === next.actorName && run[0].words.trim() === next.words.trim();
  function runsOf(rows) {
    let runs = [], current = [];
    for (let row of rows) {
      let personLine = personLineOf(row);
      personLine !== null && continuesRun(current, personLine) ? current.push(personLine) : (current = personLine === null ? [] : [personLine], personLine !== null && runs.push(current));
    }
    return runs.filter((run) => run.length > 1);
  }
  function groupsOf(run) {
    let groups = /* @__PURE__ */ new Map();
    for (let personLine of run.toReversed()) {
      let key = personLine.ending.trim();
      groups.set(key, [...groups.get(key) ?? [], personLine]);
    }
    return [...groups.values()];
  }
  var signatureOf = (run) => JSON.stringify(
    run.map(({ actorName, ending, personName, words }) => [actorName, words, personName, ending])
  ), clonesOf = (nodes) => nodes.map((node) => node.cloneNode(!0));
  function groupParts(group2) {
    let parts = [];
    for (let [index, personLine] of group2.entries())
      index > 0 && parts.push(", "), parts.push(...clonesOf(personLine.person));
    return parts.push(group2[0]?.ending ?? ""), parts;
  }
  function joinedParts(newest, run) {
    let parts = [...clonesOf(newest.actor), newest.words];
    for (let [index, group2] of groupsOf(run).entries())
      index > 0 && parts.push(", "), parts.push(...groupParts(group2));
    return parts;
  }
  function createJoinedLine(newest, run, signature) {
    let joined = newest.line.cloneNode(!1);
    return joined.classList.add(JOINED_CLASS), joined.dataset.fixAdoJoinedFrom = signature, joined.append(...joinedParts(newest, run)), joined;
  }
  function showJoined(run) {
    let [newest] = run;
    if (newest === void 0)
      return;
    let signature = signatureOf(run), existing = newest.row.querySelector(`.${JOINED_CLASS}`);
    existing?.dataset.fixAdoJoinedFrom !== signature && (existing?.remove(), newest.line.after(createJoinedLine(newest, run, signature)));
  }
  function markRow(row, mark) {
    row.dataset.fixAdoJoined !== mark && (row.dataset.fixAdoJoined = mark), mark === "hidden" && row.querySelector(`.${JOINED_CLASS}`)?.remove();
  }
  function unmarkRow(row) {
    delete row.dataset.fixAdoJoined, row.querySelector(`.${JOINED_CLASS}`)?.remove();
  }
  function createJoinedReviewerLines({ document: document2 }) {
    function sync4() {
      let runs = runsOf([...document2.querySelectorAll(ROW_SELECTOR)]), joinedRows = new Set(runs.flat().map(({ row }) => row));
      for (let row of document2.querySelectorAll("[data-fix-ado-joined]"))
        joinedRows.has(row) || unmarkRow(row);
      for (let run of runs) {
        for (let [index, { row }] of run.entries())
          markRow(row, index === 0 ? "line" : "hidden");
        showJoined(run);
      }
    }
    return { sync: sync4 };
  }

  // azure-devops/src/features/joined-reviewer-lines/style.css
  var style_default6 = `/* Lines that add a reviewer, joined to one. The newest row of a run shows the joined line in
   place of Azure DevOps's own; the other rows hide. */
[data-fix-ado-joined="hidden"] {
  /* The sort order of the feed sets a display on its rows. */
  display: none !important;
}

[data-fix-ado-joined="line"] .activity-card-subtle:not(.fix-ado-joined-line) {
  display: none;
}
`;

  // azure-devops/src/features/joined-reviewer-lines/index.ts
  var joinedReviewerLines = {
    change: { kind: "new", version: "1.12.0" },
    description: "Lines next to each other on a pull request's Overview that add a reviewer are one line, with required and optional reviewers grouped.",
    id: "joined-reviewer-lines",
    name: "Joined reviewer lines",
    start({ document: document2, isInFrame: isInFrame2 }) {
      if (isInFrame2)
        return null;
      let lines = createJoinedReviewerLines({ document: document2 });
      return {
        sync({ page }) {
          page.kind === "pull-request" && lines.sync();
        }
      };
    },
    styles: [style_default6]
  };

  // azure-devops/src/features/new-activity-chips/new-activity-chips.ts
  var ROW_SELECTOR2 = ".activity-feed-list .bolt-timeline-row", FLAGGED_ROW_SELECTOR = ".activity-feed-sequence.new", THREAD_SELECTOR = ".repos-discussion-thread", CHIP_CLASS = "fix-ado-new-chip";
  function createChip(document2) {
    let chip = document2.createElement("div");
    chip.className = `${CHIP_CLASS} flex-noshrink margin-left-8 bolt-pill flex-row flex-center outlined compact`;
    let content = document2.createElement("div");
    return content.className = "bolt-pill-content text-ellipsis", content.textContent = "New", chip.append(content), chip;
  }
  function isNewRow(row, time, lastVisit) {
    if (row.querySelector(THREAD_SELECTOR) !== null)
      return !1;
    let happenedAt = Date.parse(time.dateTime);
    return lastVisit !== null && happenedAt > lastVisit || row.querySelector(FLAGGED_ROW_SELECTOR) !== null;
  }
  function syncRow(row, lastVisit) {
    let chip = row.querySelector(`.${CHIP_CLASS}`), time = row.querySelector("time"), timeBox = time?.parentElement ?? null;
    if (time === null || timeBox === null || !isNewRow(row, time, lastVisit)) {
      chip?.remove();
      return;
    }
    (chip === null || timeBox.nextElementSibling !== chip) && timeBox.after(chip ?? createChip(row.ownerDocument));
  }
  function createNewActivityChips({
    document: document2,
    now,
    visits
  }) {
    let shownKey2 = null, lastVisit = null;
    function leave() {
      shownKey2 !== null && visits.save(shownKey2, now());
    }
    function sync4(pullRequestKey) {
      if (pullRequestKey !== shownKey2 && (leave(), shownKey2 = pullRequestKey, lastVisit = pullRequestKey === null ? null : visits.lastVisit(pullRequestKey)), pullRequestKey !== null)
        for (let row of document2.querySelectorAll(ROW_SELECTOR2))
          syncRow(row, lastVisit);
    }
    return { leave, sync: sync4 };
  }

  // azure-devops/src/features/new-activity-chips/visit-store.ts
  var KEY_PREFIX = "last-visit:", visitedAtOf = (value) => typeof value == "number" && Number.isFinite(value) ? value : null;
  function createVisitStore(storage) {
    return {
      deleteOlderThan(maxAgeMs, now) {
        for (let key of storage.keys().filter((name) => name.startsWith(KEY_PREFIX))) {
          let visitedAt = visitedAtOf(storage.load(key));
          (visitedAt === null || now - visitedAt > maxAgeMs) && storage.remove(key);
        }
      },
      lastVisit: (pullRequestKey) => visitedAtOf(storage.load(`${KEY_PREFIX}${pullRequestKey}`)),
      save(pullRequestKey, visitedAt) {
        storage.save(`${KEY_PREFIX}${pullRequestKey}`, visitedAt);
      }
    };
  }

  // azure-devops/src/core/page.ts
  function parsePullRequestPage(location2, basePath2) {
    if (isPullRequestCreateLocation(location2))
      return { kind: "pull-request-create" };
    let pullRequest = parsePullRequestHref(location2.pathname, basePath2);
    return pullRequest ? { kind: "pull-request", pullRequest } : { kind: "other" };
  }
  function parsePage(location2, basePath2) {
    if (isBoardLocation(location2))
      return { kind: "board" };
    let listPage = parsePullRequestListLocation(location2, basePath2);
    return listPage ? { kind: "pull-request-list", listPage } : isPullRequestInboxLocation(location2) ? { kind: "pull-request-inbox" } : parsePullRequestPage(location2, basePath2);
  }
  function pullRequestOf(page) {
    return page.kind === "pull-request" ? page.pullRequest : null;
  }

  // azure-devops/src/features/new-activity-chips/style.css
  var style_default7 = `/* The New chip glows like an unread comment, in Azure DevOps's colour for links and focus. */
.bolt-pill.fix-ado-new-chip {
  border-color: var(--communication-background, rgb(0, 120, 212));
  box-shadow: 0 0 6px 2px var(--communication-background, rgb(0, 120, 212));
  color: var(--communication-foreground, rgb(0, 90, 158));
  font-weight: 600;
}

/* A push shows its time in a block under its title: the chip sits on the same line. */
.fix-ado-new-chip {
  display: inline-flex;
  vertical-align: middle;
}

/* Forced colors drop box shadows, so the glow becomes an outline there. */
@media (forced-colors: active) {
  .bolt-pill.fix-ado-new-chip {
    outline: 2px solid Highlight;
    outline-offset: 1px;
  }
}
`;

  // azure-devops/src/features/new-activity-chips/index.ts
  var MAX_VISIT_AGE_MS = 2592e6, newActivityChips = {
    change: { kind: "new", version: "1.18.0" },
    description: "A New chip that glows on pushes, votes and other lines on a pull request's Overview that came after your last visit.",
    id: "new-activity-chips",
    name: "New chips on pushes and other changes",
    start({ basePath: basePath2, document: document2, isInFrame: isInFrame2, now }) {
      if (isInFrame2)
        return null;
      let visits = createVisitStore({
        keys: () => GM_listValues(),
        load: (key) => GM_getValue(key, null),
        remove: (key) => {
          GM_deleteValue(key);
        },
        save: (key, visitedAt) => {
          GM_setValue(key, visitedAt);
        }
      });
      visits.deleteOlderThan(MAX_VISIT_AGE_MS, now());
      let chips = createNewActivityChips({ document: document2, now, visits }), keyOf2 = ({ project, pullRequestId, repository }) => `${location.host}${basePath2}/${project}/${repository}/${pullRequestId}`;
      return globalThis.addEventListener("pagehide", chips.leave), document2.addEventListener("visibilitychange", () => {
        document2.visibilityState === "hidden" && chips.leave();
      }), {
        sync({ page }) {
          let pullRequest = pullRequestOf(page);
          chips.sync(pullRequest === null ? null : keyOf2(pullRequest));
        }
      };
    },
    styles: [style_default7]
  };

  // azure-devops/src/pipeline/pipeline-issue-box-collapse.ts
  var COLLAPSE_ICONS = { collapsed: "ms-Icon--ChevronRightMed", open: "ms-Icon--ChevronDownMed" };
  function setCollapsed(box, button2, isCollapsed) {
    box.toggleAttribute("data-collapsed", isCollapsed), button2.setAttribute("aria-expanded", String(!isCollapsed));
    let icon = button2.querySelector(".fabric-icon");
    icon?.classList.toggle(COLLAPSE_ICONS.collapsed, isCollapsed), icon?.classList.toggle(COLLAPSE_ICONS.open, !isCollapsed);
  }
  function createChevron2(document2) {
    let iconFont = document2.createElement("span");
    iconFont.className = "fluent-icons-enabled";
    let icon = document2.createElement("span");
    return icon.className = "left-icon flex-noshrink fabric-icon small", icon.setAttribute("aria-hidden", "true"), iconFont.append(icon), iconFont;
  }
  function createCollapseButton(document2) {
    let button2 = document2.createElement("button");
    return button2.type = "button", button2.className = "bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment fix-ado-issue-box-collapse", button2.setAttribute("aria-label", "Errors and warnings"), button2.append(createChevron2(document2)), button2;
  }
  function addCollapseButton(box, header, collapse) {
    let button2 = createCollapseButton(box.ownerDocument);
    button2.addEventListener("click", () => {
      let isCollapsed = !Object.hasOwn(box.dataset, "collapsed");
      setCollapsed(box, button2, isCollapsed), collapse.onToggle(isCollapsed);
    }), header.prepend(button2), setCollapsed(box, button2, collapse.isCollapsed);
  }

  // azure-devops/src/pipeline/pipeline-issues.ts
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

  // azure-devops/src/pipeline/pipeline-issue-list.ts
  var SVG_NAMESPACE3 = "http://www.w3.org/2000/svg", ICON_SIZES = {
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
  function setAttributes2(element4, attributes) {
    for (let [name, value] of Object.entries(attributes))
      element4.setAttribute(name, value);
  }
  function createKindIcon(document2, kind, size) {
    let { className, drawing, pixels: pixels2 } = ICON_SIZES[size], icon = document2.createElementNS(SVG_NAMESPACE3, "svg");
    setAttributes2(icon, {
      "aria-label": KIND_LABELS[kind],
      class: `bolt-status flex-noshrink ${KIND_STATUSES[kind]}${className} fix-ado-kind-icon`,
      "data-kind": kind,
      height: String(pixels2),
      role: "img",
      viewBox: `0 0 ${drawing} ${drawing}`,
      width: String(pixels2)
    });
    let circle = document2.createElementNS(SVG_NAMESPACE3, "circle"), middle = String(drawing / 2);
    setAttributes2(circle, { cx: middle, cy: middle, r: middle });
    let mark = document2.createElementNS(SVG_NAMESPACE3, "path");
    return setAttributes2(mark, { d: ICON_MARKS[kind][size], fill: "#fff" }), icon.append(circle, mark), icon;
  }
  function createIssueCounts(document2, counts) {
    return ["error", "warning"].flatMap((kind) => {
      let count = kind === "error" ? counts.errorCount : counts.warningCount;
      if (count === 0)
        return [];
      let text = String(count), badge = createElement(document2, { className: "fix-ado-issue-count", tag: "span", text });
      return badge.dataset.kind = kind, badge.setAttribute("role", "img"), badge.setAttribute("aria-label", countText(count, kind)), badge.title = countText(count, kind), [badge];
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
    }), links = box.issues.map((issue) => box.createLink(issue)), header = createBoxHeader(document2, box);
    content.append(header, ...links);
    let wrapped = wrapIn(document2, content, LIST_ROW_WRAPPERS);
    return box.collapse !== void 0 && addCollapseButton(wrapped, header, box.collapse), wrapped;
  }

  // azure-devops/src/features/overview-pipeline-issues/overview-pipeline-issues-card.ts
  var OVERVIEW_ISSUES_CLASS = "fix-ado-overview-issues";
  function runLinkOf({ apiBasePath: apiBasePath2, project }, buildId, { jobId, stepId }) {
    return jobId !== null && stepId !== null ? pipelineLogPath(apiBasePath2, project, { buildId, jobId, stepId }) : pipelineRunPath(apiBasePath2, project, buildId);
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
      className: "flex-row flex-center rhythm-horizontal-8 fix-ado-overview-issues-heading-row",
      tag: "div"
    }), kind = worstKindOf(checks.flatMap(({ issues }) => issues));
    return row.append(createKindIcon(document2, kind, "large"), text), row;
  }
  function createIssuesCard(document2, content) {
    let { checks } = content, rows = createElement(document2, {
      className: "padding-vertical-16 padding-horizontal-20 rhythm-vertical-16",
      tag: "div"
    }), heading = createHeading(document2, checks);
    rows.append(
      heading,
      ...checks.map((checkIssues) => createCheckIssueBox(document2, content, checkIssues))
    );
    let block = wrapIn(document2, rows, CARD_WRAPPERS);
    return addCollapseButton(block, heading, content.collapse), block.setAttribute("aria-label", "Pipeline warnings and errors"), block.dataset.fixAdoRendered = JSON.stringify(checks), block;
  }

  // azure-devops/src/pipeline/pipeline-status.ts
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

  // azure-devops/src/pipeline/pipeline-checks.ts
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

  // azure-devops/src/pipeline/pipeline-timeline.ts
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

  // azure-devops/src/features/overview-pipeline-issues/overview-pipeline-issues.ts
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
    let collapse = {
      isCollapsed: data.isCollapsed,
      onToggle: (isCollapsed) => {
        data.isCollapsed = isCollapsed;
      }
    };
    return createIssuesCard(document2, {
      apiBasePath: apiBasePath2,
      checks,
      collapse,
      project: data.pullRequest.project
    });
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
      isCollapsed: !1,
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

  // azure-devops/src/pipeline/pipeline-issue-list.css
  var pipeline_issue_list_default = `/* A run's warnings and errors, in a box like Azure DevOps's check list on a pull
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

/* A collapsed box keeps its header row; a collapsed Overview card keeps its heading. */
.fix-ado-issue-box[data-collapsed] .fix-ado-issue,
.fix-ado-overview-issues[data-collapsed] .fix-ado-issue-box {
  display: none;
}

.fix-ado-issue-box-collapse {
  flex-shrink: 0;
  margin-left: -4px;
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

/* Dark text: white on the warning orange is about 3:1. */
.fix-ado-issue-count[data-kind="warning"] {
  background: var(--component-status-warning, rgb(214, 119, 48));
  color: rgba(0, 0, 0, 0.9);
}

/* Forced colors turn the disc into the text colour, which can be white; the mark takes the
   background colour. */
@media (forced-colors: active) {
  .fix-ado-kind-icon path[fill="#fff"] {
    fill: Canvas;
  }
}
`;

  // azure-devops/src/features/overview-pipeline-issues/index.ts
  var overviewPipelineIssues = {
    change: { kind: "new", version: "1.7.2" },
    description: "The warnings and errors of each check's latest run, above the pull request description.",
    id: "overview-pipeline-issues",
    name: "Warnings and errors",
    start({ basePath: basePath2, client, document: document2, isInFrame: isInFrame2, now }) {
      if (isInFrame2)
        return null;
      let issues = createOverviewPipelineIssues({
        apiBasePath: basePath2,
        document: document2,
        getEvaluations: async (pullRequest) => {
          let { evaluations } = await client.getPolicyEvaluations(pullRequest);
          return evaluations;
        },
        getTimeline: async (project, buildId) => {
          let { records } = await client.getTimeline(project, buildId);
          return records;
        },
        now
      });
      return {
        sync({ page, isTabActive: isTabActive2 }) {
          issues.sync(pullRequestOf(page), isTabActive2);
        }
      };
    },
    styles: [pipeline_issue_list_default]
  };

  // azure-devops/src/features/resolved-thread-chips/resolved-thread-chips.ts
  var CHIP_CLASS2 = "fix-ado-thread-chip";
  function chipKindOf(feedThread) {
    if (feedThread === null || feedThread.status === "")
      return null;
    let { isResolved, isUnresolved, status } = feedThread;
    return isResolved ? { className: "fix-ado-resolved-chip", label: status } : {
      className: isUnresolved ? "fix-ado-unresolved-chip" : "fix-ado-done-chip",
      label: status
    };
  }
  function createChip2(document2, { className, label }) {
    let chip = document2.createElement("div");
    chip.className = `${CHIP_CLASS2} ${className} flex-noshrink margin-left-8 bolt-pill flex-row flex-center outlined compact`;
    let content = document2.createElement("div");
    return content.className = "bolt-pill-content text-ellipsis", content.textContent = label, chip.append(content), chip;
  }
  function syncThread(thread) {
    let feedThread = feedThreadOf(thread), kind = chipKindOf(feedThread), chip = thread.querySelector(`.${CHIP_CLASS2}`);
    kind !== null && chip?.classList.contains(kind.className) === !0 && chip.textContent === kind.label || (chip?.remove(), feedThread !== null && kind !== null && feedThread.timeBox.append(createChip2(thread.ownerDocument, kind)));
  }
  function createResolvedThreadChips({ document: document2 }) {
    function sync4() {
      for (let thread of feedThreadElements(document2))
        syncThread(thread);
    }
    return { sync: sync4 };
  }

  // azure-devops/src/features/resolved-thread-chips/style.css
  var style_default8 = `/* The chip on a thread: Azure DevOps's pill. Resolved in its colour for success, Active and
   Pending in its colour for warnings, another done status in its secondary text colour. */
.bolt-pill.fix-ado-thread-chip {
  font-weight: 600;
}

.bolt-pill.fix-ado-resolved-chip {
  border-color: var(--component-status-success, rgb(85, 163, 98));
  color: var(--component-status-success, rgb(85, 163, 98));
}

.bolt-pill.fix-ado-unresolved-chip {
  border-color: var(--status-warning-text, rgba(184, 94, 6, 1));
  color: var(--status-warning-text, rgba(184, 94, 6, 1));
}

.bolt-pill.fix-ado-done-chip {
  border-color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
}
`;

  // azure-devops/src/features/resolved-thread-chips/index.ts
  var resolvedThreadChips = {
    change: { kind: "updated", version: "1.22.0" },
    description: "A chip with its status on every thread on a pull request's Overview: green for Resolved, orange for Active and Pending, grey for Won't fix and Closed.",
    id: "resolved-thread-chips",
    name: "Status chips on threads",
    start({ document: document2, isInFrame: isInFrame2 }) {
      if (isInFrame2)
        return null;
      let chips = createResolvedThreadChips({ document: document2 });
      return {
        sync({ page }) {
          page.kind === "pull-request" && chips.sync();
        }
      };
    },
    styles: [style_default8]
  };

  // azure-devops/src/core/scroll-behavior.ts
  function scrollBehaviorOf(document2) {
    return document2.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? !1 ? "instant" : "smooth";
  }

  // azure-devops/src/features/scroll-to-bottom/scroll-to-bottom.ts
  var FEED_SELECTOR2 = ".activity-feed-list", SCROLLER_SELECTOR = ".v-scroll-auto", BUTTON_CLASS2 = "fix-ado-scroll-to-bottom", LABEL = "Scroll to bottom", BOTTOM_MARGIN = 16, FOLLOW_QUIET_MS = 2e3, SVG_NAMESPACE4 = "http://www.w3.org/2000/svg", ARROW_DOWN_PATH = "M8 3v10M3.5 8.5L8 13l4.5-4.5";
  function arrowDownIcon(document2) {
    let svg = document2.createElementNS(SVG_NAMESPACE4, "svg");
    svg.setAttribute("aria-hidden", "true"), svg.setAttribute("viewBox", "0 0 16 16");
    let path = document2.createElementNS(SVG_NAMESPACE4, "path");
    return path.setAttribute("d", ARROW_DOWN_PATH), svg.append(path), svg;
  }
  function scrollerOf(feed) {
    let box = feed.parentElement?.closest(SCROLLER_SELECTOR) ?? null;
    for (; box !== null && box.scrollHeight <= box.clientHeight; )
      box = box.parentElement?.closest(SCROLLER_SELECTOR) ?? null;
    return box;
  }
  function createButton2(document2, onClick3, onBlur) {
    let button2 = document2.createElement("button");
    return button2.type = "button", button2.className = BUTTON_CLASS2, button2.title = LABEL, button2.setAttribute("aria-label", LABEL), button2.append(arrowDownIcon(document2)), button2.addEventListener("click", onClick3), button2.addEventListener("blur", onBlur), button2;
  }
  function overviewScrollerOf(document2) {
    let feed = document2.querySelector(FEED_SELECTOR2);
    return feed === null ? null : scrollerOf(feed);
  }
  var isAtBottom = (scroller) => scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= BOTTOM_MARGIN;
  function shouldShowButton(scroller, button2) {
    let hasFocus = button2 !== null && button2.ownerDocument.activeElement === button2;
    return scroller !== null && (!isAtBottom(scroller) || hasFocus);
  }
  var OWNER_SCROLL_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"];
  function createBottomFollow(now) {
    let followed = null;
    function start(scroller) {
      followed = { height: scroller.scrollHeight, lastActiveAt: now() }, scroller.scrollTo({
        behavior: scrollBehaviorOf(scroller.ownerDocument),
        top: scroller.scrollHeight
      });
    }
    function step(scroller, isScrollEvent) {
      followed !== null && (scroller === null || now() - followed.lastActiveAt > FOLLOW_QUIET_MS ? followed = null : scroller.scrollHeight !== followed.height ? start(scroller) : isScrollEvent && (followed.lastActiveAt = now()));
    }
    return {
      start,
      step,
      stop: () => {
        followed = null;
      }
    };
  }
  function listen(document2, events) {
    document2.addEventListener("scroll", events.onScroll, { capture: !0, passive: !0 }), document2.defaultView?.addEventListener("resize", events.onResize);
    for (let type of OWNER_SCROLL_EVENTS)
      document2.addEventListener(type, events.onOwnerScroll, { capture: !0, passive: !0 });
  }
  function createScrollToBottom(options) {
    let { document: document2 } = options, follow = createBottomFollow(options.now), button2 = null;
    function scrollToBottom2() {
      let scroller = overviewScrollerOf(document2);
      scroller !== null && follow.start(scroller);
    }
    function showOrHideButton(scroller) {
      let isShown = shouldShowButton(scroller, button2);
      button2 === null && !isShown || (button2 ??= createButton2(document2, scrollToBottom2, sync4), button2.isConnected || document2.body.append(button2), button2.hidden === isShown && (button2.hidden = !isShown));
    }
    function sync4(event) {
      let scroller = overviewScrollerOf(document2);
      follow.step(scroller, event?.type === "scroll"), showOrHideButton(scroller);
    }
    return listen(document2, {
      onOwnerScroll: (event) => {
        event.target !== button2 && follow.stop();
      },
      onResize: sync4,
      onScroll: sync4
    }), {
      sync: () => {
        sync4();
      }
    };
  }

  // azure-devops/src/features/scroll-to-bottom/style.css
  var style_default9 = `/* The button that scrolls a pull request's Overview to its bottom: round, in the corner of the window. */
.fix-ado-scroll-to-bottom {
  position: fixed;
  right: 32px;
  bottom: 32px;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--palette-black-alpha-10, rgba(0, 0, 0, 0.1));
  border-radius: 50%;
  background: var(--callout-background-color, rgb(255, 255, 255));
  box-shadow: 0 3px 8px var(--palette-black-alpha-10, rgba(0, 0, 0, 0.1));
  color: var(--text-primary-color, rgba(0, 0, 0, 0.9));
  cursor: pointer;
}

.fix-ado-scroll-to-bottom[hidden] {
  display: none;
}

.fix-ado-scroll-to-bottom:hover {
  border-color: var(--communication-background, rgb(0, 120, 212));
  color: var(--communication-background, rgb(0, 120, 212));
}

.fix-ado-scroll-to-bottom:focus-visible {
  outline: 2px solid var(--communication-background, rgb(0, 120, 212));
  outline-offset: 2px;
}

/* The arrow, drawn like Azure DevOps's line icons. */
.fix-ado-scroll-to-bottom svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
`;

  // azure-devops/src/features/scroll-to-bottom/index.ts
  var scrollToBottom = {
    change: { kind: "new", version: "1.13.0" },
    description: "A button in the corner of a pull request's Overview scrolls to its bottom. It keeps up while more content loads, and hides once you are there.",
    id: "scroll-to-bottom",
    name: "Scroll to bottom",
    start({ document: document2, isInFrame: isInFrame2, now }) {
      if (isInFrame2)
        return null;
      let scrollButton = createScrollToBottom({ document: document2, now });
      return {
        sync() {
          scrollButton.sync();
        }
      };
    },
    styles: [style_default9]
  };

  // azure-devops/src/features/unread-comments/unread-comments.ts
  var FEED_SELECTOR3 = ".activity-feed-list", ROW_SELECTOR3 = ".bolt-timeline-row", THREAD_SELECTOR2 = ".repos-discussion-thread", COMMENT_SELECTOR = ".repos-comment-viewer", NEW_ROW_SELECTOR = ".activity-feed-sequence.new", STICKY_TAB_BAR_SELECTOR = ".bolt-tabbar.sticky", FILTER_SELECTOR3 = ".repos-activity-filter-dropdown", FIRST_UNREAD_CLASS = "fix-ado-first-unread", FIRST_UNREAD_LABEL = "Go to first unread", NEXT_UNREAD_CLASS = "fix-ado-next-unread", NEXT_UNREAD_LABEL = "Go to next unread";
  function rowsAsShown(feed) {
    let rows = [...feed.querySelectorAll(ROW_SELECTOR3)];
    return feed.dataset.fixAdoActivityOrder === "oldest-first" ? rows.toReversed() : rows;
  }
  function unreadGroupsOf(thread) {
    let groups = [], group2 = [];
    for (let comment of thread.querySelectorAll(COMMENT_SELECTOR))
      comment.querySelector(UNREAD_COMMENT_MARKER_SELECTOR) === null ? group2 = [] : (group2.length === 0 && groups.push(group2), group2.push(comment));
    return groups;
  }
  function markOf(index, size) {
    return size === 1 ? "only" : index === 0 ? "first" : index === size - 1 ? "last" : "middle";
  }
  function markUnreadGroups(document2, groups) {
    let marked = /* @__PURE__ */ new Set();
    for (let group2 of groups)
      for (let [index, comment] of group2.entries()) {
        let mark = markOf(index, group2.length);
        comment.dataset.fixAdoUnread !== mark && (comment.dataset.fixAdoUnread = mark), marked.add(comment);
      }
    for (let comment of document2.querySelectorAll("[data-fix-ado-unread]"))
      marked.has(comment) || delete comment.dataset.fixAdoUnread;
  }
  function stopOfGroup(comments) {
    let [first] = comments;
    return first === void 0 ? [] : [{ comments, target: first }];
  }
  function stopsOfRow(row) {
    let thread = row.querySelector(THREAD_SELECTOR2);
    return thread === null ? [] : thread.querySelector(HEADER_SELECTOR) === null ? row.querySelector(NEW_ROW_SELECTOR) === null ? [] : [{ comments: [], target: row }] : unreadGroupsOf(thread).flatMap((comments) => stopOfGroup(comments));
  }
  function readStops(document2) {
    let feed = document2.querySelector(FEED_SELECTOR3);
    return feed === null ? [] : rowsAsShown(feed).flatMap((row) => stopsOfRow(row));
  }
  function createButton3(document2, className, label) {
    let text = Object.assign(document2.createElement("span"), {
      className: "bolt-button-text",
      textContent: label
    }), button2 = document2.createElement("button");
    return button2.type = "button", button2.className = `${className} bolt-button enabled bolt-focus-treatment`, button2.append(text), button2;
  }
  function createFirstUnreadBox(document2, onClick3) {
    let button2 = createButton3(document2, FIRST_UNREAD_CLASS, FIRST_UNREAD_LABEL);
    button2.addEventListener("click", onClick3);
    let box = Object.assign(document2.createElement("div"), {
      className: `${FIRST_UNREAD_CLASS}-box margin-bottom-16 margin-right-8 inline-flex-row`
    });
    return box.append(button2), box;
  }
  function findOrAddFirstUnreadButton(document2, onClick3) {
    let bar = document2.querySelector(FILTER_SELECTOR3)?.parentElement;
    return bar == null ? null : (bar.querySelector(`.${FIRST_UNREAD_CLASS}`) === null && bar.prepend(createFirstUnreadBox(document2, onClick3)), bar.querySelector(`.${FIRST_UNREAD_CLASS}`));
  }
  var lastCommentOf = ({ comments }) => comments.at(-1) ?? null;
  function findOrAddNextUnreadButton(comment, onClick3) {
    let existing = comment.querySelector(`:scope > .${NEXT_UNREAD_CLASS}`), button2 = existing ?? createButton3(comment.ownerDocument, NEXT_UNREAD_CLASS, NEXT_UNREAD_LABEL);
    return existing === null && button2.addEventListener("click", onClick3), comment.lastElementChild !== button2 && comment.append(button2), button2;
  }
  async function scrollIntoViewAndWait(element4, options) {
    let scrolled = element4.scrollIntoView(options);
    scrolled instanceof Promise && await scrolled;
  }
  function leaveRoomForTabBar(document2) {
    let height = `${document2.querySelector(STICKY_TAB_BAR_SELECTOR)?.offsetHeight ?? 0}px`, feed = document2.querySelector(FEED_SELECTOR3);
    feed !== null && feed.style.getPropertyValue("--fix-ado-sticky-height") !== height && feed.style.setProperty("--fix-ado-sticky-height", height);
  }
  function shownPartOf(target) {
    return target.checkVisibility() ? target : target.closest(THREAD_SELECTOR2) ?? target;
  }
  function createStopScroller(document2) {
    let scrollCount = 0;
    return async (stop) => {
      if (stop === void 0)
        return;
      scrollCount += 1;
      let scroll = scrollCount, { target } = stop;
      leaveRoomForTabBar(document2), await scrollIntoViewAndWait(shownPartOf(target), {
        behavior: scrollBehaviorOf(document2),
        block: "start"
      }), scroll === scrollCount && (target.tabIndex = -1, target.focus({ preventScroll: !0 }));
    };
  }
  function removeNextUnreadButtons(document2, kept) {
    for (let button2 of document2.querySelectorAll(`.${NEXT_UNREAD_CLASS}`))
      kept.has(button2) || button2.remove();
  }
  function createUnreadComments({ document: document2 }) {
    let goTo = createStopScroller(document2);
    function goToNextAfter(target) {
      let stops = readStops(document2), index = stops.findIndex((stop) => stop.target === target);
      goTo(index === -1 ? void 0 : stops[index + 1]);
    }
    function syncNextUnreadButtons(stops) {
      let kept = /* @__PURE__ */ new Set();
      for (let stop of stops.slice(0, -1)) {
        let lastComment = lastCommentOf(stop);
        lastComment !== null && kept.add(
          findOrAddNextUnreadButton(lastComment, () => {
            goToNextAfter(stop.target);
          })
        );
      }
      removeNextUnreadButtons(document2, kept);
    }
    function sync4() {
      let stops = readStops(document2);
      markUnreadGroups(
        document2,
        stops.map((stop) => stop.comments)
      ), syncNextUnreadButtons(stops);
      let firstUnread = findOrAddFirstUnreadButton(document2, () => {
        goTo(readStops(document2)[0]);
      });
      firstUnread !== null && firstUnread.disabled !== (stops.length === 0) && (firstUnread.disabled = stops.length === 0);
    }
    return { sync: sync4 };
  }

  // azure-devops/src/features/unread-comments/style.css
  var style_default10 = `/* Unread comments glow like a required reviewer, one glow around each group of unread comments
   that follow each other. The thread clips what spills outside it, so the glow sits inside. Each
   comment of a group draws its piece: across the 4px gap to a neighbour in the group, and cut off
   there, so no edge shows between them. */
[data-fix-ado-unread] {
  --fix-ado-unread-glow: var(--communication-background, rgb(0, 120, 212));
  position: relative;
}

/* A scroll to a stop ends 16px under the tab bar that sticks to the top. The script measures the
   bar. A stop is a group's first comment, or the row of a thread that is not rendered yet. */
.activity-feed-list [data-fix-ado-unread],
.activity-feed-list .bolt-timeline-row {
  scroll-margin-top: calc(var(--fix-ado-sticky-height, 0px) + 16px);
}

[data-fix-ado-unread]::after {
  position: absolute;
  inset: 0;
  border-radius: 5px;
  box-shadow:
    inset 0 0 0 2px var(--fix-ado-unread-glow),
    inset 0 0 6px 3px var(--fix-ado-unread-glow);
  content: "";
  pointer-events: none;
}

/* A comment after another of its group reaches 16px up: 4px across the gap, 12px it cuts off. */
[data-fix-ado-unread="middle"]::after,
[data-fix-ado-unread="last"]::after {
  top: -16px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  clip-path: inset(12px 0 0 0);
}

/* A comment before another of its group reaches 16px down the same way. */
[data-fix-ado-unread="first"]::after,
[data-fix-ado-unread="middle"]::after {
  bottom: -16px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  clip-path: inset(0 0 12px 0);
}

[data-fix-ado-unread="middle"]::after {
  clip-path: inset(12px 0);
}

/* Go to first unread sits left of every other button in the bar above the feed, and glows while
   there is something unread. */
.fix-ado-first-unread-box {
  order: -2;
}

.fix-ado-first-unread:not(:disabled) {
  box-shadow:
    0 0 0 2px var(--communication-background, rgb(0, 120, 212)),
    0 0 6px 3px var(--communication-background, rgb(0, 120, 212));
}

.fix-ado-first-unread:disabled {
  cursor: default;
  opacity: 0.5;
}

/* Go to next unread spans the bottom of a group's last comment, inside the glow. */
.fix-ado-next-unread {
  display: flex;
  justify-content: center;
  width: 100%;
  margin: 8px 0 12px;
}

/* Forced colors drop box shadows, so the glows become outlines there. */
@media (forced-colors: active) {
  [data-fix-ado-unread]::after {
    border-inline: 2px solid Highlight;
    box-shadow: none;
  }

  [data-fix-ado-unread="only"]::after,
  [data-fix-ado-unread="first"]::after {
    border-top: 2px solid Highlight;
  }

  [data-fix-ado-unread="only"]::after,
  [data-fix-ado-unread="last"]::after {
    border-bottom: 2px solid Highlight;
  }

  .fix-ado-first-unread:not(:disabled) {
    outline: 2px solid Highlight;
    outline-offset: 1px;
  }

  .fix-ado-first-unread:disabled {
    border-color: GrayText;
    color: GrayText;
    opacity: 1;
  }
}
`;

  // azure-devops/src/features/unread-comments/index.ts
  var unreadComments = {
    change: { kind: "new", version: "1.17.0" },
    description: "Unread comments on a pull request's Overview glow, one glow around comments that follow each other. Go to first unread, above the feed, and Go to next unread, on each group, scroll to them.",
    id: "unread-comments",
    name: "Unread comments",
    start({ document: document2, isInFrame: isInFrame2 }) {
      if (isInFrame2)
        return null;
      let comments = createUnreadComments({ document: document2 });
      return {
        sync({ page }) {
          page.kind === "pull-request" && comments.sync();
        }
      };
    },
    styles: [style_default10]
  };

  // azure-devops/src/features/overview-features.ts
  var OVERVIEW_FEATURES = [
    overviewPipelineIssues,
    activityOrder,
    scrollToBottom,
    foldedPushes,
    joinedReviewerLines,
    resolvedThreadChips,
    collapsibleThreads,
    unreadComments,
    newActivityChips
  ];

  // azure-devops/src/features/pipeline-tab/pipeline-run-frame.ts
  function createPipelineRunFrame(document2) {
    return parsePipelineRunLocation(document2.location) === null ? null : {
      sync: () => {
        document2.documentElement.dataset.fixAdoRunFrame = "";
      }
    };
  }

  // azure-devops/src/features/pipeline-tab/pipeline-tab-element.ts
  var TAB_CLASS = "fix-ado-pipeline-tab", TAB_LABEL = "Pipeline", TAB_ID = "fix-ado-pipeline-tab", TAB_CLASSES = `bolt-tab focus-treatment flex-noshrink ${TAB_CLASS}`, OWN_TAB_ATTRIBUTE = "data-fix-ado-own-tab";
  function createTab(document2) {
    let text = Object.assign(document2.createElement("span"), {
      className: "bolt-tab-text",
      textContent: TAB_LABEL
    });
    text.dataset.content = TAB_LABEL;
    let container = Object.assign(document2.createElement("span"), {
      className: "bolt-tab-inner-container"
    });
    container.append(text);
    let tab = Object.assign(document2.createElement("a"), {
      className: TAB_CLASSES,
      href: "#",
      id: TAB_ID
    });
    return tab.setAttribute("role", "tab"), tab.dataset.fixAdoOwnTab = "", tab.append(container), tab.setAttribute("aria-selected", "false"), tab;
  }

  // azure-devops/src/core/closest-element.ts
  function isElement(target) {
    return target !== null && "nodeType" in target && target.nodeType === 1;
  }
  function closestElement(target, selector) {
    return isElement(target) ? target.closest(selector) : null;
  }
  function isHtmlElement(element4) {
    return "dataset" in element4;
  }
  function closestHtmlElement(target, selector) {
    let found = closestElement(target, selector);
    return found !== null && isHtmlElement(found) ? found : null;
  }

  // azure-devops/src/features/pipeline-tab/pipeline-tab-tree.ts
  var DATE_FORMAT = { dateStyle: "short", timeStyle: "short" }, NAME_CLASS = "fix-ado-pipeline-item-name";
  function textElement(document2, className, text) {
    let element4 = document2.createElement("span");
    return element4.className = className, element4.textContent = text, element4;
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
  function markItem(context, button2, item) {
    button2.setAttribute("aria-current", String(item.isCurrent)), item.isCurrent && item.level !== null && button2.setAttribute("aria-expanded", String(context.pick.folded !== item.level));
    let { buildId, jobId, stageId, stepId } = item.pick;
    button2.dataset.fixAdoFocusKey = [buildId, stageId, jobId, stepId].join("/");
  }
  function createItem(context, item) {
    let { document: document2 } = context, button2 = document2.createElement("button");
    return button2.type = "button", button2.className = `fix-ado-pipeline-item ${item.className}`, markItem(context, button2, item), button2.append(...createItemParts(document2, item)), button2.addEventListener("click", () => {
      let { level } = item;
      context.onPick(item.isCurrent && level !== null ? foldPick(context, level) : item.pick);
    }), button2;
  }
  function requiredLabel(isRequired) {
    return isRequired ? "Required" : "Optional";
  }
  function runDetails(run) {
    let kind = run.isRequired === null ? `#${run.buildNumber ?? run.buildId}` : requiredLabel(run.isRequired), started = run.startedAt === null ? [] : [new Date(run.startedAt).toLocaleString([], DATE_FORMAT)];
    return [...run.status?.status === "cancelling" ? ["Cancelling"] : [], kind, ...started].join(" · ");
  }
  function group(document2, className, children) {
    let element4 = document2.createElement("div");
    return element4.className = className, element4.append(...children), element4;
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
    let { shown } = context, isCurrent2 = shown.step?.jobId === job.id, item = createItem(context, {
      className: "fix-ado-pipeline-job",
      isCurrent: isCurrent2,
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
    return isCurrent2 && context.pick.folded === "job" ? [item] : [item, createJobSteps(context, job)];
  }
  function createJobs(context) {
    let items = (context.shown.stage?.jobs ?? []).flatMap((job) => createJob(context, job));
    return group(context.document, "fix-ado-pipeline-jobs", items);
  }
  function stageName(stage) {
    return stage.name === DEFAULT_STAGE_NAME ? "Jobs" : stage.name;
  }
  function createStage(context, stage) {
    let { shown } = context, isCurrent2 = stage.id === shown.stage?.id, item = createItem(context, {
      className: "fix-ado-pipeline-stage",
      isCurrent: isCurrent2,
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
    return isCurrent2 && context.pick.folded !== "stage" ? [item, createJobs(context)] : [item];
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
  var SVG_NAMESPACE5 = "http://www.w3.org/2000/svg", OPEN_ICON_PATH = "M9 2h5v5h-1V3.7L7.35 9.35l-.7-.7L12.3 3H9V2zM3 4h4v1H4v8h8V9h1v5H3V4z";
  function createOpenIcon(document2) {
    let icon = document2.createElementNS(SVG_NAMESPACE5, "svg");
    icon.setAttribute("viewBox", "0 0 16 16"), icon.setAttribute("width", "16"), icon.setAttribute("height", "16"), icon.setAttribute("aria-hidden", "true");
    let path = document2.createElementNS(SVG_NAMESPACE5, "path");
    return path.setAttribute("d", OPEN_ICON_PATH), path.setAttribute("fill", "currentColor"), icon.append(path), icon;
  }
  function createOpenRunLink(context, run) {
    let { document: document2 } = context, link = document2.createElement("a");
    return link.className = "fix-ado-pipeline-open-run", link.href = context.runPathOf(run.buildId), link.target = "_blank", link.rel = "noopener", link.setAttribute("aria-label", "Open run in new tab"), link.title = "Open run in new tab", link.append(createOpenIcon(document2)), link;
  }
  function createRunRow(context, item, run) {
    let link = createOpenRunLink(context, run);
    return group(context.document, "fix-ado-pipeline-run-row", [item, link]);
  }
  function createRun(context, run) {
    let isCurrent2 = run.buildId === context.shown.run.buildId, item = createItem(context, {
      className: "fix-ado-pipeline-run",
      details: runDetails(run),
      isCurrent: isCurrent2,
      level: "run",
      name: run.name,
      pick: { buildId: run.buildId, folded: null, jobId: null, stageId: null, stepId: null },
      status: run.status
    }), row = createRunRow(context, item, run);
    return isCurrent2 && context.pick.folded !== "run" ? [row, createStages(context)] : [row];
  }
  function showCutOffNames(tree) {
    tree.addEventListener("mouseover", (event) => {
      let row = closestElement(event.target, ".fix-ado-pipeline-item"), name = row?.querySelector(`.${NAME_CLASS}`);
      row === null || name === null || name === void 0 || (name.scrollWidth > name.clientWidth ? row.setAttribute("title", name.textContent) : row.removeAttribute("title"));
    });
  }
  function createRunTree(context) {
    let items = context.runs.flatMap((run) => createRun(context, run)), tree = group(context.document, "fix-ado-pipeline-tree", items);
    return tree.setAttribute("role", "group"), tree.setAttribute("aria-label", "Pipeline runs"), showCutOffNames(tree), tree;
  }

  // azure-devops/src/features/pipeline-tab/pipeline-tab-run-action.ts
  var LABELS3 = {
    cancel: {
      failed: "Could not cancel the run.",
      idle: "Cancel current run",
      waiting: "Cancelling…"
    },
    start: { failed: "Could not start the run.", idle: "Start new run", waiting: "Starting…" }
  }, LOOKS = { cancel: "danger", start: "primary" };
  function textElement2(document2, className, text) {
    let element4 = document2.createElement("span");
    return element4.className = className, element4.textContent = text, element4;
  }
  function createChoice(context, choice) {
    let { document: document2 } = context, row = document2.createElement("button");
    row.type = "button", row.className = "fix-ado-pipeline-item fix-ado-pipeline-run-action-choice", row.dataset.fixAdoFocusKey = `run-action/${choice.key}`;
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
  function createButton4(context) {
    let { action, choices, document: document2, state } = context, isWaiting = state === "waiting", button2 = Object.assign(document2.createElement("button"), {
      className: `bolt-button ${LOOKS[action]} bolt-focus-treatment ${isWaiting ? "disabled" : "enabled"} fix-ado-pipeline-run-action`,
      disabled: isWaiting,
      type: "button"
    });
    button2.dataset.fixAdoFocusKey = "run-action";
    let label = LABELS3[action][isWaiting ? "waiting" : "idle"];
    return button2.append(textElement2(document2, "bolt-button-text body-m", label)), choices.length > 1 && button2.setAttribute("aria-expanded", String(state === "choosing")), button2.addEventListener("click", () => {
      onButtonClick(context);
    }), button2;
  }
  function failedNote(document2, action) {
    let note = textElement2(document2, "fix-ado-pipeline-note", LABELS3[action].failed);
    return note.setAttribute("role", "alert"), note;
  }
  function createRunAction(context) {
    let { action, choices, document: document2, state } = context;
    if (choices.length === 0)
      return null;
    let button2 = createButton4(context);
    return state === "choosing" ? [button2, createChoices(context)] : state === "failed" ? [button2, failedNote(document2, action)] : [button2];
  }

  // azure-devops/src/features/pipeline-tab/pipeline-log-frame.ts
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
  function waitForSwitch(frame, log2, schedule2) {
    let checksLeft = 15, check2 = () => {
      frame.dataset.fixAdoLogPath !== log2.path || showsStep(frame, log2.stepName) || (checksLeft -= 1, checksLeft > 0 ? schedule2(check2, 100) : load(frame, log2));
    };
    schedule2(check2, 100);
  }
  function stepInFrame(frame, log2) {
    let isSameRun = frame.dataset.fixAdoBuildId === String(log2.buildId), document2 = frame.contentDocument;
    return isSameRun && document2 !== null ? stepInTree(document2, log2) : null;
  }
  function showStepLog(frame, log2, schedule2 = setTimeout) {
    if (frame.dataset.fixAdoLogPath === log2.path)
      return;
    let step = stepInFrame(frame, log2);
    if (frame.dataset.fixAdoLogPath = log2.path, frame.dataset.fixAdoBuildId = String(log2.buildId), step === null) {
      load(frame, log2);
      return;
    }
    step.click(), waitForSwitch(frame, log2, schedule2);
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

  // azure-devops/src/features/pipeline-tab/pipeline-tab-panel.ts
  var PANEL_CLASS = "fix-ado-pipeline-panel", TREE_SELECTOR = ":scope > .fix-ado-pipeline-tree", FRAME_SELECTOR = ":scope > .fix-ado-pipeline-frame", LOG_NOTE_SELECTOR = ":scope > .fix-ado-pipeline-log-note", ISSUES_SELECTOR = ":scope > .fix-ado-issue-box", ISSUES_COLLAPSED_ATTRIBUTE = "data-fix-ado-issues-collapsed";
  function message(panel, text, isError = !1) {
    let note = panel.ownerDocument.createElement("p");
    note.className = "fix-ado-pipeline-message", note.textContent = text, isError && note.setAttribute("role", "alert"), panel.replaceChildren(note);
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
      collapse: {
        isCollapsed: panel.hasAttribute(ISSUES_COLLAPSED_ATTRIBUTE),
        onToggle: (isCollapsed) => {
          panel.toggleAttribute(ISSUES_COLLAPSED_ATTRIBUTE, isCollapsed);
        }
      },
      createLink: (issue) => createIssueLink(context, issue, content),
      details: null,
      issues,
      title: issueSummary(stages)
    });
    tree.after(box);
  }
  function focusedKey(oldTree) {
    let focused = oldTree?.ownerDocument.activeElement ?? null;
    return focused !== null && oldTree?.contains(focused) === !0 ? focused.closest("[data-fix-ado-focus-key]")?.dataset.fixAdoFocusKey ?? null : null;
  }
  function placeTree(panel, tree) {
    panel.querySelector(":scope > .fix-ado-pipeline-message")?.remove();
    let oldTree = panel.querySelector(TREE_SELECTOR), key = focusedKey(oldTree);
    oldTree === null ? panel.prepend(tree) : oldTree.replaceWith(tree), key !== null && (tree.querySelector(`[data-fix-ado-focus-key="${key}"]`) ?? tree.querySelector('[aria-current="true"]'))?.focus();
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
      runPathOf: content.runPathOf,
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
    panel.dataset.fixAdoRendered !== key && (panel.dataset.fixAdoRendered = key, content.runs.kind === "loading" ? message(panel, "Loading pipeline runs…") : content.runs.kind === "failed" ? message(panel, "Could not load the pipeline runs.", !0) : showRun(panel, content.runs, content));
  }
  function createPanel(document2) {
    let panel = document2.createElement("div");
    return panel.className = PANEL_CLASS, panel.setAttribute("role", "tabpanel"), panel.setAttribute("aria-labelledby", TAB_ID), panel;
  }

  // azure-devops/src/pipeline/pipeline-runs.ts
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

  // azure-devops/src/features/pipeline-tab/pipeline-tab-selection.ts
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

  // azure-devops/src/features/pipeline-tab/pipeline-tab-data.ts
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

  // azure-devops/src/features/pipeline-tab/pipeline-tab.ts
  var OPEN_ATTRIBUTE = "data-fix-ado-pipeline-tab-open", PAGE_SELECTOR = ".repos-pr-details-page", TABBAR_SELECTOR = ".repos-pr-details-page-tabbar", CHECKS_PANEL_SELECTOR = ".bolt-panel", RUN_LINK = 'a[href*="/_build/results?"]', RUN_LINK_SELECTOR2 = `${PAGE_SELECTOR} ${RUN_LINK}, ${CHECKS_PANEL_SELECTOR} ${RUN_LINK}`;
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
      runPathOf: (buildId) => pipelineRunPath(apiBasePath2, project, buildId),
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
      other !== tab && (other.hasAttribute(OWN_TAB_ATTRIBUTE) || (state.replacedTab = other), setSelected(other, !1));
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
    let link = closestElement(event.target, RUN_LINK_SELECTOR2), isPlainClick = event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey, button2 = closestElement(event.target, "button, [role=button]"), isOnButtonInLink = button2 !== null && link?.contains(button2) === !0;
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

  // azure-devops/src/pipeline/pipeline-status-icon.css
  var pipeline_status_icon_default = `.fix-ado-pipeline-status {
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

/* A grey circle that holds the icon's place while the status loads, or when there is none. */
.fix-ado-pipeline-status[data-status="loading"],
.fix-ado-pipeline-status[data-status="none"] {
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
  opacity: 0.25;
}

@keyframes fix-ado-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Slower, not stopped, so a running pipeline still looks busy. */
@media (prefers-reduced-motion: reduce) {
  .fix-ado-pipeline-status[data-status="running"] {
    animation-duration: 6s;
  }
}

/* Forced colors turn the disc into the text colour, which can be white; the marks take the
   background colour, so succeeded, failed and expired stay apart. */
@media (forced-colors: active) {
  .fix-ado-pipeline-status path[stroke="#fff"] {
    stroke: Canvas;
  }
}
`;

  // azure-devops/src/features/pipeline-tab/style.css
  var style_default11 = `/* The Pipeline tab on a pull request. pipeline-tab.ts sets the attribute while it is open. */
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

/* Forced colors drop box shadows and backgrounds, so the bar becomes a border there. */
@media (forced-colors: active) {
  .fix-ado-pipeline-item[aria-current="true"] {
    border-inline-start: 3px solid Highlight;
  }
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

/* A run's row holds its item and, at the right end, the link to its page. */
.fix-ado-pipeline-run-row {
  position: relative;
}

.fix-ado-pipeline-run-row > .fix-ado-pipeline-run {
  padding-inline-end: 48px;
}

/* Open run in new tab: a subtle icon button beside the run's name, its icon's right edge
   in line with the count badges of the rows below. */
.fix-ado-pipeline-open-run {
  position: absolute;
  top: 4px;
  inset-inline-end: 8px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
}

.fix-ado-pipeline-open-run:hover {
  background: var(--palette-black-alpha-6, rgba(0, 0, 0, 0.06));
  color: var(--text-primary-color, rgba(0, 0, 0, 0.9));
}

.fix-ado-pipeline-open-run:focus-visible {
  outline: 2px solid var(--communication-background, rgb(0, 120, 212));
  outline-offset: -2px;
}

/* A line above each run but the first, so the runs stand apart. The run keeps the same
   padding above and below, as the rows under it. */
.fix-ado-pipeline-run-row:not(:first-child) {
  margin-top: 8px;
  border-top: 1px solid var(--palette-black-alpha-10, rgba(0, 0, 0, 0.1));

  & > .fix-ado-pipeline-run {
    border-radius: 0;
  }
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
`;

  // azure-devops/src/features/pipeline-tab/index.ts
  var pipelineTab = {
    change: { kind: "new", version: "1.7.2" },
    description: "A Pipeline tab on each pull request with its runs, stages, steps, warnings, errors and logs, and a button to start or cancel a run.",
    id: "pipeline-tab",
    name: "Pipeline tab",
    start({ basePath: basePath2, client, document: document2, isInFrame: isInFrame2, now }) {
      if (isInFrame2) {
        let runFrame = createPipelineRunFrame(document2);
        return runFrame ? {
          sync() {
            runFrame.sync();
          }
        } : null;
      }
      let tab = createPipelineTab({
        apiBasePath: basePath2,
        cancelRun: async (project, buildId) => {
          await client.cancelBuild(project, buildId);
        },
        document: document2,
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
        now,
        requeueCheck: async ({ project }, evaluationId) => {
          await client.requeuePolicyEvaluation(project, evaluationId);
        }
      });
      return {
        sync({ page }) {
          tab.sync(pullRequestOf(page));
        }
      };
    },
    styles: [pipeline_issue_list_default, pipeline_status_icon_default, style_default11]
  };

  // azure-devops/src/features/review/review-store.ts
  var KEY_PREFIX2 = "review:";
  function reviewKey(hostAndBasePath, { project, pullRequestId, repository }) {
    return `${KEY_PREFIX2}${hostAndBasePath}/${project}/${repository}/${pullRequestId}`;
  }
  function isLineAnchor(value) {
    return typeof value == "object" && value !== null && "filePath" in value && typeof value.filePath == "string" && "side" in value && (value.side === "left" || value.side === "right") && "line" in value && typeof value.line == "number" && "lineLength" in value && typeof value.lineLength == "number" && "iteration" in value && (value.iteration === null || typeof value.iteration == "number");
  }
  function isPendingComment(value) {
    return typeof value == "object" && value !== null && "id" in value && typeof value.id == "string" && "content" in value && typeof value.content == "string" && "anchor" in value && (value.anchor === null || isLineAnchor(value.anchor)) && "isAttempted" in value && typeof value.isAttempted == "boolean" && "postedThreadId" in value && (value.postedThreadId === null || typeof value.postedThreadId == "number");
  }
  function isReview(value) {
    return typeof value == "object" && value !== null && "updatedAt" in value && typeof value.updatedAt == "number" && "comments" in value && Array.isArray(value.comments) && value.comments.every((comment) => isPendingComment(comment));
  }
  var isPending = ({ postedThreadId }) => postedThreadId === null;
  function deleteReviewsBefore(storage, time) {
    for (let key of storage.keys().filter((name) => name.startsWith(KEY_PREFIX2))) {
      let stored = storage.load(key);
      isReview(stored) && stored.updatedAt < time && storage.remove(key);
    }
  }
  function createReviewStore({ storage, now, createId }) {
    function comments(key) {
      let stored = storage.load(key);
      return isReview(stored) ? stored.comments : [];
    }
    function save(key, changed) {
      changed.some((comment) => isPending(comment)) ? storage.save(key, { comments: changed, updatedAt: now() }) : storage.remove(key);
    }
    return {
      add(key, { anchor, content }, position = "last") {
        let comment = { anchor, content, id: createId(), isAttempted: !1, postedThreadId: null }, others = comments(key);
        return save(key, position === "first" ? [comment, ...others] : [...others, comment]), comment;
      },
      change(key, id, changes) {
        let changed = comments(key), comment = changed.find((candidate) => candidate.id === id);
        comment !== void 0 && (Object.assign(comment, changes), save(key, changed));
      },
      comments,
      deleteOlderThan: (maxAgeMs) => {
        deleteReviewsBefore(storage, now() - maxAgeMs);
      },
      discard: (key) => {
        storage.remove(key);
      },
      pending: (key) => comments(key).filter((comment) => isPending(comment)),
      remove(key, id) {
        save(
          key,
          comments(key).filter((comment) => comment.id !== id)
        );
      }
    };
  }

  // azure-devops/src/features/review/editor-comment-boxes.ts
  var ZONE_SELECTOR = ".zone-widget", EDITOR_SELECTOR = ".monaco-editor", OLD_FILE_EDITOR_CLASS = "original-in-monaco-diff-editor", GUTTER_SELECTOR = ".margin", GUTTER_ROW_SELECTOR = ".margin-view-overlays > div", LINE_NUMBER_SELECTOR = ".line-numbers", LINE_SELECTOR2 = ".lines-content > .view-lines > .view-line", SHOWN_PATH_SELECTOR = ".repos-compare-toolbar .secondary-text.text-ellipsis";
  function pixels(element4, property2) {
    let length = element4?.style[property2] ?? "";
    return length.endsWith("px") ? Number(length.slice(0, -2)) : Number.NaN;
  }
  function shownFilePath(document2) {
    let shown = document2.querySelector(SHOWN_PATH_SELECTOR)?.textContent.trim() ?? "", path = shown === "" ? new URLSearchParams(document2.location.search).get("path") : shown;
    return path === null || path === "" ? null : path;
  }
  function gutterRowAbove(editor, zone) {
    let gutterTop = pixels(editor.querySelector(GUTTER_SELECTOR), "top"), zoneTop = pixels(zone, "top");
    return [...editor.querySelectorAll(GUTTER_ROW_SELECTOR)].find(
      (row) => Math.abs(gutterTop + pixels(row, "top") + pixels(row, "height") - zoneTop) < 1
    ) ?? null;
  }
  function lineLengthAt(editor, top) {
    return [...editor.querySelectorAll(LINE_SELECTOR2)].find(
      (candidate) => pixels(candidate, "top") === top
    )?.textContent.length ?? 0;
  }
  var anchorByZone = /* @__PURE__ */ new WeakMap();
  function drawnAnchorOf(zone, filePath) {
    let editor = zone.closest(EDITOR_SELECTOR), row = editor === null ? null : gutterRowAbove(editor, zone), line2 = Number(row?.querySelector(LINE_NUMBER_SELECTOR)?.textContent);
    return editor === null || row === null || !(line2 > 0) ? null : {
      filePath,
      line: line2,
      lineLength: lineLengthAt(editor, pixels(row, "top")),
      side: editor.classList.contains(OLD_FILE_EDITOR_CLASS) ? "left" : "right"
    };
  }
  function editorAnchorOf(box) {
    let zone = box.closest(ZONE_SELECTOR), filePath = shownFilePath(box.ownerDocument);
    if (zone === null || filePath === null)
      return null;
    let drawn = drawnAnchorOf(zone, filePath);
    if (drawn !== null)
      return anchorByZone.set(zone, drawn), drawn;
    let last = anchorByZone.get(zone);
    return last?.filePath === filePath ? last : null;
  }

  // azure-devops/src/features/review/comment-boxes.ts
  var BOX_SELECTOR = ".repos-discussion-thread-reply", NEW_THREAD_CLASS = /(?:^|\s)threadId--\d+(?:\s|$)/u, DIFF_ROW_SELECTOR = ".repos-diff-contents-row", LINE_CELL_SELECTOR = ".repos-line-content", FILE_CARD_SELECTOR = ".repos-summary-header", FILE_PATH_SELECTOR = ":scope > div:first-child .secondary-text.text-ellipsis", OVERVIEW_BOX_SELECTOR = ".repos-comment-card", NOT_LINE_TEXT_SELECTOR = '.screen-reader-only, [aria-hidden="true"]';
  function lineTextOf(cell2) {
    let copy = cell2.cloneNode(!0);
    for (let extra of copy.querySelectorAll(NOT_LINE_TEXT_SELECTOR))
      extra.remove();
    return copy.textContent;
  }
  function lineCellOf(row) {
    return row?.querySelector(`:scope > ${LINE_CELL_SELECTOR}`) ?? null;
  }
  function sideAndLineOf(cell2) {
    let newLine = Number(cell2.dataset.mline), oldLine = Number(cell2.dataset.oline);
    return Number.isInteger(newLine) && newLine > 0 ? { line: newLine, side: "right" } : Number.isInteger(oldLine) && oldLine > 0 ? { line: oldLine, side: "left" } : null;
  }
  function filePathOf(element4) {
    let path = element4.closest(FILE_CARD_SELECTOR)?.querySelector(FILE_PATH_SELECTOR)?.textContent.trim();
    return path === void 0 || path === "" ? null : path;
  }
  function lineRowAbove(boxRow) {
    let row = boxRow.previousElementSibling;
    for (; row !== null && lineCellOf(row) === null; )
      row = row.previousElementSibling;
    return row;
  }
  function lineAnchorOf(boxRow) {
    let cell2 = lineCellOf(lineRowAbove(boxRow)), filePath = filePathOf(boxRow), sideAndLine = cell2 === null ? null : sideAndLineOf(cell2);
    return cell2 === null || filePath === null || sideAndLine === null ? null : { filePath, kind: "line", lineLength: lineTextOf(cell2).length, ...sideAndLine };
  }
  function editorBoxAnchorOf(box) {
    let anchor = editorAnchorOf(box);
    return anchor === null ? null : { kind: "line", ...anchor };
  }
  function anchorOf(box) {
    let boxRow = box.closest(DIFF_ROW_SELECTOR);
    return boxRow !== null ? lineAnchorOf(boxRow) : box.closest(ZONE_SELECTOR) !== null ? editorBoxAnchorOf(box) : box.closest(OVERVIEW_BOX_SELECTOR) === null ? null : { kind: "general" };
  }
  function commentBoxOf(box) {
    let textarea = [...box.querySelectorAll("textarea")].find(
      (candidate) => candidate.getAttribute("aria-hidden") !== "true" && NEW_THREAD_CLASS.test(candidate.className)
    ), postButton = box.querySelector("button.bolt-button.primary"), anchor = anchorOf(box);
    if (textarea === void 0 || postButton === null || anchor === null)
      return null;
    let cancelButton = postButton.parentElement?.querySelector(
      ":scope > button.bolt-button:not(.primary)"
    ) ?? null;
    return { anchor, cancelButton, postButton, textarea };
  }
  function findCommentBoxes(document2) {
    return [...document2.querySelectorAll(BOX_SELECTOR)].flatMap((box) => commentBoxOf(box) ?? []);
  }
  function findLineRow(document2, { filePath, line: line2, side }) {
    for (let card of document2.querySelectorAll(FILE_CARD_SELECTOR))
      if (filePathOf(card) === filePath) {
        let attribute = side === "right" ? "data-mline" : "data-oline";
        return [
          ...card.querySelectorAll(`${LINE_CELL_SELECTOR}[${attribute}="${line2}"]`)
        ].find((candidate) => sideAndLineOf(candidate)?.side === side)?.closest(DIFF_ROW_SELECTOR) ?? null;
      }
    return null;
  }

  // azure-devops/src/features/review/review-markup.ts
  function element(document2, tag, { className, text } = {}) {
    let created = document2.createElement(tag);
    return className !== void 0 && (created.className = className), text !== void 0 && (created.textContent = text), created;
  }
  var ACTION_ATTRIBUTE = "data-fix-ado-review-action", BUTTON_CLASS3 = "bolt-button enabled bolt-focus-treatment", PRIMARY_BUTTON_CLASS = "bolt-button enabled primary bolt-focus-treatment";
  function actionButton(document2, { action, isPrimary = !1, text }) {
    let button2 = element(document2, "button", {
      className: isPrimary ? PRIMARY_BUTTON_CLASS : BUTTON_CLASS3,
      text
    });
    return button2.type = "button", button2.setAttribute(ACTION_ATTRIBUTE, action), button2;
  }
  function clickedAction(target) {
    let button2 = closestElement(target, `[${ACTION_ATTRIBUTE}]`), action = button2?.getAttribute(ACTION_ATTRIBUTE) ?? null;
    return button2 === null || action === null ? null : { action, button: button2 };
  }
  function pendingCountText(count) {
    return `${count} pending comment${count === 1 ? "" : "s"}`;
  }
  function asMarkdown(pending) {
    return pending.map(
      ({ anchor, content }) => anchor === null ? content : `**${anchor.filePath}, line ${anchor.line}**

${content}`
    ).join(`

---

`);
  }

  // azure-devops/src/features/review/comment-box-buttons.ts
  var ADD_BUTTON_CLASS = "fix-ado-review-add", ADD_ACTION = "add", START_LABEL = "Start a review", ADD_LABEL = "Add review comment", TITLE = "Add to your review. Nothing is posted until you submit.", POST_LABEL = "Add single comment";
  function addButtonOf(box) {
    return box.postButton.parentElement?.querySelector(`.${ADD_BUTTON_CLASS}`) ?? null;
  }
  function createAddButton(document2) {
    let button2 = actionButton(document2, { action: ADD_ACTION, isPrimary: !0, text: "" });
    return button2.classList.add(ADD_BUTTON_CLASS), button2.title = TITLE, button2;
  }
  function setIfChanged(button2, label, isDisabled) {
    button2.textContent !== label && (button2.textContent = label), button2.disabled !== isDisabled && (button2.disabled = isDisabled, button2.classList.toggle("disabled", isDisabled), button2.classList.toggle("enabled", !isDisabled));
  }
  function syncAddButtons(document2, hasReview) {
    for (let box of findCommentBoxes(document2)) {
      let button2 = addButtonOf(box);
      button2 === null && (button2 = createAddButton(box.textarea.ownerDocument), box.postButton.after(button2)), box.postButton.getAttribute("aria-label") !== POST_LABEL && box.postButton.setAttribute("aria-label", POST_LABEL), setIfChanged(button2, hasReview ? ADD_LABEL : START_LABEL, box.textarea.value.trim() === "");
    }
  }
  function commentBoxAround(target) {
    let box = closestElement(target, BOX_SELECTOR);
    return box === null ? null : commentBoxOf(box);
  }
  function hasAddButton(box) {
    return addButtonOf(box) !== null;
  }
  function closeBox({ cancelButton, textarea }) {
    let view = textarea.ownerDocument.defaultView;
    view !== null && (Reflect.set(view.HTMLTextAreaElement.prototype, "value", "", textarea), textarea.dispatchEvent(new view.Event("input", { bubbles: !0 }))), cancelButton?.click();
  }

  // azure-devops/src/features/review/pending-card.ts
  var ID_ATTRIBUTE = "data-fix-ado-review-id", EDITING_ATTRIBUTE = "data-fix-ado-review-editing", ONLY_YOU_NOTE = "Only you see this until you submit your review.";
  function cardHeader(document2, note) {
    let header = element(document2, "div", { className: "fix-ado-review-card-header" });
    return header.append(
      element(document2, "span", { className: "fix-ado-review-pending", text: "Pending" }),
      element(document2, "span", { className: "fix-ado-review-card-note secondary-text", text: note }),
      actionButton(document2, { action: "edit", text: "Edit" }),
      actionButton(document2, { action: "remove", text: "Delete comment" })
    ), header;
  }
  function cardEditor(document2, draft) {
    let editor = element(document2, "div", { className: "fix-ado-review-card-editor" }), textarea = element(document2, "textarea", { className: "fix-ado-review-textarea" });
    textarea.value = draft, textarea.setAttribute("aria-label", "Edit pending comment");
    let buttons = element(document2, "div", { className: "fix-ado-review-buttons" });
    return buttons.append(
      actionButton(document2, { action: "cancel-edit", text: "Cancel" }),
      actionButton(document2, { action: "update", isPrimary: !0, text: "Update comment" })
    ), editor.append(textarea, buttons), editor;
  }
  function createCard2(document2, { content, draft }, note) {
    let card = element(document2, "div", { className: "fix-ado-review-card" }), body = draft === null ? element(document2, "div", { className: "fix-ado-review-card-text", text: content }) : cardEditor(document2, draft);
    return card.append(cardHeader(document2, note), body), card;
  }
  function markHolder(holder, { content, draft, id }) {
    holder.setAttribute(ID_ATTRIBUTE, id), holder.dataset.fixAdoReviewContent = content, holder.toggleAttribute(EDITING_ATTRIBUTE, draft !== null);
  }
  function holdsCurrent(holder, { content, draft }) {
    return holder.dataset.fixAdoReviewContent === content && holder.hasAttribute(EDITING_ATTRIBUTE) === (draft !== null);
  }
  function cardAround(target) {
    let holder = target.closest(`[${ID_ATTRIBUTE}]`), id = holder?.getAttribute(ID_ATTRIBUTE) ?? null;
    return holder === null || id === null ? null : { holder, id };
  }

  // azure-devops/src/features/review/card-actions.ts
  function saveDrafts({ drafts, key, store }) {
    for (let [id, draft] of drafts)
      draft.trim() !== "" && store.change(key, id, { content: draft.trim() });
    drafts.clear();
  }
  var CARD_ACTIONS = {
    "cancel-edit": ({ drafts }, { id }) => {
      drafts.delete(id);
    },
    edit: ({ drafts }, { content, id }) => {
      drafts.set(id, drafts.get(id) ?? content);
    },
    remove: ({ drafts, key, store }, { id }) => {
      store.remove(key, id), drafts.delete(id);
    },
    update: ({ drafts, key, store }, { id }) => {
      let draft = drafts.get(id)?.trim() ?? "";
      draft !== "" && (store.change(key, id, { content: draft }), drafts.delete(id));
    }
  };
  function handleCardAction(context, { action, button: button2 }) {
    let id = cardAround(button2)?.id ?? null, comment = context.store.pending(context.key).find((candidate) => candidate.id === id), act = CARD_ACTIONS[action];
    return comment === void 0 || act === void 0 ? null : (act(context, comment), action === "edit" ? comment.id : null);
  }
  function noteDraft(drafts, target) {
    let textarea = closestElement(target, "textarea"), card = textarea === null ? null : cardAround(textarea);
    return card !== null && drafts.has(card.id) && textarea !== null && "value" in textarea && drafts.set(card.id, String(textarea.value)), card !== null;
  }
  function focusEditor(document2, id) {
    document2.querySelector(`[${ID_ATTRIBUTE}="${id}"] textarea`)?.focus();
  }
  function cardIdsOnPage(document2) {
    return [...document2.querySelectorAll(`[${ID_ATTRIBUTE}]`)].map(
      (holder) => holder.getAttribute(ID_ATTRIBUTE) ?? ""
    );
  }
  function refocusCard(document2, id, idsBefore) {
    let at = Math.max(idsBefore.indexOf(id), 0);
    ([id, ...idsBefore.slice(at + 1), ...idsBefore.slice(0, at).toReversed()].map(
      (candidate) => document2.querySelector(
        `[${ID_ATTRIBUTE}="${candidate}"] [data-fix-ado-review-action="edit"]`
      )
    ).find((button2) => button2 !== null) ?? document2.querySelector('[data-fix-ado-review-action="finish"]'))?.focus();
  }
  function keepCardFocus(document2, button2) {
    let cardId = cardAround(button2)?.id ?? null, idsBefore = cardIdsOnPage(document2);
    return (editedId) => {
      editedId !== null ? focusEditor(document2, editedId) : cardId !== null && !button2.isConnected && refocusCard(document2, cardId, idsBefore);
    };
  }

  // azure-devops/src/features/review/pending-cards.ts
  var CARD_ROW_CLASS = "fix-ado-review-card-row", THREAD_SELECTOR3 = ".repos-diff-discussion", LINE_CELL_CLASS = "repos-line-content";
  function cardCell(document2, comment) {
    let cell2 = element(document2, "div", { className: "fix-ado-review-card-cell body-m" });
    return cell2.append(createCard2(document2, comment, ONLY_YOU_NOTE)), cell2;
  }
  function cellsBeforeCode(lineRow) {
    return [...lineRow.children].findIndex((cell2) => cell2.classList.contains(LINE_CELL_CLASS));
  }
  function createCardRow(lineRow, comment) {
    let document2 = lineRow.ownerDocument, row = element(document2, "div", { className: `repos-diff-contents-row ${CARD_ROW_CLASS}` });
    markHolder(row, comment);
    for (let cell2 = 0; cell2 < cellsBeforeCode(lineRow); cell2 += 1)
      row.append(element(document2, "span"));
    return row.append(cardCell(document2, comment)), row;
  }
  function isThreadRow(row) {
    return row?.querySelector(`:scope > ${THREAD_SELECTOR3}`) !== null && row !== null;
  }
  function isCardRow(row) {
    return row?.classList.contains(CARD_ROW_CLASS) === !0;
  }
  function isInPlace(cardRow, lineRow) {
    let above = cardRow.previousElementSibling;
    for (; isCardRow(above) || isThreadRow(above); )
      above = above?.previousElementSibling ?? null;
    let below = cardRow.nextElementSibling;
    for (; isCardRow(below); )
      below = below?.nextElementSibling ?? null;
    return above === lineRow && !isThreadRow(below);
  }
  function lastRowUnder(lineRow) {
    let last = lineRow;
    for (; isCardRow(last.nextElementSibling) || isThreadRow(last.nextElementSibling); )
      last = last.nextElementSibling ?? last;
    return last;
  }
  function syncPendingCards(document2, pending) {
    let stale = new Set(document2.querySelectorAll(`.${CARD_ROW_CLASS}`));
    for (let comment of pending) {
      let lineRow = comment.anchor === null ? null : findLineRow(document2, comment.anchor), cardRow = [...stale].find((row) => row.getAttribute(ID_ATTRIBUTE) === comment.id), isUpToDate2 = lineRow !== null && cardRow !== void 0 && isInPlace(cardRow, lineRow) && holdsCurrent(cardRow, comment);
      cardRow !== void 0 && isUpToDate2 ? stale.delete(cardRow) : lineRow !== null && lastRowUnder(lineRow).after(createCardRow(lineRow, comment));
    }
    for (let cardRow of stale)
      cardRow.remove();
  }

  // azure-devops/src/features/review/card-spacers.ts
  var SPACER_ROW_CLASS = "fix-ado-review-spacer-row", SPLIT_SELECTOR = ".repos-summary-diff-splitter", PANE_SELECTOR = ".repos-summary-diff-blocks", HEIGHT_PROPERTY = "--fix-ado-review-spacer-height", PIXEL_TOLERANCE = 0.5;
  function otherPaneOf(cardRow) {
    let ownPane = cardRow.closest(PANE_SELECTOR);
    return [...cardRow.closest(SPLIT_SELECTOR)?.querySelectorAll(PANE_SELECTOR) ?? []].find((pane) => pane !== ownPane) ?? null;
  }
  function rowBeside(cardRow, otherPane) {
    let { top } = cardRow.getBoundingClientRect(), beside = null;
    for (let row of otherPane.children)
      (beside === null || row.getBoundingClientRect().top < top - PIXEL_TOLERANCE) && (beside = row);
    return beside;
  }
  function insertSpacer(cardRow, id) {
    let otherPane = otherPaneOf(cardRow), beside = otherPane === null ? null : rowBeside(cardRow, otherPane);
    if (beside === null)
      return null;
    let document2 = cardRow.ownerDocument, spacer = element(document2, "div", {
      className: `repos-diff-contents-row ${SPACER_ROW_CLASS}`
    });
    return spacer.setAttribute(ID_ATTRIBUTE, id), spacer.append(element(document2, "div")), beside.after(spacer), spacer;
  }
  function matchHeight(spacer, cardRow) {
    let { height } = cardRow.getBoundingClientRect(), shown = Number(spacer.dataset.fixAdoReviewHeight ?? 0);
    Math.abs(shown - height) > PIXEL_TOLERANCE && (spacer.dataset.fixAdoReviewHeight = String(height), spacer.style.setProperty(HEIGHT_PROPERTY, `${height}px`));
  }
  function syncCardSpacers(document2) {
    let stale = new Set(document2.querySelectorAll(`.${SPACER_ROW_CLASS}`));
    for (let cardRow of document2.querySelectorAll(`${SPLIT_SELECTOR} .${CARD_ROW_CLASS}`)) {
      let id = cardRow.getAttribute(ID_ATTRIBUTE) ?? "", spacer = [...stale].find((row) => row.getAttribute(ID_ATTRIBUTE) === id) ?? insertSpacer(cardRow, id);
      spacer !== null && (stale.delete(spacer), matchHeight(spacer, cardRow));
    }
    for (let spacer of stale)
      spacer.remove();
  }

  // azure-devops/src/features/review/code-editor.ts
  var EDITOR_ELEMENT_SELECTOR = ".vss-base-editor", FRAMEWORK_KEY_PREFIX = "__reactFiber", HOLDER_KEYS = ["stateNode", "memoizedProps"], EDITOR_FUNCTIONS = [
    "changeViewZones",
    "addOverlayWidget",
    "removeOverlayWidget",
    "getModel",
    "getLayoutInfo"
  ];
  function property(target, key) {
    return (typeof target == "object" || typeof target == "function") && target !== null ? Reflect.get(target, key) : void 0;
  }
  function ownKeys(target) {
    return typeof target == "object" && target !== null ? Object.keys(target) : [];
  }
  function asCodeEditor(candidate) {
    return EDITOR_FUNCTIONS.every(
      (name) => typeof property(candidate, name) == "function"
    ) ? candidate : null;
  }
  function halfOf(diffEditor, getter) {
    let get = property(diffEditor, getter);
    return typeof get == "function" ? asCodeEditor(Reflect.apply(get, diffEditor, [])) : null;
  }
  function asShownEditors(candidate) {
    let right = halfOf(candidate, "getModifiedEditor") ?? asCodeEditor(candidate);
    return right === null ? null : { left: halfOf(candidate, "getOriginalEditor"), right };
  }
  function editorsHeldBy(node) {
    for (let holderKey of HOLDER_KEYS) {
      let holder = property(node, holderKey);
      for (let key of ownKeys(holder)) {
        let editors = asShownEditors(property(holder, key));
        if (editors !== null)
          return editors;
      }
    }
    return null;
  }
  function findShownEditors(document2) {
    let element4 = document2.querySelector(EDITOR_ELEMENT_SELECTOR), nodeKey = ownKeys(element4).find((key) => key.startsWith(FRAMEWORK_KEY_PREFIX)), node = nodeKey === void 0 ? void 0 : property(element4, nodeKey);
    for (let level = 0; level < 30 && node !== void 0 && node !== null; level += 1) {
      let editors = editorsHeldBy(node);
      if (editors !== null)
        return editors;
      node = property(node, "return");
    }
    return null;
  }

  // azure-devops/src/features/review/editor-cards.ts
  var OVERLAY_CLASS = "fix-ado-review-editor-card", MAX_CARD_WIDTH = 744, CARD_MARGIN = 16, MIN_EDITOR_WIDTH = 200, cardsByDocument = /* @__PURE__ */ new WeakMap();
  function cardsOf(document2) {
    let cards = cardsByDocument.get(document2) ?? /* @__PURE__ */ new Map();
    return cardsByDocument.set(document2, cards), cards;
  }
  function createItem2(document2, comment) {
    let item = element(document2, "div", { className: "fix-ado-review-listed" });
    return markHolder(item, comment), item.append(createCard2(document2, comment, ONLY_YOU_NOTE)), item;
  }
  function showAt(card, editor, top) {
    let { contentLeft, contentWidth } = editor.getLayoutInfo();
    Object.assign(card.style, {
      display: "block",
      left: `${contentLeft}px`,
      top: `${top}px`,
      width: `${Math.min(MAX_CARD_WIDTH, contentWidth - CARD_MARGIN)}px`
    });
  }
  function doNothing() {
  }
  function keepRoomFor(card, resize) {
    let view = card.ownerDocument.defaultView;
    if (view === null || !("ResizeObserver" in view))
      return doNothing;
    let observer = new view.ResizeObserver(() => {
      resize(card.getBoundingClientRect().height);
    });
    return observer.observe(card), () => {
      observer.disconnect();
    };
  }
  function hideWithRoom(card, room) {
    let view = card.ownerDocument.defaultView;
    if (view === null)
      return doNothing;
    let observer = new view.MutationObserver(() => {
      room.style.display === "none" && (card.style.display = "none");
    });
    return observer.observe(room, { attributeFilter: ["style"], attributes: !0 }), () => {
      observer.disconnect();
    };
  }
  function addRoom(editor, zone) {
    let zoneId = null;
    return editor.changeViewZones((changes) => {
      zoneId = changes.addZone(zone);
    }), {
      remove: () => {
        editor.changeViewZones((changes) => {
          changes.removeZone(zoneId);
        });
      },
      resize: (height) => {
        Math.abs(height - zone.heightInPx) >= 1 && (zone.heightInPx = height, editor.changeViewZones((changes) => {
          changes.layoutZone(zoneId);
        }));
      }
    };
  }
  function showOverlay(document2, { comment, editor }) {
    let card = element(document2, "div", { className: `${OVERLAY_CLASS} body-m` }), item = createItem2(document2, comment);
    card.append(item);
    let overlay = {
      getDomNode: () => card,
      getId: () => `fix-ado-review-${comment.id}`,
      getPosition: () => null
    };
    return editor.addOverlayWidget(overlay), { card, item, overlay };
  }
  function placeCard(document2, wanted) {
    let { comment, editor, line: line2 } = wanted, { card, item, overlay } = showOverlay(document2, wanted), { height } = card.getBoundingClientRect(), zone = {
      afterLineNumber: line2,
      domNode: element(document2, "div"),
      heightInPx: height,
      onDomNodeTop: (top) => {
        showAt(card, editor, top);
      }
    }, room = addRoom(editor, zone), stops = [keepRoomFor(card, room.resize), hideWithRoom(card, zone.domNode)], remove = () => {
      for (let stop of stops)
        stop();
      room.remove(), editor.removeOverlayWidget(overlay);
    }, { content, draft } = comment;
    return {
      content,
      editor,
      isEditing: draft !== null,
      item,
      model: editor.getModel(),
      overlay,
      remove
    };
  }
  function removeCard(card) {
    try {
      card.remove();
    } catch {
    }
  }
  function editorFor({ left, right }, side) {
    return side === "right" ? right : left !== null && left.getLayoutInfo().contentWidth >= MIN_EDITOR_WIDTH ? left : null;
  }
  function wantedCards(document2, pending) {
    let editors = findShownEditors(document2), filePath = shownFilePath(document2), wanted = /* @__PURE__ */ new Map();
    for (let comment of editors === null ? [] : pending) {
      let { anchor } = comment, editor = editors !== null && anchor?.filePath === filePath ? editorFor(editors, anchor.side) : null;
      anchor !== null && editor !== null && wanted.set(comment.id, { comment, editor, line: anchor.line });
    }
    return wanted;
  }
  function isCurrent(card, { comment, editor }) {
    return card.editor === editor && card.model === editor.getModel() && card.content === comment.content && card.isEditing === (comment.draft !== null) && card.item.isConnected;
  }
  function removeOutdated(cards, wanted) {
    for (let [id, card] of cards) {
      let want = wanted.get(id);
      (want === void 0 || !isCurrent(card, want)) && (removeCard(card), cards.delete(id));
    }
  }
  function syncEditorCards(document2, pending) {
    let cards = cardsOf(document2), wanted = wantedCards(document2, pending);
    removeOutdated(cards, wanted);
    for (let [id, want] of wanted)
      cards.has(id) || cards.set(id, placeCard(document2, want));
    return new Set(cards.keys());
  }

  // azure-devops/src/features/review/file-pending-list.ts
  var LIST_CLASS = "fix-ado-review-file-pending", ITEM_CLASS = "fix-ado-review-listed", EDITOR_SELECTOR2 = ".monaco-diff-editor, .monaco-editor", EDITOR_CARD_SELECTOR = ".bolt-card-content";
  function listHost(document2) {
    let editor = document2.querySelector(EDITOR_SELECTOR2);
    return editor?.closest(EDITOR_CARD_SELECTOR) ?? editor?.parentElement ?? null;
  }
  function lineLabel({ anchor }) {
    return anchor === null ? "" : anchor.side === "left" ? `Line ${anchor.line}, before the change` : `Line ${anchor.line}`;
  }
  function listItem(document2, comment) {
    let item = element(document2, "div", { className: ITEM_CLASS });
    return markHolder(item, comment), item.append(createCard2(document2, comment, lineLabel(comment))), item;
  }
  function createList(document2, inFile, isOpen) {
    let list = element(document2, "details", { className: `${LIST_CLASS} body-m` });
    return list.open = isOpen, list.append(
      element(document2, "summary", { text: `${pendingCountText(inFile.length)} in this file` }),
      ...inFile.map((comment) => listItem(document2, comment))
    ), list;
  }
  function pendingInShownFile(document2, pending) {
    let filePath = shownFilePath(document2);
    return listHost(document2) === null ? [] : pending.filter(({ anchor }) => anchor?.filePath === filePath);
  }
  function showsExactly(list, shown, count) {
    return list?.dataset.fixAdoReviewShown === shown && list.parentElement === listHost(list.ownerDocument) && list.querySelectorAll(`.${ITEM_CLASS}`).length === count;
  }
  function syncFilePendingList(document2, pending) {
    let inFile = pendingInShownFile(document2, pending), existing = document2.querySelector(`.${LIST_CLASS}`), shown = JSON.stringify(
      inFile.map(({ content, draft, id }) => [id, content, draft !== null])
    );
    if (inFile.length === 0)
      existing?.remove();
    else if (!showsExactly(existing, shown, inFile.length)) {
      let list = createList(document2, inFile, existing?.open ?? !1);
      list.dataset.fixAdoReviewShown = shown, existing?.remove(), listHost(document2)?.append(list);
    }
  }

  // azure-devops/src/features/review/review-header.ts
  var HEADER_CLASS = "fix-ado-review-header", TABBAR_SELECTOR2 = ".repos-pr-details-page-tabbar";
  function submitButton(document2, count) {
    let button2 = actionButton(document2, {
      action: "finish",
      isPrimary: !0,
      text: "Submit review"
    });
    return button2.setAttribute("aria-label", `Submit review, ${pendingCountText(count)}`), button2.append(
      element(document2, "span", { className: "fix-ado-review-count", text: String(count) })
    ), button2;
  }
  function createHeader(document2, { count, isPullRequestActive }) {
    let header = element(document2, "div", { className: HEADER_CLASS });
    return isPullRequestActive ? header.append(submitButton(document2, count)) : header.append(
      element(document2, "span", { className: "secondary-text", text: pendingCountText(count) }),
      actionButton(document2, { action: "copy", text: "Copy" }),
      actionButton(document2, { action: "discard", text: "Discard" })
    ), header;
  }
  function syncHeader(document2, state) {
    let tabbar = state.count === 0 ? null : document2.querySelector(TABBAR_SELECTOR2), existing = document2.querySelector(`.${HEADER_CLASS}`), shown = `${state.count} ${state.isPullRequestActive}`;
    if (tabbar === null)
      existing?.remove();
    else if (existing?.dataset.fixAdoReviewShown !== shown || existing.parentElement !== tabbar) {
      let header = createHeader(document2, state);
      header.dataset.fixAdoReviewShown = shown, existing?.remove(), tabbar.append(header);
    }
  }

  // azure-devops/src/pull-requests/file-tree/tree-listing.ts
  var listedByChangedPaths = /* @__PURE__ */ new WeakMap();
  function byName(left, right) {
    return left.localeCompare(right, "en", { sensitivity: "base" });
  }
  function folderOf(changedPaths) {
    let root = { files: [], folders: /* @__PURE__ */ new Map() };
    for (let filePath of changedPaths) {
      let names = filePath.split("/").filter(Boolean), folder = root;
      for (let name of names.slice(0, -1)) {
        let inner = folder.folders.get(name) ?? { files: [], folders: /* @__PURE__ */ new Map() };
        folder.folders.set(name, inner), folder = inner;
      }
      folder.files.push(names.at(-1) ?? "");
    }
    return root;
  }
  function folderRow(name, folder) {
    let [only] = [...folder.folders];
    return folder.files.length > 0 || folder.folders.size !== 1 || only === void 0 ? { folder, name } : folderRow(`${name}/${only[0]}`, only[1]);
  }
  function addRows(rows, folder, above) {
    let level = above.level + 1;
    for (let first of [...folder.folders.keys()].toSorted(byName)) {
      let inner = folder.folders.get(first);
      if (inner !== void 0) {
        let row = folderRow(first, inner), path = `${above.path}/${row.name}`;
        rows.push({ level, name: row.name, path }), addRows(rows, row.folder, { level, path });
      }
    }
    for (let name of folder.files.toSorted(byName))
      rows.push({ level, name, path: `${above.path}/${name}` });
  }
  function listedRows(changedPaths) {
    let known = listedByChangedPaths.get(changedPaths);
    if (known !== void 0)
      return known;
    let rows = [];
    return addRows(rows, folderOf(changedPaths), { level: 0, path: "" }), listedByChangedPaths.set(changedPaths, rows), rows;
  }
  function isUnder(path, folded) {
    return [...folded].some((foldedPath) => path.startsWith(`${foldedPath}/`));
  }
  function isDrawnAt(listed, drawn, start) {
    let levelShift = (listed[start]?.level ?? 0) - (drawn[0]?.level ?? 0);
    return drawn.every(({ level, name }, index) => {
      let row = listed[start + index];
      return row?.name === name && row.level === level + levelShift;
    });
  }
  function runsOf2(drawn) {
    let runs = [];
    for (let row of drawn) {
      let run = row.isAfterGap ? void 0 : runs.at(-1);
      run === void 0 ? runs.push([row]) : run.push(row);
    }
    return runs;
  }
  function withoutOverlap(runs, starts) {
    let fitting = starts.map((candidates) => [...candidates]);
    for (let [index, candidates] of fitting.entries()) {
      let earliest = Math.min(...fitting[index - 1] ?? []) + (runs[index - 1]?.length ?? 0);
      fitting[index] = candidates.filter((start) => index === 0 || start >= earliest);
    }
    for (let [index, candidates] of [...fitting.entries()].toReversed()) {
      let latest = Math.max(...fitting[index + 1] ?? []) - (runs[index]?.length ?? 0);
      fitting[index] = candidates.filter((start) => index === runs.length - 1 || start <= latest);
    }
    return fitting;
  }
  function findDrawn(changedPaths, drawn, folded) {
    let listed = listedRows(changedPaths).filter(({ path }) => !isUnder(path, folded)), runs = runsOf2(drawn), everyStart = listed.map((_row, start) => start), starts = withoutOverlap(
      runs,
      runs.map((run) => everyStart.filter((start) => isDrawnAt(listed, run, start)))
    );
    if (runs.length === 0 || starts.some((candidates) => candidates.length !== 1))
      return null;
    let placeOfDrawn = runs.flatMap(
      (run, index) => run.map((_row, offset) => (starts[index]?.[0] ?? 0) + offset)
    );
    return { paths: listed.map(({ path }) => path), placeOfDrawn };
  }

  // azure-devops/src/pull-requests/file-tree/tree-folded.ts
  var FOLDED_ATTRIBUTE = "aria-expanded", foldedByDocument = /* @__PURE__ */ new WeakMap(), treePathsByChangedPaths = /* @__PURE__ */ new WeakMap();
  function treePathsOf(changedPaths) {
    let known = treePathsByChangedPaths.get(changedPaths);
    if (known !== void 0)
      return known;
    let paths = /* @__PURE__ */ new Set();
    for (let filePath of changedPaths) {
      let names = filePath.split("/").filter(Boolean);
      for (let depth = 1; depth <= names.length; depth += 1)
        paths.add(`/${names.slice(0, depth).join("/")}`);
    }
    return treePathsByChangedPaths.set(changedPaths, [...paths]), [...paths];
  }
  function treePathOf({ isWholePath, pathEnd }, changedPaths) {
    let end = `/${pathEnd}`, fitting = treePathsOf(changedPaths).filter(
      (path) => (
        // The tree's first row may name the repository, which a path leaves out.
        isWholePath ? end === path || end.endsWith(path) : path.endsWith(end)
      )
    );
    return isWholePath ? fitting.toSorted((left, right) => right.length - left.length)[0] ?? null : fitting.length === 1 ? fitting[0] ?? null : null;
  }
  function noteFolded(document2, drawn, changedPaths) {
    let folded = foldedByDocument.get(document2) ?? /* @__PURE__ */ new Set();
    foldedByDocument.set(document2, folded);
    for (let drawnRow of changedPaths === null ? [] : drawn) {
      let state = drawnRow.row.getAttribute(FOLDED_ATTRIBUTE), path = state === "false" || state === "true" && folded.size > 0 ? treePathOf(drawnRow, changedPaths ?? []) : null;
      path !== null && state === "false" ? folded.add(path) : path !== null && folded.delete(path);
    }
    return folded;
  }
  function noteOwnFold(document2, path, isFolded) {
    let folded = foldedByDocument.get(document2) ?? /* @__PURE__ */ new Set();
    foldedByDocument.set(document2, folded), isFolded ? folded.add(path) : folded.delete(path);
  }
  function foldedPaths(document2) {
    return foldedByDocument.get(document2) ?? /* @__PURE__ */ new Set();
  }

  // azure-devops/src/pull-requests/file-tree/tree-rows.ts
  var TREE_ROW_SELECTOR2 = ".repos-changes-explorer-tree tr.bolt-tree-row", THREAD_ITEM_CLASS = "repos-file-explorer-tree-thread-item", NAME_SELECTOR = ".bolt-tree-cell .text-ellipsis", INDEX_ATTRIBUTE = "aria-rowindex";
  function isThreadRow2(row) {
    return row?.querySelector(`.${THREAD_ITEM_CLASS}`) !== null && row !== null;
  }
  function isAfterSkippedRows(row) {
    let before = row.previousElementSibling;
    for (; before !== null && !before.hasAttribute(INDEX_ATTRIBUTE); )
      before = before.previousElementSibling;
    let index = Number(row.getAttribute(INDEX_ATTRIBUTE));
    return before !== null && Number(before.getAttribute(INDEX_ATTRIBUTE)) !== index - 1;
  }
  function drawnRows(document2) {
    let names = [];
    return [...document2.querySelectorAll(TREE_ROW_SELECTOR2)].filter((row) => !isThreadRow2(row)).map((row) => {
      let depth = Math.max(Number(row.getAttribute("aria-level")) - 1, 0);
      for (; names.length < depth; )
        names.push(null);
      names.length = depth;
      let name = row.querySelector(NAME_SELECTOR)?.textContent.trim() ?? "";
      names.push(name);
      let firstKnown = names.lastIndexOf(null) + 1, pathEnd = names.slice(firstKnown).join("/").split("/").filter(Boolean).join("/");
      return { isAfterGap: isAfterSkippedRows(row), isWholePath: firstKnown === 0, level: depth + 1, name, pathEnd, row };
    });
  }
  function isRowOf(drawn, filePath, changedPaths) {
    let end = `/${drawn.pathEnd}`;
    if (drawn.isWholePath)
      return end === filePath || end.endsWith(filePath);
    let sameEnd = (changedPaths ?? []).filter((path) => path.endsWith(end));
    return filePath.endsWith(end) && sameEnd.length === 1;
  }
  function fileRowOf(drawn, filePath, changedPaths) {
    return drawn.find((candidate) => isRowOf(candidate, filePath, changedPaths))?.row ?? null;
  }
  function drawnRowOf(path, { changedPaths, drawn, listing }) {
    let place = listing?.paths.indexOf(path) ?? -1;
    return listing === null || place === -1 ? fileRowOf(drawn, path, changedPaths) : drawn[listing.placeOfDrawn.indexOf(place)]?.row ?? null;
  }
  function drawnPaths({ drawn, listing }) {
    return drawn.map((_row, index) => {
      let place = listing?.placeOfDrawn[index];
      return place === void 0 ? null : listing?.paths[place] ?? null;
    });
  }
  function treeNow(document2, changedPaths) {
    let drawn = drawnRows(document2), folded = noteFolded(document2, drawn, changedPaths), listing = changedPaths === null ? null : findDrawn(changedPaths, drawn, folded);
    return { changedPaths, drawn, listing };
  }

  // azure-devops/src/features/review/tree-scroll-anchor.ts
  var TREE_SELECTOR2 = ".repos-changes-explorer-tree", TREE_ROW_SELECTOR3 = `${TREE_SELECTOR2} tr.bolt-tree-row[aria-rowindex]`, SCROLLER_SELECTOR2 = ".v-scroll-auto", SMALLEST_MOVE = 1, LARGEST_SHIFT = 100, WEAR_PER_SCROLLED_PIXEL = 0.25, shiftByScroller = /* @__PURE__ */ new WeakMap();
  function shiftTree(scroller, shift, pixels2) {
    let limited = Math.min(Math.max(pixels2, -LARGEST_SHIFT, -scroller.scrollTop), LARGEST_SHIFT);
    shift.pixels = Math.round(limited), shift.scrollTop = scroller.scrollTop;
    let tree = scroller.querySelector(TREE_SELECTOR2), margin = shift.pixels === 0 ? "" : `${shift.pixels}px`;
    tree !== null && tree.style.marginTop !== margin && (tree.style.marginTop = margin);
  }
  function wearOff(scroller, shift) {
    let wear = Math.abs(scroller.scrollTop - shift.scrollTop) * WEAR_PER_SCROLLED_PIXEL, left = Math.max(Math.abs(shift.pixels) - wear, 0);
    shiftTree(scroller, shift, Math.sign(shift.pixels) * left);
  }
  function shiftOf(scroller) {
    let known = shiftByScroller.get(scroller);
    if (known !== void 0)
      return known;
    let shift = { pixels: 0, scrollTop: scroller.scrollTop };
    return shiftByScroller.set(scroller, shift), scroller.addEventListener(
      "scroll",
      () => {
        wearOff(scroller, shift);
      },
      { passive: !0 }
    ), shift;
  }
  function firstRowInView(document2) {
    let scroller = document2.querySelector(TREE_SELECTOR2)?.closest(SCROLLER_SELECTOR2) ?? null;
    if (scroller === null)
      return null;
    let viewTop = scroller.getBoundingClientRect().top, row = [...document2.querySelectorAll(TREE_ROW_SELECTOR3)].find(
      (candidate) => candidate.getBoundingClientRect().top >= viewTop
    );
    return row === void 0 ? null : { row, scroller };
  }
  function keepingTreeInPlace(document2, change) {
    let anchor = firstRowInView(document2), topBefore = anchor?.row.getBoundingClientRect().top ?? 0;
    change();
    let moved = (anchor?.row.getBoundingClientRect().top ?? 0) - topBefore;
    if (anchor !== null && Math.abs(moved) >= SMALLEST_MOVE) {
      let shift = shiftOf(anchor.scroller);
      shiftTree(anchor.scroller, shift, shift.pixels - moved);
    }
  }

  // azure-devops/src/features/review/tree-pending-rows.ts
  var PENDING_ROW_CLASS = "fix-ado-review-tree-row", ID_ATTRIBUTE2 = "data-fix-ado-review-tree-id", INDENT_SELECTOR = ".bolt-tree-expand-button", INDENT_STEP = 16, DOT_TITLE = "Pending comment", UNSAVED_MARK = "*";
  function cell(document2, className) {
    return element(document2, "td", { className: `${className} bolt-table-cell bolt-list-cell` });
  }
  function threadIndent(fileRow) {
    let indent = element(fileRow.ownerDocument, "span", {
      className: "fix-ado-review-tree-indent"
    }), fileIndent = fileRow.querySelector(INDENT_SELECTOR)?.style.marginLeft ?? "", pixels2 = fileIndent.endsWith("px") ? Number(fileIndent.slice(0, -2)) : 0;
    return indent.style.marginLeft = `${pixels2 + INDENT_STEP}px`, indent;
  }
  function pendingDot(document2) {
    let dot = element(document2, "span", { className: "fix-ado-review-pending-dot" });
    return dot.title = DOT_TITLE, dot.setAttribute("aria-label", DOT_TITLE), dot.setAttribute("role", "img"), dot;
  }
  function pendingText(document2, { content, draft }) {
    let [firstLine = ""] = (draft ?? content).split(`
`), text = element(document2, "div", { className: "flex-grow text-ellipsis" });
    return draft !== null && text.append(element(document2, "span", { className: "margin-right-4", text: UNSAVED_MARK })), text.append(firstLine), text;
  }
  function pendingItem(fileRow, comment) {
    let document2 = fileRow.ownerDocument, item = element(document2, "div", {
      className: `${THREAD_ITEM_CLASS} rhythm-horizontal-4 bolt-table-cell-content flex-row flex-center`
    });
    return item.append(threadIndent(fileRow), pendingDot(document2), pendingText(document2, comment)), item;
  }
  function shownOf({ content, draft }) {
    return JSON.stringify([content, draft]);
  }
  function fileRowAbove(pendingRow) {
    let above = pendingRow.previousElementSibling;
    for (; isThreadRow2(above); )
      above = above?.previousElementSibling ?? null;
    return above;
  }
  function openFileOf(pendingRow) {
    let fileRow = fileRowAbove(pendingRow), view = pendingRow.ownerDocument.defaultView;
    fileRow !== null && view !== null && fileRow.dispatchEvent(new view.MouseEvent("click", { bubbles: !0 }));
  }
  function createPendingRow(fileRow, comment) {
    let document2 = fileRow.ownerDocument, row = element(document2, "tr", {
      className: `bolt-tree-row bolt-table-row bolt-list-row single-click-activation ${PENDING_ROW_CLASS}`
    });
    row.setAttribute(ID_ATTRIBUTE2, comment.id), row.dataset.fixAdoReviewShown = shownOf(comment);
    let treeCell = cell(document2, "bolt-tree-cell");
    return treeCell.append(pendingItem(fileRow, comment)), row.append(cell(document2, "bolt-table-cell-compact"), cell(document2, ""), treeCell), row.addEventListener("click", () => {
      openFileOf(row);
    }), row;
  }
  function lastRowUnder2(fileRow) {
    let last = fileRow;
    for (; isThreadRow2(last.nextElementSibling); )
      last = last.nextElementSibling ?? last;
    return last;
  }
  function isUpToDate(row, fileRow, comment) {
    return row.dataset.fixAdoReviewShown === shownOf(comment) && fileRowAbove(row) === fileRow;
  }
  function showRow(stale, fileRow, comment) {
    let row = [...stale].find((candidate) => candidate.getAttribute(ID_ATTRIBUTE2) === comment.id);
    row !== void 0 && isUpToDate(row, fileRow, comment) ? stale.delete(row) : fileRow !== null && lastRowUnder2(fileRow).after(createPendingRow(fileRow, comment));
  }
  function syncTreePendingRows(document2, { changedPaths, pending }) {
    let stale = new Set(document2.querySelectorAll(`.${PENDING_ROW_CLASS}`)), tree = treeNow(document2, changedPaths);
    keepingTreeInPlace(document2, () => {
      for (let comment of pending.filter(({ anchor }) => anchor !== null))
        showRow(stale, drawnRowOf(comment.anchor?.filePath ?? "", tree), comment);
      for (let row of stale)
        row.remove();
    });
  }

  // azure-devops/src/features/review/review-view.ts
  var TREE_SELECTOR3 = ".repos-changes-explorer-tree", OWN_CLASS_PREFIX = "fix-ado-review";
  function withDraft(comment, drafts) {
    return { ...comment, draft: drafts.get(comment.id) ?? null };
  }
  function showReview(document2, review2) {
    let { changedPaths, isOnPullRequest, isPullRequestActive } = review2, pending = review2.pending.map((comment) => withDraft(comment, review2.drafts));
    isOnPullRequest && syncAddButtons(document2, pending.length > 0), syncPendingCards(document2, pending), syncCardSpacers(document2);
    let inEditor = syncEditorCards(document2, pending);
    syncFilePendingList(
      document2,
      pending.filter(({ id }) => !inEditor.has(id))
    ), syncTreePendingRows(document2, { changedPaths, pending }), syncHeader(document2, { count: pending.length, isPullRequestActive });
  }
  function showInTree(document2, { changedPaths, drafts, pending }) {
    syncTreePendingRows(document2, {
      changedPaths,
      pending: pending.map((comment) => withDraft(comment, drafts))
    });
  }
  function isOwnNode(node) {
    return "className" in node && String(node.className).includes(OWN_CLASS_PREFIX);
  }
  function isTreeChange({ addedNodes, removedNodes, target }) {
    return "closest" in target && closestElement(target, TREE_SELECTOR3) !== null && [...addedNodes, ...removedNodes].some((node) => !isOwnNode(node));
  }
  function watchTree(document2, onChange) {
    let view = document2.defaultView;
    view !== null && new view.MutationObserver((records) => {
      records.some((record) => isTreeChange(record)) && onChange();
    }).observe(document2.body, { childList: !0, subtree: !0 });
  }

  // azure-devops/src/features/review/finish-dialog.ts
  var DIALOG_CLASS = "fix-ado-review-dialog", TITLE2 = "Finish your review", TITLE_ID = "fix-ado-review-dialog-title", VOTE_OPTIONS = [
    {
      description: "Submit general feedback without explicit approval.",
      label: "Comment",
      vote: null
    },
    { description: "Submit feedback and approve merging these changes.", label: "Approve", vote: 10 },
    { description: "Approve, and leave suggestions.", label: "Approve with suggestions", vote: 5 },
    { description: "Submit feedback suggesting changes.", label: "Wait for author", vote: -5 },
    { description: "Reject these changes.", label: "Reject", vote: -10 }
  ];
  function voteOption(document2, index) {
    let option = element(document2, "label", { className: "fix-ado-review-vote" }), radio = element(document2, "input");
    radio.type = "radio", radio.name = "fix-ado-review-vote", radio.value = String(index), radio.checked = index === 0;
    let text = element(document2, "span");
    return text.append(
      element(document2, "strong", { text: VOTE_OPTIONS[index]?.label }),
      element(document2, "span", {
        className: "secondary-text",
        text: VOTE_OPTIONS[index]?.description
      })
    ), option.append(radio, text), option;
  }
  function voteOptions(document2) {
    let group2 = element(document2, "fieldset", { className: "fix-ado-review-votes" }), legend = element(document2, "legend", {
      className: "fix-ado-visually-hidden",
      text: "Your vote"
    });
    return group2.append(legend, ...VOTE_OPTIONS.map((_option, index) => voteOption(document2, index))), group2;
  }
  function placeOf({ anchor }) {
    return anchor === null ? "Pull request" : `${anchor.filePath}, line ${anchor.line}`;
  }
  function pendingList(document2, pending) {
    let details = element(document2, "details", { className: "fix-ado-review-pending-list" });
    details.append(element(document2, "summary", { text: pendingCountText(pending.length) }));
    for (let comment of pending) {
      let item = element(document2, "div", { className: "fix-ado-review-pending-item" });
      item.append(
        element(document2, "div", { className: "secondary-text", text: placeOf(comment) }),
        element(document2, "div", { className: "fix-ado-review-card-text", text: comment.content })
      ), details.append(item);
    }
    return details;
  }
  function chosenVote(dialog) {
    let checked = dialog.querySelector("input[type=radio]:checked");
    return VOTE_OPTIONS[Number(checked?.value ?? 0)]?.vote ?? null;
  }
  function setBusy(dialog, isBusy2) {
    dialog.toggleAttribute("aria-busy", isBusy2);
    for (let control of dialog.querySelectorAll("button, input, textarea"))
      control.disabled = isBusy2;
  }
  function problemOf({ failures, vote }) {
    if (failures.length > 0) {
      let statuses = [...new Set(failures.map(({ httpStatus }) => httpStatus))].join(", ");
      return `${failures.length} of your comments could not be posted (HTTP ${statuses}). They are still pending. Submit again to retry.`;
    }
    return vote === "failed" ? "Your comments are posted, but your vote could not be saved. Vote with Azure DevOps's own button." : null;
  }
  async function postFrom(dialog, options) {
    let status = dialog.querySelector(".fix-ado-review-status"), summary = dialog.querySelector("textarea"), choices = { summary: summary?.value ?? "", vote: chosenVote(dialog) };
    setBusy(dialog, !0);
    try {
      let result = await options.submit(choices, (handled, total) => {
        status !== null && (status.textContent = `Sending ${handled + 1} of ${total}`);
      });
      return problemOf(result);
    } catch {
      return "Azure DevOps could not be reached. Nothing more was posted. Submit again to retry.";
    } finally {
      summary !== null && (summary.value = "");
    }
  }
  function showProblem(dialog, options, problem) {
    setBusy(dialog, !1), dialog.querySelector('[data-fix-ado-review-action="submit"]')?.focus();
    let status = dialog.querySelector(".fix-ado-review-status");
    status !== null && (status.textContent = problem), dialog.querySelector(".fix-ado-review-pending-list")?.replaceWith(pendingList(options.document, options.pending()));
  }
  async function submitFrom(dialog, options) {
    let problem = await postFrom(dialog, options);
    if (problem === null || options.pending().length === 0) {
      dialog.close(), options.onSubmitted();
      return;
    }
    showProblem(dialog, options, problem);
  }
  function createButtons(document2) {
    let buttons = element(document2, "div", { className: "fix-ado-review-dialog-buttons" }), right = element(document2, "div", { className: "fix-ado-review-buttons" });
    return right.append(
      actionButton(document2, { action: "close", text: "Cancel" }),
      actionButton(document2, { action: "submit", isPrimary: !0, text: "Submit review" })
    ), buttons.append(
      actionButton(document2, { action: "discard-review", text: "Discard review" }),
      right
    ), buttons;
  }
  function summaryBox(document2) {
    let summary = element(document2, "textarea", { className: "fix-ado-review-textarea" });
    return summary.placeholder = "Leave a comment", summary.setAttribute("aria-label", "Leave a comment"), summary;
  }
  function statusLine(document2) {
    let status = element(document2, "p", { className: "fix-ado-review-status" });
    return status.setAttribute("role", "status"), status;
  }
  function createDialog(options) {
    let { document: document2 } = options, dialog = element(document2, "dialog", { className: DIALOG_CLASS }), title = element(document2, "h2", { className: "fix-ado-review-title", text: TITLE2 });
    return title.id = TITLE_ID, dialog.setAttribute("aria-labelledby", TITLE_ID), dialog.append(
      title,
      summaryBox(document2),
      voteOptions(document2),
      pendingList(document2, options.pending()),
      statusLine(document2),
      createButtons(document2)
    ), dialog;
  }
  function dialogActions(dialog, options) {
    return {
      close: () => {
        dialog.close();
      },
      "discard-review": () => {
        globalThis.confirm(`Discard ${pendingCountText(options.pending().length)}?`) && (options.discard(), dialog.close());
      },
      submit: () => {
        submitFrom(dialog, options);
      }
    };
  }
  function openFinishDialog(options) {
    let { document: document2 } = options;
    document2.querySelector(`dialog.${DIALOG_CLASS}`)?.remove();
    let dialog = createDialog(options), actions = dialogActions(dialog, options);
    dialog.addEventListener("click", (event) => {
      let clicked = clickedAction(event.target);
      clicked !== null && actions[clicked.action]?.();
    }), dialog.addEventListener("cancel", (event) => {
      dialog.hasAttribute("aria-busy") && event.preventDefault();
    }), dialog.addEventListener("close", () => {
      dialog.remove();
    }), document2.body.append(dialog), dialog.showModal();
  }

  // azure-devops/src/features/review/unsaved-edits-dialog.ts
  var BUTTON_CLASS4 = "bolt-button enabled bolt-focus-treatment", TITLE_ID2 = "fix-ado-review-unsaved-title";
  function answerButton(dialog, text, answer) {
    let button2 = element(dialog.ownerDocument, "button", {
      className: text === "Yes" ? `${BUTTON_CLASS4} primary` : BUTTON_CLASS4,
      text
    });
    return button2.type = "button", button2.addEventListener("click", () => {
      dialog.close(), answer();
    }), button2;
  }
  function openUnsavedEditsDialog({ count, document: document2, onAnswer }) {
    let dialog = element(document2, "dialog", {
      className: "fix-ado-review-dialog fix-ado-review-unsaved"
    });
    dialog.setAttribute("aria-labelledby", TITLE_ID2), dialog.addEventListener("close", () => {
      dialog.remove();
    });
    let title = element(document2, "h2", {
      className: "fix-ado-review-title",
      text: "Save your edits?"
    });
    title.id = TITLE_ID2;
    let buttons = element(document2, "div", { className: "fix-ado-review-buttons" });
    buttons.append(
      answerButton(dialog, "Cancel", () => {
      }),
      answerButton(dialog, "No", () => {
        onAnswer(!1);
      }),
      answerButton(dialog, "Yes", () => {
        onAnswer(!0);
      })
    ), dialog.append(
      title,
      element(document2, "p", {
        text: `You are still editing ${pendingCountText(count)}. "No" drops the edits and keeps the comments as they were.`
      }),
      buttons
    ), document2.body.append(dialog), dialog.showModal();
  }

  // azure-devops/src/features/review/review-submit.ts
  function threadContextOf({ filePath, line: line2, lineLength, side }) {
    let start = { line: line2, offset: 1 }, end = { line: line2, offset: lineLength + 1 };
    return side === "right" ? { filePath, rightFileEnd: end, rightFileStart: start } : { filePath, leftFileEnd: end, leftFileStart: start };
  }
  function isThreadOf({ anchor, content }, thread) {
    if (thread.isDeleted === !0 || thread.comments?.[0]?.content !== content)
      return !1;
    let context = thread.threadContext ?? null;
    if (anchor === null || context === null)
      return anchor === null && context === null;
    let start = anchor.side === "right" ? context.rightFileStart : context.leftFileStart;
    return context.filePath === anchor.filePath && start?.line === anchor.line;
  }
  async function changeTrackingIdOf(state, iteration, filePath) {
    let idsByPath = state.changeTrackingIdsByIteration.get(iteration);
    if (idsByPath === void 0) {
      let changes = await state.options.client.getIterationChanges(
        state.options.pullRequest,
        iteration
      );
      idsByPath = new Map(
        changes.flatMap(
          ({ changeTrackingId, item }) => typeof item?.path == "string" ? [[item.path, changeTrackingId]] : []
        )
      ), state.changeTrackingIdsByIteration.set(iteration, idsByPath);
    }
    return idsByPath.get(filePath) ?? null;
  }
  async function newThreadOf(state, comment) {
    let { anchor, content } = comment;
    if (anchor === null)
      return { content };
    let threadContext = threadContextOf(anchor), iteration = anchor.iteration ?? state.newestIteration, changeTrackingId = iteration === null ? null : await changeTrackingIdOf(state, iteration, anchor.filePath);
    return iteration === null || changeTrackingId === null ? { content, threadContext } : { content, iteration: { changeTrackingId, id: iteration }, threadContext };
  }
  async function postComment(state, comment) {
    let { client, key, pullRequest, store } = state.options;
    if (comment.isAttempted) {
      state.threads ??= await client.getPullRequestThreads(pullRequest);
      let posted = state.threads.find((thread) => isThreadOf(comment, thread));
      if (posted !== void 0)
        return posted.id;
    }
    return store.change(key, comment.id, { isAttempted: !0 }), client.createPullRequestThread(pullRequest, await newThreadOf(state, comment));
  }
  async function postComments(state) {
    let { key, onProgress, store } = state.options, pending = store.pending(key), failures = [];
    for (let [index, comment] of pending.entries()) {
      onProgress?.(index, pending.length);
      try {
        let postedThreadId = await postComment(state, comment);
        store.change(key, comment.id, { postedThreadId });
      } catch (error) {
        failures.push({
          httpStatus: error instanceof AdoRequestError ? error.httpStatus : 0,
          id: comment.id
        });
      }
    }
    return failures;
  }
  async function sendVote({ client, pullRequest }, vote) {
    try {
      let reviewerId = await client.getAuthenticatedUserId();
      return reviewerId === null ? !1 : (await client.setPullRequestVote(pullRequest, { reviewerId, vote }), !0);
    } catch {
      return !1;
    }
  }
  async function submitReview(options, { summary, vote }) {
    summary.trim() !== "" && options.store.add(options.key, { anchor: null, content: summary.trim() }, "first");
    let iterationIds = await options.client.getPullRequestIterationIds(options.pullRequest), failures = await postComments({
      changeTrackingIdsByIteration: /* @__PURE__ */ new Map(),
      newestIteration: iterationIds.length === 0 ? null : Math.max(...iterationIds),
      options,
      threads: null
    });
    return vote === null ? { failures, vote: "none" } : failures.length > 0 ? { failures, vote: "skipped" } : { failures, vote: await sendVote(options, vote) ? "sent" : "failed" };
  }

  // azure-devops/src/features/review/review.ts
  function dropOrphanDrafts(drafts, pending) {
    for (let id of drafts.keys())
      pending.some((comment) => comment.id === id) || drafts.delete(id);
  }
  function shownReview({ drafts, options, shown }) {
    let pending = shown === null ? [] : options.store.pending(shown.key);
    return dropOrphanDrafts(drafts, pending), {
      changedPaths: shown?.changedPaths ?? null,
      drafts,
      isOnPullRequest: shown !== null,
      isPullRequestActive: shown?.isActive ?? !0,
      pending
    };
  }
  function render3(state) {
    showReview(state.options.document, shownReview(state));
  }
  function requestStatus(state, shown) {
    shown.isStatusRequested || state.options.store.pending(shown.key).length === 0 || (shown.isStatusRequested = !0, state.options.client.getPullRequestStatus(shown.pullRequest).then((status) => {
      shown.isActive = status === "active", render3(state);
    }).catch(() => null));
  }
  async function loadIteration(state, shown) {
    let { client } = state.options, ids = await client.getPullRequestIterationIds(shown.pullRequest);
    if (ids.length === 0)
      return;
    shown.newestIteration = Math.max(...ids);
    let changes = await client.getIterationChanges(shown.pullRequest, shown.newestIteration);
    shown.changedPaths = changes.flatMap(({ item }) => item?.path ?? []), render3(state);
  }
  function show(state, pullRequest) {
    let key = state.options.keyOf(pullRequest);
    if (state.shown?.key === key)
      return state.shown;
    let shown = {
      changedPaths: null,
      isActive: !0,
      isStatusRequested: !1,
      key,
      newestIteration: null,
      pullRequest
    };
    return loadIteration(state, shown).catch(() => null), shown;
  }
  function addFromBox(state, shown, box) {
    let content = box?.textarea.value.trim() ?? "";
    if (box === null || content === "")
      return;
    let { anchor } = box;
    state.options.store.add(shown.key, {
      anchor: anchor.kind === "general" ? null : {
        filePath: anchor.filePath,
        iteration: shown.newestIteration,
        line: anchor.line,
        lineLength: anchor.lineLength,
        side: anchor.side
      },
      content
    }), closeBox(box), render3(state);
  }
  function openFinish(state, shown) {
    let { client, document: document2, reload, store } = state.options;
    openFinishDialog({
      discard: () => {
        store.discard(shown.key), render3(state);
      },
      document: document2,
      onSubmitted: reload,
      pending: () => store.pending(shown.key),
      submit: async (choices, onProgress) => submitReview(
        { client, key: shown.key, onProgress, pullRequest: shown.pullRequest, store },
        choices
      )
    });
  }
  function finish(state, shown) {
    let { drafts, options } = state;
    if (drafts.size === 0) {
      openFinish(state, shown);
      return;
    }
    openUnsavedEditsDialog({
      count: drafts.size,
      document: options.document,
      onAnswer: (shouldSave) => {
        shouldSave && saveDrafts({ drafts, key: shown.key, store: options.store }), drafts.clear(), render3(state), openFinish(state, shown);
      }
    });
  }
  function discard(state, shown) {
    let { confirm, store } = state.options;
    confirm(`Discard ${pendingCountText(store.pending(shown.key).length)}?`) && store.discard(shown.key);
  }
  function headerActions(state, shown) {
    let { options } = state;
    return {
      copy: () => {
        options.copy(asMarkdown(options.store.pending(shown.key)));
      },
      discard: () => {
        discard(state, shown);
      },
      finish: () => {
        finish(state, shown);
      }
    };
  }
  function runAction(state, shown, clicked) {
    let headerAction = headerActions(state, shown)[clicked.action];
    clicked.action === ADD_ACTION ? addFromBox(state, shown, commentBoxAround(clicked.button)) : headerAction !== void 0 && headerAction();
    let { drafts, options } = state;
    return headerAction === void 0 ? handleCardAction({ drafts, key: shown.key, store: options.store }, clicked) : null;
  }
  function handleClick(state, event) {
    let { shown } = state, clicked = clickedAction(event.target);
    if (shown === null || clicked === null)
      return;
    let restoreFocus = keepCardFocus(state.options.document, clicked.button), editedId = runAction(state, shown, clicked);
    render3(state), restoreFocus(editedId);
  }
  function boxToAddFrom(state, shown, event) {
    let box = event.key === "Enter" && (event.ctrlKey || event.metaKey) ? commentBoxAround(event.target) : null, hasReview = state.options.store.pending(shown.key).length > 0;
    return box !== null && hasReview && hasAddButton(box) && box.textarea.value.trim() !== "" ? box : null;
  }
  function handleKeydown(state, event) {
    let { shown } = state, box = shown === null ? null : boxToAddFrom(state, shown, event);
    shown === null || box === null || (event.preventDefault(), event.stopImmediatePropagation(), addFromBox(state, shown, box));
  }
  function createReview(options) {
    let state = { drafts: /* @__PURE__ */ new Map(), options, shown: null }, { document: document2 } = options;
    return document2.addEventListener("click", (event) => {
      handleClick(state, event);
    }), document2.addEventListener("input", (event) => {
      (noteDraft(state.drafts, event.target) || commentBoxAround(event.target) !== null) && render3(state);
    }), watchTree(document2, () => {
      showInTree(document2, shownReview(state));
    }), document2.addEventListener(
      "keydown",
      (event) => {
        handleKeydown(state, event);
      },
      !0
    ), {
      sync(pullRequest) {
        state.shown = pullRequest === null ? null : show(state, pullRequest), state.shown !== null && requestStatus(state, state.shown), render3(state);
      }
    };
  }

  // azure-devops/src/features/review/style.css
  var style_default12 = `/* Azure DevOps's own post button, next to the review's button: it looks secondary and
   reads "Add single comment". Its aria-label carries that name, so the text here is
   left out of what a screen reader reads. */
.repos-discussion-thread-reply
  :has(> .fix-ado-review-add)
  > .bolt-button.primary:not(.fix-ado-review-add) {
  background-color: var(--palette-black-alpha-6, rgba(0, 0, 0, 0.06));
  color: var(--text-primary-color, rgba(0, 0, 0, 0.9));
  font-size: 0;
}

.repos-discussion-thread-reply
  :has(> .fix-ado-review-add)
  > .bolt-button.primary:not(.fix-ado-review-add):hover {
  background-color: var(--palette-black-alpha-10, rgba(0, 0, 0, 0.1));
}

.repos-discussion-thread-reply
  :has(> .fix-ado-review-add)
  > .bolt-button.primary:not(.fix-ado-review-add)::after {
  content: "Add single comment" / "";
  font-size: 0.875rem;
}

.fix-ado-review-add.disabled {
  cursor: default;
  opacity: 0.5;
}

/* A pending comment under its line. The card is as wide as the part of the diff in
   view, and stays in view while the code scrolls sideways. */
.repos-summary-code-diff,
.repos-summary-diff-splitter > [class*="vss-Splitter--pane"] {
  container-type: inline-size;
}

.fix-ado-review-card-cell {
  white-space: normal;
}

.fix-ado-review-spacer-row > div {
  height: var(--fix-ado-review-spacer-height, 0);
}

.fix-ado-review-card {
  background-color: rgba(var(--palette-neutral-2, 248, 248, 248), 1);
  border: 1px dashed var(--communication-background, rgba(0, 120, 212, 1));
  border-radius: 4px;
  box-sizing: border-box;
  left: 8px;
  margin: 8px 0;
  max-width: 744px;
  padding: 8px 12px;
  position: sticky;
  width: calc(100cqw - 88px);
}

.fix-ado-review-card-header {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.fix-ado-review-card-note {
  flex: 1 1 160px;
  font-size: 0.75rem;
}

.fix-ado-review-pending {
  border: 1px solid var(--status-warning-foreground, rgba(177, 133, 37, 1));
  border-radius: 120px;
  color: var(--status-warning-foreground, rgba(177, 133, 37, 1));
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0 8px;
}

.fix-ado-review-card-text {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.fix-ado-review-textarea {
  background-color: var(--background-color, rgba(255, 255, 255, 1));
  border: 1px solid rgba(var(--palette-neutral-20, 200, 200, 200), 1);
  border-radius: 2px;
  box-sizing: border-box;
  color: var(--text-primary-color, rgba(0, 0, 0, 0.9));
  font: inherit;
  min-height: 80px;
  padding: 6px 8px;
  resize: vertical;
  width: 100%;
}

.fix-ado-review-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

/* A pending comment in the single-file view, over the room the editor keeps under its line. */
.fix-ado-review-editor-card {
  box-sizing: border-box;
  /* Until the editor has drawn the room. */
  display: none;
  position: absolute;
  white-space: normal;
  z-index: 5;
}

.fix-ado-review-editor-card .fix-ado-review-card {
  margin: 4px 0;
  position: static;
  width: auto;
}

/* The pending comments on the file in the single-file view, over a corner of the
   card around the editor. */
.fix-ado-review-file-pending {
  background-color: var(--callout-background-color, rgba(255, 255, 255, 1));
  border: 1px solid rgba(var(--palette-neutral-20, 200, 200, 200), 1);
  border-radius: 4px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
  color: var(--text-primary-color, rgba(0, 0, 0, 0.9));
  max-height: 70%;
  max-width: 70%;
  overflow-y: auto;
  padding: 6px 12px;
  position: absolute;
  right: 24px;
  top: 8px;
  z-index: 20;
}

.fix-ado-review-file-pending > summary {
  cursor: pointer;
  font-weight: 600;
}

.fix-ado-review-file-pending[open] {
  width: 480px;
}

.fix-ado-review-file-pending .fix-ado-review-card {
  position: static;
  width: auto;
}

.fix-ado-review-file-pending .fix-ado-review-card-note {
  flex-basis: 60px;
}

/* A pending comment in the file tree: a dot in the "Pending" colour where a thread has a picture. */
.fix-ado-review-tree-row {
  cursor: pointer;
}

/* As wide as the arrow a thread's row keeps room for, and as tall as that row. */
.fix-ado-review-tree-indent {
  flex-shrink: 0;
  width: 25px;
}

.fix-ado-review-tree-row .repos-file-explorer-tree-thread-item {
  box-sizing: border-box;
  height: 36px;
}

.fix-ado-review-pending-dot {
  background-color: var(--status-warning-foreground, rgba(177, 133, 37, 1));
  border-radius: 50%;
  flex-shrink: 0;
  height: 16px;
  width: 16px;
}

/* Forced colors drop the background, which is all the dot is. */
@media (forced-colors: active) {
  .fix-ado-review-pending-dot {
    background-color: CanvasText;
    forced-color-adjust: none;
  }
}

/* "Submit review" in the pull request's tab bar. */
.fix-ado-review-header {
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  margin-left: auto;
}

.fix-ado-review-count {
  background-color: var(--background-color, rgba(255, 255, 255, 1));
  border-radius: 120px;
  color: var(--text-primary-color, rgba(0, 0, 0, 0.9));
  font-size: 0.75rem;
  margin-left: 8px;
  min-width: 12px;
  padding: 0 6px;
}

/* "Finish your review". */
.fix-ado-review-dialog {
  background-color: var(--callout-background-color, rgba(255, 255, 255, 1));
  border: 1px solid rgba(var(--palette-neutral-20, 200, 200, 200), 1);
  border-radius: 4px;
  color: var(--text-primary-color, rgba(0, 0, 0, 0.9));
  max-height: 80vh;
  padding: 20px;
  width: min(560px, 90vw);
}

/* Scrolling in the dialog or over the backdrop stops there, and leaves the page behind it. */
.fix-ado-review-dialog:modal {
  overscroll-behavior: contain;
}

.fix-ado-review-dialog::backdrop {
  background-color: rgba(0, 0, 0, 0.4);
  overflow: hidden;
  overscroll-behavior: contain;
}

.fix-ado-review-title {
  font-size: 1.0625rem;
  margin: 0 0 12px;
}

/* Read by a screen reader, not shown. */
.fix-ado-visually-hidden {
  block-size: 1px;
  clip-path: inset(50%);
  inline-size: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}

.fix-ado-review-votes {
  border: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0;
  padding: 0;
}

.fix-ado-review-vote {
  align-items: flex-start;
  cursor: pointer;
  display: flex;
  gap: 8px;
}

.fix-ado-review-vote span > * {
  display: block;
}

.fix-ado-review-pending-list summary {
  cursor: pointer;
  font-weight: 600;
}

.fix-ado-review-pending-item {
  border-top: 1px solid rgba(var(--palette-neutral-8, 234, 234, 234), 1);
  margin-top: 8px;
  padding-top: 8px;
}

.fix-ado-review-status {
  color: var(--status-error-foreground, rgba(205, 74, 69, 1));
  margin: 12px 0 0;
  min-height: 1.25rem;
}

.fix-ado-review-dialog-buttons {
  align-items: flex-end;
  display: flex;
  justify-content: space-between;
}
`;

  // azure-devops/src/features/review/index.ts
  var MAX_REVIEW_AGE_MS = 2592e6, review = {
    change: { kind: "new", version: "1.10.0" },
    description: "Start a review on a pull request: collect comments that only you see, then post them in one go, with your vote.",
    id: "review",
    name: "Reviews",
    start({ basePath: basePath2, client, document: document2, isInFrame: isInFrame2, now }) {
      if (isInFrame2)
        return null;
      let store = createReviewStore({
        createId: () => crypto.randomUUID(),
        now,
        storage: {
          keys: () => GM_listValues(),
          load: (key) => GM_getValue(key, null),
          remove: (key) => {
            GM_deleteValue(key);
          },
          save: (key, stored) => {
            GM_setValue(key, stored);
          }
        }
      });
      store.deleteOlderThan(MAX_REVIEW_AGE_MS);
      let feature = createReview({
        client,
        // oxlint-disable-next-line eslint/no-alert -- one question before the owner's text is deleted
        confirm: (question) => globalThis.confirm(question),
        copy: (text) => {
          navigator.clipboard.writeText(text);
        },
        document: document2,
        keyOf: (pullRequest) => reviewKey(`${location.host}${basePath2}`, pullRequest),
        reload: () => {
          location.reload();
        },
        store
      });
      return {
        sync({ page }) {
          feature.sync(pullRequestOf(page));
        }
      };
    },
    styles: [style_default12]
  };

  // azure-devops/src/features/run-page-tabs/run-tab-store.ts
  var RUN_TAB_ID_PREFIX = "__bolt-tab-";
  function runTabViewOf(tab) {
    return tab.id.startsWith(RUN_TAB_ID_PREFIX) ? tab.id.slice(RUN_TAB_ID_PREFIX.length) : null;
  }
  function runTabViewsIn(document2) {
    return [...document2.querySelectorAll(
      ".run-details-page .bolt-tabbar [role=tablist] [role=tab]"
    )].map((tab) => runTabViewOf(tab)).filter((view) => view !== null);
  }
  function runTabPath(runPath, view) {
    return `${runPath}&view=${encodeURIComponent(view)}`;
  }
  function isSameRunTab(first, second) {
    return first.pipelineId === second.pipelineId && first.view === second.view;
  }

  // azure-devops/src/features/run-page-tabs/run-tab-frame.ts
  var RUN_TAB_FRAME_CLASS = "fix-ado-run-tab-frame", TAB_CONTENT_LINK_SELECTOR = ".run-details-tab-content a[href]";
  function frameElementOf(document2) {
    let element4 = document2.defaultView?.frameElement ?? null;
    return element4?.classList.contains(RUN_TAB_FRAME_CLASS) === !0 && "dataset" in element4 ? (
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- an HTML element of the parent window
      element4
    ) : null;
  }
  function reportMissingTab(document2, frame, view) {
    let views = runTabViewsIn(document2);
    if (views.length === 0)
      return;
    let isMissing = !views.includes(view);
    isMissing && frame.dataset.fixAdoMissingTab !== view ? frame.dataset.fixAdoMissingTab = view : !isMissing && frame.dataset.fixAdoMissingTab !== void 0 && delete frame.dataset.fixAdoMissingTab;
  }
  function openTabLinksApart(document2) {
    document2.addEventListener(
      "click",
      (event) => {
        let link = closestElement(event.target, TAB_CONTENT_LINK_SELECTOR);
        link?.setAttribute("target", "_blank"), link?.setAttribute("rel", "noopener");
      },
      { capture: !0 }
    );
  }
  function createRunTabFrame(document2, frame = frameElementOf(document2)) {
    let view = pipelineRunTabViewOf(document2.location);
    return frame === null || view === null || parsePipelineRunLocation(document2.location) === null ? null : (openTabLinksApart(document2), {
      sync: () => {
        document2.documentElement.dataset.fixAdoRunTabFrame = "", reportMissingTab(document2, frame, view);
      }
    });
  }

  // azure-devops/src/features/run-page-tabs/run-tab-elements.ts
  var TAB_CLASS2 = "fix-ado-run-tab", PANEL_CLASS2 = "fix-ado-run-tab-panel", MISSING_CLASS = "fix-ado-run-tab-missing";
  function setSelected2(tab, isSelected) {
    tab.classList.toggle("selected", isSelected), tab.setAttribute("aria-selected", String(isSelected));
  }
  function setAttribute(element4, name, value) {
    value === null ? element4.removeAttribute(name) : element4.getAttribute(name) !== value && element4.setAttribute(name, value);
  }
  function createTab2(document2, key) {
    let container = Object.assign(document2.createElement("span"), {
      className: "bolt-tab-inner-container"
    });
    container.append(Object.assign(document2.createElement("span"), { className: "bolt-tab-text" }));
    let tab = Object.assign(document2.createElement("a"), {
      className: `bolt-tab focus-treatment flex-noshrink ${TAB_CLASS2}`,
      href: "#",
      id: `fix-ado-run-tab-${key.replaceAll(/[^\w-]/gu, "-")}`
    });
    return tab.setAttribute("role", "tab"), tab.dataset.fixAdoOwnTab = "", tab.dataset.fixAdoRunTab = key, setSelected2(tab, !1), tab.append(container), tab;
  }
  function showTab(tab, { buildId, name, tab: runTab }) {
    let text = tab.querySelector(".bolt-tab-text");
    text !== null && text.textContent !== name && (text.textContent = name, text.dataset.content = name);
    let isDisabled = buildId === null;
    setAttribute(tab, "aria-disabled", isDisabled ? "true" : null), setAttribute(tab, "title", isDisabled ? `No run of ${runTab.pipelineName} yet` : null), tab.classList.toggle("fix-ado-run-tab-disabled", isDisabled);
  }
  function tabsFor(tablist, runTabs) {
    let existing = new Map(
      [...tablist.querySelectorAll(`.${TAB_CLASS2}`)].map((tab) => [
        tab.dataset.fixAdoRunTab ?? "",
        tab
      ])
    );
    for (let [key, tab] of existing)
      runTabs.some((runTab) => runTab.key === key) || tab.remove();
    return runTabs.map(
      (runTab) => existing.get(runTab.key) ?? createTab2(tablist.ownerDocument, runTab.key)
    );
  }
  function showTabs(tablist, runTabs) {
    let tabs = tabsFor(tablist, runTabs), tail = [...tablist.children].slice(-tabs.length);
    tabs.some((tab, index) => tail[index] !== tab) && tablist.append(...tabs);
    for (let [index, tab] of tabs.entries()) {
      let runTab = runTabs[index];
      runTab !== void 0 && showTab(tab, runTab);
    }
    return tabs;
  }
  function createPanel2(document2, tab) {
    let panel = Object.assign(document2.createElement("div"), { className: PANEL_CLASS2 });
    panel.setAttribute("role", "tabpanel"), panel.setAttribute("aria-labelledby", tab.id);
    let frame = Object.assign(document2.createElement("iframe"), { className: RUN_TAB_FRAME_CLASS }), note = Object.assign(document2.createElement("p"), {
      className: MISSING_CLASS,
      hidden: !0
    });
    return note.setAttribute("role", "status"), panel.append(frame, note), { frame, note, panel };
  }
  function panelPartsIn(page, tab) {
    let existing = page.querySelector(`:scope > .${PANEL_CLASS2}`), frame = existing?.querySelector(`.${RUN_TAB_FRAME_CLASS}`) ?? null, note = existing?.querySelector(`.${MISSING_CLASS}`) ?? null;
    if (existing !== null && frame !== null && note !== null)
      return setAttribute(existing, "aria-labelledby", tab.id), { frame, note };
    existing?.remove();
    let created = createPanel2(page.ownerDocument, tab);
    return page.querySelector(".repos-pr-details-page-tabbar")?.after(created.panel), created;
  }
  function showMissingNote({ frame, note }, runTab) {
    let isMissing = frame.dataset.fixAdoMissingTab === runTab.tab.view;
    frame.hidden = isMissing, note.hidden = !isMissing;
    let text = `This run has no ${runTab.tab.label} tab.`;
    note.textContent !== text && (note.textContent = text);
  }
  function showPanel(page, tab, { path, runTab }) {
    let { frame, note } = panelPartsIn(page, tab);
    setAttribute(frame, "title", runTab.name), frame.getAttribute("src") !== path && (delete frame.dataset.fixAdoMissingTab, frame.setAttribute("src", path)), showMissingNote({ frame, note }, runTab);
  }

  // azure-devops/src/features/run-page-tabs/pull-request-run-tabs-data.ts
  function pipelineIdOf(evaluation) {
    return evaluation.configuration.settings?.buildDefinitionId ?? evaluation.context?.buildDefinitionId ?? null;
  }
  function checkRunsByPipeline(evaluations) {
    let runs = /* @__PURE__ */ new Map();
    for (let evaluation of evaluations) {
      let pipelineId = pipelineIdOf(evaluation);
      if (evaluation.configuration.type.id === BUILD_POLICY_TYPE_ID && pipelineId !== null) {
        let buildId = evaluation.context?.buildId ?? 0;
        runs.set(pipelineId, buildId > 0 ? buildId : runs.get(pipelineId) ?? null);
      }
    }
    return runs;
  }
  function latestBuildId(pipelineId, checkRun, builds) {
    let ids = builds.filter((build) => build.definition?.id === pipelineId).map(({ id }) => id), all = checkRun === null ? ids : [...ids, checkRun];
    return all.length === 0 ? null : Math.max(...all);
  }
  function pullRequestRunTabsOf(tabs, evaluations, builds) {
    let checkRuns = checkRunsByPipeline(evaluations), shown = tabs.filter((tab) => checkRuns.has(tab.pipelineId));
    return shown.map((tab) => {
      let isLabelShared = shown.some((other) => other !== tab && other.label === tab.label);
      return {
        buildId: latestBuildId(tab.pipelineId, checkRuns.get(tab.pipelineId) ?? null, builds),
        key: `${tab.pipelineId}/${tab.view}`,
        name: isLabelShared ? `${tab.label} (${tab.pipelineName})` : tab.label,
        tab
      };
    });
  }

  // azure-devops/src/features/run-page-tabs/pull-request-run-tabs.ts
  var REFRESH_MS2 = 3e4, PAGE_SELECTOR2 = ".repos-pr-details-page", TABLIST_SELECTOR = ".repos-pr-details-page-tabbar [role=tablist]", OPEN_ATTRIBUTE2 = "data-fix-ado-run-tab-open";
  function runTabsOf({ data, options }) {
    return data?.evaluations === null || data === null ? [] : pullRequestRunTabsOf(options.loadRunTabs(), data.evaluations, data.builds);
  }
  function closeTab2(state) {
    let { document: document2 } = state.options;
    state.openKey = null;
    let page = document2.querySelector(PAGE_SELECTOR2);
    page?.removeAttribute(OPEN_ATTRIBUTE2), page?.querySelector(`:scope > .${PANEL_CLASS2}`)?.remove();
    for (let tab of document2.querySelectorAll(`.${TAB_CLASS2}[aria-selected="true"]`))
      setSelected2(tab, !1);
  }
  function showOpenTab(state, page, shown) {
    let index = shown.runTabs.findIndex(({ key }) => key === state.openKey), [runTab, tab] = [shown.runTabs[index], shown.tabs[index]], buildId = runTab?.buildId ?? null;
    if (state.data === null || runTab === void 0 || tab === void 0 || buildId === null) {
      closeTab2(state);
      return;
    }
    let { apiBasePath: apiBasePath2 } = state.options, runPath = pipelineRunPath(apiBasePath2, state.data.pullRequest.project, buildId);
    page.setAttribute(OPEN_ATTRIBUTE2, ""), showPanel(page, tab, { path: runTabPath(runPath, runTab.tab.view), runTab });
  }
  function render4(state) {
    let { document: document2 } = state.options, tablist = document2.querySelector(TABLIST_SELECTOR), page = document2.querySelector(PAGE_SELECTOR2);
    if (tablist === null || page === null || state.data === null)
      return;
    let runTabs = runTabsOf(state), tabs = showTabs(tablist, runTabs);
    state.openKey !== null && showOpenTab(state, page, { runTabs, tabs });
  }
  function openTab2(state, tab) {
    let { document: document2 } = state.options, selector = `${TABLIST_SELECTOR} [role=tab][aria-selected="true"]`;
    for (let other of document2.querySelectorAll(selector))
      setSelected2(other, !1);
    setSelected2(tab, !0), state.openKey = tab.dataset.fixAdoRunTab ?? null, render4(state);
  }
  function closeForOtherTab(state, other) {
    closeTab2(state), other.hasAttribute(OWN_TAB_ATTRIBUTE) || setSelected2(other, !0);
  }
  function onClick2(state, event) {
    let tab = closestHtmlElement(event.target, `.${TAB_CLASS2}`), other = closestElement(event.target, `${TABLIST_SELECTOR} [role=tab]`);
    if (tab === null) {
      state.openKey !== null && other !== null && closeForOtherTab(state, other);
      return;
    }
    event.preventDefault(), event.stopPropagation(), tab.getAttribute("aria-disabled") !== "true" && openTab2(state, tab);
  }
  async function loadChecksAndRuns(state, data) {
    let { options } = state;
    data.loadedAt = options.now();
    let { project, pullRequestId } = data.pullRequest;
    try {
      let [evaluations, builds] = await Promise.all([
        options.getEvaluations(data.pullRequest),
        options.getPullRequestBuilds(project, pullRequestId)
      ]);
      data.evaluations = evaluations, data.builds = builds;
    } catch {
    }
    state.data === data && render4(state);
  }
  function syncRunTabs(state, pullRequest, canFetch) {
    JSON.stringify(state.data?.pullRequest ?? null) !== JSON.stringify(pullRequest) && (closeTab2(state), state.data = pullRequest === null ? null : { builds: [], evaluations: null, loadedAt: Number.NEGATIVE_INFINITY, pullRequest });
    let { data, options } = state;
    if (data === null)
      return;
    let isDue = options.now() - data.loadedAt >= REFRESH_MS2;
    canFetch && isDue && options.loadRunTabs().length > 0 && loadChecksAndRuns(state, data), render4(state);
  }
  function createPullRequestRunTabs(options) {
    let state = { data: null, openKey: null, options };
    return options.document.addEventListener(
      "click",
      (event) => {
        onClick2(state, event);
      },
      { capture: !0 }
    ), {
      sync: (pullRequest, canFetch) => {
        syncRunTabs(state, pullRequest, canFetch);
      }
    };
  }

  // azure-devops/src/core/switch.ts
  var SWITCH_CLASS = "fix-ado-switch";
  function createPill(document2) {
    let pill = Object.assign(document2.createElement("span"), {
      className: `${SWITCH_CLASS}-pill`
    });
    return pill.setAttribute("aria-hidden", "true"), pill.append(Object.assign(document2.createElement("span"), { className: `${SWITCH_CLASS}-knob` })), pill;
  }
  function createSwitch(document2, label) {
    let toggle = Object.assign(document2.createElement("button"), {
      className: SWITCH_CLASS,
      type: "button"
    });
    toggle.setAttribute("role", "switch"), toggle.setAttribute("aria-checked", "false");
    let text = Object.assign(document2.createElement("span"), {
      className: `${SWITCH_CLASS}-text`,
      textContent: label
    });
    return toggle.append(createPill(document2), text), toggle;
  }
  function showSwitchOn(toggle, isOn2) {
    toggle.getAttribute("aria-checked") !== String(isOn2) && toggle.setAttribute("aria-checked", String(isOn2));
  }

  // azure-devops/src/features/run-page-tabs/run-tab-toggle.ts
  var TABBAR_SELECTOR3 = ".run-details-page > .bolt-tabbar", SELECTED_TAB_SELECTOR = '[role=tablist] [role=tab][aria-selected="true"]', TOGGLE_CLASS3 = "fix-ado-run-tab-toggle", LABEL2 = "Show this tab in pull requests", FAILED_TITLE = "Could not read this run's pipeline. Reload to try again.";
  function selectedRunTabOf(tabbar, lookup) {
    let selected = tabbar.querySelector(SELECTED_TAB_SELECTOR), view = selected === null ? null : runTabViewOf(selected);
    if (selected === null || view === null || lookup.kind !== "known")
      return null;
    let label = selected.querySelector(".bolt-tab-text")?.textContent.trim() ?? view, { id, name } = lookup.pipeline;
    return { label, pipelineId: id, pipelineName: name, view };
  }
  function createToggle(document2) {
    let toggle = createSwitch(document2, LABEL2);
    return toggle.classList.add(TOGGLE_CLASS3), toggle;
  }
  function flip(state, tabbar) {
    let tab = selectedRunTabOf(tabbar, state.lookup);
    if (tab === null)
      return;
    let { storage } = state.options, saved = storage.load(), others = saved.filter((other) => !isSameRunTab(other, tab));
    storage.save(others.length === saved.length ? [...saved, tab] : others);
  }
  function toggleIn(state, tabbar) {
    let existing = tabbar.querySelector(`:scope > .${TOGGLE_CLASS3}`);
    if (existing !== null)
      return existing;
    let toggle = createToggle(state.options.document);
    return toggle.addEventListener("click", () => {
      flip(state, tabbar), showToggleState(state, tabbar, toggle);
    }), tabbar.append(toggle), toggle;
  }
  function showToggleState(state, tabbar, toggle) {
    let tab = selectedRunTabOf(tabbar, state.lookup), isOn2 = tab !== null && state.options.storage.load().some((other) => isSameRunTab(other, tab));
    showSwitchOn(toggle, isOn2), toggle.disabled !== (tab === null) && (toggle.disabled = tab === null);
    let title = state.lookup.kind === "failed" ? FAILED_TITLE : "";
    toggle.title !== title && (toggle.title = title);
  }
  function lookUpPipeline(state, sync4) {
    let { document: document2, getBuildPipeline: getBuildPipeline2 } = state.options, run = parsePipelineRunLocation(document2.location), project = decodeURIComponent(
      document2.location.pathname.split("/_build/")[0]?.split("/").pop() ?? ""
    );
    state.lookup.kind !== "idle" || run === null || project === "" || (state.lookup = { kind: "reading" }, getBuildPipeline2(project, run.buildId).then(
      (pipeline) => {
        state.lookup = { kind: "known", pipeline }, sync4();
      },
      () => {
        state.lookup = { kind: "failed" }, sync4();
      }
    ));
  }
  function createRunTabToggle(options) {
    let state = { lookup: { kind: "idle" }, options }, sync4 = () => {
      let tabbar = options.document.querySelector(TABBAR_SELECTOR3);
      tabbar === null || tabbar.querySelector(SELECTED_TAB_SELECTOR) === null || (lookUpPipeline(state, sync4), showToggleState(state, tabbar, toggleIn(state, tabbar)));
    };
    return { sync: sync4 };
  }

  // azure-devops/src/features/run-page-tabs/style.css
  var style_default13 = `/* Run page tabs in pull requests. pull-request-run-tabs.ts sets the attribute while one is open. */
.repos-pr-details-page[data-fix-ado-run-tab-open]
  > :not(.repos-pr-header, .repos-pr-details-page-tabbar, .fix-ado-run-tab-panel) {
  display: none !important;
}

/* The panel takes what the header and tabs leave, so the tab's content reaches the bottom. */
.fix-ado-run-tab-panel {
  display: grid;
  flex: 1 0 0;
  min-height: 400px;
  padding-top: 16px;
}

.fix-ado-run-tab-frame,
.fix-ado-run-tab-missing {
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  border: 1px solid var(--palette-black-alpha-10, rgba(0, 0, 0, 0.1));
  border-radius: 4px;
}

.fix-ado-run-tab-frame[hidden],
.fix-ado-run-tab-missing[hidden] {
  display: none;
}

/* In place of a run page tab the run does not have: a page icon over a line of text. */
.fix-ado-run-tab-missing {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  margin: 0;
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));

  &::before {
    content: "";
    width: 48px;
    height: 48px;
    background-color: currentColor;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 1h5.5L13 4.5V15H3V1h1zm0 1v12h8V5H9V2H4zm6 .7V4h1.3L10 2.7zM5 7h6v1H5V7zm0 2h6v1H5V9zm0 2h4v1H5v-1z'/%3E%3C/svg%3E")
      center / contain no-repeat;
    forced-color-adjust: none;
  }
}

/* A tab whose pipeline has no run on the pull request yet: greyed, and it does nothing. */
.fix-ado-run-tab-disabled,
.fix-ado-run-tab-disabled .bolt-tab-text {
  color: var(--text-disabled-color, rgba(0, 0, 0, 0.38));
  cursor: default;
}

/* Azure DevOps shows a focus ring on its tabs only for keyboard focus. */
.fix-ado-run-tab:focus:not(:focus-visible) {
  outline: none;
}

/* The run page in a run page tab's frame. run-tab-frame.ts marks it; only the tab's content stays. */
html[data-fix-ado-run-tab-frame] .project-header,
html[data-fix-ado-run-tab-frame] .navigation-container,
html[data-fix-ado-run-tab-frame] .region-content-header,
html[data-fix-ado-run-tab-frame] .region-content-footer,
html[data-fix-ado-run-tab-frame] .region-footer,
html[data-fix-ado-run-tab-frame] .run-details-page > :not(.run-details-tab-content) {
  display: none !important;
}

/* "Show this tab in pull requests" at the right end of a run page's tab bar. core/switch.css
   styles the switch. */
.fix-ado-run-tab-toggle {
  margin: 0 20px 0 8px;
}
`;

  // azure-devops/src/core/switch.css
  var switch_default = `/* A switch like Azure DevOps's own. switch.ts builds it. Its own classes, as no capture
   holds the site's switch. Where it sits is up to the feature that adds it. */
.fix-ado-switch {
  display: flex;
  flex: none;
  gap: 8px;
  align-items: center;
  padding: 4px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--text-primary-color, rgba(0, 0, 0, 0.9));
  font: inherit;
  font-size: 14px;
  cursor: pointer;

  &:disabled {
    color: var(--text-disabled-color, rgba(0, 0, 0, 0.38));
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid var(--communication-background, rgb(0, 120, 212));
    outline-offset: 1px;
  }
}

.fix-ado-switch-pill {
  display: flex;
  flex: none;
  align-items: center;
  width: 40px;
  height: 20px;
  padding: 0 3px;
  border: 1px solid var(--text-secondary-color, rgba(0, 0, 0, 0.55));
  border-radius: 10px;
}

.fix-ado-switch-knob {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
  transition: translate 0.1s;
}

.fix-ado-switch[aria-checked="true"] .fix-ado-switch-pill {
  border-color: var(--communication-background, rgb(0, 120, 212));
  background: var(--communication-background, rgb(0, 120, 212));
}

.fix-ado-switch[aria-checked="true"] .fix-ado-switch-knob {
  background: #fff;
  translate: 20px 0;
}

.fix-ado-switch:disabled .fix-ado-switch-pill {
  border-color: currentColor;
}

.fix-ado-switch:disabled .fix-ado-switch-knob {
  background: currentColor;
}

@media (prefers-reduced-motion: reduce) {
  .fix-ado-switch-knob {
    transition: none;
  }
}

/* Forced colors drop backgrounds, so the knob and the on state keep a border. */
@media (forced-colors: active) {
  .fix-ado-switch-knob {
    border: 1px solid CanvasText;
  }

  .fix-ado-switch[aria-checked="true"] .fix-ado-switch-pill {
    border-color: Highlight;
  }
}
`;

  // azure-devops/src/features/run-page-tabs/index.ts
  var RUN_TABS_KEY = "run-page-tabs", runTabStorage = {
    load: () => GM_getValue(RUN_TABS_KEY, []),
    save: (tabs) => {
      GM_setValue(RUN_TABS_KEY, tabs);
    }
  }, runPageTabs = {
    change: { kind: "new", version: "1.20.0" },
    description: "A switch on each tab of a pipeline run page, such as Code Coverage, that shows that tab of the pipeline's latest run as a tab on its pull requests.",
    id: "run-page-tabs",
    name: "Run page tabs in pull requests",
    start({ basePath: basePath2, client, document: document2, isInFrame: isInFrame2, now }) {
      if (isInFrame2) {
        let frame = createRunTabFrame(document2);
        return frame === null ? null : { sync: frame.sync };
      }
      let toggle = createRunTabToggle({
        document: document2,
        getBuildPipeline: async (project, buildId) => client.getBuildPipeline(project, buildId),
        storage: runTabStorage
      }), tabs = createPullRequestRunTabs({
        apiBasePath: basePath2,
        document: document2,
        getEvaluations: async (pullRequest) => {
          let { evaluations } = await client.getPolicyEvaluations(pullRequest);
          return evaluations;
        },
        getPullRequestBuilds: async (project, pullRequestId) => {
          let { builds } = await client.getPullRequestBuilds(project, pullRequestId);
          return builds;
        },
        loadRunTabs: runTabStorage.load,
        now
      });
      return {
        sync({ isTabActive: isTabActive2, page }) {
          toggle.sync(), tabs.sync(pullRequestOf(page), isTabActive2);
        }
      };
    },
    styles: [switch_default, style_default13]
  };

  // azure-devops/src/features/starred-reviewers/starred-reviewers-markup.ts
  var STARRED_SECTION_CLASS = "fix-ado-starred-reviewers", STAR_BUTTON_CLASS = "fix-ado-star", STAR_PATH = "M8 1.6l1.95 4.02 4.43.58-3.24 3.07.82 4.4L8 11.53l-3.96 2.14.82-4.4L1.62 6.2l4.43-.58z", REQUIRED_RING_PATH = "M8 1.75a6.25 6.25 0 1 0 0 12.5a6.25 6.25 0 1 0 0-12.5z", PLUS_PATH = "M8 5v6M5 8h6", SVG_NAMESPACE6 = "http://www.w3.org/2000/svg";
  function element2(document2, tag, { className, text, attributes = {}, children = [] } = {}) {
    let created = document2.createElement(tag);
    className !== void 0 && (created.className = className), text !== void 0 && (created.textContent = text);
    for (let [name, value] of Object.entries(attributes))
      created.setAttribute(name, value);
    return created.append(...children), created;
  }
  function fontIcon(document2, name, size) {
    return element2(document2, "span", {
      children: [
        element2(document2, "span", {
          attributes: { "aria-hidden": "true" },
          className: `left-icon flex-noshrink fabric-icon ms-Icon--${name} ${size}`
        })
      ],
      className: "fluent-icons-enabled"
    });
  }
  function svgIcon(document2, className, pathData) {
    let svg = document2.createElementNS(SVG_NAMESPACE6, "svg"), attributes = {
      "aria-hidden": "true",
      class: className,
      height: "16",
      viewBox: "0 0 16 16",
      width: "16"
    };
    for (let [name, value] of Object.entries(attributes))
      svg.setAttribute(name, value);
    for (let data of pathData) {
      let path = document2.createElementNS(SVG_NAMESPACE6, "path");
      path.setAttribute("d", data), svg.append(path);
    }
    return svg;
  }
  function createSpinner(document2) {
    return element2(document2, "span", {
      attributes: { "aria-hidden": "true" },
      className: "fix-ado-spinner"
    });
  }
  function createStarButton(document2) {
    return element2(document2, "button", {
      // One name; aria-pressed says whether the reviewer is starred.
      attributes: { "aria-label": "Starred", "aria-pressed": "false", type: "button" },
      children: [svgIcon(document2, "fix-ado-star-icon", [STAR_PATH])],
      className: `${STAR_BUTTON_CLASS} bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment`
    });
  }
  function updateStarButton(button2, isStarred) {
    button2.getAttribute("aria-pressed") !== String(isStarred) && (button2.setAttribute("aria-pressed", String(isStarred)), button2.setAttribute("title", isStarred ? "Remove from starred" : "Add to starred"));
  }
  function detailOf(identity) {
    return identity.isGroup ? "Group" : identity.signInAddress;
  }
  function createRequiredButton(document2, identity) {
    return element2(document2, "button", {
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
    let name = element2(document2, "div", {
      className: "body-m flex-grow text-ellipsis",
      text: identity.displayName
    }), detail = element2(document2, "div", {
      className: "fix-ado-starred-detail body-s secondary-text text-ellipsis",
      text: detailOf(identity)
    });
    return element2(document2, "div", {
      children: [name, detail],
      className: "flex-column flex-grow text-ellipsis icon-large-margin"
    });
  }
  function createAddSplitButton(document2, identity) {
    return element2(document2, "div", {
      children: [
        element2(document2, "button", {
          attributes: {
            "aria-label": `Add ${identity.displayName} as optional reviewer`,
            "data-fix-ado-add": "optional",
            title: "Add as optional reviewer",
            type: "button"
          },
          children: [fontIcon(document2, "Add", "small")],
          className: "bolt-split-button-main bolt-button bolt-icon-button enabled icon-only bolt-focus-treatment"
        }),
        element2(document2, "div", { className: "bolt-split-button-divider flex-noshrink" }),
        element2(document2, "div", {
          children: [createRequiredButton(document2, identity)],
          className: "inline-flex-row"
        })
      ],
      className: "fix-ado-add-reviewer bolt-split-button inline-flex-row flex-noshrink icon-large-margin"
    });
  }
  function createAvatar(document2, identity, imageUrl) {
    return element2(document2, "div", {
      children: [
        element2(document2, "div", {
          attributes: { "aria-label": identity.displayName },
          children: [
            element2(document2, "img", {
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
    return updateStarButton(star, !0), element2(document2, "div", {
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
    return element2(document2, "div", {
      className: "repos-pr-no-items-well fix-ado-starred-empty",
      text: EMPTY_TEXT
    });
  }
  function createStarSomeoneButton(document2) {
    return element2(document2, "button", {
      attributes: { type: "button" },
      children: [
        fontIcon(document2, "Add", "small"),
        element2(document2, "span", {
          className: "bolt-button-text body-s",
          text: "Add person/group to starred"
        })
      ],
      className: "fix-ado-star-someone bolt-button subtle enabled bolt-focus-treatment"
    });
  }
  function createStarredSection(document2) {
    return element2(document2, "div", {
      children: [
        element2(document2, "div", {
          className: "margin-bottom-8 body-s secondary-text font-weight-semibold",
          text: "Add starred as reviewer"
        }),
        element2(document2, "div", { className: "fix-ado-starred-list flex-column" }),
        createStarSomeoneButton(document2)
      ],
      className: `flex-grow flex-column ${STARRED_SECTION_CLASS}`
    });
  }
  function showAdding(document2, row) {
    for (let button2 of row.querySelectorAll("[data-fix-ado-add]"))
      button2.classList.replace("enabled", "disabled"), button2.setAttribute("aria-disabled", "true");
    let addButton = row.querySelector(".fix-ado-add-reviewer");
    addButton?.classList.add("fix-ado-adding"), addButton?.append(createSpinner(document2));
  }
  function showError(row, error) {
    let detail = row.querySelector(".fix-ado-starred-detail");
    detail !== null && (detail.textContent = error, detail.classList.replace("secondary-text", "error-text"), detail.setAttribute("role", "alert"));
  }

  // azure-devops/src/features/starred-reviewers/starred-reviewer-chips-markup.ts
  var STARRED_CHIP_ROW_CLASS = "fix-ado-starred-chips", STARRED_CHIP_CLASS = "fix-ado-starred-chip";
  function createStarredChip(document2, identity, imageUrl) {
    let name = personOrTeamName(identity.displayName), image = element2(document2, "img", {
      attributes: { alt: "", src: imageUrl },
      className: "bolt-coin-content using-image size20"
    });
    return element2(document2, "button", {
      attributes: {
        "aria-label": `Add ${name} as reviewer`,
        "data-fix-ado-identity": identity.id,
        title: "Add as reviewer",
        type: "button"
      },
      children: [
        element2(document2, "div", {
          children: [
            element2(document2, "div", {
              attributes: { "aria-hidden": "true" },
              children: [image],
              className: "bolt-coin flex-noshrink flex-row flex-center size20"
            })
          ],
          className: "bolt-pill-filled-visual flex-noshrink"
        }),
        element2(document2, "div", { className: "bolt-pill-content text-ellipsis", text: name })
      ],
      className: `${STARRED_CHIP_CLASS} bolt-pill flex-row flex-center standard regular clickable has-filled-visual`
    });
  }
  var NOT_FOUND_TEXT = "Not found in the reviewer field's suggestions. Pick them there.";
  function markNotFound(chip) {
    chip.setAttribute("title", NOT_FOUND_TEXT), chip.setAttribute("aria-description", NOT_FOUND_TEXT);
  }
  function showChipSpinner(document2, chip) {
    chip.querySelector(".bolt-pill-filled-visual")?.replaceChildren(createSpinner(document2));
  }
  function createStarredChipRow(document2) {
    return element2(document2, "div", {
      attributes: { "aria-label": "Starred reviewers", role: "group" },
      children: [
        svgIcon(document2, "fix-ado-starred-chips-icon fix-ado-star-icon", [STAR_PATH]),
        element2(document2, "div", { className: "fix-ado-starred-chip-list flex-row flex-wrap" })
      ],
      className: `${STARRED_CHIP_ROW_CLASS} flex-row flex-center`
    });
  }

  // azure-devops/src/features/starred-reviewers/starred-reviewers-store.ts
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

  // azure-devops/src/features/starred-reviewers/reviewer-field.ts
  var FIELD_LABEL_IDS = [
    "__bolt-pr-optional-reviewers-label",
    "__bolt-pr-required-reviewers-label"
  ];
  function reviewerFields(document2) {
    let fields = [];
    for (let labelId of FIELD_LABEL_IDS) {
      let column = document2.querySelector(`#${labelId}`)?.parentElement?.parentElement, input = column?.querySelector(`input[aria-labelledby="${labelId}"]`);
      column != null && input !== null && input !== void 0 && fields.push({ column, input });
    }
    return fields;
  }
  function namesInFields(document2) {
    return [...document2.querySelectorAll(".bolt-identity-picker-pill .bolt-pill-content")].map(
      (pill) => pill.textContent?.trim() ?? ""
    );
  }
  function typeInto(input, text) {
    input.focus();
    let pageWindow = input.ownerDocument.defaultView;
    Reflect.set((pageWindow?.HTMLInputElement ?? HTMLInputElement).prototype, "value", text, input);
    let EventOfPage = pageWindow?.Event ?? Event;
    input.dispatchEvent(new EventOfPage("input", { bubbles: !0 }));
  }
  function isSuggestionOf(option, identity) {
    let name = option.querySelector(".bolt-picker-persona-name > :first-child")?.textContent ?? "", detail = option.querySelector(".bolt-picker-persona-name .secondary-text")?.textContent, address = identity.signInAddress.toLowerCase();
    return address === "" ? isNameOf(identity, name) : detail?.trim().toLowerCase() === address;
  }
  function findSuggestion(document2, input, identity) {
    let listboxId = input.getAttribute("aria-controls");
    return [...(listboxId === null ? null : document2.querySelector(`[id="${listboxId}"]`))?.querySelectorAll('[role="option"]') ?? []].find(
      (candidate) => isSuggestionOf(candidate, identity)
    ) ?? null;
  }
  function isInField(document2, identity) {
    return namesInFields(document2).some((name) => isNameOf(identity, name));
  }
  function pressMouseOn(element4) {
    let pageWindow = element4.ownerDocument.defaultView, MouseEventOfPage = pageWindow?.MouseEvent ?? MouseEvent, PointerEventOfPage = pageWindow?.PointerEvent ?? MouseEventOfPage, init = { bubbles: !0, button: 0, cancelable: !0, composed: !0 };
    element4.dispatchEvent(new PointerEventOfPage("pointerdown", init)), element4.dispatchEvent(new MouseEventOfPage("mousedown", init)), element4.dispatchEvent(new PointerEventOfPage("pointerup", init)), element4.dispatchEvent(new MouseEventOfPage("mouseup", init)), element4.dispatchEvent(new MouseEventOfPage("click", init));
  }
  function pressEnterIn(input) {
    let KeyboardEventOfPage = input.ownerDocument.defaultView?.KeyboardEvent ?? KeyboardEvent, init = { bubbles: !0, cancelable: !0, code: "Enter", key: "Enter", keyCode: 13 };
    input.dispatchEvent(new KeyboardEventOfPage("keydown", init)), input.dispatchEvent(new KeyboardEventOfPage("keyup", init));
  }

  // azure-devops/src/core/next-dom-change.ts
  function stopNothing() {
  }
  function onNextDomChange(document2, callback) {
    let view = document2.defaultView;
    if (view === null)
      return stopNothing;
    let observer = new view.MutationObserver(() => {
      observer.disconnect(), callback();
    });
    return observer.observe(document2, {
      attributes: !0,
      characterData: !0,
      childList: !0,
      subtree: !0
    }), () => {
      observer.disconnect();
    };
  }

  // azure-devops/src/features/starred-reviewers/starred-reviewer-chips.ts
  var STEP_WAIT_MS = 250, PICK_TIMEOUT_MS = 5e3, PICKING_CLASS = "fix-ado-starred-picking";
  function searchTextOf(identity) {
    return identity.signInAddress === "" ? personOrTeamName(identity.displayName) : identity.signInAddress;
  }
  function isActive(state, { pickId }) {
    return state.activePick?.pickId === pickId;
  }
  function finishPick(state, pendingPick, isPicked) {
    isActive(state, pendingPick) && (log("Starred reviewers: chip pick finished", { isPicked }), isPicked || state.notFoundIds.add(pendingPick.identity.id), state.activePick = null, sync(state));
  }
  function runStep(state, pendingPick, step) {
    if (isActive(state, pendingPick))
      try {
        step();
      } catch (error) {
        log("Starred reviewers: chip pick failed", {
          message: error instanceof Error ? error.message : "unknown error"
        }), finishPick(state, pendingPick, !1);
      }
  }
  function nextStep(pendingPick, suggestion) {
    if (pendingPick.step === "waiting")
      return pressMouseOn(suggestion.querySelector(".bolt-suggestions-item") ?? suggestion), "clicked";
    let { input } = pendingPick.field;
    return pendingPick.step === "clicked" && input.getAttribute("aria-activedescendant") === suggestion.id ? (pressEnterIn(input), "entered") : null;
  }
  function takeNextStep(state, pendingPick) {
    let suggestion = findSuggestion(
      state.options.document,
      pendingPick.field.input,
      pendingPick.identity
    ), step = suggestion === null ? pendingPick.step : nextStep(pendingPick, suggestion);
    return log("Starred reviewers: chip pick", {
      from: pendingPick.step,
      hasSuggestion: suggestion !== null,
      to: step
    }), step;
  }
  function waitForNextStep(state, pendingPick) {
    let { document: document2, onNextDomChange: onNextDomChange2, schedule: schedule2 } = state.options;
    if (isInField(document2, pendingPick.identity)) {
      finishPick(state, pendingPick, !0);
      return;
    }
    let stopWatching = stopNothing, stopTimer = stopNothing, check2 = (isLastCheck) => {
      runStep(state, pendingPick, () => {
        let isPicked = isInField(document2, pendingPick.identity), step = isPicked ? pendingPick.step : takeNextStep(state, pendingPick);
        isPicked || step !== null && (step !== pendingPick.step || isLastCheck) ? (stopTimer(), waitForNextStep(state, { ...pendingPick, step: step ?? pendingPick.step })) : isLastCheck ? finishPick(state, pendingPick, !1) : stopWatching = onNextDomChange2(() => {
          check2(!1);
        });
      });
    };
    stopWatching = onNextDomChange2(() => {
      check2(!1);
    }), stopTimer = schedule2(() => {
      stopTimer = stopNothing, stopWatching(), check2(!0);
    }, STEP_WAIT_MS);
  }
  function addThroughField(state, field, identity) {
    if (state.activePick !== null)
      return;
    let { schedule: schedule2 } = state.options, pendingPick = { field, identity, pickId: state.nextPickId, step: "waiting" };
    state.nextPickId += 1, state.activePick = { identityId: identity.id, pickId: pendingPick.pickId }, state.notFoundIds.delete(identity.id), sync(state), schedule2(() => {
      isActive(state, pendingPick) && (log("Starred reviewers: chip pick timed out"), finishPick(state, pendingPick, !1));
    }, PICK_TIMEOUT_MS), runStep(state, pendingPick, () => {
      typeInto(field.input, searchTextOf(identity)), waitForNextStep(state, pendingPick);
    });
  }
  function onRowClick(state, field, event) {
    let id = closestHtmlElement(event.target, `.${STARRED_CHIP_CLASS}`)?.dataset.fixAdoIdentity, identity = state.options.store.list().find((starred) => starred.id === id);
    identity !== void 0 && addThroughField(state, field, identity);
  }
  function createChip3(state, identity) {
    let { document: document2, imageUrlOf } = state.options, chip = createStarredChip(document2, identity, imageUrlOf(identity));
    return state.activePick !== null && (chip.setAttribute("disabled", ""), chip.classList.remove("clickable")), state.activePick?.identityId === identity.id && showChipSpinner(document2, chip), state.notFoundIds.has(identity.id) && markNotFound(chip), chip;
  }
  function placeRow(state, field) {
    let row = field.column.querySelector(`:scope > .${STARRED_CHIP_ROW_CLASS}`);
    return row === null && (row = createStarredChipRow(state.options.document), row.addEventListener("click", (event) => {
      onRowClick(state, field, event);
    })), field.column.lastElementChild !== row && field.column.append(row), row;
  }
  function fillRow(state, field, shown) {
    if (shown.length === 0) {
      field.column.querySelector(`:scope > .${STARRED_CHIP_ROW_CLASS}`)?.remove();
      return;
    }
    let list = placeRow(state, field).querySelector(".fix-ado-starred-chip-list"), signature = JSON.stringify([
      state.activePick?.identityId,
      shown.map(({ id }) => [id, state.notFoundIds.has(id)])
    ]);
    list !== null && list.dataset.fixAdoSignature !== signature && (list.dataset.fixAdoSignature = signature, list.replaceChildren(...shown.map((identity) => createChip3(state, identity))));
  }
  function removeChipRows(document2) {
    for (let row of document2.querySelectorAll(`.${STARRED_CHIP_ROW_CLASS}`))
      row.remove();
  }
  function sync(state) {
    let { document: document2, store } = state.options, fields = reviewerFields(document2);
    if (document2.body.classList.toggle(PICKING_CLASS, state.isCreatePage && state.activePick !== null), !state.isCreatePage) {
      removeChipRows(document2);
      return;
    }
    let names = namesInFields(document2), shown = store.list().filter((identity) => !names.some((name) => isNameOf(identity, name)));
    for (let field of fields)
      fillRow(state, field, shown);
  }
  function createStarredReviewerChips(options) {
    let state = {
      activePick: null,
      isCreatePage: !1,
      nextPickId: 1,
      notFoundIds: /* @__PURE__ */ new Set(),
      options
    };
    return {
      sync(isCreatePage) {
        state.isCreatePage = isCreatePage, sync(state);
      }
    };
  }

  // azure-devops/src/features/starred-reviewers/reviewer-stars.ts
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
  function reviewerRowOf(document2, identity) {
    return reviewerRowsOf(document2).find((row) => isNameOf(identity, nameOfRow(row)));
  }
  function isOnPage(document2, identity) {
    return reviewerRowOf(document2, identity) !== void 0;
  }
  function logShown(row) {
    log("Starred reviewers: added reviewer shown", {
      hasBox: row.getClientRects().length > 0,
      isHidden: row.closest("[hidden], [aria-hidden='true']") !== null,
      section: row.parentElement?.className ?? ""
    });
  }
  function insertStar(document2, row, onClick3) {
    let star = createStarButton(document2);
    star.addEventListener("click", (event) => {
      event.stopPropagation(), onClick3();
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

  // azure-devops/src/features/starred-reviewers/star-picker.ts
  var SEARCH_DELAY_MS = 300, SUGGESTED_CLASS = "bolt-suggestions-isSuggested", LIST_ID = "fix-ado-star-picker-list";
  function div(className) {
    return { className, tag: "div" };
  }
  function createPersonaName(document2, identity) {
    let detail = element2(document2, "div", {
      className: "fontSize secondary-text text-ellipsis",
      text: detailOf(identity)
    });
    return element2(document2, "div", {
      children: [
        element2(document2, "div", {
          className: "fontSizeM text-ellipsis",
          text: identity.displayName
        }),
        element2(document2, "div", { children: [detail], className: "flex-row" })
      ],
      className: "bolt-picker-persona-name flex-column flex-grow"
    });
  }
  function createSuggestion(options, identity, index) {
    let { document: document2 } = options, text = element2(document2, "div", {
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
    }), element2(document2, "div", {
      attributes: { "aria-selected": "false", id: `${LIST_ID}-${index}`, role: "option" },
      children: [item],
      className: "flex-noshrink"
    });
  }
  function createNoResults(document2) {
    let text = element2(document2, "div", {
      className: "bolt-identitypickerdropdown-noresults flex-row flex-grow flex-center",
      text: "No identities found"
    });
    return element2(document2, "div", {
      attributes: { role: "status" },
      children: [text],
      className: "bolt-suggestions-none-region flex-row flex-grow"
    });
  }
  function createCallout(document2) {
    let list = element2(document2, "div", {
      attributes: { id: LIST_ID, role: "listbox" },
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
    return input.className = "bolt-textfield-input flex-grow bolt-textfield-input-with-prefix", input.type = "text", input.placeholder = "Search people and groups", input.setAttribute("role", "combobox"), input.setAttribute("aria-label", "Search people and groups to star"), input.setAttribute("aria-autocomplete", "list"), input.setAttribute("aria-expanded", "false"), input.setAttribute("aria-controls", LIST_ID), input;
  }
  function createField(document2) {
    let input = createSearchInput(document2), prefix = fontIcon(document2, "Contact", "medium");
    return prefix.firstElementChild?.classList.add("prefix", "bolt-textfield-no-text"), { field: element2(document2, "div", {
      children: [prefix, input],
      className: "repos-reviewers-identity-picker bolt-identitypickerdropdown-textField flex-row flex-center bolt-textfield focus-treatment focused"
    }), input };
  }
  function setExpanded({ callout, input }, isExpanded) {
    callout.hidden = !isExpanded, input.setAttribute("aria-expanded", String(isExpanded)), input.removeAttribute("aria-activedescendant");
  }
  function showFound(parts, found) {
    let { options, list } = parts, unstarred = found.filter(({ id }) => !options.isStarred(id));
    unstarred.length > 0 ? list.setAttribute("role", "listbox") : list.removeAttribute("role"), list.replaceChildren(
      ...unstarred.length === 0 ? [createNoResults(options.document)] : unstarred.map((identity, index) => createSuggestion(options, identity, index))
    ), setExpanded(parts, !0);
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
      setExpanded(parts, !1);
      return;
    }
    parts.cancelSearch = parts.options.schedule(() => {
      search(parts, query);
    }, SEARCH_DELAY_MS);
  }
  function moveSuggestion({ input, list }, step) {
    let options = [...list.querySelectorAll('[role="option"]')], current = options.findIndex((option) => option.getAttribute("aria-selected") === "true"), next = Math.min(Math.max(current + step, 0), options.length - 1);
    for (let [index, option] of options.entries())
      option.setAttribute("aria-selected", String(index === next)), option.querySelector(".bolt-suggestions-item")?.classList.toggle(SUGGESTED_CLASS, index === next);
    let nextOption = options[next];
    nextOption !== void 0 && input.setAttribute("aria-activedescendant", nextOption.id);
  }
  function onKeyDown(parts, event) {
    event.key === "Escape" ? parts.options.onClose() : event.key === "ArrowDown" || event.key === "ArrowUp" ? (event.preventDefault(), moveSuggestion(parts, event.key === "ArrowDown" ? 1 : -1)) : event.key === "Enter" && !event.isComposing && (event.preventDefault(), parts.list.querySelector(`.${SUGGESTED_CLASS}`)?.click());
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
    return { element: element2(document2, "div", {
      children: [dropdown, callout],
      className: "fix-ado-star-picker margin-bottom-8"
    }), input };
  }

  // azure-devops/src/features/starred-reviewers/starred-list-focus.ts
  var ROW_ATTRIBUTE = "data-fix-ado-identity", STAR_SOMEONE_SELECTOR = ".fix-ado-star-someone";
  function buttonSelectorOf(control) {
    let add = control.closest("[data-fix-ado-add]")?.dataset.fixAdoAdd;
    return add !== void 0 ? `[data-fix-ado-add="${add}"]` : control.closest(".fix-ado-star") === null ? null : ".fix-ado-star";
  }
  function rowsFromFocused(list) {
    let row = list.ownerDocument.activeElement?.closest(`[${ROW_ATTRIBUTE}]`) ?? null;
    if (row === null || !list.contains(row))
      return [];
    let ids = [...list.querySelectorAll(`[${ROW_ATTRIBUTE}]`)].map(
      (candidate) => candidate.getAttribute(ROW_ATTRIBUTE) ?? ""
    );
    return ids.slice(ids.indexOf(row.getAttribute(ROW_ATTRIBUTE) ?? ""));
  }
  function keepListFocus(list) {
    let { activeElement } = list.ownerDocument, selector = activeElement === null ? null : buttonSelectorOf(activeElement), nearest = selector === null ? [] : rowsFromFocused(list);
    return () => {
      if (nearest.length === 0)
        return;
      (nearest.map(
        (id) => list.querySelector(`[${ROW_ATTRIBUTE}="${id}"] ${selector ?? ""}`)
      ).find((button2) => button2 !== null) ?? list.ownerDocument.querySelector(STAR_SOMEONE_SELECTOR))?.focus();
    };
  }

  // azure-devops/src/features/starred-reviewers/starred-reviewers.ts
  var ADDED_REVIEWER_WAIT_MS = 4e3;
  function messageOf(error) {
    return error instanceof Error ? error.message : "unknown error";
  }
  async function toggleStar(state, row) {
    let { store, client } = state.options, name = nameOfRow(row), starred = store.findByName(name);
    if (starred !== null)
      store.unstar(starred.id);
    else if (state.pullRequest !== null) {
      let reviewer = (await client.getPullRequestReviewers(state.pullRequest)).find((identity) => isNameOf(identity, name));
      reviewer !== void 0 && store.star(reviewer);
    }
    sync2(state);
  }
  function waitUntilShown(state, identity) {
    let { document: document2, schedule: schedule2, reload } = state.options;
    log("Starred reviewers: reviewer added, waiting for Azure DevOps to show them"), state.addedIds.add(identity.id), schedule2(() => {
      isOnPage(document2, identity) || reload();
    }, ADDED_REVIEWER_WAIT_MS);
  }
  function markBusy(state, id, isBusy2) {
    isBusy2 ? (state.busyIds.add(id), state.errorsById.delete(id)) : state.busyIds.delete(id), sync2(state);
  }
  async function addReviewer(state, identity, isRequired) {
    let { pullRequest } = state;
    if (!(pullRequest === null || state.busyIds.has(identity.id))) {
      markBusy(state, identity.id, !0);
      try {
        await state.options.client.addPullRequestReviewer(pullRequest, {
          isRequired,
          reviewerId: identity.id
        }), waitUntilShown(state, identity);
      } catch (error) {
        state.errorsById.set(identity.id, `Could not add: ${messageOf(error)}`);
      } finally {
        markBusy(state, identity.id, !1);
      }
    }
  }
  function openPicker(state, opener) {
    let { document: document2, store, client, imageUrlOf, schedule: schedule2 } = state.options, close = null, picker = createStarPicker({
      document: document2,
      imageUrlOf,
      isStarred: (id) => store.isStarred(id),
      onClose: () => {
        close?.();
      },
      onPick: (identity) => {
        store.star(identity), close?.(), sync2(state);
      },
      schedule: schedule2,
      search: async (query) => client.searchIdentities(query)
    });
    close = () => {
      close = null;
      let hadFocus = picker.element.contains(document2.activeElement);
      picker.element.remove(), opener.hidden = !1, hadFocus && opener.focus();
    }, opener.hidden = !0, opener.before(picker.element), picker.input.focus();
  }
  function identityOfRow(state, target) {
    let id = closestHtmlElement(target, "[data-fix-ado-identity]")?.dataset.fixAdoIdentity;
    return state.options.store.list().find((identity) => identity.id === id) ?? null;
  }
  function onRowButton(state, button2, identity) {
    button2.getAttribute("aria-disabled") !== "true" && (button2.classList.contains(STAR_BUTTON_CLASS) ? (state.options.store.unstar(identity.id), sync2(state)) : addReviewer(state, identity, button2.dataset.fixAdoAdd === "required"));
  }
  function onSectionClick(state, event) {
    let opener = closestHtmlElement(event.target, ".fix-ado-star-someone");
    if (opener !== null) {
      openPicker(state, opener);
      return;
    }
    let identity = identityOfRow(state, event.target), button2 = closestHtmlElement(event.target, `[data-fix-ado-add], .${STAR_BUTTON_CLASS}`);
    identity !== null && button2 !== null && onRowButton(state, button2, identity);
  }
  function placeSection(state, anchor) {
    let { document: document2 } = state.options, section = document2.querySelector(`.${STARRED_SECTION_CLASS}`);
    return section === null && (section = createStarredSection(document2), section.addEventListener("click", (event) => {
      onSectionClick(state, event);
    })), anchor.nextElementSibling !== section && anchor.after(section), section;
  }
  function createShownRow(state, identity) {
    let { document: document2, imageUrlOf } = state.options, row = createStarredRow(document2, identity, imageUrlOf(identity));
    (state.busyIds.has(identity.id) || state.addedIds.has(identity.id)) && showAdding(document2, row);
    let error = state.errorsById.get(identity.id);
    return error !== void 0 && showError(row, error), row;
  }
  function shownIdentities(state, starred) {
    let { document: document2 } = state.options;
    for (let identity of starred) {
      let row = state.addedIds.has(identity.id) ? reviewerRowOf(document2, identity) : void 0;
      row !== void 0 && (logShown(row), state.addedIds.delete(identity.id));
    }
    return starred.filter((identity) => !isOnPage(document2, identity));
  }
  function fillList(state, section) {
    let list = section.querySelector(".fix-ado-starred-list"), starred = state.options.store.list(), shown = shownIdentities(state, starred), signature = JSON.stringify([
      starred.length,
      shown.map(({ id }) => [
        id,
        state.busyIds.has(id) || state.addedIds.has(id),
        state.errorsById.get(id) ?? ""
      ])
    ]);
    if (list === null || list.dataset.fixAdoSignature === signature)
      return;
    list.dataset.fixAdoSignature = signature;
    let restoreFocus = keepListFocus(list);
    list.replaceChildren(
      ...starred.length === 0 ? [createEmptyWell(state.options.document)] : shown.map((identity) => createShownRow(state, identity))
    ), restoreFocus();
  }
  function sync2(state) {
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
        state.pullRequest = pullRequest, sync2(state);
      }
    };
  }

  // azure-devops/src/features/starred-reviewers/style.css
  var style_default14 = `/* Starred reviewers: a star on each reviewer row, shown on hover or when starred.
   Hidden by opacity, not visibility, so the keyboard can still reach it. */
.repos-reviewer > .fix-ado-star {
  opacity: 0;
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
  padding: 4px;
}
.repos-reviewer:hover > .fix-ado-star,
.repos-reviewer.focused > .fix-ado-star,
.repos-reviewer > .fix-ado-star:focus-visible,
.repos-reviewer > .fix-ado-star[aria-pressed="true"] {
  opacity: 1;
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
/* While a + button adds its reviewer: a spinner on top, the buttons hidden but in place, so the row keeps its size. */
.fix-ado-add-reviewer.fix-ado-adding {
  position: relative;
}
.fix-ado-adding > :not(.fix-ado-spinner) {
  visibility: hidden;
}
.fix-ado-adding > .fix-ado-spinner {
  position: absolute;
  inset: 0;
  width: 16px;
  height: 16px;
  margin: auto;
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

/* On the create pull request page: a chip per starred reviewer under each reviewer field. */
.fix-ado-starred-chips {
  gap: 8px;
  align-items: flex-start;
}
.fix-ado-starred-chips-icon {
  flex-shrink: 0;
  margin-top: 6px;
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
}
.fix-ado-starred-chip-list {
  gap: 4px;
}
.fix-ado-starred-chip[disabled] {
  cursor: progress;
}
.fix-ado-spinner {
  display: block;
  box-sizing: border-box;
  width: 20px;
  height: 20px;
  border: 2px solid var(--palette-black-alpha-10, rgba(128, 128, 128, 0.3));
  border-top-color: var(--communication-foreground, rgba(0, 90, 158, 1));
  border-radius: 50%;
  animation: fix-ado-spin 0.8s linear infinite;
}
@keyframes fix-ado-spin {
  to {
    transform: rotate(360deg);
  }
}
/* Slower, not stopped, so the row still looks busy. */
@media (prefers-reduced-motion: reduce) {
  .fix-ado-spinner {
    animation-duration: 4s;
  }
}
/* While a chip picks its reviewer: the field's dropdown and typed text stay out of sight.
   Hidden, not removed, so the chip can still press the suggestion; the field keeps its focus. */
.fix-ado-starred-picking #__bolt-tag-picker-callout {
  visibility: hidden;
}
.fix-ado-starred-picking .bolt-tag-picker-input {
  color: transparent;
  caret-color: transparent;
}
`;

  // azure-devops/src/features/starred-reviewers/index.ts
  function schedule(callback, delayMs) {
    let timer = setTimeout(callback, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }
  var starredReviewers = {
    change: { kind: "updated", version: "1.9.0" },
    description: "Star reviewers, then add a starred one as optional or required reviewer in one click, also on a new pull request.",
    id: "starred-reviewers",
    name: "Starred reviewers",
    start({ basePath: basePath2, client, document: document2, isInFrame: isInFrame2 }) {
      if (isInFrame2)
        return null;
      let storageKey = `starred-reviewers:${location.host}${basePath2}`, imageUrlOf = ({ id }) => `${location.origin}${basePath2}/_api/_common/identityImage?id=${encodeURIComponent(id)}`, store = createStarredReviewersStore({
        load: () => GM_getValue(storageKey, []),
        save: (list) => {
          GM_setValue(storageKey, list);
        }
      }), starred = createStarredReviewers({
        client,
        document: document2,
        imageUrlOf,
        reload: () => {
          location.reload();
        },
        schedule,
        store
      }), chips = createStarredReviewerChips({
        document: document2,
        imageUrlOf,
        onNextDomChange: (callback) => onNextDomChange(document2, callback),
        schedule,
        store
      });
      return {
        sync({ page }) {
          starred.sync(pullRequestOf(page)), chips.sync(page.kind === "pull-request-create");
        }
      };
    },
    styles: [style_default14]
  };

  // azure-devops/src/features/viewed-files/tree-ticks.ts
  var TICK_SELECTOR = ".bolt-checkbox";
  function isTicked(row) {
    return row.querySelector(TICK_SELECTOR)?.getAttribute("aria-checked") === "true";
  }
  function filesUnder(shown, folder) {
    return (shown.changedPaths ?? []).filter((path) => path.startsWith(`${folder}/`));
  }
  function noteTick(shown, path, row) {
    let known = shown.changedPaths?.includes(path) === !0 ? shown.fileTicks : shown.folderTicks, before = known.get(path);
    return known.set(path, isTicked(row)), before !== void 0 && before !== known.get(path);
  }
  function noteDrawnTicks(document2, shown) {
    let files = new Set(shown.changedPaths), tree = treeNow(document2, shown.changedPaths), changed = { files: [], folders: [], tickedFolders: [] };
    for (let [index, path] of drawnPaths(tree).entries()) {
      let row = tree.drawn[index]?.row;
      path !== null && row !== void 0 && noteTick(shown, path, row) && (files.has(path) ? changed.files : changed.folders).push(path), path !== null && row !== void 0 && !files.has(path) && isTicked(row) && changed.tickedFolders.push(path);
    }
    return changed;
  }
  function noteTicks(document2, shown) {
    let changed = noteDrawnTicks(document2, shown), clickedFolders = changed.folders.filter(
      (folder) => !changed.files.some((file) => file.startsWith(`${folder}/`))
    );
    for (let folder of clickedFolders) {
      let tick = shown.folderTicks.get(folder) === !0;
      for (let file of filesUnder(shown, folder))
        shown.fileTicks.set(file, tick);
    }
    for (let folder of changed.tickedFolders)
      for (let file of filesUnder(shown, folder))
        shown.fileTicks.set(file, !0);
  }
  function findCompleteFolders(shown) {
    let changedPaths = shown.changedPaths ?? [], files = new Set(changedPaths), complete = new Set(
      listedRows(changedPaths).map(({ path }) => path).filter((path) => !files.has(path))
    );
    for (let file of changedPaths)
      if (shown.fileTicks.get(file) !== !0)
        for (let end = file.lastIndexOf("/"); end > 0; end = file.lastIndexOf("/", end - 1))
          complete.delete(file.slice(0, end));
    return complete;
  }
  function outermost(folders) {
    return folders.filter((folder) => !folders.some((other) => folder.startsWith(`${other}/`)));
  }
  function newlyComplete(shown) {
    let before = shown.completeFolders, now = findCompleteFolders(shown);
    return shown.completeFolders = now, before === null ? [] : outermost([...now].filter((folder) => !before.has(folder)));
  }
  function isTickShown(walk, path, isViewed) {
    let row = drawnRowOf(path, treeNow(walk.document, walk.changedPaths));
    return row !== null && isTicked(row) === isViewed;
  }

  // azure-devops/src/features/viewed-files/viewed-toggles.ts
  var FILE_CARD_SELECTOR2 = ".repos-summary-header", CARD_PATH_SELECTOR = ":scope > div:first-child .secondary-text.text-ellipsis", CARD_ACTIONS_SELECTOR = ":scope > div:first-child .justify-end", CARD_EXPAND_SELECTOR = ".bolt-card-expand-button", FILE_BAR_SELECTOR = ".repos-compare-toolbar", FOLDER_VIEW_SELECTOR = ".repos-changes-viewer.is-folder", BAR_PATH_SELECTOR = ".secondary-text.text-ellipsis", BAR_LAYOUT_SELECTOR = ".bolt-split-button", BAR_COMMANDS_SELECTOR = ":scope > div > .repos-compare-header-commandbar", TOGGLE_CLASS4 = "fix-ado-viewed-toggle", PATH_ATTRIBUTE = "data-fix-ado-viewed-path", LABEL3 = "Viewed";
  function asTreePath(shown) {
    return shown.startsWith("/") ? shown : `/${shown}`;
  }
  var stateByDocument = /* @__PURE__ */ new WeakMap();
  function shownPath(container, selector) {
    let shown = container.querySelector(selector)?.textContent.trim() ?? "";
    return shown === "" ? "" : asTreePath(shown);
  }
  function headerOf(toggle) {
    let card = toggle.closest(FILE_CARD_SELECTOR2), bar = toggle.closest(FILE_BAR_SELECTOR), path = (card === null ? "" : shownPath(card, CARD_PATH_SELECTOR)) || (bar === null ? "" : shownPath(bar, BAR_PATH_SELECTOR));
    return { card, path: path || (toggle.getAttribute(PATH_ATTRIBUTE) ?? "") };
  }
  function createToggle2(document2) {
    let label = document2.createElement("label");
    label.className = `${TOGGLE_CLASS4} body-m`;
    let input = document2.createElement("input");
    return input.type = "checkbox", input.addEventListener("change", () => {
      let state = stateByDocument.get(document2), header = headerOf(label), isViewed = header.path !== label.getAttribute(PATH_ATTRIBUTE) ? state?.isViewed(header.path) !== !0 : input.checked;
      input.checked = isViewed, label.setAttribute(PATH_ATTRIBUTE, header.path), state?.onToggle(header, isViewed);
    }), label.append(input, LABEL3), label;
  }
  function toggleIn2(container, place, { path, state }) {
    let toggle = container.querySelector(`:scope .${TOGGLE_CLASS4}`) ?? createToggle2(container.ownerDocument);
    toggle.isConnected || place(toggle), toggle.setAttribute(PATH_ATTRIBUTE, path);
    let input = toggle.querySelector("input"), isViewed = state.isViewed(path);
    input !== null && input.checked !== isViewed && (input.checked = isViewed);
  }
  function fileCards(document2) {
    return [...document2.querySelectorAll(FILE_CARD_SELECTOR2)].map((card) => ({ card, path: shownPath(card, CARD_PATH_SELECTOR) })).filter(({ path }) => path !== "");
  }
  function syncCardToggles(document2, state) {
    for (let { card, path } of fileCards(document2)) {
      let actions = card.querySelector(CARD_ACTIONS_SELECTOR);
      actions !== null && toggleIn2(
        actions,
        (toggle) => {
          actions.prepend(toggle);
        },
        { path, state }
      );
    }
  }
  function isFolderView(document2) {
    return document2.querySelector(FOLDER_VIEW_SELECTOR) !== null;
  }
  function syncBarToggle(document2, state) {
    if (isFolderView(document2)) {
      document2.querySelector(`${FILE_BAR_SELECTOR} .${TOGGLE_CLASS4}`)?.remove();
      return;
    }
    let bar = document2.querySelector(FILE_BAR_SELECTOR), path = bar === null ? "" : shownPath(bar, BAR_PATH_SELECTOR), next = bar?.querySelector(BAR_LAYOUT_SELECTOR) ?? bar?.querySelector(BAR_COMMANDS_SELECTOR);
    bar !== null && next !== null && next !== void 0 && path !== "" && toggleIn2(
      bar,
      (toggle) => {
        next.before(toggle);
      },
      { path, state }
    );
  }
  function syncViewedToggles(document2, state) {
    stateByDocument.set(document2, state), syncCardToggles(document2, state), syncBarToggle(document2, state);
  }
  function setCardOpen(card, isOpen) {
    let expand = card.querySelector(CARD_EXPAND_SELECTOR);
    expand !== null && expand.getAttribute("aria-expanded") === "true" !== isOpen && expand.click();
  }

  // azure-devops/src/features/viewed-files/card-folds.ts
  function foldViewedCards(document2, shown) {
    for (let { card, path } of fileCards(document2)) {
      let tick = shown.fileTicks.get(path);
      tick !== void 0 && !shown.cardsFolded.has(path) && (shown.cardsFolded.add(path), tick && setCardOpen(card, !1));
    }
  }
  function setAskedCards(document2, shown) {
    for (let { card, path } of fileCards(document2)) {
      let isOpen = shown.cardsAsked.get(path);
      isOpen !== void 0 && (shown.cardsAsked.delete(path), setCardOpen(card, isOpen));
    }
  }
  function askCards(document2, shown, ask) {
    for (let path of ask.paths)
      shown.cardsAsked.set(path, ask.isOpen), shown.cardsFolded.add(path);
    setAskedCards(document2, shown);
  }

  // azure-devops/src/features/viewed-files/tree-walk.ts
  var TREE_SELECTOR4 = ".repos-changes-explorer-tree", ROW_SELECTOR4 = "tr.bolt-tree-row", SLACK_PX = 0.5, SCROLLER_SELECTOR3 = ".v-scroll-auto", STEP_OF_VIEW = 0.8, LOADING_CLASS = "fix-ado-viewed-tree-loading";
  function scrollerOf2(document2) {
    return document2.querySelector(TREE_SELECTOR4)?.closest(SCROLLER_SELECTOR3) ?? null;
  }
  async function nextTreeDraw({ document: document2, drawTimeoutMs }) {
    let scroller = scrollerOf2(document2), view = document2.defaultView;
    scroller === null || view === null || await new Promise((resolve) => {
      let observer = new view.MutationObserver(() => {
        done();
      }), timer = view.setTimeout(done, drawTimeoutMs);
      function done() {
        observer.disconnect(), view?.clearTimeout(timer), resolve();
      }
      observer.observe(scroller, {
        attributeFilter: ["aria-checked", "aria-expanded"],
        childList: !0,
        subtree: !0
      });
    });
  }
  async function untilTreeShows(walk, isShown, timeoutMs) {
    let deadline = Date.now() + timeoutMs;
    for (; !isShown() && Date.now() < deadline; )
      await nextTreeDraw({ ...walk, drawTimeoutMs: deadline - Date.now() });
    let isDone = isShown();
    return isDone || log("Viewed files: a wait for the tree hit its cap", { viewedFilesTiming: { timeoutMs } }), isDone;
  }
  function isViewDrawn(document2) {
    let tree = document2.querySelector(TREE_SELECTOR4), rows = [...tree?.querySelectorAll(ROW_SELECTOR4) ?? []], view = scrollerOf2(document2)?.getBoundingClientRect(), whole = tree?.getBoundingClientRect(), first = rows.at(0)?.getBoundingClientRect(), last = rows.at(-1)?.getBoundingClientRect();
    return view === void 0 || whole === void 0 || first === void 0 || last === void 0 ? !1 : first.top <= Math.max(view.top, whole.top) + SLACK_PX && last.bottom >= Math.min(view.bottom, whole.bottom) - SLACK_PX;
  }
  function showSkeleton(scroller) {
    scroller.classList.add(LOADING_CLASS), scroller.setAttribute("aria-busy", "true");
  }
  function hideSkeleton(scroller) {
    scroller.classList.remove(LOADING_CLASS), scroller.removeAttribute("aria-busy");
  }
  function setSkeleton(document2, isShown) {
    let scroller = scrollerOf2(document2);
    scroller !== null && (isShown ? showSkeleton : hideSkeleton)(scroller);
  }
  async function keepingScroll(walk, run) {
    let scroller = scrollerOf2(walk.document);
    if (scroller === null)
      return;
    let top = scroller.scrollTop;
    try {
      await run();
    } finally {
      await scrollTo(walk, scroller, top), hideSkeleton(scroller);
    }
  }
  async function scrollTo(walk, scroller, top) {
    scroller.scrollTop !== top && (scroller.scrollTop = top, await untilTreeShows(walk, () => isViewDrawn(walk.document), walk.drawTimeoutMs));
  }
  function isAtEnd(scroller) {
    return scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 1;
  }
  async function walkFromTop(walk, scroller, visit) {
    await scrollTo(walk, scroller, 0);
    let isFound = await visit(), isMoved = !0;
    for (; !isFound && isMoved && !isAtEnd(scroller); ) {
      let before = scroller.scrollTop, step = Math.max(Math.floor(scroller.clientHeight * STEP_OF_VIEW), 1);
      await scrollTo(walk, scroller, before + step), isMoved = scroller.scrollTop > before, isFound = isMoved && await visit();
    }
    return isFound;
  }
  async function walkTree(walk, visit) {
    let scroller = scrollerOf2(walk.document);
    if (scroller === null || await visit())
      return scroller !== null;
    showSkeleton(scroller);
    let started = Date.now(), isFound = await walkFromTop(walk, scroller, visit);
    return log("Viewed files: walked the tree", {
      isFound,
      viewedFilesTiming: {
        clientHeight: scroller.clientHeight,
        ms: Date.now() - started,
        scrollHeight: scroller.scrollHeight
      }
    }), isFound;
  }
  async function withDrawnRow(walk, path, act) {
    let found = { row: null };
    return await walkTree(walk, () => (found.row = drawnRowOf(path, treeNow(walk.document, walk.changedPaths)), found.row !== null)), found.row !== null && await act(found.row), found.row !== null;
  }

  // azure-devops/src/features/viewed-files/owner-clicks.ts
  var TREE_SELECTOR5 = ".repos-changes-explorer-tree", TICK_SELECTOR2 = ".bolt-checkbox", FOLD_KEYS = /* @__PURE__ */ new Set(["ArrowLeft", "ArrowRight", "Enter"]), watchedTrees = /* @__PURE__ */ new WeakSet(), isScriptClick = !1;
  function clickForScript(element4) {
    isScriptClick = !0;
    try {
      element4?.click();
    } finally {
      isScriptClick = !1;
    }
  }
  function isFoldEvent(view, event) {
    return event instanceof view.KeyboardEvent ? FOLD_KEYS.has(event.key) : event.target instanceof view.Element && event.target.closest(TICK_SELECTOR2) === null;
  }
  function watchOwnerFolds(document2, onOwnerFold) {
    let tree = document2.querySelector(TREE_SELECTOR5), view = document2.defaultView;
    if (tree === null || view === null || watchedTrees.has(tree))
      return;
    watchedTrees.add(tree);
    let onEvent = (event) => {
      !isScriptClick && isFoldEvent(view, event) && onOwnerFold();
    };
    tree.addEventListener("click", onEvent, { capture: !0 }), tree.addEventListener("keydown", onEvent, { capture: !0 });
  }

  // azure-devops/src/features/viewed-files/tree-folds.ts
  var FOLD_SELECTOR = ".bolt-tree-expand-button", FOLDER_ROW_SELECTOR = ".repos-changes-explorer-tree tr.bolt-tree-row[aria-expanded]";
  function isFoldShown(walk, path, isOpen) {
    return drawnRowOf(path, treeNow(walk.document, walk.changedPaths))?.getAttribute("aria-expanded") === String(isOpen);
  }
  async function setFolderOpen(walk, { path, row }, isOpen) {
    row.getAttribute("aria-expanded") !== String(isOpen) && (clickForScript(row.querySelector(FOLD_SELECTOR)), noteOwnFold(walk.document, path, !isOpen), await untilTreeShows(
      walk,
      () => row.isConnected ? row.getAttribute("aria-expanded") === String(isOpen) : isFoldShown(walk, path, isOpen),
      walk.drawTimeoutMs
    ));
  }
  function fold(document2, { path, row }) {
    row.getAttribute("aria-expanded") === "true" && (clickForScript(row.querySelector(FOLD_SELECTOR)), noteOwnFold(document2, path, !0));
  }
  function drawnFolder(walk, folders) {
    let tree = treeNow(walk.document, walk.changedPaths);
    for (let path of folders) {
      let row = drawnRowOf(path, tree);
      if (row !== null)
        return { path, row };
    }
    return null;
  }
  async function setFoldersOpen(walk, folders, isOpen) {
    let left = new Set(folders);
    if (left.size === 0)
      return;
    let started = Date.now();
    await walkTree(walk, async () => {
      for (let found = drawnFolder(walk, left); found !== null; found = drawnFolder(walk, left))
        left.delete(found.path), await setFolderOpen(walk, found, isOpen);
      return left.size === 0;
    }), log("Viewed files: opened or folded folders", {
      isOpen,
      viewedFilesTiming: { asked: folders.length, missed: left.size, ms: Date.now() - started }
    });
  }
  async function foldFolders(walk, folders) {
    await setFoldersOpen(walk, folders, !1);
  }
  async function unfoldAbove(walk, path) {
    await setFoldersOpen(
      walk,
      [...foldedPaths(walk.document)].filter((folder) => path.startsWith(`${folder}/`)),
      !0
    );
  }
  function folderRowAt(document2, index) {
    return document2.querySelector(`${FOLDER_ROW_SELECTOR}[aria-rowindex="${index}"]`);
  }
  async function clickChevron(walk, row, isOpen) {
    let tree = treeNow(walk.document, walk.changedPaths), path = drawnPaths(tree)[tree.drawn.findIndex((drawn) => drawn.row === row)], index = row.getAttribute("aria-rowindex") ?? "";
    return clickForScript(row.querySelector(FOLD_SELECTOR)), path != null && noteOwnFold(walk.document, path, !isOpen), untilTreeShows(
      walk,
      () => folderRowAt(walk.document, index)?.getAttribute("aria-expanded") === String(isOpen),
      walk.drawTimeoutMs
    );
  }
  function clicking(isOpen, isPicked) {
    return { clicks: 0, isOpen, isPicked, stuck: /* @__PURE__ */ new Set() };
  }
  async function clickDrawnPicked(walk, run) {
    let nextRow = () => [...walk.document.querySelectorAll(FOLDER_ROW_SELECTOR)].find(
      (row) => run.isPicked(row) && !run.stuck.has(row.getAttribute("aria-rowindex") ?? "")
    ) ?? null;
    for (let row = nextRow(); row !== null; row = nextRow())
      run.clicks += 1, await clickChevron(walk, row, run.isOpen) || run.stuck.add(row.getAttribute("aria-rowindex") ?? "");
  }
  function logClicks(run, started) {
    log("Viewed files: clicked every picked folder", {
      isOpen: run.isOpen,
      viewedFilesTiming: { clicks: run.clicks, ms: Date.now() - started, stuck: run.stuck.size }
    });
  }
  async function clickEveryPicked(walk, run) {
    let started = Date.now();
    await walkTree(walk, async () => (await clickDrawnPicked(walk, run), !1)), logClicks(run, started);
  }
  function isOpenViewedFolder(row) {
    return row.getAttribute("aria-expanded") === "true" && isTicked(row);
  }
  function viewedFolding() {
    return clicking(!1, isOpenViewedFolder);
  }
  async function foldViewedFolders(walk) {
    await clickEveryPicked(walk, viewedFolding());
  }
  async function openEveryFolder(walk) {
    await clickEveryPicked(
      walk,
      clicking(!0, (row) => row.getAttribute("aria-expanded") === "false")
    );
  }
  function hasOpenViewedFolder(document2) {
    return [...document2.querySelectorAll(FOLDER_ROW_SELECTOR)].some((row) => isOpenViewedFolder(row));
  }
  async function foldDrawnViewed(walk) {
    let run = viewedFolding();
    return await clickDrawnPicked(walk, run), run.stuck.size === 0;
  }
  async function walkNoting(walk, note, isFolding) {
    let run = viewedFolding();
    return await walkTree(walk, async () => (note(), await (isFolding ? clickDrawnPicked(walk, run) : void 0), !1)), run.clicks;
  }

  // azure-devops/src/features/viewed-files/kept-folds.ts
  function foldersToCollapse(document2, shown) {
    let folders = newlyComplete(shown);
    return isFolderView(document2) ? folders : [];
  }
  function foldNewlyComplete(document2, shown) {
    let tree = treeNow(document2, shown.changedPaths), isClicked = !1;
    for (let folder of foldersToCollapse(document2, shown)) {
      let row = drawnRowOf(folder, tree);
      row !== null && (fold(document2, { path: folder, row }), isClicked = !0);
    }
    return isClicked;
  }
  function keepViewedFolded(shown, walk, queue2) {
    let { document: document2 } = walk;
    shown.keepsViewedFolded && isFolderView(document2) && hasOpenViewedFolder(document2) && queue2(async () => {
      shown.keepsViewedFolded = await foldDrawnViewed(walk);
    });
  }
  function stopOnOwnerFolds(document2, shownNow) {
    watchOwnerFolds(document2, () => {
      let shown = shownNow();
      shown !== null && (shown.keepsViewedFolded = !1);
    });
  }

  // azure-devops/src/features/viewed-files/toolbar-buttons.ts
  var FILTER_SELECTOR4 = ".repos-compare-filter", BOX_CLASS = "fix-ado-viewed-toolbar-buttons", TOOLBAR_BUTTONS = [
    { action: "expand-all", label: "Expand all" },
    { action: "collapse-viewed", label: "Collapse viewed" }
  ], onClickByDocument = /* @__PURE__ */ new WeakMap();
  function createButton5(document2, { action, label }) {
    let text = Object.assign(document2.createElement("span"), {
      className: "bolt-button-text body-m",
      textContent: label
    }), button2 = document2.createElement("button");
    return button2.type = "button", button2.className = "bolt-button enabled bolt-focus-treatment", button2.append(text), button2.addEventListener("click", () => {
      onClickByDocument.get(document2)?.(action);
    }), button2;
  }
  function createBox(document2) {
    let box = Object.assign(document2.createElement("div"), {
      className: `${BOX_CLASS} inline-flex-row rhythm-horizontal-8`
    });
    return box.append(...TOOLBAR_BUTTONS.map((toolbarButton) => createButton5(document2, toolbarButton))), box;
  }
  function syncToolbarButtons(document2, onClick3) {
    onClickByDocument.set(document2, onClick3);
    let filter = document2.querySelector(FILTER_SELECTOR4);
    filter !== null && filter.nextElementSibling?.classList.contains(BOX_CLASS) !== !0 && (document2.querySelector(`.${BOX_CLASS}`)?.remove(), filter.after(createBox(document2)), log("Viewed files: toolbar buttons added"));
  }
  function removeToolbarButtons(document2) {
    document2.querySelector(`.${BOX_CLASS}`)?.remove();
  }

  // azure-devops/src/features/viewed-files/changed-paths.ts
  async function loadChangedPaths(client, pullRequest) {
    let ids = await client.getPullRequestIterationIds(pullRequest);
    return ids.length === 0 ? null : (await client.getIterationChanges(pullRequest, Math.max(...ids))).flatMap(({ item, originalPath }) => item?.path ?? originalPath ?? []);
  }

  // azure-devops/src/features/viewed-files/viewed-files.ts
  var TREE_SELECTOR6 = ".repos-changes-explorer-tree";
  function keyOf({ project, pullRequestId, repository }) {
    return `${project}/${repository}/${String(pullRequestId)}`;
  }
  function walkOf({ options }, shown) {
    return {
      changedPaths: shown.changedPaths,
      document: options.document,
      drawTimeoutMs: options.drawTimeoutMs
    };
  }
  function queue(state, run) {
    let work = (state.work ?? Promise.resolve()).then(run).catch((error) => {
      log("Viewed files: a step failed", { error: String(error) });
    }).then(() => {
      state.work === work && (state.work = null);
    });
    state.work = work;
  }
  function walkWholeTree(state, shown) {
    shown.isWalkStarted = !0;
    let { document: document2 } = state.options;
    queue(state, async () => {
      let started = Date.now(), walk = walkOf(state, shown), isFolding = isFolderView(document2), folds = 0;
      await keepingScroll(walk, async () => {
        folds = await walkNoting(
          walk,
          () => {
            noteTicks(document2, shown);
          },
          isFolding
        ), shown.completeFolders = findCompleteFolders(shown), isFolding && (foldViewedCards(document2, shown), await foldViewedFolders(walk));
      }), log("Viewed files: first walk and folds done", {
        viewedFilesTiming: {
          changedFiles: shown.changedPaths?.length,
          completeFolders: shown.completeFolders?.size,
          folds,
          ms: Date.now() - started
        }
      }), render5(state);
    });
  }
  function setViewed(state, header, isViewed) {
    let { shown } = state;
    if (shown === null)
      return;
    let { document: document2, tickTimeoutMs } = state.options;
    header.card !== null && setCardOpen(header.card, !isViewed), shown.cardsFolded.add(header.path), queue(state, async () => {
      let walk = walkOf(state, shown);
      await keepingScroll(walk, async () => {
        await unfoldAbove(walk, header.path), await withDrawnRow(walk, header.path, async (row) => {
          isTicked(row) !== isViewed && (row.querySelector(TICK_SELECTOR)?.click(), await untilTreeShows(walk, () => isTickShown(walk, header.path, isViewed), tickTimeoutMs));
        }), noteTicks(document2, shown), await foldFolders(walk, foldersToCollapse(document2, shown));
      }), header.card !== null && shown.fileTicks.get(header.path) === !0 !== isViewed && setCardOpen(header.card, isViewed), render5(state);
    });
  }
  function runToolbarAction(state, action) {
    let { shown } = state;
    if (shown?.changedPaths === null || shown === null)
      return;
    let { changedPaths } = shown, isExpand = action === "expand-all", paths = isExpand ? changedPaths : changedPaths.filter((path) => shown.fileTicks.get(path) === !0);
    log(isExpand ? "Viewed files: Expand all clicked" : "Viewed files: Collapse viewed clicked"), shown.keepsViewedFolded = !isExpand, askCards(state.options.document, shown, { isOpen: isExpand, paths }), queue(state, async () => {
      let walk = walkOf(state, shown);
      await keepingScroll(walk, async () => {
        await (isExpand ? openEveryFolder(walk) : foldViewedFolders(walk));
      }), render5(state);
    });
  }
  function render5(state) {
    let { shown } = state, { document: document2 } = state.options;
    shown !== null && (setAskedCards(document2, shown), foldViewedCards(document2, shown)), syncToolbarButtons(document2, (action) => {
      runToolbarAction(state, action);
    }), syncViewedToggles(state.options.document, {
      isViewed: (path) => shown?.fileTicks.get(path) === !0,
      onToggle: (header, isViewed) => {
        setViewed(state, header, isViewed);
      }
    });
  }
  function show2(state, pullRequest) {
    let key = keyOf(pullRequest);
    if (state.shown?.key === key)
      return state.shown;
    let shown = {
      cardsAsked: /* @__PURE__ */ new Map(),
      cardsFolded: /* @__PURE__ */ new Set(),
      changedPaths: null,
      completeFolders: null,
      fileTicks: /* @__PURE__ */ new Map(),
      folderTicks: /* @__PURE__ */ new Map(),
      isWalkStarted: !1,
      keepsViewedFolded: !0,
      key
    };
    return state.shown = shown, setSkeleton(state.options.document, !0), queue(state, async () => {
      try {
        shown.changedPaths = await loadChangedPaths(state.options.client, pullRequest);
      } finally {
        shown.changedPaths === null && setSkeleton(state.options.document, !1);
      }
    }), shown;
  }
  function syncTreeTicks(state, shown) {
    let { document: document2 } = state.options;
    shown.changedPaths === null || state.work !== null || (noteTicks(document2, shown), shown.isWalkStarted ? foldNewlyComplete(document2, shown) || keepViewedFolded(shown, walkOf(state, shown), (run) => {
      queue(state, run);
    }) : walkWholeTree(state, shown));
  }
  function createViewedFiles(options) {
    let state = { options, shown: null, work: null };
    return {
      idle: async () => {
        for (; state.work !== null; )
          await state.work;
      },
      sync(pullRequest) {
        if (pullRequest === null || options.document.querySelector(TREE_SELECTOR6) === null) {
          removeToolbarButtons(options.document);
          return;
        }
        stopOnOwnerFolds(options.document, () => state.shown), syncTreeTicks(state, show2(state, pullRequest)), render5(state);
      }
    };
  }

  // azure-devops/src/features/viewed-files/style.css
  var style_default15 = `/* The Viewed toggle in a file's header: Azure DevOps's own checkbox, in its blue. */
.fix-ado-viewed-toggle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  margin-inline-end: 12px;
  cursor: pointer;
  user-select: none;

  & input {
    inline-size: 16px;
    aspect-ratio: 1;
    margin: 0;
    accent-color: var(--communication-background, rgb(0, 120, 212));
    cursor: pointer;
  }
}

/* In the bar above a single file, level with the Inline button. */
.repos-compare-toolbar .fix-ado-viewed-toggle {
  align-self: center;
}

/* Expand all and Collapse viewed, right after the Filter button in the Files tab's toolbar. */
.fix-ado-viewed-toolbar-buttons {
  flex-shrink: 0;
}

/*
 * While the script reads the file tree, its rows are hidden and a skeleton of rows
 * pulses in their place. The bars take the text color, so they suit light and dark.
 */
.v-scroll-auto.fix-ado-viewed-tree-loading {
  --fix-ado-skeleton: color-mix(in srgb, currentcolor 12%, transparent);

  scrollbar-width: none;
  background-image:
    linear-gradient(var(--fix-ado-skeleton) 0 12px, transparent 12px),
    linear-gradient(var(--fix-ado-skeleton) 0 12px, transparent 12px);
  background-repeat: repeat-y;
  background-position:
    16px 10px,
    40px 42px;
  background-size:
    60% 64px,
    45% 64px;
  animation: fix-ado-skeleton-pulse 1.2s ease-in-out infinite alternate;

  & > * {
    visibility: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 4s;
  }

  @media (forced-colors: active) {
    forced-color-adjust: none;
    --fix-ado-skeleton: GrayText;
  }
}

@keyframes fix-ado-skeleton-pulse {
  to {
    opacity: 0.4;
  }
}
`;

  // azure-devops/src/features/viewed-files/index.ts
  var DRAW_TIMEOUT_MS = 2e3, TICK_TIMEOUT_MS = 1e4, viewedFiles = {
    change: { kind: "updated", version: "1.23.0" },
    description: "A Viewed checkbox on each file in the Files tab ticks the file in the tree on the left, as on GitHub, and collapses its diff. A viewed file's diff starts collapsed. A folder whose files are all ticked collapses in the tree, also when the page opens. While it reads the tree, the tree shows placeholder rows. Expand all and Collapse viewed after the Filter button open every diff and folder, or collapse the viewed ones.",
    id: "viewed-files",
    name: "Viewed files",
    start({ client, document: document2, isInFrame: isInFrame2 }) {
      if (isInFrame2)
        return null;
      let viewed = createViewedFiles({
        client,
        document: document2,
        drawTimeoutMs: DRAW_TIMEOUT_MS,
        tickTimeoutMs: TICK_TIMEOUT_MS
      });
      return {
        sync({ page }) {
          viewed.sync(pullRequestOf(page));
        }
      };
    },
    styles: [style_default15]
  };

  // azure-devops/src/features/pull-request-features.ts
  var PULL_REQUEST_FEATURES = [
    pipelineTab,
    runPageTabs,
    starredReviewers,
    review,
    viewedFiles
  ];

  // azure-devops/src/features/pipeline-status/pipeline-status-poller.ts
  var IN_PROGRESS_POLL_INTERVAL_MS = 2e4, SETTLED_POLL_INTERVAL_MS = 18e4, FAILED_REQUEST_RETRY_MS = 6e4, MS_PER_SECOND2 = 1e3;
  function showStatuses(state) {
    for (let { row, pullRequest } of state.options.findRows()) {
      let polled = state.polledPullRequests.get(pullRequest.pullRequestId), status = polled?.hasBeenFetched === !0 ? polled.status ?? "none" : "loading";
      state.options.showStatus(row, pullRequest.pullRequestId, status);
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
      error instanceof AdoRequestError && ({ retryAfterSeconds } = error), polled.hasBeenFetched = !0, polled.nextPollAt = state.options.now() + FAILED_REQUEST_RETRY_MS;
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
      await fetchStatus(state, pullRequest), showStatuses(state);
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
        if (showStatuses(state), !state.isFetching) {
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

  // azure-devops/src/features/assigned-to-me-stacked/relative-time.ts
  var SECONDS_PER_UNIT = [
    ["year", 31536e3],
    ["month", 2592e3],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60]
  ], MS_PER_SECOND3 = 1e3;
  function relativeTime(then, now, locale) {
    let seconds = (now - then) / MS_PER_SECOND3, format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    for (let [unit, unitSeconds] of SECONDS_PER_UNIT)
      if (seconds >= unitSeconds)
        return format.format(-Math.floor(seconds / unitSeconds), unit);
    return format.format(0, "second");
  }

  // azure-devops/src/features/assigned-to-me-stacked/assigned-row.ts
  var AUTHOR_AVATAR_SELECTOR = '[aria-colindex="1"] .bolt-coin', TITLE_SELECTOR2 = ".bolt-table-two-line-cell-item .body-l", TITLE_PILL_SELECTOR = ".bolt-table-two-line-cell-item .bolt-pill", DRAFT_PILL_SELECTOR2 = ".repos-pr-list-draft-pill", CONFLICTS_PILL_SELECTOR = ".repos-pr-list-conflicts-pill", REQUIRED_PILL_SELECTOR = ".repos-pr-list-required-pill", CONFLICTS_MERGE_STATUS = "conflicts", SUBTITLE_SELECTOR = ".bolt-table-two-line-cell-item .secondary-text > span", BRANCH_SELECTOR = ".monospaced-xs", REPOSITORY_SELECTOR = ":scope > .padding-horizontal-4:not(.monospaced-xs)", REVIEWER_SELECTOR2 = ".pr-reviewer", VOTE_ICON_SELECTOR = ".fluent-icons-enabled:has(> .repos-pr-reviewer-vote)", APPROVED_VOTE = 10, APPROVED_WITH_SUGGESTIONS_VOTE = 5, WAITING_FOR_AUTHOR_VOTE = -5, REJECTED_VOTE = -10, VOTE_ICONS = /* @__PURE__ */ new Map([
    [APPROVED_VOTE, ["approved", "ms-Icon--CompletedSolid"]],
    [APPROVED_WITH_SUGGESTIONS_VOTE, ["approved", "ms-Icon--CompletedSolid"]],
    [WAITING_FOR_AUTHOR_VOTE, ["waiting", "ms-Icon--AwayStatus"]],
    [REJECTED_VOTE, ["rejected", "ms-Icon--StatusErrorFull"]]
  ]), COMMENTS_CELL_SELECTOR = '[aria-colindex="4"] .bolt-table-cell-content', ROW_MENU_SELECTOR = ".bolt-table-cell-content-reveal", SCRIPT_MARK_SELECTOR = '[class*="fix-ado-"]', BRANCH_PREFIX = /^refs\/heads\//u, MAX_SHOWN_REVIEWERS = 3, avatarHref = (person) => (
    // oxlint-disable-next-line eslint/no-underscore-dangle -- the REST API's name for an identity's links
    person?._links?.avatar?.href ?? person?.imageUrl ?? ""
  );
  function showAvatar(avatar, person) {
    avatar?.setAttribute("aria-label", person?.displayName ?? ""), avatar?.querySelector("img")?.setAttribute("src", avatarHref(person));
  }
  function copyOf(element4) {
    let holder = element4.ownerDocument.createElement("div");
    return holder.append(element4.cloneNode(!0)), holder.querySelector(":scope > *");
  }
  function pullRequestHref(basePath2, pullRequest) {
    let project = encodeURIComponent(pullRequest.repository?.project?.name ?? ""), repository = encodeURIComponent(pullRequest.repository?.name ?? "");
    return `${basePath2}/${project}/_git/${repository}/pullrequest/${pullRequest.pullRequestId}`;
  }
  function replaceLast(text, search2, replacement) {
    let index = text.lastIndexOf(search2);
    return index === -1 ? text : text.slice(0, index) + replacement + text.slice(index + search2.length);
  }
  function showSubtitleWords(subtitle, template, pullRequest) {
    let templateAuthor = avatarName(template.querySelector(AUTHOR_AVATAR_SELECTOR) ?? subtitle), templateId = new URL(template.getAttribute("href") ?? "", "https://relative.invalid").pathname.split("/").at(-1) ?? "", words = [...subtitle.childNodes].filter((node) => node.nodeType === subtitle.TEXT_NODE);
    for (let word of words) {
      let text = word.textContent ?? "", withAuthor = templateAuthor === "" ? text : text.replace(templateAuthor, pullRequest.createdBy?.displayName ?? "");
      word.textContent = replaceLast(withAuthor, templateId, String(pullRequest.pullRequestId));
    }
  }
  function showSubtitle(row, template, pullRequest) {
    let subtitle = row.querySelector(SUBTITLE_SELECTOR);
    subtitle !== null && (showSubtitleWords(subtitle, template, pullRequest), subtitle.querySelector(REPOSITORY_SELECTOR)?.replaceChildren(pullRequest.repository?.name ?? ""), subtitle.querySelector(BRANCH_SELECTOR)?.replaceChildren((pullRequest.targetRefName ?? "").replace(BRANCH_PREFIX, "")));
  }
  function titlePills(document2, pullRequest, reviewerId) {
    let isRequired = pullRequest.reviewers?.find(({ id }) => id === reviewerId)?.isRequired === !0;
    return [
      [DRAFT_PILL_SELECTOR2, pullRequest.isDraft === !0],
      [CONFLICTS_PILL_SELECTOR, pullRequest.mergeStatus === CONFLICTS_MERGE_STATUS],
      [REQUIRED_PILL_SELECTOR, isRequired]
    ].flatMap(([selector, isShown]) => {
      let pill = isShown ? document2.querySelector(selector) : null, copy = pill ? copyOf(pill) : null;
      return copy ? [copy] : [];
    });
  }
  function showTitle(row, pullRequest, reviewerId) {
    let title = row.querySelector(TITLE_SELECTOR2);
    title && (title.textContent = pullRequest.title ?? "");
    for (let pill of row.querySelectorAll(TITLE_PILL_SELECTOR))
      pill.remove();
    title?.after(...titlePills(row.ownerDocument, pullRequest, reviewerId));
  }
  function showMoreCount(avatars, rest) {
    let morePill = avatars.querySelector(":scope > .bolt-pill");
    return morePill === null || rest <= 0 ? null : (morePill.querySelector(".bolt-pill-content")?.replaceChildren(`+${rest}`), morePill);
  }
  function createVoteIcon(document2, vote) {
    let [state, iconName] = VOTE_ICONS.get(vote ?? 0) ?? [];
    if (state === void 0 || iconName === void 0)
      return null;
    let wrapper = Object.assign(document2.createElement("span"), {
      className: "fluent-icons-enabled"
    }), icon = Object.assign(document2.createElement("span"), {
      className: `repos-pr-reviewer-vote absolute ${state} flex-noshrink fabric-icon ${iconName}`
    });
    return icon.setAttribute("aria-hidden", "true"), wrapper.append(icon), wrapper;
  }
  function createReviewerAvatar(template, reviewer) {
    let avatar = copyOf(template);
    if (avatar === null)
      return null;
    showAvatar(avatar.querySelector(".bolt-coin"), reviewer), avatar.querySelector(VOTE_ICON_SELECTOR)?.remove();
    let voteIcon = createVoteIcon(avatar.ownerDocument, reviewer.vote);
    return voteIcon && avatar.append(voteIcon), avatar;
  }
  function showReviewers(row, pullRequest) {
    let shown = [...row.querySelectorAll(REVIEWER_SELECTOR2)], [first] = shown, parent = first?.parentElement;
    if (first === void 0 || !parent)
      return;
    let reviewers = pullRequest.reviewers ?? [], avatars = reviewers.slice(0, MAX_SHOWN_REVIEWERS).flatMap((reviewer) => {
      let avatar = createReviewerAvatar(first, reviewer);
      return avatar === null ? [] : [avatar];
    }), morePill = showMoreCount(parent, reviewers.length - avatars.length);
    parent.replaceChildren(...avatars, ...morePill ? [morePill] : []);
  }
  function showCreated(row, pullRequest, now) {
    let time = row.querySelector("time"), created = Date.parse(pullRequest.creationDate ?? "");
    time === null || Number.isNaN(created) || (time.setAttribute("datetime", pullRequest.creationDate ?? ""), time.textContent = relativeTime(
      created,
      now,
      row.ownerDocument.documentElement.lang || void 0
    ), time.parentElement?.setAttribute("aria-label", new Date(created).toLocaleString()));
  }
  function emptyCopy(template) {
    let row = copyOf(template);
    for (let mark of row?.querySelectorAll(SCRIPT_MARK_SELECTOR) ?? [])
      mark.remove();
    return row?.querySelector(COMMENTS_CELL_SELECTOR)?.replaceChildren(), row?.querySelector(ROW_MENU_SELECTOR)?.replaceChildren(), row;
  }
  function buildAssignedRow(template, pullRequest, { basePath: basePath2, now, reviewerId }) {
    let row = emptyCopy(template);
    return row === null ? null : (row.setAttribute("href", pullRequestHref(basePath2, pullRequest)), showAvatar(row.querySelector(AUTHOR_AVATAR_SELECTOR), pullRequest.createdBy), showTitle(row, pullRequest, reviewerId), showSubtitle(row, template, pullRequest), showReviewers(row, pullRequest), showCreated(row, pullRequest, now), row);
  }

  // azure-devops/src/features/assigned-to-me-stacked/assigned-tabs.ts
  var ACTIVE_TAB_ID = "__bolt-tab-activeMine", WAITING_FOR_AUTHOR_TAB_ID = "__bolt-tab-waitingForAuthor";
  function isVoteOnTab(vote, tabId) {
    return tabId === ACTIVE_TAB_ID ? vote === 0 : tabId === WAITING_FOR_AUTHOR_TAB_ID ? vote === -5 : vote !== 0 && vote !== -5;
  }
  var createdAt = ({ creationDate }) => creationDate === void 0 ? 0 : Date.parse(creationDate);
  function pullRequestsOnTab(pullRequests, reviewerId, tabId) {
    return pullRequests.filter(({ reviewers }) => {
      let vote = reviewers?.find(({ id }) => id === reviewerId)?.vote;
      return vote !== void 0 && isVoteOnTab(vote, tabId);
    }).toSorted((first, second) => createdAt(second) - createdAt(first));
  }

  // azure-devops/src/features/assigned-to-me-stacked/assigned-card.ts
  var CARD_SELECTOR2 = ".repos-pr-section-card", TAB_SELECTOR = '.repos-pr-section-tabs [role="tab"]', TABLE_CONTAINER_SELECTOR = ".bolt-table-container", ROW_SELECTOR5 = 'a.bolt-table-row[href*="/pullrequest/"]', STACKED_CLASS = "fix-ado-assigned-stacked", BUILT_CARD_CLASS = "fix-ado-assigned-card", PEEKING_CLASS = "fix-ado-assigned-peeking", CARD_TITLE_SELECTOR = ".repos-pr-section-header-title > .text-ellipsis", TAB_NAME_CLASS = "fix-ado-assigned-tab-name";
  function findAssignedCard(document2) {
    let card = document2.querySelector(`#${ACTIVE_TAB_ID}`)?.closest(CARD_SELECTOR2), table = card?.querySelector(TABLE_CONTAINER_SELECTOR);
    if (!card || !table)
      return null;
    let tabs = [...card.querySelectorAll(TAB_SELECTOR)].map((tab) => ({
      element: tab,
      id: tab.id,
      isSelected: tab.getAttribute("aria-selected") === "true"
    }));
    return { card, table, tabs };
  }
  function createTable(adoTable) {
    let container = copyOf(adoTable);
    container?.classList.remove("invisible");
    let table = container?.querySelector("table");
    return table?.removeAttribute("aria-label"), table?.removeAttribute("aria-rowcount"), table?.querySelector("tbody")?.replaceChildren(), container;
  }
  function tabNameOf(tab) {
    return {
      count: tab.querySelector(".bolt-tab-badge")?.textContent ?? "",
      label: tab.querySelector(".bolt-tab-text")?.textContent ?? ""
    };
  }
  function createCountPill(document2, count) {
    let pill = Object.assign(document2.createElement("div"), {
      className: "margin-left-8 bolt-pill flex-row flex-center standard regular"
    }), content = Object.assign(document2.createElement("div"), {
      className: "bolt-pill-content text-ellipsis",
      textContent: count
    });
    return content.setAttribute("role", "presentation"), pill.append(content), pill;
  }
  function createTabName(card, { label, count }, key) {
    let name = Object.assign(card.ownerDocument.createElement("span"), {
      className: TAB_NAME_CLASS
    });
    return name.dataset.fixAdoShown = key, name.append(`· ${label}`, ...count === "" ? [] : [createCountPill(card.ownerDocument, count)]), name;
  }
  function showTabName(card, tabName) {
    let key = JSON.stringify(tabName);
    card.dataset.fixAdoTabName !== key && (card.dataset.fixAdoTabName = key);
    let title = card.querySelector(CARD_TITLE_SELECTOR), shown = card.querySelector(`.${TAB_NAME_CLASS}`), isInPlace2 = title?.nextElementSibling === shown;
    shown?.dataset.fixAdoShown === key && isInPlace2 || (shown?.remove(), title?.after(shown?.dataset.fixAdoShown === key ? shown : createTabName(card, tabName, key)));
  }
  function shownTabName(card) {
    let key = card.dataset.fixAdoTabName;
    return key === void 0 ? null : JSON.parse(key);
  }
  function showOnlyTab(card, tabId, count) {
    for (let tab of card.querySelectorAll(TAB_SELECTOR))
      tab.id === tabId ? (tab.querySelector(".bolt-tab-badge .bolt-pill-content")?.replaceChildren(String(count)), showTabName(card, tabNameOf(tab))) : tab.remove();
  }
  function createRows(found, pullRequests, context) {
    let template = found.table.querySelector(ROW_SELECTOR5);
    return pullRequests.flatMap((pullRequest, index) => {
      let row = template ? buildAssignedRow(template, pullRequest, context) : null;
      return row?.classList.toggle("first-row", index === 0), row?.setAttribute("aria-rowindex", String(index + 1)), row ? [row] : [];
    });
  }
  function markAsBuilt(card) {
    card.classList.remove(STACKED_CLASS, PEEKING_CLASS), card.classList.add(BUILT_CARD_CLASS);
    for (let element4 of card.querySelectorAll("[id]"))
      element4.removeAttribute("id");
  }
  function createCard3(found, { tab, pullRequests }, context) {
    let card = copyOf(found.card), table = createTable(found.table);
    return card === null || table === null ? null : (card.querySelector(TABLE_CONTAINER_SELECTOR)?.replaceWith(table), table.querySelector("tbody")?.append(...createRows(found, pullRequests, context)), showOnlyTab(card, tab.id, pullRequests.length), markAsBuilt(card), card);
  }

  // azure-devops/src/features/assigned-to-me-stacked/card-peek.ts
  var FOLD_BUTTON_SELECTOR = ".repos-pr-section-expand-button", CARD_CONTENT_SELECTOR = ".bolt-card-content", PEEK_DEADLINE_MS = 5e3, titleOf = (card) => card.querySelector(CARD_TITLE_SELECTOR)?.textContent ?? "";
  function foldedCardTitled(document2, title) {
    return [...document2.querySelectorAll(
      `${CARD_SELECTOR2}:not(.${BUILT_CARD_CLASS})`
    )].find(
      (card) => title !== "" && titleOf(card) === title && card.querySelector(CARD_CONTENT_SELECTOR) === null
    ) ?? null;
  }
  function rememberTitle(document2, titles) {
    let card = document2.querySelector(`.${STACKED_CLASS}`), title = card ? titleOf(card) : "";
    title !== "" && titles.get() !== title && titles.set(title);
  }
  function createCardPeek(now, titles) {
    let peeking = null, builtKey = null;
    function foldAgain() {
      peeking?.card.querySelector(FOLD_BUTTON_SELECTOR)?.click(), peeking?.card.classList.remove(PEEKING_CLASS), peeking = null;
    }
    function unfold(document2) {
      let card = foldedCardTitled(document2, titles.get());
      card && (card.classList.add(PEEKING_CLASS), peeking = { card, startedAt: now() }, card.querySelector(FOLD_BUTTON_SELECTOR)?.click());
    }
    return {
      sync(document2, status, shownKey2) {
        status === "stacked" ? (rememberTitle(document2, titles), builtKey = shownKey2, peeking && foldAgain()) : peeking ? now() - peeking.startedAt > PEEK_DEADLINE_MS && (builtKey = shownKey2, foldAgain()) : shownKey2 !== null && shownKey2 !== builtKey && unfold(document2);
      }
    };
  }

  // azure-devops/src/features/assigned-to-me-stacked/card-folding.ts
  var FOLDED_CLASS = "fix-ado-assigned-folded", FOLD_BUTTON_SELECTOR2 = ".repos-pr-section-expand-button";
  function listenToFoldButton(button2, tabId, folding) {
    button2.dataset.fixAdoFoldTab !== tabId && (button2.dataset.fixAdoFoldTab = tabId, button2.addEventListener("click", () => {
      folding.onToggle(tabId);
    }));
  }
  function showCardFolding(card, tabId, folding) {
    let isFolded = folding.foldedTabIds.has(tabId);
    card.classList.contains(FOLDED_CLASS) !== isFolded && card.classList.toggle(FOLDED_CLASS, isFolded);
    let button2 = card.querySelector(FOLD_BUTTON_SELECTOR2);
    if (button2 === null)
      return;
    listenToFoldButton(button2, tabId, folding);
    let name = button2.getAttribute("aria-label") ?? "";
    showFoldToggleState(button2, !isFolded, { folded: name, name, open: name });
  }

  // azure-devops/src/features/assigned-to-me-stacked/stacked-tabs.ts
  function shownKey(tab, pullRequests, now) {
    return JSON.stringify([
      tab.id,
      pullRequests.map((pullRequest) => [
        pullRequest.pullRequestId,
        pullRequest.title,
        pullRequest.isDraft,
        pullRequest.mergeStatus,
        pullRequest.targetRefName,
        pullRequest.createdBy?.displayName,
        pullRequest.reviewers?.map(({ displayName, isRequired, vote }) => [
          displayName,
          isRequired,
          vote
        ]),
        relativeTime(Date.parse(pullRequest.creationDate ?? ""), now)
      ])
    ]);
  }
  function shownCard(document2, key) {
    return [...document2.querySelectorAll(`.${BUILT_CARD_CLASS}`)].find(
      (card) => card.dataset.fixAdoShown === key
    );
  }
  function createKeyedCard(found, { key, ...tabList }, context) {
    let card = createCard3(found, tabList, context);
    return card && (card.dataset.fixAdoShown = key, card.dataset.fixAdoTabId = tabList.tab.id), card;
  }
  function builtCard(found, tab, { assigned, context }) {
    let pullRequests = pullRequestsOnTab(assigned.pullRequests, assigned.reviewerId, tab.id);
    if (pullRequests.length === 0)
      return [];
    let key = shownKey(tab, pullRequests, context.now), card = shownCard(found.card.ownerDocument, key) ?? createKeyedCard(
      found,
      { key, pullRequests, tab },
      { ...context, reviewerId: assigned.reviewerId }
    );
    return card && showCardFolding(card, tab.id, context.folding), card ? [card] : [];
  }
  function placeAround(adoCard, ordered) {
    if (ordered.every(
      (node, index) => index === 0 || ordered[index - 1]?.nextElementSibling === node
    ))
      return;
    let adoIndex = ordered.indexOf(adoCard);
    for (let node of ordered.slice(0, adoIndex))
      adoCard.before(node);
    let previous = adoCard;
    for (let node of ordered.slice(adoIndex + 1))
      previous.after(node), previous = node;
  }
  function removeStacking(document2, kept) {
    for (let card of document2.querySelectorAll(`.${BUILT_CARD_CLASS}`))
      kept.includes(card) || card.remove();
    if (kept.length === 0)
      for (let card of document2.querySelectorAll(`.${STACKED_CLASS}`))
        card.querySelector(`.${TAB_NAME_CLASS}`)?.remove(), card.classList.remove(STACKED_CLASS), delete card.dataset.fixAdoTabName;
  }
  function markAsStacked({ card, tabs }) {
    let selected = tabs.find(({ isSelected }) => isSelected);
    selected && showTabName(card, tabNameOf(selected.element)), card.classList.contains(STACKED_CLASS) || card.classList.add(STACKED_CLASS);
  }
  function showFoldedCard(document2, assigned, folding) {
    let folded = document2.querySelector(`.${STACKED_CLASS}`), tabName = folded ? shownTabName(folded) : null;
    if (assigned === null || folded === null || tabName === null)
      return removeStacking(document2, []), "none";
    showTabName(folded, tabName);
    for (let card of document2.querySelectorAll(`.${BUILT_CARD_CLASS}`))
      showCardFolding(card, card.dataset.fixAdoTabId ?? "", folding);
    return "folded";
  }
  function showStackedTabs(document2, assigned, context) {
    let found = findAssignedCard(document2);
    if (found === null || assigned === null)
      return showFoldedCard(document2, assigned, context.folding);
    let ordered = found.tabs.flatMap(
      (tab) => tab.isSelected ? [found.card] : builtCard(found, tab, { assigned, context })
    );
    return removeStacking(document2, ordered), placeAround(found.card, ordered), markAsStacked(found), "stacked";
  }

  // azure-devops/src/features/assigned-to-me-stacked/style.css
  var style_default16 = `/* The "Assigned to me" card, one card per tab. stacked-tabs.ts marks Azure DevOps's card and
   builds the others; each card's title names its tab, so the tab bars have no job left. */
.fix-ado-assigned-stacked .repos-pr-section-tabs,
.fix-ado-assigned-card .repos-pr-section-tabs {
  display: none;
}

/* Without its tab bar, a header with tabs gets the bottom padding of one without. */
.fix-ado-assigned-stacked .repos-pr-section-header.with-tabs,
.fix-ado-assigned-card .repos-pr-section-header.with-tabs {
  padding-bottom: 16px;
}

/* A folded card's title shows the count of all its tabs; the tab's own count replaces it. */
.fix-ado-assigned-stacked .repos-pr-section-header-title > .bolt-pill {
  display: none;
}

/* "· Waiting for author" and its count, after the card's title. */
.fix-ado-assigned-tab-name {
  display: inline-flex;
  align-items: center;
  margin-inline-start: 0.3em;
}

/* A built card the owner folded with its fold button. card-folding.ts marks it. */
.fix-ado-assigned-folded .bolt-card-content {
  display: none;
}

/* While the script unfolds Azure DevOps's folded card for a moment, its list and tabs stay
   out of sight. The list keeps its width, so Azure DevOps lays out its columns. */
.fix-ado-assigned-peeking .bolt-card-content,
.fix-ado-assigned-peeking .repos-pr-section-tabs {
  visibility: hidden;
  max-height: 0;
  overflow: hidden;
}
`;

  // azure-devops/src/features/assigned-to-me-stacked/index.ts
  var FOLDED_TABS_KEY = "assigned-to-me-folded-tabs", CARD_TITLE_KEY = "assigned-to-me-card-title", ASSIGNED_REFRESH_INTERVAL_MS = 6e4;
  function repositoryOf(page) {
    if (page.kind === "pull-request-list") {
      let { project, repository } = page.listPage;
      return { project, repository };
    }
    return page.kind === "pull-request-inbox" ? null : void 0;
  }
  var CARD_TITLES = {
    get: () => GM_getValue(CARD_TITLE_KEY, ""),
    set: (title) => {
      GM_setValue(CARD_TITLE_KEY, title);
    }
  };
  function shownKeyOf({ pullRequests }) {
    return JSON.stringify(
      pullRequests.map((pullRequest) => [
        pullRequest.pullRequestId,
        pullRequest.title,
        pullRequest.isDraft,
        pullRequest.mergeStatus,
        pullRequest.reviewers?.map(({ id, vote, isRequired }) => [id, vote, isRequired])
      ])
    );
  }
  function createCardFolding(onChange) {
    let foldedTabIds = new Set(GM_getValue(FOLDED_TABS_KEY, []));
    return {
      foldedTabIds,
      onToggle(tabId) {
        foldedTabIds.delete(tabId) || foldedTabIds.add(tabId), GM_setValue(FOLDED_TABS_KEY, [...foldedTabIds]), onChange();
      }
    };
  }
  var assignedToMeStacked = {
    change: { kind: "new", version: "1.25.0" },
    description: "The tabs of the Assigned to me card as cards of their own, under each other, each titled with its tab, so you scroll through them all.",
    id: "assigned-to-me-stacked",
    name: "Assigned to me tabs under each other",
    start({ basePath: basePath2, client, document: document2, now }) {
      let assigned = null, nextFetchAt = 0, isFetching = !1, shownScope = null, folding = createCardFolding(() => {
        show3(shownScope);
      }), peek = createCardPeek(now, CARD_TITLES);
      async function fetchAssigned(repository, scope) {
        isFetching = !0;
        try {
          let reviewerId = await client.getAuthenticatedUserId();
          if (reviewerId !== null) {
            let { pullRequests } = await client.getPullRequestsAssignedTo(reviewerId, repository);
            assigned = { scope, value: { pullRequests, reviewerId } };
          }
          nextFetchAt = now() + ASSIGNED_REFRESH_INTERVAL_MS;
        } catch {
          nextFetchAt = now() + FAILED_REQUEST_RETRY_MS;
        } finally {
          isFetching = !1;
        }
      }
      function show3(scope) {
        shownScope = scope;
        let shown = scope !== null && assigned?.scope === scope ? assigned.value : null, status = showStackedTabs(document2, shown, { basePath: basePath2, folding, now: now() });
        peek.sync(document2, status, shown === null ? null : shownKeyOf(shown));
      }
      return {
        sync({ page, isTabActive: isTabActive2 }) {
          let repository = repositoryOf(page), scope = repository === void 0 ? null : JSON.stringify(repository);
          show3(scope);
          let isDue = assigned?.scope !== scope || now() >= nextFetchAt;
          repository !== void 0 && scope !== null && isTabActive2 && isDue && !isFetching && fetchAssigned(repository, scope).then(() => {
            show3(scope);
          });
        }
      };
    },
    styles: [style_default16]
  };

  // azure-devops/src/features/linked-work-item/linked-work-item-fetcher.ts
  var LINKED_WORK_ITEMS_REFRESH_INTERVAL_MS = 3e5;
  async function fetchLinkedWorkItems(client, pullRequest) {
    let ids = await client.getPullRequestWorkItemIds(pullRequest), [id] = ids, title = ids.length === 1 && id !== void 0 ? await client.getWorkItemTitle(id) : null;
    return { ids, title };
  }
  function createLinkedWorkItemFetcher(options) {
    let fetched = /* @__PURE__ */ new Map(), isFetching = !1;
    function duePullRequests2() {
      let due = /* @__PURE__ */ new Map();
      for (let pullRequest of options.findPullRequests())
        (fetched.get(pullRequest.pullRequestId)?.nextFetchAt ?? 0) <= options.now() && due.set(pullRequest.pullRequestId, pullRequest);
      return [...due.values()];
    }
    async function fetchOne(pullRequest) {
      let { pullRequestId } = pullRequest;
      try {
        let linkedWorkItems = await fetchLinkedWorkItems(options.client, pullRequest);
        fetched.set(pullRequestId, {
          linkedWorkItems,
          nextFetchAt: options.now() + LINKED_WORK_ITEMS_REFRESH_INTERVAL_MS
        });
      } catch {
        fetched.set(pullRequestId, {
          linkedWorkItems: fetched.get(pullRequestId)?.linkedWorkItems ?? null,
          nextFetchAt: options.now() + FAILED_REQUEST_RETRY_MS
        });
      }
    }
    return {
      linkedWorkItems: (pullRequestId) => fetched.get(pullRequestId)?.linkedWorkItems ?? null,
      async sync() {
        if (!isFetching) {
          isFetching = !0;
          try {
            for (let pullRequest of duePullRequests2())
              await fetchOne(pullRequest);
          } finally {
            isFetching = !1;
          }
        }
      }
    };
  }

  // azure-devops/src/features/linked-work-item/work-item-groups.ts
  var MULTIPLE_KEY = "multiple", NONE_KEY = "none";
  function groupOf({ ids, title }) {
    let [id] = ids;
    return id === void 0 ? { key: NONE_KEY, label: "No work item", title: null, workItemId: null } : ids.length > 1 ? { key: MULTIPLE_KEY, label: "Multiple work items", title: null, workItemId: null } : { key: String(id), label: `#${id}`, title, workItemId: id };
  }
  function groupByWorkItem(rows) {
    let groups = /* @__PURE__ */ new Map();
    for (let { row, linked } of rows) {
      let group2 = groupOf(linked), shown = groups.get(group2.key) ?? { ...group2, rows: [] };
      shown.rows.push(row), groups.set(group2.key, shown);
    }
    let isLast = (key) => key === MULTIPLE_KEY || key === NONE_KEY;
    return [
      ...[...groups.values()].filter(({ key }) => !isLast(key)),
      ...[MULTIPLE_KEY, NONE_KEY].flatMap((key) => groups.get(key) ?? [])
    ];
  }

  // azure-devops/src/features/linked-work-item/linked-work-item.ts
  function linkedWorkItemLabel({ ids, title }) {
    let [id] = ids;
    return id === void 0 ? null : ids.length > 1 ? { text: "Multiple work items", tooltip: ids.map((each) => `#${each}`).join(", ") } : { text: `#${id}`, tooltip: title };
  }

  // azure-devops/src/core/list-switch.css
  var list_switch_default = `/* A switch on the pull request lists. switch.css styles the switch; list-switch.ts places it. */
.bolt-tabbar > .fix-ado-switch {
  margin: 0 8px;
}

/* The inbox has no tab bar, so its switches get a bar of their own above the lists. */
.fix-ado-list-switch-bar {
  display: flex;
  justify-content: flex-end;
}
`;

  // azure-devops/src/core/list-switch.ts
  var BAR_CLASS = "fix-ado-list-switch-bar", TABBAR_SELECTOR4 = ".bolt-tabbar:has(> .bolt-tabbar-tabs)", PAGE_CONTENT_SELECTOR = ".page-content", onToggleBySwitch = /* @__PURE__ */ new WeakMap();
  function createListSwitch(document2, { className, label }) {
    let toggle = createSwitch(document2, label);
    return toggle.classList.add(className), toggle.addEventListener("click", () => {
      onToggleBySwitch.get(toggle)?.();
    }), toggle;
  }
  function placeInTabbar(document2, toggle) {
    let tabbar = document2.querySelector(TABBAR_SELECTOR4);
    if (tabbar === null)
      return !1;
    if (toggle.parentElement === tabbar)
      return !0;
    let buttons = tabbar.querySelector(":scope > .bolt-header-commandbar");
    return buttons === null ? tabbar.append(toggle) : buttons.before(toggle), !0;
  }
  function barAboveLists(content) {
    let bar = content.querySelector(`:scope > .${BAR_CLASS}`) ?? Object.assign(content.ownerDocument.createElement("div"), { className: BAR_CLASS });
    return content.firstElementChild !== bar && content.prepend(bar), bar;
  }
  function placeAboveLists(document2, toggle) {
    let content = document2.querySelector(PAGE_CONTENT_SELECTOR);
    if (content === null) {
      toggle.remove();
      return;
    }
    let bar = barAboveLists(content);
    toggle.parentElement !== bar && bar.append(toggle);
  }
  function removeListSwitch(document2, { className }) {
    document2.querySelector(`.${className}`)?.remove();
    let bar = document2.querySelector(`.${BAR_CLASS}`);
    bar !== null && bar.childElementCount === 0 && bar.remove();
  }
  function showListSwitch(document2, listSwitch, state) {
    if (state === null) {
      removeListSwitch(document2, listSwitch);
      return;
    }
    let toggle = document2.querySelector(`.${listSwitch.className}`) ?? createListSwitch(document2, listSwitch);
    placeInTabbar(document2, toggle) || placeAboveLists(document2, toggle), onToggleBySwitch.set(toggle, state.onToggle), showSwitchOn(toggle, state.isOn);
  }

  // azure-devops/src/features/linked-work-item/work-item-group-rows.ts
  var GROUP_ROW_CLASS = "fix-ado-work-item-group", PULL_REQUEST_ROW_SELECTOR2 = ':scope > a.bolt-table-row[href*="/pullrequest/"]';
  function placeBefore(list, node, before) {
    node.parentNode === list ? list.moveBefore(node, before) : before === null ? list.append(node) : before.before(node);
  }
  function placeInOrder(list, ordered, shown) {
    if (ordered.length === shown.length && ordered.every((node, index) => node === shown[index]))
      return;
    let after = shown.at(-1)?.nextSibling ?? null;
    for (let node of ordered)
      placeBefore(list, node, after);
  }
  function createGroupRow(list, key) {
    let { ownerDocument } = list, row = ownerDocument.createElement("tr");
    row.className = GROUP_ROW_CLASS, row.dataset.fixAdoWorkItemGroup = key;
    let cell2 = ownerDocument.createElement("td");
    return cell2.colSpan = list.closest("table")?.querySelectorAll("col").length ?? 1, row.append(cell2), row;
  }
  function groupRowFor(list, key) {
    return [
      ...list.querySelectorAll(`:scope > .${GROUP_ROW_CLASS}`)
    ].find((row) => row.dataset.fixAdoWorkItemGroup === key) ?? createGroupRow(list, key);
  }
  var workItemHref = (basePath2, workItemId) => workItemId === null ? null : `${basePath2}/_workitems/edit/${workItemId}`;
  function createGroupTitle(document2, href, { label, title }) {
    if (href === null)
      return [Object.assign(document2.createElement("span"), { textContent: label })];
    let link = Object.assign(document2.createElement("a"), { textContent: label });
    if (link.setAttribute("href", href), link.target = "_blank", link.rel = "noopener", title === null)
      return [link];
    let titleText = Object.assign(document2.createElement("span"), {
      className: "fix-ado-work-item-group-title",
      textContent: title
    });
    return [link, " ", titleText];
  }
  function showGroupTitle(row, basePath2, group2) {
    let [cell2] = row.cells, href = workItemHref(basePath2, group2.workItemId), shown = JSON.stringify([href, group2.label, group2.title]);
    cell2 === void 0 || row.dataset.fixAdoShownTitle === shown || (cell2.replaceChildren(...createGroupTitle(row.ownerDocument, href, group2)), row.dataset.fixAdoShownTitle = shown);
  }
  var rowIndex = (row) => Number(row.getAttribute("aria-rowindex"));
  function orderedNodes(list, basePath2, groups) {
    return groups === null ? [...list.querySelectorAll(PULL_REQUEST_ROW_SELECTOR2)].toSorted(
      (first, second) => rowIndex(first) - rowIndex(second)
    ) : groups.flatMap((group2) => {
      let groupRow = groupRowFor(list, group2.key);
      return showGroupTitle(groupRow, basePath2, group2), [groupRow, ...group2.rows];
    });
  }
  function showWorkItemGroups(list, basePath2, groups) {
    let shownGroupRows = [...list.querySelectorAll(`:scope > .${GROUP_ROW_CLASS}`)];
    if (groups === null && shownGroupRows.length === 0)
      return;
    let managed = /* @__PURE__ */ new Set([...shownGroupRows, ...list.querySelectorAll(PULL_REQUEST_ROW_SELECTOR2)]), shown = [...list.children].filter((child) => managed.has(child)), ordered = orderedNodes(list, basePath2, groups), kept = new Set(ordered);
    for (let groupRow of shownGroupRows.filter((row) => !kept.has(row)))
      groupRow.remove();
    placeInOrder(
      list,
      ordered,
      shown.filter((node) => node.isConnected)
    );
  }

  // azure-devops/src/features/linked-work-item/style.css
  var style_default17 = `/* The linked work item at the end of the line under a pull request's title. pr-list.ts adds it. */
.fix-ado-linked-work-item::before {
  content: "·";
  margin-inline: 0.5em;
}

/* A group's title row in a pull request list: its work item's id as a link, then its title.
   work-item-group-rows.ts adds it. A slight grey from the theme's text colour, so it works in
   Light and Dark, and sets it apart from the pull requests under it. */
.fix-ado-work-item-group {
  background-color: rgba(var(--palette-neutral-100, 0, 0, 0), 0.03);
}

/* Windows 98 mode: the white field with a touch of the light face grey. */
html[data-fix-ado-win98] .fix-ado-work-item-group {
  background-color: color-mix(in oklab, var(--win98-light) 30%, var(--win98-field-face));
}

.fix-ado-work-item-group > td {
  padding: 8px 16px;
  /* A line above each group, stronger than the lines between rows, to divide the groups. */
  border-top: 1px solid rgba(var(--palette-neutral-100, 0, 0, 0), 0.2);
}

/* No line between a group's title and its first pull request. Transparent, so the row keeps
   its height. */
.fix-ado-work-item-group + a.bolt-table-row > .bolt-table-cell {
  border-top-color: transparent;
}

.fix-ado-work-item-group a {
  color: var(--communication-foreground, rgb(0, 90, 158));
}

/* The work item's title after its id: grey, so the group row does not shout. */
.fix-ado-work-item-group-title {
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
}
`;

  // azure-devops/src/features/linked-work-item/index.ts
  var IS_GROUPED_KEY = "linked-work-item-grouped", LIST_SELECTOR = "table.repos-pr-list > tbody", GROUP_SWITCH = { className: "fix-ado-group-toggle", label: "Group by work item" };
  function groupsOf2(rows, fetcher) {
    let linkedRows = [];
    for (let { row, pullRequest } of rows) {
      let linked = fetcher.linkedWorkItems(pullRequest.pullRequestId);
      if (linked === null)
        return null;
      linkedRows.push({ linked, row });
    }
    return groupByWorkItem(linkedRows);
  }
  function showLinkedWorkItemLabels(rows, fetcher, isGrouped) {
    for (let { row, pullRequest } of rows) {
      let linked = isGrouped ? null : fetcher.linkedWorkItems(pullRequest.pullRequestId);
      showLinkedWorkItem(row, linked === null ? null : linkedWorkItemLabel(linked));
    }
  }
  var linkedWorkItem = {
    change: { kind: "updated", version: "1.27.0" },
    description: "The id of the work item linked to each pull request in a list, under its title, with its title on hover. Multiple work items when there are more. A switch groups the lists by work item, each under its work item's id and title on a grey row.",
    id: "linked-work-item",
    name: "Linked work item",
    start({ basePath: basePath2, client, document: document2, now }) {
      let findRows = (root) => findPullRequestRows(root, basePath2), fetcher = createLinkedWorkItemFetcher({
        client,
        findPullRequests: () => findRows(document2).map(({ pullRequest }) => pullRequest),
        now
      }), isGrouped = GM_getValue(IS_GROUPED_KEY, !1), isList = !1;
      function showAll() {
        for (let list of document2.querySelectorAll(LIST_SELECTOR)) {
          let rows = findRows(list), groups = isList && isGrouped ? groupsOf2(rows, fetcher) : null;
          showWorkItemGroups(list, basePath2, groups), showLinkedWorkItemLabels(rows, fetcher, groups !== null);
        }
        showListSwitch(
          document2,
          GROUP_SWITCH,
          isList ? { isOn: isGrouped, onToggle: toggleGroups } : null
        );
      }
      function toggleGroups() {
        isGrouped = !isGrouped, GM_setValue(IS_GROUPED_KEY, isGrouped), showAll();
      }
      return {
        sync({ page, isTabActive: isTabActive2 }) {
          isList = page.kind === "pull-request-list" || page.kind === "pull-request-inbox", showAll(), isList && isTabActive2 && fetcher.sync().then(showAll);
        }
      };
    },
    styles: [switch_default, list_switch_default, style_default17]
  };

  // azure-devops/src/features/one-line-rows/one-line-rows.ts
  var ONE_LINE_ATTRIBUTE = "data-fix-ado-one-line";
  function showOneLineRows(document2, isOneLine) {
    let root = document2.documentElement;
    root.hasAttribute(ONE_LINE_ATTRIBUTE) !== isOneLine && root.toggleAttribute(ONE_LINE_ATTRIBUTE, isOneLine);
  }
  function isWindows98Mode(document2) {
    return Object.hasOwn(document2.documentElement.dataset, "fixAdoWin98");
  }

  // azure-devops/src/features/one-line-rows/style.css
  var style_default18 = `/* Each pull request on one line, as design B. one-line-rows.ts marks <html> on a list page while
   the One line switch is on. Windows 98 mode lays the rows out itself, so it is left alone. */
:root[data-fix-ado-one-line]:not([data-fix-ado-win98]) .repos-pr-list {
  /* The columns after the spacer: author, title, reviewers, comments, time. */
  & > colgroup > col:nth-child(2) {
    width: 32px !important;
  }

  & > colgroup > col:nth-child(4) {
    width: 112px !important;
  }

  & > colgroup > col:nth-child(5) {
    width: 60px !important;
  }

  & > colgroup > col:nth-child(6) {
    width: 148px !important;
  }

  & .bolt-list-cell {
    height: 32px;
  }

  /* Azure DevOps pads each cell 9px 12px. */
  & .bolt-table-cell-content {
    padding-block: 0;
    padding-inline: 6px;
  }

  /* The row's More button: 24px, as its 34px would make the row taller. */
  & .bolt-table-cell-side-action .bolt-button {
    padding: 4px;
  }

  /* The author, and each reviewer: 20px avatars. The initials scale with the size. */
  & :is([aria-colindex="1"], .pr-reviewer) :is(.bolt-coin, .bolt-coin-content) {
    --fix-ado-avatar-size: 20px !important;
    width: 20px;
    height: 20px;
  }

  /* The title, then the line under it to its right, which takes the space left. */
  & .bolt-table-two-line-cell > .bolt-table-cell-content {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }

  & .bolt-table-two-line-cell-item:first-child {
    flex: 0 1 auto;
    min-width: 0;
  }

  & .bolt-table-two-line-cell-item:nth-child(2) {
    flex: 1 1 0;
    min-width: 0;
  }

  /* A step under Azure DevOps's sizes: titles 14px for its 15px, comments and time 13px for
     its 14px. The line under the title keeps its 12px. */
  & .bolt-table-two-line-cell-item .body-l {
    font-size: 14px;
  }

  & :is([aria-colindex="4"], [aria-colindex="5"]) .bolt-table-cell-content {
    font-size: 13px;
  }

  /* The pipeline status before the title. */
  & .fix-ado-pipeline-status {
    order: -1;
    width: 14px;
    height: 14px;
    margin: 0 8px 0 0;
  }

  /* Reviewers overlap, each with a ring in the row's colour. Required ones glow less. */
  & :is(.rhythm-horizontal-8, [data-fix-ado-reviewers]) > .pr-reviewer {
    margin: 0 -4px 0 0 !important;
  }

  /* A row, so the vote icon's empty wrapper sits beside the avatar instead of on a line
     under it. The icon itself is placed on the reviewer as before. */
  & .pr-reviewer {
    display: flex;
  }

  & .pr-reviewer .bolt-coin {
    border-radius: 50%;
    box-shadow: 0 0 0 1.5px var(--background-color, #fff);
  }

  & .pr-reviewer[data-fix-ado-required] .bolt-coin {
    box-shadow:
      0 0 0 1.5px var(--background-color, #fff),
      0 0 0 3px var(--communication-background, rgb(0, 120, 212));
  }

  /* Group by work item's group titles: 12px, as the line under a title. */
  & .fix-ado-work-item-group > td {
    font-size: 12px;
  }

  /* The time: the publish time alone when it shows, as it says more than the update time. */
  & [aria-colindex="5"] .bolt-table-cell-content {
    justify-content: flex-end;
  }

  & .bolt-table-cell-content:has(> .fix-ado-published-since) {
    flex-direction: row;
    align-items: center;

    & > :not(.fix-ado-published-since) {
      display: none;
    }
  }
}

/* Forced colors drop box shadows, so a required reviewer keeps an outline. */
@media (forced-colors: active) {
  :root[data-fix-ado-one-line]:not([data-fix-ado-win98])
    .repos-pr-list
    .pr-reviewer[data-fix-ado-required]
    .bolt-coin {
    outline: 2px solid Highlight;
    outline-offset: 1px;
  }
}
`;

  // azure-devops/src/features/one-line-rows/index.ts
  var IS_ONE_LINE_KEY = "one-line-rows-on", ONE_LINE_SWITCH = { className: "fix-ado-one-line-switch", label: "One line" }, oneLineRows = {
    change: { kind: "new", version: "1.27.0" },
    description: "Each pull request in a list on one line, so more of them fit on the screen. A One line switch on the lists flips between one line and Azure DevOps's two. Not in Windows 98 mode.",
    id: "one-line-rows",
    name: "Pull requests on one line",
    start({ document: document2 }) {
      let isOneLine = GM_getValue(IS_ONE_LINE_KEY, !1), isList = !1;
      function show3() {
        showOneLineRows(document2, isList && isOneLine), showListSwitch(
          document2,
          ONE_LINE_SWITCH,
          isList ? { isOn: isOneLine, onToggle: toggle } : null
        );
      }
      function toggle() {
        isOneLine = !isOneLine, GM_setValue(IS_ONE_LINE_KEY, isOneLine), show3();
      }
      return {
        sync({ page }) {
          isList = (page.kind === "pull-request-list" || page.kind === "pull-request-inbox") && !isWindows98Mode(document2), show3();
        }
      };
    },
    styles: [switch_default, list_switch_default, style_default18]
  };

  // azure-devops/src/features/pipeline-status/index.ts
  var pipelineStatusOnPullRequests = {
    change: { kind: "new", version: "1.7.2" },
    description: "A pipeline status icon on each pull request in a list.",
    id: "pipeline-status",
    name: "Pipeline status on pull requests",
    start({ basePath: basePath2, client, document: document2, now }) {
      let poller = createPipelineStatusPoller({
        client,
        findRows: () => findPullRequestRows(document2, basePath2),
        now,
        showStatus: showPipelineStatus
      });
      return {
        sync({ isTabActive: isTabActive2 }) {
          isTabActive2 && poller.sync();
        }
      };
    },
    styles: [pipeline_status_icon_default]
  };

  // azure-devops/src/features/published-since/published-since.ts
  var relativeTime2 = new Intl.RelativeTimeFormat("en", { numeric: "always" }), isDraftUpdate = (thread) => thread.isDeleted !== !0 && thread.properties?.CodeReviewThreadType?.$value === "IsDraftUpdate" && thread.publishedDate !== void 0;
  function publishedAt(creationDate, threads) {
    let draftUpdates = threads.filter((thread) => isDraftUpdate(thread)).map((thread) => Date.parse(thread.publishedDate ?? ""));
    return draftUpdates.length > 0 ? Math.max(...draftUpdates) : Date.parse(creationDate);
  }
  function publishedSinceText(publishedAtMs, nowMs) {
    let elapsed = nowMs - publishedAtMs;
    if (elapsed < 6e4)
      return "Published just now";
    let [count, unit] = largestWholeUnit(elapsed);
    return `Published ${relativeTime2.format(-count, unit)}`;
  }
  function largestWholeUnit(elapsedMs) {
    let days = Math.floor(elapsedMs / 864e5);
    return days >= 365 ? [Math.floor(days / 365), "year"] : days >= 30 ? [Math.floor(days / 30), "month"] : days >= 1 ? [days, "day"] : elapsedMs >= 36e5 ? [Math.floor(elapsedMs / 36e5), "hour"] : [Math.floor(elapsedMs / 6e4), "minute"];
  }
  function weekdayTimeBetween(fromMs, toMs) {
    let total = 0, start = fromMs;
    for (; start < toMs; ) {
      let day = new Date(start), nextMidnight = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime(), end = Math.min(nextMidnight, toMs);
      day.getDay() !== 0 && day.getDay() !== 6 && (total += end - start), start = end;
    }
    return total;
  }
  function isPublishedTooLongAgo(publishedAtMs, nowMs) {
    return weekdayTimeBetween(publishedAtMs, nowMs) > 1728e5;
  }
  function showsPublishedSince(page) {
    return page.kind === "pull-request-inbox" || page.kind === "pull-request-list" && page.listPage.status === "active";
  }

  // azure-devops/src/features/published-since/published-at-fetcher.ts
  var PUBLISHED_AT_REFRESH_INTERVAL_MS = 6e5;
  async function fetchPublishedAt(client, pullRequest) {
    let threads = await client.getPullRequestThreads(pullRequest), creationDate = threads.some(
      (thread) => thread.properties?.CodeReviewThreadType?.$value === "IsDraftUpdate"
    ) ? "" : await client.getPullRequestCreationDate(pullRequest);
    return publishedAt(creationDate, threads);
  }
  function createPublishedAtFetcher(options) {
    let fetched = /* @__PURE__ */ new Map(), isFetching = !1;
    function duePullRequests2() {
      let due = /* @__PURE__ */ new Map();
      for (let { pullRequest, isDraft } of options.findRows())
        isDraft ? fetched.delete(pullRequest.pullRequestId) : (fetched.get(pullRequest.pullRequestId)?.nextFetchAt ?? 0) <= options.now() && due.set(pullRequest.pullRequestId, pullRequest);
      return [...due.values()];
    }
    async function fetchOne(pullRequest) {
      let { pullRequestId } = pullRequest;
      try {
        let at = await fetchPublishedAt(options.client, pullRequest);
        fetched.set(pullRequestId, {
          nextFetchAt: options.now() + PUBLISHED_AT_REFRESH_INTERVAL_MS,
          publishedAt: at
        });
      } catch {
        fetched.set(pullRequestId, {
          nextFetchAt: options.now() + FAILED_REQUEST_RETRY_MS,
          publishedAt: fetched.get(pullRequestId)?.publishedAt ?? null
        });
      }
    }
    return {
      publishedAt: (pullRequestId) => fetched.get(pullRequestId)?.publishedAt ?? null,
      async sync() {
        if (!isFetching) {
          isFetching = !0;
          try {
            for (let pullRequest of duePullRequests2())
              await fetchOne(pullRequest);
          } finally {
            isFetching = !1;
          }
        }
      }
    };
  }

  // azure-devops/src/features/published-since/style.css
  var style_default19 = `/* The publish time under the update time in pull request lists. pr-list.ts adds the line. */
.bolt-table-cell-content:has(> .fix-ado-published-since) {
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
}

.fix-ado-published-since {
  white-space: nowrap;
}

.fix-ado-published-since-too-long {
  color: var(--status-error-text);
}
`;

  // azure-devops/src/features/published-since/index.ts
  var publishedSince = {
    change: { kind: "updated", version: "1.17.1" },
    description: "How long ago each active pull request in a list left draft, under its update time. Red after two weekdays.",
    id: "published-since",
    name: "Published since",
    start({ basePath: basePath2, client, document: document2, now }) {
      let findRows = () => findPullRequestRows(document2, basePath2).map(({ row, pullRequest }) => ({
        isDraft: isDraftRow(row),
        pullRequest,
        row
      })), fetcher = createPublishedAtFetcher({ client, findRows, now });
      function showAll(isShown) {
        for (let { row, pullRequest, isDraft } of findRows()) {
          let at = isShown && !isDraft ? fetcher.publishedAt(pullRequest.pullRequestId) : null;
          showPublishedSince(
            row,
            at === null ? null : {
              isTooLongAgo: isPublishedTooLongAgo(at, now()),
              text: publishedSinceText(at, now())
            }
          );
        }
      }
      return {
        sync({ page, isTabActive: isTabActive2 }) {
          let isShown = showsPublishedSince(page);
          showAll(isShown), isShown && isTabActive2 && fetcher.sync().then(() => {
            showAll(isShown);
          });
        }
      };
    },
    styles: [style_default19]
  };

  // azure-devops/src/features/required-reviewers/reviewer-fetcher.ts
  var REVIEWER_REFRESH_INTERVAL_MS = 12e4, listKey = ({ project, repository }, status) => JSON.stringify([project, repository, status]);
  function dueRepositories(options, nextFetchAtByList) {
    let status = options.listStatus(), due = /* @__PURE__ */ new Map();
    for (let pullRequest of options.findPullRequests()) {
      let key = listKey(pullRequest, status);
      (nextFetchAtByList.get(key) ?? 0) <= options.now() && due.set(key, pullRequest);
    }
    return [...due.values()];
  }
  function createReviewerFetcher(options) {
    let nextFetchAtByList = /* @__PURE__ */ new Map(), isFetching = !1;
    async function fetchRepository(pullRequest) {
      let status = options.listStatus(), key = listKey(pullRequest, status);
      try {
        let { pullRequests } = await options.client.getPullRequests({
          project: pullRequest.project,
          repository: pullRequest.repository,
          status
        });
        for (let listed of pullRequests)
          options.reviewersByPullRequestId.set(listed.pullRequestId, listed.reviewers ?? []);
        nextFetchAtByList.set(key, options.now() + REVIEWER_REFRESH_INTERVAL_MS);
      } catch {
        nextFetchAtByList.set(key, options.now() + FAILED_REQUEST_RETRY_MS);
      }
    }
    return {
      async sync() {
        if (!isFetching) {
          isFetching = !0;
          try {
            for (let pullRequest of dueRepositories(options, nextFetchAtByList))
              await fetchRepository(pullRequest);
          } finally {
            isFetching = !1;
          }
        }
      }
    };
  }

  // azure-devops/src/features/required-reviewers/required-reviewers.ts
  function createRequiredReviewerMarker(options) {
    let reviewersByPullRequestId = /* @__PURE__ */ new Map(), reviewerFetcher = createReviewerFetcher({
      client: options.client,
      findPullRequests: () => options.findRows().map(({ pullRequest }) => pullRequest),
      listStatus: options.listStatus,
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
      async sync() {
        await reviewerFetcher.sync(), markAll();
      }
    };
  }

  // azure-devops/src/features/required-reviewers/style.css
  var style_default20 = `/* Required reviewers in the pull request list. pr-list.ts sets the data attributes. */

/* A glow that spills outside the circle, so the circle keeps its full size. */
.pr-reviewer[data-fix-ado-required] .bolt-coin {
  border-radius: 50%;
  box-shadow:
    0 0 0 2px var(--communication-background, rgb(0, 120, 212)),
    0 0 6px 3px var(--communication-background, rgb(0, 120, 212));
}

/* Forced colors drop box shadows, so the glow becomes an outline there. */
@media (forced-colors: active) {
  .pr-reviewer[data-fix-ado-required] .bolt-coin {
    outline: 2px solid Highlight;
    outline-offset: 1px;
  }
}

/* Required reviewers first. Even spacing whatever the visual order. */
[data-fix-ado-reviewers] > .pr-reviewer {
  margin: 0 8px 0 0 !important;
}

[data-fix-ado-reviewers] > .pr-reviewer[data-fix-ado-required] {
  order: -1;
}
`;

  // azure-devops/src/features/required-reviewers/index.ts
  var requiredReviewers = {
    change: { kind: "new", version: "1.7.2" },
    description: "Required reviewers come first in pull request lists, with a glow.",
    id: "required-reviewers",
    name: "Required reviewers first",
    start({ basePath: basePath2, client, document: document2, now }) {
      let shownPage = { kind: "other" }, marker = createRequiredReviewerMarker({
        client,
        findRows: () => findPullRequestRows(document2, basePath2),
        listStatus: () => shownPage.kind === "pull-request-list" ? shownPage.listPage.status : "active",
        now
      });
      return {
        sync({ page, isTabActive: isTabActive2 }) {
          shownPage = page, marker.markAll(), (page.kind === "pull-request-list" || page.kind === "pull-request-inbox") && isTabActive2 && marker.sync();
        }
      };
    },
    styles: [style_default20]
  };

  // azure-devops/src/features/pull-request-list-features.ts
  var PULL_REQUEST_LIST_FEATURES = [
    pipelineStatusOnPullRequests,
    requiredReviewers,
    publishedSince,
    linkedWorkItem,
    assignedToMeStacked,
    oneLineRows
  ];

  // azure-devops/src/features/days-in-column/days-in-column.ts
  var CARD_SELECTOR3 = ".wit-card[data-itemid]", COLUMN_SELECTOR = ".kanban-board-column[data-column]", BAR_CLASS2 = "fix-ado-days-in-column";
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
    return bar.className = BAR_CLASS2, bar.dataset.days = String(days), bar.title = captionFor(days), days === null ? bar.setAttribute("aria-hidden", "true") : (bar.setAttribute("aria-label", bar.title), bar.setAttribute("role", "img")), bar.append(...dotsFor(document2, days)), bar;
  }
  function showDaysInColumn(card, days) {
    let existing = card.querySelector(`.${BAR_CLASS2}`);
    existing?.dataset.days !== String(days) && (existing?.remove(), (card.querySelector(".card-content") ?? card).append(createDotBar(card.ownerDocument, days)));
  }
  function findCards(document2) {
    let cards = /* @__PURE__ */ new Map();
    for (let card of document2.querySelectorAll(CARD_SELECTOR3)) {
      let id = Number(card.dataset.itemid);
      Number.isInteger(id) && id > 0 && cards.set(id, [...cards.get(id) ?? [], card]);
    }
    return cards;
  }
  function columnIdOf(card) {
    return card.closest(COLUMN_SELECTOR)?.dataset.column ?? null;
  }
  function noteMoves(tracker, cards) {
    for (let [id, [element4]] of cards) {
      let columnId = columnIdOf(element4), lastColumnId = tracker.columnIds.get(id), entry = tracker.entries.get(id);
      lastColumnId !== void 0 && lastColumnId !== columnId && entry !== void 0 && (entry.enteredAt = new Date(tracker.now()).toISOString()), tracker.columnIds.set(id, columnId);
    }
  }
  function showBars(tracker, cards) {
    noteMoves(tracker, cards);
    for (let [id, elements] of cards) {
      let entry = tracker.entries.get(id), enteredAt = entry?.enteredAt ?? null, days = null;
      entry !== void 0 && (days = enteredAt === null ? 0 : daysSince(enteredAt, tracker.now()));
      for (let element4 of elements)
        showDaysInColumn(element4, days);
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
  function isCheckDue2(tracker, ids) {
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
        isCheckDue2(tracker, ids) && (await check(tracker, ids), showBars(tracker, findCards(options.document)));
      }
    };
  }

  // azure-devops/src/features/days-in-column/days-in-column-toggle.ts
  var HEADER_SELECTOR3 = ".kanban-board-column-header", COLUMN_SELECTOR2 = ".kanban-board-column[data-column]", TOGGLE_CLASS5 = "fix-ado-days-toggle";
  function showColumnState(column, toggle, isHidden) {
    Object.hasOwn(column.dataset, "fixAdoDaysHidden") !== isHidden && (isHidden ? column.dataset.fixAdoDaysHidden = "" : delete column.dataset.fixAdoDaysHidden);
    let pressed = String(!isHidden);
    toggle.getAttribute("aria-pressed") !== pressed && (toggle.setAttribute("aria-pressed", pressed), toggle.title = isHidden ? "Show days in column" : "Hide days in column", toggle.setAttribute("aria-label", "Days in column"));
  }
  function createToggle3(document2, onClick3) {
    let toggle = document2.createElement("button");
    return toggle.type = "button", toggle.className = TOGGLE_CLASS5, toggle.append(...Array.from({ length: 3 }, () => document2.createElement("span"))), toggle.addEventListener("click", (event) => {
      event.preventDefault(), event.stopPropagation(), onClick3();
    }), toggle;
  }
  function findOrAddToggle2(header, onClick3) {
    let existing = header.querySelector(`.${TOGGLE_CLASS5}`);
    if (existing !== null)
      return existing;
    let toggle = createToggle3(header.ownerDocument, onClick3);
    return (header.querySelector(".justify-space-between > .flex-row") ?? header).append(toggle), toggle;
  }
  function createDaysInColumnToggles(options) {
    let { document: document2, storage } = options, hiddenColumnIds = new Set(storage.load());
    function flip2(columnId) {
      hiddenColumnIds.delete(columnId) || hiddenColumnIds.add(columnId), storage.save([...hiddenColumnIds]), sync4();
    }
    function sync4() {
      let headers = [...document2.querySelectorAll(HEADER_SELECTOR3)], columns = [...document2.querySelectorAll(COLUMN_SELECTOR2)];
      if (headers.length === columns.length)
        for (let [index, header] of headers.entries()) {
          let column = columns[index], columnId = column?.dataset.column;
          if (column !== void 0 && columnId !== void 0) {
            let toggle = findOrAddToggle2(header, () => {
              flip2(columnId);
            });
            showColumnState(column, toggle, hiddenColumnIds.has(columnId));
          }
        }
    }
    return { sync: sync4 };
  }

  // azure-devops/src/features/days-in-column/style.css
  var style_default21 = `/* Days in column on board cards: a dot per day, grey, then orange, then red. */
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

/* The days-in-column toggle in a column header. It shows while the header is hovered, or
   while something in it has keyboard focus. A click also focuses the toggle; that focus must
   not keep it showing once the pointer leaves. */
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

.kanban-board-column-header:is(:hover, :has(:focus-visible)) .fix-ado-days-toggle {
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

  // azure-devops/src/features/days-in-column/index.ts
  var HIDDEN_COLUMNS_KEY = "days-in-column-hidden-columns", daysInColumn = {
    change: { kind: "new", version: "1.7.2" },
    description: "A dot per day a card has been in its board column, with a toggle per column.",
    id: "days-in-column",
    name: "Days in column",
    start({ client, document: document2, now }) {
      let days = createDaysInColumn({ client, document: document2, now }), toggles = createDaysInColumnToggles({
        document: document2,
        storage: {
          load: () => GM_getValue(HIDDEN_COLUMNS_KEY, []),
          save: (columnIds) => {
            GM_setValue(HIDDEN_COLUMNS_KEY, columnIds);
          }
        }
      });
      return {
        sync({ page, isTabActive: isTabActive2 }) {
          page.kind === "board" && (toggles.sync(), isTabActive2 && days.sync());
        }
      };
    },
    styles: [style_default21]
  };

  // azure-devops/src/features/index.ts
  var FEATURES_BY_CATEGORY = {
    Boards: [daysInColumn],
    Everywhere: EVERYWHERE_FEATURES,
    "Pull request": PULL_REQUEST_FEATURES,
    "Pull request Overview": OVERVIEW_FEATURES,
    "Pull request lists": PULL_REQUEST_LIST_FEATURES
  }, FEATURE_CATEGORIES = CATEGORY_NAMES.map((name) => ({
    features: FEATURES_BY_CATEGORY[name],
    name
  })), FEATURES = FEATURE_CATEGORIES.flatMap((category) => category.features);

  // azure-devops/src/core/feature-runner.ts
  function addStyles(features, addStyle) {
    for (let style of new Set(features.flatMap(({ styles }) => styles)))
      addStyle(style);
  }
  function startEach(options, features) {
    let started = [];
    for (let feature of features)
      try {
        let run = feature.start(options.context);
        run && started.push({ feature, run });
      } catch (error) {
        options.onError(feature, error);
      }
    return started;
  }
  function createFeatureRunner(options) {
    let features = options.features.filter(options.isOn);
    addStyles(features, options.addStyle);
    let started = startEach(options, features);
    return {
      sync(reason) {
        let tick = { isTabActive: options.isTabActive(), page: options.currentPage(), reason };
        for (let { feature, run } of started)
          try {
            run.sync?.(tick);
          } catch (error) {
            options.onError(feature, error);
          }
      }
    };
  }

  // azure-devops/src/core/settings-panel-markup.ts
  function element3(document2, tag, { className, text }) {
    let created = document2.createElement(tag);
    return created.className = className, text !== void 0 && (created.textContent = text), created;
  }
  function button(document2, parts, onClick3) {
    let created = element3(document2, "button", parts);
    return created.type = "button", created.addEventListener("click", onClick3), created;
  }

  // azure-devops/src/core/settings-button.ts
  var SETTINGS_TITLE = "Fix Azure DevOps settings", BUTTON_ITEM_CLASS = "fix-ado-settings-item", BADGE_CLASS = "fix-ado-settings-badge", SVG_NAMESPACE7 = "http://www.w3.org/2000/svg";
  function svgElement(document2, tag, attributes) {
    let created = document2.createElementNS(SVG_NAMESPACE7, tag);
    for (let [name, value] of Object.entries(attributes))
      created.setAttribute(name, value);
    return created;
  }
  function puzzleIcon(document2) {
    let svg = svgElement(document2, "svg", {
      "aria-hidden": "true",
      class: "fix-ado-settings-icon",
      viewBox: "0 0 16 16"
    });
    return svg.append(
      svgElement(document2, "path", {
        d: "M1.5 4H4.6A2.1 2.1 0 1 1 8.4 4H11.5V7.35A2.1 2.1 0 1 1 11.5 11.15V14.5H1.5Z"
      })
    ), svg;
  }
  function unseenCountBadge(document2, unseenCount) {
    let badge = element3(document2, "span", { className: BADGE_CLASS, text: String(unseenCount) });
    return badge.setAttribute("aria-hidden", "true"), badge;
  }
  function removeUnseenCountBadge(document2) {
    let badge = document2.querySelector(`.${BUTTON_ITEM_CLASS} .${BADGE_CLASS}`);
    badge?.parentElement?.setAttribute("aria-label", SETTINGS_TITLE), badge?.remove();
  }
  function createSettingsButtonItem(document2, open, unseenCount) {
    let item = element3(document2, "div", { className: `${BUTTON_ITEM_CLASS} flex-row flex-center` });
    item.setAttribute("role", "menuitem");
    let settingsButton = button(
      document2,
      {
        className: "fix-ado-settings-button bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment"
      },
      open
    );
    return settingsButton.title = SETTINGS_TITLE, settingsButton.setAttribute(
      "aria-label",
      unseenCount > 0 ? `${SETTINGS_TITLE}, ${unseenCount} new or updated` : SETTINGS_TITLE
    ), settingsButton.append(puzzleIcon(document2)), unseenCount > 0 && settingsButton.append(unseenCountBadge(document2, unseenCount)), item.append(settingsButton), item;
  }

  // azure-devops/src/core/settings-panel.ts
  var ISSUE_LINK_TEXT = "Found a bug or have a suggestion?", NEW_ISSUE_URL = "https://github.com/pietdevries94/my-vibed-userscripts/issues/new", TOP_BAR_SELECTOR2 = ".region-header-menubar", DIALOG_CLASS2 = "fix-ado-settings", TITLE_ID3 = "fix-ado-settings-title", CHIP_TEXT = { new: "New", updated: "Updated" };
  function allFeatures({ categories }) {
    return categories.flatMap((category) => category.features);
  }
  function featuresWithUnseenChange(options) {
    return allFeatures(options).filter(
      (feature) => feature.change !== void 0 && options.seenChangeVersion(feature) !== feature.change.version
    );
  }
  function chipKind(feature, options) {
    return options.seenChangeVersion(feature) === null ? "new" : feature.change?.kind ?? "new";
  }
  function chipElement(document2, text, kind) {
    return element3(document2, "span", {
      className: `fix-ado-settings-chip fix-ado-settings-chip-${kind}`,
      text
    });
  }
  function featureName(document2, feature, chip) {
    let name = element3(document2, "span", {
      className: "fix-ado-settings-feature-name",
      text: feature.name
    });
    return chip && name.append(chipElement(document2, CHIP_TEXT[chip], chip)), feature.tag !== void 0 && name.append(chipElement(document2, feature.tag, "tag")), name;
  }
  function featureRow(document2, { feature, isOn: isOn2, chip }) {
    let row = element3(document2, "label", { className: "fix-ado-settings-feature" }), checkbox = element3(document2, "input", { className: "fix-ado-settings-checkbox" });
    checkbox.type = "checkbox", checkbox.checked = isOn2, checkbox.dataset.featureId = feature.id;
    let text = element3(document2, "span", { className: "fix-ado-settings-feature-text" });
    return text.append(
      featureName(document2, feature, chip),
      element3(document2, "span", {
        className: "fix-ado-settings-feature-description",
        text: feature.description
      })
    ), row.append(checkbox, text), row;
  }
  function changedChoices(dialog, options) {
    let changed = /* @__PURE__ */ new Map();
    for (let feature of allFeatures(options)) {
      let checkbox = dialog.querySelector(
        `input[data-feature-id="${feature.id}"]`
      );
      checkbox && checkbox.checked !== options.isOn(feature) && changed.set(feature.id, checkbox.checked);
    }
    return changed;
  }
  function issueLink(document2) {
    let link = element3(document2, "a", {
      className: "fix-ado-settings-issue-link",
      text: ISSUE_LINK_TEXT
    });
    return link.href = NEW_ISSUE_URL, link.target = "_blank", link.rel = "noopener noreferrer", link;
  }
  function createButtons2(dialog, options) {
    let { document: document2 } = options, cancel = button(
      document2,
      { className: "bolt-button enabled bolt-focus-treatment", text: "Cancel" },
      () => {
        dialog.close();
      }
    ), save = button(
      document2,
      { className: "bolt-button enabled primary bolt-focus-treatment", text: "Save and reload page" },
      () => {
        options.save(changedChoices(dialog, options)), options.reload();
      }
    );
    save.disabled = !0;
    let buttons = element3(document2, "div", { className: "fix-ado-settings-buttons" });
    return buttons.append(issueLink(document2), cancel, save), { buttons, save };
  }
  function categorySection(category, options, unseen) {
    let { document: document2 } = options, section = element3(document2, "section", { className: "fix-ado-settings-category" }), cards = element3(document2, "div", { className: "fix-ado-settings-features" });
    return cards.append(
      ...category.features.map(
        (feature) => featureRow(document2, {
          chip: unseen.includes(feature) ? chipKind(feature, options) : null,
          feature,
          isOn: options.isOn(feature)
        })
      )
    ), section.append(
      element3(document2, "h3", { className: "fix-ado-settings-category-name", text: category.name }),
      cards
    ), section;
  }
  function createDialog2(options, unseen) {
    let { document: document2 } = options, dialog = element3(document2, "dialog", { className: DIALOG_CLASS2 });
    dialog.setAttribute("aria-labelledby", TITLE_ID3);
    let { buttons, save } = createButtons2(dialog, options), title = element3(document2, "h2", {
      className: "fix-ado-settings-title",
      text: SETTINGS_TITLE
    });
    return title.id = TITLE_ID3, dialog.addEventListener("change", () => {
      save.disabled = changedChoices(dialog, options).size === 0;
    }), dialog.append(
      title,
      ...options.categories.map((category) => categorySection(category, options, unseen)),
      buttons
    ), dialog;
  }
  function createSettingsPanel(options) {
    let { document: document2 } = options;
    function open() {
      document2.querySelector(`dialog.${DIALOG_CLASS2}`)?.remove();
      let unseen = featuresWithUnseenChange(options), dialog = createDialog2(options, unseen);
      document2.body.append(dialog), dialog.showModal(), unseen.length > 0 && (options.markChangesSeen(unseen), removeUnseenCountBadge(document2));
    }
    return {
      open,
      sync() {
        let topBar = document2.querySelector(TOP_BAR_SELECTOR2);
        topBar && !topBar.querySelector(`.${BUTTON_ITEM_CLASS}`) && topBar.prepend(
          createSettingsButtonItem(document2, open, featuresWithUnseenChange(options).length)
        );
      }
    };
  }

  // azure-devops/src/core/sync-before-paint.ts
  function createSyncBeforePaint(requestAnimationFrame2, sync4) {
    let isPending2 = !1;
    return () => {
      isPending2 || (isPending2 = !0, requestAnimationFrame2(() => {
        isPending2 = !1, sync4();
      }));
    };
  }

  // azure-devops/src/core/feature.ts
  function isFeatureOn(feature, savedChoice) {
    return savedChoice(feature.id, feature.isOffByDefault !== !0);
  }

  // azure-devops/src/core/reload-when-idle.ts
  var LAST_RELOAD_STORAGE_KEY = "fix-ado-last-page-reload", TEXT_FIELD_SELECTOR = "textarea, input:not([type=checkbox], [type=radio], [type=button], [type=submit], [type=reset])";
  function isOwnerBusy(document2) {
    let focused = document2.activeElement, isTyping = focused !== null && (focused.matches(TEXT_FIELD_SELECTOR) || "isContentEditable" in focused && focused.isContentEditable === !0), hasOpenDialog = document2.querySelector('[role="dialog"], dialog[open]') !== null;
    return isTyping || hasOpenDialog;
  }
  function claimReload() {
    try {
      let lastReloadAt = Number(sessionStorage.getItem(LAST_RELOAD_STORAGE_KEY));
      return Date.now() - lastReloadAt < 15e3 ? !1 : (sessionStorage.setItem(LAST_RELOAD_STORAGE_KEY, String(Date.now())), !0);
    } catch {
      return !1;
    }
  }
  function reloadWhenIdle(document2) {
    !isOwnerBusy(document2) && claimReload() && location.reload();
  }

  // azure-devops/src/core/settings-panel.css
  var settings_panel_default = `/* The settings button in Azure DevOps's top bar: a puzzle piece outline in the text colour,
   like Azure DevOps's own line icons next to it. */
.fix-ado-settings-icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.1;
  stroke-linejoin: round;
}

/* The number of feature changes the owner has not seen, on the button's top right corner. */
.fix-ado-settings-button {
  position: relative;
}

.fix-ado-settings-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  box-sizing: border-box;
  border-radius: 7px;
  background: var(--communication-background, rgb(0, 120, 212));
  color: var(--text-on-communication-background, rgb(255, 255, 255));
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  pointer-events: none;
}

/* The settings panel: a dialog over the page, in Azure DevOps's own theme colours. */
.fix-ado-settings {
  width: min(1080px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  padding: 24px;
  border: none;
  border-radius: 8px;
  background: var(--callout-background-color, rgb(255, 255, 255));
  color: var(--text-primary-color, rgba(0, 0, 0, 0.9));
  box-shadow:
    0 25.6px 57.6px rgba(0, 0, 0, 0.22),
    0 4.8px 14.4px rgba(0, 0, 0, 0.18);
}

/* Scrolling in the panel or over the backdrop stops there, and leaves the page behind it. */
.fix-ado-settings:modal {
  overscroll-behavior: contain;
}

.fix-ado-settings::backdrop {
  background: rgba(0, 0, 0, 0.4);
  overflow: hidden;
  overscroll-behavior: contain;
}

.fix-ado-settings-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
}

/* A heading per category, above its cards. */
.fix-ado-settings-category + .fix-ado-settings-category {
  margin-top: 20px;
}

.fix-ado-settings-category-name {
  margin: 0 0 8px;
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
  font-size: 14px;
  font-weight: 600;
}

/* A card per feature, three next to each other. A narrow window gets two, then one. */
.fix-ado-settings-features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 900px) {
  .fix-ado-settings-features {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .fix-ado-settings-features {
    grid-template-columns: minmax(0, 1fr);
  }
}

.fix-ado-settings-feature {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-subtle-color, rgba(0, 0, 0, 0.08));
  border-radius: 6px;
  cursor: pointer;
}

.fix-ado-settings-feature:hover {
  background: var(--palette-black-alpha-6, rgba(0, 0, 0, 0.06));
}

.fix-ado-settings-checkbox {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin: 2px 0 0;
  accent-color: var(--communication-background, rgb(0, 120, 212));
}

.fix-ado-settings-feature-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fix-ado-settings-feature-name {
  font-weight: 600;
}

.fix-ado-settings-chip {
  display: inline-block;
  margin-left: 8px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  vertical-align: 1px;
}

.fix-ado-settings-chip-new {
  background: var(--communication-background, rgb(0, 120, 212));
  color: var(--text-on-communication-background, rgb(255, 255, 255));
}

.fix-ado-settings-chip-updated {
  background: var(--palette-black-alpha-10, rgba(0, 0, 0, 0.1));
  color: var(--text-primary-color, rgba(0, 0, 0, 0.9));
}

.fix-ado-settings-chip-tag {
  border: 1px solid var(--palette-black-alpha-20, rgba(0, 0, 0, 0.2));
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
}

.fix-ado-settings-feature-description {
  color: var(--text-secondary-color, rgba(0, 0, 0, 0.55));
}

.fix-ado-settings-buttons {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

/* The issue link sits left of the buttons, on the same row. */
.fix-ado-settings-issue-link {
  margin-right: auto;
  color: var(--communication-foreground, rgb(0, 90, 158));
}

.fix-ado-settings-buttons .bolt-button:disabled {
  opacity: 0.4;
  cursor: default;
}
`;

  // azure-devops/src/main.ts
  var TIMER_INTERVAL_MS = 5e3, basePath = apiBasePath(location), isTabActive = () => document.visibilityState === "visible", isInFrame = globalThis.top !== globalThis.self, isOn = (feature) => isFeatureOn(feature, GM_getValue), seenChangeKey = ({ id }) => `${id}-seen-change`, settingsPanel = isInFrame ? null : createSettingsPanel({
    categories: FEATURE_CATEGORIES,
    document,
    isOn,
    markChangesSeen: (features) => {
      for (let feature of features)
        GM_setValue(seenChangeKey(feature), feature.change?.version);
    },
    reload: () => {
      location.reload();
    },
    save: (choices) => {
      for (let [id, isChosenOn] of choices)
        GM_setValue(id, isChosenOn);
    },
    seenChangeVersion: (feature) => GM_getValue(seenChangeKey(feature), null)
  });
  settingsPanel && (GM_addStyle(settings_panel_default), GM_registerMenuCommand("Settings", settingsPanel.open));
  var runner = createFeatureRunner({
    addStyle: (css) => {
      GM_addStyle(css);
    },
    context: {
      basePath,
      client: createAdoClient({
        apiBasePath: basePath,
        fetch: async (url, init) => fetch(url, init),
        origin: location.origin
      }),
      document,
      isInFrame,
      now: () => Date.now(),
      reloadWhenIdle: () => {
        reloadWhenIdle(document);
      }
    },
    currentPage: () => parsePage(location, basePath),
    features: FEATURES,
    isOn,
    isTabActive,
    // Throw again outside the loop, so the browser reports it and the other features run on.
    onError: (_feature, error) => {
      queueMicrotask(() => {
        throw error;
      });
    }
  }), sync3 = (reason) => {
    settingsPanel?.sync(), runner.sync(reason);
  }, syncOnDomChange = createSyncBeforePaint(
    (callback) => {
      requestAnimationFrame(callback);
    },
    () => {
      sync3("dom-change");
    }
  );
  new MutationObserver(syncOnDomChange).observe(document.body, { childList: !0, subtree: !0 });
  setInterval(sync3, TIMER_INTERVAL_MS, "timer");
  document.addEventListener("visibilitychange", () => {
    isTabActive() && sync3("tab-shown");
  });
  sync3("dom-change");
})();
