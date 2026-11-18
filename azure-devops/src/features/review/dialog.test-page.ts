// JSDOM has no dialog methods. These open and close a dialog as a browser does, and press Esc.
import type { JSDOM } from "jsdom";

function stubDialogMethods(window: JSDOM["window"]): void {
  Object.assign(window.HTMLDialogElement.prototype, {
    close(this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new window.Event("close"));
    },
    showModal(this: HTMLDialogElement) {
      this.open = true;
    },
  });
}

/** Presses Esc on an open dialog, as the browser does. True when the dialog let it close. */
function pressEscape(dialog: HTMLDialogElement): boolean {
  const view = dialog.ownerDocument.defaultView;
  if (view === null) {
    throw new Error("the dialog has no window");
  }
  const cancel = new view.Event("cancel", { cancelable: true });
  dialog.dispatchEvent(cancel);
  if (!cancel.defaultPrevented) {
    dialog.close();
  }
  return !cancel.defaultPrevented;
}

export { pressEscape, stubDialogMethods };
