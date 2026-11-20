// The run page on one of its tabs, inside a pull request's run page tab. style.css hides
// everything but the tab's content, by the attribute set here. A run page without the
// tab tells the frame element, once its tab bar has loaded.
import { parsePipelineRunLocation, pipelineRunTabOf } from "../../pipeline/pipeline-run-link.ts";
import { closestElement } from "../../core/closest-element.ts";
import { runTabViewsIn } from "./run-tab-store.ts";

/** The frame element around the page, as far as this module uses it. */
interface FrameElement {
  dataset: DOMStringMap;
}

interface RunTabFrame {
  /** Marks the page again, in case Azure DevOps replaced the attribute. */
  sync: () => void;
}

/** Only frames with this class show a run page tab; the Pipeline tab's frame shows logs. */
const RUN_TAB_FRAME_CLASS = "fix-ado-run-tab-frame";
/** A link in a tab's content, such as a card's link to a deployment. */
const TAB_CONTENT_LINK_SELECTOR = ".run-details-tab-content a[href]";

/**
 * The frame element around the page, when it is a run page tab's frame. It belongs to
 * the pull request page's window, so an `instanceof` check against this page's classes
 * would fail.
 */
function frameElementOf(document: Document): FrameElement | null {
  const element = document.defaultView?.frameElement ?? null;
  return element?.classList.contains(RUN_TAB_FRAME_CLASS) === true && "dataset" in element
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- an HTML element of the parent window
      (element as unknown as FrameElement)
    : null;
}

/** Tells the frame element whether the tab is missing, once the tab bar has loaded. */
function reportMissingTab(document: Document, frame: FrameElement, view: string): void {
  const views = runTabViewsIn(document);
  if (views.length === 0) {
    return;
  }
  const isMissing = !views.includes(view);
  if (isMissing && frame.dataset.fixAdoMissingTab !== view) {
    frame.dataset.fixAdoMissingTab = view;
  } else if (!isMissing && frame.dataset.fixAdoMissingTab !== undefined) {
    delete frame.dataset.fixAdoMissingTab;
  }
}

/** Links in a tab's content open in a new browser tab, so the pull request stays. */
function openTabLinksApart(document: Document): void {
  document.addEventListener(
    "click",
    (event) => {
      const link = closestElement(event.target, TAB_CONTENT_LINK_SELECTOR);
      link?.setAttribute("target", "_blank");
      link?.setAttribute("rel", "noopener");
    },
    { capture: true },
  );
}

/** The frame's run page tab, or null when this is not a run page tab's frame. */
function createRunTabFrame(
  document: Document,
  frame: FrameElement | null = frameElementOf(document),
): RunTabFrame | null {
  const view = pipelineRunTabOf(document.location);
  if (frame === null || view === null || parsePipelineRunLocation(document.location) === null) {
    return null;
  }
  openTabLinksApart(document);
  return {
    sync: () => {
      document.documentElement.dataset.fixAdoRunTabFrame = "";
      reportMissingTab(document, frame, view);
    },
  };
}

export { RUN_TAB_FRAME_CLASS, createRunTabFrame };
