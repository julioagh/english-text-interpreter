# English Text Interpreter

Obsidian plugin for contextual interpretation of selected English text, powered by a local LLM via [Ollama](https://ollama.com). No data leaves your machine.

## What it does

Select any English text in your notes and run **Interpret selected text** from the Command Palette. A panel opens with four dimensions:

| Field | Description |
|---|---|
| **Meaning** | What the text actually means in context — not a literal translation |
| **Tone** | Emotional register and attitude (formal, sarcastic, polite but firm, etc.) |
| **Context** | Cultural, idiomatic, or situational background needed to fully understand it |
| **Intent** | What the writer is trying to achieve (inform, warn, persuade, joke, etc.) |

Output language is configurable (Spanish, English, Portuguese, French, German).

## Requirements

- [Ollama](https://ollama.com) running locally
- A pulled model (default: `gemma3:4b`)

```bash
ollama pull gemma3:4b
```

## Installation

### From Obsidian Community Plugins (recommended)

1. Open **Settings → Community plugins → Browse**
2. Search for **English Text Interpreter**
3. Install and enable

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/julioagh/english-text-interpreter/releases/latest)
2. Copy them to `.obsidian/plugins/english-text-interpreter/` inside your vault
3. Enable the plugin in **Settings → Community plugins**

## Settings

| Setting | Default | Description |
|---|---|---|
| Ollama endpoint | `http://localhost:11434` | URL where Ollama is running |
| Model | `gemma3:4b` | Any model pulled in Ollama (e.g. `gemma3:12b`, `llama3.2`) |
| Interpretation language | Spanish | Language for the interpretation output |

## Usage

1. Select English text in any note (at least 5 characters)
2. Open the Command Palette (`Ctrl/Cmd + P`)
3. Run **English Text Interpreter: Interpret selected text**
4. Read the interpretation panel

## License

[MIT](LICENSE)
