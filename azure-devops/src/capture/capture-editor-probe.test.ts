import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { editorProbeOf } from "./capture-editor-probe.ts";
import { test } from "node:test";

const codeEditor = { changeViewZones: (): null => null };
const diffEditor = { getModifiedEditor: (): typeof codeEditor => codeEditor };

function pageWithEditorElement(): { document: Document; element: Element } {
  const { document } = new JSDOM('<div class="vss-base-editor"></div>').window;
  const element = document.querySelector(".vss-base-editor");
  assert.ok(element !== null);
  return { document, element };
}

test("the probe lists the editor API's functions and how many editors it knows", () => {
  const { document } = pageWithEditorElement();
  const pageWindow = {
    define: (): null => null,
    monaco: {
      editor: {
        EditorType: {},
        create: (): null => null,
        getEditors: (): unknown[] => [codeEditor],
      },
    },
  };
  const probe = editorProbeOf(pageWindow, document);
  assert.deepEqual(
    {
      diffEditorCount: probe.diffEditorCount,
      editorCount: probe.editorCount,
      editorFunctions: probe.editorFunctions,
      loaderTypes: probe.loaderTypes,
      monacoType: probe.monacoType,
    },
    {
      diffEditorCount: null,
      editorCount: 1,
      editorFunctions: ["create", "getEditors"],
      loaderTypes: ["undefined", "function"],
      monacoType: "object",
    },
  );
});

test("the probe finds an editor a framework node above the editor's element holds", () => {
  const { document, element } = pageWithEditorElement();
  const holder = { memoizedProps: {}, return: null, stateNode: { editor: diffEditor, name: "x" } };
  Object.assign(element, {
    __reactFiber$abc: { memoizedProps: { inner: codeEditor }, return: holder, stateNode: null },
  });
  const probe = editorProbeOf({}, document);
  assert.deepEqual(probe.editorRoutes, ["0:memoizedProps.inner:code", "1:stateNode.editor:diff"]);
  assert.deepEqual(probe.elementKeyKinds, ["__reactFiber"]);
});

test("a page without an editor, or a probe that fails, still gives a probe", () => {
  const { document } = new JSDOM("<p></p>").window;
  assert.deepEqual(editorProbeOf({}, document).editorRoutes, []);
  const { document: withEditor } = pageWithEditorElement();
  const failing = {
    monaco: {
      editor: {
        getEditors: (): never => {
          throw new TypeError("no editors");
        },
      },
    },
  };
  const probe = editorProbeOf(failing, withEditor);
  assert.deepEqual([probe.failure, probe.monacoType], ["TypeError", "undefined"]);
});
