import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import assert from "node:assert/strict";
import { createScrollToBottom } from "./scroll-to-bottom.ts";
import { test } from "node:test";

test(
  "the captured Overview, taller than its window, gets one button that scrolls its page",
  { skip: fixtures.skipWithout("pr-detail.html") },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail");
    const page = document.querySelector<HTMLElement>(".repos-pr-details-page");
    assert.ok(page !== null);
    assert.ok(page.contains(document.querySelector(".activity-feed-list")));
    // The sizes are invented: jsdom lays nothing out.
    Object.defineProperty(page, "clientHeight", { value: 600 });
    Object.defineProperty(page, "scrollHeight", { value: 2000 });
    const scrolledTo: (number | undefined)[] = [];
    page.scrollTo = (options?: ScrollToOptions | number): void => {
      scrolledTo.push(typeof options === "object" ? options.top : options);
    };
    const { sync } = createScrollToBottom({ document, now: () => 0 });
    sync();
    sync();

    const buttons = document.querySelectorAll<HTMLButtonElement>(".fix-ado-scroll-to-bottom");
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0]?.hidden, false);
    buttons[0]?.click();
    assert.deepEqual(scrolledTo, [2000]);
  },
);
