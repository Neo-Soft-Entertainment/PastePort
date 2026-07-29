(() => {
  "use strict";

  const detector = globalThis.__pastePortUploadDetector;
  const injector = globalThis.__pastePortFileInjector;
  const modalFactory = globalThis.__pastePortModal;
  const i18n = globalThis.__pastePortI18n;

  delete globalThis.__pastePortUploadDetector;
  delete globalThis.__pastePortFileInjector;
  delete globalThis.__pastePortModal;

  if (!detector || !injector || !modalFactory || !i18n) {
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

  const pastePortState = {
    activeInput: null,
    modalOpen: false,
    allowNativePicker: false,
    lastInteractionTarget: null,
    lastInteractionPath: null,
    lastInteractionPoint: null,
    pendingDetection: false
  };

  let settings = { ...DEFAULT_SETTINGS };
  let pageAbortController = null;
  let modal = null;
  let observers = [];
  let observedRoots = new WeakSet();
  let knownInputs = new WeakSet();

  function debug(...values) {
    if (settings.debug) {
      console.debug("[PastePort]", ...values);
    }
  }

  function extensionContextAvailable() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch (error) {
      return false;
    }
  }

  function normalizeDomain(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^[a-z]+:\/\//, "")
      .split("/")[0]
      .replace(/:\d+$/, "")
      .replace(/^\*\./, "")
      .replace(/\.$/, "");
  }

  function domainMatches(hostname, domain) {
    const normalized = normalizeDomain(domain);
    return normalized
      && (hostname === normalized || hostname.endsWith(`.${normalized}`));
  }

  function currentDomainIsListed(list) {
    const hostname = location.hostname.toLowerCase();
    return Array.isArray(list) && list.some((domain) => domainMatches(hostname, domain));
  }

  function shouldRun() {
    return settings.enabled
      && !currentDomainIsListed(settings.ignoredSites)
      && !currentDomainIsListed(settings.preferNativeSites);
  }

  function readStorageArea(area) {
    return new Promise((resolve, reject) => {
      try {
        area.get(DEFAULT_SETTINGS, (values) => {
          try {
            const error = chrome.runtime.lastError;
            if (error) {
              reject(error);
              return;
            }

            resolve(values);
          } catch (error) {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function historyRequest(type, values = {}) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({
          ...values,
          type,
          target: "pasteport-service-worker"
        }, (response) => {
          try {
            const error = chrome.runtime.lastError;
            if (error) {
              resolve({
                success: false,
                message: i18n.t("content.historyAccessError")
              });
              return;
            }

            resolve(response || {
              success: false,
              message: i18n.t("content.historyNoResponse")
            });
          } catch (error) {
            resolve({
              success: false,
              message: i18n.t("content.extensionReloaded")
            });
          }
        });
      } catch (error) {
        resolve({
          success: false,
          message: i18n.t("content.extensionReloaded")
        });
      }
    });
  }

  async function loadSettings() {
    try {
      return await readStorageArea(chrome.storage.sync);
    } catch (syncError) {
      debug("chrome.storage.sync indisponível; usando storage.local.", syncError.message);
      try {
        return await readStorageArea(chrome.storage.local);
      } catch (localError) {
        debug("Não foi possível carregar as configurações.", localError.message);
        return { ...DEFAULT_SETTINGS };
      }
    }
  }

  function registerInput(input) {
    if (!detector.isFileInput(input) || knownInputs.has(input)) {
      return;
    }

    knownInputs.add(input);
    debug("Campo de arquivo detectado.", input);
  }

  function scanAddedTree(node) {
    if (node?.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    registerInput(node);
    for (const input of node.querySelectorAll?.('input[type="file"]') || []) {
      registerInput(input);
    }

    if (node.shadowRoot) {
      observeRoot(node.shadowRoot);
      detector.discoverOpenShadowRoots(node.shadowRoot, observeRoot);
    }

    detector.discoverOpenShadowRoots(node, observeRoot);
  }

  function observeRoot(root) {
    if (!root || observedRoots.has(root)) {
      return;
    }

    observedRoots.add(root);

    for (const input of root.querySelectorAll?.('input[type="file"]') || []) {
      registerInput(input);
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          scanAddedTree(node);
        }
      }
    });

    observer.observe(root, { childList: true, subtree: true });
    observers.push(observer);
  }

  function stopObservers() {
    for (const observer of observers) {
      observer.disconnect();
    }

    observers = [];
    observedRoots = new WeakSet();
    knownInputs = new WeakSet();
  }

  async function onFilesCallback(files) {
    if (!files.length) {
      return {
        success: false,
        message: i18n.t("content.noValidImage"),
        closeAfterMs: null
      };
    }

    const result = injector.assignFilesToInput(
      pastePortState.activeInput,
      files,
      settings
    );

    if (!result.success) {
      debug("Falha ao inserir arquivos.", result.code, result.error || result.message);
      return {
        success: false,
        message: result.message,
        closeAfterMs: null
      };
    }

    const skipped = (result.rejected?.length || 0)
      + (result.ignored?.length || 0);
    const message = skipped
      ? `${result.message} ${i18n.t("content.filesSkipped", { count: skipped })}`
      : result.message;

    return {
      success: true,
      message,
      closeAfterMs: settings.closeAfterInsert ? 900 : null
    };
  }

  async function onHistorySelectCallback(id) {
    const response = await historyRequest("history:get", { id });
    if (!response.success) {
      return {
        success: false,
        message: response.message,
        closeAfterMs: null
      };
    }

    try {
      const separator = response.item.dataUrl.indexOf(",");
      const binary = atob(response.item.dataUrl.slice(separator + 1));
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const prepared = await injector.createPastedFile(
        new Blob([bytes], { type: response.item.type }),
        settings.defaultFileName
      );
      if (!prepared.success) {
        return {
          success: false,
          message: prepared.message,
          closeAfterMs: null
        };
      }

      return onFilesCallback([prepared.file]);
    } catch (error) {
      debug("Falha ao reconstruir item do histórico.", error);
      return {
        success: false,
        message: i18n.t("content.historyReconstructError"),
        closeAfterMs: null
      };
    }
  }

  function closeModal(reason = "controller") {
    modal?.close(reason);
  }

  function openModal(input, anchor = null) {
    if (!extensionContextAvailable()) {
      stop();
      return false;
    }

    if (pastePortState.modalOpen) {
      if (pastePortState.activeInput === input) {
        modal?.focus();
      }
      return true;
    }

    pastePortState.activeInput = input;
    pastePortState.modalOpen = true;

    const createdModal = modalFactory.createModal({
      input,
      anchor,
      settings,
      onFiles: onFilesCallback,
      onHistoryLoad: () => historyRequest("history:list"),
      onHistorySelect: (id) => onHistorySelectCallback(id),
      onHistoryRemove: (id) => historyRequest("history:remove", { id }),
      onHistoryClear: () => historyRequest("history:clear"),
      onNativePicker: openNativePicker,
      onClose(reason) {
        debug("Modal fechado.", reason);
        modal = null;
        pastePortState.modalOpen = false;
        pastePortState.activeInput = null;
      }
    });

    if (!createdModal) {
      pastePortState.activeInput = null;
      pastePortState.modalOpen = false;
      return false;
    }

    modal = createdModal;
    return true;
  }

  function interactionAnchor(event, input) {
    if (event.isTrusted && event.detail !== 0
      && (event.clientX !== 0 || event.clientY !== 0)) {
      return { x: event.clientX, y: event.clientY };
    }

    if (!event.isTrusted
      && pastePortState.lastInteractionPoint
      && performance.now() - pastePortState.lastInteractionPoint.time < 1200) {
      return pastePortState.lastInteractionPoint;
    }

    const path = typeof event.composedPath === "function"
      ? event.composedPath()
      : [event.target];
    const anchorElement = path.find((element) => {
      if (element?.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || input;
    const rect = anchorElement.getBoundingClientRect();

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function trackPointer(event) {
    pastePortState.lastInteractionPath = typeof event.composedPath === "function"
      ? event.composedPath()
      : [event.target];
    pastePortState.lastInteractionTarget = event.target;
    pastePortState.lastInteractionPoint = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now()
    };
  }

  function openNativePicker(input) {
    if (!input?.isConnected || input.disabled) {
      debug("Seletor nativo indisponível: input removido ou desabilitado.");
      return;
    }

    pastePortState.allowNativePicker = true;
    let showPickerError = null;

    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }

      input.click();
    } catch (error) {
      showPickerError = error;

      try {
        input.click();
        return;
      } catch (fallbackError) {
        debug("O seletor nativo foi bloqueado.", showPickerError, fallbackError);
        queueMicrotask(() => {
          openModal(input);
          modal?.setStatus(
            i18n.t("content.nativePickerBlocked", {
              selectFromComputer: i18n.t("modal.selectFromComputer")
            }),
            "error"
          );
        });
      }
    } finally {
      queueMicrotask(() => {
        pastePortState.allowNativePicker = false;
      });
    }
  }

  function interceptClick(event) {
    if (!extensionContextAvailable()) {
      stop();
      return;
    }

    if (pastePortState.allowNativePicker || event.button !== 0) {
      return;
    }

    const interaction = pastePortState.lastInteractionPoint
      && performance.now() - pastePortState.lastInteractionPoint.time < 1200
      ? {
        target: pastePortState.lastInteractionTarget,
        path: pastePortState.lastInteractionPath,
        point: pastePortState.lastInteractionPoint
      }
      : null;
    const detection = detector.findAssociatedInput(event, settings, interaction);
    if (!detection.input) {
      if (detection.reason === "multiple-inputs") {
        debug("Mais de um campo de imagem corresponde a este controle; clique preservado.", detection.candidates);
      }
      return;
    }

    if (!detection.input.isConnected || detection.input.disabled) {
      debug("Campo associado removido ou desabilitado; clique preservado.");
      return;
    }

    registerInput(detection.input);
    if (!openModal(detection.input, interactionAnchor(event, detection.input))) {
      return;
    }

    event.preventDefault();
    pastePortState.pendingDetection = false;
  }

  function start() {
    if (pageAbortController || !shouldRun()) {
      return;
    }

    pageAbortController = new AbortController();
    document.addEventListener("click", interceptClick, {
      capture: true,
      signal: pageAbortController.signal
    });
    document.addEventListener("pointerdown", trackPointer, {
      capture: true,
      passive: true,
      signal: pageAbortController.signal
    });

    observeRoot(document);

    const discover = () => detector.discoverOpenShadowRoots(document, observeRoot);
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(discover, { timeout: 1500 });
    } else {
      setTimeout(discover, 0);
    }

    debug("Ativo neste frame.", location.href);
  }

  function stop() {
    pageAbortController?.abort();
    pageAbortController = null;
    stopObservers();
    closeModal("disabled");
    pastePortState.activeInput = null;
    pastePortState.modalOpen = false;
    debug("Inativo neste frame.", location.href);
  }

  async function applySettings() {
    settings = { ...DEFAULT_SETTINGS, ...await loadSettings() };

    if (shouldRun()) {
      start();
      return;
    }

    stop();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" && areaName !== "local") {
      return;
    }

    for (const [key, change] of Object.entries(changes)) {
      if (key in DEFAULT_SETTINGS) {
        settings[key] = change.newValue ?? DEFAULT_SETTINGS[key];
      }
    }

    stop();
    if (shouldRun()) {
      start();
    }
  });

  applySettings();
})();
