// Turns a captured PR list fixture into DOM nodes.
//
// ADO renders each row as an <a> directly inside <tbody>. An HTML parser moves
// such an <a> out of the table, so the fixture cannot be parsed as it is. This
// parses the table tags under placeholder names and renames them afterwards.
const TABLE_TAGS = ["table", "colgroup", "col", "tbody", "tr", "td"];
const PLACEHOLDER_PREFIX = "fixture-";

export function buildFixtureDom(document, fixtureHtml) {
  const parseableHtml = fixtureHtml
    .replace(/<col(\s[^>]*)?>/g, `<${PLACEHOLDER_PREFIX}col$1></${PLACEHOLDER_PREFIX}col>`)
    .replace(new RegExp(`<(/?)(${TABLE_TAGS.join("|")})(?=[\\s>])`, "g"), `<$1${PLACEHOLDER_PREFIX}$2`);
  const container = document.createElement("div");
  container.innerHTML = parseableHtml;

  for (const placeholder of [...container.querySelectorAll("*")].reverse()) {
    if (!placeholder.localName.startsWith(PLACEHOLDER_PREFIX)) continue;
    const element = document.createElement(placeholder.localName.slice(PLACEHOLDER_PREFIX.length));
    for (const { name, value } of placeholder.attributes) element.setAttribute(name, value);
    element.append(...placeholder.childNodes);
    placeholder.replaceWith(element);
  }
  return container.firstElementChild;
}
