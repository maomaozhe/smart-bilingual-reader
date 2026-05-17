const DEFAULT_SETTINGS = {
  provider: "google",
  targetLanguage: "zh-CN",
  libreTranslateUrl: "",
  libreTranslateApiKey: "",
  autoSpeakSelection: false,
  speakTranslatedText: false,
  speechRate: 1,
  speechPitch: 1,
  bilingualStyleMode: "match",
  bilingualOpacity: 0.82,
  bilingualMaxBlocks: 180,
  bilingualMinCharacters: 18
};

const fields = Object.fromEntries(
  Object.keys(DEFAULT_SETTINGS).map((key) => [key, document.getElementById(key)])
);
const saveButton = document.getElementById("save");
const resetButton = document.getElementById("reset");
const testButton = document.getElementById("testTranslate");
const statusNode = document.getElementById("status");
const testText = document.getElementById("testText");
const testResult = document.getElementById("testResult");

loadSettings();
saveButton.addEventListener("click", saveSettings);
resetButton.addEventListener("click", resetSettings);
testButton.addEventListener("click", testTranslation);

for (const field of Object.values(fields)) {
  if (field?.type === "range") {
    field.addEventListener("input", updateRangeLabels);
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
    } else if (field.type === "range") {
      settings[key] = Number(field.value);
    } else {
      settings[key] = field.value.trim();
    }
  }

  await chrome.storage.sync.set(settings);
  statusNode.textContent = "Saved";
  setTimeout(() => {
    statusNode.textContent = "";
  }, 1500);
}

async function resetSettings() {
  await chrome.storage.sync.set(DEFAULT_SETTINGS);
  await loadSettings();
  statusNode.textContent = "Defaults restored";
  setTimeout(() => {
    statusNode.textContent = "";
  }, 1500);
}

async function testTranslation() {
  testResult.textContent = "Translating...";
  try {
    await saveSettings();
    const response = await chrome.runtime.sendMessage({
      type: "translate",
      text: testText.value
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Translation failed");
    }

    testResult.textContent = response.result.translated || "No translation returned.";
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
