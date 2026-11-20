// What the Azure DevOps capture keeps. The owner reads this list. Dev file only.
import type { ScrubRules } from "../../../shared/dev/scrub/rules.ts";
import { fakeLink } from "./capture-links.ts";

const rules: ScrubRules = {
  // Azure DevOps's own layout and state attributes. Their values are fixed words.
  keepAttributes: [
    "aria-roledescription",
    "data-componentregion",
    "data-done",
    "data-is-focusable",
    // Line numbers and columns of a diff row. Small numbers that name nothing.
    "data-line",
    "data-mline",
    "data-offset",
    "data-oline",
    "data-noclose",
    "data-renderedregion",
    "data-side",
    "data-theme",
  ],
  keepIdPatterns: [
    /^__bolt-[\w-]+$/u,
    // A run page tab of Microsoft's own, by its contribution id.
    /^__bolt-tab-ms\.vss-[\w.-]{1,80}$/u,
  ],
  keepJsonPaths: [
    // Policy evaluation and pull request states: "approved", "running", "active".
    { path: /(?:^|\.)status$/u, value: /^[A-Za-z]{1,30}$/u },
    // The policy type tells build validation from other policies.
    { path: /configuration\.type\.id$/u, value: /^[\da-f-]{36}$/iu },
    { path: /configuration\.type\.displayName$/u, value: /^[\w ]{1,60}$/u },
    // Reviewer votes: -10, -5, 0, 5, 10.
    { path: /(?:^|\.)vote$/u, value: /^-?\d{1,2}$/u },
    // Run timeline records: Stage, Job or Task; pending or completed; succeeded or failed.
    { path: /records\.(?:type|state|result)$/u, value: /^[A-Za-z.]{1,40}$/u },
    // A record's issue kind, and how many warnings and errors it has. The messages stay scrubbed.
    { path: /records\.issues\.type$/u, value: /^(?:warning|error)$/u },
    { path: /records\.(?:warningCount|errorCount)$/u, value: /^\d{1,4}$/u },
    // A run's result: succeeded, partiallySucceeded, failed or canceled.
    { path: /(?:^|\.)builds\.body\.value\.result$/u, value: /^[A-Za-z]{1,30}$/u },
    // The order of a record within its parent. A stand-in would lose it.
    { path: /records\.order$/u, value: /^\d{1,4}$/u },
    // What kinds of identities a starred reviewer search found, in the script log.
    { path: /(?:^|\.)found\.(?:entityType|originDirectory)$/u, value: /^[A-Za-z]{1,20}$/u },
    { path: /(?:^|\.)foundCount$/u, value: /^\d{1,4}$/u },
    // How far a starred reviewer chip got in picking its suggestion, in the script log.
    { path: /(?:^|\.)(?:from|to)$/u, value: /^(?:waiting|clicked|entered)$/u },
    // Counts the Pipeline tab notes in the script log.
    { path: /(?:^|\.)(?:checkCount|runCount)$/u, value: /^\d{1,4}$/u },
    // Theme contribution ids, such as "ms.vss-web.vsts-theme-dark". Microsoft's own, never the organisation's.
    { path: /./u, value: /^ms\.vss-[\w.-]{1,80}$/u },
    // The palettes in the page's theme data: Microsoft's colours and theme names.
    { path: /^themes\./u, value: /^[\w#(),.%/ -]{1,120}$/u },
    // Theme names and their colours.
    { path: /theme.*\.(?:name|displayName)$/iu, value: /^[\w ]{1,40}$/u },
    {
      path: /theme.*\.data\.[\w-]+$/iu,
      value: /^(?:#[\da-f]{3,8}|rgba?\([\d., ]{5,40}\)|[\d, .]{5,40})$/iu,
    },
    // The editor probe: names of the page's own code, kinds and counts. Never content.
    { path: /(?:^|\.)editorProbe\./u, value: /^[\w$.:-]{0,80}$/u },
    // The file tree's layout: kinds of rows, row numbers and pixels. Never content.
    { path: /(?:^|\.)treeLayout\./u, value: /^[\w:-]{0,40}$/u },
    // The activity feed's layout: kinds of rows and pixels. Never content.
    { path: /(?:^|\.)feedLayout\./u, value: /^[\w:-]{0,60}$/u },
    // Where a thread sits in a file: line and column. Small numbers that name nothing.
    {
      path: /(?:threadContext|trackingCriteria)\.(?:orig)?(?:Left|Right|left|right)File(?:Start|End)\.(?:line|offset)$/u,
      value: /^\d{1,6}$/u,
    },
    // Which iterations a thread compares, and the id of its file within the iteration.
    {
      path: /(?:iterationContext|trackingCriteria)\.(?:first|second)ComparingIteration$/u,
      value: /^\d{1,4}$/u,
    },
    { path: /(?:^|\.)(?:changeTrackingId|changeId)$/u, value: /^\d{1,6}$/u },
    // How a file changed: "edit", "add", "delete, rename".
    { path: /(?:^|\.)changeType$/u, value: /^[A-Za-z, ]{1,40}$/u },
    // A comment's kind and its place in the thread: "text" or "system", and small counters.
    { path: /comments\.commentType$/u, value: /^[A-Za-z]{1,20}$/u },
    { path: /comments\.(?:id|parentCommentId)$/u, value: /^\d{1,4}$/u },
    // An iteration's number and why it exists: "push", "forcePush", "create".
    { path: /iterations\.body\.value\.id$/u, value: /^\d{1,4}$/u },
    { path: /iterations\.body\.value\.reason$/u, value: /^[A-Za-z]{1,30}$/u },
    // What made a system thread: "VoteUpdate", "RefUpdate".
    { path: /CodeReviewThreadType\.\$value$/u, value: /^[A-Za-z]{1,40}$/u },
    // Response status, Retry-After and work item revisions.
    { path: /(?:^|\.)(?:httpStatus|retryAfterSeconds|rev)$/u, value: /^\d{1,6}$/u },
  ],
  keepRouteWords: [
    "Settings",
    "Entries",
    "me",
    "Contribution",
    "HierarchyQuery",
    "edit",
    "board",
    "backlog",
    "t",
    "results",
    "pullrequest",
    "pullrequests",
    "pullrequestcreate",
  ],
  keepUiWords: [
    "Active",
    "Draft",
    // Pull request tabs.
    "Overview",
    "Files",
    "Updates",
    "Commits",
    // The reviewer section and its add dropdown.
    "Reviewers",
    "Required",
    "Optional",
    "Add",
    // The create pull request page.
    "Create",
    "New pull request",
    "Title",
    "Description",
    "Work items to link",
    "Tags",
    // Pipeline run tabs and sections.
    "Summary",
    "Logs",
    "Tests",
    "Stages",
    "Jobs",
    "Extensions",
    "Code Coverage",
    // The theme settings.
    "Theme",
    "Light",
    "Dark",
    "High contrast",
    "Use system theme",
    "System",
    "Save",
    "Cancel",
    // Comment boxes and threads.
    "Comment",
    "Reply",
    "Resolve",
    "Add comment",
    "Add a comment",
    // Thread statuses. "Active" is kept above.
    "Pending",
    "Resolved",
    "Won't fix",
    "Closed",
    // The vote button and its menu.
    "Approve",
    "Approve with suggestions",
    "Wait for author",
    "Reject",
    "Reset feedback",
    // The Files tab's diff layouts.
    "Side-by-side",
    "Inline",
  ],
  mapUrl: fakeLink,
};

export { rules };
