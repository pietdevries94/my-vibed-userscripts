import { findLeaks, redact } from "./leak-check.ts";
import { JSDOM } from "jsdom";
import type { ScrubRules } from "./rules.ts";
import assert from "node:assert/strict";
import { createPseudonyms } from "./pseudonyms.ts";
import { scrubElement } from "./scrub-dom.ts";
import { scrubJson } from "./scrub-json.ts";
import { test } from "node:test";

const RULES: ScrubRules = {
  keepAttributes: ["data-kind"],
  keepIdPatterns: [/^keep-/u],
  keepJsonPaths: [{ path: /(?:^|\.)state$/u, value: /^[a-z]+$/u }],
  keepRouteWords: ["items"],
  keepUiWords: ["Open"],
  mapUrl: (url, pseudonyms) =>
    url.pathname.startsWith("/people/")
      ? `/fake/${pseudonyms.text(url.pathname.slice("/people/".length), "person")}`
      : null,
};

function scrubHtml(html: string): {
  output: string;
  pseudonyms: ReturnType<typeof createPseudonyms>;
} {
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const pseudonyms = createPseudonyms();
  return { output: scrubElement(document.body, RULES, pseudonyms).outerHTML, pseudonyms };
}

test("the same value gets the same stand-in everywhere", () => {
  const { output } = scrubHtml(
    '<p title="Quill Barrow">Quill Barrow</p><span aria-label="Quill Barrow"></span>',
  );
  assert.equal(
    output,
    '<body><p title="text-1">text-1</p><span aria-label="text-1"></span></body>',
  );
});

test("structure, classes and kept words stay, values go", () => {
  const { output } = scrubHtml(
    '<div class="row" role="row" data-kind="card" data-id="4711" id="keep-me"><b id="secret">Open</b><i>Closed</i></div>',
  );
  assert.equal(
    output,
    '<body><div class="row" role="row" data-kind="card" data-id="1001" id="keep-me"><b id="text-1">Open</b><i>text-2</i></div></body>',
  );
});

test("scripts and styles are dropped, unknown attributes too", () => {
  const { output } = scrubHtml(
    '<script>alert(1)</script><style>p{}</style><p onclick="go()" lang="nl">x</p>',
  );
  assert.equal(output, "<body><p>text-1</p></body>");
});

test("links keep route words and go through the script's URL map", () => {
  const { output } = scrubHtml(
    '<a href="/items/4711/notes?q=1"></a><a href="https://site.example/people/quill"></a>',
  );
  assert.equal(output, '<body><a href="/items/1001/text-1"></a><a href="/fake/text-2"></a></body>');
});

test("JSON keeps keys, booleans, null and kept paths", () => {
  const pseudonyms = createPseudonyms();
  const scrubbed = scrubJson(
    {
      items: [
        {
          done: true,
          id: 4711,
          note: null,
          owner: "Quill Barrow",
          state: "open",
          when: "2024-03-01T10:00:00Z",
        },
      ],
    },
    RULES,
    pseudonyms,
  );
  assert.deepEqual(scrubbed, {
    items: [
      {
        done: true,
        id: 1001,
        note: null,
        owner: "text-1",
        state: "open",
        when: "2000-01-01T00:01:00.000Z",
      },
    ],
  });
});

test("GUIDs become numbered stand-in GUIDs, the same one in any case", () => {
  const pseudonyms = createPseudonyms();
  const guid = "6F9619FF-8B86-D011-B42D-00C04FC964FF";
  assert.deepEqual(scrubJson([guid, guid.toLowerCase()], RULES, pseudonyms), [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000001",
  ]);
});

test("the leak check names the field of a value that is still in the output", () => {
  const { output, pseudonyms } = scrubHtml('<p title="Quill Barrow">x</p>');
  assert.deepEqual(findLeaks([output], pseudonyms), []);
  assert.deepEqual(findLeaks([`${output} quill barrow`], pseudonyms), ["p @title"]);
});

test("the leak check ignores short values and stand-ins", () => {
  const { output, pseudonyms } = scrubHtml('<p title="ab">1001</p><i>text-1</i>');
  assert.deepEqual(findLeaks([`${output} ab`], pseudonyms), []);
});

test("a value inside a longer word is not a leak", () => {
  const { output, pseudonyms } = scrubHtml("<p>Ann</p>");
  assert.deepEqual(findLeaks([`${output} <i class="planning"></i>`], pseudonyms), []);
});

test("redact replaces every replaced value", () => {
  const { pseudonyms } = scrubHtml("<p>Quill Barrow</p>");
  assert.equal(
    redact("TypeError: no row for Quill Barrow", pseudonyms),
    "TypeError: no row for [scrubbed]",
  );
});
