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

chrome.runtime.onInstalled.addListener(() => {
  initializeStorage(chrome.storage.sync, () => {
    initializeStorage(chrome.storage.local);
  });
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
