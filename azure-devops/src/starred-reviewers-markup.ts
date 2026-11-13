// The elements of starred reviewers. They copy Azure DevOps's own markup for reviewer
// rows, split buttons, menus and the "nothing here" well, so its styles apply.
import type { Identity } from "./reviewer-requests.ts";
import { wrapIn } from "./pipeline-issue-list.ts";

const STARRED_SECTION_CLASS = "fix-ado-starred-reviewers";
const STAR_BUTTON_CLASS = "fix-ado-star";
const STAR_PATH =
  "M8 1.6l1.95 4.02 4.43.58-3.24 3.07.82 4.4L8 11.53l-3.96 2.14.82-4.4L1.62 6.2l4.43-.58z";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

interface ElementOptions {
  className?: string;
  text?: string;
  attributes?: Record<string, string>;
  children?: Node[];
}

function element(
  document: Document,
  tag: string,
  { className, text, attributes = {}, children = [] }: ElementOptions = {},
): HTMLElement {
  const created = document.createElement(tag);
  if (className !== undefined) {
    created.className = className;
  }
  if (text !== undefined) {
    created.textContent = text;
  }
  for (const [name, value] of Object.entries(attributes)) {
    created.setAttribute(name, value);
  }
  created.append(...children);
  return created;
}

/** An Azure DevOps font icon, such as "Add" or "ChevronDownMed". */
function fontIcon(document: Document, name: string, size: "small" | "medium"): HTMLElement {
  return element(document, "span", {
    children: [
      element(document, "span", {
        attributes: { "aria-hidden": "true" },
        className: `left-icon flex-noshrink fabric-icon ms-Icon--${name} ${size}`,
      }),
    ],
    className: "fluent-icons-enabled",
  });
}

function starIcon(document: Document): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("d", STAR_PATH);
  svg.append(path);
  return svg;
}

/** The star on a reviewer row. Filled when the reviewer is starred. */
function createStarButton(document: Document): HTMLButtonElement {
  const button = element(document, "button", {
    attributes: { "aria-pressed": "false", type: "button" },
    children: [starIcon(document)],
    className: `${STAR_BUTTON_CLASS} bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment`,
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- created as a button above
  return button as HTMLButtonElement;
}

function updateStarButton(button: Element, isStarred: boolean): void {
  if (button.getAttribute("aria-pressed") !== String(isStarred)) {
    button.setAttribute("aria-pressed", String(isStarred));
    button.setAttribute("aria-label", isStarred ? "Remove from starred" : "Add to starred");
    button.setAttribute("title", isStarred ? "Remove from starred" : "Add to starred");
  }
}

/** The address under a person's name, or "Group". */
function detailOf(identity: Identity): string {
  return identity.isGroup ? "Group" : identity.signInAddress;
}

/** The arrow of the + button, which opens "Add as required reviewer". */
function createMenuArrow(document: Document): HTMLElement {
  return element(document, "button", {
    attributes: {
      "aria-expanded": "false",
      "aria-haspopup": "true",
      "aria-label": "More ways to add",
      "data-fix-ado-add": "menu",
      type: "button",
    },
    children: [fontIcon(document, "ChevronDownMed", "small")],
    className:
      "bolt-split-button-option flex-self-stretch body-s bolt-button bolt-icon-button enabled icon-only bolt-focus-treatment",
  });
}

/** The name and, under it, the address or "Group". */
function createNameColumn(document: Document, identity: Identity): HTMLElement {
  const name = element(document, "div", {
    className: "body-m flex-grow text-ellipsis",
    text: identity.displayName,
  });
  const detail = element(document, "div", {
    className: "fix-ado-starred-detail body-s secondary-text text-ellipsis",
    text: detailOf(identity),
  });
  return element(document, "div", {
    children: [name, detail],
    className: "flex-column flex-grow text-ellipsis icon-large-margin",
  });
}

/** The + button that adds the reviewer as optional, and its arrow for "Add as required". */
function createAddSplitButton(document: Document, identity: Identity): HTMLElement {
  return element(document, "div", {
    children: [
      element(document, "button", {
        attributes: {
          "aria-label": `Add ${identity.displayName} as optional reviewer`,
          "data-fix-ado-add": "optional",
          title: "Add as optional reviewer",
          type: "button",
        },
        children: [fontIcon(document, "Add", "small")],
        className:
          "bolt-split-button-main bolt-button bolt-icon-button enabled icon-only bolt-focus-treatment",
      }),
      element(document, "div", { className: "bolt-split-button-divider flex-noshrink" }),
      element(document, "div", {
        children: [createMenuArrow(document)],
        className: "inline-flex-row",
      }),
    ],
    className:
      "fix-ado-add-reviewer bolt-split-button inline-flex-row flex-noshrink icon-large-margin",
  });
}

function createAvatar(document: Document, identity: Identity, imageUrl: string): HTMLElement {
  return element(document, "div", {
    children: [
      element(document, "div", {
        attributes: { "aria-label": identity.displayName },
        children: [
          element(document, "img", {
            attributes: { alt: "", src: imageUrl },
            className: "bolt-coin-content using-image size24",
          }),
        ],
        className: "bolt-coin flex-noshrink icon-large-margin size24",
      }),
    ],
  });
}

/** A starred reviewer who is not on the pull request yet, as Azure DevOps's reviewer row. */
function createStarredRow(document: Document, identity: Identity, imageUrl: string): HTMLElement {
  const star = createStarButton(document);
  updateStarButton(star, true);
  return element(document, "div", {
    attributes: { "data-fix-ado-identity": identity.id },
    children: [
      createAddSplitButton(document, identity),
      createAvatar(document, identity, imageUrl),
      createNameColumn(document, identity),
      star,
    ],
    className: "repos-reviewer flex-row flex-center fix-ado-starred-reviewer",
  });
}

const EMPTY_TEXT =
  "Put people/groups here you often add as pull requests, to add them more easily as optional reviewer";

/** Azure DevOps's "no reviewers" well, with what starring is for. */
function createEmptyWell(document: Document): HTMLElement {
  return element(document, "div", {
    className: "repos-pr-no-items-well fix-ado-starred-empty",
    text: EMPTY_TEXT,
  });
}

function createStarSomeoneButton(document: Document): HTMLElement {
  return element(document, "button", {
    attributes: { type: "button" },
    children: [
      fontIcon(document, "Add", "small"),
      element(document, "span", {
        className: "bolt-button-text body-s",
        text: "Add person/group to starred",
      }),
    ],
    className: "fix-ado-star-someone bolt-button subtle enabled bolt-focus-treatment",
  });
}

/** The section under Optional: its heading and an empty list, which the caller fills. */
function createStarredSection(document: Document): HTMLElement {
  return element(document, "div", {
    children: [
      element(document, "div", {
        className: "margin-bottom-8 body-s secondary-text font-weight-semibold",
        text: "Add starred as reviewer",
      }),
      element(document, "div", { className: "fix-ado-starred-list flex-column" }),
      createStarSomeoneButton(document),
    ],
    className: `flex-grow flex-column ${STARRED_SECTION_CLASS}`,
  });
}

function menuCell(document: Document, content?: HTMLElement): HTMLElement {
  return element(document, "td", {
    children: content === undefined ? [] : [content],
    className: "bolt-menuitem-cell bolt-list-cell",
  });
}

function createMenuItem(document: Document, itemText: string): HTMLElement {
  const emptyContent = (): HTMLElement =>
    element(document, "div", { className: "bolt-menuitem-cell-content flex-row" });
  const text = element(document, "div", {
    className: "bolt-menuitem-cell-content bolt-menuitem-cell-text flex-row",
    text: itemText,
  });
  return element(document, "tr", {
    attributes: { role: "menuitem", tabindex: "0" },
    children: [
      menuCell(document, emptyContent()),
      menuCell(document),
      menuCell(document),
      menuCell(document, text),
      menuCell(document),
      menuCell(document),
      menuCell(document, emptyContent()),
    ],
    className: "bolt-menuitem-row bolt-list-row bolt-menuitem-row-normal cursor-pointer",
  });
}

/** A one-item menu, as Azure DevOps's contextual menus look. */
function createMenu(
  document: Document,
  itemText: string,
): { menu: HTMLElement; item: HTMLElement } {
  const item = createMenuItem(document, itemText);
  const body = element(document, "tbody", { children: [item], className: "relative" });
  const table = element(document, "table", {
    attributes: { role: "menu" },
    children: [body],
    className: "bolt-menu bolt-list body-m relative scroll-hidden",
  });
  const container = element(document, "div", {
    children: [element(document, "div", { className: "bolt-menu-spacer" }), table],
    className: "bolt-menu-container no-outline",
  });
  const menu = wrapIn(document, container, [
    { className: "bolt-contextualmenu-container", tag: "div" },
    {
      className:
        "bolt-contextual-menu flex-column custom-scrollbar depth-8 bolt-callout-content bolt-callout-shadow",
      role: "dialog",
      tag: "div",
    },
    { className: "fix-ado-add-menu bolt-callout flex-row", tag: "div" },
  ]);
  return { item, menu };
}

export type { ElementOptions };
export {
  STARRED_SECTION_CLASS,
  STAR_BUTTON_CLASS,
  createAvatar,
  createEmptyWell,
  createMenu,
  createStarButton,
  createStarredRow,
  createStarredSection,
  detailOf,
  element,
  fontIcon,
  updateStarButton,
};
