const MIN_TIME_BETWEEN_RELOADS_MS = 15_000;
const LAST_RELOAD_STORAGE_KEY = "fix-ado-last-page-reload";

/** Inputs the owner types in. A checkbox, a radio or an input button holds nothing typed. */
const TEXT_FIELD_SELECTOR =
  "textarea, input:not([type=checkbox], [type=radio], [type=button], [type=submit], [type=reset])";

function isOwnerBusy(document: Document): boolean {
  const focused = document.activeElement;
  const isTyping =
    focused !== null &&
    (focused.matches(TEXT_FIELD_SELECTOR) ||
      ("isContentEditable" in focused && focused.isContentEditable === true));
  const hasOpenDialog = document.querySelector('[role="dialog"], dialog[open]') !== null;
  return isTyping || hasOpenDialog;
}

/** Records this reload, unless the last one was too recent. False when the reload must wait. */
function claimReload(): boolean {
  try {
    const lastReloadAt = Number(sessionStorage.getItem(LAST_RELOAD_STORAGE_KEY));
    if (Date.now() - lastReloadAt < MIN_TIME_BETWEEN_RELOADS_MS) {
      return false;
    }
    sessionStorage.setItem(LAST_RELOAD_STORAGE_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/**
 * Reloads the page, unless the owner types or has a dialog open (a work item, for example),
 * or the page reloaded moments ago, so a bug cannot cause a reload loop. The next check retries.
 */
function reloadWhenIdle(document: Document): void {
  if (!isOwnerBusy(document) && claimReload()) {
    location.reload();
  }
}

export { isOwnerBusy, reloadWhenIdle };
