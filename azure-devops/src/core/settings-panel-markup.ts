interface ElementParts {
  className: string;
  text?: string;
}

function element<Tag extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: Tag,
  { className, text }: ElementParts,
): HTMLElementTagNameMap[Tag] {
  const created = document.createElement(tag);
  created.className = className;
  if (text !== undefined) {
    created.textContent = text;
  }
  return created;
}

function button(document: Document, parts: ElementParts, onClick: () => void): HTMLButtonElement {
  const created = element(document, "button", parts);
  created.type = "button";
  created.addEventListener("click", onClick);
  return created;
}

export { button, element };
