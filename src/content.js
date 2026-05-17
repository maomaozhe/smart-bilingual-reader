const DEFAULT_SETTINGS = {
  targetLanguage: "zh-CN",
  autoSpeakSelection: false,
  speakTranslatedText: false,
  speechRate: 1,
  speechPitch: 1
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

let settings = { ...DEFAULT_SETTINGS };
let selectionCard;
let lastSelectionText = "";
let bilingualEnabled = false;
let bilingualBusy = false;

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
  });

  document.addEventListener("mouseup", handleSelection, true);
  document.addEventListener("keyup", handleSelectionKeyup, true);
  document.addEventListener("scroll", hideSelectionCard, true);
  document.addEventListener("mousedown", handleDocumentMouseDown, true);
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
    speak(text);
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
  showSelectionCard(text, "Translating...");

  if (settings.autoSpeakSelection) {
    speak(text);
  }

  try {
    const result = await translate(text);
    showSelectionCard(text, result.translated || "No translation returned.");

    if (settings.speakTranslatedText && result.translated) {
      speak(result.translated);
    }
  } catch (error) {
    showSelectionCard(text, error.message || "Translation failed.");
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
    <div class="sbr-selection-original"></div>
    <div class="sbr-selection-translated"></div>
    <div class="sbr-selection-actions">
      <button class="sbr-selection-button" data-action="speak-original" title="Read selected text" aria-label="Read selected text">▶</button>
      <button class="sbr-selection-button" data-action="speak-translation" title="Read translation" aria-label="Read translation">译▶</button>
      <button class="sbr-selection-button" data-action="copy" title="Copy translation" aria-label="Copy translation">Copy</button>
      <span class="sbr-selection-status">${settings.targetLanguage}</span>
    </div>
  `;

  card.addEventListener("mousedown", (event) => event.stopPropagation());
  card.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const translated = card.querySelector(".sbr-selection-translated").textContent;
    if (action === "speak-original") {
      speak(card.querySelector(".sbr-selection-original").textContent);
    } else if (action === "speak-translation") {
      speak(translated);
    } else if (action === "copy") {
      await navigator.clipboard.writeText(translated);
      card.querySelector(".sbr-selection-status").textContent = "Copied";
      setTimeout(() => {
        if (selectionCard === card) {
          card.querySelector(".sbr-selection-status").textContent = settings.targetLanguage;
        }
      }, 1200);
    }
  });

  document.documentElement.append(card);
  return card;
}

function hideSelectionCard() {
  if (selectionCard) {
    selectionCard.hidden = true;
  }
}

async function toggleBilingualPage() {
  if (bilingualBusy) {
    return { enabled: bilingualEnabled, busy: true };
  }

  if (bilingualEnabled) {
    removeBilingualTranslations();
    bilingualEnabled = false;
    toast("Bilingual page off");
    return { enabled: false };
  }

  bilingualBusy = true;
  try {
    const nodes = collectTextNodes().slice(0, 180);
    if (!nodes.length) {
      toast("No readable text found");
      return { enabled: false, translated: 0 };
    }

    toast(`Translating ${nodes.length} text blocks...`);
    let translated = 0;
    for (const group of chunk(nodes, 8)) {
      const results = await translateBatch(group.map((node) => node.nodeValue));
      for (let index = 0; index < group.length; index += 1) {
        if (insertTranslation(group[index], results[index]?.translated)) {
          translated += 1;
        }
      }
    }

    bilingualEnabled = true;
    toast(`Bilingual page on: ${translated} blocks translated`);
    return { enabled: true, translated };
  } finally {
    bilingualBusy = false;
  }
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

function isReadableTextNode(node) {
  const text = node.nodeValue.replace(/\s+/g, " ").trim();
  if (text.length < 18 || text.length > 500) {
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

function insertTranslation(textNode, translated) {
  const clean = String(translated || "").trim();
  if (!clean || clean === textNode.nodeValue.trim()) {
    return false;
  }

  const parent = textNode.parentElement;
  if (!parent || parent.nextElementSibling?.classList.contains("sbr-bilingual-translation")) {
    return false;
  }

  const translation = document.createElement("span");
  translation.className = "sbr-bilingual-translation";
  translation.textContent = clean;
  parent.insertAdjacentElement("afterend", translation);
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
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) {
    throw new Error(response?.error || "Extension request failed");
  }
  return response.result;
}

function speak(text) {
  const clean = String(text || "").trim();
  if (!clean) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = Number(settings.speechRate) || 1;
  utterance.pitch = Number(settings.speechPitch) || 1;
  window.speechSynthesis.speak(utterance);
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
