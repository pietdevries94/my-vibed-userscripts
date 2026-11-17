// The board capture: the board's cards and the updates of the most changed ones.
// Dev file only.
import { findBoardCardIds, isBoardLocation } from "../boards/board.ts";
import type { AdoClient } from "../core/ado-client.ts";
import type { BoardWorkItem } from "../boards/board.ts";
import type { CapturePage } from "../../../shared/dev/capture/capture.ts";
import type { Pseudonyms } from "../../../shared/dev/scrub/pseudonyms.ts";
import { apiBasePath } from "../pull-requests/pull-request-link.ts";
import { createAdoClient } from "../core/ado-client.ts";
import { withoutScriptMarks } from "./capture-script-marks.ts";

/** The days in column feature reads the updates of each card. A few show their shape: the most changed ones, which most likely moved. */
const CARDS_WITH_CAPTURED_UPDATES = 5;

/** The updates of the most changed cards, by stand-in work item id. */
async function collectUpdates(
  client: AdoClient,
  workItems: BoardWorkItem[],
  pseudonyms: Pseudonyms,
): Promise<Record<number, unknown>> {
  const updatesByWorkItemId: Record<number, unknown> = {};
  const mostChanged = workItems
    .toSorted((left, right) => right.rev - left.rev)
    .slice(0, CARDS_WITH_CAPTURED_UPDATES);
  for (const { id } of mostChanged) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one card at a time, as the script fetches them
    const { updates } = await client.getWorkItemUpdates(id);
    updatesByWorkItemId[pseudonyms.number(id, "work item id")] = updates;
  }
  return updatesByWorkItemId;
}

/** The board page, or null when `location` is not a board. */
function boardPageAt(location: Location): CapturePage | null {
  if (!isBoardLocation(location)) {
    return null;
  }
  return {
    async collect(fetch, pseudonyms) {
      const basePath = apiBasePath(location);
      pseudonyms.text(basePath.replaceAll("/", ""), "organisation");
      const client = createAdoClient({ apiBasePath: basePath, fetch, origin: location.origin });
      const cardIds = findBoardCardIds(document);
      const { workItems } = await client.getWorkItems(cardIds);
      const myUserId = await client.getAuthenticatedUserId();
      const updatesByWorkItemId = await collectUpdates(client, workItems, pseudonyms);
      return {
        data: { myUserId, updatesByWorkItemId, workItems },
        meta: {},
      };
    },
    name: "board",
    root: withoutScriptMarks(document.body),
  };
}

export { boardPageAt };
