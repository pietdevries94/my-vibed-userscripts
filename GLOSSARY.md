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

**Leak check**:
The last step of a capture. It refuses the output if any replaced value still appears in it.
_Avoid_: Audit, scan

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
