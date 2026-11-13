import {
  FAILED_PAGE_CHECK_RETRY_MS,
  PAGE_CHECK_INTERVAL_MS,
  createPageReloader,
} from "./page-reloader.ts";
import type { PageReloader, WatchedPage } from "./page-reloader.ts";
import { AdoRequestError } from "../../core/ado-client.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

interface FakeBrowser {
  clock: number;
  failWith: Error | null;
  fetchedKeys: string[];
  isTabActive: boolean;
  pageKey: string | null;
  reloadCount: number;
  retryAfterSeconds: number | null;
  serverContent: string;
}

function reloaderOnFakeBrowser(): { browser: FakeBrowser; reloader: PageReloader } {
  const browser: FakeBrowser = {
    clock: 0,
    failWith: null,
    fetchedKeys: [],
    isTabActive: true,
    pageKey: "page-a",
    reloadCount: 0,
    retryAfterSeconds: null,
    serverContent: "original",
  };
  const pageWithKey = (key: string): WatchedPage<string> => ({
    async fetchSnapshot() {
      browser.fetchedKeys.push(key);
      if (browser.failWith) {
        throw browser.failWith;
      }
      return { retryAfterSeconds: browser.retryAfterSeconds, snapshot: browser.serverContent };
    },
    hasChanged: (loaded, current) => loaded !== current,
    key,
  });
  const reloader = createPageReloader({
    currentPage: () => (browser.pageKey === null ? null : pageWithKey(browser.pageKey)),
    isTabActive: () => browser.isTabActive,
    now: () => browser.clock,
    reload: () => {
      browser.reloadCount += 1;
    },
  });
  return { browser, reloader };
}

test("the first check records the page and does not reload", async () => {
  const { browser, reloader } = reloaderOnFakeBrowser();
  await reloader.check();
  assert.deepEqual(browser.fetchedKeys, ["page-a"]);
  assert.equal(browser.reloadCount, 0);
});

test("reloads when the page changed at the next check", async () => {
  const { browser, reloader } = reloaderOnFakeBrowser();
  await reloader.check();
  browser.serverContent = "changed";

  browser.clock = PAGE_CHECK_INTERVAL_MS - 1;
  await reloader.check();
  assert.equal(browser.fetchedKeys.length, 1, "waits for the interval");

  browser.clock = PAGE_CHECK_INTERVAL_MS;
  await reloader.check();
  assert.equal(browser.reloadCount, 1);
});

test("does not reload when nothing changed", async () => {
  const { browser, reloader } = reloaderOnFakeBrowser();
  await reloader.check();
  browser.clock = PAGE_CHECK_INTERVAL_MS;
  await reloader.check();
  assert.equal(browser.fetchedKeys.length, 2);
  assert.equal(browser.reloadCount, 0);
});

test("does not check while the tab is inactive", async () => {
  const { browser, reloader } = reloaderOnFakeBrowser();
  await reloader.check();
  browser.serverContent = "changed";
  browser.isTabActive = false;
  browser.clock = 10 * PAGE_CHECK_INTERVAL_MS;
  await reloader.check();
  await reloader.check({ immediately: true });
  assert.equal(browser.fetchedKeys.length, 1);
  assert.equal(browser.reloadCount, 0);
});

test("checks right away when the tab becomes active", async () => {
  const { browser, reloader } = reloaderOnFakeBrowser();
  await reloader.check();
  browser.serverContent = "changed";
  browser.clock = 1;
  await reloader.check({ immediately: true });
  assert.equal(browser.reloadCount, 1);
});

test("records a page that loaded in an inactive tab", async () => {
  const { browser, reloader } = reloaderOnFakeBrowser();
  browser.isTabActive = false;
  await reloader.check();
  assert.equal(browser.fetchedKeys.length, 1);

  browser.serverContent = "changed";
  browser.isTabActive = true;
  await reloader.check({ immediately: true });
  assert.equal(browser.reloadCount, 1);
});

test("does nothing on pages that are not watched", async () => {
  const { browser, reloader } = reloaderOnFakeBrowser();
  browser.pageKey = null;
  await reloader.check({ immediately: true });
  assert.equal(browser.fetchedKeys.length, 0);
});

test("each page has its own record", async () => {
  const { browser, reloader } = reloaderOnFakeBrowser();
  await reloader.check();
  browser.pageKey = "page-b";
  browser.serverContent = "content of b";
  await reloader.check({ immediately: true });
  assert.deepEqual(browser.fetchedKeys, ["page-a", "page-b"]);
  assert.equal(browser.reloadCount, 0, "another page is not a change");
});

test("a page left and revisited is compared with its first load", async () => {
  const { browser, reloader } = reloaderOnFakeBrowser();
  await reloader.check();
  browser.pageKey = null;
  await reloader.check();
  browser.serverContent = "changed";
  browser.pageKey = "page-a";
  await reloader.check({ immediately: true });
  assert.equal(browser.reloadCount, 1);
});

test("a failed check is retried later and does not reload", async () => {
  const { browser, reloader } = reloaderOnFakeBrowser();
  await reloader.check();
  browser.failWith = new AdoRequestError(500, null);
  browser.clock = PAGE_CHECK_INTERVAL_MS;
  await reloader.check();
  assert.equal(browser.reloadCount, 0);

  browser.failWith = null;
  browser.serverContent = "changed";
  browser.clock += FAILED_PAGE_CHECK_RETRY_MS - 1;
  await reloader.check();
  assert.equal(browser.fetchedKeys.length, 2);
  browser.clock += 1;
  await reloader.check();
  assert.equal(browser.reloadCount, 1);
});

test("Retry-After pauses checks, also immediate ones", async () => {
  const { browser, reloader } = reloaderOnFakeBrowser();
  browser.retryAfterSeconds = 120;
  await reloader.check();
  browser.clock = 119_999;
  await reloader.check({ immediately: true });
  assert.equal(browser.fetchedKeys.length, 1);
  browser.clock = 120_000;
  await reloader.check({ immediately: true });
  assert.equal(browser.fetchedKeys.length, 2);
});

test("overlapping checks send one request", async () => {
  const { browser, reloader } = reloaderOnFakeBrowser();
  await Promise.all([reloader.check(), reloader.check({ immediately: true })]);
  assert.equal(browser.fetchedKeys.length, 1);
});

test("a page can extend its record with items that appeared later", async () => {
  let serverItems = ["a"];
  let reloadCount = 0;
  let clock = 0;
  const page: WatchedPage<string[]> = {
    extendLoaded: (loaded, current) => [...new Set([...loaded, ...current])],
    fetchSnapshot: async () => ({ retryAfterSeconds: null, snapshot: serverItems }),
    hasChanged: (loaded, current) => loaded.some((item) => !current.includes(item)),
    key: "growing-page",
  };
  const reloader = createPageReloader({
    currentPage: () => page,
    isTabActive: () => true,
    now: () => clock,
    reload: () => {
      reloadCount += 1;
    },
  });

  await reloader.check();
  serverItems = ["a", "b"];
  clock += PAGE_CHECK_INTERVAL_MS;
  await reloader.check();
  assert.equal(reloadCount, 0, "a new item is not a change for this page");

  serverItems = ["a"];
  clock += PAGE_CHECK_INTERVAL_MS;
  await reloader.check();
  assert.equal(reloadCount, 1, "but b is in the record now, so losing it is a change");
});
