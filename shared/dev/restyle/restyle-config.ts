// What a script's restyle checks: its states with their artboards, its failure-count checks and
// the pages its audit opens. Each script with a restyle exports one from <script>/restyle/states.ts.
// Dev file only.
import type { Page } from "playwright";

interface Clip {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A fake-site page with a capture shown. */
interface FakeSitePage {
  /** The fake site's page name, as /__dev/show-capture takes it. */
  page: string;
  /** The capture's name without the page, such as "win98-active". */
  capture: string;
  /** The URL path that opens the page. */
  path: string;
}

/** A visible state, diffed against its artboard. */
interface DiffState extends FakeSitePage {
  name: string;
  /** The artboard's file name without .dc.html. */
  artboard: string;
  /** 1280 by 800 when not set. */
  viewport?: { width: number; height: number };
  /** Only this part of the window, in both screenshots. */
  clip?: Clip;
  /** Script that runs on the fake site before the page's own, such as stored values to seed. */
  init?: string;
  /** More CSS for the site's screenshot, on top of the config's site mask. */
  mask?: string;
  /** Reaches the state after the page has loaded, such as a hover or an invented element. */
  act?: (page: Page) => Promise<void>;
}

/** A check that counts what is wrong rather than comparing pixels. Zero failures pass. */
interface FailureCheck {
  name: string;
  failures: (page: Page, fakeSiteOrigin: string) => Promise<string[]>;
}

interface RestyleConfig {
  /** The feature settings every page starts with, by storage key, such as the mode turned on. */
  settings: Record<string, unknown>;
  /** CSS that hides what differs by nature in each screenshot, such as font icons. */
  masks: { design: string; site: string };
  states: DiffState[];
  checks: FailureCheck[];
  /** The pages the audit opens. */
  auditPages: (FakeSitePage & { name: string })[];
}

export type { Clip, DiffState, FailureCheck, FakeSitePage, RestyleConfig };
