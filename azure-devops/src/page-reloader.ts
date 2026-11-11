import { AdoRequestError } from "./ado-client.ts";

export const PAGE_CHECK_INTERVAL_MS = 30_000;
export const FAILED_PAGE_CHECK_RETRY_MS = 60_000;

/** A page whose content on the server can be compared with what the browser loaded. */
export interface WatchedPage<Snapshot> {
  /** Identifies the page, so each page is compared with its own first load. */
  key: string;
  fetchSnapshot(): Promise<{ snapshot: Snapshot; retryAfterSeconds: number | null }>;
  hasChanged(loaded: Snapshot, current: Snapshot): boolean;
  /** Adds what `current` knows about items that appeared on the page after its first load. */
  extendLoaded?(loaded: Snapshot, current: Snapshot): Snapshot;
}

interface ReloaderOptions {
  now: () => number;
  /** The watched page the browser shows, or null on any other page. */
  currentPage: () => WatchedPage<unknown> | null;
  isTabActive: () => boolean;
  reload: () => void;
}

/**
 * Reloads the page when its content on the server differs from what the page
 * loaded. Checks only while the tab is active, except for the first check of a
 * page, which records what the page loaded.
 */
export function createPageReloader(options: ReloaderOptions) {
  // Kept for the whole page lifetime. ADO can show cached content after
  // in-app navigation, so the snapshot from the first visit stays the reference.
  const loadedSnapshots = new Map<string, unknown>();
  let nextCheckAt = 0;
  let pausedUntil = 0;
  let isChecking = false;

  return {
    /** `immediately` skips the wait between checks. Use it when the tab becomes active. */
    async check({ immediately = false } = {}): Promise<void> {
      const page = options.currentPage();
      if (!page || isChecking) return;
      const hasLoadedSnapshot = loadedSnapshots.has(page.key);
      if (hasLoadedSnapshot) {
        if (!options.isTabActive() || options.now() < pausedUntil) return;
        if (!immediately && options.now() < nextCheckAt) return;
      }

      isChecking = true;
      try {
        const { snapshot, retryAfterSeconds } = await page.fetchSnapshot();
        if (retryAfterSeconds !== null) pausedUntil = options.now() + retryAfterSeconds * 1000;
        nextCheckAt = options.now() + PAGE_CHECK_INTERVAL_MS;
        if (!hasLoadedSnapshot) {
          loadedSnapshots.set(page.key, snapshot);
        } else if (page.hasChanged(loadedSnapshots.get(page.key), snapshot)) {
          options.reload();
        } else if (page.extendLoaded) {
          loadedSnapshots.set(page.key, page.extendLoaded(loadedSnapshots.get(page.key), snapshot));
        }
      } catch (error) {
        if (error instanceof AdoRequestError && error.retryAfterSeconds !== null) {
          pausedUntil = options.now() + error.retryAfterSeconds * 1000;
        }
        nextCheckAt = options.now() + FAILED_PAGE_CHECK_RETRY_MS;
      } finally {
        isChecking = false;
      }
    },
  };
}
