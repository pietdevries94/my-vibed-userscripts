// The fake site's CSS for captures without the site's own CSS.
const BASE_STYLE = `body { font: 14px system-ui, sans-serif; margin: 16px; }
.flex-row { display: flex; } .flex-column { display: flex; flex-direction: column; }
.flex-center { align-items: center; } .flex-grow { flex-grow: 1; }
.invisible, .visually-hidden, [hidden] { display: none; }
.bolt-coin, .vss-Persona { display: inline-block; width: 24px; height: 24px; border-radius: 50%; background: #bbb; position: relative; }
img { display: none; }`;
/**
 * The few utility and card styles of azure-devops-ui, Azure DevOps's open source
 * components, that the script's copies of its markup use. Values as in its core.css.
 */
const AZURE_DEVOPS_UI_STYLE = `.padding-horizontal-16 { padding-left: 16px; padding-right: 16px; }
.padding-horizontal-20 { padding-left: 20px; padding-right: 20px; }
.padding-vertical-8 { padding-top: 8px; padding-bottom: 8px; }
.padding-vertical-16 { padding-top: 16px; padding-bottom: 16px; }
.rhythm-horizontal-8 > :not(:first-child) { margin-left: 8px; }
.rhythm-vertical-16 > :not(:first-child) { margin-top: 16px; }
.margin-4 { margin: 4px; } .body-s { font-size: 0.75rem; } .body-m { font-size: 0.875rem; }
.monospaced-m { font-family: Menlo, Consolas, Courier New, monospace; font-size: 0.8125rem; }
.separator-line-top { border-top: 1px solid rgb(234, 234, 234); }
.text-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bolt-card { border-radius: 4px; overflow: hidden; padding: 20px 0; }
.bolt-card-white { background: #fff; }
.depth-8 { box-shadow: 0 3.2px 7.2px 0 rgba(0, 0, 0, .132), 0 0.6px 1.8px 0 rgba(0, 0, 0, .108); }`;
const PULL_REQUEST_STYLE = `${BASE_STYLE}
${AZURE_DEVOPS_UI_STYLE}
a.bolt-table-row { display: table-row; color: inherit; text-decoration: none; }
td { padding: 8px 4px; border-bottom: 1px solid #ddd; } .secondary-text { color: #666; }
.bolt-pill { border: 1px solid #999; border-radius: 10px; padding: 0 8px; margin-left: 4px; }`;
/** The run page's own layout: the step tree beside the log. */
const RUN_STYLE = `${BASE_STYLE}
.run-logs-view { display: flex; height: 90vh; } .bolt-master-panel { width: 320px; }
.logs-view { flex: 1; background: #1e1e1e; color: #ddd; padding: 8px; }
.bolt-tree-row td { border: 0; padding: 4px; } .bolt-tree-row.selected { background: #e6f0fa; }
[role="button"] { cursor: pointer; }`;
const BOARD_STYLE = `${BASE_STYLE}
.kanban-board-content { display: flex; gap: 8px; align-items: flex-start; }
.wit-card { border: 1px solid #ccc; border-radius: 4px; margin: 4px; padding: 6px; background: #fff; }
nav, header, .region-header, .project-navigation { display: none; }`;

export { BOARD_STYLE, PULL_REQUEST_STYLE, RUN_STYLE };
