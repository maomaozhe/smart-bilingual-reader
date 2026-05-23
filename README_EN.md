# Smart Bilingual Reader

A lightweight Chrome extension for reading foreign-language webpages.

[中文 README](README.md)

## Features

- Translate selected text in a compact floating card.
- Read the selected original text with the browser's built-in speech engine.
- Show a compact read button when hovering readable text blocks.
- Read the current page's main text from a small page-level button.
- Copy translations from the selection card.
- Optional auto-read when text is selected.
- One-click bilingual page mode that keeps the original text and inserts translations near it.
- Bilingual translations inherit the original page's font, size, line height, color, alignment, and layout width where possible.
- Full readable block translation for paragraphs with inline formatting such as bold text and links.
- Chinese and English options UI.
- Configurable interface language, target language, speech rate, translation provider, bilingual style, opacity, and page translation limits.

## Install Locally

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. If an older version is already loaded, reload the extension card and refresh the target page.

## Usage

- Select text on any page to open the translation card.
- Click the play button in the card to read the original text.
- Click **Copy** to copy the translation.
- Click the extension button once to translate the current page in place. Click it again to remove bilingual translations.
- Press `Alt+Shift+T` to toggle bilingual mode from the keyboard.
- Open the extension's **Options** page from Chrome's extension manager to change target language, auto speech, bilingual style, and translation settings.

## Options

- Interface language: Auto, Chinese, or English.
- Target language: Chinese, English, Japanese, Korean, French, German, Spanish, and more.
- Translation provider: Google public endpoint or a LibreTranslate-compatible endpoint.
- Bilingual style: match original style, soft background, or blue highlight.
- Translation opacity.
- Maximum text blocks per page.
- Minimum characters per text block.
- Speech behavior, rate, and pitch.
- TTS provider: browser speech or Xiaomi MiMo V2.5 TTS.
- MiMo model, API key, speech language, voice, speaking style instruction, and audio format.
- Chinese and English speech preview buttons in Options.

## Translation Providers

The default provider uses Google's public web translate endpoint and does not require an API key. It is convenient for personal testing, but availability depends on your network environment.

You can switch to a LibreTranslate-compatible endpoint in Options if you prefer to use your own translation service.

## MiMo TTS

The options page can switch speech to Xiaomi MiMo V2.5 TTS. The extension does not include or commit an API key; configure your own key locally.

The integration uses `POST https://api.xiaomimimo.com/v1/chat/completions`, supports `mimo-v2-tts` and `mimo-v2.5-tts`, then plays the returned audio in the page. The legacy `mimo-v2-tts` model supports `mimo_default`, `default_zh`, and `default_en` voices.

## Development

The extension does not require a build step.

```bash
npm run lint
npm run zip
```

- `npm run lint` checks manifest assets and JavaScript syntax.
- `npm run zip` creates `dist/smart-bilingual-reader.zip`.

## Notes

- Chrome internal pages, the Chrome Web Store, and some protected pages do not allow extension content scripts.
- Refresh already-open webpages after loading or updating the extension.
- Website structures vary a lot. If a page still has missing translations or alignment issues, add a compatibility strategy for that layout.
