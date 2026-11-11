# my-vibed-userscripts

Public repo of Violentmonkey userscripts, one script per website. Use the terms in `GLOSSARY.md`. The decisions behind the repo are in `docs/spec/`.

## Before work on a script

Read `mode` in `<script>/script.json`: `open` or `sealed`. Only the owner changes it.

## Sealed scripts

For a sealed script, Claude:

- never opens its site, in any browser.
- reads capture files only after `npm run fixtures:import` has run and the owner has skimmed them. The download folder stays unread.
- asks the owner for a capture, never for pasted HTML, responses or screenshots.
- does feature work only against fixtures. Without them, it hands the owner a page list (`sealed-capture`).
- may read a screenshot the owner offers unasked, and writes none of its values anywhere.

## Real values

The repo is public. Real values from a site stay out of code, tests, comments, commit messages, issues and the glossary. Test inputs are invented. Stand-in names are invented too, never the owner's or a colleague's.

## Commits and pushes

- Run `npm run precommit` before every commit. Never use `--no-verify`.
- Push only when the owner says "push" or "release".
- In a new worktree, run `npm run fixtures:link` first.

## Skills

- `new-script`: create a script for a new website.
- `feature`: add or change a feature of a script.
- `real-site`: load before any `real-site` browser tool.
- `sealed-capture`: get fixtures for a sealed script, or turn an open script sealed.
- `release`: the owner says "release", or a change touches `shared/runtime/`.

## Lessons

When the owner corrects you, or you hit a gap, fix this file or the skill in the same session and commit it.
