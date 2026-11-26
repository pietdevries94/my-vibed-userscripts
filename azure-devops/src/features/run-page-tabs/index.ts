import type { RunTab, RunTabStorage } from "./run-tab-store.ts";
import type { Feature } from "../../core/feature.ts";
import { createPullRequestRunTabs } from "./pull-request-run-tabs.ts";
import { createRunTabFrame } from "./run-tab-frame.ts";
import { createRunTabToggle } from "./run-tab-toggle.ts";
import { pullRequestOf } from "../../core/page.ts";
import style from "./style.css";
import switchStyle from "../../core/switch.css";

/**
 * The run page tabs the owner turned on, per pipeline. A setting the owner turns off on the
 * run page, so it has no expiry.
 */
const RUN_TABS_KEY = "run-page-tabs";

const runTabStorage: RunTabStorage = {
  load: () => GM_getValue<RunTab[]>(RUN_TABS_KEY, []),
  save: (tabs) => {
    GM_setValue(RUN_TABS_KEY, tabs);
  },
};

const runPageTabs: Feature = {
  change: { kind: "new", version: "1.20.0" },
  description: "Tabs such as Code Coverage on the pull request. Pick them on the run page.",
  id: "run-page-tabs",
  name: "Run page tabs",
  start({ basePath, client, document, isInFrame, now }) {
    if (isInFrame) {
      const frame = createRunTabFrame(document);
      return frame === null ? null : { sync: frame.sync };
    }
    const toggle = createRunTabToggle({
      document,
      getBuildPipeline: async (project, buildId) => client.getBuildPipeline(project, buildId),
      storage: runTabStorage,
    });
    const tabs = createPullRequestRunTabs({
      apiBasePath: basePath,
      document,
      getEvaluations: async (pullRequest) => {
        const { evaluations } = await client.getPolicyEvaluations(pullRequest);
        return evaluations;
      },
      getPullRequestBuilds: async (project, pullRequestId) => {
        const { builds } = await client.getPullRequestBuilds(project, pullRequestId);
        return builds;
      },
      loadRunTabs: runTabStorage.load,
      now,
    });
    return {
      sync({ isTabActive, page }) {
        toggle.sync();
        tabs.sync(pullRequestOf(page), isTabActive);
      },
    };
  },
  styles: [switchStyle, style],
};

export { runPageTabs };
