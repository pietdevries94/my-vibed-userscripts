import { findReviewerByLabel, hueOf, initialsOf } from "./reviewers.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("initials are the first letters of the first and last word", () => {
  assert.equal(initialsOf("Tomas van Elst"), "TE");
  assert.equal(initialsOf("mira holt"), "MH");
  assert.equal(initialsOf("Ruth-Ann  van der Quist"), "RQ");
});

test("a surname-first name gives first name then surname", () => {
  assert.equal(initialsOf("Elst, Tomas van"), "TE");
  assert.equal(initialsOf("van Elst, Tomas"), "TE");
  assert.equal(initialsOf("Holt, Mira Jo"), "MH");
  assert.equal(initialsOf("Elst, Tomas van (Acme)"), "TE");
  assert.equal(initialsOf("Holt,"), "H");
});

test("a single name gives one initial", () => {
  assert.equal(initialsOf("Mira"), "M");
});

test("a company suffix and a team prefix are not part of the name", () => {
  assert.equal(initialsOf("Tomas van Elst (Acme)"), "TE");
  assert.equal(initialsOf(String.raw`[My Project]\Backend Team`), "BT");
});

test("an empty name gives no initials", () => {
  assert.equal(initialsOf(""), "");
  assert.equal(initialsOf("(external)"), "");
});

test("a sign-in address gives the initials of its name part", () => {
  assert.equal(initialsOf("tomas.van.elst@example.com"), "TE");
  assert.equal(initialsOf("mira@example.com"), "M");
});

test("a name keeps the same hue", () => {
  assert.equal(hueOf("Elst, Tomas van"), hueOf(" elst, tomas van "));
  assert.notEqual(hueOf("reviewer-1"), hueOf("reviewer-2"));
  assert.ok(hueOf("any name at all") >= 0 && hueOf("any name at all") < 360);
});

const ANN = { displayName: "Ann", id: "1" };
const ANN_LEE = { displayName: "Ann Lee", id: "2" };
const TEAM = { displayName: String.raw`[My Project]\Backend Team`, id: "3" };

test("finds the reviewer whose name is in the avatar label", () => {
  assert.equal(findReviewerByLabel("Ann Lee", [ANN_LEE, TEAM]), ANN_LEE);
  assert.equal(findReviewerByLabel("ann lee approved", [ANN_LEE]), ANN_LEE);
  assert.equal(findReviewerByLabel("Backend Team", [ANN_LEE, TEAM]), TEAM);
});

test("the longest matching name wins", () => {
  assert.equal(findReviewerByLabel("Ann Lee", [ANN, ANN_LEE]), ANN_LEE);
  assert.equal(findReviewerByLabel("Ann Lee", [ANN_LEE, ANN]), ANN_LEE);
});

test("no reviewer for an unknown label", () => {
  assert.equal(findReviewerByLabel("Someone Else", [ANN_LEE]), null);
  assert.equal(findReviewerByLabel("", [ANN_LEE, {}]), null);
});
