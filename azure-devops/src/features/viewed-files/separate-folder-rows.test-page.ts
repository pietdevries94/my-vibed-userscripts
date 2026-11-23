// The rows a file tree lists when it draws every folder on a row of its own, also a
// folder that holds only one other folder. Test code only.
import type { listedRows } from "../../pull-requests/file-tree/tree-listing.ts";

type ListedRow = ReturnType<typeof listedRows>[number];

function byName(left: string, right: string): number {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function parentOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

/** Every row, folders first and each by name, with every folder on a row of its own. */
function separateFolderRows(changedPaths: string[]): ListedRow[] {
  const folders = new Set(
    changedPaths.flatMap((path) => {
      const names = path.split("/").filter(Boolean);
      return names.slice(0, -1).map((_name, end) => `/${names.slice(0, end + 1).join("/")}`);
    }),
  );
  const rows: ListedRow[] = [];
  const addUnder = (parent: string, level: number): void => {
    const inside = (paths: Iterable<string>): string[] =>
      [...paths]
        .filter((path) => parentOf(path) === parent)
        .toSorted((left, right) => byName(nameOf(left), nameOf(right)));
    for (const folder of inside(folders)) {
      rows.push({ level, name: nameOf(folder), path: folder });
      addUnder(folder, level + 1);
    }
    for (const file of inside(changedPaths)) {
      rows.push({ level, name: nameOf(file), path: file });
    }
  };
  addUnder("", 1);
  return rows;
}

export { separateFolderRows };
