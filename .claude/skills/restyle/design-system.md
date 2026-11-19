# Design system

A look has a design system on claude.ai beside its shared CSS. They hold the same tokens under the
same names, so a value changes in both or in neither.

- Windows 98: https://claude.ai/artifact/Q9yQHNLHwF2r5Bqqvdr7CS (made from the Design System type),
  code in `shared/styles/win98/`.

## Start a restyle in a look that has one

1. Read the system's `project/README.md` (Artifact `read` with that path), then its components.
2. Import `shared/styles/<look>/tokens.css` in the feature's `styles`, before the script's own CSS.
3. Draw each artboard with the system's tokens and its `components/bundle.css` classes: copy the
   component markup from its preview, then fill in the capture's structure and text.
4. Follow the loop in `SKILL.md` from there.

## Start a new look

1. Run Artifact `quickstart` with intent "other" and create a system from the Design System type
   it names, titled after the look.
2. Write its `tokens.json` with `<look>-` token names, so the type's generated `tokens.css`
   defines the same custom properties the code uses; what `tokens.json` cannot hold (font stacks
   with quotes, gradients, icon data URIs) goes at the top of `components/bundle.css`.
3. Write `shared/styles/<look>/tokens.css` and `components.css` from the same values, and the
   test that every token the CSS uses is defined (`shared/styles/win98/tokens.test.ts`).
4. Add a component to the system and to `components.css` together: a README with when to use it,
   a preview with its states.

A change to a token or component goes into both, in the same piece of work.
