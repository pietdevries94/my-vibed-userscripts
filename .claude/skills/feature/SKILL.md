---
name: feature
description: Add or change a feature of a script, test-first against fixtures. Use for any change to what a script does on its website.
---

# Feature

Read `mode` in `<script>/script.json` first. A sealed script needs fixtures before any feature work; without them, switch to `sealed-capture`.

## Scope

Change only the parts the owner names. When a word could mean two parts of the page, such as "header", ask which one before changing anything.

## Loop

0. **Guides**: when the change adds or changes markup, CSS or DOM code, load `modern-web-guidance`. Search and retrieve a guide for each UI pattern it builds, such as a dialog, a toggle button, a tree or a loading state. Done when each pattern has a retrieved guide, or a rephrased search that found none. The code follows those guides. Where the site's own markup or classes must be matched to blend in, the site wins; say so in the hand-off.
1. **Red**: write a failing test.
   - Unit tests sit next to the code as `*.test.ts`, with small invented inputs in the test.
   - Tests that read `<script>/fixtures/` are named `*.fixtures.test.ts`. They skip when fixtures are missing; `npm run test:fixtures <script>` runs them for real.
2. **Green**: the smallest change that passes. `npm test <script>`.
3. Repeat until the feature is complete, then `npm run precommit` and commit.

Code that only this script needs stays in `<script>/src/`. A file moves to `shared/` only when a second script needs it, never as a copy.

## Timing

A script is event-driven: it changes the page before the browser paints what the site rendered, so the owner never sees the page change twice.

- Re-apply after a DOM change in the next animation frame, as `azure-devops/src/core/sync-before-paint.ts` does. A settle delay shows the site's version first.
- To wait for the page, check on every DOM change (`azure-devops/src/core/next-dom-change.ts`). A timer is only the deadline to give up.
- Poll on a timer only what sends no event, such as the REST API.

## Fake site

Build `<script>/fake-site/` only for a sealed script, or for a feature that reacts to change over time (polling, reloads). It runs on `http://localhost:8787` on the shared base in `shared/dev/fake-site`, with routes, state, named actions under `/__dev`, and stand-in labels for masked names. Check every feature there in the `fake-site` browser. Details: `docs/spec/sealed-workflow.md`, section "Fake site".

- The `fake-site` tools load when a session starts. Run `npm run dev <script>` before opening a page.
- When the `fake-site` tools fail to connect, use the Playwright browser on `http://localhost:8787`. It loads no userscript: add the source of `userscriptLoaderScript` in `shared/dev/fake-site/userscript-loader.ts` with `page.addInitScript` before opening a page.
- A feature that polls waits for its own interval. Change a value the script polls soon, or wait the interval out, before calling a check failed.

## Dev loop and hand-off

- `npm run dev <script>` rebuilds `dist/dev/<script>.user.js`, serves it on `:8786` and starts the fake site.
- Claude starts `npm run dev <script>` itself, in the background, before the hand-off or a fake-site check. It stops the server once the owner has reported back or it is no longer needed. It never stops a dev server it did not start.
- Ports `8786` and `8787` are shared by every worktree of this repo. When they are taken:
  1. Find the process and its worktree: `lsof -nP -iTCP:8786 -sTCP:LISTEN`, then `lsof -a -p <pid> -d cwd -Fn`.
  2. Find the Claude session of that worktree with `ListAgents` and ask it with `SendMessage` to hand the ports over: stop its dev server and reply when the ports are free.
  3. Start the dev server after its reply. Tell the owner which session gave up the ports.
  4. Ask the owner only when no session owns the process, the session does not answer, or it still needs the ports.
- A session asked for the ports hands them over when it is not waiting on an owner's test or running a fake-site check. Otherwise it says what it waits for, and messages back once it is done. After a hand-over it asks for the ports back the same way when it needs them again.
- Every hand-off that needs the dev script, captures included, gives its link: `http://localhost:8786/<script>.user.js`.
- Hand-off: tell the owner what changed and the exact list to check on the real site. The owner disables the release script while the dev script runs. Their report in chat ends the feature.
- When the owner reports a problem on a sealed site, ask for a new capture of that page. Its script log helps reproduce it.
