import { AdoRequestError } from "./ado-client.ts";

const PAGE_CHECK_INTERVAL_MS = 30_000;
const FAILED_PAGE_CHECK_RETRY_MS = 60_000;
const MS_PER_SECOND = 1000;

/** A page whose content on the server can be compared with what the browser loaded. */
interface WatchedPage<Snapshot> {
  /** Identifies the page, so each page is compared with its own first load. */
  key: string;
  fetchSnapshot: () => Promise<{ snapshot: Snapshot; retryAfterSeconds: number | null }>;
  // oxlint-disable-next-line typescript/method-signature-style -- method syntax keeps WatchedPage<Snapshot> assignable to WatchedPage<unknown>
  hasChanged(loaded: Snapshot, current: Snapshot): boolean;
  /** Adds what `current` knows about items that appeared on the page after its first load. */
  // oxlint-disable-next-line typescript/method-signature-style -- method syntax keeps WatchedPage<Snapshot> assignable to WatchedPage<unknown>
  extendLoaded?(loaded: Snapshot, current: Snapshot): Snapshot;
}

interface ReloaderOptions {
  now: () => number;
  /** The watched page the browser shows, or null on any other page. */
  currentPage: () => WatchedPage<unknown> | null;
  isTabActive: () => boolean;
  reload: () => void;
}

interface PageReloader {
  /** `immediately` skips the wait between checks. Use it when the tab becomes active. */
  check: (when?: { immediately?: boolean }) => Promise<void>;
}

interface ReloaderState {
  options: ReloaderOptions;
  /**
   * Kept for the whole page lifetime. ADO can show cached content after
   * in-app navigation, so the snapshot from the first visit stays the reference.
   */
  loadedSnapshots: Map<string, unknown>;
  nextCheckAt: number;
  pausedUntil: number;
  isChecking: boolean;
}

interface CheckedPage {
  page: WatchedPage<unknown>;
  hasLoadedSnapshot: boolean;
}

/** The first check of a page always runs. Later ones wait for an active tab and the interval. */
function isCheckDue(
  state: ReloaderState,
  page: WatchedPage<unknown>,
  immediately: boolean,
): boolean {
  if (!state.loadedSnapshots.has(page.key)) {
    return true;
  }
  if (!state.options.isTabActive() || state.options.now() < state.pausedUntil) {
    return false;
  }
  return immediately || state.options.now() >= state.nextCheckAt;
}

function pauseFor(state: ReloaderState, retryAfterSeconds: number | null): void {
  if (retryAfterSeconds !== null) {
    state.pausedUntil = state.options.now() + retryAfterSeconds * MS_PER_SECOND;
  }
}

function compareWithLoaded(
  state: ReloaderState,
  { page, hasLoadedSnapshot }: CheckedPage,
  snapshot: unknown,
): void {
  if (!hasLoadedSnapshot) {
    state.loadedSnapshots.set(page.key, snapshot);
  } else if (page.hasChanged(state.loadedSnapshots.get(page.key), snapshot)) {
    state.options.reload();
  } else if (page.extendLoaded) {
    state.loadedSnapshots.set(
      page.key,
      page.extendLoaded(state.loadedSnapshots.get(page.key), snapshot),
    );
  }
}

function recordFailure(state: ReloaderState, error: unknown): void {
  if (error instanceof AdoRequestError) {
    pauseFor(state, error.retryAfterSeconds);
  }
  state.nextCheckAt = state.options.now() + FAILED_PAGE_CHECK_RETRY_MS;
}

async function runCheck(state: ReloaderState, page: WatchedPage<unknown>): Promise<void> {
  const checkedPage = { hasLoadedSnapshot: state.loadedSnapshots.has(page.key), page };
  state.isChecking = true;
  try {
    const { snapshot, retryAfterSeconds } = await page.fetchSnapshot();
    pauseFor(state, retryAfterSeconds);
    state.nextCheckAt = state.options.now() + PAGE_CHECK_INTERVAL_MS;
    compareWithLoaded(state, checkedPage, snapshot);
  } catch (error) {
    recordFailure(state, error);
  } finally {
    state.isChecking = false;
  }
}

/**
 * Reloads the page when its content on the server differs from what the page
 * loaded. Checks only while the tab is active, except for the first check of a
 * page, which records what the page loaded.
 */
function createPageReloader(options: ReloaderOptions): PageReloader {
  const state: ReloaderState = {
    isChecking: false,
    loadedSnapshots: new Map(),
    nextCheckAt: 0,
    options,
    pausedUntil: 0,
  };
  return {
    async check({ immediately = false } = {}) {
      const page = options.currentPage();
      if (!page || state.isChecking || !isCheckDue(state, page, immediately)) {
        return;
      }
      await runCheck(state, page);
    },
  };
}

export type { PageReloader, WatchedPage };
export { FAILED_PAGE_CHECK_RETRY_MS, PAGE_CHECK_INTERVAL_MS, createPageReloader };
