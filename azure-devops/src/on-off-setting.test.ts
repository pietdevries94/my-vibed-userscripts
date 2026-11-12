import type { OnOffSettingOptions } from "./on-off-setting.ts";
import assert from "node:assert/strict";
import { createOnOffSetting } from "./on-off-setting.ts";
import { test } from "node:test";

interface TestMenu {
  captions: Map<string, string>;
  click: (id: string) => void;
  options: Omit<OnOffSettingOptions, "onChange">;
  stored: Map<string, boolean>;
}

function ignoreChange(): void {
  // The test reads the setting itself.
}

function testMenu(stored: [string, boolean][] = []): TestMenu {
  const captions = new Map<string, string>();
  const clicks = new Map<string, () => void>();
  const values = new Map(stored);
  return {
    captions,
    click: (id) => clicks.get(id)?.(),
    options: {
      defaultValue: true,
      key: "colour-mode",
      label: "Colour mode",
      menu: {
        register: (caption, onClick, id) => {
          captions.set(id, caption);
          clicks.set(id, onClick);
        },
      },
      storage: {
        get: (key, defaultValue) => values.get(key) ?? defaultValue,
        set: (key, value) => {
          values.set(key, value);
        },
      },
    },
    stored: values,
  };
}

test("a setting nobody changed has its default, and the menu says so", () => {
  const menu = testMenu();
  const setting = createOnOffSetting({ ...menu.options, onChange: ignoreChange });
  assert.equal(setting.isOn(), true);
  assert.deepEqual([...menu.captions.values()], ["Colour mode: on"]);
});

test("a stored value wins over the default", () => {
  const menu = testMenu([["colour-mode", false]]);
  const setting = createOnOffSetting({ ...menu.options, onChange: ignoreChange });
  assert.equal(setting.isOn(), false);
  assert.deepEqual([...menu.captions.values()], ["Colour mode: off"]);
});

test("a click flips the setting, stores it, updates the menu and reports the change", () => {
  const menu = testMenu();
  const changes: boolean[] = [];
  const setting = createOnOffSetting({
    ...menu.options,
    onChange: (isOn) => {
      changes.push(isOn);
    },
  });
  const [id] = menu.captions.keys();
  menu.click(id);
  assert.equal(setting.isOn(), false);
  assert.equal(menu.stored.get("colour-mode"), false);
  assert.deepEqual([...menu.captions.values()], ["Colour mode: off"]);
  menu.click(id);
  assert.deepEqual(changes, [false, true]);
  assert.deepEqual([...menu.captions.values()], ["Colour mode: on"]);
});
