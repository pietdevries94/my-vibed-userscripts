// What the Azure DevOps capture keeps. The owner reads this list. Dev file only.
import type { ScrubRules } from "../../shared/dev/scrub/rules.ts";
import { fakeLink } from "./capture-links.ts";

const rules: ScrubRules = {
  // Azure DevOps's own layout and state attributes. Their values are fixed words.
  keepAttributes: [
    "aria-roledescription",
    "data-componentregion",
    "data-done",
    "data-is-focusable",
    "data-noclose",
    "data-renderedregion",
    "data-side",
  ],
  keepIdPatterns: [/^__bolt-[\w-]+$/u],
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
    // Counts the Pipeline tab notes in the script log.
    { path: /(?:^|\.)(?:checkCount|runCount)$/u, value: /^\d{1,4}$/u },
    // Theme contribution ids, such as "ms.vss-web.vsts-theme-dark". Microsoft's own, never the organisation's.
    { path: /./u, value: /^ms\.vss-[\w.-]{1,80}$/u },
    // Theme names and their colours.
    { path: /theme.*\.(?:name|displayName)$/iu, value: /^[\w ]{1,40}$/u },
    {
      path: /theme.*\.data\.[\w-]+$/iu,
      value: /^(?:#[\da-f]{3,8}|rgba?\([\d., ]{5,40}\)|[\d, .]{5,40})$/iu,
    },
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
    // Pipeline run tabs and sections.
    "Summary",
    "Logs",
    "Tests",
    "Stages",
    "Jobs",
    // The theme settings.
    "Theme",
    "Light",
    "Dark",
    "High contrast",
    "Use system theme",
    "System",
    "Save",
    "Cancel",
  ],
  mapUrl: fakeLink,
};

export { rules };
