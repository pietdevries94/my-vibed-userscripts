# my-vibed-userscripts

Userscripts that fix small annoyances on websites I use, one script per website. Claude Code writes them; I decide what they do and check them on the real site.

## Scripts

<!-- scripts:start -->

### Fix Azure DevOps

[Install](https://raw.githubusercontent.com/pietdevries94/my-vibed-userscripts/main/dist/azure-devops.user.js) · version 1.22.0

Adds missing features to Azure DevOps. A settings panel in the top bar turns each one on or off and marks new ones.

**Pull request lists**

- Pipeline status on each pull request
- Required reviewers first
- How long ago each active pull request was published, in red after two weekdays

**Pull request**

- A Pipeline tab with runs, stages, steps, warnings, errors and logs, and buttons to start, cancel or open a run
- A pipeline run page's tabs, such as Code Coverage, as tabs of the pull request
- Starred reviewers to add in one click, also on a new pull request
- Reviews that post your pending comments in one go, with your vote
- A Viewed checkbox on each file in the Files tab, as on GitHub

**Pull request Overview**

- Each check's warnings and errors above the description, in a box that collapses
- Oldest first, with a button to flip the order
- A button that scrolls to the bottom
- Pushes folded to one line, with a button that shows their commits
- Lines that add reviewers joined to one
- A chip with each thread's status
- Threads that collapse, with buttons that collapse or expand all of them, or only the done ones
- Resolved, Won't fix and Closed threads that start collapsed, unless a comment is unread
- Unread comments that glow, with buttons to the first and next unread
- A New chip that glows on pushes and other changes you have not seen

**Boards**

- Days in column dots on cards, with a toggle per column

**Everywhere**

- Avatar initials
- Light or Dark to match the system
- Pull request lists and boards that reload on changes
- A Windows 98 mode, a work in progress and off by default

### Fix Tweakers

[Install](https://raw.githubusercontent.com/pietdevries94/my-vibed-userscripts/main/dist/tweakers.user.js) · version 1.0.2

Trims the Tweakers homepage.

**Homepage**

- Hides the lead story
- Hides the side columns
- Hides the top banner
- Hides the category bar

<!-- scripts:end -->

## Install

1. Install [Violentmonkey](https://violentmonkey.github.io/) in your browser. The scripts are tested in Zen, a Firefox-based browser. Other userscript managers are not supported.
2. Click Install under a script above. Violentmonkey shows its install page.
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

Say "release" when it is right. Claude checks the descriptions, bumps the version, rewrites the script list above, commits and pushes. Installed copies update on their own. Claude commits on its own, but pushes only when you say "push" or "release".

Claude works from [`AGENTS.md`](AGENTS.md) and the skills in `.claude/skills/`. The decisions behind the repo are in [`docs/spec/`](docs/spec/README.md).

## Licence

MIT. See [`LICENSE`](LICENSE).
