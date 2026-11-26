import type { Page } from "../../core/page.ts";
import { parsePipelineRunLocation } from "../../pipeline/pipeline-run-link.ts";

/**
 * A page with captures, which gets the full Windows 98 look. Every other page gets it
 * only on the top bar, the side bar, menus and dialogs, since its markup is unknown.
 */
type Windows98Page =
  | "board"
  | "pipeline-run"
  | "pull-request"
  | "pull-request-create"
  | "pull-request-inbox"
  | "pull-request-list"
  | "work-item";

const WORK_ITEM_PATH = /\/_workitems\/edit\/\d+\/?$/u;
/** A project page's top bar, or an organization page's, such as the pull request inbox. */
const TOP_BAR_SELECTOR = ".project-header, .top-level-header";

function windows98PageOf(
  page: Page,
  location: { pathname: string; search: string },
): Windows98Page | null {
  if (page.kind !== "other") {
    return page.kind;
  }
  if (parsePipelineRunLocation(location)) {
    return "pipeline-run";
  }
  return WORK_ITEM_PATH.test(location.pathname) ? "work-item" : null;
}

/** The start of the body classes Azure DevOps sets per theme, such as `ms-vss-web-vsts-theme-dark`. */
const THEME_CLASS_PREFIX = "ms-vss-web-vsts-theme";
const DARK_SUFFIX = "-dark";

/** True while Azure DevOps shows Dark: it marks the body with the theme's id, or its class. */
function isDarkTheme(body: HTMLElement): boolean {
  const { theme } = body.dataset;
  if (theme !== undefined) {
    return theme.endsWith(DARK_SUFFIX);
  }
  return [...body.classList].some(
    (name) => name.startsWith(THEME_CLASS_PREFIX) && name.endsWith(DARK_SUFFIX),
  );
}

/** Marks `<html>` with the dark scheme while Azure DevOps shows Dark, for the tokens. */
function showScheme(document: Document): void {
  const isDark = document.body !== null && isDarkTheme(document.body);
  const root = document.documentElement;
  if ((root.dataset.win98Scheme === "dark") !== isDark) {
    if (isDark) {
      root.dataset.win98Scheme = "dark";
    } else {
      delete root.dataset.win98Scheme;
    }
  }
}

interface Windows98Mode {
  sync: (page: Page, location: { pathname: string; search: string }) => void;
}

/**
 * Marks `<html>` with the captured page it shows, empty on any other page, and with the dark
 * scheme while Azure DevOps shows Dark, for the stylesheet. Copies the page title to the top
 * bar, which shows it in its title bar.
 */
function createWindows98Mode(document: Document): Windows98Mode {
  const root = document.documentElement;
  return {
    sync(page, location) {
      const windows98Page = windows98PageOf(page, location) ?? "";
      if (root.dataset.fixAdoWin98 !== windows98Page) {
        root.dataset.fixAdoWin98 = windows98Page;
      }
      showScheme(document);
      const topBar = document.querySelector<HTMLElement>(TOP_BAR_SELECTOR);
      if (topBar && topBar.dataset.fixAdoWindowTitle !== document.title) {
        topBar.dataset.fixAdoWindowTitle = document.title;
      }
    },
  };
}

export type { Windows98Page };
export { createWindows98Mode, showScheme, windows98PageOf };
