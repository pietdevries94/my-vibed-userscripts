# Agents file and skills

Goal: a clean Claude session can create a new script with the owner acting only at the marked points.

## Files

- `AGENTS.md` at the repo root. No `CLAUDE.md`. Claude Code reads `AGENTS.md` directly when no `CLAUDE.md` exists (v2.1.277+, code.claude.com/docs/en/memory).
- Skills in `.claude/skills/<name>/SKILL.md`, committed.
- This file fixes what `AGENTS.md` and the skills say. Edit them with the `writing-for-agents` skill.

## `AGENTS.md`

Only what every session needs:

- What the repo is. A pointer to `GLOSSARY.md`.
- Before any work on a script, read `mode` in its `script.json`. The mode changes only when the owner asks.
- The sealed refusals (below).
- Real values never go into code, tests, comments, commits, issues or the glossary. Stand-in names are invented.
- Before every commit: `npm run precommit`. Never `--no-verify`.
- In a new worktree: `npm run fixtures:link`.
- Push only when the owner says "push" or "release".
- Load `real-site` before using any `real-site` browser tool.
- One trigger line per skill.

## Sealed refusals

For a sealed script, Claude:

- never opens the site in any browser.
- never reads capture files before `fixtures:import` has run and the owner has skimmed them. The download folder included.
- never asks the owner for pasted HTML, responses or screenshots. It asks for a capture instead.
- does no feature work without fixtures. It hands the owner a page list instead.
- may read a screenshot the owner offers unasked, but writes none of its values anywhere.

## Skills

All loaded on demand.

- `new-script`: create a script from nothing (steps below).
- `feature`: add or change a feature. TDD against fixtures, the fake site when needed, the dev loop, the hand-off for the owner's check.
- `real-site`: open scripts only. The guarded browser, reading pages, capture through `browser_evaluate`, and every rule in [open-script.md](open-script.md): evaluate only reads, no action URLs, stop on a block or expiry, report visits. These rules are not in `AGENTS.md`. The guard, the allowlist and the deny rules are the backstop when the skill does not load.
- `sealed-capture`: the five hand-offs in [sealed-workflow.md](sealed-workflow.md), plus the open-to-sealed steps from [open-script.md](open-script.md) under one heading.
- `release`: detection, wait for the owner's "release", run the command, write the commit body. See [releasing.md](releasing.md).

## Commands

- `npm run precommit`: see [checks.md](checks.md).
- `npm run fixtures:link`: see [fixtures.md](fixtures.md).

## Pushes

Claude never pushes on its own. It pushes when the owner says "push", or as part of a release. Unpushed commits go out with the next release push.

## `new-script` steps

(O) marks an owner action.

1. (O) The owner names the website and the first feature. Claude asks the mode: open unless the owner says sealed.
2. Claude creates `<site>/`, `script.json` (name, description, `@match`, `@grant`, mode, `version` `1.0.0`, and sign-in and CDN origins when open) and `src/main.ts`. Site terms go into `GLOSSARY.md`.
3. Open: (O) the owner reconnects `real-site` in `/mcp` so the allowlist picks up the origins, then signs in when the browser opens. Claude runs `test:guard` if it has not run since the last guard change. Sealed: continue in `sealed-capture`.
4. Capture fixtures, through `real-site` or `sealed-capture`.
5. Build the feature through `feature`.
6. (O) The owner installs the dev file once from `localhost:8786` and checks on the real site.
7. (O) The owner says "release". `release` runs.

Sealed to open needs only step 3.

## `.claude/settings.json`

Committed. Holds:

- The deny rules for the `real-site` browser tools ([open-script.md](open-script.md)).
- The MCP entries `real-site` and `fake-site`.
- Auto-memory off.

## Lessons

- Auto-memory is off for the repo.
- When the owner corrects a session, or a session hits a gap, Claude edits `AGENTS.md` or the skill in that session and commits it.

## Trial

- A fresh session in a fresh worktree gets one prompt: "Create a script for <site> that does <X>."
- It gets no help beyond the owner's (O) actions.
- The site is a small open site the owner picks at trial time. This is the first check against a second site.
- The owner judges. Pass: the dev script works on the real site, checks are green, and the owner acted only at the (O) points.
- Every other question the session asks is a gap. It is fixed in `AGENTS.md` or a skill.
