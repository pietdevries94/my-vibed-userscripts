// The site's CSS rules that apply to a captured page, for the fake site to look like
// the real one. Only rules whose selector matches an element in the page are kept,
// with their @media and @supports wrappers, plus @keyframes. Links are dropped:
// every url() becomes `none` and @font-face and @import rules are left out.
// Stylesheets from another origin cannot be read and are skipped.

/** Pseudo-classes and pseudo-elements without arguments, such as `:hover` and `::before`. */
const SIMPLE_PSEUDO = /::?[a-z-]+(?!\()/giu;
const URL_VALUE = /url\((?:"[^"]*"|'[^']*'|[^)]*)\)/giu;
function matchesAny(selector: string, root: Element): boolean {
  const document = root.ownerDocument;
  try {
    return (
      document.documentElement.matches(selector) ||
      root.matches(selector) ||
      root.querySelector(selector) !== null
    );
  } catch {
    return false;
  }
}

/** True when the selector, without its state and pseudo-element parts, matches in `root`. */
function selectorApplies(selectorText: string, root: Element): boolean {
  return selectorText.split(",").some((selector) => {
    const bare = selector.replaceAll(SIMPLE_PSEUDO, "").trim();
    return matchesAny(bare === "" ? "*" : bare, root);
  });
}

function withoutLinks(cssText: string): string {
  return cssText.replaceAll(URL_VALUE, "none");
}

function isStyleRule(rule: CSSRule): rule is CSSStyleRule {
  return "selectorText" in rule && "style" in rule;
}

function isKeyframesRule(rule: CSSRule): rule is CSSKeyframesRule {
  return "findRule" in rule;
}

function isGroupingRule(rule: CSSRule): rule is CSSGroupingRule {
  return "cssRules" in rule && !isKeyframesRule(rule);
}

/** An @media, @supports or similar rule around the inner rules that match. */
function keptGroupingRule(rule: CSSGroupingRule, root: Element): string | null {
  const inner = keptRules(rule.cssRules, root);
  if (inner.length === 0) {
    return null;
  }
  const header = rule.cssText.slice(0, rule.cssText.indexOf("{")).trim();
  return `${header} {\n${inner.join("\n")}\n}`;
}

function keptRule(rule: CSSRule, root: Element): string | null {
  if (isStyleRule(rule)) {
    return selectorApplies(rule.selectorText, root) ? withoutLinks(rule.cssText) : null;
  }
  if (isKeyframesRule(rule)) {
    return withoutLinks(rule.cssText);
  }
  // @font-face and @import carry links and have no inner rules, so they are left out.
  return isGroupingRule(rule) ? keptGroupingRule(rule, root) : null;
}

function keptRules(rules: CSSRuleList, root: Element): string[] {
  return [...rules]
    .map((rule) => keptRule(rule, root))
    .filter((text): text is string => text !== null);
}

function readableRules(sheet: CSSStyleSheet): CSSRuleList | null {
  try {
    return sheet.cssRules;
  } catch {
    return null;
  }
}

/** The CSS of `root`'s document that applies to `root`, `<html>` included. */
function matchedCss(root: Element): string {
  const parts: string[] = [];
  for (const sheet of root.ownerDocument.styleSheets) {
    const rules = readableRules(sheet);
    if (rules !== null) {
      parts.push(...keptRules(rules, root));
    }
  }
  const htmlStyle = root.ownerDocument.documentElement.getAttribute("style");
  if (htmlStyle !== null && htmlStyle.trim() !== "") {
    parts.push(`:root { ${withoutLinks(htmlStyle)} }`);
  }
  return parts.join("\n");
}

export { matchedCss };
