# Releasing

## What a release is

- A commit on `main` that changes `dist/<script>.user.js`.
- No tags, no GitHub releases.
- `git log dist/<script>.user.js` is the release history.
- No changelog. The release commit body is the record.

## Versions

- Semver, in `script.json`.
- Only the release command bumps it. Nobody edits it by hand.
- Patch by default. `minor` or `major` when asked.
- A new script starts at `1.0.0`. When a script has no `dist/<script>.user.js` yet, the release command releases it at its current version, without a bump.

## Command

`npm run release [script] [patch|minor|major]`

- With a script name: releases that script.
- Without one: builds every script and releases each one whose built file differs from the committed `dist/<script>.user.js`, ignoring the `@version` line. This catches changes in the script's source, in `shared/runtime/` and in `script.json`. Changes to tests or `shared/dev/` never trigger a release. Every script released this way gets a patch bump. For a minor bump, release that script by name first.

## Steps

1. Refuse unless on `main`, the working tree is clean, and the branch is up to date with `origin`.
2. For each script being released, run the same set as the GitHub `checks` job (typecheck, lint, format check, unit tests, build, `check:dist`) plus `test:fixtures`. Missing fixtures fail the release.
3. Bump `version` in `script.json` (skipped for a first release).
4. Build `dist/<script>.user.js`.
5. Before the release, Claude checks each `description` against what the script does now, and rewrites a stale one. Then the command rewrites the script list in `README.md` (between `<!-- scripts:start -->` and `<!-- scripts:end -->`) from the release files: name, version, description, install link. Commit `script.json`, the dist file and `README.md` as `release <script> <version>`, one commit per script. Claude writes the body: the features changed since the last release commit of that script.
6. Push once, after all commits. The pre-push hook checks the pushed commits for fixtures.

Push failure: the command stops and prints `git pull --rebase`, then `git push`. It undoes nothing. A rerun does not bump again.

## Who and when

- Claude runs the command only after the owner says "release".
- Before that, Claude runs the detection and names the scripts that will be released, so a shared-code change does not reach a script by surprise. This is information, not a gate.
- Whether to check each script on the real site first is the owner's call.

## Rollback

Violentmonkey never downgrades. Revert the source on `main` and release again with a patch bump. There is no rollback command.

## Left to the build

- How a rerun after a push failure knows not to bump again (for example: the release commit already exists locally).
