---
name: release
description: Release scripts with `npm run release`. Use when the owner says "release", and before committing a change to `shared/runtime/` or `script.json`, to name the scripts it will release.
---

# Release

A release is a commit on `main` that changes `dist/<script>.user.js`. Only the release command writes that file and bumps `version`.

Release from the main checkout, on `main`. From a worktree branch: stop if the main checkout has uncommitted changes, otherwise `git -C <main checkout> merge --ff-only <branch>` and run the steps there. Name any other unpushed commits on `main` to the owner first; the release pushes them too.

1. Run `npm run release:detect`. Tell the owner which scripts it names, so a shared change reaches no script by surprise. This is information, not a gate.
2. Wait for the owner to say "release". Ask whether a script needs a minor or major bump; patch is the default. Skip the question for a first release: it keeps the version in `script.json`.
3. Check each script's `description` in `script.json` against what the script does now. It is the script's line in Violentmonkey and in `README.md`. Rewrite a stale one and commit it before releasing.
4. Write the commit body for each script: the features changed since its last release commit (`git log <last release commit>..HEAD -- <script>/ shared/runtime/`), in the owner's words for the features. Put the bodies in a JSON file in the scratchpad: `{ "<script>": "<body>" }`.
5. Run `npm run release [script] [minor|major] -- --notes <file>`. Without a script name it releases every changed script with a patch bump; for a minor or major bump, release that script by name first.
6. Report the released versions. The command also rewrites the script list in `README.md`; a script's `description` in `script.json` is its line there. On a failed push the command prints the fix (`git pull --rebase`, then `git push`); a rerun does not bump again.

Rollback: revert the source on `main` and release again. Violentmonkey never downgrades.
