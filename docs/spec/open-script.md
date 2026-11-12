# Open script

For an open script, Claude may read the real site in a browser the owner is signed in to. It never changes anything there. These rules live in the `real-site` skill. The read-only guard, the allowlist and the deny rules are the backstop when the skill does not load.

## Tooling

Full findings with sources: `docs/research/read-only-site-access.md`.

- Nothing ready-made drives Zen. Playwright does not drive branded Firefox. Playwright MCP's attach modes (`--extension`, `--cdp-endpoint`) are Chromium only. Claude in Chrome needs Chromium, has no network-level control, and is advised against for work accounts.
- Zen is reachable only over Firefox's Remote Agent. That needs a restart with a flag, opens an unauthenticated local port, and needs a custom client. Not used.
- Used: the Playwright MCP server with its own browser, as a second browser. The owner signs in by hand in that window, SSO and MFA included.
- Playwright MCP's docs say it is not a security boundary. The guard below plus the Claude Code deny rules make the boundary.

## Browser tools

Allowed: `browser_navigate`, `browser_navigate_back`, `browser_snapshot`, `browser_take_screenshot`, `browser_network_requests`, `browser_network_request`, `browser_console_messages`, `browser_evaluate`, `browser_tabs` (list, select, close), `browser_wait_for`, `browser_resize`.

Denied in the committed `.claude/settings.json`: `browser_click`, `browser_type`, `browser_fill_form`, `browser_select_option`, `browser_press_key`, `browser_hover`, `browser_drag`, `browser_drop`, `browser_file_upload`, `browser_handle_dialog`, `browser_run_code_unsafe`. Claude Code enforces these, not the model.

When Claude needs a state that only a click reveals, it asks the owner to click in the visible window.

`browser_evaluate` is only for reading the DOM and running the capture bundle. It never changes DOM, storage or cookies. It never reads cookies, storage or auth headers.

## Read-only guard

Technical and not optional. It lives in `shared/dev/real-site/`. Claude never starts an unguarded browser on a real site.

Three parts. Together they block every POST, PUT, PATCH, DELETE and WebSocket while GET reads still work.

1. `--init-page read-only.init-page.ts`: a context route that aborts everything but GET and HEAD (sign-in origins exempt), `routeWebSocket` that closes every socket, and a CDP pass that stops and unregisters service workers left in the profile.
2. `--init-script read-only.init-script.js`: runs in every frame before the page's scripts. It replaces `fetch` with a version that rejects anything but GET and HEAD, makes `sendBeacon` return `false`, and removes `SharedWorker`, `RTCPeerConnection` and `WebTransport`. All are locked non-writable, so the page or an iframe cannot restore them.
3. `--block-service-workers --allowed-origins "<site>;<sign-in>;<cdn>"`.

The route alone is not enough. Without the init script and the service worker cleanup, a `SharedWorker` POST, `sendBeacon` and keepalive `fetch` during `pagehide`, and a service worker left from an earlier unguarded session all got through.

Tested against a local page (Playwright MCP 0.0.85, Chrome, headless):

| Case                                                                                              | Result                 |
| ------------------------------------------------------------------------------------------------- | ---------------------- |
| Form POST (navigation)                                                                            | Blocked                |
| `fetch` POST, PUT, PATCH, DELETE; `fetch(new Request(...))`                                       | Blocked                |
| XHR POST, sync XHR POST on unload                                                                 | Blocked                |
| `sendBeacon`, also during unload and from an iframe                                               | Blocked                |
| `fetch` keepalive during unload                                                                   | Blocked                |
| `<a ping>`, iframe form POST, form POST on unload                                                 | Blocked                |
| WebSocket                                                                                         | Closed before upgrade  |
| Dedicated worker POST                                                                             | Blocked                |
| Shared worker POST                                                                                | Blocked                |
| New service worker                                                                                | Blocked: never fetched |
| Service worker from an earlier unguarded session                                                  | Unregistered           |
| First page of a fresh browser POSTs on load                                                       | Blocked                |
| New tab via `window.open`, `target=_blank` form, `browser_tabs new` (also with `isolatedContext`) | Blocked                |
| GET to an origin off the allowlist                                                                | Blocked                |
| GET 302 redirect to an origin off the allowlist                                                   | Got through (GET only) |

Known gaps:

- Redirects ignore the allowlist. Only GETs follow, so read-only holds. The allowlist is not a boundary.
- GETs with side effects pass. See the rule below.
- The service worker cleanup waits 200 ms for CDP to report registrations. A race, not seen to fail.

## `npm run test:guard`

- The guard harness, in the repo. Local page only, headed.
- Covers every case above, plus WebRTC and WebTransport, plus a check that the deny rules refuse a click.
- Runs when the repo is built, and whenever the guard or the Playwright MCP version changes.
- A failed run blocks real-site use.
- Local only. It does not run on GitHub: a headless run there tests a different setup.

## Allowlist

- One MCP entry, `real-site`, launched through a wrapper.
- The wrapper builds `--allowed-origins` from the `script.json` of every open script: site origins, sign-in origins, CDN origins.
- Sealed scripts never appear, so their sites are blocked at network level.
- Sign-in origins are exact origins, never wildcards.
- The list is built when Claude Code starts. A changed list needs a restart.

## Sign-in

- Headed browser. One persistent profile per open script, outside the repo: `~/.cache/my-vibed-userscripts/<script>/profile`.
- The owner signs in by hand. Claude never types, sees or stores credentials.
- On a sign-in page or a 401, Claude stops and asks the owner to sign in again. No retry loop.
- The first sign-in on the first open script tests the sign-in exemption, with the owner watching.

## When the guard blocks

- Claude stops the step and reports the method and URL. It never works around a block.
- A site that reads through POST (GraphQL) cannot be captured in open mode. The owner either captures it the sealed way, or adds a narrow exemption for that one endpoint in `script.json`. The owner writes or approves it.

## GETs with side effects

- Claude only navigates to page URLs it has a reason to read.
- It never opens a URL whose path or query names an action: logout, delete, approve, confirm, unsubscribe, accept and similar.
- When unsure, it asks.

## When Claude opens the site

- No permission per visit. The script and task at hand are the permission.
- Claude reports in chat which pages it opened and why.
- The first time in a session, it names the site before opening it.

## What reaches disk

- Fixtures only through the shared capture bundle, run in the page with `browser_evaluate`. Scrubbing runs in the page. Only scrubbed output comes back. Claude writes it to `<script>/fixtures/`.
- Playwright MCP output (screenshots, snapshot files, network dumps) goes to a gitignored `.real-site/` folder at the repo root, outside every script folder. It is deleted at the end of the session.
- Real values never go into code, tests, comments, commit messages, issues or the glossary. Test inputs and stand-in names are invented.

## Running the script

Claude does not run the script on the real site. It reads pages and captures fixtures there. It builds and checks against fixtures and the fake site. The owner's check in Zen is the only real-site run.

## Open to sealed

- The script's origins leave the allowlist on the next Claude Code start.
- Its browser profile and its `.real-site/` output are deleted.
- Captured fixtures stay.

## Left to the build

- How a POST exemption in `script.json` reaches both the route and the init script, which also locks `fetch`.
- What deletes `.real-site/` at the end of a session.
