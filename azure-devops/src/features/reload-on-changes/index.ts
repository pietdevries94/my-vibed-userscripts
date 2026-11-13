import { findBoardCardIds, watchBoard } from "../../board.ts";
import type { Feature } from "../../core/feature.ts";
import type { Page } from "../../core/page.ts";
import type { WatchedPage } from "../../page-reloader.ts";
import { createPageReloader } from "../../page-reloader.ts";
import { findPullRequestRows } from "../../pr-list.ts";
import { watchPullRequestList } from "../../pr-list-watch.ts";

const reloadOnChanges: Feature = {
  description: "Pull request lists and boards reload when their content changes on the server.",
  id: "reload-on-changes",
  name: "Reload on changes",
  start({ basePath, client, document, now, reloadWhenIdle }) {
    let shownPage: Page = { kind: "other" };
    function watchedPage(): WatchedPage<unknown> | null {
      if (shownPage.kind === "pull-request-list") {
        return watchPullRequestList(client, shownPage.listPage, () =>
          findPullRequestRows(document, basePath).map(
            ({ pullRequest }) => pullRequest.pullRequestId,
          ),
        );
      }
      if (shownPage.kind === "board") {
        const cardIds = findBoardCardIds(document);
        // No cards yet: the board is still loading, and there is nothing to compare.
        return cardIds.length > 0 ? watchBoard(client, location, cardIds) : null;
      }
      return null;
    }
    let isTabActive = false;
    const reloader = createPageReloader({
      currentPage: watchedPage,
      isTabActive: () => isTabActive,
      now,
      reload: reloadWhenIdle,
    });
    return {
      sync(tick) {
        shownPage = tick.page;
        ({ isTabActive } = tick);
        void reloader.check({ immediately: tick.reason === "tab-shown" });
      },
    };
  },
};

export { reloadOnChanges };
