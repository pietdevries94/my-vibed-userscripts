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

- Run `npm run precommit` before every commit, and commit only when it exits 0. A pipe such as `| tail` hides its exit code, and `;` before `git commit` ignores it: chain the commit with `&&`. Never use `--no-verify`.
- Format with `npm run format` (oxfmt). Never run prettier: it rewraps lines oxfmt leaves alone.
- Push only when the owner says "push" or "release".
- In a new worktree, run `npm ci` and `npm run fixtures:link` first. When `fixtures:link` leaves a `fixtures` folder alone because it is not a link, and the folder is empty, remove it and run the link again.

## Skills

- `new-script`: create a script for a new website.
- `feature`: add or change a feature of a script.
- `restyle`: restyle a whole script into another look, such as Windows 98 mode.
- `real-site`: load before any `real-site` browser tool.
- `sealed-capture`: get fixtures for a sealed script, or turn an open script sealed.
- `release`: the owner says "release", or a change touches `shared/runtime/` or `shared/styles/`.
- `modern-web-guidance`: before writing markup, CSS or DOM code.

## Dev server

`npm run dev` takes fixed ports 8786 and 8787, so only one worktree runs it at a time. If another worktree holds them, never kill its server. Ask that session over SendMessage to release them. Run tests and precommit without the dev server, and stop it as soon as a fake-site check is done.

## Browser support

Scripts run only in the owner's current Chrome and Firefox. A web feature that ships in both needs no fallback, Baseline Newly available included.

## Storage

A script that stores a value per item, such as one key per pull request, deletes stale ones when it starts: every value unused for 30 days, and every value it cannot read. Each feature's `index.ts` sets the age, as `azure-devops/src/features/review/index.ts` does.

## Waiting

Never wait a fixed time as the normal path. React to the event (observer, callback, promise). A timeout is only a safety cap.

## Lessons

When the owner corrects you, or you hit a gap, fix this file or the skill in the same session and commit it.
