import { createWindows98Mode, windows98PageOf } from "./windows-98-mode.ts";
import { JSDOM } from "jsdom";
import type { Page } from "../../core/page.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const at = (pathname: string, search = ""): { pathname: string; search: string } => ({
  pathname,
  search,
});
const OTHER: Page = { kind: "other" };

test("the captured pages get the full look, by kind", () => {
  const pullRequest: Page = {
    kind: "pull-request",
    pullRequest: { project: "harbor", pullRequestId: 7, repository: "api" },
  };
  assert.equal(
    windows98PageOf(pullRequest, at("/org/harbor/_git/api/pullrequest/7")),
    "pull-request",
  );
  assert.equal(
    windows98PageOf({ kind: "board" }, at("/org/harbor/_boards/board/t/a/Stories")),
    "board",
  );
  assert.equal(
    windows98PageOf({ kind: "pull-request-inbox" }, at("/org/_pulls")),
    "pull-request-inbox",
  );
});

test("a work item and a pipeline run get the full look too", () => {
  assert.equal(windows98PageOf(OTHER, at("/org/harbor/_workitems/edit/1001/")), "work-item");
  assert.equal(
    windows98PageOf(OTHER, at("/org/harbor/_build/results", "?buildId=12&view=logs")),
    "pipeline-run",
  );
});

test("any other page gets only the top bar, the side bar and the menus", () => {
  assert.equal(windows98PageOf(OTHER, at("/org/harbor/_wiki/wikis/home")), null);
  assert.equal(windows98PageOf(OTHER, at("/org/harbor/_build/results")), null);
});

const pageWithHeader = (): Document =>
  new JSDOM(
    `<title>Pull requests - Repos</title><div class="project-header"><div class="region-header"></div></div>`,
  ).window.document;

test("marks the page, and which captured page it is", () => {
  const document = pageWithHeader();
  const mode = createWindows98Mode(document);
  mode.sync({ kind: "pull-request-inbox" }, at("/org/_pulls"));
  assert.equal(document.documentElement.dataset.fixAdoWin98, "pull-request-inbox");
  mode.sync(OTHER, at("/org/harbor/_wiki"));
  assert.equal(document.documentElement.dataset.fixAdoWin98, "");
});

test("the top bar shows the page title, and follows it when it changes", () => {
  const document = pageWithHeader();
  const mode = createWindows98Mode(document);
  mode.sync(OTHER, at("/org/_pulls"));
  const header = document.querySelector<HTMLElement>(".project-header");
  assert.equal(header?.dataset.fixAdoWindowTitle, "Pull requests - Repos");
  document.title = "Boards - Boards";
  mode.sync(OTHER, at("/org/_pulls"));
  assert.equal(header?.dataset.fixAdoWindowTitle, "Boards - Boards");
});

test("an organization page's top bar, such as the inbox's, shows the page title too", () => {
  const { document } = new JSDOM(
    `<title>Pull requests</title><div class="top-level-header"><div class="region-header"></div></div>`,
  ).window;
  createWindows98Mode(document).sync({ kind: "pull-request-inbox" }, at("/org/_pulls"));
  const header = document.querySelector<HTMLElement>(".top-level-header");
  assert.equal(header?.dataset.fixAdoWindowTitle, "Pull requests");
});

test("a page without a top bar, such as a run page in a frame, still gets marked", () => {
  const { document } = new JSDOM("<main></main>").window;
  createWindows98Mode(document).sync(OTHER, at("/org/harbor/_build/results", "?buildId=3"));
  assert.equal(document.documentElement.dataset.fixAdoWin98, "pipeline-run");
});
