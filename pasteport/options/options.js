(() => {
  "use strict";

  const i18n = globalThis.__pastePortI18n;
  if (!i18n) {
    return;
  }

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
    language: "auto",
    debug: false,
    combineExistingFiles: false
  });

  const form = document.querySelector("#settings-form");
  const status = document.querySelector("#status");
  const historyStatus = document.querySelector("#history-status");
  const clearHistoryButton = document.querySelector("#clear-history");

  function translateDocument() {
    const locale = i18n.getLocale();
    document.documentElement.lang = locale;

    for (const element of document.querySelectorAll("[data-i18n]")) {
      const key = element.dataset.i18n;
      const options = {};
      if (key === "options.languageAuto") {
        options.detected = i18n.detectBrowserLocale();
      }

      const translated = i18n.t(key, options);
      if (element.tagName === "TITLE") {
        document.title = translated;
      } else if ("placeholder" in element && element.tagName !== "BUTTON" && element.tagName !== "OPTION") {
        element.textContent = translated;
      } else if ("value" in element && element.tagName === "OPTION") {
        element.textContent = translated;
      } else {
        element.textContent = translated;
      }
    }
  }

  function storageGet(area) {
    return new Promise((resolve, reject) => {
      area.get(DEFAULT_SETTINGS, (values) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(error);
          return;
        }

        resolve(values);
      });
    });
  }

  function storageSet(area, values) {
    return new Promise((resolve, reject) => {
      area.set(values, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  function historyRequest(type) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type,
        target: "pasteport-service-worker"
      }, (response) => {
        const error = chrome.runtime.lastError;
        resolve(error ? { success: false } : response);
      });
    });
  }

  function normalizeDomain(value) {
    return value
      .trim()
      .toLowerCase()
      .replace(/^[a-z]+:\/\//, "")
      .split("/")[0]
      .replace(/:\d+$/, "")
      .replace(/^\*\./, "")
      .replace(/\.$/, "");
  }

  function domainList(value) {
    return [...new Set(
      value
        .split(/[\n,]+/)
        .map(normalizeDomain)
        .filter(Boolean)
    )];
  }

  function fillForm(values) {
    i18n.setLocale(values.language);
    translateDocument();

    document.querySelector("#enabled").checked = values.enabled;
    document.querySelector("#only-image-uploads").checked = values.onlyImageUploads;
    document.querySelector("#drag-drop-enabled").checked = values.dragDropEnabled;
    document.querySelector("#close-after-insert").checked = values.closeAfterInsert;
    document.querySelector("#combine-existing-files").checked = values.combineExistingFiles;
    document.querySelector("#max-files").value = values.maxFiles;
    document.querySelector("#default-file-name").value = values.defaultFileName;
    document.querySelector("#theme").value = values.theme;
    document.querySelector("#language").value = values.language;
    document.querySelector("#ignored-sites").value = values.ignoredSites.join("\n");
    document.querySelector("#prefer-native-sites").value = values.preferNativeSites.join("\n");
    document.querySelector("#debug").checked = values.debug;
  }

  function readForm() {
    return {
      enabled: document.querySelector("#enabled").checked,
      onlyImageUploads: document.querySelector("#only-image-uploads").checked,
      dragDropEnabled: document.querySelector("#drag-drop-enabled").checked,
      closeAfterInsert: document.querySelector("#close-after-insert").checked,
      combineExistingFiles: document.querySelector("#combine-existing-files").checked,
      maxFiles: Math.min(100, Math.max(
        1,
        Number.parseInt(document.querySelector("#max-files").value, 10) || 10
      )),
      defaultFileName: document.querySelector("#default-file-name").value.trim() || "pasteport",
      theme: document.querySelector("#theme").value,
      language: document.querySelector("#language").value,
      ignoredSites: domainList(document.querySelector("#ignored-sites").value),
      preferNativeSites: domainList(document.querySelector("#prefer-native-sites").value),
      debug: document.querySelector("#debug").checked
    };
  }

  async function load() {
    try {
      fillForm(await storageGet(chrome.storage.sync));
    } catch (syncError) {
      try {
        fillForm(await storageGet(chrome.storage.local));
      } catch (localError) {
        fillForm(DEFAULT_SETTINGS);
        status.className = "is-error";
        status.textContent = i18n.t("options.loadError");
      }
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.className = "";
    status.textContent = i18n.t("options.saving");

    const values = readForm();
    try {
      await storageSet(chrome.storage.sync, values);
      fillForm(values);
      status.className = "is-success";
      status.textContent = i18n.t("options.saved");
    } catch (syncError) {
      try {
        await storageSet(chrome.storage.local, values);
        fillForm(values);
        status.className = "is-success";
        status.textContent = i18n.t("options.savedLocally");
      } catch (localError) {
        status.className = "is-error";
        status.textContent = i18n.t("options.saveError");
      }
    }
  });

  clearHistoryButton.addEventListener("click", async () => {
    if (clearHistoryButton.dataset.confirm !== "true") {
      clearHistoryButton.dataset.confirm = "true";
      clearHistoryButton.textContent = i18n.t("options.clearHistoryConfirm");
      historyStatus.textContent = i18n.t("options.clearHistoryHint");
      return;
    }

    clearHistoryButton.disabled = true;
    const response = await historyRequest("history:clear");
    clearHistoryButton.disabled = false;
    clearHistoryButton.dataset.confirm = "false";
    clearHistoryButton.textContent = i18n.t("options.clearHistory");
    historyStatus.textContent = response?.success
      ? i18n.t("options.noImagesStored")
      : i18n.t("options.clearHistoryError");
  });

  async function loadHistorySummary() {
    const response = await historyRequest("history:list");
    if (!response?.success) {
      historyStatus.textContent = i18n.t("options.historyUnavailable");
      return;
    }

    historyStatus.textContent = response.items.length === 1
      ? i18n.t("options.oneImageStored")
      : i18n.t("options.manyImagesStored", { count: response.items.length });
  }

  document.querySelector("#language").addEventListener("change", () => {
    const values = readForm();
    i18n.setLocale(values.language);
    translateDocument();
  });

  load();
  loadHistorySummary();
})();
