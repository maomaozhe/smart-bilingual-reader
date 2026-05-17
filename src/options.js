const DEFAULT_SETTINGS = {
  provider: "google",
  targetLanguage: "zh-CN",
  libreTranslateUrl: "",
  libreTranslateApiKey: "",
  autoSpeakSelection: false,
  speakTranslatedText: false,
  speechRate: 1,
  speechPitch: 1
};

const fields = Object.fromEntries(
  Object.keys(DEFAULT_SETTINGS).map((key) => [key, document.getElementById(key)])
);
const saveButton = document.getElementById("save");
const statusNode = document.getElementById("status");

loadSettings();
saveButton.addEventListener("click", saveSettings);

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
