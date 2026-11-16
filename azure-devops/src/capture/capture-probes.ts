// What a pull request capture measures on the page besides its content: the editor
// probe and the file tree's layout. Dev file only.
import { editorProbeOf, pageWindowOf } from "./capture-editor-probe.ts";
import { treeLayoutOf } from "./capture-tree-layout.ts";

interface PageProbes {
  editorProbe: ReturnType<typeof editorProbeOf>;
  treeLayout: ReturnType<typeof treeLayoutOf>;
}

function pageProbesOf(document: Document): PageProbes {
  return {
    editorProbe: editorProbeOf(pageWindowOf(), document),
    treeLayout: treeLayoutOf(document),
  };
}

export { pageProbesOf };
