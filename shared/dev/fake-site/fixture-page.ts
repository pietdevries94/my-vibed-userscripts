// A fake-site page that shows a captured page fixture. The page loads the fixture
// from `fixtureUrl`, builds it with the fixture-to-DOM helper and puts it in the body,
// the way the real site renders after load. A fixture captured from <body> keeps its
// content and attributes in a <div>, since a page has one body.

interface FixturePageOptions {
  title: string;
  /** Where the page fetches the fixture HTML. */
  fixtureUrl: string;
  /** CSS for the page. The site's own stylesheets are not captured. */
  style: string;
}

function fixturePage({ title, fixtureUrl, style }: FixturePageOptions): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>${title}</title>
<style>${style}</style>
<body><p>Loading…</p>
<script type="module">
  import { buildFixtureDom } from "/__dev/fixture-dom.js";
  const response = await fetch(${JSON.stringify(fixtureUrl)});
  const html = (await response.text())
    .replace(/^<body\\b/u, "<div")
    .replace(/<\\/body>\\s*$/u, "</div>");
  const root = buildFixtureDom(document, html);
  document.body.replaceChildren(...(root === null ? [] : [root]));
</script>
</body>`;
}

export type { FixturePageOptions };
export { fixturePage };
