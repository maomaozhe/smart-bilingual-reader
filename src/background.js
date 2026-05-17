const DEFAULT_SETTINGS = {
  provider: "google",
  targetLanguage: "zh-CN",
  libreTranslateUrl: "",
  libreTranslateApiKey: "",
  autoSpeakSelection: false,
  speakTranslatedText: false,
  speechRate: 1,
  speechPitch: 1,
  uiLanguage: "auto",
  bilingualStyleMode: "match",
  bilingualOpacity: 0.82,
  bilingualMaxBlocks: 180,
  bilingualMinCharacters: 18
};

const cache = new Map();
const CACHE_LIMIT = 500;

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...current });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.id) {
    await toggleBilingualPage(tab.id);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-bilingual-page") {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await toggleBilingualPage(tab.id);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "translate") {
    translateText(message.text, message.options)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "translateBatch") {
    translateBatch(message.texts, message.options)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function toggleBilingualPage(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "toggleBilingualPage" });
  } catch (error) {
    console.warn("Unable to toggle bilingual page", error);
  }
}

async function translateBatch(texts, options = {}) {
  if (!Array.isArray(texts)) {
    throw new Error("texts must be an array");
  }

  const results = [];
  for (const text of texts) {
    results.push(await translateText(text, options));
    await delay(80);
  }
  return results;
}

async function translateText(text, options = {}) {
  const normalizedText = normalizeInput(text);
  if (!normalizedText) {
    return { original: "", translated: "" };
  }

  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const merged = { ...settings, ...options };
  const cacheKey = `${merged.provider}:${merged.targetLanguage}:${normalizedText}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const translated =
    merged.provider === "libretranslate"
      ? await translateWithLibreTranslate(normalizedText, merged)
      : await translateWithGoogleWeb(normalizedText, merged);

  const result = {
    original: normalizedText,
    translated: cleanTranslation(translated)
  };

  remember(cacheKey, result);
  return result;
}

async function translateWithGoogleWeb(text, settings) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", settings.targetLanguage);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Translation failed: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data?.[0])
    ? data[0].map((part) => part?.[0] || "").join("")
    : "";
}

async function translateWithLibreTranslate(text, settings) {
  const baseUrl = settings.libreTranslateUrl?.trim();
  if (!baseUrl) {
    throw new Error("LibreTranslate URL is not configured");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: "auto",
      target: settings.targetLanguage,
      format: "text",
      api_key: settings.libreTranslateApiKey || undefined
    })
  });

  if (!response.ok) {
    throw new Error(`Translation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.translatedText || "";
}

function normalizeInput(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function cleanTranslation(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function remember(key, value) {
  cache.set(key, value);
  if (cache.size <= CACHE_LIMIT) {
    return;
  }

  const firstKey = cache.keys().next().value;
  cache.delete(firstKey);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
