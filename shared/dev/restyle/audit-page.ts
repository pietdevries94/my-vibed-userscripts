// What the restyle audit looks for on a page: what scrolls sideways, painted rounded corners and
// blurred outer shadows. Runs in the browser, so each function stands on its own. Dev file only.

interface AuditFinds {
  /** The page's own sideways overflow in px, 0 when it has none. */
  pageOverflow: number;
  finds: string[];
}

/** Every visible element's finds, as "kind: element detail". Pass it to page.evaluate. */
function auditFinds(): AuditFinds {
  const MIN_SIZE = 3;
  const label = (element: Element): string =>
    `${element.localName}.${[...element.classList].slice(0, MIN_SIZE).join(".")}`;
  const visible = (element: Element): boolean => {
    const box = element.getBoundingClientRect();
    return (
      box.width >= MIN_SIZE &&
      box.height >= MIN_SIZE &&
      box.bottom > 0 &&
      box.top < innerHeight &&
      getComputedStyle(element).visibility !== "hidden"
    );
  };
  const findsOf = (element: Element): string[] => {
    const style = getComputedStyle(element);
    const painted =
      style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
      style.borderTopWidth !== "0px" ||
      style.boxShadow !== "none";
    const blurred = style.boxShadow
      .split(/,(?![^(]*\))/u)
      .find((shadow) => !shadow.includes("inset") && /\d+px \d+px [1-9]/u.test(shadow));
    return [
      ["auto", "scroll"].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1
        ? `scrolls: ${label(element)} ${element.scrollWidth}>${element.clientWidth}`
        : "",
      painted && style.borderTopLeftRadius !== "0px" && element.closest("svg") === null
        ? `rounded: ${label(element)} ${style.borderTopLeftRadius}`
        : "",
      blurred === undefined ? "" : `blurred: ${label(element)} ${blurred.trim()}`,
    ].filter(Boolean);
  };
  return {
    finds: [...document.querySelectorAll("body *")]
      .filter((element) => visible(element))
      .flatMap((element) => findsOf(element)),
    pageOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
  };
}

export { auditFinds };
export type { AuditFinds };
