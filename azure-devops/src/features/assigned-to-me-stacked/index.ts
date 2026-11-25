import type { AssignedToMe } from "./assigned-card.ts";
import type { CardFolding } from "./card-folding.ts";
import { FAILED_REQUEST_RETRY_MS } from "../pipeline-status/pipeline-status-poller.ts";
import type { Feature } from "../../core/feature.ts";
import type { Page } from "../../core/page.ts";
import { showStackedTabs } from "./stacked-tabs.ts";
import style from "./style.css";

/** The tab ids of the built cards the owner folded. */
const FOLDED_TABS_KEY = "assigned-to-me-folded-tabs";
/** Votes change while the owner reviews, so the built lists refresh often. */
const ASSIGNED_REFRESH_INTERVAL_MS = 60_000;

type Repository = { project: string; repository: string } | null;

/** The repository whose assigned pull requests the page lists; null on the inbox, across them all. */
function repositoryOf(page: Page): Repository | undefined {
  if (page.kind === "pull-request-list") {
    const { project, repository } = page.listPage;
    return { project, repository };
  }
  return page.kind === "pull-request-inbox" ? null : undefined;
}

/** The built cards the owner folded, kept across page loads. `onChange` shows the change. */
function createCardFolding(onChange: () => void): CardFolding {
  const foldedTabIds = new Set(GM_getValue<string[]>(FOLDED_TABS_KEY, []));
  return {
    foldedTabIds,
    onToggle(tabId) {
      if (!foldedTabIds.delete(tabId)) {
        foldedTabIds.add(tabId);
      }
      GM_setValue(FOLDED_TABS_KEY, [...foldedTabIds]);
      onChange();
    },
  };
}

const assignedToMeStacked: Feature = {
  change: { kind: "new", version: "1.25.0" },
  description:
    "The tabs of the Assigned to me card as cards of their own, under each other, each titled with its tab, so you scroll through them all.",
  id: "assigned-to-me-stacked",
  name: "Assigned to me tabs under each other",
  start({ basePath, client, document, now }) {
    let assigned: { scope: string; value: AssignedToMe } | null = null;
    let nextFetchAt = 0;
    let isFetching = false;
    let shownScope: string | null = null;
    const folding = createCardFolding(() => {
      show(shownScope);
    });

    async function fetchAssigned(repository: Repository, scope: string): Promise<void> {
      isFetching = true;
      try {
        const reviewerId = await client.getAuthenticatedUserId();
        if (reviewerId !== null) {
          const { pullRequests } = await client.getPullRequestsAssignedTo(reviewerId, repository);
          assigned = { scope, value: { pullRequests, reviewerId } };
        }
        nextFetchAt = now() + ASSIGNED_REFRESH_INTERVAL_MS;
      } catch {
        nextFetchAt = now() + FAILED_REQUEST_RETRY_MS;
      } finally {
        isFetching = false;
      }
    }

    function show(scope: string | null): void {
      shownScope = scope;
      const shown = scope !== null && assigned?.scope === scope ? assigned.value : null;
      showStackedTabs(document, shown, { basePath, folding, now: now() });
    }

    return {
      sync({ page, isTabActive }) {
        const repository = repositoryOf(page);
        const scope = repository === undefined ? null : JSON.stringify(repository);
        show(scope);
        const isDue = assigned?.scope !== scope || now() >= nextFetchAt;
        if (repository !== undefined && scope !== null && isTabActive && isDue && !isFetching) {
          void fetchAssigned(repository, scope).then(() => {
            show(scope);
          });
        }
      },
    };
  },
  styles: [style],
};

export { assignedToMeStacked };
