// Captures scrubbed test fixtures from an Azure DevOps pull request list page.
//
// Usage: open an Azure DevOps page, paste this file into the browser console, run it.
// It sends GET requests only.
//   On a PR list page it downloads two files:
//     pr-list-<page kind>.html             the page markup
//     policy-evaluations-<page kind>.json  the policy evaluations of each listed PR
//   On any other page (a pull request, for example) it downloads one file:
//     page-<page kind>.html                the page markup
// Read the files before committing them to fixtures/.
//
// Scrubbing is an allowlist. Anything not listed below is replaced:
//   kept      tag names, class names, structural attributes, SVG geometry,
//             JSON keys, booleans, policy status values, policy type id and name,
//             the fixed route words of image and link URLs ("_apis", "_workitems", "edit")
//   masked    labels (aria-label, alt, title), ids, data attributes and text: every letter becomes
//             x or X and every digit 0. Length, case and punctuation remain,
//             so "Elst, Tomas van" becomes "Xxxxx, Xxxx xx".
//   replaced  all other strings, all numbers, GUIDs, dates, links
(async () => {
  const PLACEHOLDER = "<scrubbed>";
  const PLACEHOLDER_DATE = "2000-01-01T00:00:00Z";
  const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

  // ---- Pseudonyms: the same real value always maps to the same fake value ----

  const fakeNumbers = new Map();
  const fakeNumber = (realNumber) => {
    if (!fakeNumbers.has(realNumber)) fakeNumbers.set(realNumber, 1001 + fakeNumbers.size);
    return fakeNumbers.get(realNumber);
  };

  const fakeGuids = new Map();
  const fakeGuid = (realGuid) => {
    const key = realGuid.toLowerCase();
    if (!fakeGuids.has(key)) {
      const sequence = String(fakeGuids.size + 1).padStart(12, "0");
      fakeGuids.set(key, `00000000-0000-4000-8000-${sequence}`);
    }
    return fakeGuids.get(key);
  };

  const fakeNames = new Map();
  const fakeName = (kind, realName) => {
    const key = `${kind}:${realName.toLowerCase()}`;
    if (!fakeNames.has(key)) {
      const sameKindCount = [...fakeNames.keys()].filter((k) => k.startsWith(`${kind}:`)).length;
      fakeNames.set(key, `${kind}-${sameKindCount + 1}`);
    }
    return fakeNames.get(key);
  };

  // ---- Locating pull requests on the page ----

  const isLegacyHost = location.hostname !== "dev.azure.com";
  const firstPathSegment = location.pathname.split("/")[1] ?? "";
  const apiBase = isLegacyHost
    ? firstPathSegment === "DefaultCollection"
      ? "/DefaultCollection"
      : ""
    : `/${firstPathSegment}`;
  const apiBaseSegmentCount = apiBase.split("/").filter(Boolean).length;

  const parsePullRequestHref = (href) => {
    const segments = new URL(href, location.origin).pathname
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    const gitIndex = segments.indexOf("_git");
    const pullRequestIndex = segments.indexOf("pullrequest");
    const pullRequestId = Number(segments[pullRequestIndex + 1]);
    if (gitIndex < 0 || pullRequestIndex < 0 || !Number.isInteger(pullRequestId)) return null;
    const repository = segments[gitIndex + 1];
    // ADO omits the project segment when the repository has the project's name.
    const project = gitIndex > apiBaseSegmentCount ? segments[gitIndex - 1] : repository;
    return { project, repository, pullRequestId };
  };

  const fakePullRequestHref = ({ project, repository, pullRequestId }) =>
    `/fake-org/${fakeName("project", project)}/_git/${fakeName("repo", repository)}` +
    `/pullrequest/${fakeNumber(pullRequestId)}`;

  const pullRequests = new Map();
  for (const link of document.querySelectorAll('a[href*="/pullrequest/"]')) {
    const pullRequest = parsePullRequestHref(link.getAttribute("href"));
    if (pullRequest) pullRequests.set(pullRequest.pullRequestId, pullRequest);
  }
  const isListPage = /\/(pullrequests|_pulls)$/.test(location.pathname.replace(/\/$/, ""));
  if (isListPage && pullRequests.size === 0) {
    console.error(
      "capture-fixtures: no pull request links found on this list page. Nothing captured.",
    );
    return;
  }

  // ---- Scrubbing JSON ----

  const KEPT_STRING_RULES = [
    { path: /(^|\.)status$/, value: /^[A-Za-z]{1,30}$/ },
    { path: /configuration\.type\.id$/, value: GUID },
    { path: /configuration\.type\.displayName$/, value: /^[\w ]{1,60}$/ },
  ];

  const scrubString = (value, path) => {
    if (KEPT_STRING_RULES.some((kept) => kept.path.test(path) && kept.value.test(value)))
      return value;
    if (GUID.test(value)) return fakeGuid(value);
    if (ISO_DATE.test(value)) return PLACEHOLDER_DATE;
    if (/^\d+$/.test(value)) return String(fakeNumber(Number(value)));
    return PLACEHOLDER;
  };

  const scrubJson = (value, path = "") => {
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") return fakeNumber(value);
    if (typeof value === "string") return scrubString(value, path);
    if (Array.isArray(value)) return value.map((item) => scrubJson(item, path));
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        scrubJson(child, path ? `${path}.${key}` : key),
      ]),
    );
  };

  // ---- Fetching policy evaluations ----

  const RATE_LIMIT_HEADERS = [
    "retry-after",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-cost",
    "x-ratelimit-delay",
  ];

  const getJson = async (url) => {
    const response = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const rateLimit = {};
    for (const header of RATE_LIMIT_HEADERS) {
      const headerValue = Number(response.headers.get(header));
      if (response.headers.has(header) && Number.isFinite(headerValue))
        rateLimit[header] = headerValue;
    }
    return {
      httpStatus: response.status,
      rateLimit,
      body: response.ok ? await response.json() : null,
    };
  };

  const projectGuids = new Map();
  const getProjectGuid = async (project) => {
    if (!projectGuids.has(project)) {
      const response = await getJson(
        `${apiBase}/_apis/projects/${encodeURIComponent(project)}?api-version=7.1`,
      );
      projectGuids.set(project, response.body?.id ?? null);
    }
    return projectGuids.get(project);
  };

  const evaluationsByPullRequestId = {};
  for (const pullRequest of isListPage ? pullRequests.values() : []) {
    const projectGuid = await getProjectGuid(pullRequest.project);
    if (!projectGuid) continue;
    const artifactId = `vstfs:///CodeReview/CodeReviewId/${projectGuid}/${pullRequest.pullRequestId}`;
    const response = await getJson(
      `${apiBase}/${projectGuid}/_apis/policy/evaluations` +
        `?artifactId=${encodeURIComponent(artifactId)}&api-version=7.1-preview.1`,
    );
    evaluationsByPullRequestId[fakeNumber(pullRequest.pullRequestId)] = {
      httpStatus: response.httpStatus,
      rateLimit: response.rateLimit,
      body: response.body && scrubJson(response.body),
    };
  }

  // ---- Scrubbing the DOM ----

  const DROPPED_ELEMENTS = new Set([
    "script",
    "style",
    "iframe",
    "noscript",
    "link",
    "meta",
    "object",
    "embed",
    "template",
  ]);
  const STRUCTURAL_ATTRIBUTES = new Set([
    "role",
    "type",
    "tabindex",
    "colspan",
    "rowspan",
    "scope",
    "dir",
    "hidden",
    "disabled",
    "focusable",
    "aria-hidden",
    "aria-expanded",
    "aria-selected",
    "aria-checked",
    "aria-disabled",
    "aria-busy",
    "aria-haspopup",
    "aria-level",
    "aria-rowindex",
    "aria-colindex",
    "aria-rowcount",
    "aria-colcount",
    "aria-setsize",
    "aria-posinset",
    "aria-sort",
    "aria-current",
    "aria-orientation",
    "aria-live",
  ]);
  const SVG_GEOMETRY_ATTRIBUTES = new Set([
    "viewBox",
    "d",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "width",
    "height",
    "points",
    "transform",
    "fill",
    "fill-rule",
    "clip-rule",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "opacity",
    "xmlns",
  ]);
  const MASKED_ATTRIBUTES = new Set(["aria-label", "alt", "title"]);
  const maskText = (text) =>
    text.replace(/\p{L}|\d/gu, (character) =>
      /\d/.test(character) ? "0" : character === character.toLowerCase() ? "x" : "X",
    );

  // Keeps only the fixed route words of an image URL, to tell avatar images
  // from other images: "/*/_apis/GraphProfile/MemberAvatars/*".
  const imageRouteShape = (src) => {
    if (src.startsWith("data:")) return "data:";
    let isPastRouteMarker = false;
    return new URL(src, location.origin).pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => {
        if (segment.startsWith("_")) isPastRouteMarker = true;
        return isPastRouteMarker && /^_?[A-Za-z]+$/.test(segment) ? segment : "*";
      })
      .join("/");
  };

  // Keeps only ADO's own route words of a link, to see where a link goes
  // without its names: "*/*/_workitems/edit/0".
  const LINK_ROUTE_WORDS = new Set(["edit", "board", "backlog", "t", "results"]);
  const linkRouteShape = (href) =>
    new URL(href, location.origin).pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => {
        if (/^_[A-Za-z]+$/.test(segment) || LINK_ROUTE_WORDS.has(segment)) return segment;
        return /^\d+$/.test(segment) ? "0" : "*";
      })
      .join("/");

  const VALUE_SCRUBBED_ATTRIBUTES = new Set(["placeholder", "name", "for", "value"]);
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

  const scrubAttribute = (element, name, value) => {
    if (name === "class") return value;
    if (name === "id") return /^__bolt-[\w-]+$/.test(value) ? value : maskText(value);
    if (name === "href") {
      const pullRequest = parsePullRequestHref(value);
      return pullRequest ? fakePullRequestHref(pullRequest) : "#";
    }
    if (name === "datetime") return PLACEHOLDER_DATE;
    if (MASKED_ATTRIBUTES.has(name)) return maskText(value);
    if (name === "style")
      return /^[\w\s:;.,%()#-]*$/.test(value) && !value.includes("url(") ? value : null;
    if (STRUCTURAL_ATTRIBUTES.has(name)) return /^[\w-]{0,20}$/.test(value) ? value : null;
    if (element.namespaceURI === SVG_NAMESPACE && SVG_GEOMETRY_ATTRIBUTES.has(name)) {
      return /https?:|data:/i.test(value) ? null : value;
    }
    if (name.startsWith("data-")) return maskText(value);
    if (VALUE_SCRUBBED_ATTRIBUTES.has(name) || name.startsWith("aria-")) return PLACEHOLDER;
    return null;
  };

  const fixtureDocument = document.implementation.createHTMLDocument("");

  const scrubNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return fixtureDocument.createTextNode(maskText(node.data));
    }
    if (node.nodeType !== Node.ELEMENT_NODE || DROPPED_ELEMENTS.has(node.localName)) return null;
    const scrubbed = fixtureDocument.createElementNS(node.namespaceURI, node.localName);
    if (
      node.localName === "a" &&
      node.getAttribute("href") &&
      !parsePullRequestHref(node.getAttribute("href"))
    ) {
      scrubbed.setAttribute("data-href-shape", linkRouteShape(node.getAttribute("href")));
    }
    if (node.localName === "img" && node.getAttribute("src")) {
      scrubbed.setAttribute("data-src-shape", imageRouteShape(node.getAttribute("src")));
    }
    for (const { name, value } of node.attributes) {
      const scrubbedValue = scrubAttribute(node, name, value);
      if (scrubbedValue === null) continue;
      try {
        scrubbed.setAttribute(name, scrubbedValue);
      } catch {
        // Attribute name is not valid for setAttribute. Leave it out.
      }
    }
    for (const child of node.childNodes) {
      const scrubbedChild = scrubNode(child);
      if (scrubbedChild) scrubbed.append(scrubbedChild);
    }
    return scrubbed;
  };

  // Other pages show avatars outside the content area too, so they are captured whole.
  const captureRoot = (isListPage && document.querySelector(".page-content")) || document.body;
  const pageHtml = scrubNode(captureRoot).outerHTML;

  // ---- Output ----

  const pageKind = !isListPage
    ? location.pathname.includes("/pullrequest/")
      ? "pull-request"
      : location.pathname.includes("/_boards/")
        ? "board"
        : "other"
    : location.pathname.includes("/_pulls")
      ? "my-pull-requests"
      : "repository-pull-requests";
  const bodyStyle = getComputedStyle(document.body);
  const STATUS_COLOR_VARIABLES = [
    "--component-status-success",
    "--component-status-error",
    "--component-status-warning",
    "--component-status-info",
    "--component-status-neutral",
  ];

  const evaluationsJson = JSON.stringify(
    {
      meta: {
        pageKind,
        isLegacyHost,
        capturedRootSelector: captureRoot === document.body ? "body" : ".page-content",
        pullRequestCount: pullRequests.size,
        projectGuids: Object.fromEntries(
          [...projectGuids]
            .filter(([, guid]) => guid)
            .map(([project, guid]) => [fakeName("project", project), fakeGuid(guid)]),
        ),
        statusColors: Object.fromEntries(
          STATUS_COLOR_VARIABLES.map((variable) => [
            variable,
            bodyStyle.getPropertyValue(variable).trim(),
          ]),
        ),
      },
      evaluationsByPullRequestId,
    },
    null,
    2,
  );

  const realNames = new Set([
    isLegacyHost ? location.hostname.split(".")[0] : firstPathSegment,
    ...[...pullRequests.values()].flatMap(({ project, repository }) => [project, repository]),
  ]);
  const leakedNames = [...realNames].filter(
    (name) =>
      name.length >= 3 && (pageHtml + evaluationsJson).toLowerCase().includes(name.toLowerCase()),
  );
  if (leakedNames.length > 0) {
    console.warn(
      "capture-fixtures: these org, project or repo names still occur in the output. " +
        "It can be a coincidence (a CSS class with the same word). Check before committing:",
      leakedNames,
    );
  }

  const downloadFile = (fileName, text, mimeType) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: mimeType }));
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  if (isListPage) {
    downloadFile(`pr-list-${pageKind}.html`, pageHtml, "text/html");
    downloadFile(`policy-evaluations-${pageKind}.json`, evaluationsJson, "application/json");
    console.log(
      `capture-fixtures: captured ${pullRequests.size} pull requests. Two files downloaded.`,
    );
  } else {
    downloadFile(`page-${pageKind}.html`, pageHtml, "text/html");
    console.log("capture-fixtures: captured the page markup. One file downloaded.");
  }
})();
