// The requests of the Azure DevOps client, with the page's session cookie.
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

interface AdoClientOptions {
  origin: string;
  apiBasePath: string;
  fetch: Fetch;
}

/** The fields the client reads from Azure DevOps responses. */
interface ResponseBody {
  id?: string;
  authenticatedUser?: { id?: string };
  value?: unknown[];
  records?: unknown[];
}

interface JsonResponse {
  body: ResponseBody;
  retryAfterSeconds: number | null;
}

class AdoRequestError extends Error {
  public readonly httpStatus: number;
  public readonly retryAfterSeconds: number | null;

  public constructor(httpStatus: number, retryAfterSeconds: number | null) {
    super(`Azure DevOps request failed with HTTP ${httpStatus}`);
    this.name = "AdoRequestError";
    this.httpStatus = httpStatus;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function retryAfterSecondsOf(response: Response): number | null {
  const retryAfter = Number(response.headers.get("Retry-After"));
  return response.headers.has("Retry-After") && Number.isFinite(retryAfter) ? retryAfter : null;
}

/** A request that changes something, with its JSON body. */
interface WriteRequest {
  method: "PATCH" | "POST" | "PUT";
  body: unknown;
}

/** A GET, or with `write` a request that changes something. Throws when Azure DevOps refuses. */
async function sendRequest(
  options: AdoClientOptions,
  path: string,
  write?: WriteRequest,
): Promise<Response> {
  const accept = { Accept: "application/json" };
  const response = await options.fetch(options.origin + options.apiBasePath + path, {
    credentials: "same-origin",
    ...(write === undefined
      ? { headers: accept, method: "GET" }
      : {
          body: JSON.stringify(write.body),
          headers: { ...accept, "Content-Type": "application/json" },
          method: write.method,
        }),
  });
  if (!response.ok) {
    throw new AdoRequestError(response.status, retryAfterSecondsOf(response));
  }
  return response;
}

async function getJson(options: AdoClientOptions, path: string): Promise<JsonResponse> {
  const response = await sendRequest(options, path);
  const retryAfterSeconds = retryAfterSecondsOf(response);
  // A run that has not started has no timeline; Azure DevOps answers `null`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Azure DevOps responses are trusted and not checked
  return { body: ((await response.json()) as ResponseBody | null) ?? {}, retryAfterSeconds };
}

export type { AdoClientOptions, JsonResponse, WriteRequest };
export { AdoRequestError, getJson, sendRequest };
