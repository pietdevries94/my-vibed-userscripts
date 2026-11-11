// Turns a captured page fixture into DOM nodes.
//
// Azure DevOps renders each row as an <a> directly inside <tbody>. An HTML parser moves
// such an <a> out of the table, so the fixture cannot be parsed as it is. This parses
// the table tags under placeholder names and renames them afterwards.
const TABLE_TAGS = ["table", "colgroup", "col", "tbody", "tr", "td"];
const PLACEHOLDER_PREFIX = "fixture-";

function withPlaceholderTags(fixtureHtml: string): string {
  return fixtureHtml
    .replaceAll(
      /<col(?<attributes>\s[^>]*)?>/gu,
      `<${PLACEHOLDER_PREFIX}col$<attributes>></${PLACEHOLDER_PREFIX}col>`,
    )
    .replaceAll(
      new RegExp(`<(?<slash>/?)(?<tag>${TABLE_TAGS.join("|")})(?=[\\s>])`, "gu"),
      `<$<slash>${PLACEHOLDER_PREFIX}$<tag>`,
    );
}

function restoreTag(document: Document, placeholder: Element): void {
  const element = document.createElement(placeholder.localName.slice(PLACEHOLDER_PREFIX.length));
  for (const { name, value } of placeholder.attributes) {
    element.setAttribute(name, value);
  }
  element.append(...placeholder.childNodes);
  placeholder.replaceWith(element);
}

function buildFixtureDom(document: Document, fixtureHtml: string): Element | null {
  const container = document.createElement("div");
  container.innerHTML = withPlaceholderTags(fixtureHtml);
  for (const placeholder of [...container.querySelectorAll("*")].toReversed()) {
    if (placeholder.localName.startsWith(PLACEHOLDER_PREFIX)) {
      restoreTag(document, placeholder);
    }
  }
  return container.firstElementChild;
}

export { buildFixtureDom };
