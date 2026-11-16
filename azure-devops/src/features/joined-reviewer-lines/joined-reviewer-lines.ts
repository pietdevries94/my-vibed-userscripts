const ROW_SELECTOR = ".activity-feed-list > tbody > .bolt-timeline-row";
const JOINED_CLASS = "fix-ado-joined-line";
const LINE_SELECTOR = `.activity-card-subtle:not(.${JOINED_CLASS})`;
/** A line about a person has these parts: avatar, name, words, avatar, name, words. */
const PERSON_LINE_PART_COUNT = 6;

/** A line of the activity feed in which someone does something with a person, such as adding a reviewer. */
interface PersonLine {
  row: HTMLElement;
  /** Azure DevOps's own line. */
  line: HTMLElement;
  /** Who did it, with avatar and name. */
  actor: Node[];
  actorName: string;
  /** What was done, such as " added ". */
  words: string;
  /** The person it was done with, with avatar and name. */
  person: Node[];
  personName: string;
  /** How the line ends, such as " as a reviewer". It tells required from optional. */
  ending: string;
}

/** Lines next to each other by the same actor with the same words, newest first. */
type Run = PersonLine[];

const isBlank = (node: Node): boolean =>
  node.nodeType === node.TEXT_NODE && (node.textContent ?? "").trim() === "";

const isText = (node: Node | undefined): node is Node => node?.nodeType === node?.TEXT_NODE;

/** The names on the two avatars of a line, or null when it has another number of avatars. */
function avatarNamesOf(line: HTMLElement): [string, string] | null {
  const names = [...line.querySelectorAll(".bolt-coin")].map(
    (avatar) => avatar.getAttribute("aria-label") ?? "",
  );
  const [actorName, personName] = names;
  return names.length === 2 && actorName !== undefined && personName !== undefined
    ? [actorName, personName]
    : null;
}

function personLineOf(row: HTMLElement): PersonLine | null {
  const line = row.querySelector<HTMLElement>(LINE_SELECTOR);
  if (line === null) {
    return null;
  }
  const parts = [...line.childNodes].filter((node) => !isBlank(node));
  const [actorAvatar, actorLabel, words, avatar, label, ending] = parts;
  const names = avatarNamesOf(line);
  if (
    names === null ||
    parts.length !== PERSON_LINE_PART_COUNT ||
    actorAvatar === undefined ||
    actorLabel === undefined ||
    avatar === undefined ||
    label === undefined ||
    !isText(words) ||
    !isText(ending)
  ) {
    return null;
  }
  return {
    actor: [actorAvatar, actorLabel],
    actorName: names[0],
    ending: ending.textContent ?? "",
    line,
    person: [avatar, label],
    personName: names[1],
    row,
    words: words.textContent ?? "",
  };
}

const continuesRun = (run: Run, next: PersonLine): boolean =>
  run[0]?.actorName === next.actorName && run[0].words.trim() === next.words.trim();

/** The runs of two lines or more among the rows of the feed. */
function runsOf(rows: HTMLElement[]): Run[] {
  const runs: Run[] = [];
  let current: Run = [];
  for (const row of rows) {
    const personLine = personLineOf(row);
    if (personLine !== null && continuesRun(current, personLine)) {
      current.push(personLine);
    } else {
      current = personLine === null ? [] : [personLine];
      if (personLine !== null) {
        runs.push(current);
      }
    }
  }
  return runs.filter((run) => run.length > 1);
}

/** The lines of a run by their ending, oldest first, in the order the endings first show up. */
function groupsOf(run: Run): PersonLine[][] {
  const groups = new Map<string, PersonLine[]>();
  for (const personLine of run.toReversed()) {
    const key = personLine.ending.trim();
    groups.set(key, [...(groups.get(key) ?? []), personLine]);
  }
  return [...groups.values()];
}

/** What tells a joined line from another: who, the words, and every person with their ending. */
const signatureOf = (run: Run): string =>
  JSON.stringify(
    run.map(({ actorName, ending, personName, words }) => [actorName, words, personName, ending]),
  );

const clonesOf = (nodes: Node[]): Node[] => nodes.map((node) => node.cloneNode(true));

/** The people of one ending, then the ending: "A, B as a reviewer". */
function groupParts(group: PersonLine[]): (Node | string)[] {
  const parts: (Node | string)[] = [];
  for (const [index, personLine] of group.entries()) {
    if (index > 0) {
      parts.push(", ");
    }
    parts.push(...clonesOf(personLine.person));
  }
  parts.push(group[0]?.ending ?? "");
  return parts;
}

/** The parts of a joined line: "actor added A, B as a reviewer, C as a required reviewer". */
function joinedParts(newest: PersonLine, run: Run): (Node | string)[] {
  const parts: (Node | string)[] = [...clonesOf(newest.actor), newest.words];
  for (const [index, group] of groupsOf(run).entries()) {
    if (index > 0) {
      parts.push(", ");
    }
    parts.push(...groupParts(group));
  }
  return parts;
}

/** A line like Azure DevOps's own, for the whole run. */
function createJoinedLine(newest: PersonLine, run: Run, signature: string): HTMLElement {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a clone of an HTMLElement is one
  const joined = newest.line.cloneNode(false) as HTMLElement;
  joined.classList.add(JOINED_CLASS);
  joined.dataset.fixAdoJoinedFrom = signature;
  joined.append(...joinedParts(newest, run));
  return joined;
}

/** Shows the run as one line in its newest row. Leaves a joined line that is already right alone. */
function showJoined(run: Run): void {
  const [newest] = run;
  if (newest === undefined) {
    return;
  }
  const signature = signatureOf(run);
  const existing = newest.row.querySelector<HTMLElement>(`.${JOINED_CLASS}`);
  if (existing?.dataset.fixAdoJoinedFrom !== signature) {
    existing?.remove();
    newest.line.after(createJoinedLine(newest, run, signature));
  }
}

/** Marks a row as the joined line of its run, or as hidden. Writes only what changed. */
function markRow(row: HTMLElement, mark: "line" | "hidden"): void {
  if (row.dataset.fixAdoJoined !== mark) {
    row.dataset.fixAdoJoined = mark;
  }
  if (mark === "hidden") {
    row.querySelector(`.${JOINED_CLASS}`)?.remove();
  }
}

/** Makes a row that is in no run Azure DevOps's own again. */
function unmarkRow(row: HTMLElement): void {
  delete row.dataset.fixAdoJoined;
  row.querySelector(`.${JOINED_CLASS}`)?.remove();
}

/**
 * Lines next to each other in the activity feed of a pull request's Overview that add a
 * reviewer, joined to one line: "added A, B as a reviewer, C as a required reviewer". The
 * newest row shows the joined line, the other rows hide (style.css). Azure DevOps's own lines
 * stay in the page. It joins any lines by the same person with the same words, so removed
 * reviewers join too.
 */
function createJoinedReviewerLines({ document }: { document: Document }): { sync: () => void } {
  function sync(): void {
    const runs = runsOf([...document.querySelectorAll<HTMLElement>(ROW_SELECTOR)]);
    const joinedRows = new Set(runs.flat().map(({ row }) => row));
    for (const row of document.querySelectorAll<HTMLElement>("[data-fix-ado-joined]")) {
      if (!joinedRows.has(row)) {
        unmarkRow(row);
      }
    }
    for (const run of runs) {
      for (const [index, { row }] of run.entries()) {
        markRow(row, index === 0 ? "line" : "hidden");
      }
      showJoined(run);
    }
  }

  return { sync };
}

export { createJoinedReviewerLines };
