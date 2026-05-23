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
  ttsProvider: "browser",
  mimoApiKey: "",
  mimoVoice: "mimo_default",
  mimoInstruction: "自然、清晰、适合阅读网页内容。",
  mimoAudioFormat: "wav",
  bilingualStyleMode: "match",
  bilingualOpacity: 0.82,
  bilingualMaxBlocks: 180,
  bilingualMinCharacters: 18
};

const I18N = {
  en: {
    appName: "Smart Bilingual Reader",
    subtitle: "Configure translation, bilingual page rendering, and reading behavior.",
    restoreDefaults: "Restore defaults",
    translation: "Translation",
    uiLanguage: "Interface language",
    langAuto: "Auto",
    langZh: "中文",
    langEn: "English",
    targetLanguage: "Target language",
    targetZhCn: "Chinese Simplified",
    targetZhTw: "Chinese Traditional",
    targetEn: "English",
    targetJa: "Japanese",
    targetKo: "Korean",
    targetFr: "French",
    targetDe: "German",
    targetEs: "Spanish",
    targetRu: "Russian",
    targetIt: "Italian",
    provider: "Provider",
    providerGoogle: "Google public endpoint",
    providerLibre: "LibreTranslate compatible endpoint",
    libreUrl: "LibreTranslate URL",
    libreApiKey: "LibreTranslate API key",
    testText: "Test text",
    testTranslation: "Test translation",
    bilingualPage: "Bilingual Page",
    translationStyle: "Translation style",
    styleMatch: "Match original style",
    styleSubtle: "Matched style with soft background",
    styleHighlight: "Matched style with blue text",
    translationOpacity: "Translation opacity",
    maxBlocks: "Maximum text blocks",
    minCharacters: "Minimum characters per block",
    speech: "Speech",
    ttsProvider: "TTS provider",
    ttsBrowser: "Browser built-in speech",
    ttsMimo: "Xiaomi MiMo V2.5 TTS",
    mimoApiKey: "MiMo API Key",
    mimoVoice: "MiMo voice",
    mimoInstruction: "MiMo speaking style",
    mimoAudioFormat: "MiMo audio format",
    testSpeech: "Test speech",
    autoSpeakSelection: "Read selected text automatically",
    speakTranslatedText: "Read translation automatically after selection",
    speechRate: "Speech rate",
    speechPitch: "Speech pitch",
    save: "Save",
    saved: "Saved",
    defaultsRestored: "Defaults restored",
    translating: "Translating...",
    noTranslation: "No translation returned.",
    translationFailed: "Translation failed"
  },
  "zh-CN": {
    appName: "Smart Bilingual Reader",
    subtitle: "配置翻译、双语网页渲染和朗读行为。",
    restoreDefaults: "恢复默认",
    translation: "翻译",
    uiLanguage: "界面语言",
    langAuto: "自动",
    langZh: "中文",
    langEn: "English",
    targetLanguage: "目标语言",
    targetZhCn: "简体中文",
    targetZhTw: "繁体中文",
    targetEn: "英语",
    targetJa: "日语",
    targetKo: "韩语",
    targetFr: "法语",
    targetDe: "德语",
    targetEs: "西班牙语",
    targetRu: "俄语",
    targetIt: "意大利语",
    provider: "翻译服务",
    providerGoogle: "Google 公共接口",
    providerLibre: "LibreTranslate 兼容接口",
    libreUrl: "LibreTranslate 地址",
    libreApiKey: "LibreTranslate API Key",
    testText: "测试文本",
    testTranslation: "测试翻译",
    bilingualPage: "双语网页",
    translationStyle: "译文样式",
    styleMatch: "匹配原文样式",
    styleSubtle: "匹配样式并添加浅色背景",
    styleHighlight: "匹配样式并使用蓝色文字",
    translationOpacity: "译文透明度",
    maxBlocks: "单页最大翻译块数",
    minCharacters: "每块最少字符数",
    speech: "朗读",
    ttsProvider: "朗读服务",
    ttsBrowser: "浏览器内置朗读",
    ttsMimo: "小米 MiMo V2.5 TTS",
    mimoApiKey: "MiMo API Key",
    mimoVoice: "MiMo 音色",
    mimoInstruction: "MiMo 朗读风格",
    mimoAudioFormat: "MiMo 音频格式",
    testSpeech: "测试朗读",
    autoSpeakSelection: "划词后自动朗读原文",
    speakTranslatedText: "划词翻译后自动朗读译文",
    speechRate: "朗读速度",
    speechPitch: "朗读音调",
    save: "保存",
    saved: "已保存",
    defaultsRestored: "已恢复默认",
    translating: "翻译中...",
    noTranslation: "没有返回译文。",
    translationFailed: "翻译失败"
  }
};

const fields = Object.fromEntries(
  Object.keys(DEFAULT_SETTINGS).map((key) => [key, document.getElementById(key)])
);
const saveButton = document.getElementById("save");
const resetButton = document.getElementById("reset");
const testButton = document.getElementById("testTranslate");
const testSpeechButton = document.getElementById("testSpeech");
const statusNode = document.getElementById("status");
const testText = document.getElementById("testText");
const testResult = document.getElementById("testResult");

loadSettings();
saveButton.addEventListener("click", saveSettings);
resetButton.addEventListener("click", resetSettings);
testButton.addEventListener("click", testTranslation);
testSpeechButton.addEventListener("click", testSpeech);
fields.uiLanguage.addEventListener("change", async () => {
  const language = fields.uiLanguage.value;
  localize(resolveUiLanguage(language));
  await chrome.storage.sync.set({ uiLanguage: language });
});
fields.targetLanguage.addEventListener("change", () => {
  if (fields.uiLanguage.value === "auto") {
    localize(resolveUiLanguage("auto"));
  }
});

for (const field of Object.values(fields)) {
  if (field?.type === "range") {
    field.addEventListener("input", () => {
      updateRangeLabels();
      void saveField(field);
    });
  } else if (field) {
    field.addEventListener("change", () => {
      void saveField(field);
    });
  }
}

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  for (const [key, field] of Object.entries(fields)) {
    if (!field) {
      continue;
    }

    if (field.type === "checkbox") {
      field.checked = Boolean(settings[key]);
    } else {
      field.value = settings[key];
    }
  }
  localize(resolveUiLanguage(settings.uiLanguage));
  updateRangeLabels();
}

async function saveSettings() {
  const settings = {};
  for (const [key, field] of Object.entries(fields)) {
    if (!field) {
      continue;
    }

    if (field.type === "checkbox") {
      settings[key] = field.checked;
    } else if (field.type === "range" || field.type === "number") {
      settings[key] = Number(field.value);
    } else {
      settings[key] = field.value.trim();
    }
  }

  await chrome.storage.sync.set(settings);
  statusNode.textContent = t("saved");
  setTimeout(() => {
    statusNode.textContent = "";
  }, 1500);
}

async function saveField(field) {
  const entry = Object.entries(fields).find(([, current]) => current === field);
  if (!entry) {
    return;
  }

  const [key] = entry;
  let value;
  if (field.type === "checkbox") {
    value = field.checked;
  } else if (field.type === "range" || field.type === "number") {
    value = Number(field.value);
  } else {
    value = field.value.trim();
  }

  await chrome.storage.sync.set({ [key]: value });
}

async function resetSettings() {
  await chrome.storage.sync.set(DEFAULT_SETTINGS);
  await loadSettings();
  statusNode.textContent = t("defaultsRestored");
  setTimeout(() => {
    statusNode.textContent = "";
  }, 1500);
}

async function testTranslation() {
  testResult.textContent = t("translating");
  try {
    await saveSettings();
    const response = await chrome.runtime.sendMessage({
      type: "translate",
      text: testText.value
    });

    if (!response?.ok) {
      throw new Error(response?.error || t("translationFailed"));
    }

    testResult.textContent = response.result.translated || t("noTranslation");
  } catch (error) {
    testResult.textContent = error.message;
  }
}

async function testSpeech() {
  testResult.textContent = t("translating");
  try {
    await saveSettings();
    const response = await chrome.runtime.sendMessage({
      type: "synthesizeSpeech",
      text: testText.value
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Speech synthesis failed");
    }

    if (response.result.provider !== "mimo") {
      const utterance = new SpeechSynthesisUtterance(testText.value);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else {
      const audio = new Audio(`data:${response.result.mimeType};base64,${response.result.audioBase64}`);
      await audio.play();
    }

    testResult.textContent = t("saved");
  } catch (error) {
    testResult.textContent = error.message;
  }
}

function updateRangeLabels() {
  for (const label of document.querySelectorAll("[data-value-for]")) {
    const field = fields[label.dataset.valueFor];
    label.textContent = field ? `(${field.value})` : "";
  }
}

function localize(language) {
  document.documentElement.lang = language === "zh-CN" ? "zh-CN" : "en";
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = I18N[language][node.dataset.i18n] || I18N.en[node.dataset.i18n] || node.textContent;
  }
}

function resolveUiLanguage(language) {
  if (language === "en" || language === "zh-CN") {
    return language;
  }

  if (fields.targetLanguage?.value?.startsWith("zh")) {
    return "zh-CN";
  }

  return navigator.language?.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function t(key) {
  return I18N[resolveUiLanguage(fields.uiLanguage.value)][key] || I18N.en[key] || key;
}
