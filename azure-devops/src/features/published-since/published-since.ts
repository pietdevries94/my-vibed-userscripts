import type { Page } from "../../core/page.ts";
import type { PullRequestThread } from "../../pull-requests/review-requests.ts";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

/** How long a published pull request may wait for review, in weekday time. */
const MAX_WAIT_MS = 2 * DAY_MS;
const SUNDAY = 0;
const SATURDAY = 6;

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

/** The time between two moments that falls on Monday to Friday, in local time. */
function weekdayTimeBetween(fromMs: number, toMs: number): number {
  let total = 0;
  let start = fromMs;
  while (start < toMs) {
    const day = new Date(start);
    const nextMidnight = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
    const end = Math.min(nextMidnight, toMs);
    if (day.getDay() !== SUNDAY && day.getDay() !== SATURDAY) {
      total += end - start;
    }
    start = end;
  }
  return total;
}

/** True after more than two weekdays since the publish. Saturday and Sunday do not count. */
function isPublishedTooLongAgo(publishedAtMs: number, nowMs: number): boolean {
  return weekdayTimeBetween(publishedAtMs, nowMs) > MAX_WAIT_MS;
}

/** True on the inbox and on a repository's Active tab. A completed pull request needs no publish time. */
function showsPublishedSince(page: Page): boolean {
  return (
    page.kind === "pull-request-inbox" ||
    (page.kind === "pull-request-list" && page.listPage.status === "active")
  );
}

export { isPublishedTooLongAgo, publishedAt, publishedSinceText, showsPublishedSince };
