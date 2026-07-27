(() => {
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

  const form = document.querySelector("#settings-form");
  const status = document.querySelector("#status");
  const historyStatus = document.querySelector("#history-status");
  const clearHistoryButton = document.querySelector("#clear-history");

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
    document.querySelector("#enabled").checked = values.enabled;
    document.querySelector("#only-image-uploads").checked = values.onlyImageUploads;
    document.querySelector("#drag-drop-enabled").checked = values.dragDropEnabled;
    document.querySelector("#close-after-insert").checked = values.closeAfterInsert;
    document.querySelector("#combine-existing-files").checked = values.combineExistingFiles;
    document.querySelector("#max-files").value = values.maxFiles;
    document.querySelector("#default-file-name").value = values.defaultFileName;
    document.querySelector("#theme").value = values.theme;
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
        status.textContent = "Não foi possível ler as configurações salvas.";
      }
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.className = "";
    status.textContent = "Salvando…";

    const values = readForm();
    try {
      await storageSet(chrome.storage.sync, values);
      fillForm(values);
      status.className = "is-success";
      status.textContent = "Configurações salvas.";
    } catch (syncError) {
      try {
        await storageSet(chrome.storage.local, values);
        fillForm(values);
        status.className = "is-success";
        status.textContent = "Configurações salvas localmente.";
      } catch (localError) {
        status.className = "is-error";
        status.textContent = "Não foi possível salvar as configurações.";
      }
    }
  });

  clearHistoryButton.addEventListener("click", async () => {
    if (clearHistoryButton.dataset.confirm !== "true") {
      clearHistoryButton.dataset.confirm = "true";
      clearHistoryButton.textContent = "Confirmar limpeza";
      historyStatus.textContent = "Clique novamente para remover todas as imagens locais.";
      return;
    }

    clearHistoryButton.disabled = true;
    const response = await historyRequest("history:clear");
    clearHistoryButton.disabled = false;
    clearHistoryButton.dataset.confirm = "false";
    clearHistoryButton.textContent = "Limpar histórico";
    historyStatus.textContent = response?.success
      ? "Nenhuma imagem armazenada."
      : "Não foi possível limpar o histórico.";
  });

  async function loadHistorySummary() {
    const response = await historyRequest("history:list");
    if (!response?.success) {
      historyStatus.textContent = "Histórico indisponível.";
      return;
    }

    historyStatus.textContent = response.items.length === 1
      ? "1 imagem armazenada somente neste dispositivo."
      : `${response.items.length} imagens armazenadas somente neste dispositivo.`;
  }

  load();
  loadHistorySummary();
})();
