---
name: sealed-capture
description: Get fixtures for a sealed script through the owner, step by step, or turn an open script sealed. Use when a sealed script has no fixtures, needs new ones, or the owner asks to seal a script.
---

# Sealed capture

Claude never sees a sealed site. The owner captures; Claude works from scrubbed fixtures.

## Hand-offs

1. Write or update the capture rules in `<script>/src/capture.ts`, exported as `captureDefinition` (what to keep, which GET requests to send, how to name each page). Give the owner the exact list of pages to open. Done when every page the feature needs is on the list.
2. (O) The owner opens each page with the dev script installed and clicks the Violentmonkey menu command "Capture fixtures". Files download as `<script>--<page>.<ext>`.
3. (O) The owner runs `npm run fixtures:import <script>`, and skims the files. Wait for the owner to say so before reading any fixture.
4. Build the feature, unit tests and fake site through `feature`, and check on the fake site in the `fake-site` browser.
5. (O) The owner checks on the real site and reports in chat. When something is wrong, the owner captures that page again.

The download folder stays unread at every step.

## Capture rules

The shared scrubber in `shared/dev/scrub` keeps structure and replaces every value. Per script, the rules may only add keeps: attribute names, JSON paths with a value pattern, id patterns, link route words, exact UI words, and a mapping from the site's URLs to fake ones. Keep the list short enough for the owner to read. Details: `docs/spec/sealed-workflow.md`.

## Open to sealed

When the owner asks to seal an open script:

1. Set `mode` to `sealed` in `<script>/script.json` and commit.
2. (O) The owner reconnects `real-site` in `/mcp`; the site leaves the `real-site` allowlist.
3. Delete `~/.cache/my-vibed-userscripts/<script>/profile` and the `.real-site/` output. Captured fixtures stay.
