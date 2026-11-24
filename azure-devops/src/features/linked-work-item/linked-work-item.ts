/** The work items linked to a pull request, with the title when exactly one is linked. */
interface LinkedWorkItems {
  ids: number[];
  title: string | null;
}

/** "#123 Fix the login form", "Multiple work items", or null when none is linked. */
function linkedWorkItemText({ ids, title }: LinkedWorkItems): string | null {
  const [id] = ids;
  if (id === undefined) {
    return null;
  }
  if (ids.length > 1) {
    return "Multiple work items";
  }
  return title === null ? `#${id}` : `#${id} ${title}`;
}

export type { LinkedWorkItems };
export { linkedWorkItemText };
