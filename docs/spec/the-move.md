# The move

The Azure DevOps browser extension becomes the first script, `azure-devops`, with unchanged behaviour. The Azure DevOps script is sealed.

## Order

Each step leaves something that works and can be checked.

1. **Scaffold the repo**: build, `script.json` discovery, checks, release command, pre-push hook. `azure-devops/` holds the extension code copied as-is. Also in this step:
   - `GLOSSARY.md` to the repo root, unchanged.
   - `AGENTS.md` and the skills, per [agents-file-and-skills.md](agents-file-and-skills.md).
   - This spec, into `docs/spec/`.
   - The read-only guard (`read-only.init-page.ts`, `read-only.init-script.js` and the test harness, from the guard test's assets in the old planning folder) into `shared/dev/real-site/`, and `npm run test:guard`, per [open-script.md](open-script.md).
   - `docs/research/` (Violentmonkey, read-only site access, PR pipeline status), after a check that they hold no names or organisation details.
2. **Port the code**: the manifest becomes `script.json`, `content.ts` becomes `main.ts`, CSS goes in through `GM_addStyle`. Unit tests and typecheck pass.
3. **Lint and format** (below).
4. **Capture**: the extension's capture tool becomes `azure-devops/src/capture.ts` on the shared scrubber. The owner recaptures and runs `fixtures:import`. Tests adapt to the new fixture shape.
5. **Fake site**: the fake Azure DevOps server becomes `azure-devops/fake-site/` on the shared base, with invented stand-in names. Claude checks every feature there through the `fake-site` browser.
6. **Release `1.0.0`**. The owner installs from `raw.githubusercontent.com/<user>/my-vibed-userscripts/main/dist/azure-devops.user.js`. This tests the nested install path. If it fails, release files move to the repo root before going on.
7. **Owner check** on the real site, with the extension disabled.
8. **Remove the extension** (below).
9. **Trial**: a clean session creates a script for a small open site, per [agents-file-and-skills.md](agents-file-and-skills.md). Gaps are fixed in `AGENTS.md` or a skill.

## Allowed code changes

Only these:

- `script.json`: `@match` keeps both `https://dev.azure.com/*` and `https://*.visualstudio.com/*`. The second is untested, but dropping it changes behaviour. `@grant GM_addStyle`, plus `GM_registerMenuCommand` in the dev file only.
- The entry rename, and CSS through `GM_addStyle`.
- Invented stand-in names in the fake site and unit tests (`avatars.test.ts` included). The current stand-ins are real people's names. Expectations such as initials change to match. This is not a behaviour change.
- The `fetch` code and the `sessionStorage` key `fix-ado-last-page-reload` stay as they are.

## Proof of unchanged behaviour

1. Unit tests pass. Assertions change only for fixture tokens and stand-in names.
2. Claude checks on the fake site: pipeline status icon, required reviewers, avatar initials, PR list reload, board reload.
3. The owner ticks the same list on the real site, with the extension disabled. Extension and script never run together.

## Lint and format

- `oxfmt` runs on everything in the move.
- Mechanical lint fixes land in the move.
- A finding whose fix could change behaviour gets an inline disable that names the rule, with `TODO(lint)`.
- No rule is switched off repo-wide for the move.
- Checks are green from the first push.

## Fixtures

- The old fixtures are not copied, not even as a gitignored copy.
- The owner recaptures in step 4. Fixture tests skip until then.
- No release before step 6.

## Removal

After the checklist, the owner uses the script alone for about 5 minutes. Then, in one step:

- uninstall the extension from Zen,
- revoke the Mozilla API keys,
- delete `signed/`, `.env` and the old extension folder.

## Not moved

- The planning map and its folder.
- Claude's memory for the old folder. `AGENTS.md` replaces it: the rule against touching the real Azure DevOps site becomes the sealed refusals. The other memory is personal.
