import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import assert from "node:assert/strict";
import { createFoldedPushes } from "./folded-pushes.ts";
import { test } from "node:test";

test(
  "the captured Overview folds both pushes, and only the one with commits gets a toggle",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-detail");
    const { sync } = createFoldedPushes({ document });
    sync();
    sync();

    const pushes = [...document.querySelectorAll<HTMLElement>("[data-fix-ado-push]")];
    assert.deepEqual(
      pushes.map((push) => [
        push.dataset.fixAdoPush,
        push.classList.contains("bolt-card"),
        push.querySelector(".iteration-commits-table") !== null,
        push.querySelectorAll(".fix-ado-push-toggle").length,
      ]),
      [
        ["folded", true, false, 0],
        ["folded", true, true, 1],
      ],
    );

    const toggle = document.querySelector<HTMLElement>(".fix-ado-push-toggle");
    assert.ok(toggle?.closest(".iteration-header") !== null);
    assert.ok(toggle?.previousElementSibling?.classList.contains("font-weight-semibold") === true);
    assert.ok(toggle?.nextElementSibling?.querySelector("time") !== null);
    toggle?.click();
    assert.deepEqual(
      pushes.map((push) => push.dataset.fixAdoPush),
      ["folded", "open"],
    );
  },
);
