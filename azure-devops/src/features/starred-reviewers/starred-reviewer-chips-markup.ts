// The elements of the starred reviewer chips on the create pull request page. They copy
// Azure DevOps's own reviewer pill, so its styles apply.
import { STAR_PATH, element, svgIcon } from "./starred-reviewers-markup.ts";
import type { Identity } from "../../pull-requests/reviewer-requests.ts";
import { personOrTeamName } from "../../pull-requests/reviewers.ts";

const STARRED_CHIP_ROW_CLASS = "fix-ado-starred-chips";
const STARRED_CHIP_CLASS = "fix-ado-starred-chip";

/** A starred reviewer as Azure DevOps's reviewer pill. A click adds them to the field above. */
function createStarredChip(document: Document, identity: Identity, imageUrl: string): HTMLElement {
  const name = personOrTeamName(identity.displayName);
  const image = element(document, "img", {
    attributes: { alt: "", src: imageUrl },
    className: "bolt-coin-content using-image size20",
  });
  return element(document, "button", {
    attributes: {
      "aria-label": `Add ${name} as reviewer`,
      "data-fix-ado-identity": identity.id,
      title: "Add as reviewer",
      type: "button",
    },
    children: [
      element(document, "div", {
        children: [
          element(document, "div", {
            attributes: { "aria-hidden": "true" },
            children: [image],
            className: "bolt-coin flex-noshrink flex-row flex-center size20",
          }),
        ],
        className: "bolt-pill-filled-visual flex-noshrink",
      }),
      element(document, "div", { className: "bolt-pill-content text-ellipsis", text: name }),
    ],
    className: `${STARRED_CHIP_CLASS} bolt-pill flex-row flex-center standard regular clickable has-filled-visual`,
  });
}

/** Puts a spinner in place of the chip's avatar while it picks its reviewer. */
function showChipSpinner(document: Document, chip: Element): void {
  chip.querySelector(".bolt-pill-filled-visual")?.replaceChildren(
    element(document, "span", {
      attributes: { "aria-hidden": "true" },
      className: "fix-ado-chip-spinner",
    }),
  );
}

/** The row of chips under a reviewer field: a star, then the chips the caller adds. */
function createStarredChipRow(document: Document): HTMLElement {
  return element(document, "div", {
    attributes: { "aria-label": "Starred reviewers", role: "group" },
    children: [
      svgIcon(document, "fix-ado-starred-chips-icon fix-ado-star-icon", [STAR_PATH]),
      element(document, "div", { className: "fix-ado-starred-chip-list flex-row flex-wrap" }),
    ],
    className: `${STARRED_CHIP_ROW_CLASS} flex-row flex-center`,
  });
}

export {
  STARRED_CHIP_CLASS,
  STARRED_CHIP_ROW_CLASS,
  createStarredChip,
  createStarredChipRow,
  showChipSpinner,
};
