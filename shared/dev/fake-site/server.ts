// The shared base of every fake site: a local stand-in for a website, built from the
// script's fixtures. It answers GET, and other methods only where the script's fake site
// handles them; it sends no-store and logs every request.
// Built in: /__dev (an index of pages and actions), /__dev/requests (the log),
// /__dev/fixture-dom.js (the fixture-to-DOM helper), and /__dev/<action>.
// The server does not serve the script; the dev server on :8786 does.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { text as readText } from "node:stream/consumers";
import { stripTypeScriptTypes } from "node:module";

interface FakeResponse {
  status?: number;
  contentType: string;
  body: string;
}

interface FakeRequest {
  url: URL;
  /** GET, or a method the script's fake site may handle, such as PUT. */
  method: string;
  /** The request body, empty for a GET. */
  body: string;
  /** The path of the page that sent the request, from the Referer header. */
  refererPath: string | null;
}

interface FakeSiteAction {
  name: string;
  /** What the action changes, for the /__dev index. */
  description: string;
  /** A query for the index link, such as "pullRequestId=1001&status=running". */
  example: string;
  /** Changes the state. The return value is shown as JSON. */
  run: (query: URLSearchParams) => unknown;
}

interface FakeSiteDefinition {
  /** Pages for the /__dev index. A function, so a missing fixture fails the request, not the start. */
  pages: () => { path: string; label: string }[];
  actions: () => FakeSiteAction[];
  /** The response to a request, or null for a 404 (a 405 for a method other than GET). */
  respond: (request: FakeRequest) => FakeResponse | null;
}

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_SERVER_ERROR = 500;
const FIXTURE_DOM_FILE = path.join(import.meta.dirname, "fixture-dom.ts");

function jsonResponse(value: unknown, status = HTTP_OK): FakeResponse {
  return { body: JSON.stringify(value, null, 2), contentType: "application/json", status };
}

function htmlResponse(body: string): FakeResponse {
  return { body, contentType: "text/html; charset=utf-8" };
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}

/** Reads `<script>/fixtures/<name>`. The error names the missing file and how to get it. */
function fixtureReader(scriptDirectory: string): (name: string) => string {
  const directory = path.join(scriptDirectory, "fixtures");
  const scriptId = path.basename(scriptDirectory);
  return (name) => {
    const file = path.join(directory, name);
    if (!fs.existsSync(file)) {
      throw new Error(
        `Missing fixture ${scriptId}/fixtures/${name}. Capture the page, then run npm run fixtures:import ${scriptId}.`,
      );
    }
    return fs.readFileSync(file, "utf8");
  };
}

function indexPage(definition: FakeSiteDefinition): string {
  const pages = definition
    .pages()
    .map(
      ({ path: pagePath, label }) =>
        `<li><a href="${escapeHtml(pagePath)}">${escapeHtml(label)}</a></li>`,
    );
  const actions = definition
    .actions()
    .map(
      ({ name, description, example }) =>
        `<li><a href="/__dev/${name}?${escapeHtml(example)}">${name}?${escapeHtml(example)}</a>: ${escapeHtml(description)}</li>`,
    );
  return `<!doctype html><meta charset="utf-8"><title>Fake site</title>
<h1>Fake site</h1><h2>Pages</h2><ul>${pages.join("")}</ul>
<h2>Actions</h2><ul>${actions.join("")}</ul>
<p><a href="/__dev/requests">Requests received</a></p>`;
}

/** The answers the base gives itself, under /__dev. Null for any other path. */
function devResponse(
  url: URL,
  definition: FakeSiteDefinition,
  requests: string[],
): FakeResponse | null {
  if (url.pathname === "/__dev") {
    return htmlResponse(indexPage(definition));
  }
  if (url.pathname === "/__dev/requests") {
    return jsonResponse(requests);
  }
  if (url.pathname === "/__dev/fixture-dom.js") {
    const source = stripTypeScriptTypes(fs.readFileSync(FIXTURE_DOM_FILE, "utf8"));
    return { body: source, contentType: "text/javascript" };
  }
  const action = definition.actions().find(({ name }) => url.pathname === `/__dev/${name}`);
  return action === undefined ? null : jsonResponse(action.run(url.searchParams));
}

/** A request other than GET: the script's fake site answers it, or it is refused. */
function writeResponse(definition: FakeSiteDefinition, fakeRequest: FakeRequest): FakeResponse {
  return (
    definition.respond(fakeRequest) ??
    jsonResponse(
      { message: `The fake site does not handle ${fakeRequest.method} here.` },
      HTTP_METHOD_NOT_ALLOWED,
    )
  );
}

async function respondTo(
  request: http.IncomingMessage,
  definition: FakeSiteDefinition,
  requests: string[],
): Promise<FakeResponse> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const method = request.method ?? "GET";
  if (!url.pathname.startsWith("/__dev")) {
    requests.push(`${method} ${url.pathname}${url.search}`);
  }
  const { referer } = request.headers;
  const refererPath = referer === undefined ? null : new URL(referer).pathname;
  const fakeRequest = { body: await readText(request), method, refererPath, url };
  if (method !== "GET") {
    return writeResponse(definition, fakeRequest);
  }
  return (
    devResponse(url, definition, requests) ??
    definition.respond(fakeRequest) ??
    jsonResponse({ message: `Not found: ${url.pathname}` }, HTTP_NOT_FOUND)
  );
}

async function safeResponse(
  request: http.IncomingMessage,
  definition: FakeSiteDefinition,
  requests: string[],
): Promise<FakeResponse> {
  try {
    return await respondTo(request, definition, requests);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ message }, HTTP_SERVER_ERROR);
  }
}

/** Starts the fake site. Port 0 picks a free port, for tests. */
function startFakeSite(definition: FakeSiteDefinition, port: number): http.Server {
  const requests: string[] = [];
  const server = http.createServer((request, response) => {
    void safeResponse(request, definition, requests).then(
      ({ body, contentType, status = HTTP_OK }) => {
        response.writeHead(status, { "Cache-Control": "no-store", "Content-Type": contentType });
        response.end(body);
      },
    );
  });
  server.listen(port);
  return server;
}

export type { FakeRequest, FakeResponse, FakeSiteAction, FakeSiteDefinition };
export { fixtureReader, htmlResponse, jsonResponse, startFakeSite };
