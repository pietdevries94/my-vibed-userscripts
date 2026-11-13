import assert from "node:assert/strict";
import { fixtureNameOf } from "./fixtures-import.ts";
import { test } from "node:test";

test("a capture loses its script prefix and a browser's repeat suffix", () => {
  assert.equal(fixtureNameOf("shop--cart.html", "shop--", ""), "cart.html");
  assert.equal(fixtureNameOf("shop--cart (1).json", "shop--", ""), "cart.json");
});

test("a capture name goes after the page name", () => {
  assert.equal(fixtureNameOf("shop--cart.html", "shop--", "empty"), "cart-empty.html");
  assert.equal(fixtureNameOf("shop--cart(2).json", "shop--", "empty"), "cart-empty.json");
});
