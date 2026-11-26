// An elapsed time in its largest whole unit, as "3 days ago" and "3d" count it.

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

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

export { DAY_MS, MINUTE_MS, largestWholeUnit };
