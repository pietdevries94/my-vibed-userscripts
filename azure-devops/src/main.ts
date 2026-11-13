/* oxlint-disable import/max-dependencies -- main.ts wires up every feature */
import {
  apiBasePath,
  isPullRequestInboxLocation,
  parsePullRequestHref,
  parsePullRequestListLocation,
} from "./pull-request-link.ts";
import { findBoardCardIds, isBoardLocation, watchBoard } from "./board.ts";
import { findPullRequestRows, showPipelineStatus } from "./pr-list.ts";
import { hideInitialsOnAvatars, showInitialsOnAvatars } from "./avatars.ts";
import type { PolicyEvaluation } from "./pipeline-status.ts";
import type { PullRequestsResponse } from "./ado-client.ts";
import type { TimelineRecord } from "./pipeline-timeline.ts";
import type { WatchedPage } from "./page-reloader.ts";
import { createAdoClient } from "./ado-client.ts";
import { createDaysInColumn } from "./days-in-column.ts";
import { createDaysInColumnToggles } from "./days-in-column-toggle.ts";
import { createOnOffSetting } from "./on-off-setting.ts";
import { createOverviewPipelineIssues } from "./overview-pipeline-issues.ts";
import { createPageReloader } from "./page-reloader.ts";
import { createPipelineRunFrame } from "./pipeline-run-frame.ts";
import { createPipelineStatusPoller } from "./pipeline-status-poller.ts";
import { createPipelineTab } from "./pipeline-tab.ts";
import { createRequiredReviewerMarker } from "./required-reviewers.ts";
import { createStarredReviewers } from "./starred-reviewers.ts";
import { createStarredReviewersStore } from "./starred-reviewers-store.ts";
import style from "./style.css";
import { watchPullRequestList } from "./pr-list-watch.ts";

GM_addStyle(style);

const DOM_SETTLE_MS = 200;
const TIMER_INTERVAL_MS = 5000;
const MIN_TIME_BETWEEN_RELOADS_MS = 15_000;
const LAST_RELOAD_STORAGE_KEY = "fix-ado-last-page-reload";

const basePath = apiBasePath(location);
const client = createAdoClient({
  apiBasePath: basePath,
  fetch: async (url, init) => fetch(url, init),
  origin: location.origin,
});
const isTabActive = (): boolean => document.visibilityState === "visible";

// In a frame, the script only strips a run page the Pipeline tab shows.
const isInFrame = globalThis.top !== globalThis.self;

const avatarInitials = createOnOffSetting({
  defaultValue: true,
  key: "avatar-initials",
  label: "Avatar initials",
  menu: {
    // A frame would add a second menu entry. The top page's entry is enough.
    register: (caption, onClick, id) => {
      if (!isInFrame) {
        GM_registerMenuCommand(caption, onClick, { id });
      }
    },
  },
  onChange: (isOn) => {
    if (isOn) {
      showInitialsOnAvatars(document);
    } else {
      hideInitialsOnAvatars(document);
    }
  },
  storage: {
    get: (key, defaultValue) => GM_getValue(key, defaultValue),
    set: (key, value) => {
      GM_setValue(key, value);
    },
  },
});

const getEvaluations = async (
  pullRequest: Parameters<typeof client.getPolicyEvaluations>[0],
): Promise<PolicyEvaluation[]> => {
  const { evaluations } = await client.getPolicyEvaluations(pullRequest);
  return evaluations;
};
const getTimeline = async (project: string, buildId: number): Promise<TimelineRecord[]> => {
  const { records } = await client.getTimeline(project, buildId);
  return records;
};

const pipelineRunFrame = isInFrame ? createPipelineRunFrame(document) : null;
const pipelineTab = isInFrame
  ? null
  : createPipelineTab({
      apiBasePath: basePath,
      cancelRun: async (project, buildId) => {
        await client.cancelBuild(project, buildId);
      },
      document,
      getEvaluations,
      getPullRequestBuilds: async ({ project, pullRequestId }) => {
        const { builds } = await client.getPullRequestBuilds(project, pullRequestId);
        return builds;
      },
      getTimeline,
      now: () => Date.now(),
      requeueCheck: async ({ project }, evaluationId) => {
        await client.requeuePolicyEvaluation(project, evaluationId);
      },
    });

const overviewPipelineIssues = isInFrame
  ? null
  : createOverviewPipelineIssues({
      apiBasePath: basePath,
      document,
      getEvaluations,
      getTimeline,
      now: () => Date.now(),
    });

const poller = createPipelineStatusPoller<HTMLElement>({
  client,
  findRows: () => findPullRequestRows(document, basePath),
  now: () => Date.now(),
  showStatus: showPipelineStatus,
});

const daysInColumn = createDaysInColumn({ client, document, now: () => Date.now() });
const HIDDEN_DAYS_COLUMNS_KEY = "days-in-column-hidden-columns";
const daysInColumnToggles = createDaysInColumnToggles({
  document,
  storage: {
    load: () => GM_getValue<string[]>(HIDDEN_DAYS_COLUMNS_KEY, []),
    save: (columnIds) => {
      GM_setValue(HIDDEN_DAYS_COLUMNS_KEY, columnIds);
    },
  },
});

// One starred list per organisation.
const STARRED_REVIEWERS_KEY = `starred-reviewers:${location.host}${basePath}`;
const starredReviewers = isInFrame
  ? null
  : createStarredReviewers({
      client,
      document,
      imageUrlOf: ({ id }) =>
        `${location.origin}${basePath}/_api/_common/identityImage?id=${encodeURIComponent(id)}`,
      reload: () => {
        location.reload();
      },
      schedule: (callback, delayMs): (() => void) => {
        const timer = setTimeout(callback, delayMs);
        return () => {
          clearTimeout(timer);
        };
      },
      store: createStarredReviewersStore({
        load: () => GM_getValue<unknown>(STARRED_REVIEWERS_KEY, []),
        save: (starred) => {
          GM_setValue(STARRED_REVIEWERS_KEY, starred);
        },
      }),
    });

const requiredReviewers = createRequiredReviewerMarker({
  client,
  findRows: () => findPullRequestRows(document, basePath),
  now: () => Date.now(),
});

const pullRequestListClient = {
  // The list check already fetches the reviewers. Keep them to mark the required ones.
  async getPullRequests(
    listPage: Parameters<typeof client.getPullRequests>[0],
  ): Promise<PullRequestsResponse> {
    const response = await client.getPullRequests(listPage);
    requiredReviewers.remember(response.pullRequests);
    return response;
  },
};

function currentWatchedPage(): WatchedPage<unknown> | null {
  const listPage = parsePullRequestListLocation(location, basePath);
  if (listPage) {
    return watchPullRequestList(pullRequestListClient, listPage, () =>
      findPullRequestRows(document, basePath).map(({ pullRequest }) => pullRequest.pullRequestId),
    );
  }
  if (isBoardLocation(location)) {
    const cardIds = findBoardCardIds(document);
    // No cards yet: the board is still loading, and there is nothing to compare.
    return cardIds.length > 0 ? watchBoard(client, location, cardIds) : null;
  }
  return null;
}

const reloader = createPageReloader({
  currentPage: currentWatchedPage,
  isTabActive,
  now: () => Date.now(),
  reload: reloadPage,
});

function isUserBusy(): boolean {
  const isTyping = document.activeElement?.matches("input, textarea, [contenteditable]") ?? false;
  const hasOpenDialog = document.querySelector('[role="dialog"]') !== null;
  return isTyping || hasOpenDialog;
}

/** Records this reload, unless the last one was too recent. False when the reload must wait. */
function claimReload(): boolean {
  try {
    const lastReloadAt = Number(sessionStorage.getItem(LAST_RELOAD_STORAGE_KEY));
    if (Date.now() - lastReloadAt < MIN_TIME_BETWEEN_RELOADS_MS) {
      return false;
    }
    sessionStorage.setItem(LAST_RELOAD_STORAGE_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/**
 * Skipped while the user types or has a dialog open (a work item, for example),
 * and right after a reload so a bug cannot cause a reload loop. The next check retries.
 */
function reloadPage(): void {
  if (!isUserBusy() && claimReload()) {
    location.reload();
  }
}

/** The features that ask Azure DevOps for data. They wait while the tab is hidden. */
function syncFetchingFeatures(): void {
  void poller.sync();
  if (isPullRequestInboxLocation(location)) {
    void requiredReviewers.syncInbox();
  }
  if (isBoardLocation(location)) {
    void daysInColumn.sync();
  }
}

/** The Pipeline tab, the Overview's warnings and starred reviewers, on a pull request page. */
function syncPullRequestFeatures(): void {
  const pullRequest = parsePullRequestHref(location.pathname, basePath);
  pipelineTab?.sync(pullRequest);
  starredReviewers?.sync(pullRequest);
  overviewPipelineIssues?.sync(pullRequest, isTabActive());
}

function sync(): void {
  pipelineRunFrame?.sync();
  syncPullRequestFeatures();
  if (avatarInitials.isOn()) {
    showInitialsOnAvatars(document);
  }
  requiredReviewers.markAll();
  if (isBoardLocation(location)) {
    daysInColumnToggles.sync();
  }
  if (isTabActive()) {
    syncFetchingFeatures();
  }
  void reloader.check();
}

// ADO is a single-page app that re-renders its content. Re-apply after every DOM change.
let settleTimer: ReturnType<typeof setTimeout> | null = null;
new MutationObserver(() => {
  if (settleTimer !== null) {
    clearTimeout(settleTimer);
  }
  settleTimer = setTimeout(sync, DOM_SETTLE_MS);
}).observe(document.body, { childList: true, subtree: true });

setInterval(sync, TIMER_INTERVAL_MS);
document.addEventListener("visibilitychange", () => {
  if (!isTabActive()) {
    return;
  }
  void poller.sync();
  void reloader.check({ immediately: true });
});
sync();
