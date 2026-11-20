// The folders and files the owner folded in the file tree. The tree lists nothing
// under a folded row, which the script must know to tell the drawn rows apart.
// Nothing is folded when the page loads; the script notes each fold it sees, for as
// long as the page stays open.
/** A drawn row, with the part of its path the drawn rows show. */
interface DrawnPath {
  /** The names of the drawn rows above it, then its own, such as "src/totals.ts". */
  pathEnd: string;
  /** False when rows above it are not drawn, so the start of its path is unknown. */
  isWholePath: boolean;
}

/** A drawn row with the part of its path the drawn rows show. */
interface DrawnTreeRow extends DrawnPath {
  row: Element;
}

const FOLDED_ATTRIBUTE = "aria-expanded";

const foldedByDocument = new WeakMap<Document, Set<string>>();
const treePathsByChangedPaths = new WeakMap<string[], string[]>();

/** Every path the tree can show a row for: the changed files and the folders above them. */
function treePathsOf(changedPaths: string[]): string[] {
  const known = treePathsByChangedPaths.get(changedPaths);
  if (known !== undefined) {
    return known;
  }
  const paths = new Set<string>();
  for (const filePath of changedPaths) {
    const names = filePath.split("/").filter(Boolean);
    for (let depth = 1; depth <= names.length; depth += 1) {
      paths.add(`/${names.slice(0, depth).join("/")}`);
    }
  }
  treePathsByChangedPaths.set(changedPaths, [...paths]);
  return [...paths];
}

/** The path a drawn row stands for, or null when the drawn rows do not tell. */
function treePathOf({ isWholePath, pathEnd }: DrawnPath, changedPaths: string[]): string | null {
  const end = `/${pathEnd}`;
  const fitting = treePathsOf(changedPaths).filter((path) =>
    // The tree's first row may name the repository, which a path leaves out.
    isWholePath ? end === path || end.endsWith(path) : path.endsWith(end),
  );
  if (isWholePath) {
    return fitting.toSorted((left, right) => right.length - left.length)[0] ?? null;
  }
  return fitting.length === 1 ? (fitting[0] ?? null) : null;
}

/**
 * Notes which drawn rows are folded now, and returns every path the owner folded
 * since the page loaded and has not unfolded.
 */
function noteFolded(
  document: Document,
  drawn: DrawnTreeRow[],
  changedPaths: string[] | null,
): Set<string> {
  const folded = foldedByDocument.get(document) ?? new Set<string>();
  foldedByDocument.set(document, folded);
  for (const drawnRow of changedPaths === null ? [] : drawn) {
    const state = drawnRow.row.getAttribute(FOLDED_ATTRIBUTE);
    // An unfolded row only matters while something is folded.
    const path =
      state === "false" || (state === "true" && folded.size > 0)
        ? treePathOf(drawnRow, changedPaths ?? [])
        : null;
    if (path !== null && state === "false") {
      folded.add(path);
    } else if (path !== null) {
      folded.delete(path);
    }
  }
  return folded;
}

/** Every path folded since the page loaded and not unfolded, as the last `noteFolded` saw. */
function foldedPaths(document: Document): Set<string> {
  return foldedByDocument.get(document) ?? new Set<string>();
}

export { foldedPaths, noteFolded };
