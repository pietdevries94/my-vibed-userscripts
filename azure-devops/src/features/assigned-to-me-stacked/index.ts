import type { AssignedToMe } from "./assigned-card.ts";
import { FAILED_REQUEST_RETRY_MS } from "../pipeline-status/pipeline-status-poller.ts";
import type { Feature } from "../../core/feature.ts";
import type { Page } from "../../core/page.ts";
import { showStackedTabs } from "./stacked-tabs.ts";
import style from "./style.css";

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
      const shown = scope !== null && assigned?.scope === scope ? assigned.value : null;
      showStackedTabs(document, shown, { basePath, now: now() });
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
