---
name: new-script
description: Create a userscript for a website that has no script yet. Use when the owner names a new site and a first feature.
---

# New script

(O) marks an owner action. Wait for it; do the rest without asking.

1. (O) The owner names the website and the first feature. Ask the mode once: open, unless the owner says sealed.
2. Create the script:
   - `<site>/` in kebab-case, named after the website.
   - `<site>/script.json`: `name`, `description`, `match`, `grant`, `version` `"1.0.0"`, `mode`. An open script also lists `signInOrigins` and `cdnOrigins`: exact origins, never wildcards. Copy the shape of an existing `script.json`.
   - `<site>/src/main.ts`, and `<site>/src/style.css` added through `GM_addStyle` when the feature needs CSS.
   - The site's own terms in `GLOSSARY.md`, in its format.
     Done when `npm run build <site>` writes `dist/dev/<site>.user.js` and `npm run precommit` passes. Commit.
3. Access:
   - Open: (O) the owner restarts Claude Code, so the `real-site` allowlist picks up the new origins, and signs in when the browser opens. Run `npm run test:guard` first if it has not passed since the last guard change; the `real-site` entry refuses to start without a pass.
   - Sealed: continue in `sealed-capture`.
4. Capture fixtures, through `real-site` (open) or `sealed-capture` (sealed).
5. Build the feature through `feature`.
6. (O) The owner installs the dev file once from `http://localhost:8786/<site>.user.js` (`npm run dev <site>`) and checks on the real site.
7. (O) The owner says "release". Run `release`.

Sealed to open needs only step 3.
