import { Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { SquiggleSettings } from "./config";
import { parseFolders } from "./folders";
import { MAX_MARKERS, parseMarkers } from "./spans";

/** What the settings tab needs from the plugin (avoids a circular import of main.ts). */
export interface SettingsHost extends Plugin {
  settings: SquiggleSettings;
  saveSettings(): Promise<void>;
}

type ToggleKey = "marked" | "hideMarkers" | "capitalized" | "bold" | "spellcheckSentenceStart";

export class SquiggleSettingTab extends PluginSettingTab {
  constructor(private host: SettingsHost) {
    super(host.app, host);
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.host.settings;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Folders")
      .setDesc(
        "Squiggles are only removed in notes inside these folders (subfolders included). " +
          "One folder per line, relative to the vault root. Leave empty to turn the plugin off; use / for the whole vault.",
      )
      .addTextArea((text) => {
        text
          .setPlaceholder("Hinglish\nJournal/Notes")
          .setValue(settings.folders.join("\n"))
          .onChange(async (value) => {
            settings.folders = parseFolders(value);
            await this.host.saveSettings();
          });
        text.inputEl.rows = 5;
        text.inputEl.cols = 30;
      });

    this.addToggle("Marked text", "Remove squiggles from text wrapped in a marker character: a single word or a whole phrase.", "marked");

    new Setting(containerEl)
      .setName("Marker characters")
      .setDesc(
        `The characters you wrap text in. Type up to ${MAX_MARKERS} together, e.g. /~| lets you write /word/, ~word~ and |word|. ` +
          "Each must be a punctuation or symbol character (not a letter, digit or space). " +
          "Characters Markdown already uses (_ and *) make Obsidian format the word in Reading view; others like / are fully plain.",
      )
      .addText((text) => {
        text.setPlaceholder("_").setValue(settings.markers.join("")).onChange(async (value) => {
          const parsed = parseMarkers(value);
          if (!parsed) return; // wait until the field holds valid markers
          settings.markers = parsed;
          await this.host.saveSettings();
        });
        text.inputEl.size = 10;
        text.inputEl.addEventListener("blur", () => {
          if (!parseMarkers(text.inputEl.value)) {
            new Notice(`Markers must be 1 to ${MAX_MARKERS} punctuation or symbol characters, such as / _ ~ or |.`);
          }
          text.inputEl.value = settings.markers.join(""); // revert if invalid, tidy if valid
        });
      });

    this.addToggle(
      "Hide markers",
      "Hide the marker characters around marked words, and show the word without formatting. In Live Preview they reappear " +
        "while your cursor is on the word; Source mode always shows the raw text. Reading view updates when a note is re-opened.",
      "hideMarkers",
    );

    this.addToggle("Capitalized words", "Remove squiggles from words that start with a capital letter (names, places).", "capitalized");
    this.addToggle("Bold text", "Remove squiggles from **bold** text.", "bold");
    this.addToggle(
      "Still spellcheck the first word of a sentence",
      "Capitalized words are normally exempt everywhere. Turn this on to check them again at the start of a sentence, list item or heading.",
      "spellcheckSentenceStart",
    );
  }

  private addToggle(name: string, desc: string, key: ToggleKey): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings[key]).onChange(async (value) => {
          this.host.settings[key] = value;
          await this.host.saveSettings();
        }),
      );
  }
}
