---
name: real-site
description: Rules for reading the real website of an open script in the guarded `real-site` browser, and for capturing fixtures there. Load before any `mcp__real-site__*` tool call.
---

# Real site

Open scripts only. For a sealed script, stop: its site is never opened.

The `real-site` browser is read-only. The guard blocks every request except GET and HEAD, the allowlist holds only open scripts' origins, and Claude Code denies clicking and typing. Treat a block as a stop sign, never as a puzzle.

## Visiting

- The first time in a session, name the site before opening it. No permission per visit after that.
- Open only page URLs you have a reason to read.
- Never open a URL whose path or query names an action: logout, delete, approve, confirm, unsubscribe, accept and similar. When unsure, ask.
- When a state needs a click, ask the owner to click in the visible window.
- Report in chat which pages you opened and why.

## Tools

- Use only: `browser_navigate`, `browser_navigate_back`, `browser_snapshot`, `browser_take_screenshot`, `browser_network_requests`, `browser_network_request`, `browser_console_messages`, `browser_evaluate`, `browser_tabs` (list, select, close), `browser_wait_for`, `browser_resize`.
- `browser_evaluate` only reads the DOM or runs the capture bundle. It leaves DOM, storage and cookies untouched, and never reads cookies, storage or auth headers.

## Stops

- A sign-in page or a 401: stop and ask the owner to sign in again. No retries.
- The guard blocks a request: stop the step and report the method and URL. A site that reads through POST needs an exemption in `script.json` (`postExemptions`) that the owner writes or approves, or the sealed workflow.
- The `real-site` entry fails to start: run `npm run test:guard`, or, after an allowlist change, ask the owner to reconnect `real-site` in `/mcp`.

## What reaches disk

- Fixtures come only from the shared capture bundle, run in the page with `browser_evaluate`. Scrubbing runs in the page; write only the scrubbed output to `<script>/fixtures/`.
- Screenshots, snapshots and network dumps go to `.real-site/`, which is deleted at session end.
- Real values never go into code, tests, comments, commits, issues or the glossary.

You do not run the script on the real site. That is the owner's check in Zen.
