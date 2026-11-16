import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import assert from "node:assert/strict";
import { createActivityOrder } from "./activity-order.ts";
import { test } from "node:test";

test(
  "the captured Overview gets one sort button before its filters, and runs oldest first",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail");
    const saved: string[] = [];
    const { sync } = createActivityOrder({
      document,
      storage: {
        load: () => null,
        save: (order) => {
          saved.push(order);
        },
      },
    });
    sync();
    sync();

    const buttons = document.querySelectorAll(".fix-ado-activity-order");
    assert.equal(buttons.length, 1);
    const [button] = buttons;
    assert.ok(button?.parentElement?.querySelector(".repos-activity-filter-dropdown") !== null);
    assert.equal(button?.previousElementSibling, null);

    const feeds = document.querySelectorAll<HTMLElement>("[data-fix-ado-activity-order]");
    assert.equal(feeds.length, 1);
    assert.equal(feeds[0]?.dataset.fixAdoActivityOrder, "oldest-first");
    assert.deepEqual(saved, [], "showing the default order saves nothing");
    assert.ok(feeds[0]?.querySelector(":scope > tbody > .bolt-timeline-first-row") !== null);
    assert.ok(feeds[0]?.querySelector(":scope > tbody > .bolt-timeline-last-row") !== null);
  },
);
