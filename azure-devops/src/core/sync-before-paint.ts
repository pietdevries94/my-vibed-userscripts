/**
 * Returns the function to call on every DOM change. It runs `sync` once in the next animation
 * frame, which comes before the browser paints the change, so what Azure DevOps renders shows
 * up with the script's changes already made. Changes in one frame share one sync.
 */
function createSyncBeforePaint(
  requestAnimationFrame: (callback: () => void) => void,
  sync: () => void,
): () => void {
  let isPending = false;
  return () => {
    if (isPending) {
      return;
    }
    isPending = true;
    requestAnimationFrame(() => {
      isPending = false;
      sync();
    });
  };
}

export { createSyncBeforePaint };
