# Manual test in Obsidian

The unit tests cover the text rules and folder matching. They cannot prove that Obsidian's
Chromium actually honors `spellcheck="false"` on the marked ranges, so run this once in a real vault.

## Install

1. `npm install && npm run build`
2. Copy `main.js`, `manifest.json` and `styles.css` into `<your vault>/.obsidian/plugins/squiggle-remover/`
3. Obsidian → Settings → Community plugins → turn off Restricted mode → enable **Squiggle Remover**
4. Make sure spellcheck is on: Settings → Editor → **Spellcheck**
5. Settings → Squiggle Remover → Folders → add a folder, e.g. `Hinglish`

## Checklist

Create `Hinglish/test.md` and type (or paste) this on separate lines:

```
mujhe _kal subah office jana hai_ aur wahan Rahul se milna hai
**bhai** kya haal hai
teh quick brown fox
```

- [ ] `kal subah office jana hai`, `Rahul` and `bhai` have **no** red squiggles.
- [ ] The plain typo `teh` **does** keep its squiggle, and so do unmarked Hinglish words like `mujhe`, `aur`, `wahan`, `milna`.
- [ ] Same result in **Live Preview** and in **Source mode**.
- [ ] Type a new unmarked word (`bhaiya`) and it gets a squiggle; wrap it as `_bhaiya_` and the squiggle disappears (this checks that an already-existing squiggle is cleared).
- [ ] Put the same text in a note **outside** the folder: squiggles stay everywhere.
- [ ] Settings toggles take effect immediately, with no reload: turn off Marked / Capitalized / Bold and the matching squiggles come back; turn on "Still spellcheck the first word of a sentence" and `Rahul` at the start of a line gets a squiggle again if misspelled (e.g. `Rahull`).
- [ ] Empty the Folders box: no squiggles are removed anywhere. Enter `/`: they are removed in every note.
- [ ] Custom marker: set **Marker characters** to `/`, then `/kal office/` loses its squiggles and `_kal_` gets them back; `and/or` is unaffected. Try an invalid marker (a letter), click away, and confirm the field reverts with a notice.
- [ ] Several markers: set it to `/~|`, then `/a/`, `~b~` and `|c|` all lose their squiggles.
- [ ] Hide markers (Live Preview): with the cursor elsewhere, `/kal office/` shows as plain `kal office` with no slashes and no italics; click into the word and the slashes reappear; move away and they hide again. Same for `_kal_` (no italics).
- [ ] Source mode: the markers are always visible.
- [ ] Reading view: `/kal office/` shows `kal office` without slashes; `https://example.com/a/b` and code blocks are unchanged.
- [ ] Turn **Hide markers** off: markers stay visible everywhere (re-open the note for Reading view).
- [ ] Reload Obsidian: settings (including the marker) persist.

## If squiggles do not disappear

Open the developer console (Ctrl+Shift+I) → Elements, inspect a marked word, and check it sits inside a
`<span spellcheck="false">`. If it does and the squiggle still shows, Chromium is not honoring the attribute
on inline spans in this Obsidian version; tell me and we will pick another approach.
