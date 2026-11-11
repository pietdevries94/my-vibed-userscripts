// Read-only guard, page side. guard.ts strips the types, writes READ_ONLY_GUARD_CONFIG
// in front, and Playwright MCP adds the result with --init-script. It runs in every
// frame before the page's scripts, and closes channels that request routing misses:
// SharedWorker, sendBeacon and keepalive fetch during unload, WebRTC and WebTransport.
// Each replacement is locked, so the page or an iframe cannot restore it.

interface InitScriptConfig {
  signInOrigins: string[];
  postExemptions: { url: string }[];
}

declare const READ_ONLY_GUARD_CONFIG: InitScriptConfig | undefined;

((): void => {
  const config: InitScriptConfig =
    typeof READ_ONLY_GUARD_CONFIG === "object"
      ? READ_ONLY_GUARD_CONFIG
      : { postExemptions: [], signInOrigins: [] };
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- inside the IIFE, so the page gets no new globals
  const withoutQuery = (url: string): string => {
    const parsed = new URL(url, location.href);
    return `${parsed.origin}${parsed.pathname}`;
  };
  const isAllowed = (request: Request): boolean => {
    if (request.method === "GET" || request.method === "HEAD") {
      return true;
    }
    if (config.signInOrigins.includes(new URL(request.url).origin)) {
      return true;
    }
    const target = withoutQuery(request.url);
    return (
      request.method === "POST" &&
      config.postExemptions.some((exemption) => withoutQuery(exemption.url) === target)
    );
  };
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- inside the IIFE, so the page gets no new globals
  const lock = (target: object, name: string, value?: unknown): void => {
    Object.defineProperty(target, name, { configurable: false, value, writable: false });
  };

  const realFetch = globalThis.fetch;
  lock(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = new Request(input, init);
      if (!isAllowed(request)) {
        throw new TypeError(`read-only guard blocked ${request.method} ${request.url}`);
      }
      return realFetch(request);
    },
  );
  lock(Navigator.prototype, "sendBeacon", () => false);
  for (const name of [
    "SharedWorker",
    "RTCPeerConnection",
    "webkitRTCPeerConnection",
    "WebTransport",
  ]) {
    lock(globalThis, name);
  }
})();
