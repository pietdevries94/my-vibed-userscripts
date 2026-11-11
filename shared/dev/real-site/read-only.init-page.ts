// Read-only guard, network side. Playwright MCP loads it with --init-page.
// It aborts every request that is not GET or HEAD, closes every WebSocket, and
// unregisters service workers that an earlier session left in the profile.
// Sign-in origins and the owner's POST exemptions come from READ_ONLY_GUARD_CONFIG.
import type { BrowserContext, Page, Route } from "playwright-core";
import type { GuardConfig } from "./guard.ts";

const SERVICE_WORKER_REPORT_WAIT_MS = 200;
const guardedContexts = new WeakSet<BrowserContext>();

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function readConfig(): GuardConfig {
  const raw = process.env.READ_ONLY_GUARD_CONFIG ?? "{}";
  const parsed = JSON.parse(raw) as unknown;
  const config: Record<string, unknown> =
    typeof parsed === "object" && parsed !== null ? { ...parsed } : {};
  const exemptions = Array.isArray(config.postExemptions) ? config.postExemptions : [];
  return {
    postExemptions: exemptions.flatMap((exemption: unknown) =>
      typeof exemption === "object" &&
      exemption !== null &&
      "url" in exemption &&
      typeof exemption.url === "string"
        ? [{ url: exemption.url }]
        : [],
    ),
    signInOrigins: isStringList(config.signInOrigins) ? config.signInOrigins : [],
  };
}

function withoutQuery(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

function isAllowed(method: string, url: string, config: GuardConfig): boolean {
  if (method === "GET" || method === "HEAD") {
    return true;
  }
  if (config.signInOrigins.includes(new URL(url).origin)) {
    return true;
  }
  return (
    method === "POST" &&
    config.postExemptions.some((exemption) => withoutQuery(exemption.url) === withoutQuery(url))
  );
}

async function guardRequest(route: Route, config: GuardConfig): Promise<void> {
  const request = route.request();
  await (isAllowed(request.method(), request.url(), config)
    ? route.fallback()
    : route.abort("blockedbyclient"));
}

async function unregisterLeftoverServiceWorkers(
  context: BrowserContext,
  page: Page,
): Promise<void> {
  const cdp = await context.newCDPSession(page);
  const scopes = new Set<string>();
  cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
    for (const registration of registrations) {
      if (!registration.isDeleted) {
        scopes.add(registration.scopeURL);
      }
    }
  });
  await cdp.send("ServiceWorker.enable");
  // CDP reports the existing registrations shortly after enable.
  await new Promise((resolve) => {
    setTimeout(resolve, SERVICE_WORKER_REPORT_WAIT_MS);
  });
  await cdp.send("ServiceWorker.stopAllWorkers");
  await Promise.all(
    [...scopes].map(async (scopeURL) => cdp.send("ServiceWorker.unregister", { scopeURL })),
  );
  await cdp.send("ServiceWorker.disable");
}

async function guardPage({ page }: { page: Page }): Promise<void> {
  const context = page.context();
  if (guardedContexts.has(context)) {
    return;
  }
  guardedContexts.add(context);
  const config = readConfig();
  await context.route("**/*", async (route) => guardRequest(route, config));
  await context.routeWebSocket(/.*/u, async (webSocket) => webSocket.close());
  await unregisterLeftoverServiceWorkers(context, page);
}

// oxlint-disable-next-line import/no-default-export -- Playwright MCP calls the default export
export default guardPage;
