import { FEATURES } from "./features/index.ts";
import type { SyncReason } from "./core/feature.ts";
import { apiBasePath } from "./pull-request-link.ts";
import { createAdoClient } from "./ado-client.ts";
import { createFeatureRunner } from "./core/feature-runner.ts";
import { parsePage } from "./core/page.ts";
import { reloadWhenIdle } from "./core/reload-when-idle.ts";
import style from "./style.css";

const DOM_SETTLE_MS = 200;
const TIMER_INTERVAL_MS = 5000;
const IS_ON_BY_DEFAULT = true;

GM_addStyle(style);

const basePath = apiBasePath(location);
const isTabActive = (): boolean => document.visibilityState === "visible";
const runner = createFeatureRunner({
  context: {
    basePath,
    client: createAdoClient({
      apiBasePath: basePath,
      fetch: async (url, init) => fetch(url, init),
      origin: location.origin,
    }),
    document,
    isInFrame: globalThis.top !== globalThis.self,
    now: () => Date.now(),
    reloadWhenIdle: () => {
      reloadWhenIdle(document);
    },
  },
  currentPage: () => parsePage(location, basePath),
  features: FEATURES,
  isOn: ({ id }) => GM_getValue(id, IS_ON_BY_DEFAULT),
  isTabActive,
  // Throw again outside the loop, so the browser reports it and the other features run on.
  onError: (_feature, error) => {
    queueMicrotask(() => {
      throw error;
    });
  },
});
const sync = (reason: SyncReason): void => {
  runner.sync(reason);
};

// ADO is a single-page app that re-renders its content. Re-apply after every DOM change.
let settleTimer: ReturnType<typeof setTimeout> | null = null;
new MutationObserver(() => {
  if (settleTimer !== null) {
    clearTimeout(settleTimer);
  }
  settleTimer = setTimeout(sync, DOM_SETTLE_MS, "dom-change");
}).observe(document.body, { childList: true, subtree: true });

setInterval(sync, TIMER_INTERVAL_MS, "timer");
document.addEventListener("visibilitychange", () => {
  if (isTabActive()) {
    sync("tab-shown");
  }
});
sync("dom-change");
