# Start a review on an Azure DevOps pull request: research

Researched 2026-11-15. Scope: a feature of the `azure-devops` script that lets the owner start a review on a pull request, write inline and general comments that only the owner sees, and submit them in one go, optionally with a vote. The script is sealed. Nothing here comes from the live site.

Marks used below:

- **[V]** verified from the cited primary source (docs, public source, or a fixture the owner skimmed).
- **[I]** inferred. Not stated by any source. Needs a check on the real site.

Source shorthand:

- **REST 7.1**: the Azure DevOps REST reference, version 7.1, on learn.microsoft.com. Each claim links its page.
- **node-api**: [microsoft/azure-devops-node-api](https://github.com/microsoft/azure-devops-node-api), `api/interfaces/GitInterfaces.ts` at commit `af336d2`.
- **unfuck-ado**: [nthomsencph/unfuck-ado](https://github.com/nthomsencph/unfuck-ado) at commit `8736abc`, the same commit [pr-pipeline-status.md](pr-pipeline-status.md) cites. Its source records each selector as "verified live" with a date.
- **github/docs**: [github/docs](https://github.com/github/docs), the source of docs.github.com, at commit `d59b263` (2026-11-13). Docs text is cited by file and line. A label that only a screenshot shows is cited by the image file and the commit that last changed it.
- **Fixtures**: the owner's imported `azure-devops/fixtures/` files. They are scrubbed and never committed, so they are cited by file name only.

## Summary

- **No native draft.** Azure DevOps has no pending review, no draft comment, and no batch endpoint. Every thread and every reply is public the moment it is created [V] (section 2).
- **Thread status `pending` is not a draft.** It is a public status: "The issue in this comment is under review and awaits something else" [V] (section 2.1).
- **Notifications fire per event.** "A notification is generated for every subscription/event match." N new threads mean up to N emails to the author. No per-call switch suppresses them [V] (section 3).
- **So the script holds the comments itself.** Unsent comments live in `GM_setValue` on the owner's machine. Submit posts them one by one through the threads API, then sets the vote. This is what unfuck-ado's `pr-drafts` feature does, live in Chrome since 2026-08 [V] (section 2.3).
- **Anchoring an inline comment** needs `threadContext.filePath` plus `rightFileStart`/`rightFileEnd` (or the `left*` pair for a removed line). `pullRequestThreadContext` with `iterationContext` and `changeTrackingId` ties it to the diff the owner saw. The docs say it "must be set"; two public clients post without it [V/I conflict] (section 1.3).
- **Auth and client exist.** The script's `ado-request.ts` already sends same-origin `POST`, `PUT` and `PATCH` with the session cookie and no extra header. Adding thread, comment and vote calls is three small functions [V] (section 5).
- **UI: GitHub's buttons in Azure DevOps's own comment box.** The script adds a primary "Start a review" button, "Add review comment" once a review is started. Azure DevOps's own Comment button stays, looks secondary, and still posts right away. Intercepting the native button stays rejected: one miss posts publicly (sections 6.3 and 6.5).
- **A sticky "Submit review" button with the count of unsent comments** sits in Azure DevOps's sticky tab bar. It opens "Finish your review": summary, vote, the unsent comments, "Discard review" (section 6.6). GitHub's labels are in section 11.
- **One GM key per pull request, never an empty review,** deleted on a full submit and after 30 days untouched. Needs the grants `GM_listValues` and `GM_deleteValue` (section 7).
- **Blocked on captures.** No fixture shows the Files tab, an open comment box, or any thread or iteration response. Section 9 lists the pages the owner must capture.

---

## 1. REST API for threads and comments

All paths below are under `https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repositoryId}/pullRequests/{pullRequestId}`. The script builds the prefix from its API base path (section 5).

### 1.1 Endpoints

| Action                  | Method and path                                                                 | api-version | Source                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List threads            | `GET /threads`, optional `$iteration`, `$baseIteration`                         | 7.1         | [Threads - List](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-7.1)                                                     |
| Create thread           | `POST /threads`                                                                 | 7.1         | [Threads - Create](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.1)                                                 |
| Update thread (status)  | `PATCH /threads/{threadId}`                                                     | 7.1         | [Threads - Update](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/update?view=azure-devops-rest-7.1)                                                 |
| Add reply               | `POST /threads/{threadId}/comments`                                             | 7.1         | [Comments - Create](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/create?view=azure-devops-rest-7.1)                                        |
| Edit comment            | `PATCH /threads/{threadId}/comments/{commentId}`                                | 7.1         | [Comments - Update](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/update?view=azure-devops-rest-7.1)                                        |
| Delete comment          | `DELETE /threads/{threadId}/comments/{commentId}`                               | 7.1         | [Comments - Delete](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/delete?view=azure-devops-rest-7.1)                                        |
| List iterations         | `GET /iterations`, optional `includeCommits`                                    | 7.1         | [Iterations - List](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-iterations/list?view=azure-devops-rest-7.1)                                               |
| Changes of an iteration | `GET /iterations/{iterationId}/changes`, optional `$compareTo`, `$top`, `$skip` | 7.1         | [Iteration Changes - Get](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-iteration-changes/get?view=azure-devops-rest-7.1)                                   |
| Set vote                | `PUT /reviewers/{reviewerId}`                                                   | 7.1         | [Reviewers - Create Pull Request Reviewer](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-reviewers/create-pull-request-reviewer?view=azure-devops-rest-7.1) |

- Every path above is version 7.1, not preview [V]. 7.2 is still `7.2-preview.1` and has the same fields ([Threads - Create 7.2](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.2)) [V].
- Write scopes: `vso.code_write` or `vso.threads_full` [V] (Threads - Create). The session cookie carries the owner's own rights (section 5).
- A thread takes "up to 500 comments" [V] ([Comments - Create](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/create?view=azure-devops-rest-7.1)).
- The REST reference has no batch endpoint for threads or comments. Each call creates one thread or one comment [V] (pages above).

### 1.2 Thread body

From [Threads - Create](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.1) [V]:

| Field                      | Type                                 | Notes                                                                                |
| -------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| `comments`                 | `Comment[]`                          | The first comment: `parentCommentId: 0`, `content`, `commentType: 1`.                |
| `status`                   | `CommentThreadStatus`                | `1` = active.                                                                        |
| `threadContext`            | `CommentThreadContext`               | File and position. Leave out for a general comment.                                  |
| `pullRequestThreadContext` | `GitPullRequestCommentThreadContext` | Iteration and change tracking id.                                                    |
| `properties`               | `PropertiesCollection`               | "Optional properties associated with the thread as a collection of key-value pairs." |

Enum values from node-api [V]:

- `CommentThreadStatus`: `Unknown = 0`, `Active = 1`, `Fixed = 2`, `WontFix = 3`, `Closed = 4`, `ByDesign = 5`, `Pending = 6` ([GitInterfaces.ts L516-L545](https://github.com/microsoft/azure-devops-node-api/blob/af336d20718b7d912cef6d206227a34b4666142f/api/interfaces/GitInterfaces.ts#L516-L545)).
- `CommentType`: `Unknown = 0`, `Text = 1`, `CodeChange = 2`, `System = 3` ([GitInterfaces.ts L584-L601](https://github.com/microsoft/azure-devops-node-api/blob/af336d20718b7d912cef6d206227a34b4666142f/api/interfaces/GitInterfaces.ts#L584-L601)).
- Responses spell the same values as strings: `"status": "active"`, `"commentType": "text"` [V] (sample responses on Threads - Create).

Content is Markdown. Thread list samples carry `"Microsoft.TeamFoundation.Discussion.SupportsMarkdown"` in `properties` [V] ([Threads - List](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-7.1)).

### 1.3 Anchoring an inline comment

`CommentThreadContext` [V] ([Threads - Create](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.1)):

- `filePath`: "File path relative to the root of the repository." The sample uses a leading slash: `/new_feature.cpp`.
- `rightFileStart`, `rightFileEnd`: first and last character of the span in the right (new) file.
- `leftFileStart`, `leftFileEnd`: the same in the left (old) file. For a comment on a removed line.
- `CommentPosition.line` "Starts at 1".
- `CommentPosition.offset`: 7.1 says "Starts at 0". 7.2 says "Starts at 1". The sample sends `offset: 1` for the start of a line. Treat offset 1 as line start [V for the conflict, I for the choice].

`GitPullRequestCommentThreadContext` [V] (same page):

- `changeTrackingId`: "Used to track a comment across iterations. This value can be found by looking at the iteration's changes list. Must be set for pull requests with iteration support."
- `iterationContext.firstComparingIteration`: "The iteration of the file on the left side of the diff when the thread was created. If this value is equal to SecondComparingIteration, then this version is the common commit between the source and target branches."
- `iterationContext.secondComparingIteration`: "The iteration of the file on the right side of the diff when the thread was created."
- `trackingCriteria`: set on a returned thread when the server "tracked [it] from its original location". It carries the original path and positions (`origFilePath`, `origRightFileStart`, ...) and the iterations it was tracked to.

Where the values come from:

- Iteration ids: `GET /iterations`. "Iteration one is the head of the source branch at the time the pull request is created and subsequent iterations are created when there are pushes to the source branch" [V] ([Iteration Changes - Get](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-iteration-changes/get?view=azure-devops-rest-7.1)). Each iteration has `sourceRefCommit`, `targetRefCommit`, `commonRefCommit` and a `reason` such as `push`, `forcePush` or `rebase` [V] ([Iterations - List](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-iterations/list?view=azure-devops-rest-7.1)).
- `changeTrackingId`: `GET /iterations/{id}/changes` returns `changeEntries[]` with `changeTrackingId`, `item.path`, `item.objectId`, `originalPath` and `changeType`. Default page size 100, max 2000, `nextSkip` for the next page [V] (same page).

What a full "all changes" diff on the newest iteration N sends:

- `iterationContext: { firstComparingIteration: N, secondComparingIteration: N }` per the doc text above. Equal values mean the left side is the common commit [V for the doc text, I that the Files tab sends exactly this].
- With an iteration range picked in the Files tab, the pair is the two iterations compared [I].

**Conflict.** The doc says `changeTrackingId` must be set. Two public clients post inline threads with `threadContext` only:

- unfuck-ado's `buildThreadPayload` sends `comments`, `status` and `threadContext`, no `pullRequestThreadContext`, and anchors "on the latest iteration" ([threads-api.ts L54-L79](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr/threads-api.ts#L54-L79)) [V].
- An open pull request on t3code states that "Azure fills in a new line thread's `pullRequestThreadContext` (change tracking ID and iteration) by itself" ([pingdotgg/t3code#28085](https://github.com/pingdotgg/t3code/pull/28085)) [V that it says so; not merged].

So posting without it works on the newest iteration [I, two clients agree]. Sending it is still the safer choice for a comment written on an older iteration (section 7.3).

### 1.4 How a thread follows the code across iterations

- `GET /threads?$iteration={n}&$baseIteration={m}`: "thread positions will be tracked using this iteration as the right side" and "as the left side of the diff" [V] ([Threads - List](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-7.1)).
- A tracked thread comes back with `trackingCriteria` holding its original location [V] (section 1.3).
- t3code reads threads with `$iteration=<latest>&$baseIteration=0` and notes "Azure sends `trackingCriteria` only for a thread whose line it moved" ([t3code#28085](https://github.com/pingdotgg/t3code/pull/28085)) [V that it says so].
- The tracking is server-side. It only runs for threads that exist. An unsent comment gets no tracking until it is posted [I].

### 1.5 Replies, edits, deletes

- A reply: `POST /threads/{threadId}/comments` with `content`, `parentCommentId` and `commentType: 1`. The sample replies to comment 1 with `parentCommentId: 1` [V] ([Comments - Create](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/create?view=azure-devops-rest-7.1)).
- Comment ids "start at 1 and are unique to a pull request" per the field text, yet the samples restart at 1 in each thread [V for both]. Use the id from the thread, never a guess.
- A delete is soft: the list sample shows a comment with `"isDeleted": true` and no content. A thread is `isDeleted` "when all comments are deleted" [V] ([Threads - List](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-7.1)).
- Edit and delete do not unsend: the personal notification page lists "Comments are added/changed on a pull request" as a trigger [V] ([Manage personal notifications](https://learn.microsoft.com/en-us/azure/devops/organizations/notifications/manage-your-personal-notifications?view=azure-devops)). Posting a placeholder and filling it in later still notifies.

---

## 2. Native draft, pending or batch: none

### 2.1 What exists

- Thread statuses in the UI: Active ("the default status for new comments"), Pending ("The issue in this comment is under review and awaits something else"), Resolved, Won't fix, Closed [V] ([Review pull requests](https://learn.microsoft.com/en-us/azure/devops/repos/git/review-pull-requests?view=azure-devops), section "Change comment status"). Every status is visible to everyone. None hides a thread.
- `Comment` has `commentType`, `isDeleted`, `publishedDate`, `parentCommentId`, `usersLiked`. No draft or visibility field [V] ([Threads - Create](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.1)).
- A search of node-api's `GitInterfaces.ts` for `draft`, `publish` and `unpublished` finds only the pull request's own `isDraft` ("Draft / WIP pull request", [L1772-L1774](https://github.com/microsoft/azure-devops-node-api/blob/af336d20718b7d912cef6d206227a34b4666142f/api/interfaces/GitInterfaces.ts#L1772-L1774)) and `publishedDate` [V]. A draft pull request is a different thing: the whole pull request "isn't ready for review" ([Review pull requests](https://learn.microsoft.com/en-us/azure/devops/repos/git/review-pull-requests?view=azure-devops), "Complete a PR").
- The review docs describe commenting, suggesting, replying, liking, statuses, filters, "Mark as reviewed" and votes. Nothing on holding comments back [V] (same page).
- The 2020 post introducing the new pull request experience mentions batching only for suggestions: "batch the suggestions you are accepting to make a single commit" [V] ([Azure DevOps Blog, 2020-03-19](https://devblogs.microsoft.com/devops/introducing-the-new-pull-request-experience-for-azure-repos/)).

### 2.2 Developer Community

- Web searches for "batch comments", "start a review", "pending comments" and "draft comments" with Azure DevOps found no Developer Community suggestion and no Microsoft response. Searches restricted to `developercommunity.visualstudio.com` returned nothing on topic [V for the search result, not proof that none exists]. The Developer Community site renders its search client-side and was not read directly.

### 2.3 Existing tools that do it

| Tool                                             | Where drafts live                                | How it submits                                                                                                                                      | Source                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unfuck-ado `pr-drafts` (userscript, open source) | GM storage, one list per `org/project/repo/prId` | Sequential `POST /threads`. Saves progress after each attempt. Failed ones stay as drafts. No vote.                                                 | [drafts-store.ts L18-L37](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr/drafts-store.ts#L18-L37), [pr-drafts.ts L1204-L1250](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr-drafts.ts#L1204-L1250) |
| AZD JetBrains plugin (closed source)             | "AZD saves drafts on this computer only"         | "Submit Comments" with an optional summary. Drafts deleted when "New commits are pushed to the pull request" or after 30 days.                      | [AZD comments docs](https://edgafner.github.io/azd-pr-comments.html)                                                                                                                                                                                                                                                  |
| t3code (open PR, not merged)                     | Client state                                     | "Azure has no pending review, so a submitted review posts its threads one after another." A retry after a partial failure reposts the earlier ones. | [t3code#28085](https://github.com/pingdotgg/t3code/pull/28085)                                                                                                                                                                                                                                                        |

unfuck-ado is the closest match. What it does, all [V] from its source:

- Adds a "Comment as draft" button into Azure DevOps's own composer footer, before Cancel. Title: "Save locally — nothing is posted until "Submit all"" ([pr-drafts.ts L580-L605](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr-drafts.ts#L580-L605)).
- Finds a new-thread composer by `textarea[class*="threadId--"]`. "ADO assigns negative thread ids (-1, -2, … per widget opened)", so a reply box on an existing thread reads `threadId-<id>` with one dash ([pr-drafts.ts L13-L30](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr-drafts.ts#L13-L30)).
- Reads the line and side from the diff row the composer sits under: `.repos-diff-contents-row`, the number in `.text-right.secondary-text`, the side from `.repos-line-content` having class `removed` ([pr-drafts.ts L200-L215](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr-drafts.ts#L200-L215), [diff.ts L13-L30](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr/diff.ts#L13-L30)).
- After saving, clicks the composer's Cancel. "Cancel with text closes without a discard prompt" ([pr-drafts.ts L483-L484](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr-drafts.ts#L484-L485)).
- In the single-file (Monaco) view it gets the editor instance from React internals to add view zones ([monaco.ts L3-L24](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr/monaco.ts#L3-L24)). It runs `@inject-into page` (see [pr-pipeline-status.md](pr-pipeline-status.md) section 3).
- Its Files tab has two renderers: a stacked "All changes" view of div-table rows, and a virtualized Monaco diff editor for one file ([diff.ts L3-L12](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr/diff.ts#L3-L12)).
- It does not set a vote. It does not mark posted threads, so it cannot tell a lost response from a failed post.

---

## 3. Notifications

### 3.1 When they fire

- Default subscription "Pull request comment / Comment added to pull request": "Notifies you about comments added to a pull request that you created, or a discussion you're involved in" [V] ([Default notifications](https://learn.microsoft.com/en-us/azure/devops/organizations/notifications/oob-built-in-notifications?view=azure-devops)).
- Default subscription "Pull request changes": "Notifies you when changes are made to a pull request you created, or changes are made to a pull request for which you're assigned as a reviewer" [V] (same page). The pull request event has a `Vote` field and the roles Creator, Reviewers, Changed reviewers, Reset reviewers [V] ([Event types](https://learn.microsoft.com/en-us/azure/devops/organizations/notifications/oob-supported-event-types?view=azure-devops)). Whether a vote alone sends mail under this subscription is not stated [I: likely].
- "A notification is generated for every subscription/event match that meets the filter conditions" [V] ([About notifications](https://learn.microsoft.com/en-us/azure/devops/organizations/notifications/about-notifications?view=azure-devops)).
- "Skip initiator" excludes the person who started the event. It "isn't available for all event types" [V] ([Email recipients](https://learn.microsoft.com/en-us/azure/devops/organizations/notifications/concepts-email-recipients?view=azure-devops)). The owner's own submit should not mail the owner [I].
- A vote also creates a system thread: the list sample has a thread with `"CodeReviewThreadType": "VoteUpdate"` and the text "Normal Paulk voted 10" [V] ([Threads - List](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-7.1)).

### 3.2 Suppressing or batching

- The thread, comment and reviewer endpoints have no parameter that suppresses a notification [V] (section 1.1 pages).
- No doc describes a digest or a merge of several comment events into one mail [V for absence in the pages read].
- A submit of N new threads therefore mails the author up to N times. A reply mails each person "involved" in that thread [I, from the subscription text].
- Only recipients can change this, per person, by turning a subscription off ([Manage personal notifications](https://learn.microsoft.com/en-us/azure/devops/organizations/notifications/manage-your-personal-notifications?view=azure-devops), "Unsubscribe") [V]. Not the script's business.

### 3.3 What the script can do about noise

- Post all threads in one quick burst, so the mails arrive together. The burst is still N mails [I].
- Offer a "one thread" submit: fold all unsent comments into one general thread, each with its file and line as a link. One mail. The comments lose their place in the diff. An option for later, not the default (section 10).
- Put the general summary first and the vote last (section 8.1).

---

## 4. Votes

- `PUT /reviewers/{reviewerId}?api-version=7.1` with `{ "vote": n }`. "Add a reviewer to a pull request or cast a vote" [V] ([Create Pull Request Reviewer](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-reviewers/create-pull-request-reviewer?view=azure-devops-rest-7.1)).
- Values: `10` approved, `5` approved with suggestions, `0` no vote, `-5` waiting for author, `-10` rejected [V] (same page). UI names: Approve, Approve with suggestions, Wait for author, Reject, Reset feedback [V] ([Review pull requests](https://learn.microsoft.com/en-us/azure/devops/repos/git/review-pull-requests?view=azure-devops), "Vote on PR changes").
- `reviewerId` is the owner's own id. The script already reads it from `/_apis/connectionData` (`authenticatedUser.id`) in `getAuthenticatedUserId` ([azure-devops/src/core/ado-client.ts:242-247](../../azure-devops/src/core/ado-client.ts)) [V].
- The PUT adds the owner as a reviewer when they are not one yet [V from "Add a reviewer ... or cast a vote"; I that a vote on a non-reviewer adds them optional].
- The script's existing `addPullRequestReviewer` sends `{ isRequired, vote: 0 }` ([reviewer-requests.ts:80-90](../../azure-devops/src/pull-requests/reviewer-requests.ts)). A vote call must not reuse it: it would reset the vote, and `isRequired: false` might demote a required reviewer [I]. A new call sends `{ vote }` only.
- There is no call that posts comments and a vote together. "Together" means: threads first, vote last, in one submit (section 8).

---

## 5. Auth and the script's API client

What exists, all [V] from this repo:

- `sendRequest` sends GET, or `POST`/`PUT`/`PATCH` with a JSON body, to `origin + apiBasePath + path`, with `credentials: "same-origin"`, `Accept: application/json`, and `Content-Type: application/json` on writes. No other header. A non-2xx throws `AdoRequestError` with `httpStatus` and `retryAfterSeconds` ([azure-devops/src/core/ado-request.ts:23-67](../../azure-devops/src/core/ado-request.ts)).
- The client already writes: `cancelBuild` (PATCH), `saveTheme` (PATCH), `requeuePolicyEvaluation` (PATCH), `addPullRequestReviewer` (PUT), `searchIdentities` (POST) ([ado-client.ts:185-215, 231-234](../../azure-devops/src/core/ado-client.ts), [reviewer-requests.ts:80-129](../../azure-devops/src/pull-requests/reviewer-requests.ts)). So same-origin writes with the session cookie work from this script. unfuck-ado's source records the same: "no CSRF/verification header is required" ([api.ts](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/core/api.ts)).
- API base path: `/{org}` on dev.azure.com, empty or `/DefaultCollection` on `{org}.visualstudio.com` (`apiBasePath`, [pull-request-link.ts:12-22](../../azure-devops/src/pull-requests/pull-request-link.ts)).
- Project, repository and pull request id come from the URL (`parsePullRequestHref`, [pull-request-link.ts:37-50](../../azure-devops/src/pull-requests/pull-request-link.ts)). The page model has `{ kind: "pull-request", pullRequest }` ([page.ts:11-17](../../azure-devops/src/core/page.ts)). Repository is the name. The REST paths accept the name or id for `repositoryId` on Iterations - List ("ID or name of the repository") [V]. The threads pages say "Repository ID" [V]; the reviewers PUT already works with the name ([reviewer-requests.ts:52-57](../../azure-devops/src/pull-requests/reviewer-requests.ts)), so names likely work there too [I].
- `createProjectIdCache` resolves a project name to its GUID once per project ([ado-client.ts:100-115](../../azure-devops/src/core/ado-client.ts)).
- PAT: not needed and not wanted. [pr-pipeline-status.md](pr-pipeline-status.md) section 3 covers it. A PAT would also need `vso.code_write` or `vso.threads_full` here [V] (section 1.1).

New client calls the feature needs (names are proposals):

| Call                                            | Request                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `getIterations(pullRequest)`                    | `GET .../iterations?api-version=7.1`                                              |
| `getIterationChanges(pullRequest, iterationId)` | `GET .../iterations/{id}/changes?$top=2000&api-version=7.1`, paging on `nextSkip` |
| `getThreads(pullRequest, iterationId)`          | `GET .../threads?$iteration={id}&$baseIteration=0&api-version=7.1`                |
| `createThread(pullRequest, body)`               | `POST .../threads?api-version=7.1`                                                |
| `addReply(pullRequest, threadId, body)`         | `POST .../threads/{threadId}/comments?api-version=7.1`                            |
| `setVote(pullRequest, reviewerId, vote)`        | `PUT .../reviewers/{reviewerId}?api-version=7.1` with `{ vote }`                  |

`sendRequest` returns the `Response`. A POST reads its body for the new thread id. The GET ones fit `getJson`.

---

## 6. UI integration

### 6.1 How the script injects UI today

All [V] from this repo:

- One `MutationObserver` on `document.body`, settled 200 ms, plus a 5 s timer and a tab-shown event, calls each feature's `sync` ([main.ts:11-12, 82-97](../../azure-devops/src/main.ts)). Each feature re-applies its marks on every sync; Azure DevOps re-renders freely.
- A feature gets `basePath`, `client`, `document`, `isInFrame`, `now` and `reloadWhenIdle`, which "Reloads, unless the owner types or has a dialog open" ([feature.ts:4-15](../../azure-devops/src/core/feature.ts)).
- The Pipeline tab adds a `bolt-tab` to `.repos-pr-details-page-tabbar` and a panel after it ([pipeline-tab.ts:23-27, 52-84](../../azure-devops/src/features/pipeline-tab/pipeline-tab.ts)).
- Starred reviewers add a split button where Azure DevOps shows a vote icon, then spin until Azure DevOps shows the added reviewer, and reload after 4 s when it does not ([starred-reviewers.ts:23-24, 75-85](../../azure-devops/src/features/starred-reviewers/starred-reviewers.ts)).

### 6.2 What the fixtures show of comments

From the owner's imported fixtures, all [V]:

- `pr-detail.html` (Overview): the general comment box at rest is a `.repos-comment-card` holding one `input.bolt-textfield-input` with a placeholder, inside `table.activity-feed-list.can-add-comments`. The open editor, with its Comment button, is not captured.
- `pr-detail.html`: the vote control is `.repos-pr-header-vote-button.bolt-split-button`, a main button and a chevron. The open menu is not captured.
- `pr-detail-reviewers.html` and `pr-detail-warnings.html`: a file thread in the activity feed. It has `.comment-file-header` with a link to the file, a code excerpt of `.repos-diff-contents-row` rows with `.repos-line-number[data-line]` and `.repos-line-content.added`, then `.repos-discussion-thread` with one `.repos-comment-viewer` per comment (`id` = comment id), and `.repos-discussion-thread-reply` with an `input` whose class is `threadId-<id>` plus a button. This matches unfuck-ado's description of reply inputs (section 2.3).
- No fixture shows the Files tab, the stacked diff, the Monaco diff, or an open new-thread composer.
- No fixture holds a thread, iteration or iteration-changes response. The PR page capture fetches builds, evaluations and timelines only ([capture-pipeline.ts:100-121](../../azure-devops/src/capture/capture-pipeline.ts)).
- Every pull request tab is captured under one page name, `pr-detail` ([capture-pipeline.ts:121](../../azure-devops/src/capture/capture-pipeline.ts)). Fake pull request links drop the query string ([capture-links.ts:10-19](../../azure-devops/src/capture/capture-links.ts)), so a capture cannot tell the Files tab from Overview today.

### 6.3 The three options

**(a) Intercept the native Comment button and keep the comment instead.**

- Needs a capture-phase click listener that beats React, then reads the text and closes the composer.
- One missed selector, one keyboard shortcut (Ctrl+Enter) or one Azure DevOps update posts the comment publicly. The failure is silent and cannot be undone (section 1.5: delete still notified).
- While a review is started, the owner can no longer post one comment right away.
- Rejected.

**(b) A button of the script's own next to the native Comment button.**

- Azure DevOps keeps doing what it does well: the line picker, ranges, left or right side, the file-level comment entry, the Markdown editor, suggestions.
- The script reads the text and the anchor, saves, and clicks Cancel. Proven by unfuck-ado (section 2.3).
- A miss fails safe: no button, or a toast "Couldn't resolve a file and line", and the text stays in the composer.
- Works the same for the Overview's general box and a reply box on an existing thread. The fixtures show both boxes at rest (section 6.2).
- Recommended. Decided by the owner: the button carries GitHub's labels and looks primary, and the native button looks secondary (section 6.5).

**(c) A separate review panel.**

- Needed anyway: a list of unsent comments, edit, delete, the vote choice and Submit.
- As the only way in, it would need its own file and line picker. Rebuilding Azure DevOps's diff is out of proportion.
- Recommended as the companion of (b), not on its own. Decided by the owner: it takes the form of GitHub's sticky "Submit review" button and its "Finish your review" popover (section 6.6).

**Does a primary button of ours contradict the rejection of (a)?** No, as long as two rules hold:

- The script never listens on, blocks or re-routes a click or a key press meant for the native button. The native button keeps its own handler and always posts right away.
- The script changes how the native button looks, not what it does.

What does change is the risk of habit: the button that looks primary no longer posts. That is the point of the decision. The one trap left is the keyboard (section 6.5, "Keyboard").

### 6.4 Showing unsent comments in the diff

- Stacked "All changes" view: insert a card after the anchored `.repos-diff-contents-row`. Plain DOM. Azure DevOps re-renders, so `sync` re-inserts it [I, unfuck-ado does this in `renderDraftCards`].
- Monaco single-file view: rows are virtualized. A card needs the editor instance and its view zones, reached through React internals (section 2.3). In Violentmonkey content mode, page objects need `wrappedJSObject` ([violentmonkey.md](violentmonkey.md) section 5). Which mode Azure DevOps gets is not verified. Leave inline cards in Monaco out of the first version; show those comments in the panel and mark the file in the tree [I].
- Render comment text with `textContent`, never `innerHTML`. The text is the owner's, but it is Markdown and may hold HTML.

### 6.5 Comment buttons in GitHub's style

Decided by the owner: while a review is started, the primary button in a comment box adds the comment to the review, and the secondary button posts it right away, in GitHub's wording. GitHub's labels and their sources are in section 11.

**Labels.** The new GitHub UI is the model (section 11.4).

| State             | Primary (the script's button) | Secondary (Azure DevOps's own button) |
| ----------------- | ----------------------------- | ------------------------------------- |
| No review started | "Start a review"              | "Comment"                             |
| Review started    | "Add review comment"          | "Comment"                             |

- "Start a review" saves the comment and so starts the review. There is no separate start button (section 10.1).
- Azure DevOps's button already reads "Comment", GitHub's current label for posting one comment [V for GitHub, section 11.2; I for Azure DevOps until capture 2]. So the native button needs no new text.
- GitHub's label for the secondary button once a review is started is not in any primary source (section 11.2). Classic GitHub reads "Add single comment" before a review [V]. Keeping "Comment" in both states is the choice that needs no write into a button React owns.

**Which Azure DevOps boxes get the button.**

| Box                                               | Azure DevOps's own buttons [I until captured] | The script adds                                                         | Capture |
| ------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| New thread on a line or a range, stacked view     | Comment, Cancel                               | "Start a review" / "Add review comment"                                 | 2, 3, 4 |
| New thread on a line, Monaco view                 | Comment, Cancel                               | The same, phase 2                                                       | 5       |
| File-level comment                                | Comment, Cancel                               | The same, phase 2                                                       | 10      |
| Reply on an existing thread                       | Reply, Reply & resolve, Cancel                | The same, phase 2. "Reply & resolve" stays native and posts right away. | 8       |
| Overview's general comment box                    | Comment, Cancel                               | The same                                                                | 7       |
| Edit box of a posted comment                      | Update, Cancel                                | Nothing. The comment is public already.                                 | none    |
| Edit box of an unsent comment (the script's card) | none, the script's own box                    | "Update comment" and "Cancel", the script's own. It never posts.        | none    |

- The Overview box is a deviation from GitHub. On GitHub a comment in the Conversation tab is never part of a review: a reply by email "will be added on the **Conversation** tab and will not be part of a pull request review" ([commenting-on-a-pull-request.md L31](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/content/pull-requests/how-tos/review-pull-requests/commenting-on-a-pull-request.md#L31)) [V], and the review's general text is its summary (section 11.3). Azure DevOps has one kind of thread for both, so the box can join the review [I]. The owner may prefer GitHub's rule: no button there, general text only in the summary (open question).
- Both buttons are disabled while the box is empty, as on GitHub ([suggestion-block.png](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/assets/images/help/pull_requests/suggestion-block.png), last changed in `b6941f1`, 2026-09-09) [V]. The script's button follows the box's text; the native one is Azure DevOps's business.

**Making ours primary and the native one secondary, safely.**

1. Insert the script's button as a sibling of the native buttons, last in the row. GitHub's order is Cancel, Comment, "Start a review" (same screenshot) [V]. The button uses Azure DevOps's own classes, `bolt-button enabled primary bolt-focus-treatment`, as the settings panel's Save button does ([settings-panel.ts:197-200](../../azure-devops/src/core/settings-panel.ts)) [V].
2. Restyle the native button with CSS only. A rule such as `.footer:has(> .fix-ado-review-add) .bolt-button.primary:not(.fix-ado-review-add)` gives it the look of a plain `bolt-button`. The script writes no class, attribute or text on a node React owns, so a re-render cannot undo it or fight it [I]. Without the script's button the rule does not match, and the native button looks as Azure DevOps made it.
3. Never add a listener to the native button. Never call `preventDefault` or `stopPropagation` on its events.
4. Fail closed. No anchor resolved, an unknown box, or a selector that no longer matches: no button, no restyle. The native button is then the only one, primary again, and posts as it always did.
5. After saving, click the box's Cancel to close it, as unfuck-ado does (section 2.3). If Cancel is not found, clear nothing and show "Added to review" next to the button; the owner closes the box.
6. Re-apply on every `sync`, as every feature does (section 6.1).

A miss in any step leaves a comment unsent or a button missing. No miss can post.

**Keyboard.** The trap that remains.

- GitHub: Ctrl+Enter (Cmd+Enter on a Mac) "Submits a comment". Ctrl+Shift+Enter "Submit a review comment" ([keyboard-shortcuts.md L120, L166](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/content/get-started/accessibility/keyboard-shortcuts.md#L120)) [V]. Which of the two buttons each one presses in a diff box is not stated [I: Ctrl+Enter presses the primary one].
- Azure DevOps: whether Ctrl+Enter posts from a comment box is not verified [I: it does].
- Making Ctrl+Enter add to the review means swallowing a key press before React sees it. That is option (a) for the keyboard: one miss posts publicly. Not in the first version.
- First version: the native shortcut keeps posting right away. The script's button gets a shortcut of its own only if the capture shows a free one. The button's `title` names what it does: "Add to your review. Nothing is posted until you submit."

**Votes.** GitHub's three review types map onto Azure DevOps's votes (section 4):

| "Finish your review" option | Sends        | GitHub's option it stands for                                 |
| --------------------------- | ------------ | ------------------------------------------------------------- |
| Comment (default)           | No vote call | Comment: "Submit general feedback without explicit approval." |
| Approve                     | `vote: 10`   | Approve: "Submit feedback and approve merging these changes." |
| Approve with suggestions    | `vote: 5`    | none                                                          |
| Wait for author             | `vote: -5`   | Request changes: "Submit feedback suggesting changes."        |
| Reject                      | `vote: -10`  | none. Stronger than Request changes.                          |

- "Comment" sends no vote call at all. Sending `vote: 0` would be Azure DevOps's "Reset feedback" and wipe a vote the owner gave earlier (section 4) [V for the value].
- The first option keeps GitHub's label and description. The other four keep Azure DevOps's names: they are what the author sees in the reviewer list after submit [V for the names, section 4].
- "Wait for author" as the stand-in for "Request changes" is a judgement. Both tell the author to change something without rejecting [I].
- "Reset feedback" is left out. It stays on Azure DevOps's own vote button.

### 6.6 The review header

Decided by the owner: a sticky header in the style of a GitHub review. It stays visible while the pull request scrolls, shows how many unsent comments the review holds, and has the button that finishes the review. What GitHub's sources state about its header is in section 11.5.

**What Azure DevOps has, from the fixtures** [V]:

- The pull request page scrolls inside `.repos-pr-details-page`, which has `v-scroll-auto` (`pr-detail.html`, `pr-detail.css`).
- `.repos-pr-header` holds the title, `.repos-pr-header-vote-button` and `.repos-pr-header-complete-button`. It has no sticky class, so it scrolls away [I for the scrolling].
- `.repos-pr-details-page-tabbar` has the class `sticky`. The page's CSS sets `.bolt-tabbar.sticky { position: sticky; z-index: 2; top: 0px; }` (`pr-detail.css`). So the tab bar is what stays in view.
- Only the Overview is captured. That the Files tab keeps the same sticky tab bar is not verified [I] (capture 11).

**Where it sits.** Inside Azure DevOps's sticky tab bar, at its right end.

- GitHub puts its button in the toolbar above the diff, next to the viewed-files count (section 11.5). The tab bar is Azure DevOps's nearest equal.
- It is sticky for free: no `top` offset to guess, no second sticky layer, no `z-index` to pick.
- The Pipeline tab already adds an element to this bar and re-adds it on `sync` ([pipeline-tab.ts:23-27, 52-61](../../azure-devops/src/features/pipeline-tab/pipeline-tab.ts)) [V].
- Fallback, if capture 11 shows the bar does not stick or has no room: a bar of the script's own right after the tab bar, where the Pipeline panel goes (`tabbar.after(panel)`, [pipeline-tab.ts:75-84](../../azure-devops/src/features/pipeline-tab/pipeline-tab.ts)), with `position: sticky` and `top` set to the tab bar's height.

**On which tabs.** Every tab of the pull request: Overview, Files, Updates, Commits, and the script's Pipeline tab. The tab bar is on all of them [I beyond Overview]. GitHub shows its button on "Files changed" only [V, section 11.5]; here the Overview box also adds to the review, so the count must show there too.

**What it contains.**

- One button, `bolt-button primary`: "Submit review" and a count badge, as on GitHub (section 11.2). The count is the number of comments not yet posted.
- `aria-label`: "Submit review, 3 unsent comments".
- A click opens "Finish your review".

**"Finish your review".** A `<dialog>` opened with `showModal()`, built fresh on every open, as the settings panel is ([settings-panel.ts:225-258](../../azure-devops/src/core/settings-panel.ts)) [V]. GitHub's is a popover under the button. A modal dialog needs no positioning and traps focus [I].

- Title: "Finish your review".
- A summary box, placeholder "Leave a comment". Posted first, as a general thread (section 8.1).
- The five vote options of section 6.5, "Comment" selected.
- "Unsent comments" with the count, collapsed, as GitHub's "Pending comments" (section 11.2). Open, it lists each comment with its file and line, Edit and Delete. This list is the review panel of section 6.3 (c).
- Buttons, in GitHub's order: "Discard review" left; "Cancel" and "Submit review" right. "Discard review" asks once: "Discard 3 unsent comments?"
- The dialog sets `role="dialog"`. `reloadWhenIdle` holds a reload while `[role="dialog"]` is on the page or a text box has focus ([reload-when-idle.ts:4-8](../../azure-devops/src/core/reload-when-idle.ts)) [V]; a bare `<dialog>` does not match that selector.

**States.**

| State                               | Tab bar shows                                                | "Finish your review" shows                                                                                          |
| ----------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| No review                           | Nothing                                                      | Not reachable                                                                                                       |
| Review started                      | "Submit review" with the count                               | As above                                                                                                            |
| Submitting                          | The button, disabled, with a spinner and "Sending 2 of 5"    | Stays open. Each comment: waiting, sent, or failed. Every button disabled; a second click does nothing (8.2).       |
| Submitted in full                   | Nothing. The review is deleted (section 7.4).                | Closes. The page then shows the threads (section 8.1, step 6).                                                      |
| Partial failure                     | "Submit review" with the count left, and "2 not sent" in red | Stays open. Failed comments show their HTTP status. "Submit review" sends only what is left. The vote: section 8.1. |
| Pull request completed or abandoned | "3 unsent comments", "Copy", "Discard". No "Submit review".  | Not reachable                                                                                                       |

- **No review.** GitHub shows its button with no pending comment too, so a reviewer can approve with only a summary (section 11.2). Here that would be a second vote button beside Azure DevOps's own. A review exists only once it holds a comment (section 7.4), so the header shows nothing before that.
- **Spinner and errors.** The spinner is the existing `fix-ado-spinner` ([starred-reviewers-markup.ts:73-79](../../azure-devops/src/features/starred-reviewers/starred-reviewers-markup.ts)). Errors go where starred reviewers put theirs: text in `error-text` beside the row, kept in state so a `sync` re-shows it ([starred-reviewers.ts:52, 203-222](../../azure-devops/src/features/starred-reviewers/starred-reviewers.ts)) [V].
- **Completed or abandoned.** The script learns the status from the pull request GET of the pre-flight (section 8.1), run once when the page opens with a stored review [I]. "Copy" puts the comments on the clipboard as Markdown, each with its file and line. "Discard" asks first. Nothing is deleted without a click (section 7.4).
- **Re-render.** The button carries a signature of what it shows and is rebuilt only when that changes, so the page's own changes do not loop. Starred reviewers do the same ([starred-reviewers.ts:236-256](../../azure-devops/src/features/starred-reviewers/starred-reviewers.ts)) [V].

---

## 7. Storing unsent comments

### 7.1 Where

- `GM_getValue`/`GM_setValue` are granted ([script.json](../../azure-devops/script.json)) [V]. Values "must be JSON serializable" [V] ([VM GM API](https://violentmonkey.github.io/api/gm/)).
- Starred reviewers key their storage per organisation as `starred-reviewers:${location.host}${basePath}` and re-read on every call ([starred-reviewers/index.ts:26-35](../../azure-devops/src/features/starred-reviewers/index.ts), [starred-reviewers-store.ts:46-65](../../azure-devops/src/features/starred-reviewers/starred-reviewers-store.ts)) [V]. A review keys per pull request: `review:${host}${basePath}/${project}/${repository}/${pullRequestId}`.
- Values survive a reload and a browser restart. They stay on the owner's machine. Nobody else sees them [V from the VM docs' "storage" plus the fact that no request carries them].
- Two tabs on one pull request: both read, both write. Re-read before every write keeps the loss small. `GM_addValueChangeListener` reports a change "by the userscript instance of another tab" [V] ([VM GM API](https://violentmonkey.github.io/api/gm/)). It needs a new grant, which changes `script.json` and so goes through the `release` skill. Later, not in the first version.
- One key per pull request, not one key for all reviews. With one shared key, two tabs on different pull requests each read the whole map, change their own entry and write the whole map back. The later write drops the other tab's comment. With a key per pull request, those two tabs never touch the same value.
- An empty review is never stored. A review starts with its first comment and its key is deleted with its last (section 7.4). The vote and the summary are chosen in "Finish your review" at submit (section 6.6), so nothing else needs keeping.

### 7.2 Shape (proposal)

```ts
interface Review {
  /** When a comment was last added, edited or deleted, or a submit last ran. ISO 8601. */
  updatedAt: string;
  /** The newest iteration when the review started. */
  startIteration: number;
  /** Chosen at submit and kept for a retry: 10, 5, -5, -10, or null for no vote. */
  vote?: number | null;
  /** Never empty. */
  comments: UnsentComment[];
}

interface UnsentComment {
  /** Random, made when saved. Also the marker on the posted thread (section 8.2). */
  id: string;
  /** "summary" is the text typed in "Finish your review". At most one. */
  kind: "line" | "file" | "general" | "reply" | "summary";
  content: string;
  /** line and file */
  filePath?: string;
  side?: "left" | "right";
  startLine?: number;
  endLine?: number;
  /** The diff the owner looked at. */
  iterationContext?: { firstComparingIteration: number; secondComparingIteration: number };
  changeTrackingId?: number;
  /** The text of startLine, to see later whether the line moved. */
  lineText?: string;
  /** reply */
  threadId?: number;
  parentCommentId?: number;
  /** Set as soon as Azure DevOps confirms the post. */
  postedThreadId?: number;
  postedCommentId?: number;
}
```

Test inputs for this shape are invented, per [AGENTS.md](../../AGENTS.md).

### 7.3 A new push while the review is open

- When the owner saves a comment, the script stores the iteration pair the Files tab shows and the file's `changeTrackingId` for that iteration (section 1.3).
- On submit, the script compares the newest iteration with the stored one.
- Same iteration: post as is.
- Newer iteration: post with the stored `iterationContext` and `changeTrackingId`. The docs describe exactly this case: the context names "which diff was being viewed when the thread was created", and the server tracks the thread forward and reports `trackingCriteria` [V for the fields; I that a thread created today with an older context is tracked forward]. This must be checked on the real site before it is relied on.
- Fallback check: fetch the file at the newest iteration's `sourceRefCommit` with Items - Get (`versionDescriptor.versionType=commit`, `includeContent=true`) [V] ([Items - Get](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/items/get?view=azure-devops-rest-7.1)). If `lineText` is no longer at `startLine`, mark the comment "line moved" in the panel and let the owner choose: post anyway, or delete [I].
- AZD simply drops drafts on a new push (section 2.3). That loses the owner's text. Rejected.

### 7.4 Cleanup

Decided by the owner.

| When                                                                | What happens                                                                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A submit posts every comment                                        | The key is deleted.                                                                                        |
| The owner deletes the last unsent comment, or discards the review   | The key is deleted. An empty review is never stored.                                                       |
| A submit fails in part                                              | The unsent comments stay until a retry or a discard. `updatedAt` is set. The age limit still applies.      |
| The owner opens a completed or abandoned pull request with a review | The header shows "N unsent comments" with "Copy" and "Discard" (section 6.6). Nothing is deleted silently. |
| The script starts                                                   | Every review whose `updatedAt` is more than 30 days old is deleted.                                        |

- The 30-day rule is the only deletion without a click. AZD uses the same limit (section 2.3) [V].
- `updatedAt` changes when a comment is added, edited or deleted, and after each submit attempt. Opening the pull request does not change it [I: proposal].
- After a partial failure the posted comments stay in the stored review with `postedThreadId`, so a retry skips them (section 8.2). When the last unsent one is posted or deleted, the key goes.
- The start-up sweep: `GM_listValues()`, keep the keys that start with `review:`, read each, delete the old ones. Other keys are the features' on/off choices and the starred lists ([main.ts:18-41](../../azure-devops/src/main.ts), [starred-reviewers/index.ts:26-35](../../azure-devops/src/features/starred-reviewers/index.ts)); the prefix keeps the sweep off them [V for the keys].
- A `review:` value the script cannot read is left alone and logged, not deleted [I: proposal].

Two new grants [V] ([VM GM API](https://violentmonkey.github.io/api/gm/)):

- `GM_listValues(): string[]`. "Returns an array of keys of all available values within this script."
- `GM_deleteValue(name: string): void`. "Deletes an existing key / value pair for current script from storage."

Both need a line in `grant` in [script.json](../../azure-devops/script.json), which lists `GM_addStyle`, `GM_getValue`, `GM_setValue` and `GM_registerMenuCommand` [V]. A change to `script.json` goes through the `release` skill before it is committed. Both also need a declaration in [shared/runtime/userscript.d.ts](../../shared/runtime/userscript.d.ts), which declares only the four granted functions [V]. That file is in `shared/runtime/`, so `release` names every script the change reaches.

---

## 8. Submit

### 8.1 Order

1. Pre-flight GETs: the pull request (still active?), iterations, and threads (for markers, section 8.2).
2. The summary typed in "Finish your review" (section 6.6), if any, as its own general thread. The author then reads the summary before the details [I].
3. Line and file threads, in file order, top to bottom.
4. Replies to existing threads.
5. The vote, only when every comment is posted. When some failed, ask: "3 comments not sent. Vote anyway?"
6. Delete the review when every comment is posted (section 7.4).
7. Reload with `reloadWhenIdle`, or wait for Azure DevOps to show the threads as starred reviewers does (section 6.1).

One request at a time, as the script does elsewhere ([ado-client.ts:136-146](../../azure-devops/src/core/ado-client.ts)).

### 8.2 Partial failure, retry, no double posts

- Save after every request. Set `postedThreadId` the moment a POST returns. A crash or a closed tab then loses nothing, and a second submit skips what is posted. unfuck-ado saves after each attempt for the same reason ([pr-drafts.ts L1204-L1208](https://github.com/nthomsencph/unfuck-ado/blob/8736abc3ecdac675037fd9b7a9beae038de75655/src/features/pr-drafts.ts#L1204-L1208)) [V].
- The gap: a POST that reached Azure DevOps but whose answer was lost (timeout, closed tab). t3code reposts in that case (section 2.3).
- Close it with a marker: put the comment's `id` into the thread's `properties`, such as `"fix-ado.reviewCommentId"`. Before a retry, list the threads and skip any that carries a known marker [I]. Thread `properties` are writable on create ([Threads - Create](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.1)) and come back on list with `$type`/`$value` wrappers ([Threads - List](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-7.1)) [V]. Cake.AzureDevOps exposes `SetValue` and `GetValue` on thread properties ([AzureDevOpsPullRequestCommentThread.cs L143-L190](https://github.com/cake-contrib/Cake.AzureDevOps/blob/1297ad7e9199143737e3df4e06fcd0187e91179a/src/Cake.AzureDevOps/Repos/PullRequest/CommentThread/AzureDevOpsPullRequestCommentThread.cs#L143-L190)) [V]. Whether a plain `{ "key": "value" }` body is accepted on create is not verified [I].
- Replies have no `properties`. For a reply, match on thread id, author id, and identical content [I].
- A 4xx other than 429: keep the comment unsent, show the HTTP status next to it, go on with the rest.
- Concurrency: a second Submit click while one runs does nothing.

### 8.3 Rate limits

- 200 TSTUs per user per sliding five minutes. Over it, requests slow down, then 429 with `TF400733` [V] ([Rate and usage limits](https://learn.microsoft.com/en-us/azure/devops/integrate/concepts/rate-limits?view=azure-devops)).
- "Honor the Retry-After header" [V] (same page). `AdoRequestError` already carries `retryAfterSeconds` ([ado-request.ts:23-38](../../azure-devops/src/core/ado-request.ts)) [V].
- A review of 10 to 30 comments, sent one by one, is far below normal web use [I]. On 429 or `Retry-After`: wait, then go on.

### 8.4 Thread status

- New threads: `status: 1`, active. That is what the UI does for a new comment [V] ([Review pull requests](https://learn.microsoft.com/en-us/azure/devops/repos/git/review-pull-requests?view=azure-devops)).
- Not `pending` (6): it is public and means "awaits something else" (section 2.1). Using it as "draft" would mislead the author.
- A reply leaves the thread status alone. "Reply & resolve" is the author's button, not the reviewer's.

---

## 9. Risks, unknowns, captures

### 9.1 Risks and unknowns

| #   | Unknown                                                                                                                              | Why it matters                                                        | How to settle                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Files tab DOM: stacked rows, Monaco view, composer, its Comment and Cancel buttons                                                   | The "Start a review" button and the anchor depend on it               | Captures 1 to 5                                                          |
| 2   | What the native UI stores as `pullRequestThreadContext` for a comment on the newest iteration, on an older iteration, and on a range | Decides what the script sends                                         | Captures 1 and 6: a thread the owner posted natively                     |
| 3   | Whether a thread posted with an older `iterationContext` is tracked forward                                                          | Section 7.3 relies on it                                              | Owner check on the real site, on a scratch pull request                  |
| 4   | Whether a custom key in `properties` is accepted and returned                                                                        | Idempotency marker, section 8.2                                       | Owner check on the real site                                             |
| 5   | Files tab URL: query keys for the tab, file and iteration range                                                                      | The anchor's iteration pair; telling Files from Overview in a capture | Capture rules must keep `_a`, `path`, `iteration`, `base`                |
| 6   | Violentmonkey injection mode on Azure DevOps                                                                                         | Monaco cards need page objects                                        | `log` `GM_info.injectInto` in the dev script; captured in the script log |
| 7   | Overview general box and reply box when open                                                                                         | Button placement there                                                | Captures 7 and 8                                                         |
| 8   | Vote menu labels and whether the header updates after a REST vote                                                                    | Showing the vote after submit                                         | Capture 9; owner check                                                   |
| 9   | Notifications on the real site                                                                                                       | A test submit mails real people                                       | Owner tests on a pull request of their own in a scratch repository       |
| 10  | Localised UI                                                                                                                         | Button text matching ("Comment", "Cancel") breaks                     | Match by structure first, text second                                    |
| 11  | The comment box's button row: its container, the native button's classes and label, the order, the disabled state when empty         | The CSS-only restyle and the place of the script's button (6.5)       | Captures 2, 7, 8                                                         |
| 12  | Whether Ctrl+Enter posts from an Azure DevOps comment box                                                                            | The native shortcut posts right away during a review (6.5)            | Owner check on a scratch pull request                                    |
| 13  | Whether the tab bar stays sticky on the Files tab, and has room at its right end                                                     | Where the review header sits (6.6)                                    | Capture 11                                                               |
| 14  | How a completed or an abandoned pull request shows its comment boxes                                                                 | The "N unsent comments" state and which buttons to hide (6.6)         | Capture 12                                                               |

Risk 9 matters for every real-site check of this feature: each test submit is a real post.

### 9.2 Capture rules to add first

Through `sealed-capture`, step 1:

- A page name per pull request tab: `pr-files` when `_a=files`, else `pr-detail`. Keep `_a`, `path`, `iteration` and `base` in fake pull request links ([capture-links.ts:10-19](../../azure-devops/src/capture/capture-links.ts) drops the query today).
- GETs on a pull request page: iterations, the newest iteration's changes, and threads with `$iteration` set. All GET, as the shared capture requires ([shared/dev/capture/capture.ts:71-75](../../shared/dev/capture/capture.ts)).
- JSON keeps, small numbers and fixed words only: `threadContext.*.line` and `.offset`; `iterationContext.*`; `trackingCriteria.*Iteration`; `changeTrackingId`; `changeId`; `changeType`; `commentType`; `parentCommentId`; iteration `id` and `reason`; `isDeleted`; `properties.CodeReviewThreadType.$value`. `status` and `vote` are kept already ([capture-rules.ts:20, 25](../../azure-devops/src/capture/capture-rules.ts)).
- UI words: "Comment", "Reply", "Reply & resolve", "Update", "Resolve", "Add comment", "Pending", "Resolved", "Won't fix", "Closed", "Approve", "Approve with suggestions", "Wait for author", "Reject", "Reset feedback", "Side-by-side", "Inline". "Active", "Files", "Overview", "Cancel" are kept already.
- `styleRoot: document.body` on `pr-files`, so the fake site can show the diff with the site's styling.

File paths and comment text stay scrubbed. Line numbers and iteration ids are kept; they identify nothing on their own.

### 9.3 Pages the owner captures

Use a pull request with at least two iterations, a few changed files, and at least one inline thread the owner posted natively. A pull request of the owner's own in a scratch repository avoids noise for colleagues.

| #   | Name                      | Page and state                                                                                                  | Command                       |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | `pr-files`                | Files tab, "All changes" stacked view, newest iteration, with one active and one resolved inline thread in view | Capture fixtures              |
| 2   | `pr-files-composer`       | Same, with a new-comment box open on an added line, invented text typed                                         | Capture fixtures in 5 seconds |
| 3   | `pr-files-composer-left`  | Side-by-side, a new-comment box open on a removed line                                                          | Capture fixtures in 5 seconds |
| 4   | `pr-files-composer-range` | A box opened on a selection of several lines                                                                    | Capture fixtures in 5 seconds |
| 5   | `pr-file-monaco`          | One file selected in the tree (Monaco view), a box open on a line                                               | Capture fixtures in 5 seconds |
| 6   | `pr-files-iteration`      | Files tab with an older iteration range picked in the changes dropdown                                          | Capture fixtures              |
| 7   | `pr-detail-comment-open`  | Overview, the "Add a comment" box opened                                                                        | Capture fixtures in 5 seconds |
| 8   | `pr-detail-reply-open`    | Overview, a reply box on an existing thread opened                                                              | Capture fixtures in 5 seconds |
| 9   | `pr-detail-vote-menu`     | Overview, the vote split button's menu open                                                                     | Capture fixtures in 5 seconds |
| 10  | `pr-files-file-menu`      | Files tab, a file's "More options" menu with "Add comment"                                                      | Capture fixtures in 5 seconds |
| 11  | `pr-files-scrolled`       | Files tab, scrolled down several files, so the capture shows what stays in view at the top                      | Capture fixtures              |
| 12  | `pr-detail-completed`     | Overview of a completed pull request                                                                            | Capture fixtures              |

Import with `npm run fixtures:import azure-devops <name>` for each named capture, then skim. Captures 1, 2, 7 and 11 are enough for the first version. The rest unlock left-side, range, Monaco, iteration, reply, vote and completed pull request work.

---

## 10. Recommended design and phases

### 10.1 Design

- **One new feature**, on by default like the others, listed in the settings panel with `change: { kind: "new" }` ([feature.ts:31-52](../../azure-devops/src/core/feature.ts)).
- **Start.** No start button. Every Azure DevOps comment box gets a primary "Start a review" button. The first comment saved starts the review (section 6.5).
- **Add.** While a review is started, the same button reads "Add review comment": new inline threads, file comments, the Overview box, and reply boxes. The native Comment button stays, looks secondary, and still posts right away (section 6.5).
- **See.** Unsent comments show as cards under their line in the stacked view, and as a list in "Finish your review". Each card: file and line, text, Edit, Delete, and an "Unsent" badge where GitHub shows its pending state (section 11.2).
- **Header.** A sticky "Submit review" button with the count of unsent comments, in Azure DevOps's tab bar, on every tab of the pull request. Nothing shows without a review (section 6.6).
- **Submit.** "Finish your review" holds the summary, the vote choice (Comment, Approve, Approve with suggestions, Wait for author, Reject) and "Submit review". Section 8 order. Progress per comment. Failures stay in the list with their HTTP status.
- **Discard.** "Discard review" in "Finish your review", with a confirm.
- **Storage.** One `Review` per pull request in GM storage, never empty, deleted on a full submit, on the last comment's removal, and after 30 days untouched (section 7).

Terms for `GLOSSARY.md`, for the owner to decide:

- **Review**: the owner's set of unsent comments and vote on one pull request, kept by the script until submitted. Avoid: draft (Azure DevOps's "Draft" is a pull request state), pending (a public thread status).
- **Unsent comment**: one comment in a review. Avoid: draft comment, pending comment.

GitHub's word for an unsent comment is "pending" (section 11.2). The script takes GitHub's button labels and not that word: in Azure DevOps "Pending" is a public thread status (section 2.1).

### 10.2 Phases

**Phase 0: captures.** Section 9.2 rules, then captures 1, 2, 7 and 11. Fake site: GET threads, iterations and changes from the fixtures; handle `POST` threads, `POST` comments and the existing `PUT` reviewers ([sealed-workflow.md](../spec/sealed-workflow.md), "Fake site"); `/__dev` actions "new iteration", "next post fails", "next post answers 429", "next post succeeds but answer is lost".

**Phase 1 (MVP).**

- The grants `GM_listValues` and `GM_deleteValue`, through the `release` skill (section 7.4).
- "Start a review" and "Add review comment" in the stacked view's new-thread box and the Overview box, with the CSS-only restyle of the native button (section 6.5).
- Stacked cards, the sticky "Submit review" button, "Finish your review" with summary, vote and "Discard review" (section 6.6).
- Cleanup: every rule of section 7.4 but the completed pull request state.
- Right-side lines only. Thread body: `comments`, `status: 1`, `threadContext`, `pullRequestThreadContext` from the stored iteration and `changeTrackingId`, and the marker in `properties`.
- On a newer iteration at submit: warn in the panel, post with the stored context.
- Unit tests: payload building, anchor reading from rows, submit order, resume after partial failure, marker matching, the 30-day sweep, no empty review stored. Fixture tests on captures 1, 2, 7 and 11.
- Owner check on a scratch pull request: threads land on the right lines, the vote shows, a second submit posts nothing twice.

**Phase 2.**

- Reply boxes, left-side lines, ranges, file-level comments (captures 3, 4, 8, 10).
- Monaco view: the button in its composer (capture 5). Comments listed in "Finish your review"; file marked in the tree.
- Vote menu sync after submit (capture 9).
- "N unsent comments" with "Copy" and "Discard" on a completed or abandoned pull request (capture 12).

**Phase 3.**

- "Line moved" check with Items - Get (section 7.3).
- Cards inside the Monaco view, if the injection mode allows it.
- `GM_addValueChangeListener` for two tabs (new grant, via `release`).
- Optional "one thread" submit for fewer mails (section 3.3).

---

## 11. Reference: GitHub's review UI

The model for sections 6.5 and 6.6. Read from GitHub's public docs, their source and their changelog. No GitHub page behind a sign-in was opened.

### 11.1 Two GitHub UIs

- New: the improved "Files changed" page. Public preview on 2025-06-26, then "rolling out as the default experience to all users" on 2026-01-22 [V] ([changelog 2025-06-26](https://github.blog/changelog/2025-06-26-improved-pull-request-files-changed-experience-now-in-public-preview/), [changelog 2026-01-22](https://github.blog/changelog/2026-01-22-improved-pull-request-files-changed-page-on-by-default/)).
- Classic: what GitHub Enterprise Server still documents. The docs source switches per version: `{% ifversion fpt or ghec %}**Comment**{% elsif ghes %}**Add single comment**{% endif %}` [V] ([commenting-on-a-pull-request.md L51](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/content/pull-requests/how-tos/review-pull-requests/commenting-on-a-pull-request.md#L51)).
- The docs are not fully moved over. One page says to click "Submit review" above the diff, another "Review changes" [V] (section 11.2).

### 11.2 Labels

| #   | Element                                      | New UI (github.com)                                                 | Classic UI (Enterprise Server)                                                    |
| --- | -------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| a1  | Comment box, no review: post right away      | "Comment" [V]                                                       | "Add single comment" [V]                                                          |
| a2  | Comment box, no review: start                | "Start a review" [V]                                                | "Start a review" [V]                                                              |
| b1  | Comment box, review started: add             | "Add review comment" [V]                                            | "Add review comment" [V]                                                          |
| b2  | Comment box, review started: post right away | Not stated. "Comment" [I]                                           | Not stated. "Add single comment" [I]                                              |
| c   | Button above the diff, review started        | "Submit review" and a count badge [V]                               | "Review changes" and a count badge [V]; "Finish your review" in the docs text [V] |
| c0  | The same button, no review                   | Not stated [I: "Submit review", no badge]                           | "Review changes" [V]                                                              |
| d   | Mark on an unsent comment                    | Not stated. The docs call the comments "pending" [V]                | The same [V]. A "Pending" badge [I]                                               |
| e1  | Popover title                                | "Finish your review" [V]                                            | "Finish your review" [V]                                                          |
| e2  | Summary box placeholder                      | "Leave a comment" [V]                                               | "Leave a comment" [V]                                                             |
| e3  | Option 1                                     | "Comment": "Submit general feedback without explicit approval." [V] | The same [V]                                                                      |
| e4  | Option 2                                     | "Approve": "Submit feedback and approve merging these changes." [V] | The same [V]                                                                      |
| e5  | Option 3                                     | "Request changes": "Submit feedback suggesting changes." [V]        | "Request changes": "Submit feedback that must be addressed before merging." [V]   |
| e6  | Unsent comments in the popover               | "Pending comments" and a count, collapsed [V]                       | "2 pending comments", plain text [V]                                              |
| e7  | Cancel the review                            | "Discard review" [V]                                                | "Abandon review" [V]                                                              |
| e8  | Other buttons                                | "Cancel", "Submit review" [V]                                       | "Submit review" [V]                                                               |

Sources, all github/docs:

- a1, a2, c (text): "If you only want to add this **one comment**, click **Comment**" or "**Add single comment**"; "click **Start a review**, then continue adding comments"; "click **Submit review**" or "**Finish your review**", "leave a summary of your review, and click **Submit review**" ([commenting-on-a-pull-request.md L51-L55](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/content/pull-requests/how-tos/review-pull-requests/commenting-on-a-pull-request.md#L51-L55)). The rendered Enterprise Server 3.14 page adds "at the top right of the page" ([3.14 page](https://docs.github.com/en/enterprise-server@3.14/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/commenting-on-a-pull-request)).
- a1, a2 (order): the box shows "Cancel", "Comment", "Start a review", left to right, all greyed while empty ([suggestion-block.png](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/assets/images/help/pull_requests/suggestion-block.png), last changed in `b6941f1`, 2026-09-09). The grey hides which one is primary [I: "Start a review", the last one].
- b1: "When you're done, click **Start a review**. If you have already started a review, you can click **Add review comment**" ([reviewing-proposed-changes-in-a-pull-request.md L97](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/content/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request.md#L97)).
- c, e1 to e8 (new): one screenshot shows the green "Submit review" button with the badge "2", and under it the popover ([abandon-review-button.png](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/assets/images/help/pull_requests/abandon-review-button.png), last changed in `0397eae`, 2026-09-09, "Update review cancellation instructions and screenshot"). Its alt text still says "Abandon review"; the image and the text beside it say "Discard review" ([L99-L101](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/content/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request.md#L99-L101)).
- c, e1 to e8 (classic): the same file one version earlier shows "Review changes" with the badge "2", "2 pending comments" and "Abandon review" ([abandon-review-button.png at `274d091`](https://github.com/github/docs/blob/274d09129307faee3c9df5f35d6099a0f50bb53e/assets/images/help/pull_requests/abandon-review-button.png), 2024-05-20). The Enterprise Server 3.14 text: "click **Review changes** above the changed code, then click **Abandon review**" ([3.14 page](https://docs.github.com/en/enterprise-server@3.14/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request)).
- c0: "Above the changed code, click **Review changes**", with a screenshot of the button without a badge ([review-changes.md](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/data/reusables/repositories/review-changes.md), image from 2024). The docs' own quickstart says "Click **Submit review**" for the same step ([reviewing-pull-requests-quickstart.md L42](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/content/pull-requests/get-started/reviewing-pull-requests-quickstart.md#L42)).
- d: "your line comments are _pending_ and only visible to you. You can edit pending comments anytime before you submit your review" ([reviewing-proposed-changes-in-a-pull-request.md L99](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/content/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request.md#L99)). No docs text or image shows the badge on a comment.
- e6: "Pending comments are now shown in the review submission panel, so you can double-check your feedback before submitting" ([changelog 2026-01-22](https://github.blog/changelog/2026-01-22-improved-pull-request-files-changed-page-on-by-default/)).

Not found in any open source: GitHub's web UI is closed, so no label could be read from code. b2, c0 (new) and d stay [I].

### 11.3 What the docs say each option does

- "Select **Comment** to leave general feedback without explicitly approving the changes or requesting additional changes."
- "Select **Approve** to submit your feedback and approve merging the changes proposed in the pull request."
- "Select **Request changes** to submit feedback that must be addressed before the pull request can be merged."

All [V] ([reviewing-proposed-changes-in-a-pull-request.md L193-L195](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/content/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request.md#L193-L195)). The step before it: "Type a comment summarizing your feedback on the proposed changes" ([review-summary-comment.md](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/data/reusables/repositories/review-summary-comment.md)) [V].

Why batch at all, in GitHub's words: "Anyone watching the pull request or repository will receive a notification of your comments. Batching your comments avoids sending multiple notifications" ([commenting-on-a-pull-request.md L57](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/content/pull-requests/how-tos/review-pull-requests/commenting-on-a-pull-request.md#L57)) [V]. Azure DevOps cannot batch the mails (section 3.2).

### 11.4 Old or new: recommendation

Take the new UI's labels.

- It is GitHub's default since 2026-01 (section 11.1), so it is what the owner sees there.
- "Comment" for posting right away is the label Azure DevOps's button already has (section 6.5). The classic "Add single comment" would need a write into a button React owns.
- "Submit review" on the top button says what happens. "Review changes" reads like a link to the diff.
- "Discard review" over "Abandon review": in Azure DevOps "Abandon" closes a pull request.

Kept from neither: the word "pending" (section 10.1).

### 11.5 The sticky header

What the sources state:

- The button is "Above the changed code" ([review-changes.md](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/data/reusables/repositories/review-changes.md)); in the classic UI "at the top right of the page" (Enterprise Server 3.14, section 11.2) [V].
- It is reached through the "Files changed" tab. Every docs procedure that ends in it starts with that tab ([reviewing-pull-requests-quickstart.md L26-L42](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/content/pull-requests/get-started/reviewing-pull-requests-quickstart.md#L26-L42)) [V].
- It sits next to the count of viewed files: the screenshots show "0 / 1 viewed" beside "Submit review" (section 11.2) [V]. "The **progress bar** in the pull request header shows how many files you've viewed" ([reviewing-proposed-changes-in-a-pull-request.md L39](https://github.com/github/docs/blob/d59b2631959db46d71ca5f7748ec04311c6d0870/content/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request.md#L39)) [V].
- The new page has a "Files changed toolbar" that holds buttons, and a "pull request header" that shows the merge status "at the top of every pull request page" ([changelog 2026-03-19](https://github.blog/changelog/2026-03-19-view-code-and-comments-side-by-side-in-pull-request-files-changed-page/), [changelog 2026-03-05](https://github.blog/changelog/2026-03-05-quick-access-to-merge-status-in-pull-requests-in-public-preview/)) [V].
- The page has sticky headers: "sticky headers behaving incorrectly" was fixed on 2026-01-22, and "the file diff header was not consistently sticky when scrolling" on 2026-02-05 ([changelog 2026-01-22](https://github.blog/changelog/2026-01-22-improved-pull-request-files-changed-page-on-by-default/), [changelog 2026-02-05](https://github.blog/changelog/2026-02-05-improved-pull-request-files-changed-february-5-updates/)) [V].

What they do not state: that the toolbar with "Submit review" stays in view while the diff scrolls [I: it does], and what the button shows on the other tabs [I: nothing].

---

## 12. What the captures settled

Read from the scrubbed fixtures in `azure-devops/fixtures/`, imported and skimmed by the owner. All [V] from the fixture named.

### 12.1 The thread Azure DevOps's own comment box creates

From `pr-files.json`, `data.review.threads`:

- `pullRequestThreadContext.iterationContext` is `{ firstComparingIteration: 3, secondComparingIteration: 3 }` on a pull request with three iterations. The Files tab sends `{N, N}` for the full diff of iteration N.
- `pullRequestThreadContext.changeTrackingId` equals the `changeTrackingId` of the file's entry in the newest iteration's changes (`data.review.newestIterationChanges`), matched by `item.path`.
- `threadContext` holds `filePath`, `rightFileStart` and `rightFileEnd`. A one-line comment has `offset: 1` at the start and the line's length plus one at the end. Offsets are 1-based.
- A first comment has `parentCommentId: 0` and `commentType: "text"`.
- `properties` holds `Microsoft.TeamFoundation.Discussion.UniqueID`, a GUID, and `Microsoft.TeamFoundation.Discussion.SupportsMarkdown`. The unique id is the marker for section 8.2: send a GUID made when the comment is saved, and look for it in the threads before a retry. That the API accepts it on create is still unconfirmed.
- System threads carry `properties.CodeReviewThreadType` with `ReviewersUpdate`, `RefUpdate`, `TargetChanged` or `IsDraftUpdate`, and no `threadContext`.
- Iteration `reason` values seen: `push`, `retarget`.

### 12.2 The all-files view

From `pr-files.html`, `pr-files-composer.html`, `pr-files-composer-left.html` and `pr-files-reply-open.html`:

- Each file is a card, `.repos-summary-header`. Its header shows the full path in `.body-s.secondary-text.text-ellipsis`, the same value as the thread's `filePath`. The header is sticky.
- A diff is `.repos-summary-diff-container[role=table]` with rows `.repos-diff-contents-row`. A line's cell is `.repos-line-content` with `data-oline` (old line), `data-mline` (new line), and a class `added`, `removed` or `unchanged`. A removed line has only `data-oline`; an added line only `data-mline`.
- A thread or comment box is its own row, the next sibling of the line's row, holding `.repos-diff-discussion`. In the inline layout a box on a removed line follows the `removed` row: that is a left-side comment.
- Every row starts with an "Add comment" button, `.repos-add-comment-widget [role=button]`.

### 12.3 The comment box

The same in the all-files view, the single-file view and the Overview (`pr-detail-comment-open.html`):

- `.repos-discussion-thread` holds `.repos-discussion-thread-reply`, with `textarea[aria-label="Add a comment"]`.
- A box for a new thread carries a class `threadId--1`, `threadId--2`, counting down. A reply box has no such class; it sits in the thread it replies to.
- The button row is the last `.flex-row.flex-wrap.rhythm-horizontal-8`: "Cancel", then `button.primary` reading "Comment" (new thread) or "Reply". A reply box has a third button between them; its label is scrubbed.
- The primary button is `disabled` with `aria-disabled="true"` while the box is empty.
- A posted thread shows a status button ("Active") and "Resolve".

### 12.4 The single-file view

From `pr-files-single-file-with-comment.html` and `pr-files-single-file-composer.html`:

- It is a Monaco diff editor, `.monaco-diff-editor`, with no `.repos-diff-contents-row` and no line attributes.
- A thread or box sits in `.overlayWidgets > .zone-widget`, in `.repos-monaco-discussion-host`. The thread markup inside is the same as section 12.3.
- The zone's `top` equals the `top` of the line above it plus one line height, in `.margin-view-overlays`. The line number is that row's `.line-numbers` text. This reads the line without Monaco's internals, at the cost of depending on pixel positions.
- The box sits in the editor with class `modified-in-monaco-diff-editor` for a right-side comment.

### 12.5 Header and vote

- The tab bar is `.repos-pr-details-page-tabbar.bolt-tabbar.sticky`, with `position: sticky; top: 0; z-index: 2` in `pr-files.css`. It stays sticky on the Files tab.
- The vote button is `.repos-pr-header-vote-button.bolt-split-button` in `.repos-pr-header`. Its menu rows have ids `__bolt-vote-Approve`, `__bolt-vote-Approve-with-suggestions`, `__bolt-vote-Wait-for-author`, `__bolt-vote-Reject` and `__bolt-vote-Reset-feedback` (`pr-detail-vote-menu.html`).

### 12.6 Capture gaps

- `pr-files.html` still has stand-in line numbers: it was captured before the dev script kept `data-line`, `data-mline`, `data-oline` and `data-offset`. A new capture fixes it.
- The single-file view shows line numbers as text, which the scrubber always replaces.
- No fixture has a resolved inline thread, a multi-line comment, or a completed pull request.

---

## Unverified / open

- Whether an inline thread without `pullRequestThreadContext` is fully tracked across later pushes (section 1.3).
- Whether a thread created with an older `iterationContext` is tracked forward (section 7.3).
- Whether Threads - Create accepts `Microsoft.TeamFoundation.Discussion.UniqueID` in `properties` (sections 8.2, 12.1).
- Whether a vote alone mails the author (section 3.1).
- Whether a Developer Community suggestion exists. Not found by search (section 2.2).
- GitHub's label for posting right away once a review is started, its top button with no review in the new UI, and the badge on a pending comment (section 11.2).
- What Ctrl+Enter does in the Azure DevOps comment box, and the label of the reply box's middle button (sections 6.5, 12.3).

Open questions for the owner:

- The secondary button during a review: keep Azure DevOps's "Comment", or relabel it "Add single comment" (section 6.5)?
- Does the Overview's general comment box join the review, or only the summary, as on GitHub (section 6.5)?
- Ctrl+Enter keeps posting right away in the first version. Acceptable (section 6.5)?
- "Wait for author" as the stand-in for "Request changes", and five vote options instead of GitHub's three (section 6.5)?
- "Unsent" on cards and in "Finish your review", where GitHub says "Pending" (section 10.1)?
