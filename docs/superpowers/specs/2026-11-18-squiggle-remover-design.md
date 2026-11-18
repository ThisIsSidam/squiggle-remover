# Squiggle Remover — Design (short)

Status: approved by the user in conversation (2026-11-18).

## Intent and why
The user writes English mixed with Hinglish (romanized Hindi) in Obsidian. The
built-in spellchecker underlines every Hinglish word in red. They want a plugin
that removes those squiggles only where they ask for it, so real typos in
ordinary English prose still get flagged.

## Goals
- Suppress spellcheck squiggles on:
  1. text wrapped in underscores: `_word_` or `_a whole phrase_` (renders italic in Markdown — accepted by the user);
  2. Capitalized words (likely names/nouns);
  3. **bold** text (`**x**` and `__x__`).
- Each of the three rules has its own toggle.
- Works only in user-chosen folders (subfolders included).
- Works in the editor (Source mode and Live Preview).

## Non-goals
- No language detection, no custom dictionary, no spellchecking of our own.
- No squiggle handling in Reading view (it never shows squiggles); only marker hiding applies there (see amendments).
- No multi-character markers (each marker is one character; several can be active at once, see amendments).
- No mobile-specific work (iOS/Android spellcheck is OS-driven; best effort only).

## Anti-goals
- Must not disable spellcheck for ordinary prose, or for notes outside the chosen folders.
- Must not modify note content in any way.

## Constraints / key finding
Obsidian exposes no spellcheck API; Chromium draws the squiggles in the editor.
The only workable lever is to wrap the matching ranges in an element carrying
`spellcheck="false"`, which Chromium skips. In CodeMirror 6 this is
`Decoration.mark({ attributes: { spellcheck: "false" } })`.
Not verifiable from the build environment: that real Obsidian/Chromium honors
the attribute on inline spans must be confirmed manually in a vault (manual test note included in the plan).

## Approaches considered
1. **CM6 mark decorations with `spellcheck="false"` (chosen).** Per-range, per-folder, no global side effects.
2. Add words to Chromium's custom dictionary via Electron session — global, not per-folder, needs non-public API. Rejected.
3. Turn spellcheck off for the whole editor in matching folders — too blunt; kills real typo detection. Rejected.

## Design
- TypeScript, esbuild, standard Obsidian community-plugin layout
  (`manifest.json`, `main.ts`, `package.json`, `esbuild.config.mjs`, `tsconfig.json`, `versions.json`). Plugin id `squiggle-remover`.
- **Pure core (unit-tested with vitest), no Obsidian/CM imports:**
  - `findSpans(text, opts) → {from,to}[]` — returns disjoint, sorted ranges for a chunk of text (a line or a visible range).
  - `isInFolders(path, folders) → boolean` — normalizes slashes; match if `path` is inside a listed folder; `/` means the whole vault; empty list means inactive.
- **Editor extension:** a CM6 `ViewPlugin` registered via `registerEditorExtension`. It reads the note path from Obsidian's `editorInfoField`, returns no decorations if the note isn't in a configured folder, otherwise scans `view.visibleRanges` line by line and builds a `RangeSet` of marks. Rebuilds on doc/viewport change and on a `refresh` state effect.
- **Settings** (`PluginSettingTab`, persisted with `loadData/saveData`): folders (textarea, one per line); toggles for underscore spans, capitalized words, bold; sub-option "Still spellcheck the first word of a sentence" (default off). On change, dispatch the `refresh` effect to all open markdown editors.
- **Rule details (builder's calls, flagged for the user):**
  - Underscore span: `_` not adjacent to a word char or another `_`, non-space just inside both ends, no newline inside. Only the inner text is marked.
  - Bold: `**…**` and `__…__`, single line. Marks inner text.
  - Capitalized word: starts with an uppercase letter (Unicode-aware); apostrophes allowed inside the word. All capitalized words are exempt by default, including sentence-initial ones; the sub-option makes sentence-initial words (line start after list/quote/heading markers, or after `.`/`!`/`?`) spellchecked again.
  - Empty folder list = plugin does nothing (settings page explains this and that `/` means everywhere).
  - Overlapping matches are merged into disjoint ranges before building the decoration set.

## Amendment: configurable marker (2026-11-18, requested by the user)
The marked-text rule's `_` is now a setting (`marker`, default `_`) instead of a fixed character, e.g. `/word/`.
- Replaces `_` (one marker at a time); the rule toggle is renamed `underscore` → `marked` (old saved value is migrated).
- A marker is exactly one punctuation/symbol character (`isValidMarker`); settings that fail this fall back to `_`. The settings field ignores invalid input and reverts on blur with a notice.
- The regex embeds the marker as a `\u{hex}` escape so regex-special characters match literally; same adjacency rules as `_` (not glued to letters/digits/the marker itself).
- Bold (`**x**`, `__x__`) stays hard-coded and independent of the marker.
- Settings parsing/validation lives in the pure `src/config.ts` (`sanitizeSettings`) so it is unit-tested.

## Amendment 2: hidden markers, several markers (2026-11-18, requested by the user)
- `marker: string` → `markers: string[]` (up to 8 unique single punctuation/symbol characters, all active at once; each matched independently). Old `marker` is migrated.
- New setting `hideMarkers` (default on). Live Preview: marker characters are hidden with `Decoration.replace`, except while the selection touches the marked occurrence (markers included); Source mode never hides. Reading view: a markdown post-processor strips markers from single text nodes per line (skipping code/pre/math).
- Marked words get the `squiggle-remover-marked` class; `styles.css` forces `font-style: normal` so `_`/`*` markers never leave the word italic in the editor.
- "Separate from other markers": only configured marker characters are hidden or styled; Markdown's own `**`/`__` bold rule is unchanged and independent. Markdown-reserved markers (`_`, `*`) are still allowed but Reading view italics from them cannot be undone (documented).
- Decoration planning is a pure function (`planLine` in `src/ranges.ts`) so hide/touch logic is unit-tested without CodeMirror.

## Left to the builder
File layout inside the project, exact regexes (must satisfy the rules above), settings UI wording, test cases, and the manual test note.

## Open verification
Manual check in a real vault that squiggles disappear on marked ranges and still appear on unmarked typos, in both Live Preview and Source mode, including when a squiggle already exists before the marker is typed.
