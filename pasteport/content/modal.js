(() => {
  "use strict";

  function createModal({
    input,
    settings,
    onFiles,
    onNativePicker,
    onClose
  }) {
    let previousFocus = document.activeElement;
    while (previousFocus?.shadowRoot?.activeElement) {
      previousFocus = previousFocus.shadowRoot.activeElement;
    }
    const host = document.createElement("div");
    host.id = "pasteport-extension-root";
    host.setAttribute("data-pasteport-host", "");
    host.style.cssText = [
      "all: initial !important",
      "position: fixed !important",
      "inset: 0 !important",
      "z-index: 2147483647 !important",
      "display: block !important",
      "width: 100vw !important",
      "height: 100vh !important",
      "pointer-events: none !important"
    ].join(";");

    const shadowRoot = host.attachShadow({ mode: "open" });
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = chrome.runtime.getURL("content/styles.css");

    const overlay = document.createElement("div");
    overlay.className = "pp-overlay";
    overlay.dataset.theme = settings.theme;
    overlay.innerHTML = `
      <section class="pp-dialog" role="dialog" aria-modal="true" aria-labelledby="pp-title" aria-describedby="pp-description">
        <header class="pp-header">
          <div class="pp-brand" aria-label="PastePort">
            <span class="pp-logo" aria-hidden="true">P</span>
            <span>PastePort</span>
          </div>
          <button class="pp-close" type="button" aria-label="Fechar modal">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18"></path>
            </svg>
          </button>
        </header>

        <div class="pp-heading">
          <h1 id="pp-title">Adicionar imagem</h1>
          <p id="pp-description">Cole uma imagem da área de transferência ou escolha um arquivo.</p>
        </div>

        <div class="pp-paste-zone" contenteditable="true" role="textbox" tabindex="0"
          spellcheck="false" aria-label="Área para colar ou arrastar imagens">
          <div class="pp-zone-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"></path>
            </svg>
          </div>
          <strong>Cole uma imagem aqui</strong>
          <span>Pressione <kbd>Ctrl</kbd> + <kbd>V</kbd></span>
          <small class="pp-drop-copy">ou arraste imagens para esta área</small>
        </div>

        <div class="pp-status" role="status" aria-live="polite" hidden></div>

        <div class="pp-separator" aria-hidden="true">
          <span></span><em>ou</em><span></span>
        </div>

        <button class="pp-native-button" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3.5 7.5h6l2-2h9v13h-17z"></path>
          </svg>
          Selecionar do computador
        </button>

        <p class="pp-privacy">
          A imagem é processada apenas neste dispositivo.
        </p>
      </section>
    `;

    shadowRoot.append(stylesheet, overlay);
    (document.documentElement || document.body).append(host);

    const dialog = overlay.querySelector(".pp-dialog");
    const pasteZone = overlay.querySelector(".pp-paste-zone");
    const status = overlay.querySelector(".pp-status");
    const closeButton = overlay.querySelector(".pp-close");
    const nativeButton = overlay.querySelector(".pp-native-button");
    const abortController = new AbortController();
    const { signal } = abortController;
    let closed = false;
    let dragDepth = 0;
    let closeTimer = null;

    if (!settings.dragDropEnabled) {
      overlay.querySelector(".pp-drop-copy").hidden = true;
    }

    function setBusy(busy) {
      dialog.setAttribute("aria-busy", String(busy));
      pasteZone.classList.toggle("is-busy", busy);
      nativeButton.disabled = busy;
    }

    function setStatus(message, type = "info") {
      status.hidden = !message;
      status.className = `pp-status is-${type}`;
      status.textContent = message || "";
    }

    function close(reason = "dismissed", restoreFocus = true) {
      if (closed) {
        return;
      }

      closed = true;
      clearTimeout(closeTimer);
      abortController.abort();
      host.remove();
      onClose(reason);

      if (restoreFocus && previousFocus?.isConnected && typeof previousFocus.focus === "function") {
        previousFocus.focus({ preventScroll: true });
      }
    }

    async function processFiles(files, source) {
      if (!files.length) {
        setStatus(
          source === "paste"
            ? "Nenhuma imagem foi encontrada na área de transferência."
            : "Nenhuma imagem válida foi encontrada nos arquivos arrastados.",
          "error"
        );
        return;
      }

      setBusy(true);
      setStatus(source === "paste" ? "Processando imagem…" : "Validando arquivos…");

      try {
        const result = await onFiles(files, source);
        setStatus(result.message, result.success ? "success" : "error");

        if (result.success && result.closeAfterMs !== null) {
          closeTimer = setTimeout(() => close("files-inserted"), result.closeAfterMs);
        }
      } catch (error) {
        setStatus("Não foi possível inserir a imagem neste campo.", "error");
      } finally {
        setBusy(false);
        pasteZone.replaceChildren(
          ...Array.from(pasteZone.childNodes).filter((node) => node.nodeType === Node.ELEMENT_NODE)
        );
      }
    }

    shadowRoot.addEventListener("paste", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const files = [];
      for (const item of event.clipboardData?.items || []) {
        if (item.kind !== "file" || !item.type.toLowerCase().startsWith("image/")) {
          continue;
        }

        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }

      processFiles(files, "paste");
    }, { capture: true, signal });

    pasteZone.addEventListener("beforeinput", (event) => {
      event.preventDefault();
    }, { signal });

    if (settings.dragDropEnabled) {
      pasteZone.addEventListener("dragenter", (event) => {
        event.preventDefault();
        dragDepth += 1;
        pasteZone.classList.add("is-dragging");
      }, { signal });

      pasteZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "copy";
        }
      }, { signal });

      pasteZone.addEventListener("dragleave", (event) => {
        event.preventDefault();
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) {
          pasteZone.classList.remove("is-dragging");
        }
      }, { signal });

      pasteZone.addEventListener("drop", (event) => {
        event.preventDefault();
        dragDepth = 0;
        pasteZone.classList.remove("is-dragging");
        processFiles(Array.from(event.dataTransfer?.files || []), "drop");
      }, { signal });
    }

    closeButton.addEventListener("click", () => close("close-button"), { signal });

    nativeButton.addEventListener("click", () => {
      const originalInput = input;
      close("native-picker", false);
      onNativePicker(originalInput);
    }, { signal });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close("outside-click");
      }
    }, { signal });

    shadowRoot.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close("escape");
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = [pasteZone, nativeButton, closeButton].filter((element) => !element.disabled);
      const currentIndex = focusable.indexOf(shadowRoot.activeElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
        : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);

      event.preventDefault();
      focusable[nextIndex].focus();
    }, { signal });

    requestAnimationFrame(() => pasteZone.focus({ preventScroll: true }));

    return Object.freeze({
      close,
      setStatus,
      focus: () => pasteZone.focus({ preventScroll: true })
    });
  }

  globalThis.__pastePortModal = Object.freeze({ createModal });
})();
