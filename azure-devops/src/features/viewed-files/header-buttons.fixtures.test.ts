import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import { removeHeaderButtons, syncHeaderButtons } from "./header-buttons.ts";
import type { HeaderAction } from "./header-buttons.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test(
  "on the captured Files tab of a large pull request, Expand all and Collapse viewed sit in the title row right before the vote button",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-files-large-pr");
    const clicks: HeaderAction[] = [];
    const onClick = (action: HeaderAction): void => {
      clicks.push(action);
    };
    syncHeaderButtons(document, onClick);
    syncHeaderButtons(document, onClick);
    const vote = document.querySelector(".repos-pr-header-vote-button");
    const box = vote?.previousElementSibling;
    assert.equal(box?.classList.contains("fix-ado-viewed-header-buttons"), true);
    const buttons = [...(box?.querySelectorAll("button") ?? [])];
    assert.deepEqual(
      buttons.map((button) => button.textContent),
      ["Expand all", "Collapse viewed"],
    );
    for (const button of buttons) {
      button.click();
    }
    assert.deepEqual(clicks, ["expand-all", "collapse-viewed"]);
    assert.equal(document.querySelectorAll(".fix-ado-viewed-header-buttons").length, 1);
    removeHeaderButtons(document);
    assert.equal(document.querySelector(".fix-ado-viewed-header-buttons"), null);
  },
);
