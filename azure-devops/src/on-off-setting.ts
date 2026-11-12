interface OnOffSettingOptions {
  defaultValue: boolean;
  /** The storage key. Changing it resets every owner's choice. */
  key: string;
  /** The menu caption, before ": on" or ": off". */
  label: string;
  /** Registers a menu command. A second call with the same id replaces its caption. */
  menu: { register: (caption: string, onClick: () => void, id: string) => void };
  onChange: (isOn: boolean) => void;
  storage: {
    get: (key: string, defaultValue: boolean) => boolean;
    set: (key: string, value: boolean) => void;
  };
}

interface OnOffSetting {
  isOn: () => boolean;
}

/** A setting the owner flips in the Violentmonkey menu. The caption shows its state. */
function createOnOffSetting(options: OnOffSettingOptions): OnOffSetting {
  const { key, label, menu, onChange, storage } = options;
  let isOn = storage.get(key, options.defaultValue);

  function showInMenu(): void {
    menu.register(`${label}: ${isOn ? "on" : "off"}`, flip, key);
  }

  function flip(): void {
    isOn = !isOn;
    storage.set(key, isOn);
    showInMenu();
    onChange(isOn);
  }

  showInMenu();
  return { isOn: () => isOn };
}

export { createOnOffSetting };
export type { OnOffSetting, OnOffSettingOptions };
