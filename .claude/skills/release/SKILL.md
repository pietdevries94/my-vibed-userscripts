---
name: release
description: Release scripts with `npm run release`. Use when the owner says "release", and before committing a change to `shared/runtime/` or `script.json`, to name the scripts it will release.
---

# Release

A release is a commit on `main` that changes `dist/<script>.user.js`. Only the release command writes that file and bumps `version`.

1. Run `npm run release:detect`. Tell the owner which scripts it names, so a shared change reaches no script by surprise. This is information, not a gate.
2. Wait for the owner to say "release". Ask whether a script needs a minor or major bump; patch is the default.
3. Write the commit body for each script: the features changed since its last release commit (`git log <last release commit>..HEAD -- <script>/ shared/runtime/`), in the owner's words for the features. Put the bodies in a JSON file in the scratchpad: `{ "<script>": "<body>" }`.
4. Run `npm run release [script] [minor|major] -- --notes <file>`. Without a script name it releases every changed script with a patch bump; for a minor or major bump, release that script by name first.
5. Report the released versions. On a failed push the command prints the fix (`git pull --rebase`, then `git push`); a rerun does not bump again.

Rollback: revert the source on `main` and release again. Violentmonkey never downgrades.
