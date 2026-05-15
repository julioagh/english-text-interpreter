var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => EnglishTextInterpreterPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  ollamaEndpoint: "http://localhost:11434",
  ollamaModel: "gemma3:4b",
  language: "Spanish"
};
var TIMEOUT_MS = 3e4;
async function interpretWithOllama(text, settings) {
  var _a;
  const prompt = buildPrompt(text, settings.language);
  const timeoutPromise = new Promise(
    (_, reject) => setTimeout(() => reject(new Error("Timeout: Ollama no respondi\xF3 en 30 segundos")), TIMEOUT_MS)
  );
  const fetchPromise = (0, import_obsidian.requestUrl)({
    url: `${settings.ollamaEndpoint}/api/generate`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.ollamaModel,
      prompt,
      stream: false,
      format: "json"
    })
  });
  const response = await Promise.race([fetchPromise, timeoutPromise]);
  if (response.status !== 200) {
    throw new Error(`Ollama respondi\xF3 con status ${response.status}`);
  }
  return parseInterpretation((_a = response.json.response) != null ? _a : "");
}
function buildPrompt(text, language) {
  return `You are an expert in English linguistics, pragmatics, and cultural communication.

Analyze the following English text and return a JSON object with these four fields:
- "meaning": the actual meaning of the text (not a literal word-for-word translation, but what it really means in context). Write in ${language}.
- "tone": describe the emotional tone, register, and attitude (e.g. formal, sarcastic, enthusiastic, polite but firm). Write in ${language}.
- "context": any relevant cultural, idiomatic, or situational context the reader should know to fully understand the text. Write in ${language}.
- "intent": what the speaker/writer is trying to achieve with this text (inform, persuade, warn, joke, request, etc.). Write in ${language}.

Keep each field to 1\u20133 sentences maximum. Be specific, not generic.

TEXT:
"""
${text}
"""

Respond ONLY with valid JSON. No explanation outside the JSON. Example format:
{"meaning":"...","tone":"...","context":"...","intent":"..."}`;
}
function parseInterpretation(raw) {
  const fallback = { meaning: "\u2014", tone: "\u2014", context: "\u2014", intent: "\u2014" };
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      meaning: typeof parsed.meaning === "string" ? parsed.meaning : "\u2014",
      tone: typeof parsed.tone === "string" ? parsed.tone : "\u2014",
      context: typeof parsed.context === "string" ? parsed.context : "\u2014",
      intent: typeof parsed.intent === "string" ? parsed.intent : "\u2014"
    };
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match)
      return fallback;
    try {
      const parsed = JSON.parse(match[0]);
      return {
        meaning: typeof parsed.meaning === "string" ? parsed.meaning : "\u2014",
        tone: typeof parsed.tone === "string" ? parsed.tone : "\u2014",
        context: typeof parsed.context === "string" ? parsed.context : "\u2014",
        intent: typeof parsed.intent === "string" ? parsed.intent : "\u2014"
      };
    } catch (e2) {
      return fallback;
    }
  }
}
var InterpretationModal = class extends import_obsidian.Modal {
  constructor(app, selectedText, result) {
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
      text: this.selectedText.length > 120 ? this.selectedText.slice(0, 119) + "\u2026" : this.selectedText
    });
    const sections = [
      { label: "Meaning", key: "meaning" },
      { label: "Tone", key: "tone" },
      { label: "Context", key: "context" },
      { label: "Intent", key: "intent" }
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
};
var EnglishTextInterpreterPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.interpreting = false;
  }
  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "interpret-selection",
      name: "Interpret selected text",
      editorCallback: (editor, view) => {
        void this.interpretSelection(editor, view);
      }
    });
    this.addSettingTab(new EnglishTextInterpreterSettingTab(this.app, this));
  }
  async interpretSelection(editor, _view) {
    if (this.interpreting) {
      new import_obsidian.Notice("Already interpreting, please wait\u2026");
      return;
    }
    const selectedText = editor.getSelection();
    if (!selectedText || selectedText.trim().length < 5) {
      new import_obsidian.Notice("Select some text to interpret.");
      return;
    }
    this.interpreting = true;
    const notice = new import_obsidian.Notice("Interpreting with Ollama\u2026", 0);
    try {
      const result = await interpretWithOllama(selectedText, this.settings);
      new InterpretationModal(this.app, selectedText, result).open();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[EnglishTextInterpreter]", err);
      new import_obsidian.Notice(`\u26A0 ${msg}`);
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
};
var EnglishTextInterpreterSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Ollama endpoint").setDesc("URL where Ollama is running").addText(
      (text) => text.setPlaceholder("http://localhost:11434").setValue(this.plugin.settings.ollamaEndpoint).onChange(async (value) => {
        this.plugin.settings.ollamaEndpoint = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Model").setDesc("Ollama model to use (e.g. gemma3:4b, gemma3:12b)").addText(
      (text) => text.setPlaceholder("gemma3:4b").setValue(this.plugin.settings.ollamaModel).onChange(async (value) => {
        this.plugin.settings.ollamaModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Interpretation language").setDesc("Language for the interpretation output").addDropdown(
      (drop) => drop.addOption("Spanish", "Espa\xF1ol").addOption("English", "English").addOption("Portuguese", "Portugu\xEAs").addOption("French", "Fran\xE7ais").addOption("German", "Deutsch").setValue(this.plugin.settings.language).onChange(async (value) => {
        this.plugin.settings.language = value;
        await this.plugin.saveSettings();
      })
    );
  }
};
