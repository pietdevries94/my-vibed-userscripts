// A harmless local site for the guard test. Records every request it receives.
// Port 8711 is the site, port 8712 another origin that is not on the allowlist.
import type { IncomingMessage, ServerResponse } from "node:http";
import { WebSocketServer } from "ws";
import http from "node:http";

interface Hit {
  port: number;
  method: string;
  url: string;
}

interface Site {
  hits: Hit[];
  close: () => void;
}

const SITE_PORT = 8711;
const OTHER_PORT = 8712;
const SITE = `http://127.0.0.1:${SITE_PORT}`;
const OTHER_ORIGIN = `http://127.0.0.1:${OTHER_PORT}`;
const EXEMPT_URL = `${SITE}/exempt`;
const HTTP_OK = 200;
const HTTP_FOUND = 302;

function page(body: string): string {
  return `<!doctype html><meta charset=utf-8><title>guard test</title>${body}`;
}

const AUTOPOST = `<script>
  const tag = new URLSearchParams(location.search).get("tag") || "autopost";
  fetch("/sink?case=" + tag, { method: "POST", body: "x" }).catch(() => {});
  navigator.sendBeacon("/sink?case=" + tag + "-beacon", "x");
</script>`;

const PAGES: Record<string, string> = {
  "/": page("<h1>guard test</h1>"),
  "/autopost": page(AUTOPOST),
  "/form": page(
    '<form id=f method=post action="/sink?case=form-post"><input name=a value=1></form>',
  ),
  "/form-blank": page(
    '<form id=f method=post target=_blank action="/sink?case=form-post-new-tab"><input name=a value=1></form>',
  ),
  "/sw-page": page(`<script>
    window.swResult = navigator.serviceWorker
      ? navigator.serviceWorker.register("/sw.js").then(() => "registered", (error) => "register failed: " + error.message)
      : Promise.resolve("no navigator.serviceWorker");
  </script>`),
};

const SCRIPTS: Record<string, string> = {
  "/shared.js": `onconnect = (event) => { const port = event.ports[0];
    fetch("/sink?case=shared-worker-post", { method: "POST", body: "x" }).then(() => port.postMessage("sent"), (error) => port.postMessage(error.message)); };`,
  "/sw.js": `self.addEventListener("install", (event) => { self.skipWaiting(); event.waitUntil(fetch("/sink?case=sw-install-post", { method: "POST", body: "x" }).catch(() => {})); });
    self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));
    self.addEventListener("message", (event) => { event.waitUntil(fetch("/sink?case=sw-message-post", { method: "POST", body: "x" }).catch(() => {})); });`,
  "/worker.js": `fetch("/sink?case=dedicated-worker-post", { method: "POST", body: "x" }).then(() => postMessage("sent"), (error) => postMessage(error.message));`,
};

function respond(url: string, response: ServerResponse): void {
  const pathname = url.split("?")[0] ?? "/";
  const script = SCRIPTS[pathname];
  if (script !== undefined) {
    response.writeHead(HTTP_OK, { "content-type": "text/javascript" });
    response.end(script);
  } else if (pathname === "/redirect-out") {
    response.writeHead(HTTP_FOUND, { location: `${OTHER_ORIGIN}/?case=redirect-to-other-origin` });
    response.end();
  } else {
    response.writeHead(HTTP_OK, {
      "content-type": PAGES[pathname] === undefined ? "text/plain" : "text/html",
    });
    response.end(PAGES[pathname] ?? "ok");
  }
}

function listen(port: number, hits: Hit[]): () => void {
  const server = http.createServer((request: IncomingMessage, response: ServerResponse) => {
    request.resume();
    request.on("end", () => {
      hits.push({ method: request.method ?? "", port, url: request.url ?? "/" });
      respond(request.url ?? "/", response);
    });
  });
  const sockets = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    hits.push({ method: "WS-UPGRADE", port, url: request.url ?? "" });
    sockets.handleUpgrade(request, socket, head, (webSocket) => {
      webSocket.close();
    });
  });
  server.listen(port, "127.0.0.1");
  return () => {
    sockets.close();
    server.closeAllConnections();
    server.close();
  };
}

function startSite(): Site {
  const hits: Hit[] = [];
  const closers = [SITE_PORT, OTHER_PORT].map((port) => listen(port, hits));
  return {
    close: () => {
      for (const close of closers) {
        close();
      }
    },
    hits,
  };
}

export type { Hit, Site };
export { EXEMPT_URL, OTHER_ORIGIN, SITE, startSite };
