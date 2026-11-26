// The age cell of the pull request table: "5d · 3d · 2d", when the pull request was created,
// updated and published, each in a fixed slot so the dots line up. "–" where one does not apply
// or is not known yet. The full times show as the cell's tooltip.

import { MINUTE_MS, largestWholeUnit } from "../../core/elapsed-time.ts";

const AGE_CELL_SELECTOR = '[aria-colindex="5"]';
const AGE_CLASS = "fix-ado-table-age";
const STALE_ATTRIBUTE = "data-fix-ado-is-stale";
const AGE_LABEL = "Age ";
const AGE_LEGEND = "(c · u · p)";
/** The Age header's tooltip, which says what c, u and p stand for. */
const AGE_TOOLTIP = "Created · updated · published";
const NO_AGE = "–";
const PUBLISHED_SINCE_CLASS = "fix-ado-published-since";
const TOO_LONG_AGO_CLASS = "fix-ado-published-since-too-long";
/** The text Published since writes: "Published just now" or "Published 3 days ago". */
const PUBLISHED_PATTERN =
  /^Published (?:just now|(?<count>\d+) (?<unit>minute|hour|day|month|year)s? ago)$/u;
/** Azure DevOps's word before its time on a pull request that was never updated. */
const CREATED_WORD = "Created";
const SHORT_UNITS: Readonly<Record<string, string>> = {
  day: "d",
  hour: "h",
  minute: "m",
  month: "mo",
  year: "y",
};
const AGES = ["created", "updated", "published"] as const;

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "always" });

/** One of the three ages: "3d", and "Created 3 days ago" for the tooltip. */
interface Age {
  short: string;
  full: string;
}

interface Ages {
  created: Age | null;
  updated: Age | null;
  published: (Age & { isStale: boolean }) | null;
}

/** When the table learns each pull request's creation date, and the time to count from. */
interface AgeTimes {
  createdAt: (pullRequestId: number) => number | null;
  now: number;
}

const textOf = (element: Element): string =>
  (element.textContent ?? "").replaceAll(/\s+/gu, " ").trim();

/** "Created 3 days ago" and "3d", in the largest whole unit; "just now" and "now" under a minute. */
function ageSince(word: string, at: number, now: number): Age {
  const elapsed = now - at;
  if (elapsed < MINUTE_MS) {
    return { full: `${word} just now`, short: "now" };
  }
  const [count, unit] = largestWholeUnit(elapsed);
  return {
    full: `${word} ${relativeTime.format(-count, unit)}`,
    short: `${count}${SHORT_UNITS[unit] ?? ""}`,
  };
}

/** The publish time Published since shows on the row. */
function publishedAge(row: Element): Ages["published"] {
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
    short: unit === undefined ? "now" : `${count}${SHORT_UNITS[unit] ?? ""}`,
  };
}

/** Azure DevOps's time on the row, and whether it says "Created" or "Updated". */
function siteTime(row: Element): { at: number; isCreated: boolean } | null {
  const time = row.querySelector(`${AGE_CELL_SELECTOR} time.bolt-time-item[datetime]`);
  const line = time?.closest(".bolt-table-cell-content > *");
  if (!time || !line) {
    return null;
  }
  return {
    at: Date.parse(time.getAttribute("datetime") ?? ""),
    isCreated: textOf(line).startsWith(CREATED_WORD),
  };
}

/** True when the row does not say when its pull request was created, so it needs fetching. */
function needsCreationDate(row: Element): boolean {
  return siteTime(row)?.isCreated !== true;
}

function pullRequestIdOf(row: Element): number {
  return Number(/\/pullrequest\/(?<id>\d+)/u.exec(row.getAttribute("href") ?? "")?.groups?.id);
}

function agesOf(row: Element, { createdAt, now }: AgeTimes): Ages {
  const time = siteTime(row);
  const created = time?.isCreated === true ? time.at : createdAt(pullRequestIdOf(row));
  return {
    created: created === null ? null : ageSince("Created", created, now),
    published: publishedAge(row),
    updated: time === null || time.isCreated ? null : ageSince("Updated", time.at, now),
  };
}

/** The cell's three slots and the dots between them, added when missing. Hidden from screen
 *  readers, which read the site's full time instead. */
function slotsOf(cell: Element): Element {
  const shown = cell.querySelector(`:scope > .${AGE_CLASS}`);
  if (shown !== null) {
    return shown;
  }
  const { ownerDocument } = cell;
  const slots = Object.assign(ownerDocument.createElement("span"), { className: AGE_CLASS });
  slots.setAttribute("aria-hidden", "true");
  const parts = AGES.flatMap((age, index) => [
    ...(index === 0
      ? []
      : [
          Object.assign(ownerDocument.createElement("span"), {
            className: `${AGE_CLASS}-dot`,
            textContent: "·",
          }),
        ]),
    Object.assign(ownerDocument.createElement("span"), { className: `${AGE_CLASS}-${age}` }),
  ]);
  slots.append(...parts);
  cell.append(slots);
  return slots;
}

function showAttribute(element: Element, name: string, value: string | null): void {
  if (element.getAttribute(name) !== value) {
    if (value === null) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, value);
    }
  }
}

/** Each age in its slot, and the publish time's stale mark. */
function showSlots(slots: Element, ages: Ages): void {
  for (const age of AGES) {
    const slot = slots.querySelector(`.${AGE_CLASS}-${age}`);
    const text = ages[age]?.short ?? NO_AGE;
    if (slot !== null && slot.textContent !== text) {
      slot.textContent = text;
    }
  }
  const published = slots.querySelector(`.${AGE_CLASS}-published`);
  if (published !== null) {
    showAttribute(published, STALE_ATTRIBUTE, ages.published?.isStale === true ? "" : null);
  }
}

function showAge(row: Element, times: AgeTimes): void {
  const cell = row.querySelector(`:scope > ${AGE_CELL_SELECTOR}`);
  if (!cell) {
    return;
  }
  const ages = agesOf(row, times);
  showSlots(slotsOf(cell), ages);
  const full = AGES.flatMap((age) => ages[age]?.full ?? []).join(" · ");
  showAttribute(cell, "title", full === "" ? null : full);
}

/** The Age header's label: "Age (c · u · p)", the letters not in capitals. */
function showAgeHead(cell: Element): void {
  const legend = Object.assign(cell.ownerDocument.createElement("span"), {
    className: `${AGE_CLASS}-legend`,
    textContent: AGE_LEGEND,
  });
  cell.replaceChildren(AGE_LABEL, legend);
  cell.setAttribute("title", AGE_TOOLTIP);
}

/** Takes the ages away, with the cell's tooltip. */
function removeAge(row: Element): void {
  const cell = row.querySelector(`:scope > ${AGE_CELL_SELECTOR}`);
  cell?.querySelector(`:scope > .${AGE_CLASS}`)?.remove();
  cell?.removeAttribute("title");
}

export type { AgeTimes };
export { needsCreationDate, removeAge, showAge, showAgeHead };
