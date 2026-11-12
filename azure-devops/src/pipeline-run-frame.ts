// The pipeline run page inside the pull request's Pipeline tab. The tab lists the
// stages and steps itself, so style.css hides the run page's own tree and the site
// chrome, by the attribute set here. Only the step's log is left.
import { parsePipelineRunLocation } from "./pipeline-run-link.ts";

interface PipelineRunFrame {
  /** Marks the page again, in case Azure DevOps replaced the attribute. */
  sync: () => void;
}

/** The frame's run page, or null when the frame shows another page. */
function createPipelineRunFrame(document: Document): PipelineRunFrame | null {
  if (parsePipelineRunLocation(document.location) === null) {
    return null;
  }
  return {
    sync: () => {
      document.documentElement.dataset.fixAdoRunFrame = "";
    },
  };
}

export type { PipelineRunFrame };
export { createPipelineRunFrame };
