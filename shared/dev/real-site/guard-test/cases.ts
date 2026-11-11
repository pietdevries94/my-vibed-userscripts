// The guard test's cases. Each one tries to write to the local site in another way.
// A step is one browser action; an `evaluate` step may name text its result must contain.
import { EXEMPT_URL, OTHER_ORIGIN, SITE } from "./site.ts";

type Step =
  | { kind: "navigate"; url: string }
  | { kind: "evaluate"; code: string; mustContain?: string }
  | { kind: "tabs"; args: Record<string, unknown> }
  | { kind: "wait" };

const navigate = (pathOrUrl: string): Step => ({
  kind: "navigate",
  url: pathOrUrl.startsWith("http") ? pathOrUrl : `${SITE}${pathOrUrl}`,
});
const evaluate = (code: string, mustContain?: string): Step => ({
  code,
  kind: "evaluate",
  mustContain,
});
const tabs = (args: Record<string, unknown>): Step => ({ args, kind: "tabs" });
const settle: Step = { kind: "wait" };

const unloadWrites: Record<string, string> = {
  beacon: `navigator.sendBeacon("/sink?case=unload-beacon", "x")`,
  form: `(() => { const f = document.createElement("form"); f.method = "post"; f.action = "/sink?case=unload-form"; document.body.append(f); f.submit(); })()`,
  keepalive: `fetch("/sink?case=unload-keepalive", { method: "POST", body: "x", keepalive: true })`,
  "sync-xhr": `(() => { try { const x = new XMLHttpRequest(); x.open("POST", "/sink?case=unload-sync-xhr", false); x.send("x"); } catch {} })()`,
};

const writesDuringUnload: Step[] = Object.entries(unloadWrites).flatMap(([kind, code]) => [
  navigate("/"),
  evaluate(
    `() => { addEventListener("pagehide", () => { ${code}; }); addEventListener("visibilitychange", () => { ${code}; }); return "armed"; }`,
  ),
  navigate(`/?leave=${kind}`),
  settle,
]);

const pageWrites: Step[] = [
  navigate("/autopost?tag=first-page-autopost"),
  settle,
  navigate("/form"),
  evaluate(`() => { document.getElementById("f").submit(); return "submitted"; }`),
  settle,
  navigate("/"),
  evaluate(`async () => Promise.all(["POST", "PUT", "PATCH", "DELETE"].map((method) =>
    fetch("/sink?case=fetch-" + method, { method, body: method === "DELETE" ? undefined : "x" }).then((r) => r.status, (e) => e.message)))`),
  evaluate(
    `() => fetch(new Request("/sink?case=request-object", { method: "POST", body: "x" })).then(() => "sent", (e) => e.message)`,
  ),
  evaluate(`() => fetch("/?read=1").then((r) => "GET status " + r.status)`, "GET status 200"),
  evaluate(
    `() => fetch("${EXEMPT_URL}?q=1", { method: "POST", body: "x" }).then((r) => "exempt status " + r.status, (e) => e.message)`,
    "exempt status 200",
  ),
  evaluate(`() => new Promise((resolve) => { const x = new XMLHttpRequest(); x.open("POST", "/sink?case=xhr-post");
    x.onload = () => resolve("status " + x.status); x.onerror = () => resolve("error"); x.send("x"); })`),
  evaluate(`() => navigator.sendBeacon("/sink?case=beacon", "x")`),
  evaluate(
    `() => fetch("/sink?case=keepalive-post", { method: "POST", body: "x", keepalive: true }).then(() => "sent", (e) => e.message)`,
  ),
  evaluate(
    `() => { const a = document.createElement("a"); a.href = "/?x=1"; a.ping = "/sink?case=a-ping"; document.body.append(a); a.click(); return "clicked"; }`,
  ),
  settle,
];

const channelWrites: Step[] = [
  navigate("/"),
  evaluate(`() => new Promise((resolve) => { const ws = new WebSocket("ws://127.0.0.1:8711/ws?case=websocket");
    ws.onopen = () => { ws.send("hello"); resolve("open"); }; ws.onclose = () => resolve("closed"); ws.onerror = () => resolve("error");
    setTimeout(() => resolve("timeout"), 3000); })`),
  evaluate(
    `() => new Promise((resolve) => { const w = new Worker("/worker.js"); w.onmessage = (e) => resolve(e.data); setTimeout(() => resolve("timeout"), 3000); })`,
  ),
  evaluate(`() => new Promise((resolve) => { try { const w = new SharedWorker("/shared.js"); w.port.onmessage = (e) => resolve(e.data);
    setTimeout(() => resolve("timeout"), 3000); } catch (error) { resolve("throws " + error.message); } })`),
  evaluate(
    `() => [typeof SharedWorker, typeof RTCPeerConnection, typeof WebTransport].join(",")`,
    "undefined,undefined,undefined",
  ),
  evaluate(`() => { try { window.fetch = () => Promise.resolve(new Response("")); } catch {} delete window.SharedWorker;
    return fetch("/sink?case=restored-fetch", { method: "POST", body: "x" }).then(() => "sent", (e) => e.message); }`),
  evaluate(
    `() => { const f = document.createElement("iframe"); document.body.append(f);
    return "iframe " + typeof f.contentWindow.SharedWorker + " " + f.contentWindow.navigator.sendBeacon("/sink?case=iframe-beacon", "x"); }`,
    "iframe undefined false",
  ),
  evaluate(`() => new Promise((resolve) => { const f = document.createElement("iframe");
    f.srcdoc = '<form method=post action="${SITE}/sink?case=iframe-form-post"></form><script>document.forms[0].submit()<\\/script>';
    document.body.append(f); setTimeout(() => resolve("done"), 1500); })`),
  navigate("/sw-page"),
  evaluate(`async () => window.swResult`),
  settle,
];

const tabWrites: Step[] = [
  navigate("/"),
  evaluate(`() => { window.open("/autopost?tag=window-open-autopost"); return "opened"; }`),
  settle,
  tabs({ action: "select", index: 0 }),
  navigate("/form-blank"),
  evaluate(`() => { document.getElementById("f").submit(); return "submitted"; }`),
  settle,
  tabs({ action: "new", url: `${SITE}/autopost?tag=tabs-new-autopost` }),
  settle,
  tabs({
    action: "new",
    isolatedContext: "other",
    url: `${SITE}/autopost?tag=isolated-context-autopost`,
  }),
  settle,
  navigate(`${OTHER_ORIGIN}/?case=other-origin-get`),
  tabs({ action: "select", index: 0 }),
  navigate("/"),
  evaluate(
    `() => fetch("${OTHER_ORIGIN}/sink?case=other-origin-post", { method: "POST", mode: "no-cors", body: "x" }).then(() => "sent", (e) => e.message)`,
  ),
  // Known gap: a GET redirect to an origin off the allowlist gets through. Reported, not failed.
  navigate("/redirect-out"),
  settle,
];

const GUARDED_STEPS: Step[] = [
  ...pageWrites,
  ...channelWrites,
  ...writesDuringUnload,
  ...tabWrites,
];

const LEFTOVER_WORKER_SETUP: Step[] = [
  navigate("/sw-page"),
  evaluate(
    `async () => { await window.swResult; await navigator.serviceWorker.ready; return "active " + Boolean((await navigator.serviceWorker.getRegistration()).active); }`,
    "active true",
  ),
];

const LEFTOVER_WORKER_STEPS: Step[] = [
  navigate("/"),
  evaluate(
    `async () => { const r = await navigator.serviceWorker.getRegistration(); r?.active?.postMessage("x"); return "active " + Boolean(r?.active); }`,
  ),
  settle,
];

export type { Step };
export { GUARDED_STEPS, LEFTOVER_WORKER_SETUP, LEFTOVER_WORKER_STEPS };
