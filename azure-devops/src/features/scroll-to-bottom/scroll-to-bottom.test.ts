import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createScrollToBottom } from "./scroll-to-bottom.ts";
import { test } from "node:test";

const OVERVIEW = `
  <div class="v-scroll-auto region-content">
    <div class="repos-pr-details-page v-scroll-auto">
      <table class="activity-feed-list"><tbody>
        <tr><td>Marren Tolk created the pull request</td></tr>
        <tr><td>Add a comment</td></tr>
      </tbody></table>
    </div>
  </div>`;

interface Sizes {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}

interface OverviewPage {
  document: Document;
  sync: () => void;
  resizeWindow: () => void;
  button: () => HTMLButtonElement | null;
  isButtonShown: () => boolean;
  /** Gives the element sizes, as jsdom lays nothing out, and records where it is scrolled to. */
  size: (selector: string, sizes: Sizes) => ScrollToOptions[];
  scroll: (selector: string, scrollTop: number) => void;
  /** The Overview loads more content: the element gets taller. */
  grow: (selector: string, scrollHeight: number) => void;
  wait: (milliseconds: number) => void;
  turnWheel: () => void;
}

function existing(document: Document, selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  assert.ok(element !== null, `${selector} is there`);
  return element;
}

function overviewPage(html = OVERVIEW): OverviewPage {
  const { window } = new JSDOM(`<!doctype html><body>${html}</body>`);
  const { document } = window;
  let time = 0;
  const { sync } = createScrollToBottom({ document, now: () => time });
  const button = (): HTMLButtonElement | null =>
    document.querySelector<HTMLButtonElement>(".fix-ado-scroll-to-bottom");
  return {
    button,
    document,
    grow: (selector, scrollHeight) => {
      Object.defineProperty(existing(document, selector), "scrollHeight", {
        configurable: true,
        value: scrollHeight,
      });
    },
    isButtonShown: () => {
      const found = button();
      return found !== null && found.hidden === false;
    },
    resizeWindow: () => {
      window.dispatchEvent(new window.Event("resize"));
    },
    scroll: (selector, scrollTop) => {
      const element = existing(document, selector);
      Object.defineProperty(element, "scrollTop", { configurable: true, value: scrollTop });
      element.dispatchEvent(new window.Event("scroll"));
    },
    size: (selector, sizes) => {
      const scrolledTo: ScrollToOptions[] = [];
      const element = existing(document, selector);
      for (const [name, value] of Object.entries(sizes)) {
        Object.defineProperty(element, name, { configurable: true, value });
      }
      element.scrollTo = (options?: ScrollToOptions | number): void => {
        if (typeof options === "object") {
          scrolledTo.push(options);
        }
      };
      return scrolledTo;
    },
    sync,
    turnWheel: () => {
      document.body.dispatchEvent(new window.Event("wheel", { bubbles: true }));
    },
    wait: (milliseconds) => {
      time += milliseconds;
    },
  };
}

const PAGE = ".repos-pr-details-page";
const TALL: Sizes = { clientHeight: 600, scrollHeight: 2000, scrollTop: 0 };

test("an Overview taller than its window gets one button, also after more syncs", () => {
  const page = overviewPage();
  page.size(PAGE, TALL);
  page.sync();
  page.sync();
  assert.equal(page.document.querySelectorAll(".fix-ado-scroll-to-bottom").length, 1);
  assert.ok(page.isButtonShown());
  assert.equal(page.button()?.title, "Scroll to bottom");
  assert.equal(page.button()?.getAttribute("aria-label"), "Scroll to bottom");
  assert.equal(page.button()?.firstElementChild?.tagName, "svg");
});

test("the button scrolls the Overview to its bottom", () => {
  const page = overviewPage();
  const scrolledTo = page.size(PAGE, TALL);
  page.sync();
  page.button()?.click();
  assert.deepEqual(scrolledTo, [{ behavior: "smooth", top: 2000 }]);
});

test("content that loads after the click is scrolled to as well", () => {
  const page = overviewPage();
  const scrolledTo = page.size(PAGE, TALL);
  page.sync();
  page.button()?.click();
  page.scroll(PAGE, 1400);
  page.grow(PAGE, 3000);
  page.sync();
  page.sync();
  assert.deepEqual(scrolledTo, [
    { behavior: "smooth", top: 2000 },
    { behavior: "smooth", top: 3000 },
  ]);
});

test("content that loads without a click scrolls nothing", () => {
  const page = overviewPage();
  const scrolledTo = page.size(PAGE, TALL);
  page.sync();
  page.grow(PAGE, 3000);
  page.sync();
  assert.deepEqual(scrolledTo, []);
});

test("the owner scrolling by hand after the click ends the follow", () => {
  const page = overviewPage();
  const scrolledTo = page.size(PAGE, TALL);
  page.sync();
  page.button()?.click();
  page.turnWheel();
  page.grow(PAGE, 3000);
  page.sync();
  assert.equal(scrolledTo.length, 1);
});

test("content that loads long after the scroll ended scrolls nothing", () => {
  const page = overviewPage();
  const scrolledTo = page.size(PAGE, TALL);
  page.sync();
  page.button()?.click();
  page.wait(1500);
  page.scroll(PAGE, 1400);
  page.wait(2500);
  page.grow(PAGE, 3000);
  page.sync();
  page.wait(100);
  page.grow(PAGE, 3500);
  page.sync();
  assert.equal(scrolledTo.length, 1);
});

test("the follow lasts while the scroll itself takes long", () => {
  const page = overviewPage();
  const scrolledTo = page.size(PAGE, TALL);
  page.sync();
  page.button()?.click();
  page.wait(1500);
  page.scroll(PAGE, 700);
  page.wait(1500);
  page.grow(PAGE, 3000);
  page.sync();
  assert.equal(scrolledTo.length, 2);
});

test("the button hides at the bottom, and comes back after scrolling up", () => {
  const page = overviewPage();
  page.size(PAGE, TALL);
  page.sync();
  page.scroll(PAGE, 1400);
  assert.ok(!page.isButtonShown());
  page.scroll(PAGE, 900);
  assert.ok(page.isButtonShown());
});

test("the button shows when the window shrinks and the Overview no longer fits", () => {
  const page = overviewPage();
  page.size(PAGE, { clientHeight: 2000, scrollHeight: 2000, scrollTop: 0 });
  page.sync();
  assert.ok(!page.isButtonShown());
  page.size(PAGE, TALL);
  page.resizeWindow();
  assert.ok(page.isButtonShown());
});

test("the button hides a few pixels above the bottom too", () => {
  const page = overviewPage();
  page.size(PAGE, { ...TALL, scrollTop: 1390 });
  page.sync();
  assert.ok(!page.isButtonShown());
});

test("an Overview that fits its window gets no button", () => {
  const page = overviewPage();
  page.size(PAGE, { clientHeight: 600, scrollHeight: 600, scrollTop: 0 });
  page.sync();
  assert.ok(!page.isButtonShown());
});

test("the button follows the box that scrolls, when it is not the nearest one", () => {
  const page = overviewPage();
  page.size(PAGE, { clientHeight: 2000, scrollHeight: 2000, scrollTop: 0 });
  const scrolledTo = page.size(".region-content", TALL);
  page.sync();
  assert.ok(page.isButtonShown());
  page.button()?.click();
  assert.deepEqual(scrolledTo, [{ behavior: "smooth", top: 2000 }]);
});

test("the button hides when the Overview goes, such as on the Files tab", () => {
  const page = overviewPage();
  page.size(PAGE, TALL);
  page.sync();
  page.document.querySelector(".activity-feed-list")?.remove();
  page.sync();
  assert.ok(!page.isButtonShown());
});

test("a page without an Overview gets no button", () => {
  const page = overviewPage(`<div class="v-scroll-auto"><div class="repos-changes"></div></div>`);
  page.sync();
  assert.equal(page.button(), null);
});

test("with reduced motion the button jumps to the bottom", () => {
  const page = overviewPage();
  const scrolledTo = page.size(PAGE, TALL);
  const view = page.document.defaultView;
  assert.ok(view !== null);
  Object.defineProperty(view, "matchMedia", {
    value: (query: string) => ({ matches: query === "(prefers-reduced-motion: reduce)" }),
  });
  page.sync();
  page.button()?.click();
  assert.deepEqual(scrolledTo, [{ behavior: "instant", top: 2000 }]);
});

test("at the bottom, a focused button stays until focus leaves it", () => {
  const page = overviewPage();
  page.size(PAGE, TALL);
  page.sync();
  page.button()?.focus();
  page.button()?.click();
  page.scroll(PAGE, 1400);
  assert.deepEqual([page.isButtonShown(), page.document.activeElement], [true, page.button()]);
  page.button()?.blur();
  assert.equal(page.isButtonShown(), false);
});
