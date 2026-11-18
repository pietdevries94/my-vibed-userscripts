/** A smooth scroll, or a jump when the owner asks for reduced motion. */
function scrollBehaviorOf(document: Document): ScrollBehavior {
  const reducesMotion =
    document.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  return reducesMotion ? "instant" : "smooth";
}

export { scrollBehaviorOf };
