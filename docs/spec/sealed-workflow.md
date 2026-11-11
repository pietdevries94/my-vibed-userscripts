# Sealed workflow

Claude never sees the site of a sealed script. The owner captures fixtures and does every real-site check. The capture, scrubber, leak check and script log below are shared by both modes. Open scripts run the same capture bundle through the guarded browser (see [open-script.md](open-script.md)).

## Capture

- The dev file of a script has a Violentmonkey menu command, "Capture fixtures".
- The code lives in `<script>/src/capture.ts`. It goes into the dev file only, never the release file. No console paste, no separate install.
- API responses are captured actively. The script's capture lists the GET requests it sends and reuses the feature's own API client. The shared part allows GET only.
- Files are named `<script>--<page>.<ext>`. `<page>` comes from a per-script function.

## Scrubbing

### Shared (`shared/dev/scrub`)

- An allowlist. It keeps tag names, class names, structural attributes, SVG geometry and JSON keys.
- It drops `script`, `style`, `iframe` and similar elements.
- Numbers, GUIDs, dates and links become consistent pseudonyms.
- Each distinct text becomes a consistent token such as `text-17`. The same value gets the same token everywhere. Length, case and word shape are gone.

### Per script

A rules object that may only add keeps:

- attribute names
- JSON paths with a value pattern
- id patterns
- link route words
- exact UI words ("Active", "Draft")
- a mapping from the site's own URLs to fake ones

The owner reads the list in the script's rules.

## Leak check

- The scrubber records every original value it replaced.
- If any of them (3 or more characters) appears in the output, kept words included, the capture refuses to download and names the field.
- It never prints the real value.

## Script log

- The dev file has `log(message, data?)`. `message` is a string literal and is kept. `data` is scrubbed as JSON.
- Uncaught errors from the script's own code are kept with message and stack. Any value on the leak list is replaced.
- The capture includes this log.
- The release build drops `log` calls.

## Fake site

### Shared (`shared/dev/fake-site`)

- A server on `localhost:8787`.
- Answers GET only (405 otherwise). Sends `no-store`.
- Logs requests at `/__dev/requests`.
- Loads fixtures from the script's `fixtures/`, with an error that names any missing file.
- Includes the fixture-to-DOM helper.
- A `/__dev` index page lists the script's actions as links.
- The GM shim: `GM_addStyle` adds a `<style>`, `GM_registerMenuCommand` is a no-op.

### Per script (`<script>/fake-site/`)

- Page routes and API routes, and their state.
- Named actions that change the state.
- Stand-in labels for masked names.

The server does not serve the script.

### Checking on the fake site

- The owner's Zen: the dev file matches `localhost:8787`.
- Claude: a second MCP entry, `fake-site`. Playwright with `--allowed-origins` limited to `localhost:8786` and `localhost:8787`. Its init script injects `dist/dev/<script>.user.js` with the GM shim. Clicking and typing are allowed there.
- The owner's check in Zen covers the gap between the shim and Violentmonkey.

## Stand-in names

Always invented. Never the owner's name or a colleague's. `AGENTS.md` says so.

## Hand-offs

1. Claude writes or updates the capture rules and gives the owner a list of the exact pages to open.
2. The owner opens each page with the dev script installed and clicks "Capture fixtures".
3. The owner runs `npm run fixtures:import <script>`, reads the leak-check result, and skims the files before Claude reads them.
4. Claude builds the feature, unit tests and fake site, and checks them on the fake site through the `fake-site` browser.
5. The owner checks on the real site and reports in chat. When something is wrong, the owner captures that page again. The script log in the capture helps reproduce it.

## Left to the build

- Where the per-script scrub rules object lives (in `capture.ts` or its own file).
