# Userscripts

A collection of userscripts that add missing features to websites the owner uses. Each script is developed with Claude and installed through Violentmonkey.

## Language

**Owner**:
The one person who uses the scripts, signs in to the websites, and decides releases.
_Avoid_: User, admin

**Script**:
All changes to one website, installed as one unit. A website has exactly one script.
_Avoid_: Extension, add-on, userscript per feature

**Feature**:
One visible change a script makes to its website, such as a pipeline status icon in a pull request list. A script holds several features.
_Avoid_: Script, plugin, module

**Open script**:
A script whose website Claude may look at, read-only, in a browser the owner is signed in to. The default.
_Avoid_: Unrestricted, normal mode

**Sealed script**:
A script whose website Claude never sees. The owner captures fixtures and does every check on the real site. Applies only when the owner asks for it.
_Avoid_: Restricted, no-production mode, private

**Fixture**:
A scrubbed copy of a page or a response of a website, used to develop and test a script. Fixtures stay on the owner's machine and are never committed.
_Avoid_: Snapshot, sample, mock data

**Capture**:
Producing a fixture from the real website. For a sealed script the owner does it; for an open script Claude may.
_Avoid_: Scrape, dump, record

**Scrubbing**:
Replacing everything in a capture that could identify a person, company or record, apart from what the script's rules keep.
_Avoid_: Anonymising, sanitising

**Read-only guard**:
What stops Claude from changing anything on the real website of an open script. It blocks every request that could write, and the tools that click or type.
_Avoid_: Sandbox, safe mode

**Stand-in name**:
An invented name that replaces a person's or company's name in tests and on the fake site.
_Avoid_: Dummy, fake user

**Fake site**:
A local stand-in for a website, built from fixtures, whose state can be changed on command. Built for a sealed script, or when a feature reacts to change over time.
_Avoid_: Mock server, sandbox, stub

**Release**:
A new version of a script that installed copies pick up on their next update check. Only the owner decides when a script is released.
_Avoid_: Deploy, publish, ship

## Tweakers

**Homepage**:
The front page of tweakers.net, at `/`. The only page the script changes.
_Avoid_: Front page, index

**Lead story**:
The large highlighted article at the top of the homepage, above the news item list.
_Avoid_: Header, hero, ankeiler

**News item list**:
The list of news items under "Laatste nieuws" on the homepage. The news-only view widens it to the full content area.
_Avoid_: Feed, timeline, headlines

**Category bar**:
The row under the search bar headed "Vergelijk producten en prijzen", with a tile per product category.
_Avoid_: Product bar, category menu

**Side columns**:
The two columns right of the news item list on the homepage: the story stream, and promotions with Best Buy Guides.
_Avoid_: Sidebar, widgets

**Site header**:
The block at the top of every Tweakers page: menu bar, alert bar, search bar and category bar. The news-only view hides only its category bar.
_Avoid_: Navbar, top bar, header (the owner may mean the lead story)

**News-only view**:
The homepage without the category bar, the top banner, the lead story and the side columns. The news item list takes their width. The rest of the page stays.
_Avoid_: Clean mode, minimal view
