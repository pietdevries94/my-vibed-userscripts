// The rows the file tree lists for a pull request, worked out from its changed
// files, and which of them the tree draws now. The tree draws only the rows near the
// part in view, so a drawn row may miss the folders above it; its place in the whole
// listing still tells which file it is.

/** A row the tree lists: a folder or a file. */
interface ListedRow {
  /** How deep the row sits, as its `aria-level`. */
  level: number;
  /** The name the row shows. A folder with one folder in it and no files shows as one row, such as "api/v1". */
  name: string;
  /** The whole path of the file, or of the deepest folder the row names. */
  path: string;
}

/** What a drawn row shows of itself. */
interface DrawnName {
  level: number;
  name: string;
  /** True when the tree does not draw the row before this one. */
  isAfterGap: boolean;
}

/** The listed rows the tree can draw now, and which of them it does draw. */
interface DrawnListing {
  /** The paths of every listed row that is not folded away, in the tree's order. */
  paths: string[];
  /** The place in `paths` of each drawn row, in the order the rows are drawn. */
  placeOfDrawn: number[];
}

interface Folder {
  folders: Map<string, Folder>;
  files: string[];
}

const listedByChangedPaths = new WeakMap<string[], ListedRow[]>();

function byName(left: string, right: string): number {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}

function folderOf(changedPaths: string[]): Folder {
  const root: Folder = { files: [], folders: new Map() };
  for (const filePath of changedPaths) {
    const names = filePath.split("/").filter(Boolean);
    let folder = root;
    for (const name of names.slice(0, -1)) {
      const inner: Folder = folder.folders.get(name) ?? { files: [], folders: new Map() };
      folder.folders.set(name, inner);
      folder = inner;
    }
    folder.files.push(names.at(-1) ?? "");
  }
  return root;
}

/** The row of a folder: it takes along each folder that is alone in the one above it. */
function folderRow(name: string, folder: Folder): { name: string; folder: Folder } {
  const [only] = [...folder.folders];
  if (folder.files.length > 0 || folder.folders.size !== 1 || only === undefined) {
    return { folder, name };
  }
  return folderRow(`${name}/${only[0]}`, only[1]);
}

/** Adds the rows under a folder: its folders by name, each with its own rows, then its files by name. */
function addRows(rows: ListedRow[], folder: Folder, above: Omit<ListedRow, "name">): void {
  const level = above.level + 1;
  for (const first of [...folder.folders.keys()].toSorted(byName)) {
    const inner = folder.folders.get(first);
    if (inner !== undefined) {
      const row = folderRow(first, inner);
      const path = `${above.path}/${row.name}`;
      rows.push({ level, name: row.name, path });
      addRows(rows, row.folder, { level, path });
    }
  }
  for (const name of folder.files.toSorted(byName)) {
    rows.push({ level, name, path: `${above.path}/${name}` });
  }
}

/** Every row the tree lists for these changed files, in the tree's order. */
function listedRows(changedPaths: string[]): ListedRow[] {
  const known = listedByChangedPaths.get(changedPaths);
  if (known !== undefined) {
    return known;
  }
  const rows: ListedRow[] = [];
  addRows(rows, folderOf(changedPaths), { level: 0, path: "" });
  listedByChangedPaths.set(changedPaths, rows);
  return rows;
}

function isUnder(path: string, folded: Set<string>): boolean {
  return [...folded].some((foldedPath) => path.startsWith(`${foldedPath}/`));
}

/** True when the drawn rows are the listed rows from `start` on. Levels count from the first row's. */
function isDrawnAt(listed: ListedRow[], drawn: DrawnName[], start: number): boolean {
  const levelShift = (listed[start]?.level ?? 0) - (drawn[0]?.level ?? 0);
  return drawn.every(({ level, name }, index) => {
    const row = listed[start + index];
    return row?.name === name && row.level === level + levelShift;
  });
}

/** The drawn rows in runs: the tree draws the rows of a run one after the other, and skips rows between runs. */
function runsOf(drawn: DrawnName[]): DrawnName[][] {
  const runs: DrawnName[][] = [];
  for (const row of drawn) {
    const run = row.isAfterGap ? undefined : runs.at(-1);
    if (run === undefined) {
      runs.push([row]);
    } else {
      run.push(row);
    }
  }
  return runs;
}

/** Drops the places a run cannot start at, because the run before it or after it leaves no room there. */
function withoutOverlap(runs: DrawnName[][], starts: number[][]): number[][] {
  const fitting = starts.map((candidates) => [...candidates]);
  for (const [index, candidates] of fitting.entries()) {
    const earliest = Math.min(...(fitting[index - 1] ?? [])) + (runs[index - 1]?.length ?? 0);
    fitting[index] = candidates.filter((start) => index === 0 || start >= earliest);
  }
  for (const [index, candidates] of [...fitting.entries()].toReversed()) {
    const latest = Math.max(...(fitting[index + 1] ?? [])) - (runs[index]?.length ?? 0);
    fitting[index] = candidates.filter((start) => index === runs.length - 1 || start <= latest);
  }
  return fitting;
}

/**
 * Finds the drawn rows in the listing of the changed files. Null when a run of them
 * is not there, or fits in more than one place: the listing is then no help.
 */
function findDrawn(
  changedPaths: string[],
  drawn: DrawnName[],
  folded: Set<string>,
): DrawnListing | null {
  const listed = listedRows(changedPaths).filter(({ path }) => !isUnder(path, folded));
  const runs = runsOf(drawn);
  const everyStart = listed.map((_row, start) => start);
  const starts = withoutOverlap(
    runs,
    runs.map((run) => everyStart.filter((start) => isDrawnAt(listed, run, start))),
  );
  if (runs.length === 0 || starts.some((candidates) => candidates.length !== 1)) {
    return null;
  }
  const placeOfDrawn = runs.flatMap((run, index) =>
    run.map((_row, offset) => (starts[index]?.[0] ?? 0) + offset),
  );
  return { paths: listed.map(({ path }) => path), placeOfDrawn };
}

export type { DrawnListing, DrawnName };
export { findDrawn, listedRows };
