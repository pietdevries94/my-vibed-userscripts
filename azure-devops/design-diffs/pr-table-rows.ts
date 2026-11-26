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
  time: { text: string; isStale: boolean };
}

type Band = { link: string; title: string | null } | { label: string };

interface TableSection {
  groups: { band: Band | null; prs: TableRow[] }[];
}

interface DesignTable {
  width: number;
  isGrouped: boolean;
  section: TableSection;
}

function text(element: Element | null | undefined): string {
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
  const published = row.querySelector(".fix-ado-published-since");
  if (published !== null) {
    return {
      isStale: published.classList.contains("fix-ado-published-since-too-long"),
      text: text(published),
    };
  }
  return {
    isStale: false,
    text: text(row.querySelector('[aria-colindex="5"] .bolt-table-cell-content > div')),
  };
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
    id: Number(/\/pullrequest\/(?<id>\d+)/u.exec(row.getAttribute("href") ?? "")?.groups?.id),
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
    return { label: text(row) };
  }
  const title = text(row.querySelector(".fix-ado-work-item-group-title"));
  return { link: text(link), title: title === "" ? null : title };
}

function readTable(table: Element): DesignTable {
  const groups: TableSection["groups"] = [];
  for (const child of table.querySelector("tbody")?.children ?? []) {
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
    isGrouped: groups.some(({ band }) => band !== null),
    section: { groups },
    width: table.getBoundingClientRect().width,
  };
}

/** Each pull request table on the page, top to bottom. */
function readTables(): DesignTable[] {
  return [...document.querySelectorAll("table.repos-pr-list")].map((table) => readTable(table));
}

const HELPERS = [
  text,
  person,
  chipKind,
  voteOf,
  reviewersOf,
  timeOf,
  readRow,
  readBand,
  readTable,
  readTables,
];

/** The expression that is readTables() in the page. */
const READ_TABLES_SCRIPT = `(() => {\n${HELPERS.map((helper) => helper.toString()).join("\n")}\nreturn readTables();\n})()`;

export type { DesignTable };
export { READ_TABLES_SCRIPT };
