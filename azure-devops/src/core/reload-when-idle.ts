const MIN_TIME_BETWEEN_RELOADS_MS = 15_000;
const LAST_RELOAD_STORAGE_KEY = "fix-ado-last-page-reload";

function isOwnerBusy(document: Document): boolean {
  const isTyping = document.activeElement?.matches("input, textarea, [contenteditable]") ?? false;
  const hasOpenDialog = document.querySelector('[role="dialog"]') !== null;
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

export { reloadWhenIdle };
