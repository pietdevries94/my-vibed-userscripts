// What the pull request table's rows show, read from a list page on the fake site, in the shape
// the design's table takes. The functions run in the browser, as one script that
// READ_TABLES_SCRIPT puts together, so each one only calls the others. Dev file only.

interface Person {
  name: string;
  initials: string;
  hue: string;
}

type ChipKind = "draft" | "auto" | "conflicts" | "other";

interface TableRow {
  /** Azure DevOps marks a row with something new since the last visit. */
  isMarked: boolean;
  /** The hue of its work item's colour, or null without one. */
  hue: number | null;
  status: string;
  title: string;
  /** Draft, Auto-complete, Conflicts and the other pills after the title, in order. */
  chips: { kind: ChipKind; text: string }[];
  author: Person;
  id: number;
  repo: string;
  branch: string;
  workItem: { text: string; isId: boolean } | null;
  reviewers: (Person & { isRequired: boolean; vote: string | null })[];
  moreReviewers: string;
  comments: { text: string; isActive: boolean } | null;
  /** The created, updated and published ages as the age cell shows them, "–" for none, and its
   *  tooltip. */
  time: {
    created: string;
    updated: string;
    published: string;
    isStale: boolean;
    full: string;
  };
}

type Band = ({ link: string; title: string | null } | { label: string }) & { hue: number | null };

interface TableSection {
  groups: { band: Band | null; prs: TableRow[] }[];
  /** The heights Azure DevOps holds for rows it has not drawn, above and below the drawn ones,
   *  where it draws the rows as the list scrolls. */
  spacerAbove: number;
  spacerBelow: number;
}

/** A section card: its title and count, and its list. */
interface DesignTable {
  /** False for a card without a header, as on a repository's Completed tab. */
  hasHeader: boolean;
  name: string;
  count: string;
  width: number;
  isGrouped: boolean;
  /** Linked work item is still loading the groups: the rows show as a skeleton. */
  isLoading: boolean;
  section: TableSection;
}

function text(element: Node | null | undefined): string {
  return (element?.textContent ?? "").replaceAll(/\s+/gu, " ").trim();
}

function person(coin: HTMLElement | null): Person {
  return {
    hue: coin?.style.getPropertyValue("--fix-ado-hue") ?? "",
    initials: coin?.dataset.fixAdoInitials ?? "",
    name: coin?.getAttribute("aria-label")?.trim() ?? "",
  };
}

function chipKind(pill: Element): ChipKind {
  if (pill.classList.contains("repos-pr-list-draft-pill")) {
    return "draft";
  }
  if (pill.classList.contains("repos-pr-list-auto-complete-pill")) {
    return "auto";
  }
  return pill.classList.contains("repos-pr-list-conflicts-pill") ? "conflicts" : "other";
}

/** The design's vote for a reviewer's vote icon, by its state class. */
function voteOf(reviewer: Element): string | null {
  const icon = reviewer.querySelector(".repos-pr-reviewer-vote");
  const states = [
    ["approved", "approved"],
    ["rejected", "rejected"],
    ["waiting", "wait"],
  ];
  return states.find(([state]) => icon?.classList.contains(state) === true)?.[1] ?? null;
}

/** The reviewers, required ones first, as the list shows them. */
function reviewersOf(cell: Element | null): TableRow["reviewers"] {
  const reviewers = [...(cell?.querySelectorAll<HTMLElement>(".pr-reviewer") ?? [])].map(
    (reviewer) =>
      Object.assign(person(reviewer.querySelector<HTMLElement>(".bolt-coin")), {
        isRequired: Object.hasOwn(reviewer.dataset, "fixAdoRequired"),
        vote: voteOf(reviewer),
      }),
  );
  return reviewers.toSorted(
    (first, second) => Number(second.isRequired) - Number(first.isRequired),
  );
}

function timeOf(row: Element): TableRow["time"] {
  const cell = row.querySelector<HTMLElement>('[aria-colindex="5"]');
  const slot = (age: string): HTMLElement | null | undefined =>
    cell?.querySelector<HTMLElement>(`.fix-ado-table-age-${age}`);
  const published = slot("published");
  return {
    created: text(slot("created")),
    full: cell?.getAttribute("title") ?? "",
    isStale: published ? Object.hasOwn(published.dataset, "fixAdoIsStale") : false,
    published: text(published),
    updated: text(slot("updated")),
  };
}

/** The hue Linked work item gave the row or group row, or null. */
function hueOf(element: Element): number | null {
  const hue = element instanceof HTMLElement ? element.dataset.fixAdoWorkItemHue : undefined;
  return hue === undefined ? null : Number(hue);
}

function readRow(row: Element): TableRow {
  const count = row.querySelector(".repos-pr-list-comment-count");
  const workItem = row.querySelector(".fix-ado-linked-work-item");
  const reviewerCell = row.querySelector('[aria-colindex="3"]');
  const status =
    row.querySelector<SVGElement>(".fix-ado-pipeline-status")?.dataset.status ?? "none";
  const pills = row.querySelectorAll(".bolt-table-two-line-cell-item:first-child .bolt-pill");
  return {
    author: person(row.querySelector<HTMLElement>('[aria-colindex="1"] .bolt-coin')),
    branch: text(row.querySelector(".secondary-text .monospaced-xs")),
    chips: [...pills].map((pill) => ({ kind: chipKind(pill), text: text(pill) })),
    comments:
      count === null
        ? null
        : { isActive: count.classList.contains("has-active-comments"), text: text(count) },
    hue: hueOf(row),
    id: Number(/\/pullrequest\/(?<id>\d+)/u.exec(row.getAttribute("href") ?? "")?.groups?.id),
    isMarked: row.classList.contains("bolt-list-row-marked"),
    moreReviewers: text(reviewerCell?.querySelector(".bolt-pill")),
    repo: text(row.querySelector(".secondary-text .padding-horizontal-4:not(.monospaced-xs)")),
    reviewers: reviewersOf(reviewerCell),
    status: status === "loading" ? "none" : status,
    time: timeOf(row),
    title: text(row.querySelector(".bolt-table-two-line-cell-item .body-l")),
    workItem:
      workItem === null ? null : { isId: text(workItem).startsWith("#"), text: text(workItem) },
  };
}

function readBand(row: Element): Band {
  const link = row.querySelector("a");
  if (link === null) {
    return { hue: hueOf(row), label: text(row) };
  }
  const title = text(row.querySelector(".fix-ado-work-item-group-title"));
  return { hue: hueOf(row), link: text(link), title: title === "" ? null : title };
}

/** "Assigned to me · Waiting for author": the title, and the stacked card's tab after it. */
function cardName(card: Element): string {
  const title = text(card.querySelector(".repos-pr-section-header-title > .text-ellipsis"));
  const tab = card.querySelector(".fix-ado-assigned-tab-name");
  const tabLabel = tab === null ? "" : text(tab.firstChild);
  return tabLabel === "" ? title : `${title} ${tabLabel}`;
}

/** How high the spacer rows among these rows are together. */
function spacerHeight(rows: Element[]): number {
  return rows
    .filter((child) => child.classList.contains("bolt-list-row-spacer"))
    .reduce((sum, spacer) => sum + spacer.getBoundingClientRect().height, 0);
}

/** The heights of Azure DevOps's spacer rows before the first pull request and after the last. */
function spacersOf(body: Element | null | undefined): { spacerAbove: number; spacerBelow: number } {
  const children = [...(body?.children ?? [])];
  const rows = children.filter((child) => child.matches("a.bolt-table-row"));
  const first = rows.length === 0 ? children.length : children.indexOf(rows[0] ?? children[0]);
  const last = rows.length === 0 ? children.length : children.indexOf(rows.at(-1) ?? children[0]);
  return {
    spacerAbove: spacerHeight(children.slice(0, first)),
    spacerBelow: spacerHeight(children.slice(last + 1)),
  };
}

function readTable(card: Element): DesignTable {
  const table = card.querySelector<HTMLElement>("table.repos-pr-list");
  const groups: TableSection["groups"] = [];
  for (const child of table?.querySelector("tbody")?.children ?? []) {
    if (child.classList.contains("fix-ado-work-item-group")) {
      groups.push({ band: readBand(child), prs: [] });
    } else if (child.matches('a.bolt-table-row[href*="/pullrequest/"]')) {
      if (groups.length === 0) {
        groups.push({ band: null, prs: [] });
      }
      groups.at(-1)?.prs.push(readRow(child));
    }
  }
  return {
    count: text(
      card.querySelector(".fix-ado-assigned-tab-name .bolt-pill") ??
        card.querySelector(".repos-pr-section-header-title .bolt-pill"),
    ),
    hasHeader: card.querySelector(".repos-pr-section-header") !== null,
    isGrouped: groups.some(({ band }) => band !== null),
    isLoading: table !== null && Object.hasOwn(table.dataset, "fixAdoGroupsLoading"),
    name: cardName(card),
    section: { groups, ...spacersOf(table?.querySelector("tbody")) },
    width: card.getBoundingClientRect().width,
  };
}

/** Each section card with a pull request list, top to bottom. */
function readTables(): DesignTable[] {
  return [...document.querySelectorAll(".repos-pr-section-card:has(table.repos-pr-list)")].map(
    (card) => readTable(card),
  );
}

const HELPERS = [
  text,
  person,
  hueOf,
  chipKind,
  voteOf,
  reviewersOf,
  timeOf,
  readRow,
  readBand,
  cardName,
  spacerHeight,
  spacersOf,
  readTable,
  readTables,
];

/** The expression that is readTables() in the page. */
const READ_TABLES_SCRIPT = `(() => {\n${HELPERS.map((helper) => helper.toString()).join("\n")}\nreturn readTables();\n})()`;

export type { DesignTable };
export { READ_TABLES_SCRIPT };
