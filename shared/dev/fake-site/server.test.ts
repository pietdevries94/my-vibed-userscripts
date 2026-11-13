import { fixtureReader, htmlResponse, startFakeSite } from "./server.ts";
import type { Server } from "node:http";
import assert from "node:assert/strict";
import fs from "node:fs";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

/** A fake site with one page and one action, on a free port. */
async function testSite(): Promise<{ origin: string; server: Server }> {
  let count = 0;
  const countUp = (query: URLSearchParams): number => {
    count += Number(query.get("by"));
    return count;
  };
  const server = startFakeSite(
    {
      actions: () => [{ description: "Counts up.", example: "by=1", name: "count", run: countUp }],
      pages: () => [{ label: "Home", path: "/home" }],
      respond: ({ url, refererPath, method, body }) => {
        if (method === "PUT" && url.pathname === "/note") {
          return htmlResponse(`noted ${body}`);
        }
        return method === "GET" && url.pathname === "/home"
          ? htmlResponse(`count ${count}, from ${refererPath}`)
          : null;
      },
    },
    0,
  );
  await once(server, "listening");
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  return { origin: `http://localhost:${address.port}`, server };
}

async function textOf(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, init);
  return response.text();
}

test("answers GET with no-store, and refuses other methods the site does not handle", async () => {
  const { origin, server } = await testSite();
  const page = await fetch(`${origin}/home`, { headers: { Referer: `${origin}/list` } });
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.equal(await page.text(), "count 0, from /list");
  const post = await fetch(`${origin}/home`, { method: "POST" });
  assert.equal(post.status, 405);
  const put = await fetch(`${origin}/note`, { body: "hello", method: "PUT" });
  assert.equal(await put.text(), "noted hello");
  server.close();
});

test("logs requests, runs actions, and lists both on the index", async () => {
  const { origin, server } = await testSite();
  await fetch(`${origin}/home`);
  await fetch(`${origin}/missing?x=1`);
  assert.equal(await textOf(`${origin}/__dev/count?by=2`), "2");
  assert.equal(await textOf(`${origin}/home`), "count 2, from null");
  assert.deepEqual(JSON.parse(await textOf(`${origin}/__dev/requests`)), [
    "GET /home",
    "GET /missing?x=1",
    "GET /home",
  ]);
  const index = await textOf(`${origin}/__dev`);
  assert.match(index, /href="\/home"/u);
  assert.match(index, /href="\/__dev\/count\?by=1"/u);
  server.close();
});

test("serves the fixture-to-DOM helper as JavaScript", async () => {
  const { origin, server } = await testSite();
  const helper = await textOf(`${origin}/__dev/fixture-dom.js`);
  assert.match(helper, /function buildFixtureDom\(document\s*,\s*fixtureHtml\s*\)/u);
  server.close();
});

test("a missing fixture names the file and how to get it", () => {
  const scriptDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "fake-site-"));
  const read = fixtureReader(scriptDirectory);
  const expected = `Missing fixture ${path.basename(scriptDirectory)}/fixtures/page.html`;
  assert.throws(
    () => read("page.html"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(error.message.startsWith(expected));
      assert.match(error.message, /fixtures:import/u);
      return true;
    },
  );
});
