// The age cell of the pull request table: "3d p", how long ago and c, u or p for created,
// updated or published, with the full time as the cell's tooltip.

import { MINUTE_MS, largestWholeUnit } from "../../core/elapsed-time.ts";

const AGE_CELL_SELECTOR = '[aria-colindex="5"]';
const AGE_CLASS = "fix-ado-table-age";
const STALE_ATTRIBUTE = "data-fix-ado-is-stale";
/** The age's letters, explained as the Age header's tooltip. */
const AGE_LEGEND = "c: created, u: updated, p: published";
const PUBLISHED_SINCE_CLASS = "fix-ado-published-since";
const TOO_LONG_AGO_CLASS = "fix-ado-published-since-too-long";
/** The text Published since writes: "Published just now" or "Published 3 days ago". */
const PUBLISHED_PATTERN =
  /^Published (?:just now|(?<count>\d+) (?<unit>minute|hour|day|month|year)s? ago)$/u;
const SHORT_UNITS: Readonly<Record<string, string>> = {
  day: "d",
  hour: "h",
  minute: "m",
  month: "mo",
  year: "y",
};

/** What the age cell shows: "3d", c, u or p, the full time, and whether it is too long ago. */
interface Age {
  short: string;
  kind: string;
  full: string;
  isStale: boolean;
}

const textOf = (element: Element): string =>
  (element.textContent ?? "").replaceAll(/\s+/gu, " ").trim();

/** "3d" for 3 days ago, in the largest whole unit; "now" under a minute. */
function shortElapsed(elapsedMs: number): string {
  if (elapsedMs < MINUTE_MS) {
    return "now";
  }
  const [count, unit] = largestWholeUnit(elapsedMs);
  return `${count}${SHORT_UNITS[unit] ?? ""}`;
}

/** The publish time Published since shows on the row, which says more than Azure DevOps's. */
function publishedAge(row: Element): Age | null {
  const published = row.querySelector(`.${PUBLISHED_SINCE_CLASS}`);
  const full = published === null ? "" : textOf(published);
  const groups = PUBLISHED_PATTERN.exec(full)?.groups;
  if (published === null || groups === undefined) {
    return null;
  }
  const { count, unit } = groups;
  return {
    full,
    isStale: published.classList.contains(TOO_LONG_AGO_CLASS),
    kind: "p",
    short: unit === undefined ? "now" : `${count}${SHORT_UNITS[unit] ?? ""}`,
  };
}

/** Azure DevOps's "Created 3 days ago" or "Updated 3 days ago", from its time's date. */
function siteAge(row: Element, now: number): Age | null {
  const time = row.querySelector(`${AGE_CELL_SELECTOR} time.bolt-time-item[datetime]`);
  const line = time?.closest(".bolt-table-cell-content > *");
  if (!time || !line) {
    return null;
  }
  const full = textOf(line);
  return {
    full,
    isStale: false,
    kind: full.charAt(0).toLowerCase(),
    short: shortElapsed(now - Date.parse(time.getAttribute("datetime") ?? "")),
  };
}

/** The cell's "3d p", added when missing. Hidden from screen readers, which read the site's
 *  full time instead. */
function shortAgeOf(cell: Element): Element {
  const shown = cell.querySelector(`:scope > .${AGE_CLASS}`);
  if (shown !== null) {
    return shown;
  }
  const added = Object.assign(cell.ownerDocument.createElement("span"), { className: AGE_CLASS });
  added.setAttribute("aria-hidden", "true");
  cell.append(added);
  return added;
}

function showShortAge(cell: Element, text: string): void {
  const shown = shortAgeOf(cell);
  if (shown.textContent !== text) {
    shown.textContent = text;
  }
}

function showAge(row: Element, now: number): void {
  const cell = row.querySelector(`:scope > ${AGE_CELL_SELECTOR}`);
  const age = publishedAge(row) ?? siteAge(row, now);
  if (!cell || !age) {
    return;
  }
  showShortAge(cell, `${age.short} ${age.kind}`);
  if (cell.getAttribute("title") !== age.full) {
    cell.setAttribute("title", age.full);
  }
  if (cell.hasAttribute(STALE_ATTRIBUTE) !== age.isStale) {
    cell.toggleAttribute(STALE_ATTRIBUTE, age.isStale);
  }
}

/** Takes the short age away, with the cell's tooltip and stale mark. */
function removeAge(row: Element): void {
  const cell = row.querySelector(`:scope > ${AGE_CELL_SELECTOR}`);
  cell?.querySelector(`:scope > .${AGE_CLASS}`)?.remove();
  cell?.removeAttribute("title");
  cell?.removeAttribute(STALE_ATTRIBUTE);
}

export { AGE_LEGEND, removeAge, showAge };
