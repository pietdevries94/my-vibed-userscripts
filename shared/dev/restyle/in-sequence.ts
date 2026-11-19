// Runs async work one item after another. The restyle tools share one fake site, whose shown
// capture is global, so their steps cannot run in parallel. Dev file only.

/** Each item's result, in order, each started after the one before it finished. */
async function inSequence<Item, Result>(
  items: readonly Item[],
  run: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  const [first, ...rest] = items;
  if (first === undefined) {
    return [];
  }
  const result = await run(first);
  return [result, ...(await inSequence(rest, run))];
}

export { inSequence };
