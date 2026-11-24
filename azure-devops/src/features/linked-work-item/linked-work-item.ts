import type { LinkedWorkItemLabel } from "../../pull-requests/pr-list.ts";

/** The work items linked to a pull request, with the title when exactly one is linked. */
interface LinkedWorkItems {
  ids: number[];
  title: string | null;
}

/** "#123" with its title on hover, "Multiple work items" with their ids, or null when none is linked. */
function linkedWorkItemLabel({ ids, title }: LinkedWorkItems): LinkedWorkItemLabel | null {
  const [id] = ids;
  if (id === undefined) {
    return null;
  }
  if (ids.length > 1) {
    return { text: "Multiple work items", tooltip: ids.map((each) => `#${each}`).join(", ") };
  }
  return { text: `#${id}`, tooltip: title };
}

export type { LinkedWorkItems };
export { linkedWorkItemLabel };
