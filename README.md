# my-vibed-userscripts

Userscripts that fix small annoyances on websites I use, one script per website. Claude Code writes them; I decide what they do and check them on the real site.

## Scripts

<!-- scripts:start -->

- **Fix Azure DevOps** 1.0.1: Adds missing features to Azure DevOps: pipeline status on pull requests, required reviewers first, avatar initials, and pull request lists and boards that reload on changes. [Install](https://raw.githubusercontent.com/pietdevries94/my-vibed-userscripts/main/dist/azure-devops.user.js)
- **Fix Tweakers** 1.0.1: Trims the Tweakers homepage. Hides the lead story, the side columns, the top banner and the category bar. [Install](https://raw.githubusercontent.com/pietdevries94/my-vibed-userscripts/main/dist/tweakers.user.js)

<!-- scripts:end -->

## Install

1. Install [Violentmonkey](https://violentmonkey.github.io/) in your browser. The scripts are tested in Zen, a Firefox-based browser. Other userscript managers are not supported.
2. Open a script's install link above. Violentmonkey shows its install page.
3. Click "Install". Violentmonkey checks for updates on its own.

## What the scripts do to a page

- **Fix Azure DevOps** reads the page and sends GET requests to the Azure DevOps REST API of the site you are on, with your own session. It never changes anything in Azure DevOps. It adds icons and outlines to the page and reloads a pull request list or board when it changed. It sends nothing anywhere else.
- **Fix Tweakers** adds CSS to the homepage that hides parts of it. It sends no requests.

## Development

Node 26. Every script lives in its own folder with a `script.json` and its source in `src/`.

```sh
npm ci
npm run dev <script>   # rebuilds the dev file and serves it on http://localhost:8786
npm run precommit      # format, lint, typecheck, tests, build
```

Releases go through `npm run release`. How the repo works is in [`AGENTS.md`](AGENTS.md), [`GLOSSARY.md`](GLOSSARY.md) and [`docs/spec/`](docs/spec/README.md).

## Licence

MIT. See [`LICENSE`](LICENSE).
