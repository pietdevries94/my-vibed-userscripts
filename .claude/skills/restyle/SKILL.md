---
name: restyle
description: Restyle a whole script's website into another look, such as Windows 98 mode, page by page against a design. Use to start a restyle, add a page or state to one, or fix a bug the owner finds in one.
---

# Restyle

A restyle changes how every page and feature of a script looks, not what it does. Windows 98 mode in azure-devops is the worked example: `azure-devops/src/features/windows-98-mode/`, its states in `azure-devops/restyle/states.ts`, and the shared look in `shared/styles/win98/`.

Load `feature` for the code loop and `modern-web-guidance` before writing CSS. A sealed script works from captures only (`sealed-capture`).

## The loop

Every state goes through the same five steps, in order. A state is done when its row in the checklist has all five.

1. **Capture.** Get a capture of the page in that state, with `styleRoot`, so the fake site shows it with the site's own CSS. A state no capture shows gets invented fake-site data instead: put real markup from another capture around invented rows and names, and say in the state which parts are invented.
2. **Design.** Draw the state as an artboard on the design canvas, from the capture's structure, items and text. Draw it from the look's design system components (`design-system.md`), never by tracing a screenshot. A design change to an approved artboard waits for the owner's approval before any CSS; a bug fix that keeps the approved look does not.
3. **CSS.** Write the rules, scoped to the page (`html[data-<mode>="<page>"]`) or to a structure that only that component has. Build them from the look's tokens, never from literal colours and bevels.
4. **Diff.** Add the state to `<script>/restyle/states.ts` and run `npm run restyle:diff <script> <state>`. Done means about 0%, with what is left explained: sub-pixel rounding, a font's anti-aliasing. Look at the two screenshots in `.restyle-runs/` before you trust a number: a blank or wrong crop also diffs low.
5. **Regress.** Run `npm run restyle:diff <script>` for every state and check. Every result stays on its baseline, and the run's start time comes after your last CSS change. Report a changed baseline with its cause.

## Checklist

Start a restyle with a checklist: a row per feature in `<script>/src/features` and per visible state of each (open, closed, empty, loading, error, hovered, checked, scrolled), plus every native page and its states. Rows are only done with a capture or invented state, an artboard, CSS and a diff. Add a row for every bug the owner finds and every audit find.

## Checks that count failures

A pixel diff cannot see some bugs. Write a check for them in `<script>/restyle/`: a function that returns what is wrong, run by `restyle:diff` with the states, where zero passes. Azure DevOps' examples: the board's band must stay teal when it scrolls sideways, and no page may scroll where the native one does not (`scrollWidth <= clientWidth`); every filter drop-down's rows fit, hover navy, and keep their check, with invented rows. Run each check once against the code before your fix, and see it fail.

## Audit

After a batch of pages, run `npm run restyle:audit <script>` at 1280 and 1900 wide, and again at `--widths 1800 --scale 1.6`: a 2x screen at 80% zoom, as owners often browse. Look at every screenshot as well as the printed finds: native-looking parts, clipped or overflowing text, rounded corners, shadows, parts without a state in the checklist. Compare a find with the native page (the mode turned off) before you fix it: much that scrolls or clips does so natively too. `bug-classes.md` lists what restyles keep getting wrong; check each class on every new page.

## Shared look

A look lives in `shared/styles/<look>/`, so another script can wear it too:

- `tokens.css`: custom properties for the colours, bevels, fonts, sizes and pixel icons. A script imports it first, in the feature's `styles`, and builds every rule from it.
- `components.css`: classes for the look's controls (window, button, field, tabs, list box, checkbox, tooltip, progress bar, group box, icons), for elements a script draws itself.

A script maps its site's selectors onto the tokens in its own CSS. Each look also has a design system on claude.ai with the same tokens and components: start a restyle, or a new look, from `design-system.md`. A change under `shared/styles/` reaches every script that imports it: name them, as `release` says.

## Tools

- `npm run restyle:diff <script> [name ...]`: every state's pixel diff and every check; writes `.restyle-runs/<script>-<start>.txt` and the screenshots beside it.
- `npm run restyle:audit <script> [--widths ...] [--scale ...] [name ...]`: screenshots and finds of every audit page.
- `npm run dev <script>` must be running for both; the artboards live in `<script>/design/` (downloaded from the canvas, out of git).
