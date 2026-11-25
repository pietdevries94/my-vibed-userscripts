// "3 hours ago", for the created time of a pull request row the script builds.
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_WEEK = 604_800;
/** Thirty days, as a month. */
const SECONDS_PER_MONTH = 2_592_000;
/** 365 days, as a year. */
const SECONDS_PER_YEAR = 31_536_000;
const SECONDS_PER_UNIT: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", SECONDS_PER_YEAR],
  ["month", SECONDS_PER_MONTH],
  ["week", SECONDS_PER_WEEK],
  ["day", SECONDS_PER_DAY],
  ["hour", SECONDS_PER_HOUR],
  ["minute", SECONDS_PER_MINUTE],
];
const MS_PER_SECOND = 1000;

/** How long before `now` the time `then` was, or "now" within a minute. */
function relativeTime(then: number, now: number, locale?: string): string {
  const seconds = (now - then) / MS_PER_SECOND;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, unitSeconds] of SECONDS_PER_UNIT) {
    if (seconds >= unitSeconds) {
      return format.format(-Math.floor(seconds / unitSeconds), unit);
    }
  }
  return format.format(0, "second");
}

export { relativeTime };
