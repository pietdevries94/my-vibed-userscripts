import type { Feature, FeatureContext, FeatureRun, SyncReason } from "./feature.ts";
import type { Page } from "./page.ts";

interface FeatureRunnerOptions {
  features: Feature[];
  isOn: (feature: Feature) => boolean;
  context: FeatureContext;
  currentPage: () => Page;
  isTabActive: () => boolean;
  addStyle: (css: string) => void;
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

function addStyles(features: Feature[], addStyle: (css: string) => void): void {
  for (const style of new Set(features.flatMap(({ styles }) => styles))) {
    addStyle(style);
  }
}

function startEach(options: FeatureRunnerOptions, features: Feature[]): StartedFeature[] {
  const started: StartedFeature[] = [];
  for (const feature of features) {
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

/** Adds the styles of the features that are on, starts them in list order, and syncs them in that order. */
function createFeatureRunner(options: FeatureRunnerOptions): FeatureRunner {
  const features = options.features.filter(options.isOn);
  addStyles(features, options.addStyle);
  const started = startEach(options, features);
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
