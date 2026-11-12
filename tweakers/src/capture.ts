// The Tweakers capture: which pages to capture and what to keep. Dev only.
// The owner reads the keep rules below.
import type { CaptureDefinition, CapturePage } from "../../shared/dev/capture/capture.ts";
import type { ScrubRules } from "../../shared/dev/scrub/rules.ts";

const rules: ScrubRules = {
  keepAttributes: [],
  // The layout's own ids. The homepage feature hides parts by them.
  keepIdPatterns: [
    /^(?:top|menubar|searchbar|categoryBar|layout|contentArea|headlines-start|bottom)$/u,
  ],
  keepJsonPaths: [],
  keepRouteWords: [],
  keepUiWords: [],
  mapUrl: () => null,
};

function capturePage(document: Document, location: Location): CapturePage | null {
  if (location.pathname !== "/") {
    return null;
  }
  return {
    async collect() {
      return { data: null, meta: {} };
    },
    name: "homepage",
    root: document.body,
  };
}

const captureDefinition: CaptureDefinition = {
  page: capturePage,
  rules,
  scriptId: "tweakers",
};

export { captureDefinition };
