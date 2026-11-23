import {
  fixtures,
  loadCapturedPullRequest,
} from "../../pull-requests/captured-pull-request.test-page.ts";
import { removeToolbarButtons, syncToolbarButtons } from "./toolbar-buttons.ts";
import type { ToolbarAction } from "./toolbar-buttons.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test(
  "on the captured Files tab of a large pull request, Expand all and Collapse viewed sit in the toolbar right after the Filter button",
  { skip: fixtures.skip },
  () => {
    const { document } = loadCapturedPullRequest("pr-files-large-pr");
    const clicks: ToolbarAction[] = [];
    const onClick = (action: ToolbarAction): void => {
      clicks.push(action);
    };
    syncToolbarButtons(document, onClick);
    syncToolbarButtons(document, onClick);
    const filter = document.querySelector(".repos-compare-filter");
    const box = filter?.nextElementSibling;
    assert.equal(box?.classList.contains("fix-ado-viewed-toolbar-buttons"), true);
    const buttons = [...(box?.querySelectorAll("button") ?? [])];
    assert.deepEqual(
      buttons.map((button) => button.textContent),
      ["Expand all", "Collapse viewed"],
    );
    for (const button of buttons) {
      button.click();
    }
    assert.deepEqual(clicks, ["expand-all", "collapse-viewed"]);
    assert.equal(document.querySelectorAll(".fix-ado-viewed-toolbar-buttons").length, 1);
    removeToolbarButtons(document);
    assert.equal(document.querySelector(".fix-ado-viewed-toolbar-buttons"), null);
  },
);
