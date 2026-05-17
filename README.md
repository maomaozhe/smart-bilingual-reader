# Smart Bilingual Reader

A lightweight Chrome extension for reading foreign-language webpages.

## Features

- Translate selected text in a floating popup.
- Speak selected text or translations with the browser's built-in speech engine.
- Optional auto-read when text is selected.
- One-click bilingual page mode that keeps the original text and inserts translations below it.
- Configurable target language, speech rate, and translation provider.

## Install Locally

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

## Usage

- Select text on any page to open the translation popup.
- Click the extension button once to translate the current page in place. Click it again to remove bilingual translations.
- Press `Alt+Shift+T` to toggle bilingual mode from the keyboard.
- Open the extension's **Options** page from Chrome's extension manager to change target language, auto speech, and translation settings.

## Translation Providers

The default provider uses Google's public web translate endpoint. You can switch to a LibreTranslate-compatible endpoint in Options if you prefer to use your own service.

## Development

```bash
npm run lint
npm run zip
```

The extension does not require a build step.
