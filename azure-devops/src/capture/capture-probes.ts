// What a pull request capture measures on the page besides its content: the editor
// probe, the file tree's layout and the activity feed's layout. Dev file only.
import { editorProbeOf, pageWindowOf } from "./capture-editor-probe.ts";
import { feedLayoutOf } from "./capture-feed-layout.ts";
import { treeLayoutOf } from "./capture-tree-layout.ts";

interface PageProbes {
  editorProbe: ReturnType<typeof editorProbeOf>;
  feedLayout: ReturnType<typeof feedLayoutOf>;
  treeLayout: ReturnType<typeof treeLayoutOf>;
}

function pageProbesOf(document: Document): PageProbes {
  return {
    editorProbe: editorProbeOf(pageWindowOf(), document),
    feedLayout: feedLayoutOf(document),
    treeLayout: treeLayoutOf(document),
  };
}

export { pageProbesOf };
