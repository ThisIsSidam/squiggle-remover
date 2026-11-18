# Squiggle Remover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Obsidian plugin that removes spellcheck squiggles from `_underscored_`, Capitalized and **bold** text, only in user-chosen folders.

**Architecture:** Two pure, unit-tested modules (`findSpans` for text rules, `isInFolders` for folder gating) feed a CodeMirror 6 `ViewPlugin` that wraps matching ranges in `Decoration.mark({ attributes: { spellcheck: "false" } })`. A settings tab stores folders + toggles and triggers a state effect to re-decorate open editors.

**Tech Stack:** TypeScript, esbuild, vitest, `obsidian` API, `@codemirror/state` + `@codemirror/view` (external, provided by Obsidian).

**Spec:** `docs/superpowers/specs/2026-11-18-squiggle-remover-design.md`

**Not a git repo:** no commit steps; the user has not asked for version control.

## Global Constraints

- Plugin id `squiggle-remover`; name "Squiggle Remover"; `minAppVersion` `1.4.0`; `isDesktopOnly` `false`.
- Never modify note content; decorations only.
- Marks cover inner text only (not the `_` / `**` / `__` markers).
- Empty folder list = plugin inactive; the single entry `/` = whole vault.
- Folder match is case-insensitive, subfolders included, and path-segment aware.
- Defaults: `folders: []`, `underscore: true`, `bold: true`, `capitalized: true`, `spellcheckSentenceStart: false`.
- `obsidian`, `@codemirror/*`, `electron` and node builtins are esbuild externals; output is `main.js` at project root (CommonJS, es2018).

## Review Focus

1. Identifiers like `snake_case_name` and Python's `__init__` must not be treated as underscore spans (`__init__` is bold only when the bold rule is on).
2. Folder `Notes` must not match `Notes2/x.md` or `x/Notes/y.md`; blank lines, stray slashes and backslashes in the folder list must not break matching.
3. Unmatched or space-padded markers (`_open`, `_ x _`) and a 20,000-character line of repeated markers must produce no spans and must not hang.
4. Non-ASCII input: `Émile`, `Ñandú`, uncased Devanagari, and apostrophes (`O'Brien`, `'Rahul'`, `Rahul's`) must yield the expected capitalized spans without throwing.
5. Nested/overlapping matches (`**Rahul _ji_ aaya**`) must yield sorted, disjoint spans, since CM6's `RangeSetBuilder` throws on unsorted input.

---

### Task 1: Scaffold + folder gating

**Files:**
- Create: `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `manifest.json`, `versions.json`, `.gitignore`
- Create: `src/folders.ts`
- Test: `tests/folders.test.ts`

**Interfaces:**
- Produces: `isInFolders(path: string, folders: string[]): boolean`; `parseFolders(text: string): string[]` (one folder per line, trimmed, blanks dropped).

- [ ] **Step 1: Scaffold the project.** Standard Obsidian plugin layout: `package.json` scripts `build` (`node esbuild.config.mjs`), `dev` (same with `--watch`), `test` (`vitest run`), `typecheck` (`tsc --noEmit --skipLibCheck`); devDependencies `obsidian`, `@codemirror/state`, `@codemirror/view`, `esbuild`, `typescript`, `vitest`, `@types/node`, `builtin-modules`. `tsconfig.json`: strict, target ES2020, module ESNext, moduleResolution bundler, include `src` and `tests`. esbuild entry `src/main.ts` → `main.js` (format cjs, bundle, externals as in Global Constraints, sourcemap inline only in watch mode). `manifest.json` per Global Constraints with a one-sentence description. Run `npm install`.
- [ ] **Step 2: Write the failing tests** in `tests/folders.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isInFolders, parseFolders } from "../src/folders";

describe("isInFolders", () => {
  it("matches files inside a listed folder, including subfolders", () => {
    expect(isInFolders("Hinglish/a.md", ["Hinglish"])).toBe(true);
    expect(isInFolders("Hinglish/sub/b.md", ["Hinglish"])).toBe(true);
  });
  it("is path-segment aware", () => {
    expect(isInFolders("Hinglish2/a.md", ["Hinglish"])).toBe(false);
    expect(isInFolders("x/Hinglish/a.md", ["Hinglish"])).toBe(false);
    expect(isInFolders("Hinglish.md", ["Hinglish"])).toBe(false);
  });
  it("is case-insensitive", () => {
    expect(isInFolders("Hinglish/a.md", ["hinglish"])).toBe(true);
  });
  it("supports nested folders", () => {
    expect(isInFolders("Notes/Hinglish/a.md", ["Notes/Hinglish"])).toBe(true);
    expect(isInFolders("Notes/Other/a.md", ["Notes/Hinglish"])).toBe(false);
  });
  it("treats '/' as the whole vault", () => {
    expect(isInFolders("root.md", ["/"])).toBe(true);
    expect(isInFolders("any/where.md", ["/"])).toBe(true);
  });
  it("is inactive for an empty or blank list", () => {
    expect(isInFolders("a/b.md", [])).toBe(false);
    expect(isInFolders("a/b.md", ["", "   "])).toBe(false);
  });
  it("normalizes stray slashes and backslashes", () => {
    expect(isInFolders("Journal/x.md", ["/Journal/"])).toBe(true);
    expect(isInFolders("Journal/x.md", ["Journal\\"])).toBe(true);
  });
});

describe("parseFolders", () => {
  it("splits lines, trims, drops blanks", () => {
    expect(parseFolders("a\n\n  b/c \n")).toEqual(["a", "b/c"]);
  });
});
```

- [ ] **Step 3: Run `npx vitest run tests/folders.test.ts`.** Expected: FAIL (module `../src/folders` missing).
- [ ] **Step 4: Implement `isInFolders` and `parseFolders` in `src/folders.ts`** to satisfy the tests (normalize each entry: trim, `\`→`/`, strip leading/trailing `/`; entry that was exactly `/` or normalizes to empty-after-slash-only means vault root; compare lowercase with `startsWith(folder + "/")`).
- [ ] **Step 5: Run `npx vitest run tests/folders.test.ts`.** Expected: all PASS.

---

### Task 2: Span rules — underscore and bold

**Files:**
- Create: `src/spans.ts`
- Test: `tests/spans.test.ts`

**Interfaces:**
- Produces: `interface SpanOptions { underscore: boolean; bold: boolean; capitalized: boolean; spellcheckSentenceStart: boolean }`; `interface Span { from: number; to: number }`; `const MAX_LINE_LENGTH = 10_000`; `findSpans(line: string, opts: SpanOptions): Span[]` — one line of text in, offsets relative to the line start, sorted, disjoint, non-empty.

- [ ] **Step 1: Write the failing tests** in `tests/spans.test.ts` (this task's `describe` blocks; Task 3 appends more):

```ts
import { describe, it, expect } from "vitest";
import { findSpans, MAX_LINE_LENGTH, SpanOptions } from "../src/spans";

const OFF: SpanOptions = { underscore: false, bold: false, capitalized: false, spellcheckSentenceStart: false };
const texts = (line: string, o: Partial<SpanOptions>) =>
  findSpans(line, { ...OFF, ...o }).map((s) => line.slice(s.from, s.to));

describe("underscore spans", () => {
  const u = { underscore: true };
  it("marks inner text of _word_ and multi-word phrases", () => {
    expect(texts("_aaj_ main office", u)).toEqual(["aaj"]);
    expect(texts("_aaj office ja raha hoon_ kal", u)).toEqual(["aaj office ja raha hoon"]);
    expect(texts("a _b_ c _d_", u)).toEqual(["b", "d"]);
  });
  it("ignores identifiers and dunders", () => {
    expect(texts("use snake_case_name here", u)).toEqual([]);
    expect(texts("__init__", u)).toEqual([]);
  });
  it("ignores unmatched or space-padded markers", () => {
    expect(texts("_open without close", u)).toEqual([]);
    expect(texts("_ not a span _", u)).toEqual([]);
  });
  it("respects the toggle", () => {
    expect(texts("_aaj_", {})).toEqual([]);
  });
});

describe("bold spans", () => {
  const b = { bold: true };
  it("marks inner text of **x** and __x__", () => {
    expect(texts("**Rahul ji** aaye", b)).toEqual(["Rahul ji"]);
    expect(texts("__init__", b)).toEqual(["init"]);
  });
  it("ignores unmatched markers and respects the toggle", () => {
    expect(texts("** open", b)).toEqual([]);
    expect(texts("**x**", {})).toEqual([]);
  });
});

describe("long lines", () => {
  it("returns nothing for lines over MAX_LINE_LENGTH", () => {
    const line = "** a ".repeat(Math.ceil(MAX_LINE_LENGTH / 5) + 1);
    expect(line.length).toBeGreaterThan(MAX_LINE_LENGTH);
    expect(findSpans(line, { ...OFF, bold: true, underscore: true, capitalized: true })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run `npx vitest run tests/spans.test.ts`.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement `findSpans` in `src/spans.ts` for the underscore and bold rules only**, plus a private `mergeSpans(spans: Span[]): Span[]` that sorts and merges overlapping or touching ranges. Underscore rule: `_` not adjacent to a letter/digit/`_`, non-space first and last inner char, inner contains no `_`; bold rule: `**…**` and `__…__` (the latter also not adjacent to letters/digits/`_`), non-space just inside, single line. Use Unicode-aware (`u` flag) regexes; return `[]` early when `line.length > MAX_LINE_LENGTH`.
- [ ] **Step 4: Run `npx vitest run tests/spans.test.ts`.** Expected: all PASS.

---

### Task 3: Span rules — capitalized words, sentence start, merging

**Files:**
- Modify: `src/spans.ts`
- Test: `tests/spans.test.ts` (append)

**Interfaces:**
- Consumes: `findSpans`, `SpanOptions`, `mergeSpans` from Task 2.
- Produces: same `findSpans` signature, now also honoring `capitalized` and `spellcheckSentenceStart`.

- [ ] **Step 1: Append failing tests** to `tests/spans.test.ts`:

```ts
const ALL: SpanOptions = { underscore: true, bold: true, capitalized: true, spellcheckSentenceStart: false };

describe("capitalized words", () => {
  const c = { capitalized: true };
  it("exempts every capitalized word by default, including the first", () => {
    expect(texts("Mera naam Rahul hai", c)).toEqual(["Mera", "Rahul"]);
  });
  it("ignores lowercase-first words", () => {
    expect(texts("iPhone aur kal", c)).toEqual([]);
    expect(texts("McDonald gaya", c)).toEqual(["McDonald"]);
  });
  it("can still spellcheck sentence-initial words", () => {
    const s = { capitalized: true, spellcheckSentenceStart: true };
    expect(texts("Mera naam Rahul hai", s)).toEqual(["Rahul"]);
    expect(texts("kal Rahul aaya. Priya bhi", s)).toEqual(["Rahul"]);
    expect(texts("- Rahul aaya", s)).toEqual([]);
    expect(texts("> Rahul aaya", s)).toEqual([]);
    expect(texts("1. Rahul aaya", s)).toEqual([]);
    expect(texts("## Rahul aaya", s)).toEqual([]);
  });
  it("handles non-ASCII and uncased scripts", () => {
    expect(texts("Émile aur Ñandú", c)).toEqual(["Émile", "Ñandú"]);
    expect(texts("नमस्ते दोस्त", c)).toEqual([]);
  });
  it("handles apostrophes", () => {
    expect(texts("O'Brien ka ghar", c)).toEqual(["O'Brien"]);
    expect(texts("kal 'Rahul' ne kaha", c)).toEqual(["Rahul"]);
    expect(texts("kal Rahul's ghar", c)).toEqual(["Rahul's"]);
  });
});

describe("merging", () => {
  it("returns sorted, disjoint spans for nested matches", () => {
    const line = "**Rahul _ji_ aaya** aur _Priya_";
    const spans = findSpans(line, ALL);
    expect(spans.map((s) => line.slice(s.from, s.to))).toEqual(["Rahul _ji_ aaya", "Priya"]);
    for (let i = 1; i < spans.length; i++) expect(spans[i].from).toBeGreaterThan(spans[i - 1].to);
  });
  it("returns [] when every rule is off", () => {
    expect(findSpans("_a_ **b** C", OFF)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run `npx vitest run tests/spans.test.ts`.** Expected: new tests FAIL, Task 2 tests still PASS.
- [ ] **Step 3: Extend `findSpans`** with the capitalized rule: a word starts with an uppercase letter (`\p{Lu}`) not preceded by a letter/digit/`_`/apostrophe, continues with letters, combining marks, digits and straight/curly apostrophes, and any trailing apostrophes are trimmed from the span. When `spellcheckSentenceStart` is true, skip a word if the text before it — after stripping leading whitespace and any run of list (`-`, `*`, `+`, `1.`/`1)`), quote (`>`), heading (`#`…) or task-checkbox (`[ ]`/`[x]`) markers — is empty, or ends with `.`, `!`, `?` or `…` followed by optional closing quotes/brackets and whitespace. All matches go through `mergeSpans` before returning.
- [ ] **Step 4: Run `npx vitest run`.** Expected: all tests in both files PASS.

---

### Task 4: Settings, editor extension, plugin entry, build

**Files:**
- Create: `src/settings.ts`, `src/extension.ts`, `src/main.ts`, `MANUAL-TEST.md`, `README.md`

**Interfaces:**
- Consumes: `findSpans`, `SpanOptions` (spans.ts); `isInFolders`, `parseFolders` (folders.ts).
- Produces:
  - `src/settings.ts`: `interface SquiggleSettings extends SpanOptions { folders: string[] }`; `const DEFAULT_SETTINGS: SquiggleSettings` (values in Global Constraints); `class SquiggleSettingTab extends PluginSettingTab` taking the plugin and calling `plugin.saveSettings()` on every change.
  - `src/extension.ts`: `const refreshEffect: StateEffect<null>`; `squiggleExtension(getSettings: () => SquiggleSettings): Extension`.
  - `src/main.ts`: `export default class SquiggleRemoverPlugin extends Plugin` with `settings: SquiggleSettings`, `saveSettings(): Promise<void>` (saves, then calls `refreshEditors()`), `refreshEditors(): void`.

- [ ] **Step 1: Implement `src/extension.ts`.** `squiggleExtension` returns a `ViewPlugin` whose `decorations` field is a `DecorationSet`. It rebuilds when `update.docChanged`, `update.viewportChanged`, or a transaction carries `refreshEffect`. Build logic: read the note path from `view.state.field(editorInfoField)?.file?.path`; if missing or `!isInFolders(path, settings.folders)` → `Decoration.none`; otherwise, for each range in `view.visibleRanges`, iterate its lines (`view.state.doc.lineAt`/`line(n+1)`, no duplicate lines across ranges), call `findSpans(line.text, settings)`, and add `Decoration.mark({ attributes: { spellcheck: "false" } }).range(line.from + s.from, line.from + s.to)` via `RangeSetBuilder` in ascending order.
- [ ] **Step 2: Implement `src/settings.ts`.** Settings tab layout: heading text explaining "Squiggles are only removed inside the folders listed below; leave empty to disable, `/` for the whole vault"; a textarea for folders (one per line, parsed with `parseFolders` on change); toggles "Underscored text (_word_)", "Capitalized words", "Bold text", and "Still spellcheck the first word of a sentence" (description: "Capitalized words at the start of a sentence are normally exempt; turn this on to check them again").
- [ ] **Step 3: Implement `src/main.ts`.** `onload`: load settings merged over `DEFAULT_SETTINGS`, `addSettingTab`, `registerEditorExtension(squiggleExtension(() => this.settings))`. `refreshEditors`: for every `MarkdownView` leaf from `workspace.iterateAllLeaves`, dispatch `refreshEffect.of(null)` on its CM6 view (`(view.editor as unknown as { cm: EditorView }).cm`).
- [ ] **Step 4: Typecheck and build.** Run `npm run typecheck` then `npm run build`. Expected: no errors; `main.js` exists; `grep -c 'require("obsidian")' main.js` prints at least `1` (obsidian not bundled).
- [ ] **Step 5: Re-run `npm test`.** Expected: all PASS.
- [ ] **Step 6: Write `MANUAL-TEST.md`** — install steps (copy `main.js` + `manifest.json` into `<vault>/.obsidian/plugins/squiggle-remover/`, enable the plugin, add a folder in settings) and a checklist: in a note inside the folder, with spellcheck on, type `_aaj_`, `Rahul`, `**kal**` and a plain typo `teh`: marked words lose squiggles, `teh` keeps its squiggle; repeat in Source mode and Live Preview; wrap a word that already has a squiggle and confirm the squiggle clears; confirm a note outside the folder is unaffected; toggle each setting and confirm it takes effect without reload. **Write `README.md`** with a short usage summary (rules, folder setting, italic note, install, the unverified-in-Obsidian caveat).
