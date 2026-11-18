# Squiggle Remover

An Obsidian plugin that removes red spellcheck squiggles from words you choose, only in the folders you choose.
Useful when you write English mixed with Hinglish (or any language the spellchecker doesn't know) and don't want
every word underlined, while real typos in ordinary English still get flagged.

Desktop only.

## What it does

In notes inside the configured folders, it stops the spellchecker underlining:

| Rule | Example | Toggle |
|------|---------|--------|
| Marked text | `_kal office jana hai_` (default marker) or `/kal office jana hai/` with a custom marker | Marked text |
| Capitalized words | `Rahul`, `Mumbai` | Capitalized words |
| Bold text | `**bhai**` | Bold text |

Everything else is still spellchecked, so real typos in ordinary prose are still flagged.
Optionally, capitalized words at the start of a sentence can be spellchecked again.

Your notes are never modified; the plugin only tells the editor to skip spellchecking certain ranges.

## Settings

- **Folders**: one per line, relative to the vault root, subfolders included, case-insensitive.
  Empty means the plugin does nothing; `/` means the whole vault.
- **Marker characters**: the characters you wrap text in. The default is `_`; type `/~|` to use `/word/`,
  `~word~` and `|word|` all at once (up to 8 markers, each used on its own). Each must be one punctuation or
  symbol character (not a letter, digit or space). A marker inside a word (`and/or`, `snake_case`) or in a
  URL is ignored.
- **Hide markers** (on by default): the marker characters are hidden and the word is shown with no
  formatting of its own. In Live Preview they reappear while your cursor is on the word (like Obsidian's own
  `**bold**` markers); Source mode always shows the raw text; Reading view strips them when a note is
  opened. Only your marker characters are hidden; Markdown's own `**bold**` etc. are never touched.
- Toggles for each rule, plus "Still spellcheck the first word of a sentence".

Spellcheck itself must be turned on in Obsidian (Settings → Editor → Spellcheck).

## Installation

**From the community plugins list** (once listed): Settings → Community plugins → Browse, search for
"Squiggle Remover", then Install and Enable.

**Manually**: download `main.js`, `manifest.json` and `styles.css` from the latest
[release](../../releases) and put them in `<your vault>/.obsidian/plugins/squiggle-remover/`, then enable the
plugin under Settings → Community plugins.

## Privacy

The plugin runs entirely offline. It makes no network requests, collects no telemetry, needs no account, and
reads or writes nothing outside your vault (apart from its own settings file in the plugin folder).

## Limitations

- Desktop only. Spellcheck on mobile is done by the system keyboard, and this has not been tried there.
- It works by telling the editor to skip spellchecking the marked ranges (`spellcheck="false"`). This was
  verified in Obsidian's Live Preview on desktop; it relies on the editor honoring that attribute.
- Prefer a marker Markdown doesn't use (`/`, `~`, `|`). With `_` or `*`, Obsidian itself turns the word into
  italics in Reading view, which this plugin cannot undo; in the editor it shows the word plain.
- In Reading view, markers are only hidden when the marked text sits in a single piece of text. A marked phrase
  that contains other formatting (e.g. `/Rahul **ji**/`) keeps its markers there; the editor handles it fine.
- Very long lines (over 10,000 characters) are skipped.

## Development

```
npm install
npm run build      # produces main.js
npm test           # unit tests (text rules, folder matching, settings, decoration planning)
npm run typecheck
npm run dev        # rebuild on change
```

See `MANUAL-TEST.md` for the in-Obsidian checklist, and
`docs/superpowers/specs/2026-11-18-squiggle-remover-design.md` for how it works.

## License

[MIT](LICENSE) © Anshu Kumar Singh
