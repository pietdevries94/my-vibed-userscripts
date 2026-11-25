# Restyle bug classes

What the owner kept finding in Windows 98 mode. Check each class on every new page and state.

## A rule matches a structure it was not written for

The site reuses a class in another structure, and the rule follows it there. Examples: the section header rule `> .flex-row:first-child` hit a list without sections, whose first child was the content, and clipped every row; a check list's class was also on the merge commit's table, which then stacked its cells; a centring rule for one banner hit another banner with the same classes. Write selectors for the structure (`:has()`, `:not(.content)`), and run the regression over every page after a shared rule changes.

## Heights and widths the site sets natively

The site sets sizes inline or in its own CSS: fixed field widths (270px), minimum column widths, cell heights taller than the row, transparent borders that take space, a header margin the design does not have. Measure the computed box (`getBoundingClientRect`, `getComputedStyle`) of every part of a row, not only the row. Anything 0.5px off is a sub-pixel position: find the half pixel and remove it.

## Long values and narrow layouts

Real values run longer than a capture's, and the site switches layout at narrow widths: a comment header puts the time under a long author name, and a script feature sizes avatar initials before the mode shrinks the avatar. A one-line bar then wraps and spills. Invent long values and narrow widths in a failure-count check, such as `thread-title-bar-failures`, and force the layout the design wants (one row, an ellipsis, a fixed size) rather than relying on the capture's.

## Long lists draw only the rows in view

Azure DevOps's long tables and trees draw the rows in view and keep the rest's height in spacer rows (`.bolt-list-row-spacer`, the height inline on `.bolt-list-cell-spacer`). A rule that hides spacers, to lay rows out as blocks or a grid, cuts the scroll height at the last drawn row, and the rest never loads: the Files tree of a pull request with hundreds of files stopped a fifth of the way down. Show spacers as blocks, and check a capture with a long list, as `tree-scroll-failures` does.

## Portals, callouts and drop-downs

Menus, tooltips and drop-downs render in a portal outside the page, so page-scoped rules miss them, and a callout's frame wraps whatever is inside it. A tooltip got the menu's frame; a multi-select list painted every checked row as selected. Style the frame by what it holds (`:has(.tooltip-content)`), and check the portal markup in a capture with it open.

## States a capture cannot hold

`:hover`, `:focus` and animations are not in a capture. Reach them on the fake site (`page.hover()`), diff them as their own state, and check them with a failure count. A hover rule that looks right can still miss the text when the cells are taller than the row.

## Fonts that break measurements

Swapping the font changes widths the site measured with its own font: an editor's indent guides, a text field's autosize, an ellipsis. Keep the editor's font where it measures text, or hide what it draws from the measurement.

## Spacing the mode switched off

A mode that removes the site's spacing utilities (rhythm margins) and spaces with its own gaps leaves gaps missing wherever it did not add one, such as rows a feature has not processed yet. Check a component in every state it can be in, including before a feature has run.

## Stale tools and fixtures

A diff that reads low can be wrong: a hard-coded state name, a hidden template element, a fixed point that is the same colour either way, an import that parsed a capture as plain HTML and emptied its rows. Run a new check against the broken code and see it fail; look at both screenshots; check a re-imported capture's structure before you use it.
