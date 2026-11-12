---
name: feature
description: Add or change a feature of a script, test-first against fixtures. Use for any change to what a script does on its website.
---

# Feature

Read `mode` in `<script>/script.json` first. A sealed script needs fixtures before any feature work; without them, switch to `sealed-capture`.

## Scope

Change only the parts the owner names. When a word could mean two parts of the page, such as "header", ask which one before changing anything.

## Loop

1. **Red**: write a failing test.
   - Unit tests sit next to the code as `*.test.ts`, with small invented inputs in the test.
   - Tests that read `<script>/fixtures/` are named `*.fixtures.test.ts`. They skip when fixtures are missing; `npm run test:fixtures <script>` runs them for real.
2. **Green**: the smallest change that passes. `npm test <script>`.
3. Repeat until the feature is complete, then `npm run precommit` and commit.

Code that only this script needs stays in `<script>/src/`. A file moves to `shared/` only when a second script needs it, never as a copy.

## Fake site

Build `<script>/fake-site/` only for a sealed script, or for a feature that reacts to change over time (polling, reloads). It runs on `http://localhost:8787` on the shared base in `shared/dev/fake-site`, with routes, state, named actions under `/__dev`, and stand-in labels for masked names. Check every feature there in the `fake-site` browser. Details: `docs/spec/sealed-workflow.md`, section "Fake site".

- The `fake-site` tools load when a session starts. Run `npm run dev <script>` before opening a page.
- A feature that polls waits for its own interval. Change a value the script polls soon, or wait the interval out, before calling a check failed.

## Dev loop and hand-off

- `npm run dev <script>` rebuilds `dist/dev/<script>.user.js`, serves it on `:8786` and starts the fake site.
- Claude starts `npm run dev <script>` itself, in the background, before the hand-off or a fake-site check. It stops the server once the owner has reported back or it is no longer needed. When a port is taken, Claude finds the process and asks before stopping one it did not start.
- Every hand-off that needs the dev script, captures included, gives its link: `http://localhost:8786/<script>.user.js`.
- Hand-off: tell the owner what changed and the exact list to check on the real site. The owner disables the release script while the dev script runs. Their report in chat ends the feature.
- When the owner reports a problem on a sealed site, ask for a new capture of that page. Its script log helps reproduce it.
