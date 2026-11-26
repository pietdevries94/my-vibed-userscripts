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

/** What the settings panel flags until the owner has seen it. */
interface FeatureChange {
  kind: "new" | "updated";
  /** The script version that brings the change. A new version flags the feature again. */
  version: string;
}

/** One visible change the script makes to Azure DevOps, which the owner turns on or off. */
interface Feature {
  /** The storage key of its on/off choice. Changing it resets the owner's choice. */
  id: string;
  /** Its name in the settings panel. */
  name: string;
  /** One line in the settings panel on what it does. */
  description: string;
  /** True for a feature the owner turns on, such as a fun one. Others are on until turned off. */
  isOffByDefault?: boolean;
  /** Its latest change worth flagging in the settings panel. */
  change?: FeatureChange;
  /** A word the settings panel always shows as a chip after its name, such as "WIP". */
  tag?: string;
  /** Its stylesheets. A stylesheet that several features list is added once. */
  styles: string[];
  /** Null when there is nothing to sync, such as in a frame the feature skips. */
  start: (context: FeatureContext) => FeatureRun | null;
}

/** Features in a settings section, under a heading of their own when the group has a name. */
interface SettingsGroup {
  name?: string;
  features: Feature[];
}

/** A page of the settings panel, with the features on one subject, such as Pipelines. */
interface SettingsSection {
  /** Its entry in the side bar and its heading. */
  name: string;
  /** One line under its heading on what its features change. */
  description: string;
  groups: SettingsGroup[];
}

/** Reads a saved choice, or the fallback when the owner never saved one. `GM_getValue` fits. */
type SavedChoice = (id: string, fallback: boolean) => boolean;

/** On or off: the owner's saved choice, else the feature's default. */
function isFeatureOn(feature: Feature, savedChoice: SavedChoice): boolean {
  return savedChoice(feature.id, feature.isOffByDefault !== true);
}

export { isFeatureOn };
export type {
  SavedChoice,
  Feature,
  FeatureChange,
  FeatureContext,
  FeatureRun,
  SettingsGroup,
  SettingsSection,
  SyncReason,
  Tick,
};
