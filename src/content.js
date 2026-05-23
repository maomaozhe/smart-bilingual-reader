const DEFAULT_SETTINGS = {
  targetLanguage: "zh-CN",
  autoSpeakSelection: false,
  speakTranslatedText: false,
  speechRate: 1,
  speechPitch: 1,
  uiLanguage: "auto",
  ttsProvider: "browser",
  mimoModel: "mimo-v2-tts",
  mimoApiKey: "",
  mimoSpeechLanguage: "auto",
  mimoVoice: "auto",
  mimoInstruction: "自然、清晰、适合阅读网页内容。",
  mimoAudioFormat: "wav",
  bilingualStyleMode: "match",
  bilingualOpacity: 0.82,
  bilingualMaxBlocks: 180,
  bilingualMinCharacters: 18
};

const I18N = {
  en: {
    translating: "Translating...",
    noTranslation: "No translation returned.",
    translationFailed: "Translation failed.",
    extensionRequestFailed: "Extension request failed",
    extensionContextInvalidated: "Extension was reloaded. Refresh this page and try again.",
    bilingualOff: "Bilingual page off",
    noReadableText: "No readable text found",
    reading: "Reading...",
    readBlock: "Read this block",
    readPage: "Read page",
    ttsFailed: "Speech synthesis failed.",
    translatingBlocks: (count) => `Translating ${count} text blocks...`,
    bilingualOn: (count) => `Bilingual page on: ${count} blocks translated`
  },
  "zh-CN": {
    translating: "翻译中...",
    noTranslation: "没有返回译文。",
    translationFailed: "翻译失败。",
    extensionRequestFailed: "扩展请求失败",
    extensionContextInvalidated: "扩展已重新加载，请刷新当前网页后再试。",
    bilingualOff: "已关闭双语网页",
    noReadableText: "没有找到可翻译文本",
    reading: "朗读中...",
    readBlock: "朗读这一段",
    readPage: "朗读全文",
    ttsFailed: "语音合成失败。",
    translatingBlocks: (count) => `正在翻译 ${count} 个文本块...`,
    bilingualOn: (count) => `已开启双语网页：翻译 ${count} 个文本块`
  }
};

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
  "CODE",
  "PRE",
  "SVG",
  "CANVAS"
]);

const READABLE_BLOCK_SELECTOR = [
  "article h1",
  "article h2",
  "article h3",
  "article h4",
  "article h5",
  "article h6",
  "article p",
  "article li",
  "article blockquote",
  "main h1",
  "main h2",
  "main h3",
  "main h4",
  "main h5",
  "main h6",
  "main p",
  "main li",
  "main blockquote",
  "section h1",
  "section h2",
  "section h3",
  "section h4",
  "section h5",
  "section h6",
  "section p",
  "section li",
  "section blockquote",
  "p",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6"
].join(",");

let settings = { ...DEFAULT_SETTINGS };
let selectionCard;
let lastSelectionText = "";
let bilingualEnabled = false;
let bilingualBusy = false;
let hoverSpeakButton;
let pageSpeakButton;
let hoverBlock;
let currentAudio;
const speechCache = new Map();

init();

async function init() {
  settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") {
      return;
    }

    for (const [key, change] of Object.entries(changes)) {
      settings[key] = change.newValue;
    }

    refreshSelectionCardStatus();
  });

  document.addEventListener("mouseup", handleSelection, true);
  document.addEventListener("keyup", handleSelectionKeyup, true);
  document.addEventListener("scroll", hideSelectionCard, true);
  document.addEventListener("mousedown", handleDocumentMouseDown, true);
  document.addEventListener("mouseover", handleReadableBlockHover, true);
  document.addEventListener("scroll", repositionHoverSpeakButton, true);
  window.addEventListener("resize", repositionHoverSpeakButton);
  createPageSpeakButton();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "toggleBilingualPage") {
    toggleBilingualPage()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "speakSelection") {
    const text = getSelectedText() || lastSelectionText;
    void speak(text);
    sendResponse({ ok: true });
  }

  return false;
});

function handleSelectionKeyup(event) {
  if (event.key === "Shift" || event.key.startsWith("Arrow")) {
    handleSelection();
  }
}

async function handleSelection() {
  const text = getSelectedText();
  if (!isMeaningfulSelection(text)) {
    hideSelectionCard();
    return;
  }

  lastSelectionText = text;
  showSelectionCard(text, t("translating"));

  if (settings.autoSpeakSelection) {
    void speak(text);
  }

  try {
    const result = await translate(text);
    showSelectionCard(text, result.translated || t("noTranslation"));

    if (settings.speakTranslatedText && result.translated) {
      void speak(result.translated);
    }
  } catch (error) {
    showSelectionCard(text, error.message || t("translationFailed"));
  }
}

function handleDocumentMouseDown(event) {
  if (selectionCard?.contains(event.target)) {
    return;
  }

  hideSelectionCard();
}

function showSelectionCard(original, translated) {
  const range = getSelectionRange();
  if (!range) {
    return;
  }

  selectionCard ||= createSelectionCard();
  selectionCard.querySelector(".sbr-selection-original").textContent = original;
  selectionCard.querySelector(".sbr-selection-translated").textContent = translated;
  selectionCard.hidden = false;

  const rect = range.getBoundingClientRect();
  const cardRect = selectionCard.getBoundingClientRect();
  const top = clamp(rect.bottom + 10, 12, window.innerHeight - cardRect.height - 12);
  const left = clamp(rect.left, 12, window.innerWidth - cardRect.width - 12);

  selectionCard.style.top = `${top}px`;
  selectionCard.style.left = `${left}px`;
}

function createSelectionCard() {
  const card = document.createElement("div");
  card.className = "sbr-selection-card";
  card.hidden = true;
  card.innerHTML = `
    <div class="sbr-selection-original-row">
      <span class="sbr-selection-original"></span>
      <button class="sbr-speak-button" data-action="speak-original" title="朗读原文" aria-label="朗读原文">▶</button>
    </div>
    <div class="sbr-selection-translated"></div>
    <div class="sbr-selection-status"></div>
  `;
  refreshSelectionCardStatus(card);

  card.addEventListener("mousedown", (event) => event.stopPropagation());
  card.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='speak-original']");
    if (!button) {
      return;
    }

    void speak(card.querySelector(".sbr-selection-original").textContent);
  });

  document.documentElement.append(card);
  return card;
}

function refreshSelectionCardStatus(card = selectionCard) {
  card?.querySelector(".sbr-selection-status")?.replaceChildren(document.createTextNode(settings.targetLanguage));
}

function hideSelectionCard() {
  if (selectionCard) {
    selectionCard.hidden = true;
  }
}

function createPageSpeakButton() {
  pageSpeakButton = document.createElement("button");
  pageSpeakButton.className = "sbr-page-speak-button";
  pageSpeakButton.type = "button";
  pageSpeakButton.textContent = "▶";
  pageSpeakButton.title = t("readPage");
  pageSpeakButton.setAttribute("aria-label", t("readPage"));
  pageSpeakButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void speakPage();
  });
  document.documentElement.append(pageSpeakButton);
}

function handleReadableBlockHover(event) {
  if (event.target.closest(".sbr-selection-card, .sbr-page-toast, .sbr-hover-speak-button, .sbr-page-speak-button")) {
    return;
  }

  const block = event.target.closest(READABLE_BLOCK_SELECTOR);
  if (!block || !isReadableBlock(block)) {
    return;
  }

  hoverBlock = block;
  showHoverSpeakButton(block);
}

function showHoverSpeakButton(block) {
  hoverSpeakButton ||= createHoverSpeakButton();
  hoverSpeakButton.hidden = false;
  hoverSpeakButton.title = t("readBlock");
  hoverSpeakButton.setAttribute("aria-label", t("readBlock"));
  repositionHoverSpeakButton(block);
}

function createHoverSpeakButton() {
  const button = document.createElement("button");
  button.className = "sbr-hover-speak-button";
  button.type = "button";
  button.textContent = "▶";
  button.hidden = true;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (hoverBlock) {
      void speak(getElementText(hoverBlock));
    }
  });
  document.documentElement.append(button);
  return button;
}

function repositionHoverSpeakButton(block = hoverBlock) {
  if (!hoverSpeakButton || hoverSpeakButton.hidden || !block) {
    return;
  }

  const rect = block.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    hoverSpeakButton.hidden = true;
    return;
  }

  const top = clamp(rect.top + 2, 8, window.innerHeight - 34);
  const left = clamp(rect.left - 32, 8, window.innerWidth - 34);
  hoverSpeakButton.style.top = `${top}px`;
  hoverSpeakButton.style.left = `${left}px`;
}

async function speakPage() {
  const text = collectReadableBlocks()
    .map((block) => block.text)
    .join("\n\n")
    .slice(0, 4000);
  await speak(text);
}

async function toggleBilingualPage() {
  if (bilingualBusy) {
    return { enabled: bilingualEnabled, busy: true };
  }

  if (bilingualEnabled) {
    removeBilingualTranslations();
    bilingualEnabled = false;
    toast(t("bilingualOff"));
    return { enabled: false };
  }

  bilingualBusy = true;
  try {
    const blocks = collectReadableBlocks().slice(0, getBilingualMaxBlocks());
    if (!blocks.length) {
      toast(t("noReadableText"));
      return { enabled: false, translated: 0 };
    }

    toast(t("translatingBlocks", blocks.length));
    let translated = 0;
    for (const group of chunk(blocks, 8)) {
      const results = await translateBatch(group.map((block) => block.text));
      for (let index = 0; index < group.length; index += 1) {
        if (insertBlockTranslation(group[index], results[index]?.translated)) {
          translated += 1;
        }
      }
    }

    bilingualEnabled = true;
    toast(t("bilingualOn", translated));
    return { enabled: true, translated };
  } finally {
    bilingualBusy = false;
  }
}

function collectReadableBlocks() {
  const blocks = [];
  const seen = new Set();

  for (const element of document.querySelectorAll(READABLE_BLOCK_SELECTOR)) {
    if (seen.has(element) || !isReadableBlock(element)) {
      continue;
    }

    seen.add(element);
    blocks.push({
      element,
      text: getElementText(element)
    });
  }

  if (blocks.length) {
    return blocks;
  }

  return collectTextNodes().map((node) => ({
    element: getTranslationAnchor(node, node.parentElement),
    text: normalizeReadableText(node.nodeValue)
  }));
}

function collectTextNodes() {
  const nodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!isReadableTextNode(node)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  return nodes;
}

function isReadableBlock(element) {
  if (!element || SKIP_TAGS.has(element.tagName)) {
    return false;
  }

  if (element.closest(".sbr-selection-card, .sbr-bilingual-translation, .sbr-page-toast")) {
    return false;
  }

  if (element.querySelector(".sbr-bilingual-translation")) {
    return false;
  }

  const text = getElementText(element);
  if (text.length < getBilingualMinCharacters() || text.length > 1200) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 20 && rect.height > 8;
}

function isReadableTextNode(node) {
  const text = normalizeReadableText(node.nodeValue);
  if (text.length < getBilingualMinCharacters() || text.length > 500) {
    return false;
  }

  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName)) {
    return false;
  }

  if (parent.closest(".sbr-selection-card, .sbr-bilingual-translation, .sbr-page-toast")) {
    return false;
  }

  const style = window.getComputedStyle(parent);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false;
  }

  const rect = parent.getBoundingClientRect();
  return rect.width > 20 && rect.height > 8;
}

function insertBlockTranslation(block, translated) {
  const clean = String(translated || "").trim();
  if (!clean || clean === block.text) {
    return false;
  }

  const anchor = block.element;
  if (!anchor || getNextElement(anchor)?.classList.contains("sbr-bilingual-translation")) {
    return false;
  }

  const translation = document.createElement("div");
  translation.className = "sbr-bilingual-translation";
  translation.textContent = clean;
  applyMatchedTranslationStyle(translation, anchor);
  insertAfter(anchor, translation);
  return true;
}

function insertTranslation(textNode, translated) {
  const clean = String(translated || "").trim();
  if (!clean || clean === textNode.nodeValue.trim()) {
    return false;
  }

  const parent = textNode.parentElement;
  if (!parent || hasNearbyTranslation(textNode, parent)) {
    return false;
  }

  const anchor = getTranslationAnchor(textNode, parent);
  const translation = document.createElement(shouldUseBlockTranslation(anchor) ? "div" : "span");
  translation.className = "sbr-bilingual-translation";
  translation.textContent = clean;
  applyMatchedTranslationStyle(translation, anchor);
  insertAfter(anchor, translation);
  return true;
}

function removeBilingualTranslations() {
  document.querySelectorAll(".sbr-bilingual-translation").forEach((node) => node.remove());
}

function translate(text) {
  return sendRuntimeMessage({ type: "translate", text });
}

function translateBatch(texts) {
  return sendRuntimeMessage({ type: "translateBatch", texts });
}

async function sendRuntimeMessage(message) {
  let response;
  try {
    response = await chrome.runtime.sendMessage(message);
  } catch (error) {
    if (String(error?.message || error).includes("Extension context invalidated")) {
      throw new Error(t("extensionContextInvalidated"));
    }
    throw error;
  }
  if (!response?.ok) {
    throw new Error(response?.error || t("extensionRequestFailed"));
  }
  return response.result;
}

function resolveUiLanguage(language = settings.uiLanguage) {
  if (language === "en" || language === "zh-CN") {
    return language;
  }

  if (settings.targetLanguage?.startsWith("zh")) {
    return "zh-CN";
  }

  return navigator.language?.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function t(key, ...args) {
  const dict = I18N[resolveUiLanguage()] || I18N.en;
  const value = dict[key] || I18N.en[key] || key;
  return typeof value === "function" ? value(...args) : value;
}

function speakWithBrowser(text) {
  const clean = String(text || "").trim();
  if (!clean) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = Number(settings.speechRate) || 1;
  utterance.pitch = Number(settings.speechPitch) || 1;
  utterance.lang = /[\u4e00-\u9fff]/.test(clean) ? "zh-CN" : "en-US";
  window.speechSynthesis.speak(utterance);
}

async function speak(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) {
    return;
  }

  stopSpeech();
  if (settings.ttsProvider !== "mimo") {
    speakWithBrowser(clean);
    return;
  }

  try {
    toast(t("reading"));
    const result = await synthesizeSpeech(clean);
    if (result.provider !== "mimo") {
      speakWithBrowser(clean);
      return;
    }

    const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
    currentAudio = audio;
    await audio.play();
  } catch (error) {
    toast(error.message || t("ttsFailed"));
    speakWithBrowser(clean);
  }
}

function stopSpeech() {
  currentAudio?.pause();
  currentAudio = null;
  window.speechSynthesis.cancel();
}

function synthesizeSpeech(text) {
  const key = `${settings.ttsProvider}:${settings.mimoModel}:${settings.mimoSpeechLanguage}:${settings.mimoVoice}:${settings.mimoInstruction}:${text}`;
  if (speechCache.has(key)) {
    return speechCache.get(key);
  }

  const request = sendRuntimeMessage({ type: "synthesizeSpeech", text });
  speechCache.set(key, request);
  if (speechCache.size > 30) {
    speechCache.delete(speechCache.keys().next().value);
  }
  return request;
}

function getSelectedText() {
  return String(window.getSelection()?.toString() || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

function getSelectionRange() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  return selection.getRangeAt(0);
}

function isMeaningfulSelection(text) {
  return text && text.length >= 2 && /[\p{L}\p{N}]/u.test(text);
}

function toast(message) {
  const oldToast = document.querySelector(".sbr-page-toast");
  oldToast?.remove();

  const node = document.createElement("div");
  node.className = "sbr-page-toast";
  node.textContent = message;
  document.documentElement.append(node);
  setTimeout(() => node.remove(), 2600);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function hasNearbyTranslation(textNode, parent) {
  const anchor = getTranslationAnchor(textNode, parent);
  return getNextElement(anchor)?.classList.contains("sbr-bilingual-translation");
}

function getTranslationAnchor(textNode, parent) {
  if (parent.matches("li, dt, dd, figcaption, blockquote") && isInlineElement(parent)) {
    return textNode;
  }

  if (isInlineElement(parent)) {
    const inlineGroup = parent.closest("p, li, h1, h2, h3, h4, h5, h6, article, section, div");
    return inlineGroup && inlineGroup !== document.body ? inlineGroup : parent;
  }

  return parent;
}

function shouldUseBlockTranslation(parent) {
  return !isInlineElement(parent);
}

function isInlineElement(element) {
  const display = window.getComputedStyle(element).display;
  return display.includes("inline");
}

function applyMatchedTranslationStyle(translation, source) {
  const style = window.getComputedStyle(source);
  const textProperties = [
    "fontFamily",
    "fontSize",
    "fontStyle",
    "fontWeight",
    "fontStretch",
    "fontVariant",
    "letterSpacing",
    "lineHeight",
    "textAlign",
    "textDecoration",
    "textIndent",
    "textTransform",
    "wordSpacing",
    "writingMode"
  ];

  for (const property of textProperties) {
    translation.style[property] = style[property];
  }

  if (shouldUseBlockTranslation(source)) {
    applyMatchedLayoutStyle(translation, source, style);
  }

  translation.style.color = settings.bilingualStyleMode === "highlight" ? "#2367c8" : style.color;
  translation.style.opacity = String(getBilingualOpacity());
  translation.style.background = settings.bilingualStyleMode === "subtle" ? "rgba(35, 103, 200, 0.08)" : "transparent";
  translation.style.borderRadius = settings.bilingualStyleMode === "subtle" ? "4px" : "0";
  translation.style.padding = settings.bilingualStyleMode === "subtle" ? "0.08em 0.18em" : "0";
  if (shouldUseBlockTranslation(source)) {
    translation.style.marginTop = "0.16em";
    translation.style.marginBottom = "0.42em";
  } else {
    translation.style.margin = "0 0 0 0.32em";
  }
}

function applyMatchedLayoutStyle(translation, source, style) {
  const rect = source.getBoundingClientRect();
  const layoutProperties = [
    "boxSizing",
    "display",
    "width",
    "maxWidth",
    "minWidth",
    "marginLeft",
    "marginRight",
    "paddingLeft",
    "paddingRight"
  ];

  for (const property of layoutProperties) {
    translation.style[property] = style[property];
  }

  translation.style.display = style.display === "list-item" ? "block" : style.display;
  if (rect.width > 0 && style.width === "auto") {
    translation.style.width = `${rect.width}px`;
  }
}

function getBilingualOpacity() {
  return clamp(Number(settings.bilingualOpacity) || 0.82, 0.45, 1);
}

function getBilingualMaxBlocks() {
  return Math.max(10, Math.min(Number(settings.bilingualMaxBlocks) || 180, 500));
}

function getBilingualMinCharacters() {
  return Math.max(2, Math.min(Number(settings.bilingualMinCharacters) || 18, 120));
}

function getElementText(element) {
  return normalizeReadableText(element.innerText || element.textContent);
}

function normalizeReadableText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function insertAfter(anchor, node) {
  anchor.parentNode.insertBefore(node, anchor.nextSibling);
}

function getNextElement(anchor) {
  let sibling = anchor.nextSibling;
  while (sibling && sibling.nodeType !== Node.ELEMENT_NODE) {
    sibling = sibling.nextSibling;
  }
  return sibling;
}
