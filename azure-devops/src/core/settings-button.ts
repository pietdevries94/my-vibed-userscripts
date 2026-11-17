import { button, element } from "./settings-panel-markup.ts";

const SETTINGS_TITLE = "Fix Azure DevOps settings";
const BUTTON_ITEM_CLASS = "fix-ado-settings-item";
const BADGE_CLASS = "fix-ado-settings-badge";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function svgElement(document: Document, tag: string, attributes: Record<string, string>): Element {
  const created = document.createElementNS(SVG_NAMESPACE, tag);
  for (const [name, value] of Object.entries(attributes)) {
    created.setAttribute(name, value);
  }
  return created;
}

/** A puzzle piece outline: the script's own mark, drawn like the line icons next to it. */
function puzzleIcon(document: Document): Element {
  const svg = svgElement(document, "svg", {
    "aria-hidden": "true",
    class: "fix-ado-settings-icon",
    viewBox: "0 0 16 16",
  });
  svg.append(
    svgElement(document, "path", {
      d: "M1.5 4H4.6A2.1 2.1 0 1 1 8.4 4H11.5V7.35A2.1 2.1 0 1 1 11.5 11.15V14.5H1.5Z",
    }),
  );
  return svg;
}

/** The count of unseen feature changes, on the settings button's corner. */
function unseenCountBadge(document: Document, unseenCount: number): HTMLElement {
  const badge = element(document, "span", { className: BADGE_CLASS, text: String(unseenCount) });
  badge.setAttribute("aria-label", `${unseenCount} new or updated`);
  return badge;
}

/** The top bar item, shaped like Azure DevOps's own icon buttons next to it. */
function createSettingsButtonItem(
  document: Document,
  open: () => void,
  unseenCount: number,
): HTMLElement {
  const item = element(document, "div", { className: `${BUTTON_ITEM_CLASS} flex-row flex-center` });
  item.setAttribute("role", "menuitem");
  const settingsButton = button(
    document,
    {
      className:
        "fix-ado-settings-button bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment",
    },
    open,
  );
  settingsButton.title = SETTINGS_TITLE;
  settingsButton.setAttribute("aria-label", SETTINGS_TITLE);
  settingsButton.append(puzzleIcon(document));
  if (unseenCount > 0) {
    settingsButton.append(unseenCountBadge(document, unseenCount));
  }
  item.append(settingsButton);
  return item;
}

export { BADGE_CLASS, BUTTON_ITEM_CLASS, SETTINGS_TITLE, createSettingsButtonItem };
