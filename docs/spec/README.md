# Userscripts repo spec

The spec for `my-vibed-userscripts`: a public GitHub repo of Violentmonkey userscripts. Build sessions work from it. It states the current decisions. It does not record how they were reached.

Terms come from `GLOSSARY.md` at the repo root. Use those terms.

## Files

| File                                                   | Covers                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [layout-and-build.md](layout-and-build.md)             | Violentmonkey facts, repo layout, `script.json`, build, dev loop, install URL |
| [fixtures.md](fixtures.md)                             | Where fixtures live, tests without fixtures, worktrees, import                |
| [open-script.md](open-script.md)                       | What Claude may do on the real site of an open script, the read-only guard    |
| [sealed-workflow.md](sealed-workflow.md)               | Capture, scrubbing, script log, fake site, hand-offs                          |
| [releasing.md](releasing.md)                           | Versions, the release command, rollback                                       |
| [checks.md](checks.md)                                 | Pre-push hook, GitHub workflow, `check:dist`, lint, format, Node              |
| [agents-file-and-skills.md](agents-file-and-skills.md) | `AGENTS.md`, the skills, `new-script` steps, the clean-session trial          |

## Fixed rules

These are not open for change by a build session.

- One script per website. A feature is a part of a script.
- The repo has a site-neutral name.
- Scripts are open by default. A script is sealed only when the owner asks. Each script records its mode in its `script.json`.
- The repo is public. Scripts install from a GitHub link.
- Licence: MIT, in a `LICENSE` file at the repo root.
- Fixtures are scrubbed and gitignored. None are committed.
- Unit tests are required for every script. A fake site is built only for a sealed script or for a feature that reacts to change over time.
- Violentmonkey in Zen is the only supported target.
- The owner does the final check on the real site.
- Node 26 across the repo.
- Public repo: no names of real people, companies or organisations, and no real values from any site, in any file. Stand-in names are invented.

## Out of scope

- Support for Tampermonkey or other userscript managers.

## Open

- A second website to test the design against. Until the trial in [agents-file-and-skills.md](agents-file-and-skills.md), the design is checked against Azure DevOps only.
- Details the decisions leave to the build session are listed at the end of each file under **Left to the build**.
