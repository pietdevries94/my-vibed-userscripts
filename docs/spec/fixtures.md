# Fixtures

A fixture is a scrubbed copy of a page or a response. Fixtures stay on the owner's machine. None are committed. How a capture is made and scrubbed is in [sealed-workflow.md](sealed-workflow.md).

## Location

- Each script folder has its own `fixtures/` folder.
- `.gitignore` lists `fixtures` without a trailing slash, so a symlink named `fixtures` is ignored too.

## Worktrees

- A new worktree has no fixtures.
- `npm run fixtures:link` symlinks every script's `fixtures` from the main checkout into the current worktree. Use a symlink, never a copy.
- `AGENTS.md` tells Claude to run it in every new worktree.

## Tests without fixtures

- Unit tests use small hand-written inputs, committed inside the test code. These are not fixtures. Their values are invented.
- Fixture-based tests are a separate group.
- In the default test run, fixture tests skip with a message that names the missing folder.
- `npm run test:fixtures` fails when fixtures are missing.

## Getting captures in

- Capture files are named `<script>--<page>.<ext>`.
- `npm run fixtures:import <script> [name]` finds them in the download folder by that prefix, drops the prefix, and moves them into the script's `fixtures/`. A name goes after the page name: `pr-detail-warnings.html`. It overwrites files with the same name and lists which files are new and which were replaced. There is no fixture history.
- For an open script, Claude's capture writes straight into `<script>/fixtures/`.

## Protection against committing a fixture

- `.gitignore`, as above.
- `npm run precommit` fails if anything under a `fixtures` path is staged. `AGENTS.md` has Claude run it before every commit.
- The pre-push hook refuses a push whose commits contain a `fixtures` path. It is the only git hook. See [checks.md](checks.md).
- The GitHub `fixtures` job detects a pushed fixture. It cannot prevent the leak. See [checks.md](checks.md).

## Commits

Claude may commit freely in the repo. Pushing is covered in [agents-file-and-skills.md](agents-file-and-skills.md).
