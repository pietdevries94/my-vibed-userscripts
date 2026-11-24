// A switch like Azure DevOps's own: a pill with a knob, then its label. switch.css styles
// it. Its own classes, as no capture holds the site's switch.

const SWITCH_CLASS = "fix-ado-switch";

function createPill(document: Document): HTMLElement {
  const pill = Object.assign(document.createElement("span"), {
    className: `${SWITCH_CLASS}-pill`,
  });
  pill.setAttribute("aria-hidden", "true");
  pill.append(Object.assign(document.createElement("span"), { className: `${SWITCH_CLASS}-knob` }));
  return pill;
}

/** A switch, off, with its label. Add a class of your own for where it sits. */
function createSwitch(document: Document, label: string): HTMLButtonElement {
  const toggle = Object.assign(document.createElement("button"), {
    className: SWITCH_CLASS,
    type: "button",
  });
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-checked", "false");
  const text = Object.assign(document.createElement("span"), {
    className: `${SWITCH_CLASS}-text`,
    textContent: label,
  });
  toggle.append(createPill(document), text);
  return toggle;
}

/** Turns the switch on or off. Writes only on a change, so the page's own observers stay quiet. */
function showSwitchOn(toggle: HTMLButtonElement, isOn: boolean): void {
  if (toggle.getAttribute("aria-checked") !== String(isOn)) {
    toggle.setAttribute("aria-checked", String(isOn));
  }
}

export { createSwitch, showSwitchOn };
