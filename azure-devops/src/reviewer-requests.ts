// The requests behind starred reviewers: who reviews a pull request, adding a reviewer,
// and searching people and groups as Azure DevOps's own add reviewer field does.
import type { AdoClient } from "./ado-client.ts";
import type { AdoClientOptions } from "./ado-request.ts";
import type { PullRequestRef } from "./pull-request-link.ts";
import { sendRequest } from "./ado-request.ts";

/** A person or group, as starred reviewers keep them. `id` is the id a reviewer has on a pull request. */
interface Identity {
  id: string;
  displayName: string;
  /** The sign-in address of a person. Empty for a group. */
  signInAddress: string;
  isGroup: boolean;
}

/** A reviewer of a pull request, from the pull request reviewers API. */
interface PullRequestReviewerBody {
  id?: string;
  displayName?: string;
  uniqueName?: string;
  isContainer?: boolean;
}

/** A search result from the identity picker API. `localId` is missing for one Azure DevOps has not seen yet. */
interface PickerIdentityBody {
  localId?: string | null;
  displayName?: string;
  signInAddress?: string | null;
  mail?: string | null;
  entityType?: string;
}

const MAX_FOUND_IDENTITIES = 20;

function reviewersPath({ project, repository, pullRequestId }: PullRequestRef): string {
  return (
    `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repository)}` +
    `/pullRequests/${pullRequestId}/reviewers`
  );
}

async function getPullRequestReviewers(
  options: AdoClientOptions,
  pullRequest: PullRequestRef,
): Promise<Identity[]> {
  const response = await sendRequest(options, `${reviewersPath(pullRequest)}?api-version=7.1`);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
  const body = (await response.json()) as { value?: PullRequestReviewerBody[] };
  return (body.value ?? []).flatMap(({ id, displayName, uniqueName, isContainer }) =>
    id === undefined
      ? []
      : [
          {
            displayName: displayName ?? "",
            id,
            isGroup: isContainer === true,
            signInAddress: isContainer === true ? "" : (uniqueName ?? ""),
          },
        ],
  );
}

async function addPullRequestReviewer(
  options: AdoClientOptions,
  pullRequest: PullRequestRef,
  { reviewerId, isRequired }: { reviewerId: string; isRequired: boolean },
): Promise<void> {
  await sendRequest(
    options,
    `${reviewersPath(pullRequest)}/${encodeURIComponent(reviewerId)}?api-version=7.1`,
    { body: { isRequired, vote: 0 }, method: "PUT" },
  );
}

function identityOf(body: PickerIdentityBody): Identity[] {
  const { localId, displayName, signInAddress, mail, entityType } = body;
  if (localId === undefined || localId === null || localId === "") {
    return [];
  }
  const isGroup = entityType?.toLowerCase() === "group";
  return [
    {
      displayName: displayName ?? "",
      id: localId,
      isGroup,
      signInAddress: isGroup ? "" : (signInAddress ?? mail ?? ""),
    },
  ];
}

/** People and groups whose name or address matches `query`, as the add reviewer field finds them. */
async function searchIdentities(options: AdoClientOptions, query: string): Promise<Identity[]> {
  const response = await sendRequest(
    options,
    "/_apis/IdentityPicker/Identities?api-version=5.0-preview.1",
    {
      body: {
        identityTypes: ["user", "group"],
        operationScopes: ["ims", "source"],
        options: { MaxResults: MAX_FOUND_IDENTITIES, MinResults: MAX_FOUND_IDENTITIES },
        properties: ["DisplayName", "Mail", "SignInAddress"],
        query,
      },
      method: "POST",
    },
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
  const body = (await response.json()) as { results?: { identities?: PickerIdentityBody[] }[] };
  return (body.results ?? []).flatMap(({ identities }) =>
    (identities ?? []).flatMap((identity) => identityOf(identity)),
  );
}

/** The client's reviewer requests, for `createAdoClient`. */
function createReviewerRequests(
  options: AdoClientOptions,
): Pick<AdoClient, "addPullRequestReviewer" | "getPullRequestReviewers" | "searchIdentities"> {
  return {
    addPullRequestReviewer: async (pullRequest, reviewer) =>
      addPullRequestReviewer(options, pullRequest, reviewer),
    getPullRequestReviewers: async (pullRequest) => getPullRequestReviewers(options, pullRequest),
    searchIdentities: async (query) => searchIdentities(options, query),
  };
}

export type { Identity };
export { createReviewerRequests };
