# my-vibed-userscripts

Userscripts that fix small annoyances on websites I use, one script per website. Claude Code writes them; I decide what they do and check them on the real site.

## Scripts

<!-- scripts:start -->

| Script                                                                                                                  | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Version |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [Fix Azure DevOps](https://raw.githubusercontent.com/pietdevries94/my-vibed-userscripts/main/dist/azure-devops.user.js) | Adds missing features to Azure DevOps: pipeline status on pull requests, how long ago each active pull request in a list was published, in red after two weekdays, a Pipeline tab on each pull request with its runs, stages, steps, warnings, errors and logs and a button to start or cancel a run, the warnings and errors of each check's latest run above the pull request description, a pull request's Overview that runs from old to new with a button to flip it, a button there that scrolls to its bottom, pushes folded to one line there with a button that shows their commits, lines that add reviewers joined to one, threads there that collapse, with a button that expands them all, a Resolved chip on resolved ones, which start collapsed unless a comment is unread, unread comments that glow, with buttons that go to the first and next unread, a New chip that glows on pushes and other changes you have not seen, and an Unresolved chip on active ones, required reviewers first, starred reviewers to add as optional or required reviewer in one click, also on a new pull request, reviews that hold your comments as pending and post them in one go with your vote, avatar initials, Light or Dark to match the system, days in column dots on board cards with a toggle per column, pull request lists and boards that reload on changes, and a Windows 98 mode, still a work in progress and off by default. A settings panel in Azure DevOps's top bar turns each feature on or off and marks new and updated ones. | 1.19.0  |
| [Fix Tweakers](https://raw.githubusercontent.com/pietdevries94/my-vibed-userscripts/main/dist/tweakers.user.js)         | Trims the Tweakers homepage. Hides the lead story, the side columns, the top banner and the category bar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 1.0.2   |

<!-- scripts:end -->

## Install

1. Install [Violentmonkey](https://violentmonkey.github.io/) in your browser. The scripts are tested in Zen, a Firefox-based browser. Other userscript managers are not supported.
2. Click a script's name in the table above. Violentmonkey shows its install page.
3. Click "Install". Violentmonkey checks for updates on its own.

## Development

Claude Code writes the scripts. You say what you want and check the result on the real site. You need Claude Code, Node 26 and Violentmonkey.

Open Claude Code in the repo and ask:

- **A new script**: "Create a script for <site> that does <X>." Claude asks whether the site is open or sealed.
  - **Open**, the default: Claude reads the real site in a read-only browser. When it asks, you reconnect `real-site` in `/mcp`, and sign in or accept a cookie wall in that browser.
  - **Sealed**, for a work site or anything private: Claude never opens the site. You open the pages it lists and click "Capture fixtures" in the Violentmonkey menu. Then you run `npm run fixtures:import <script>` and skim the files before Claude reads them. A capture swaps names, numbers and ids for stand-ins.
- **A change to a script**: name the script and the change. Claude writes a failing test first, then the change.

Then check it yourself:

1. Claude runs `npm run dev <script>`.
2. Install the dev file from `http://localhost:8786/<script>.user.js` and disable the released script.
3. Check the page and tell Claude what is wrong. Each fix rebuilds the dev file.

Say "release" when it is right. Claude checks the descriptions, bumps the version, rewrites the table above, commits and pushes. Installed copies update on their own. Claude commits on its own, but pushes only when you say "push" or "release".

Claude works from [`AGENTS.md`](AGENTS.md) and the skills in `.claude/skills/`. The decisions behind the repo are in [`docs/spec/`](docs/spec/README.md).

## Licence

MIT. See [`LICENSE`](LICENSE).
