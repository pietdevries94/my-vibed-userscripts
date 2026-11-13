import type { AdoClient } from "../core/ado-client.ts";
import assert from "node:assert/strict";
import { createAdoClient } from "../core/ado-client.ts";
import { test } from "node:test";

const TEAM = String.raw`[Ledger Works]\Ledger Team`;
/** The search as Azure DevOps's own add reviewer field sends it, for "led". */
const SEARCH_BODY = {
  identityTypes: ["user", "group"],
  operationScopes: ["ims", "source"],
  options: { MaxResults: 40, MinResults: 5 },
  properties: [
    "DisplayName",
    "IsMru",
    "ScopeName",
    "SamAccountName",
    "Active",
    "SubjectDescriptor",
    "Mail",
    "MailNickname",
    "SignInAddress",
    "Guest",
  ],
  query: "led",
};
const PULL_REQUEST = { project: "Ledger Works", pullRequestId: 4711, repository: "ledger-api" };

interface Sent {
  url: string;
  method: string;
  body: unknown;
}

function fakeAdo(body: unknown): { client: AdoClient; sent: Sent[] } {
  const sent: Sent[] = [];
  const client = createAdoClient({
    apiBasePath: "/quillfield",
    fetch: async (url, init) => {
      sent.push({
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
        method: init.method ?? "GET",
        url,
      });
      return Response.json(body);
    },
    origin: "https://dev.azure.com",
  });
  return { client, sent };
}

test("adds a reviewer as optional or required, with no vote", async () => {
  const { client, sent } = fakeAdo({});
  await client.addPullRequestReviewer(PULL_REQUEST, { isRequired: true, reviewerId: "id-quill" });
  assert.deepEqual(sent, [
    {
      body: { isRequired: true, vote: 0 },
      method: "PUT",
      url: "https://dev.azure.com/quillfield/Ledger%20Works/_apis/git/repositories/ledger-api/pullRequests/4711/reviewers/id-quill?api-version=7.1",
    },
  ]);
});

test("lists the reviewers of a pull request, people with their address and groups without", async () => {
  const { client } = fakeAdo({
    value: [
      { displayName: "Quill Barrow", id: "id-quill", uniqueName: "quill@example.com" },
      {
        displayName: TEAM,
        id: "id-team",
        isContainer: true,
        uniqueName: "vstfs:///x",
      },
    ],
  });
  assert.deepEqual(await client.getPullRequestReviewers(PULL_REQUEST), [
    {
      displayName: "Quill Barrow",
      id: "id-quill",
      isGroup: false,
      signInAddress: "quill@example.com",
    },
    { displayName: TEAM, id: "id-team", isGroup: true, signInAddress: "" },
  ]);
});

test("searches people and groups, and leaves out those without a local id", async () => {
  const { client, sent } = fakeAdo({
    results: [
      {
        identities: [
          {
            displayName: "Quill Barrow",
            entityType: "User",
            localId: "id-quill",
            mail: "quill@example.com",
          },
          { displayName: "Ledger Team", entityType: "Group", localId: "id-team" },
          { displayName: "Not Yet Seen", entityType: "User", localId: null },
        ],
      },
    ],
  });
  const found = await client.searchIdentities("led");
  assert.deepEqual(found, [
    {
      displayName: "Quill Barrow",
      id: "id-quill",
      isGroup: false,
      signInAddress: "quill@example.com",
    },
    { displayName: "Ledger Team", id: "id-team", isGroup: true, signInAddress: "" },
  ]);
  assert.equal(sent[0]?.method, "POST");
  assert.equal(
    sent[0]?.url,
    "https://dev.azure.com/quillfield/_apis/IdentityPicker/Identities?api-version=5.0-preview.1",
  );
  assert.deepEqual(sent[0]?.body, SEARCH_BODY);
});
