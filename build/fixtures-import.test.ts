import assert from "node:assert/strict";
import { fixtureNameOf, repeatedFixtureNames } from "./fixtures-import.ts";
import { test } from "node:test";

test("a capture loses its script prefix and a browser's repeat suffix", () => {
  assert.equal(fixtureNameOf("shop--cart.html", "shop--", ""), "cart.html");
  assert.equal(fixtureNameOf("shop--cart (1).json", "shop--", ""), "cart.json");
});

test("a capture name goes after the page name", () => {
  assert.equal(fixtureNameOf("shop--cart.html", "shop--", "empty"), "cart-empty.html");
  assert.equal(fixtureNameOf("shop--cart(2).json", "shop--", "empty"), "cart-empty.json");
});

test("two captures of one page in the download folder share a fixture name", () => {
  const captures = ["shop--cart.html", "shop--cart.json", "shop--cart(1).html", "shop--home.html"];
  assert.deepEqual(repeatedFixtureNames(captures, "shop--", "empty"), ["cart-empty.html"]);
  assert.deepEqual(repeatedFixtureNames(["shop--cart.html"], "shop--", ""), []);
});
