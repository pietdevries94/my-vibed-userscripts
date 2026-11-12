import { avatarName, hideInitialsOnAvatars, showInitialsOnAvatars } from "./avatars.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { test } from "node:test";

interface TestPage {
  avatars: HTMLElement[];
  document: Document;
  hues: () => string[];
  initials: () => (string | null)[];
}

function pageWith(html: string): TestPage {
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const avatars = [...document.querySelectorAll<HTMLElement>(".bolt-coin, .vss-Persona")];
  const initials = (): (string | null)[] =>
    // oxlint-disable-next-line unicorn/prefer-dom-node-dataset -- the test reads the attribute the stylesheet uses
    avatars.map((avatar) => avatar.getAttribute("data-fix-ado-initials"));
  const hues = (): string[] =>
    avatars.map((avatar) => avatar.style.getPropertyValue("--fix-ado-hue"));
  return { avatars, document, hues, initials };
}

test("every named avatar gets initials, anywhere on the page", () => {
  const page = pageWith(`
    <header><div class="bolt-coin size32" aria-label="Elst, Tomas van"><img class="bolt-coin-content" alt=""></div></header>
    <main><section><div class="bolt-coin size24" aria-label="Holt, Mira"><div class="bolt-coin-content"><span>HM</span></div></div></section></main>
  `);
  showInitialsOnAvatars(page.document);
  assert.deepEqual(page.initials(), ["TE", "MH"]);
});

test("the same name has the same colour everywhere", () => {
  const page = pageWith(`
    <div class="bolt-coin" aria-label="Elst, Tomas van"></div>
    <div class="bolt-coin" aria-label="Holt, Mira"></div>
    <div class="bolt-coin" aria-label="Elst, Tomas van"></div>
  `);
  showInitialsOnAvatars(page.document);
  const [first, second, third] = page.hues();
  assert.equal(first, third);
  assert.notEqual(first, second);
  assert.notEqual(first, "");
});

test("the name comes from the image when the avatar has no label", () => {
  const page = pageWith(
    `<div class="bolt-coin"><img class="bolt-coin-content" alt="Holt, Mira"></div>`,
  );
  assert.equal(avatarName(page.avatars[0]), "Holt, Mira");
});

test("an avatar without a name keeps the ADO picture", () => {
  const page = pageWith(
    `<div class="bolt-coin" role="presentation" aria-label=""><img class="bolt-coin-content" alt=""></div>`,
  );
  showInitialsOnAvatars(page.document);
  assert.deepEqual(page.initials(), [null]);
  assert.deepEqual(page.hues(), [""]);
});

test("an avatar reused for someone else gets the new initials", () => {
  const page = pageWith(`<div class="bolt-coin" aria-label="Elst, Tomas van"></div>`);
  showInitialsOnAvatars(page.document);
  const [firstHue] = page.hues();

  page.avatars[0].setAttribute("aria-label", "Holt, Mira");
  showInitialsOnAvatars(page.document);
  assert.deepEqual(page.initials(), ["MH"]);
  assert.notEqual(page.hues()[0], firstHue);

  page.avatars[0].setAttribute("aria-label", "");
  showInitialsOnAvatars(page.document);
  assert.deepEqual(page.initials(), [null]);
});

test("board avatars get initials, the project picture does not", () => {
  const page = pageWith(`
    <div class="vss-Persona project-persona small" role="img" aria-label="IT"><img class="vss-Persona-content" alt=""></div>
    <div class="vss-Persona identity-avatar extra-small-plus" role="img" aria-label="Holt, Mira"><img class="vss-Persona-content" alt=""></div>
  `);
  showInitialsOnAvatars(page.document);
  assert.deepEqual(page.initials(), [null, "MH"]);
});

test("hiding initials gives every avatar its ADO picture back", () => {
  const page = pageWith(`
    <div class="bolt-coin" aria-label="Elst, Tomas van"></div>
    <div class="vss-Persona" aria-label="Holt, Mira"></div>
  `);
  showInitialsOnAvatars(page.document);
  hideInitialsOnAvatars(page.document);
  assert.deepEqual(page.initials(), [null, null]);
  assert.deepEqual(page.hues(), ["", ""]);
  assert.deepEqual(
    page.avatars.map((avatar) => avatar.style.getPropertyValue("--fix-ado-avatar-size")),
    ["", ""],
  );
});
