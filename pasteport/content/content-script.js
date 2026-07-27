(() => {
  "use strict";

  const detector = globalThis.__pastePortUploadDetector;
  const injector = globalThis.__pastePortFileInjector;
  const modalFactory = globalThis.__pastePortModal;

  delete globalThis.__pastePortUploadDetector;
  delete globalThis.__pastePortFileInjector;
  delete globalThis.__pastePortModal;

  if (!detector || !injector || !modalFactory) {
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
    debug: false,
    combineExistingFiles: false
  });

  const pastePortState = {
    activeInput: null,
    modalOpen: false,
    allowNativePicker: false,
    lastInteractionTarget: null,
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

  async function preparePastedFiles(files) {
    const prepared = [];
    const errors = [];

    for (const [index, file] of files.entries()) {
      const result = await injector.createPastedFile(file, settings.defaultFileName, index);
      if (result.success) {
        prepared.push(result.file);
        continue;
      }

      errors.push(result);
    }

    return { prepared, errors };
  }

  async function handleFiles(files, source) {
    let candidates = files;
    let preparationErrors = [];

    if (source === "paste") {
      const result = await preparePastedFiles(files);
      candidates = result.prepared;
      preparationErrors = result.errors;
    }

    if (!candidates.length) {
      const error = preparationErrors[0];
      debug("Falha ao preparar imagem colada.", error);
      return {
        success: false,
        message: error?.message || "Nenhuma imagem válida foi encontrada.",
        closeAfterMs: null
      };
    }

    const result = injector.assignFilesToInput(
      pastePortState.activeInput,
      candidates,
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
      + (result.ignored?.length || 0)
      + preparationErrors.length;
    const message = skipped
      ? `${result.message} ${skipped} arquivo(s) foram ignorados ou rejeitados.`
      : result.message;

    return {
      success: true,
      message,
      closeAfterMs: settings.closeAfterInsert ? 450 : null
    };
  }

  function closeModal(reason = "controller") {
    modal?.close(reason);
  }

  function openModal(input) {
    if (pastePortState.modalOpen) {
      if (pastePortState.activeInput === input) {
        modal?.focus();
      }
      return;
    }

    pastePortState.activeInput = input;
    pastePortState.modalOpen = true;

    modal = modalFactory.createModal({
      input,
      settings,
      onFiles: handleFiles,
      onNativePicker: openNativePicker,
      onClose(reason) {
        debug("Modal fechado.", reason);
        modal = null;
        pastePortState.modalOpen = false;
        pastePortState.activeInput = null;
      }
    });
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
            "O navegador bloqueou o seletor nativo. Clique novamente em “Selecionar do computador”.",
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
    if (pastePortState.allowNativePicker || event.button !== 0) {
      return;
    }

    const detection = detector.findAssociatedInput(event, settings);
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

    event.preventDefault();
    pastePortState.lastInteractionTarget = event.target;
    pastePortState.pendingDetection = false;
    registerInput(detection.input);
    openModal(detection.input);
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
