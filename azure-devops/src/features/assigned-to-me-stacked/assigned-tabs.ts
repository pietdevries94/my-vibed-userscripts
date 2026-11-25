// Which of the pull requests assigned to me each tab of the "Assigned to me" card holds: it goes by my vote.
import type { ListedPullRequest } from "../reload-on-changes/pr-list-changes.ts";
import type { Reviewer } from "../../pull-requests/reviewers.ts";

const ACTIVE_TAB_ID = "__bolt-tab-activeMine";
const WAITING_FOR_AUTHOR_TAB_ID = "__bolt-tab-waitingForAuthor";
const NO_VOTE = 0;
const WAITING_FOR_AUTHOR_VOTE = -5;

/** A person as the pull requests REST API gives them, with their avatar. */
interface Person {
  displayName?: string;
  imageUrl?: string;
  _links?: { avatar?: { href?: string } };
}

interface AssignedPullRequest extends ListedPullRequest {
  creationDate?: string;
  /** "conflicts" when the pull request has merge conflicts. */
  mergeStatus?: string;
  createdBy?: Person;
  repository?: { name?: string; project?: { name?: string } };
  reviewers?: (Reviewer & Person)[];
}

function isVoteOnTab(vote: number, tabId: string): boolean {
  if (tabId === ACTIVE_TAB_ID) {
    return vote === NO_VOTE;
  }
  if (tabId === WAITING_FOR_AUTHOR_TAB_ID) {
    return vote === WAITING_FOR_AUTHOR_VOTE;
  }
  return vote !== NO_VOTE && vote !== WAITING_FOR_AUTHOR_VOTE;
}

const createdAt = ({ creationDate }: AssignedPullRequest): number =>
  creationDate === undefined ? 0 : Date.parse(creationDate);

/** The pull requests the tab holds, newest first, as Azure DevOps lists them. */
function pullRequestsOnTab<PullRequest extends AssignedPullRequest>(
  pullRequests: PullRequest[],
  reviewerId: string,
  tabId: string,
): PullRequest[] {
  return pullRequests
    .filter(({ reviewers }) => {
      const vote = reviewers?.find(({ id }) => id === reviewerId)?.vote;
      return vote !== undefined && isVoteOnTab(vote, tabId);
    })
    .toSorted((first, second) => createdAt(second) - createdAt(first));
}

export type { AssignedPullRequest, Person };
export { ACTIVE_TAB_ID, pullRequestsOnTab };
