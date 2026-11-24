import type { LinkedWorkItems } from "./linked-work-item.ts";

/** The pull requests of one list that share a work item, or that have several or none. */
interface WorkItemGroup<Row> {
  /** The work item id, or "multiple" or "none". */
  key: string;
  /** "#123", "Multiple work items" or "No work item". */
  label: string;
  /** Null for the groups of several and of no work items. */
  workItemId: number | null;
  /** The work item's title, shown on hover. */
  title: string | null;
  rows: Row[];
}

const MULTIPLE_KEY = "multiple";
const NONE_KEY = "none";

function groupOf<Row>({ ids, title }: LinkedWorkItems): Omit<WorkItemGroup<Row>, "rows"> {
  const [id] = ids;
  if (id === undefined) {
    return { key: NONE_KEY, label: "No work item", title: null, workItemId: null };
  }
  if (ids.length > 1) {
    return { key: MULTIPLE_KEY, label: "Multiple work items", title: null, workItemId: null };
  }
  return { key: String(id), label: `#${id}`, title, workItemId: id };
}

/**
 * The rows of a list by linked work item. Work items come in the order their first pull
 * request shows; several work items, then none, come last. Rows keep their order.
 */
function groupByWorkItem<Row>(rows: { row: Row; linked: LinkedWorkItems }[]): WorkItemGroup<Row>[] {
  const groups = new Map<string, WorkItemGroup<Row>>();
  for (const { row, linked } of rows) {
    const group = groupOf<Row>(linked);
    const shown = groups.get(group.key) ?? { ...group, rows: [] };
    shown.rows.push(row);
    groups.set(group.key, shown);
  }
  const isLast = (key: string): boolean => key === MULTIPLE_KEY || key === NONE_KEY;
  return [
    ...[...groups.values()].filter(({ key }) => !isLast(key)),
    ...[MULTIPLE_KEY, NONE_KEY].flatMap((key) => groups.get(key) ?? []),
  ];
}

export type { WorkItemGroup };
export { groupByWorkItem };
