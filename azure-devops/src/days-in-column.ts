import type { AdoClient } from "./ado-client.ts";

/** One change to a work item, from the work item updates API. */
interface WorkItemUpdate {
  fields?: Record<string, { oldValue?: unknown; newValue?: unknown } | undefined>;
  revisedDate?: string;
}

type DaysInColumnClient = Pick<AdoClient, "getWorkItems" | "getWorkItemUpdates">;

interface ColumnEntry {
  rev: number;
  /** When the work item entered its current board column, or null when unknown. */
  enteredAt: string | null;
}

const CARD_SELECTOR = ".wit-card[data-itemid]";
const COLUMN_SELECTOR = ".kanban-board-column[data-column]";
const BAR_CLASS = "fix-ado-days-in-column";
const MS_PER_SECOND = 1000;
const MS_PER_DAY = 86_400_000;
/** How often the script asks which cards changed, to fetch their updates again. */
const CHECK_INTERVAL_MS = 60_000;
const MAX_DOTS = 30;
/** Dots up to this day are grey, then orange. */
const FRESH_DAYS = 7;
/** Dots after this day are red. */
const AGING_DAYS = 14;

/**
 * When the work item entered its current board column: the date of its last
 * board column change. Its first update sets the column when it is created.
 */
function columnEnteredAt(updates: WorkItemUpdate[]): string | null {
  for (const update of updates.toReversed()) {
    const columnChange = update.fields?.["System.BoardColumn"];
    if (columnChange !== undefined && columnChange.newValue !== columnChange.oldValue) {
      const changedDate = update.fields?.["System.ChangedDate"]?.newValue;
      return typeof changedDate === "string" ? changedDate : null;
    }
  }
  return null;
}

function daysSince(enteredAt: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(enteredAt)) / MS_PER_DAY));
}

function dotAge(day: number): string {
  if (day <= FRESH_DAYS) {
    return "fresh";
  }
  return day <= AGING_DAYS ? "aging" : "old";
}

const LOADING_DOT_COUNT = 3;

function dotsFor(document: Document, days: number | null): HTMLElement[] {
  const ages =
    days === null
      ? Array.from({ length: LOADING_DOT_COUNT }, () => "loading")
      : Array.from({ length: Math.min(days, MAX_DOTS) }, (_entry, index) => dotAge(index + 1));
  return ages.map((age) => {
    const dot = document.createElement("span");
    dot.dataset.age = age;
    return dot;
  });
}

function captionFor(days: number | null): string {
  if (days === null) {
    return "";
  }
  if (days === 0) {
    return "Less than a day in this column";
  }
  return `${days} ${days === 1 ? "day" : "days"} in this column`;
}

function createDotBar(document: Document, days: number | null): HTMLElement {
  const bar = document.createElement("div");
  bar.className = BAR_CLASS;
  bar.dataset.days = String(days);
  bar.title = captionFor(days);
  if (days === null) {
    bar.setAttribute("aria-hidden", "true");
  } else {
    bar.setAttribute("aria-label", bar.title);
    bar.setAttribute("role", "img");
  }
  bar.append(...dotsFor(document, days));
  return bar;
}

/**
 * A dot per day under the card, like Jira. Null while the day count is unknown:
 * three loading dots. The bar stays, also when empty, so the card keeps its height.
 */
function showDaysInColumn(card: HTMLElement, days: number | null): void {
  const existing = card.querySelector<HTMLElement>(`.${BAR_CLASS}`);
  if (existing?.dataset.days === String(days)) {
    // Unchanged. Rewriting it would wake the page's mutation observer again.
    return;
  }
  existing?.remove();
  (card.querySelector(".card-content") ?? card).append(createDotBar(card.ownerDocument, days));
}

function findCards(document: Document): Map<number, HTMLElement[]> {
  const cards = new Map<number, HTMLElement[]>();
  for (const card of document.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
    const id = Number(card.dataset.itemid);
    if (Number.isInteger(id) && id > 0) {
      cards.set(id, [...(cards.get(id) ?? []), card]);
    }
  }
  return cards;
}

interface Tracker {
  client: DaysInColumnClient;
  now: () => number;
  entries: Map<number, ColumnEntry>;
  /** The board column each card was last seen in. */
  columnIds: Map<number, string | null>;
  lastCheckAt: number;
  pausedUntil: number;
  isChecking: boolean;
}

function columnIdOf(card: HTMLElement): string | null {
  return card.closest<HTMLElement>(COLUMN_SELECTOR)?.dataset.column ?? null;
}

/**
 * A card that shows up in another column moved there just now. The server may
 * not have saved the move yet, so the next check that sees a new revision corrects it.
 */
function noteMoves(tracker: Tracker, cards: Map<number, HTMLElement[]>): void {
  for (const [id, [element]] of cards) {
    const columnId = columnIdOf(element);
    const lastColumnId = tracker.columnIds.get(id);
    const entry = tracker.entries.get(id);
    if (lastColumnId !== undefined && lastColumnId !== columnId && entry !== undefined) {
      entry.enteredAt = new Date(tracker.now()).toISOString();
    }
    tracker.columnIds.set(id, columnId);
  }
}

function showBars(tracker: Tracker, cards: Map<number, HTMLElement[]>): void {
  noteMoves(tracker, cards);
  for (const [id, elements] of cards) {
    const entry = tracker.entries.get(id);
    const enteredAt = entry?.enteredAt ?? null;
    let days: number | null = null;
    if (entry !== undefined) {
      days = enteredAt === null ? 0 : daysSince(enteredAt, tracker.now());
    }
    for (const element of elements) {
      showDaysInColumn(element, days);
    }
  }
}

function pauseIfAsked(tracker: Tracker, retryAfterSeconds: number | null): boolean {
  if (retryAfterSeconds === null) {
    return false;
  }
  tracker.pausedUntil = tracker.now() + retryAfterSeconds * MS_PER_SECOND;
  return true;
}

/** Fetches the updates of each card that is new or changed. Stops when asked to slow down. */
async function fetchChangedCards(tracker: Tracker, ids: number[]): Promise<void> {
  const { workItems, retryAfterSeconds } = await tracker.client.getWorkItems(ids);
  if (pauseIfAsked(tracker, retryAfterSeconds)) {
    return;
  }
  const changed = workItems.filter(({ id, rev }) => tracker.entries.get(id)?.rev !== rev);
  for (const { id, rev } of changed) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one card at a time keeps the load on Azure DevOps low
    const response = await tracker.client.getWorkItemUpdates(id);
    tracker.entries.set(id, { enteredAt: columnEnteredAt(response.updates), rev });
    if (pauseIfAsked(tracker, response.retryAfterSeconds)) {
      return;
    }
  }
}

function isCheckDue(tracker: Tracker, ids: number[]): boolean {
  const now = tracker.now();
  const hasNewCard = ids.some((id) => !tracker.entries.has(id));
  const isDue = hasNewCard || now - tracker.lastCheckAt >= CHECK_INTERVAL_MS;
  return !tracker.isChecking && ids.length > 0 && isDue && now >= tracker.pausedUntil;
}

async function check(tracker: Tracker, ids: number[]): Promise<void> {
  tracker.isChecking = true;
  tracker.lastCheckAt = tracker.now();
  try {
    await fetchChangedCards(tracker, ids);
  } catch {
    // Wait a full interval, also for a new card, before trying again.
    tracker.pausedUntil = tracker.now() + CHECK_INTERVAL_MS;
  } finally {
    tracker.isChecking = false;
  }
}

/**
 * Keeps a days-in-column bar on every board card. Fetches a card's updates once,
 * and again only when its work item changed.
 */
function createDaysInColumn(options: {
  client: DaysInColumnClient;
  document: Document;
  now: () => number;
}): { sync: () => Promise<void> } {
  const tracker: Tracker = {
    client: options.client,
    columnIds: new Map(),
    entries: new Map(),
    isChecking: false,
    lastCheckAt: Number.NEGATIVE_INFINITY,
    now: options.now,
    pausedUntil: Number.NEGATIVE_INFINITY,
  };
  return {
    async sync() {
      const cards = findCards(options.document);
      showBars(tracker, cards);
      const ids = [...cards.keys()];
      if (isCheckDue(tracker, ids)) {
        await check(tracker, ids);
        showBars(tracker, findCards(options.document));
      }
    },
  };
}

export type { DaysInColumnClient, WorkItemUpdate };
export { MAX_DOTS, columnEnteredAt, createDaysInColumn, daysSince, showDaysInColumn };
