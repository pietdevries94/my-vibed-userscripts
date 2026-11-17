import assert from "node:assert/strict";
import { createSyncBeforePaint } from "./sync-before-paint.ts";
import { test } from "node:test";

function fakeAnimationFrames(): {
  requestAnimationFrame: (callback: () => void) => void;
  runAnimationFrame: () => void;
} {
  let callbacks: (() => void)[] = [];
  return {
    requestAnimationFrame: (callback) => {
      callbacks.push(callback);
    },
    runAnimationFrame: () => {
      const due = callbacks;
      callbacks = [];
      for (const callback of due) {
        callback();
      }
    },
  };
}

test("syncs in the next frame, not at once", () => {
  const animationFrames = fakeAnimationFrames();
  let syncs = 0;
  const onDomChange = createSyncBeforePaint(animationFrames.requestAnimationFrame, () => {
    syncs += 1;
  });
  onDomChange();
  assert.equal(syncs, 0);
  animationFrames.runAnimationFrame();
  assert.equal(syncs, 1);
});

test("syncs once for every change in one frame", () => {
  const animationFrames = fakeAnimationFrames();
  let syncs = 0;
  const onDomChange = createSyncBeforePaint(animationFrames.requestAnimationFrame, () => {
    syncs += 1;
  });
  onDomChange();
  onDomChange();
  onDomChange();
  animationFrames.runAnimationFrame();
  assert.equal(syncs, 1);
});

test("syncs again for a change after the frame", () => {
  const animationFrames = fakeAnimationFrames();
  let syncs = 0;
  const onDomChange = createSyncBeforePaint(animationFrames.requestAnimationFrame, () => {
    syncs += 1;
  });
  onDomChange();
  animationFrames.runAnimationFrame();
  onDomChange();
  animationFrames.runAnimationFrame();
  assert.equal(syncs, 2);
});

test("a change the sync makes itself waits for the next frame", () => {
  const animationFrames = fakeAnimationFrames();
  let syncs = 0;
  const onDomChange = createSyncBeforePaint(animationFrames.requestAnimationFrame, () => {
    syncs += 1;
    onDomChange();
  });
  onDomChange();
  animationFrames.runAnimationFrame();
  assert.equal(syncs, 1);
  animationFrames.runAnimationFrame();
  assert.equal(syncs, 2);
});
