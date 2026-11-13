import type { Feature, FeatureContext, FeatureRun, SyncReason } from "./feature.ts";
import type { Page } from "./page.ts";

interface FeatureRunnerOptions {
  features: Feature[];
  isOn: (feature: Feature) => boolean;
  context: FeatureContext;
  currentPage: () => Page;
  isTabActive: () => boolean;
  /** Called when a feature throws, so one broken feature leaves the others running. */
  onError: (feature: Feature, error: unknown) => void;
}

interface FeatureRunner {
  sync: (reason: SyncReason) => void;
}

interface StartedFeature {
  feature: Feature;
  run: FeatureRun;
}

function startEach(options: FeatureRunnerOptions): StartedFeature[] {
  const started: StartedFeature[] = [];
  for (const feature of options.features.filter(options.isOn)) {
    try {
      const run = feature.start(options.context);
      if (run) {
        started.push({ feature, run });
      }
    } catch (error) {
      options.onError(feature, error);
    }
  }
  return started;
}

/** Starts the features that are on, in list order, and syncs them in that order. */
function createFeatureRunner(options: FeatureRunnerOptions): FeatureRunner {
  const started = startEach(options);
  return {
    sync(reason) {
      const tick = { isTabActive: options.isTabActive(), page: options.currentPage(), reason };
      for (const { feature, run } of started) {
        try {
          run.sync?.(tick);
        } catch (error) {
          options.onError(feature, error);
        }
      }
    },
  };
}

export type { FeatureRunner };
export { createFeatureRunner };
