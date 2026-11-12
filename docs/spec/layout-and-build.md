# Layout and build

## Violentmonkey facts

Checked against Violentmonkey 2.50.0. Full findings with sources: `docs/research/violentmonkey.md`.

- Violentmonkey is an MV2 extension. A script runs as a page script (`page`) or in Violentmonkey's content script (`content`). The default `auto` picks page mode, or content mode when CSP blocks page scripts.
- Firefox picks the mode from the CSP header. A `script-src` nonce is reused (page mode). No nonce and no `'unsafe-inline'` forces content mode. `GM_info.injectInto` gives the mode at runtime.
- Page mode: `fetch` is the page's own. Same-origin GETs send the session cookie.
- Content mode: requests run in the extension's context and need absolute URLs. Cookie behaviour is unverified. The fallback is `GM_xmlhttpRequest`, which sends the tab's cookies, container tabs included.
- CSS: a userscript has no stylesheet slot. Inline the CSS in the bundle and call `GM_addStyle` (`@grant GM_addStyle`). Violentmonkey creates the `<style>` and adds the page's nonce.
- Install: open a URL that ends in `.user.js`. Documented direct-install forms are `raw.githubusercontent.com/{user}/{repo}/{ref}/{file}.user.js` (repo root) and `github.com/{user}/{repo}/releases/latest/download/{file}.user.js`.
- Update: checked daily at 12:00 local time and on manual request. Installs only when the remote `@version` is higher. No `@version`, no updates. Violentmonkey never downgrades. `@downloadURL` defaults to the install URL. `@updateURL` is optional.
- The metadata block must be the first thing in the file.
- One file only: no ES modules. TypeScript is bundled first. No size limit is documented or found in the source.
- Dev loop support: serve the file on `http://localhost`, open the `.user.js`, click "Track external edits". It polls every 500 ms and can reload the tab. The installer tab must stay open. The dev file needs its own `@name`.

### Azure DevOps

A probe on a signed-in `dev.azure.com` page (Violentmonkey 2.50.0, Zen on Firefox 159) found:

- Injection mode is `page` with `@inject-into` left at `auto`.
- A plain `fetch` with an absolute same-origin URL to `/_apis/connectionData` returns 200 JSON for the signed-in user, with no redirect. `GM_xmlhttpRequest` is not needed.
- `GM_addStyle` applies. The `<style>` carries the page's nonce, so CSP does not block it.
- Not tested: `*.visualstudio.com` hosts and content mode. If an Azure DevOps CSP change forces content mode, run the probe again.

## Repo

Name: `my-vibed-userscripts`. Public, on GitHub.

```
my-vibed-userscripts/
  azure-devops/            one folder per script, named after the website in kebab-case
    script.json            name, description, @match, @grant, version, mode (open | sealed)
    src/main.ts, *.ts, *.test.ts, style.css
    src/capture.ts         exports captureDefinition: capture rules and page naming; dev only
    fixtures/              gitignored, may be a symlink
    fake-site/             optional
  shared/
    runtime/               code that ships in scripts (the page reloader)
    dev/                   scrubber, fake-site base, GM shim, read-only guard, test helpers
  build/                   build, dev server, release command, check:dist
  dist/
    azure-devops.user.js   committed release file
    dev/                   gitignored dev files
  docs/spec/               this spec
  docs/research/           research notes
  .claude/settings.json    deny rules, MCP entries, auto-memory off
  .claude/skills/          skills
  .githooks/pre-push
  .github/workflows/checks.yml
  package.json, tsconfig.json, .oxlintrc.json, .nvmrc, AGENTS.md, GLOSSARY.md, README.md, LICENSE
```

- A script is a top-level folder with a `script.json`. The build finds scripts that way. There is no list to maintain.
- `.gitignore` lists `fixtures` (no trailing slash), `dist/dev/` and `.real-site/`.

## `script.json`

- JSON, so the release command and the checks read and bump it without running code.
- It is the mode record: `mode` is `open` or `sealed`. The mode changes only when the owner asks.
- Fields: name, description, `@match`, `@grant`, `version`, `mode`. An open script also lists its sign-in origins and CDN origins (used for the read-only guard's allowlist), and any POST exemption the owner approved (see [open-script.md](open-script.md)).
- `version` is semver. A new script starts at `1.0.0`. Only the release command changes it.

## Stack

- TypeScript. esbuild bundles one IIFE per script.
- CSS is inlined and added through `GM_addStyle`.
- Tests: `node --test` on `.ts` files.
- Typecheck: `tsc --noEmit` over the whole repo.
- One `package.json`, no workspaces.
- Commands take an optional script name. Without one they run for every script. `npm run dev` is the exception: it needs a name.
- The build is reproducible: fixed esbuild options, no timestamp. `check:dist` depends on it.

## Metadata block

Generated from `script.json`. The build adds `@namespace`, `@downloadURL` and `@run-at document-idle`.

## Shared code

- One `shared/` folder, imported by relative path, bundled in.
- A file moves to `shared/` only when a second script needs it. No copies between scripts.
- `shared/runtime/` ships in release files. A change there can trigger a release.
- `shared/dev/` never ships and never triggers a release.

## Who writes `dist/`

- `npm run build [script]` writes dev files to `dist/dev/` only.
- Only the release command writes `dist/<script>.user.js`. No build or commit changes an installable file without a version bump. See [releasing.md](releasing.md).

## Dev loop

- `npm run dev <script>` runs esbuild in watch mode, serves `dist/dev/` on `http://localhost:8786`, and starts the script's fake site, if it has one, on `http://localhost:8787`.
- One script in dev at a time.
- The owner installs the dev file once from `localhost:8786` and uses "Track external edits".
- Dev file: `@name "<name> (dev)"`, no `@downloadURL`. It matches the real site, plus `http://localhost:8787/*` when a fake site exists. It also grants `GM_registerMenuCommand` and holds the "Capture fixtures" command and the script log. Same for open and sealed scripts.
- The owner disables the release script by hand while the dev script runs.

## Capture in the real-site browser

Open scripts only.

- `npm run capture:bundle <script>` writes `.real-site/<script>-capture.js`: the script's `captureDefinition` and the shared scrubber as one async function. It reads the page, scrubs in the page and returns only `{ baseName, html, json }`. It changes nothing on the page.
- Claude passes that text to `browser_evaluate`, with `filename: .real-site/<script>-capture-result.json`.
- `npm run capture:save <script> <result-file>` writes `<page>.html` and `<page>.json` to the main checkout's `<script>/fixtures/`, links them into a worktree, and deletes the result file.

## Install URL

`https://raw.githubusercontent.com/<user>/my-vibed-userscripts/main/dist/<script>.user.js`

This nested path is not on Violentmonkey's direct-install list. Per the source, Violentmonkey fetches it and opens the installer when it parses as a userscript. The first install, of `azure-devops` 1.0.0, worked.

## Left to the build

- The exact field names in `script.json` for sign-in origins, CDN origins and POST exemptions.
- The `@namespace` value.
- How the build adds the dev-only grant and match lines. The decisions say only that they are in the dev file and not in the release file.
