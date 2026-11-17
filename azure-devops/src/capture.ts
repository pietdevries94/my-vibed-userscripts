// The Azure DevOps capture: which pages to capture, what to keep, and which GET
// requests to send. Dev file only. The keep rules are in capture-rules.ts.
import type { CaptureDefinition, CapturePage } from "../../shared/dev/capture/capture.ts";
import {
  apiBasePath,
  isPullRequestCreateLocation,
  isPullRequestInboxLocation,
  parsePullRequestListLocation,
} from "./pull-requests/pull-request-link.ts";
import { isThemePanelOpen, themeSettingsPage } from "./capture/capture-theme.ts";
import { boardPageAt } from "./capture/capture-board.ts";
import { pullRequestOrRunPage } from "./capture/capture-pipeline.ts";
import { pullRequestRowsPage } from "./capture/capture-pull-request-rows.ts";
import { rules } from "./capture/capture-rules.ts";
import { withoutScriptMarks } from "./capture/capture-script-marks.ts";
import { workItemPageAt } from "./capture/capture-work-item.ts";

/** The create pull request page. Its reviewer field and search dropdown need the site's styling. */
function pullRequestCreatePage(): CapturePage {
  return {
    collect: async () => ({ data: {}, meta: {} }),
    name: "pr-create",
    root: withoutScriptMarks(document.body),
    styleRoot: document.body,
  };
}

function capturePage(document: Document, location: Location): CapturePage | null {
  if (isThemePanelOpen(document)) {
    return themeSettingsPage(document, location);
  }
  const listPage = parsePullRequestListLocation(location, apiBasePath(location));
  if (listPage !== null) {
    return pullRequestRowsPage("pr-list", listPage);
  }
  if (isPullRequestCreateLocation(location)) {
    return pullRequestCreatePage();
  }
  if (isPullRequestInboxLocation(location)) {
    return pullRequestRowsPage("pr-inbox", null);
  }
  return boardPageAt(location) ?? workItemPageAt(location) ?? pullRequestOrRunPage(location);
}

const captureDefinition: CaptureDefinition = {
  page: capturePage,
  rules,
  scriptId: "azure-devops",
};

export { captureDefinition };
