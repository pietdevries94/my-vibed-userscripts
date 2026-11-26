import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createOrganizationPanel } from "./organization-panel.ts";
import { test } from "node:test";

const PANEL = `
  <div class="top-level-navigation region-navigation expanded" role="navigation">
    <div class="top-level-section"></div>
    <div class="navigation-footer"><a class="action-link" href="/settings">Settings</a></div>
  </div>`;

interface TestPage {
  document: Document;
  saved: boolean[];
  panel: ReturnType<typeof createOrganizationPanel>;
  toggle: () => HTMLButtonElement | null;
  isMarkedCollapsed: () => boolean;
}

function pageWith(body: string, isCollapsed = false): TestPage {
  const { document } = new JSDOM(`<!doctype html><body>${body}</body>`).window;
  const saved: boolean[] = [];
  return {
    document,
    isMarkedCollapsed: () =>
      document.documentElement.dataset.fixAdoOrganizationPanelCollapsed !== undefined,
    panel: createOrganizationPanel({
      document,
      load: () => isCollapsed,
      save: (value) => {
        saved.push(value);
      },
    }),
    saved,
    toggle: () => document.querySelector(".navigation-footer button"),
  };
}

test("the organization panel gets one collapse button, last in its footer", () => {
  const page = pageWith(PANEL);
  page.panel.sync();
  page.panel.sync();
  const footer = page.document.querySelector(".navigation-footer");
  assert.equal(footer?.querySelectorAll("button").length, 1);
  assert.equal(footer?.lastElementChild, page.toggle());
  assert.equal(page.toggle()?.type, "button");
  assert.equal(page.toggle()?.getAttribute("aria-label"), "Collapse side panel");
  assert.equal(page.toggle()?.getAttribute("aria-expanded"), "true");
  assert.equal(page.isMarkedCollapsed(), false);
});

test("the button collapses the panel and stores it; again expands it", () => {
  const page = pageWith(PANEL);
  page.panel.sync();
  page.toggle()?.click();
  assert.equal(page.isMarkedCollapsed(), true);
  assert.equal(page.toggle()?.getAttribute("aria-label"), "Expand side panel");
  assert.equal(page.toggle()?.getAttribute("aria-expanded"), "false");
  page.toggle()?.click();
  assert.equal(page.isMarkedCollapsed(), false);
  assert.deepEqual(page.saved, [true, false]);
});

test("a stored collapse shows at once, before the panel is there", () => {
  const page = pageWith("<main></main>", true);
  page.panel.sync();
  assert.equal(page.isMarkedCollapsed(), true);
  page.document.body.insertAdjacentHTML("beforeend", PANEL);
  page.panel.sync();
  assert.equal(page.toggle()?.getAttribute("aria-label"), "Expand side panel");
});

test("a project's side panel gets no button", () => {
  const page = pageWith(`
    <div class="project-navigation region-navigation expanded">
      <div class="navigation-footer"></div>
    </div>`);
  page.panel.sync();
  assert.equal(page.toggle(), null);
});
