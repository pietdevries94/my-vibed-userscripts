// Windows 98 mode's thread measurements, taken in the browser for the thread header check.
// Dev file only.

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

/** One thread's title bar, measured in the browser. */
interface TitleBar {
  label: string;
  bar: Box | null;
  parts: { name: string; box: Box }[];
  /** The widest of the coin and its content; 0 for a file thread's bar, which has no coin. */
  coinWidth: number;
  /** The top of the first comment's text below the bar; null when collapsed. */
  textTop: number | null;
}

/** Each thread's title bar on the page: the bar, its parts, coin and the text below. Runs in the browser. */
function measureTitleBars(): TitleBar[] {
  return [
    ...document.querySelectorAll<HTMLElement>(".activity-feed-list [data-fix-ado-thread]"),
  ].map((thread, index) => {
    const isOpen = thread.dataset.fixAdoThread === "open";
    const fileHeader = isOpen
      ? thread.previousElementSibling?.querySelector(
          ":scope.comment-file-header .comment-file-header-title",
        )
      : null;
    const firstRow = thread.querySelector(
      ":scope > .repos-comment-viewer:first-child > .repos-discussion-comment > .flex-column > .flex-row",
    );
    // Collapsed, the first comment's whole row is the bar; open, its header spans the window.
    const commentBar = isOpen
      ? firstRow?.querySelector(".repos-discussion-comment-header")
      : firstRow;
    const bar = fileHeader ?? commentBar ?? null;
    const coins = fileHeader
      ? []
      : [
          ...(firstRow?.querySelectorAll(
            ":scope > div > .bolt-coin, :scope > div > .bolt-coin > *",
          ) ?? []),
        ];
    const parts = [
      ...(bar?.querySelectorAll(
        ".fix-ado-thread-toggle, .padding-right-8, .comment-file-header-link, time, .fix-ado-thread-chip",
      ) ?? []),
      ...coins,
    ];
    const text = isOpen ? thread.querySelector(".markdown-content") : null;
    const [barBox, ...partBoxes] = [bar ?? thread, ...parts].map((element) => {
      const { bottom, height, left, right, top, width } = element.getBoundingClientRect();
      return { bottom, height, left, right, top, width };
    });
    return {
      bar: bar ? barBox : null,
      coinWidth: Math.max(0, ...coins.map((coin) => coin.getBoundingClientRect().width)),
      label: `thread ${index + 1} (${fileHeader ? "file" : "comment"}, ${thread.dataset.fixAdoThread})`,
      parts: parts.map((part, partIndex) => ({
        box: partBoxes[partIndex],
        name: part.className || part.tagName,
      })),
      textTop: text ? text.getBoundingClientRect().top : null,
    };
  });
}

/** The header of a comment in an open thread that is not its title bar. */
interface CommentHeader {
  label: string;
  header: Box;
  parts: { name: string; box: Box }[];
}

/** The header of every comment in an open thread but a title bar: the name, time and chip.
 * Runs in the browser. */
function measureCommentHeaders(): CommentHeader[] {
  const threads = document.querySelectorAll(".activity-feed-list [data-fix-ado-thread='open']");
  return [...threads].flatMap((thread, threadIndex) => {
    const isFileThread = thread.previousElementSibling?.matches(".comment-file-header") ?? false;
    const viewers = [...thread.querySelectorAll(":scope > .repos-comment-viewer")];
    return viewers.slice(isFileThread ? 0 : 1).flatMap((viewer, viewerIndex) => {
      const header = viewer.querySelector(".repos-discussion-comment-header");
      if (!header) {
        return [];
      }
      const parts = [...header.querySelectorAll(".padding-right-8, time, .fix-ado-thread-chip")];
      const [headerBox, ...partBoxes] = [header, ...parts].map((element) => {
        const { bottom, height, left, right, top, width } = element.getBoundingClientRect();
        return { bottom, height, left, right, top, width };
      });
      return [
        {
          header: headerBox,
          label: `thread ${threadIndex + 1} comment ${viewerIndex + 1}`,
          parts: parts.map((part, partIndex) => ({
            box: partBoxes[partIndex],
            name: part.className || part.tagName,
          })),
        },
      ];
    });
  });
}

export type { Box, TitleBar };
export { measureCommentHeaders, measureTitleBars };
