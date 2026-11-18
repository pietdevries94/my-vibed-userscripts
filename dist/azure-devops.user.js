// ==UserScript==
// @name         Fix Azure DevOps
// @namespace    https://github.com/pietdevries94/my-vibed-userscripts
// @version      1.16.0
// @description  Adds missing features to Azure DevOps: pipeline status on pull requests, how long ago each listed pull request was published, a Pipeline tab on each pull request with its runs, stages, steps, warnings, errors and logs and a button to start or cancel a run, the warnings and errors of each check's latest run above the pull request description, a pull request's Overview that runs from old to new with a button to flip it, a button there that scrolls to its bottom, pushes folded to one line there with a button that shows their commits, lines that add reviewers joined to one, threads there that collapse, with a button that expands them all, a Resolved chip on resolved ones, which start collapsed, and an Unresolved chip on active ones, required reviewers first, starred reviewers to add as optional or required reviewer in one click, also on a new pull request, reviews that hold your comments as pending and post them in one go with your vote, avatar initials, Light or Dark to match the system, days in column dots on board cards with a toggle per column, and pull request lists and boards that reload on changes. A settings panel in Azure DevOps's top bar turns each feature on or off and marks new and updated ones.
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
  // azure-devops/src/features/activity-order/activity-order.ts
  var FEED_SELECTOR = ".activity-feed-list", FILTER_SELECTOR = ".repos-activity-filter-dropdown", BUTTON_CLASS = "fix-ado-activity-order", TEXT_CLASS = "bolt-button-text", SVG_NAMESPACE = "http://www.w3.org/2000/svg", SORT_ICON_PATHS = ["M5 13V3M2.5 5.5L5 3l2.5 2.5", "M11 3v10M8.5 10.5L11 13l2.5-2.5"], DEFAULT_ORDER = "oldest-first", LABELS = {
    "newest-first": "Newest first",
    "oldest-first": "Oldest first"
  }, flipped = (order) => order === "oldest-first" ? "newest-first" : "oldest-first";
  function sortIcon(document2) {
    let svg = document2.createElementNS(SVG_NAMESPACE, "svg");
    svg.setAttribute("aria-hidden", "true"), svg.setAttribute("class", "fix-ado-activity-order-icon"), svg.setAttribute("viewBox", "0 0 16 16");
    for (let data of SORT_ICON_PATHS) {
      let path = document2.createElementNS(SVG_NAMESPACE, "path");
      path.setAttribute("d", data), svg.append(path);
    }
    return svg;
  }
  function createButton(document2, onClick2) {
    let button2 = document2.createElement("button");
    button2.type = "button", button2.className = `${BUTTON_CLASS} bolt-button enabled bolt-focus-treatment`;
    let text = document2.createElement("span");
    return text.className = TEXT_CLASS, button2.append(sortIcon(document2), text), button2.addEventListener("click", onClick2), button2;
  }
  function spacingBox(button2) {
    let box = button2.ownerDocument.createElement("div");
    return box.className = "margin-bottom-16 margin-right-8 inline-flex-row", box.append(button2), box;
  }
  function findOrAddButton(document2, onClick2) {
    let existing = document2.querySelector(`.${BUTTON_CLASS}`);
    if (existing !== null)
      return existing;
    let filters = document2.querySelector(FILTER_SELECTOR)?.parentElement;
    if (filters == null)
      return null;
    let button2 = createButton(document2, onClick2);
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
    button2 !== null && text !== null && text !== void 0 && text.textContent !== LABELS[order] && (text.textContent = LABELS[order], button2.title = `Show ${LABELS[flipped(order)].toLowerCase()}`);
  }
  function createActivityOrder(options) {
    let { document: document2, storage } = options, order = storage.load() ?? DEFAULT_ORDER, fullyRenderedFeeds = /* @__PURE__ */ new WeakSet();
    function flip() {
      order = flipped(order), storage.save(order), sync4();
    }
    function sync4() {
      let feed = document2.querySelector(FEED_SELECTOR);
      feed !== null && (order === "oldest-first" && !fullyRenderedFeeds.has(feed) && (fullyRenderedFeeds.add(feed), renderAllRows(document2)), showOrder(feed, findOrAddButton(document2, flip), order));
    }
    return { sync: sync4 };
  }

  // azure-devops/src/features/activity-order/style.css
  var style_default = `/* The activity feed on a pull request's Overview, oldest first. Azure DevOps renders the rows
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
    styles: [style_default]
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

  // azure-devops/src/pull-requests/feed-threads.ts
  var FEED_THREAD_SELECTOR = ".activity-feed-list .repos-discussion-thread", HEADER_SELECTOR = ".repos-discussion-comment-header", STATUS_SELECTOR = ".bolt-dropdown-expandable .bolt-dropdown-expandable-button-label", RESOLVED_STATUS = "Resolved", UNRESOLVED_STATUSES = /* @__PURE__ */ new Set(["Active", "Pending"]);
  function feedThreadOf(thread) {
    let header = thread.querySelector(HEADER_SELECTOR), nameAndTime = header?.firstElementChild ?? null;
    if (header === null || nameAndTime === null)
      return null;
    let timeBox = nameAndTime.querySelector(":scope > :has(time)") ?? nameAndTime, status = header.querySelector(STATUS_SELECTOR)?.textContent.trim() ?? "";
    return {
      header,
      isResolved: status === RESOLVED_STATUS,
      isUnresolved: UNRESOLVED_STATUSES.has(status),
      thread,
      timeBox
    };
  }
  var feedThreadElements = (document2) => [
    ...document2.querySelectorAll(FEED_THREAD_SELECTOR)
  ];

  // azure-devops/src/features/collapsible-threads/collapsible-threads.ts
  var TOGGLE_CLASS = "fix-ado-thread-toggle", TOGGLE_LABELS = { folded: "Expand thread", name: "Thread", open: "Collapse thread" }, THREAD_ID_PATTERN = /\bthreadId-(?<id>\d+)\b/u, FILE_HEADER_SELECTOR = ".comment-file-header", FILE_TITLE_SELECTOR = ".comment-file-header-title", AUTHOR_COLUMN_SELECTOR = ".repos-comment-editor-fit", FILTER_SELECTOR2 = ".repos-activity-filter-dropdown", EXPAND_ALL_CLASS = "fix-ado-expand-all-threads", EXPAND_ALL_LABEL = "Expand all threads";
  function threadIdOf(thread) {
    let field = thread.querySelector(".repos-discussion-thread-reply input");
    return THREAD_ID_PATTERN.exec(field?.className ?? "")?.groups?.id ?? null;
  }
  function fileHeaderOf(thread) {
    let before = thread.previousElementSibling;
    return before?.matches(FILE_HEADER_SELECTOR) === !0 ? before : null;
  }
  function findOrCreateToggle({ header, thread }, onClick2) {
    let existing = thread.querySelector(`.${TOGGLE_CLASS}`) ?? fileHeaderOf(thread)?.querySelector(`.${TOGGLE_CLASS}`);
    if (existing != null)
      return existing;
    let toggle = createFoldToggle(header.ownerDocument, TOGGLE_CLASS);
    return toggle.addEventListener("click", () => {
      onClick2(thread);
    }), toggle;
  }
  function toggleBoxOf({ header, thread }, state) {
    let fileTitle = fileHeaderOf(thread)?.querySelector(FILE_TITLE_SELECTOR) ?? null;
    return state === "open" && fileTitle !== null ? fileTitle : header.closest(AUTHOR_COLUMN_SELECTOR)?.parentElement ?? header;
  }
  function placeToggle(toggle, box) {
    box.firstElementChild !== toggle && box.prepend(toggle);
  }
  function createExpandAllBox(document2, onClick2) {
    let text = Object.assign(document2.createElement("span"), {
      className: "bolt-button-text",
      textContent: EXPAND_ALL_LABEL
    }), button2 = document2.createElement("button");
    button2.type = "button", button2.className = `${EXPAND_ALL_CLASS} bolt-button enabled bolt-focus-treatment`, button2.append(text), button2.addEventListener("click", onClick2);
    let box = Object.assign(document2.createElement("div"), {
      className: `${EXPAND_ALL_CLASS}-box margin-bottom-16 inline-flex-row`
    });
    return box.append(button2), box;
  }
  function addExpandAllButton(document2, onClick2) {
    let bar = document2.querySelector(FILTER_SELECTOR2)?.parentElement;
    bar != null && bar.querySelector(`.${EXPAND_ALL_CLASS}`) === null && bar.prepend(createExpandAllBox(document2, onClick2));
  }
  function createCollapsibleThreads({ document: document2 }) {
    let pickedStates = /* @__PURE__ */ new Map(), isAllExpanded = !1;
    function stateOf({ isResolved, thread }) {
      return pickedStates.get(threadIdOf(thread) ?? "") ?? (isResolved && !isAllExpanded ? "collapsed" : "open");
    }
    function expandAll() {
      pickedStates.clear(), isAllExpanded = !0, sync4();
    }
    function flip(thread) {
      let threadId = threadIdOf(thread);
      threadId !== null && (pickedStates.set(threadId, thread.dataset.fixAdoThread === "open" ? "collapsed" : "open"), sync4());
    }
    function syncThread2(feedThread) {
      let state = stateOf(feedThread);
      feedThread.thread.dataset.fixAdoThread !== state && (feedThread.thread.dataset.fixAdoThread = state);
      let toggle = findOrCreateToggle(feedThread, flip);
      placeToggle(toggle, toggleBoxOf(feedThread, state)), showFoldToggleState(toggle, state === "open", TOGGLE_LABELS);
    }
    function sync4() {
      addExpandAllButton(document2, expandAll);
      for (let thread of feedThreadElements(document2)) {
        let feedThread = feedThreadOf(thread);
        feedThread !== null && syncThread2(feedThread);
      }
    }
    return { sync: sync4 };
  }

  // azure-devops/src/features/collapsible-threads/style.css
  var style_default2 = `/* The toggle sits before the author of the first comment, level with the avatar, or before the
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

/* Expand all threads sits on the left of the bar above the feed. The bar puts its filters on
   the right. */
.fix-ado-expand-all-threads-box {
  order: -1;
  margin-right: auto;
}
`;

  // azure-devops/src/features/collapsible-threads/index.ts
  var collapsibleThreads = {
    change: { kind: "updated", version: "1.15.0" },
    description: "A button on every thread on a pull request's Overview collapses it. Resolved threads start collapsed. Expand all threads, above the feed, opens every thread, also ones that load later.",
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
    styles: [style_default2]
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
  function findOrAddToggle({ header }, onClick2) {
    let existing = header.querySelector(`.${TOGGLE_CLASS2}`);
    if (existing !== null)
      return existing;
    let title = header.querySelector(TITLE_SELECTOR);
    if (title === null)
      return null;
    let toggle = createFoldToggle(header.ownerDocument, TOGGLE_CLASS2);
    return toggle.addEventListener("click", (event) => {
      event.preventDefault(), event.stopPropagation(), onClick2(header);
    }), title.after(toggle), toggle;
  }
  function createFoldedPushes({ document: document2 }) {
    let openPushes = /* @__PURE__ */ new Set();
    function flip(header) {
      let pushedAt = pushOf(header)?.pushedAt ?? null;
      pushedAt !== null && (openPushes.delete(pushedAt) || openPushes.add(pushedAt), sync4());
    }
    function syncPush(push) {
      let hasCommits = push.card.querySelector(COMMITS_SELECTOR) !== null, state = hasCommits && push.pushedAt !== null && openPushes.has(push.pushedAt) ? "open" : "folded";
      if (push.card.dataset.fixAdoPush !== state && (push.card.dataset.fixAdoPush = state), hasCommits) {
        let toggle = findOrAddToggle(push, flip);
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
  var style_default3 = `/* A push in the activity feed of a pull request's Overview. Its header is one line, like the
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
    styles: [style_default3]
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
  var style_default4 = `/* Lines that add a reviewer, joined to one. The newest row of a run shows the joined line in
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
    styles: [style_default4]
  };

  // azure-devops/src/pipeline/pipeline-issue-box-collapse.ts
  var COLLAPSE_ICONS = { collapsed: "ms-Icon--ChevronRightMed", open: "ms-Icon--ChevronDownMed" };
  function setCollapsed(box, isCollapsed) {
    box.toggleAttribute("data-collapsed", isCollapsed);
    let button2 = box.querySelector(".fix-ado-issue-box-collapse");
    button2?.setAttribute("aria-expanded", String(!isCollapsed));
    let icon = button2?.querySelector(".fabric-icon");
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
      setCollapsed(box, isCollapsed), collapse.onToggle(isCollapsed);
    }), header.prepend(button2), setCollapsed(box, collapse.isCollapsed);
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
  function setAttributes(element4, attributes) {
    for (let [name, value] of Object.entries(attributes))
      element4.setAttribute(name, value);
  }
  function createKindIcon(document2, kind, size) {
    let { className, drawing, pixels: pixels2 } = ICON_SIZES[size], icon = document2.createElementNS(SVG_NAMESPACE2, "svg");
    setAttributes(icon, {
      "aria-label": KIND_LABELS[kind],
      class: `bolt-status flex-noshrink ${KIND_STATUSES[kind]}${className} fix-ado-kind-icon`,
      "data-kind": kind,
      height: String(pixels2),
      role: "img",
      viewBox: `0 0 ${drawing} ${drawing}`,
      width: String(pixels2)
    });
    let circle = document2.createElementNS(SVG_NAMESPACE2, "circle"), middle = String(drawing / 2);
    setAttributes(circle, { cx: middle, cy: middle, r: middle });
    let mark = document2.createElementNS(SVG_NAMESPACE2, "path");
    return setAttributes(mark, { d: ICON_MARKS[kind][size], fill: "#fff" }), icon.append(circle, mark), icon;
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

  // azure-devops/src/pipeline/pipeline-run-link.ts
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

  // azure-devops/src/features/overview-pipeline-issues/overview-pipeline-issues-card.ts
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

/* A collapsed box keeps its header row. */
.fix-ado-issue-box[data-collapsed] .fix-ado-issue {
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
  var CHIP_CLASS = "fix-ado-thread-chip", UNRESOLVED_LABEL = "Unresolved", RESOLVED_CHIP = { className: "fix-ado-resolved-chip", label: RESOLVED_STATUS }, UNRESOLVED_CHIP = { className: "fix-ado-unresolved-chip", label: UNRESOLVED_LABEL };
  function chipKindOf(feedThread) {
    return feedThread?.isResolved === !0 ? RESOLVED_CHIP : feedThread?.isUnresolved === !0 ? UNRESOLVED_CHIP : null;
  }
  function createChip(document2, { className, label }) {
    let chip = document2.createElement("div");
    chip.className = `${CHIP_CLASS} ${className} flex-noshrink margin-left-8 bolt-pill flex-row flex-center outlined compact`;
    let content = document2.createElement("div");
    return content.className = "bolt-pill-content text-ellipsis", content.textContent = label, chip.append(content), chip;
  }
  function syncThread(thread) {
    let feedThread = feedThreadOf(thread), kind = chipKindOf(feedThread), chip = thread.querySelector(`.${CHIP_CLASS}`);
    kind !== null && chip?.classList.contains(kind.className) === !0 || (chip?.remove(), feedThread !== null && kind !== null && feedThread.timeBox.append(createChip(thread.ownerDocument, kind)));
  }
  function createResolvedThreadChips({ document: document2 }) {
    function sync4() {
      for (let thread of feedThreadElements(document2))
        syncThread(thread);
    }
    return { sync: sync4 };
  }

  // azure-devops/src/features/resolved-thread-chips/style.css
  var style_default5 = `/* The chip on a thread: Azure DevOps's pill. Resolved in its colour for success,
   Unresolved in its colour for warnings. */
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
`;

  // azure-devops/src/features/resolved-thread-chips/index.ts
  var resolvedThreadChips = {
    change: { kind: "updated", version: "1.14.0" },
    description: "A Resolved chip on every resolved thread on a pull request's Overview, and an Unresolved chip on every active or pending one.",
    id: "resolved-thread-chips",
    name: "Resolved and Unresolved chips on threads",
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
    styles: [style_default5]
  };

  // azure-devops/src/features/scroll-to-bottom/scroll-to-bottom.ts
  var FEED_SELECTOR2 = ".activity-feed-list", SCROLLER_SELECTOR = ".v-scroll-auto", BUTTON_CLASS2 = "fix-ado-scroll-to-bottom", LABEL = "Scroll to bottom";
  var SVG_NAMESPACE3 = "http://www.w3.org/2000/svg", ARROW_DOWN_PATH = "M8 3v10M3.5 8.5L8 13l4.5-4.5";
  function arrowDownIcon(document2) {
    let svg = document2.createElementNS(SVG_NAMESPACE3, "svg");
    svg.setAttribute("aria-hidden", "true"), svg.setAttribute("viewBox", "0 0 16 16");
    let path = document2.createElementNS(SVG_NAMESPACE3, "path");
    return path.setAttribute("d", ARROW_DOWN_PATH), svg.append(path), svg;
  }
  function scrollerOf(feed) {
    let box = feed.parentElement?.closest(SCROLLER_SELECTOR) ?? null;
    for (; box !== null && box.scrollHeight <= box.clientHeight; )
      box = box.parentElement?.closest(SCROLLER_SELECTOR) ?? null;
    return box;
  }
  function createButton2(document2, onClick2, onBlur) {
    let button2 = document2.createElement("button");
    return button2.type = "button", button2.className = BUTTON_CLASS2, button2.title = LABEL, button2.setAttribute("aria-label", LABEL), button2.append(arrowDownIcon(document2)), button2.addEventListener("click", onClick2), button2.addEventListener("blur", onBlur), button2;
  }
  function overviewScrollerOf(document2) {
    let feed = document2.querySelector(FEED_SELECTOR2);
    return feed === null ? null : scrollerOf(feed);
  }
  var isAtBottom = (scroller) => scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 16;
  function shouldShowButton(scroller, button2) {
    let hasFocus = button2 !== null && button2.ownerDocument.activeElement === button2;
    return scroller !== null && (!isAtBottom(scroller) || hasFocus);
  }
  function scrollBehaviorOf(scroller) {
    return scroller.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? !1 ? "instant" : "smooth";
  }
  var OWNER_SCROLL_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"];
  function createBottomFollow(now) {
    let followed = null;
    function start(scroller) {
      followed = { height: scroller.scrollHeight, lastActiveAt: now() }, scroller.scrollTo({ behavior: scrollBehaviorOf(scroller), top: scroller.scrollHeight });
    }
    function step(scroller, isScrollEvent) {
      followed !== null && (scroller === null || now() - followed.lastActiveAt > 2e3 ? followed = null : scroller.scrollHeight !== followed.height ? start(scroller) : isScrollEvent && (followed.lastActiveAt = now()));
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
  var style_default6 = `/* The button that scrolls a pull request's Overview to its bottom: round, in the corner of the window. */
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
    styles: [style_default6]
  };

  // azure-devops/src/features/overview-features.ts
  var OVERVIEW_FEATURES = [
    overviewPipelineIssues,
    activityOrder,
    scrollToBottom,
    foldedPushes,
    joinedReviewerLines,
    resolvedThreadChips,
    collapsibleThreads
  ];

  // azure-devops/src/features/pipeline-tab/pipeline-run-frame.ts
  function createPipelineRunFrame(document2) {
    return parsePipelineRunLocation(document2.location) === null ? null : {
      sync: () => {
        document2.documentElement.dataset.fixAdoRunFrame = "";
      }
    };
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

  // azure-devops/src/pipeline/pipeline-status-icon.ts
  var PIPELINE_STATUS_ICON_CLASS = "fix-ado-pipeline-status", SVG_NAMESPACE4 = "http://www.w3.org/2000/svg", LABELS2 = {
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
  function setAttributes2(element4, attributes) {
    for (let [name, value] of Object.entries(attributes))
      element4.setAttribute(name, value);
  }
  function createShape(document2, [tag, attributes]) {
    let shape = document2.createElementNS(SVG_NAMESPACE4, tag);
    return setAttributes2(shape, attributes), shape;
  }
  function createStatusIcon(document2, status, label = LABELS2[status]) {
    let icon = document2.createElementNS(SVG_NAMESPACE4, "svg");
    setAttributes2(icon, {
      "aria-label": label,
      class: PIPELINE_STATUS_ICON_CLASS,
      height: "16",
      role: "img",
      viewBox: "0 0 16 16",
      width: "16"
    }), icon.dataset.status = status;
    let title = document2.createElementNS(SVG_NAMESPACE4, "title");
    return title.textContent = label, icon.append(title, ...SHAPES[status].map((shape) => createShape(document2, shape))), icon;
  }
  function createPipelineStatusIcon(document2, status, pullRequestId) {
    let icon = createStatusIcon(document2, status);
    return icon.dataset.pullRequestId = String(pullRequestId), icon;
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
  function createRun(context, run) {
    let isCurrent2 = run.buildId === context.shown.run.buildId, item = createItem(context, {
      className: "fix-ado-pipeline-run",
      details: runDetails(run),
      isCurrent: isCurrent2,
      level: "run",
      name: run.name,
      pick: { buildId: run.buildId, folded: null, jobId: null, stageId: null, stepId: null },
      status: run.status
    });
    return isCurrent2 && context.pick.folded !== "run" ? [item, createStages(context)] : [item];
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

  // azure-devops/src/features/pipeline-tab/pipeline-tab-element.ts
  var TAB_CLASS = "fix-ado-pipeline-tab", TAB_LABEL = "Pipeline", TAB_ID = "fix-ado-pipeline-tab", TAB_CLASSES = `bolt-tab focus-treatment flex-noshrink ${TAB_CLASS}`;
  function createTab(document2) {
    let text = Object.assign(document2.createElement("span"), {
      className: "bolt-tab-text",
      textContent: TAB_LABEL
    });
    text.dataset.content = TAB_LABEL;
    let container = document2.createElement("span");
    container.className = "bolt-tab-inner-container", container.append(text);
    let tab = Object.assign(document2.createElement("a"), {
      className: TAB_CLASSES,
      href: "#",
      id: TAB_ID
    });
    return tab.setAttribute("role", "tab"), tab.append(container), tab.setAttribute("aria-selected", "false"), tab;
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
  function createButton3(context) {
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
    let button2 = createButton3(context);
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

  // shared/runtime/script-log.ts
  var entries = [];
  function log(message2, data) {
    entries.push(data === void 0 ? { message: message2 } : { data, message: message2 }), entries.length > 500 && entries.shift();
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

  // azure-devops/src/core/ado-client.ts
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
      ...createReviewRequests(options),
      ...createReviewerRequests(options)
    };
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
  var style_default7 = `/* The Pipeline tab on a pull request. pipeline-tab.ts sets the attribute while it is open. */
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
    styles: [pipeline_issue_list_default, pipeline_status_icon_default, style_default7]
  };

  // azure-devops/src/features/review/review-store.ts
  var KEY_PREFIX = "review:";
  function reviewKey(hostAndBasePath, { project, pullRequestId, repository }) {
    return `${KEY_PREFIX}${hostAndBasePath}/${project}/${repository}/${pullRequestId}`;
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
    for (let key of storage.keys().filter((name) => name.startsWith(KEY_PREFIX))) {
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
  var CARD_ROW_CLASS = "fix-ado-review-card-row", THREAD_SELECTOR = ".repos-diff-discussion", LINE_CELL_CLASS = "repos-line-content";
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
    return row?.querySelector(`:scope > ${THREAD_SELECTOR}`) !== null && row !== null;
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

  // azure-devops/src/features/review/tree-listing.ts
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

  // azure-devops/src/features/review/tree-scroll-anchor.ts
  var TREE_SELECTOR2 = ".repos-changes-explorer-tree", TREE_ROW_SELECTOR2 = `${TREE_SELECTOR2} tr.bolt-tree-row[aria-rowindex]`, SCROLLER_SELECTOR2 = ".v-scroll-auto", SMALLEST_MOVE = 1, LARGEST_SHIFT = 100, WEAR_PER_SCROLLED_PIXEL = 0.25, shiftByScroller = /* @__PURE__ */ new WeakMap();
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
    let viewTop = scroller.getBoundingClientRect().top, row = [...document2.querySelectorAll(TREE_ROW_SELECTOR2)].find(
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

  // azure-devops/src/features/review/tree-folded.ts
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

  // azure-devops/src/features/review/tree-pending-rows.ts
  var TREE_ROW_SELECTOR3 = ".repos-changes-explorer-tree tr.bolt-tree-row", PENDING_ROW_CLASS = "fix-ado-review-tree-row", ID_ATTRIBUTE2 = "data-fix-ado-review-tree-id", THREAD_ITEM_CLASS = "repos-file-explorer-tree-thread-item", NAME_SELECTOR = ".bolt-tree-cell .text-ellipsis", INDENT_SELECTOR = ".bolt-tree-expand-button", INDENT_STEP = 16, INDEX_ATTRIBUTE = "aria-rowindex", DOT_TITLE = "Pending comment", UNSAVED_MARK = "*";
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
    return [...document2.querySelectorAll(TREE_ROW_SELECTOR3)].filter((row) => !isThreadRow2(row)).map((row) => {
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
  function drawnFileRow(filePath, { changedPaths, drawn, listing }) {
    let place = listing?.paths.indexOf(filePath) ?? -1;
    return listing === null || place === -1 ? fileRowOf(drawn, filePath, changedPaths) : drawn[listing.placeOfDrawn.indexOf(place)]?.row ?? null;
  }
  function treeNow(document2, changedPaths) {
    let drawn = drawnRows(document2), folded = noteFolded(document2, drawn, changedPaths), listing = changedPaths === null ? null : findDrawn(changedPaths, drawn, folded);
    return { changedPaths, drawn, listing };
  }
  function syncTreePendingRows(document2, { changedPaths, pending }) {
    let stale = new Set(document2.querySelectorAll(`.${PENDING_ROW_CLASS}`)), tree = treeNow(document2, changedPaths);
    keepingTreeInPlace(document2, () => {
      for (let comment of pending.filter(({ anchor }) => anchor !== null))
        showRow(stale, drawnFileRow(comment.anchor?.filePath ?? "", tree), comment);
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
          ({ changeTrackingId, item }) => item?.path === void 0 ? [] : [[item.path, changeTrackingId]]
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
  var style_default8 = `/* Azure DevOps's own post button, next to the review's button: it looks secondary and
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
    styles: [style_default8]
  };

  // azure-devops/src/features/starred-reviewers/starred-reviewers-markup.ts
  var STARRED_SECTION_CLASS = "fix-ado-starred-reviewers", STAR_BUTTON_CLASS = "fix-ado-star", STAR_PATH = "M8 1.6l1.95 4.02 4.43.58-3.24 3.07.82 4.4L8 11.53l-3.96 2.14.82-4.4L1.62 6.2l4.43-.58z", REQUIRED_RING_PATH = "M8 1.75a6.25 6.25 0 1 0 0 12.5a6.25 6.25 0 1 0 0-12.5z", PLUS_PATH = "M8 5v6M5 8h6", SVG_NAMESPACE5 = "http://www.w3.org/2000/svg";
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
    let svg = document2.createElementNS(SVG_NAMESPACE5, "svg"), attributes = {
      "aria-hidden": "true",
      class: className,
      height: "16",
      viewBox: "0 0 16 16",
      width: "16"
    };
    for (let [name, value] of Object.entries(attributes))
      svg.setAttribute(name, value);
    for (let data of pathData) {
      let path = document2.createElementNS(SVG_NAMESPACE5, "path");
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
  function createChip2(state, identity) {
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
    list !== null && list.dataset.fixAdoSignature !== signature && (list.dataset.fixAdoSignature = signature, list.replaceChildren(...shown.map((identity) => createChip2(state, identity))));
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
  var style_default9 = `/* Starred reviewers: a star on each reviewer row, shown on hover or when starred.
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
    styles: [style_default9]
  };

  // azure-devops/src/features/pull-request-features.ts
  var PULL_REQUEST_FEATURES = [pipelineTab, starredReviewers, review];

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
  var style_default10 = `/* Avatars as initials. avatars.ts sets the data attribute, the hue and the size. */
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
    styles: [style_default10]
  };

  // azure-devops/src/features/days-in-column/days-in-column.ts
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

  // azure-devops/src/features/days-in-column/days-in-column-toggle.ts
  var HEADER_SELECTOR3 = ".kanban-board-column-header", COLUMN_SELECTOR2 = ".kanban-board-column[data-column]", TOGGLE_CLASS3 = "fix-ado-days-toggle";
  function showColumnState(column, toggle, isHidden) {
    Object.hasOwn(column.dataset, "fixAdoDaysHidden") !== isHidden && (isHidden ? column.dataset.fixAdoDaysHidden = "" : delete column.dataset.fixAdoDaysHidden);
    let pressed = String(!isHidden);
    toggle.getAttribute("aria-pressed") !== pressed && (toggle.setAttribute("aria-pressed", pressed), toggle.title = isHidden ? "Show days in column" : "Hide days in column", toggle.setAttribute("aria-label", "Days in column"));
  }
  function createToggle(document2, onClick2) {
    let toggle = document2.createElement("button");
    return toggle.type = "button", toggle.className = TOGGLE_CLASS3, toggle.append(...Array.from({ length: 3 }, () => document2.createElement("span"))), toggle.addEventListener("click", (event) => {
      event.preventDefault(), event.stopPropagation(), onClick2();
    }), toggle;
  }
  function findOrAddToggle2(header, onClick2) {
    let existing = header.querySelector(`.${TOGGLE_CLASS3}`);
    if (existing !== null)
      return existing;
    let toggle = createToggle(header.ownerDocument, onClick2);
    return (header.querySelector(".justify-space-between > .flex-row") ?? header).append(toggle), toggle;
  }
  function createDaysInColumnToggles(options) {
    let { document: document2, storage } = options, hiddenColumnIds = new Set(storage.load());
    function flip(columnId) {
      hiddenColumnIds.delete(columnId) || hiddenColumnIds.add(columnId), storage.save([...hiddenColumnIds]), sync4();
    }
    function sync4() {
      let headers = [...document2.querySelectorAll(HEADER_SELECTOR3)], columns = [...document2.querySelectorAll(COLUMN_SELECTOR2)];
      if (headers.length === columns.length)
        for (let [index, header] of headers.entries()) {
          let column = columns[index], columnId = column?.dataset.column;
          if (column !== void 0 && columnId !== void 0) {
            let toggle = findOrAddToggle2(header, () => {
              flip(columnId);
            });
            showColumnState(column, toggle, hiddenColumnIds.has(columnId));
          }
        }
    }
    return { sync: sync4 };
  }

  // azure-devops/src/features/days-in-column/style.css
  var style_default11 = `/* Days in column on board cards: a dot per day, grey, then orange, then red. */
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
    styles: [style_default11]
  };

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
  var DRAFT_PILL_SELECTOR = ".repos-pr-list-draft-pill", ROW_ACTIONS_CELL_SELECTOR = ".bolt-table-cell-side-action", PUBLISHED_SINCE_CLASS = "fix-ado-published-since";
  function isDraftRow(row) {
    return row.querySelector(DRAFT_PILL_SELECTOR) !== null;
  }
  function addPublishedSinceColumn(row) {
    let columns = row.closest("table")?.querySelector(":scope > colgroup");
    if (!columns || columns.querySelector(`.${PUBLISHED_SINCE_CLASS}`))
      return;
    let column = row.ownerDocument.createElement("col");
    column.className = PUBLISHED_SINCE_CLASS;
    let actionsColumn = columns.lastElementChild?.previousElementSibling;
    actionsColumn ? actionsColumn.before(column) : columns.append(column);
  }
  function publishedSinceCell(row) {
    let shown = row.querySelector(`:scope > .${PUBLISHED_SINCE_CLASS}`);
    if (shown)
      return shown;
    let actionsCell = row.querySelector(`:scope > ${ROW_ACTIONS_CELL_SELECTOR}`);
    if (!actionsCell)
      return null;
    let cell2 = row.ownerDocument.createElement("td");
    return cell2.className = `${PUBLISHED_SINCE_CLASS} bolt-table-cell bolt-list-cell secondary-text`, actionsCell.before(cell2), cell2;
  }
  function showPublishedSince(row, text) {
    let cell2 = publishedSinceCell(row);
    cell2 && (addPublishedSinceColumn(row), cell2.textContent !== (text ?? "") && (cell2.textContent = text ?? ""));
  }
  var REVIEWER_SELECTOR = ".pr-reviewer";
  function markRequiredReviewers(row, reviewers) {
    for (let reviewerElement of row.querySelectorAll(REVIEWER_SELECTOR)) {
      let avatar = reviewerElement.querySelector(AVATAR_SELECTOR), reviewer = avatar ? findReviewerByLabel(avatarName(avatar), reviewers) : null;
      reviewerElement.toggleAttribute("data-fix-ado-required", reviewer?.isRequired ?? !1), reviewerElement.parentElement?.toggleAttribute("data-fix-ado-reviewers", !0);
    }
  }

  // azure-devops/src/features/pipeline-status/pipeline-status-poller.ts
  var IN_PROGRESS_POLL_INTERVAL_MS = 2e4, SETTLED_POLL_INTERVAL_MS = 18e4, FAILED_REQUEST_RETRY_MS = 6e4, MS_PER_SECOND = 1e3;
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
    retryAfterSeconds !== null && (state.pausedUntil = state.options.now() + retryAfterSeconds * MS_PER_SECOND);
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
  var relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "always" }), isDraftUpdate = (thread) => thread.isDeleted !== !0 && thread.properties?.CodeReviewThreadType?.$value === "IsDraftUpdate" && thread.publishedDate !== void 0;
  function publishedAt(creationDate, threads) {
    let draftUpdates = threads.filter((thread) => isDraftUpdate(thread)).map((thread) => Date.parse(thread.publishedDate ?? ""));
    return draftUpdates.length > 0 ? Math.max(...draftUpdates) : Date.parse(creationDate);
  }
  function publishedSinceText(publishedAtMs, nowMs) {
    let elapsed = nowMs - publishedAtMs;
    if (elapsed < 6e4)
      return "Published just now";
    let [count, unit] = largestWholeUnit(elapsed);
    return `Published ${relativeTime.format(-count, unit)}`;
  }
  function largestWholeUnit(elapsedMs) {
    let days = Math.floor(elapsedMs / 864e5);
    return days >= 365 ? [Math.floor(days / 365), "year"] : days >= 30 ? [Math.floor(days / 30), "month"] : days >= 1 ? [days, "day"] : elapsedMs >= 36e5 ? [Math.floor(elapsedMs / 36e5), "hour"] : [Math.floor(elapsedMs / 6e4), "minute"];
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
  var style_default12 = `/* The publish time column in pull request lists. pr-list.ts adds the cell and its column. */
col.fix-ado-published-since {
  width: 12rem;
}

td.fix-ado-published-since {
  white-space: nowrap;
}
`;

  // azure-devops/src/features/published-since/index.ts
  var publishedSince = {
    change: { kind: "new", version: "1.16.0" },
    description: "A column on each pull request in a list with how long ago it left draft.",
    id: "published-since",
    name: "Published since",
    start({ basePath: basePath2, client, document: document2, now }) {
      let findRows = () => findPullRequestRows(document2, basePath2).map(({ row, pullRequest }) => ({
        isDraft: isDraftRow(row),
        pullRequest,
        row
      })), fetcher = createPublishedAtFetcher({ client, findRows, now });
      function showAll() {
        for (let { row, pullRequest, isDraft } of findRows()) {
          let at = isDraft ? null : fetcher.publishedAt(pullRequest.pullRequestId);
          showPublishedSince(row, at === null ? null : publishedSinceText(at, now()));
        }
      }
      return {
        sync({ page, isTabActive: isTabActive2 }) {
          showAll(), (page.kind === "pull-request-list" || page.kind === "pull-request-inbox") && isTabActive2 && fetcher.sync().then(showAll);
        }
      };
    },
    styles: [style_default12]
  };

  // azure-devops/src/features/reload-on-changes/page-reloader.ts
  var PAGE_CHECK_INTERVAL_MS = 3e4, FAILED_PAGE_CHECK_RETRY_MS = 6e4, MS_PER_SECOND2 = 1e3;
  function isCheckDue2(state, page, immediately) {
    return state.loadedSnapshots.has(page.key) ? !state.options.isTabActive() || state.options.now() < state.pausedUntil ? !1 : immediately || state.options.now() >= state.nextCheckAt : !0;
  }
  function pauseFor(state, retryAfterSeconds) {
    retryAfterSeconds !== null && (state.pausedUntil = state.options.now() + retryAfterSeconds * MS_PER_SECOND2);
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
  var style_default13 = `/* Required reviewers in the pull request list. pr-list.ts sets the data attributes. */

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
    styles: [style_default13]
  };

  // azure-devops/src/features/index.ts
  var FEATURE_CATEGORIES = [
    {
      features: [pipelineStatusOnPullRequests, requiredReviewers, publishedSince],
      name: "Pull request lists"
    },
    { features: PULL_REQUEST_FEATURES, name: "Pull request" },
    { features: OVERVIEW_FEATURES, name: "Pull request Overview" },
    { features: [daysInColumn], name: "Boards" },
    { features: [avatarInitials, followSystemTheme, reloadOnChanges], name: "Everywhere" }
  ], FEATURES = FEATURE_CATEGORIES.flatMap((category) => category.features);

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
  function button(document2, parts, onClick2) {
    let created = element3(document2, "button", parts);
    return created.type = "button", created.addEventListener("click", onClick2), created;
  }

  // azure-devops/src/core/settings-button.ts
  var SETTINGS_TITLE = "Fix Azure DevOps settings", BUTTON_ITEM_CLASS = "fix-ado-settings-item", BADGE_CLASS = "fix-ado-settings-badge", SVG_NAMESPACE6 = "http://www.w3.org/2000/svg";
  function svgElement(document2, tag, attributes) {
    let created = document2.createElementNS(SVG_NAMESPACE6, tag);
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
  var ISSUE_LINK_TEXT = "Found a bug or have a suggestion?", NEW_ISSUE_URL = "https://github.com/pietdevries94/my-vibed-userscripts/issues/new", TOP_BAR_SELECTOR = ".region-header-menubar", DIALOG_CLASS2 = "fix-ado-settings", TITLE_ID3 = "fix-ado-settings-title", CHIP_TEXT = { new: "New", updated: "Updated" };
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
  function featureName(document2, feature, chip) {
    let name = element3(document2, "span", {
      className: "fix-ado-settings-feature-name",
      text: feature.name
    });
    return chip && name.append(
      element3(document2, "span", {
        className: `fix-ado-settings-chip fix-ado-settings-chip-${chip}`,
        text: CHIP_TEXT[chip]
      })
    ), name;
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
        let topBar = document2.querySelector(TOP_BAR_SELECTOR);
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
  var TIMER_INTERVAL_MS = 5e3, IS_ON_BY_DEFAULT = !0, basePath = apiBasePath(location), isTabActive = () => document.visibilityState === "visible", isInFrame = globalThis.top !== globalThis.self, isOn = ({ id }) => GM_getValue(id, IS_ON_BY_DEFAULT), seenChangeKey = ({ id }) => `${id}-seen-change`, settingsPanel = isInFrame ? null : createSettingsPanel({
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
