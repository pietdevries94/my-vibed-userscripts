import type { AdoClient } from "./ado-client.ts";
import type { Page } from "./page.ts";

/** What a feature gets when it starts. */
interface FeatureContext {
  /** The REST API path prefix, such as `/my-org`. */
  basePath: string;
  client: AdoClient;
  document: Document;
  /** True in a frame, such as the run page the Pipeline tab shows. */
  isInFrame: boolean;
  now: () => number;
  /** Reloads, unless the owner types or has a dialog open, or the page reloaded moments ago. */
  reloadWhenIdle: () => void;
}

/** Why the runner syncs the features. */
type SyncReason = "dom-change" | "timer" | "tab-shown";

interface Tick {
  page: Page;
  isTabActive: boolean;
  reason: SyncReason;
}

/** A started feature. `sync` runs after every DOM change, on a timer, and when the tab shows. */
interface FeatureRun {
  sync?: (tick: Tick) => void;
}

/** One visible change the script makes to Azure DevOps, which the owner turns on or off. */
interface Feature {
  /** The storage key of its on/off choice. Changing it resets the owner's choice. */
  id: string;
  /** Its name in the settings panel. */
  name: string;
  /** One line in the settings panel on what it does. */
  description: string;
  /** Its stylesheets. A stylesheet that several features list is added once. */
  styles: string[];
  /** Null when there is nothing to sync, such as in a frame the feature skips. */
  start: (context: FeatureContext) => FeatureRun | null;
}

export type { Feature, FeatureContext, FeatureRun, SyncReason, Tick };
