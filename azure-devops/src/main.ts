import { FEATURES, SETTINGS_SECTIONS } from "./features/index.ts";
import type { Feature, SyncReason } from "./core/feature.ts";
import { SETTINGS_PANEL_STYLE } from "./core/settings-panel-style.ts";
import { apiBasePath } from "./pull-requests/pull-request-link.ts";
import { createAdoClient } from "./core/ado-client.ts";
import { createFeatureRunner } from "./core/feature-runner.ts";
import { createSettingsPanel } from "./core/settings-panel.ts";
import { createSyncBeforePaint } from "./core/sync-before-paint.ts";
import { isFeatureOn } from "./core/feature.ts";
import { parsePage } from "./core/page.ts";
import { reloadWhenIdle } from "./core/reload-when-idle.ts";

const TIMER_INTERVAL_MS = 5000;

const basePath = apiBasePath(location);
const isTabActive = (): boolean => document.visibilityState === "visible";
const isInFrame = globalThis.top !== globalThis.self;
const isOn = (feature: Feature): boolean => isFeatureOn(feature, GM_getValue);
const seenChangeKey = ({ id }: Feature): string => `${id}-seen-change`;

// A frame shows a run page inside the Pipeline tab. Only the top page gets the settings.
const settingsPanel = isInFrame
  ? null
  : createSettingsPanel({
      document,
      isOn,
      markChangesSeen: (features) => {
        for (const feature of features) {
          GM_setValue(seenChangeKey(feature), feature.change?.version);
        }
      },
      reload: () => {
        location.reload();
      },
      save: (choices) => {
        for (const [id, isChosenOn] of choices) {
          GM_setValue(id, isChosenOn);
        }
      },
      sections: SETTINGS_SECTIONS,
      seenChangeVersion: (feature) => GM_getValue<string | null>(seenChangeKey(feature), null),
    });
if (settingsPanel) {
  GM_addStyle(SETTINGS_PANEL_STYLE);
  // A way in when Azure DevOps changes its top bar and the button is gone.
  GM_registerMenuCommand("Settings", settingsPanel.open);
}
const runner = createFeatureRunner({
  addStyle: (css) => {
    GM_addStyle(css);
  },
  context: {
    basePath,
    client: createAdoClient({
      apiBasePath: basePath,
      fetch: async (url, init) => fetch(url, init),
      origin: location.origin,
    }),
    document,
    isInFrame,
    now: () => Date.now(),
    reloadWhenIdle: () => {
      reloadWhenIdle(document);
    },
  },
  currentPage: () => parsePage(location, basePath),
  features: FEATURES,
  isOn,
  isTabActive,
  // Throw again outside the loop, so the browser reports it and the other features run on.
  onError: (_feature, error) => {
    queueMicrotask(() => {
      throw error;
    });
  },
});
const sync = (reason: SyncReason): void => {
  settingsPanel?.sync();
  runner.sync(reason);
};

// ADO is a single-page app that re-renders its content. Re-apply after every DOM change,
// before the browser paints it. A hidden tab runs no animation frames; it syncs when it shows.
const syncOnDomChange = createSyncBeforePaint(
  (callback) => {
    requestAnimationFrame(callback);
  },
  () => {
    sync("dom-change");
  },
);
new MutationObserver(syncOnDomChange).observe(document.body, { childList: true, subtree: true });

setInterval(sync, TIMER_INTERVAL_MS, "timer");
document.addEventListener("visibilitychange", () => {
  if (isTabActive()) {
    sync("tab-shown");
  }
});
sync("dom-change");
