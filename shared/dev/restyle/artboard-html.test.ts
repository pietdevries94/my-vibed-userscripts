import { artboardHtml } from "./artboard-html.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("an artboard keeps its styles and markup, without the canvas's wrappers and scripts", () => {
  const source = `<!doctype html><html><head><title>Board</title><script src="./support.js"></script></head><body><x-dc><helmet><style>.a{color:red}</style></helmet><div class="a">Card</div></x-dc><script type="text/x-dc" data-dc-script>class Component {}</script></body></html>`;
  assert.equal(
    artboardHtml(source),
    `<!doctype html><html><head><title>Board</title></head><body><style>.a{color:red}</style><div class="a">Card</div></body></html>`,
  );
});
