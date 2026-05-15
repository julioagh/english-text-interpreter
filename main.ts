import {
  Plugin,
  PluginSettingTab,
  App,
  Setting,
  Notice,
  Editor,
  MarkdownView,
  Modal,
  requestUrl,
} from "obsidian";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Interpretation {
  meaning: string;
  tone: string;
  context: string;
  intent: string;
}

interface PluginSettings {
  ollamaEndpoint: string;
  ollamaModel: string;
  language: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
  ollamaEndpoint: "http://localhost:11434",
  ollamaModel: "gemma3:4b",
  language: "Spanish",
};

// ---------------------------------------------------------------------------
// Ollama client
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 30_000;

async function interpretWithOllama(
  text: string,
  settings: PluginSettings
): Promise<Interpretation> {
  const prompt = buildPrompt(text, settings.language);

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout: Ollama no respondió en 30 segundos")), TIMEOUT_MS)
  );

  const fetchPromise = requestUrl({
    url: `${settings.ollamaEndpoint}/api/generate`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.ollamaModel,
      prompt,
      stream: false,
      format: "json",
    }),
  });

  const response = await Promise.race([fetchPromise, timeoutPromise]);

  if (response.status !== 200) {
    throw new Error(`Ollama respondió con status ${response.status}`);
  }

  return parseInterpretation(response.json.response ?? "");
}

function buildPrompt(text: string, language: string): string {
  return `You are an expert in English linguistics, pragmatics, and cultural communication.

Analyze the following English text and return a JSON object with these four fields:
- "meaning": the actual meaning of the text (not a literal word-for-word translation, but what it really means in context). Write in ${language}.
- "tone": describe the emotional tone, register, and attitude (e.g. formal, sarcastic, enthusiastic, polite but firm). Write in ${language}.
- "context": any relevant cultural, idiomatic, or situational context the reader should know to fully understand the text. Write in ${language}.
- "intent": what the speaker/writer is trying to achieve with this text (inform, persuade, warn, joke, request, etc.). Write in ${language}.

Keep each field to 1–3 sentences maximum. Be specific, not generic.

TEXT:
"""
${text}
"""

Respond ONLY with valid JSON. No explanation outside the JSON. Example format:
{"meaning":"...","tone":"...","context":"...","intent":"..."}`;
}

function parseInterpretation(raw: string): Interpretation {
  const fallback: Interpretation = { meaning: "—", tone: "—", context: "—", intent: "—" };

  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<Interpretation>;
    return {
      meaning: typeof parsed.meaning === "string" ? parsed.meaning : "—",
      tone: typeof parsed.tone === "string" ? parsed.tone : "—",
      context: typeof parsed.context === "string" ? parsed.context : "—",
      intent: typeof parsed.intent === "string" ? parsed.intent : "—",
    };
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    try {
      const parsed = JSON.parse(match[0]) as Partial<Interpretation>;
      return {
        meaning: typeof parsed.meaning === "string" ? parsed.meaning : "—",
        tone: typeof parsed.tone === "string" ? parsed.tone : "—",
        context: typeof parsed.context === "string" ? parsed.context : "—",
        intent: typeof parsed.intent === "string" ? parsed.intent : "—",
      };
    } catch {
      return fallback;
    }
  }
}

// ---------------------------------------------------------------------------
// Result modal
// ---------------------------------------------------------------------------

class InterpretationModal extends Modal {
  private selectedText: string;
  private result: Interpretation;

  constructor(app: App, selectedText: string, result: Interpretation) {
    super(app);
    this.selectedText = selectedText;
    this.result = result;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("eti-modal");

    contentEl.createEl("h2", { text: "Interpretation", cls: "eti-modal-title" });

    contentEl.createDiv({
      cls: "eti-panel-quote",
      text: this.selectedText.length > 120
        ? this.selectedText.slice(0, 119) + "…"
        : this.selectedText,
    });

    const sections: Array<{ label: string; key: keyof Interpretation }> = [
      { label: "Meaning", key: "meaning" },
      { label: "Tone", key: "tone" },
      { label: "Context", key: "context" },
      { label: "Intent", key: "intent" },
    ];

    for (const { label, key } of sections) {
      const sec = contentEl.createDiv({ cls: "eti-section" });
      sec.createDiv({ cls: "eti-section-label", text: label });
      sec.createDiv({ cls: "eti-section-content", text: this.result[key] });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ---------------------------------------------------------------------------
// Main plugin
// ---------------------------------------------------------------------------

export default class EnglishTextInterpreterPlugin extends Plugin {
  settings: PluginSettings;
  private interpreting = false;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "interpret-selection",
      name: "Interpret selected text",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        void this.interpretSelection(editor, view);
      },
    });

    this.addSettingTab(new EnglishTextInterpreterSettingTab(this.app, this));
  }

  private async interpretSelection(editor: Editor, _view: MarkdownView) {
    if (this.interpreting) {
      new Notice("Already interpreting, please wait…");
      return;
    }

    const selectedText = editor.getSelection();
    if (!selectedText || selectedText.trim().length < 5) {
      new Notice("Select some text to interpret.");
      return;
    }

    this.interpreting = true;
    const notice = new Notice("Interpreting with Ollama…", 0);

    try {
      const result = await interpretWithOllama(selectedText, this.settings);
      new InterpretationModal(this.app, selectedText, result).open();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[EnglishTextInterpreter]", err);
      new Notice(`⚠ ${msg}`);
    } finally {
      notice.hide();
      this.interpreting = false;
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

class EnglishTextInterpreterSettingTab extends PluginSettingTab {
  plugin: EnglishTextInterpreterPlugin;

  constructor(app: App, plugin: EnglishTextInterpreterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Ollama endpoint")
      .setDesc("URL where Ollama is running")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:11434")
          .setValue(this.plugin.settings.ollamaEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.ollamaEndpoint = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Ollama model to use (e.g. gemma3:4b, gemma3:12b)")
      .addText((text) =>
        text
          .setPlaceholder("gemma3:4b")
          .setValue(this.plugin.settings.ollamaModel)
          .onChange(async (value) => {
            this.plugin.settings.ollamaModel = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Interpretation language")
      .setDesc("Language for the interpretation output")
      .addDropdown((drop) =>
        drop
          .addOption("Spanish", "Español")
          .addOption("English", "English")
          .addOption("Portuguese", "Português")
          .addOption("French", "Français")
          .addOption("German", "Deutsch")
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
