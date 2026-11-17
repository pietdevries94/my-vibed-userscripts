import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { feedThreadOf } from "./feed-threads.ts";
import { test } from "node:test";

/** A thread whose first comment's header lays out the name and time in `nameAndTimeClass`. */
function threadElement(nameAndTimeClass: string): HTMLElement {
  const { document } = new JSDOM(`<!doctype html><body>
    <div class="repos-discussion-thread"><div class="repos-discussion-comment-header flex-row">
      <div class="scroll-hidden ${nameAndTimeClass}"><span>Quill Barrow</span>
        <div class="flex-row flex-center"><span><time>an hour ago</time></span></div>
      </div>
      <div class="flex-row justify-end"></div>
    </div></div>`).window;
  const thread = document.querySelector<HTMLElement>(".repos-discussion-thread");
  assert.ok(thread !== null);
  return thread;
}

for (const [width, nameAndTimeClass] of [
  ["a wide window, name and time on one line", "flex-row flex-center"],
  ["a narrow window, the time under the name", "flex-column"],
]) {
  test(`in ${width}, what the script adds goes in the box of the time`, () => {
    const feedThread = feedThreadOf(threadElement(nameAndTimeClass));
    assert.ok(feedThread?.timeBox.querySelector(":scope > span > time") !== null);
  });
}
