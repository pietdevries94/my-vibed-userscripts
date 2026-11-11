# Checks

## What a failed check blocks

Nothing. There is no ruleset. The owner and Claude push to `main` directly. A red check is fixed with a new commit.

## Pre-push hook

The only git hook.

- `.githooks/pre-push`, committed.
- `package.json` has `"prepare": "git config core.hooksPath .githooks"`, so `npm install` enables it. No hook package. Worktrees share the config.
- It checks every commit in the pushed range, not only the tip. For a new branch, it checks the commits not on `origin/main`.
- Any path with a `fixtures` segment refuses the push and prints the commit and the path.
- Claude never uses `--no-verify`.

## GitHub workflow

One file: `.github/workflows/checks.yml`. Runs on push to any branch and on `pull_request`. Every check runs for every script.

### Job `fixtures`

- Full-history checkout.
- The same path check as the pre-push hook, over the pushed range or the PR's commits.
- No `npm ci`, so it reports even when the build breaks.
- A detector only. On a public repo a pushed fixture has already leaked. On a hit, rewrite history and treat the data as leaked.

### Job `checks`

1. `npm ci` on Node 26, from `.nvmrc`.
2. Typecheck: `tsc --noEmit`.
3. `npm run lint`.
4. `npm run format:check`.
5. Unit tests. Fixture tests skip.
6. Build every script to `dist/dev/`.
7. `npm run check:dist`.

## `check:dist`

A Node script in `build/`, runnable locally. For each `dist/<script>.user.js` changed between the push's `before` commit (or the PR base) and the tip:

- `@version` is higher than before, by semver compare.
- `@version` equals `version` in the script's `script.json`.
- A fresh build at the tip gives exactly the committed file. The build must be reproducible: fixed esbuild options, no timestamp.

## Lint

oxlint, with `.oxlintrc.json` at the root.

- Plugins: `unicorn`, `typescript`, `oxc`, `import`.
- Categories as `error`: `correctness`, `suspicious`, `pedantic`, `perf`, `style`, `restriction`. `nursery` off.
- `options.typeAware: true`, with `oxlint-tsgolint` as a dev dependency.
- `npm run lint` runs with `--deny-warnings`.
- A rule that conflicts with another rule, with `oxfmt`, or with the platform (for example `unicorn/no-null` on DOM APIs) is turned off by name in `.oxlintrc.json` with a one-line reason.
- Per-line disables, with a reason, only for one-off cases.

## Format

`oxfmt` with its defaults. `npm run format` writes. `npm run format:check` checks.

## Local runs

`npm run precommit` runs `npm run format`, then typecheck, lint, format check, unit tests, build, `check:dist` and `test:fixtures`, and fails if anything under a `fixtures` path is staged. It is not a git hook. `AGENTS.md` has Claude run it before every commit.

The release command runs the same set as the `checks` job plus `test:fixtures`. See [releasing.md](releasing.md).

`npm run test:guard` is local only. See [open-script.md](open-script.md).

## Node

Node 26 for the whole repo: `.nvmrc`, `engines` in `package.json`, and the workflow.

## Left to the build

- What `check:dist` does for a script's first release, when there is no earlier `@version` to compare with.
