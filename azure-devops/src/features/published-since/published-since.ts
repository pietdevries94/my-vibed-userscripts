import type { PullRequestThread } from "../../pull-requests/review-requests.ts";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "always" });

const isDraftUpdate = (thread: PullRequestThread): boolean =>
  thread.isDeleted !== true &&
  thread.properties?.CodeReviewThreadType?.$value === "IsDraftUpdate" &&
  thread.publishedDate !== undefined;

/**
 * When a published pull request was last published, in epoch ms. Azure DevOps adds an
 * `IsDraftUpdate` thread each time a pull request moves into or out of draft, so for a
 * pull request that is published now, the newest one is its publish. Without one, it was
 * published when it was created.
 */
function publishedAt(creationDate: string, threads: PullRequestThread[]): number {
  const draftUpdates = threads
    .filter((thread) => isDraftUpdate(thread))
    .map((thread) => Date.parse(thread.publishedDate ?? ""));
  return draftUpdates.length > 0 ? Math.max(...draftUpdates) : Date.parse(creationDate);
}

/** "Published 3 minutes ago", in the largest whole unit. */
function publishedSinceText(publishedAtMs: number, nowMs: number): string {
  const elapsed = nowMs - publishedAtMs;
  if (elapsed < MINUTE_MS) {
    return "Published just now";
  }
  const [count, unit] = largestWholeUnit(elapsed);
  return `Published ${relativeTime.format(-count, unit)}`;
}

/** An elapsed time of at least a minute, in its largest whole unit. */
function largestWholeUnit(elapsedMs: number): [number, Intl.RelativeTimeFormatUnit] {
  const days = Math.floor(elapsedMs / DAY_MS);
  if (days >= DAYS_PER_YEAR) {
    return [Math.floor(days / DAYS_PER_YEAR), "year"];
  }
  if (days >= DAYS_PER_MONTH) {
    return [Math.floor(days / DAYS_PER_MONTH), "month"];
  }
  if (days >= 1) {
    return [days, "day"];
  }
  if (elapsedMs >= HOUR_MS) {
    return [Math.floor(elapsedMs / HOUR_MS), "hour"];
  }
  return [Math.floor(elapsedMs / MINUTE_MS), "minute"];
}

export { publishedAt, publishedSinceText };
