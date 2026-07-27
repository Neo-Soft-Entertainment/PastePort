"use strict";

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  onlyImageUploads: true,
  dragDropEnabled: true,
  closeAfterInsert: true,
  preferNativeSites: [],
  ignoredSites: [],
  maxFiles: 10,
  defaultFileName: "pasteport",
  theme: "auto",
  debug: false,
  combineExistingFiles: false
});

const OFFSCREEN_PATH = "offscreen/offscreen.html";
let creatingOffscreenDocument = null;

function initializeStorage(area, onFailure) {
  area.get(null, (stored) => {
    if (chrome.runtime.lastError) {
      onFailure?.();
      return;
    }

    const missing = {};
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(key in stored)) {
        missing[key] = value;
      }
    }

    if (Object.keys(missing).length) {
      area.set(missing);
    }
  });
}

function readEnabled(area) {
  return new Promise((resolve, reject) => {
    area.get({ enabled: true }, (values) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
        return;
      }

      resolve(values.enabled !== false);
    });
  });
}

async function monitoringEnabled() {
  try {
    return await readEnabled(chrome.storage.sync);
  } catch (error) {
    try {
      return await readEnabled(chrome.storage.local);
    } catch (localError) {
      return true;
    }
  }
}

async function hasOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_PATH);

  if ("getContexts" in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
    return contexts.length > 0;
  }

  const matchedClients = await clients.matchAll();
  return matchedClients.some((client) => client.url === offscreenUrl);
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    return;
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ["CLIPBOARD"],
      justification: "Manter localmente a galeria de imagens recentes da área de transferência."
    });
  }

  try {
    await creatingOffscreenDocument;
  } finally {
    creatingOffscreenDocument = null;
  }
}

async function updateClipboardMonitoring(enabled = null) {
  await ensureOffscreenDocument();
  await chrome.runtime.sendMessage({
    target: "pasteport-offscreen",
    type: "monitor:set",
    enabled: enabled ?? await monitoringEnabled()
  });
}

chrome.runtime.onInstalled.addListener(() => {
  initializeStorage(chrome.storage.sync, () => {
    initializeStorage(chrome.storage.local);
  });
  updateClipboardMonitoring().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  updateClipboardMonitoring().catch(() => {});
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if ((areaName === "sync" || areaName === "local") && changes.enabled) {
    updateClipboardMonitoring(changes.enabled.newValue !== false).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== "pasteport-service-worker") {
    return false;
  }

  const prepareOffscreen = message.type === "history:list"
    ? updateClipboardMonitoring()
    : ensureOffscreenDocument();

  prepareOffscreen
    .then(() => chrome.runtime.sendMessage({
      ...message,
      target: "pasteport-offscreen"
    }))
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        success: false,
        message: error.message || "Não foi possível acessar o histórico local."
      });
    });

  return true;
});
