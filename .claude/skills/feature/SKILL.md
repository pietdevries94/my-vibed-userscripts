---
name: feature
description: Add or change a feature of a script, test-first against fixtures. Use for any change to what a script does on its website.
---

# Feature

Read `mode` in `<script>/script.json` first. A sealed script needs fixtures before any feature work; without them, switch to `sealed-capture`.

## Loop

1. **Red**: write a failing test.
   - Unit tests sit next to the code as `*.test.ts`, with small invented inputs in the test.
   - Tests that read `<script>/fixtures/` are named `*.fixtures.test.ts`. They skip when fixtures are missing; `npm run test:fixtures <script>` runs them for real.
2. **Green**: the smallest change that passes. `npm test <script>`.
3. Repeat until the feature is complete, then `npm run precommit` and commit.

Code that only this script needs stays in `<script>/src/`. A file moves to `shared/` only when a second script needs it, never as a copy.

## Fake site

Build `<script>/fake-site/` only for a sealed script, or for a feature that reacts to change over time (polling, reloads). It runs on `http://localhost:8787` on the shared base in `shared/dev/fake-site`, with routes, state, named actions under `/__dev`, and stand-in labels for masked names. Check every feature there in the `fake-site` browser. Details: `docs/spec/sealed-workflow.md`, section "Fake site".

## Dev loop and hand-off

- `npm run dev <script>` rebuilds `dist/dev/<script>.user.js`, serves it on `:8786` and starts the fake site.
- Hand-off: tell the owner what changed and the exact list to check on the real site. The owner disables the release script while the dev script runs. Their report in chat ends the feature.
- When the owner reports a problem on a sealed site, ask for a new capture of that page. Its script log helps reproduce it.
