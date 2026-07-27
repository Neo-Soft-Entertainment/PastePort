(() => {
  "use strict";

  function createModal({
    input,
    anchor,
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
      <div class="pp-bubble">
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
            <p id="pp-description">Use a imagem da área de transferência ou escolha um arquivo.</p>
          </div>

          <div class="pp-clipboard-heading">
            <span class="pp-clipboard-title">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5.5h6M9.5 3h5a1 1 0 0 1 1 1v3h-7V4a1 1 0 0 1 1-1Z"></path>
                <path d="M8.5 5H6.8A1.8 1.8 0 0 0 5 6.8v12.4A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.8-1.8V6.8A1.8 1.8 0 0 0 17.2 5h-1.7"></path>
              </svg>
              Área de transferência
            </span>
            <span class="pp-clipboard-badge">Aguardando Ctrl+V</span>
          </div>

          <div class="pp-paste-zone" contenteditable="true" role="textbox" tabindex="0"
            spellcheck="false" aria-label="Área de transferência para colar ou arrastar imagens">
            <div class="pp-empty-state">
              <div class="pp-zone-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"></path>
                </svg>
              </div>
              <strong>Cole a imagem para visualizá-la</strong>
              <span>Pressione <kbd>Ctrl</kbd> + <kbd>V</kbd></span>
              <small class="pp-drop-copy">ou arraste imagens para esta área</small>
            </div>
            <div class="pp-preview-grid" aria-label="Pré-visualização da área de transferência" hidden></div>
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
      </div>
    `;

    shadowRoot.append(stylesheet, overlay);
    (document.documentElement || document.body).append(host);

    const bubble = overlay.querySelector(".pp-bubble");
    const dialog = overlay.querySelector(".pp-dialog");
    const pasteZone = overlay.querySelector(".pp-paste-zone");
    const emptyState = overlay.querySelector(".pp-empty-state");
    const previewGrid = overlay.querySelector(".pp-preview-grid");
    const clipboardBadge = overlay.querySelector(".pp-clipboard-badge");
    const status = overlay.querySelector(".pp-status");
    const closeButton = overlay.querySelector(".pp-close");
    const nativeButton = overlay.querySelector(".pp-native-button");
    const abortController = new AbortController();
    const { signal } = abortController;
    let closed = false;
    let dragDepth = 0;
    let closeTimer = null;
    let previewUrls = [];

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
      requestAnimationFrame(positionBubble);
    }

    function clearPreviewUrls() {
      for (const url of previewUrls) {
        URL.revokeObjectURL(url);
      }

      previewUrls = [];
    }

    function showPreview(files, source) {
      clearPreviewUrls();
      previewGrid.replaceChildren();
      emptyState.hidden = true;
      previewGrid.hidden = false;
      pasteZone.classList.add("has-preview");

      const label = source === "paste" ? "imagem colada" : "arquivo";
      clipboardBadge.textContent = files.length === 1
        ? `1 ${label}`
        : `${files.length} ${source === "paste" ? "imagens coladas" : "arquivos"}`;

      for (const [index, file] of files.slice(0, 6).entries()) {
        const figure = document.createElement("figure");
        const image = document.createElement("img");
        const caption = document.createElement("figcaption");
        const canPreview = String(file.type || "").startsWith("image/")
          || /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file.name || "");

        if (canPreview) {
          const url = URL.createObjectURL(file);
          previewUrls.push(url);
          image.src = url;
          image.alt = source === "paste"
            ? `Prévia da imagem colada ${index + 1}`
            : `Prévia de ${file.name || `imagem ${index + 1}`}`;
          figure.append(image);
        } else {
          const placeholder = document.createElement("span");
          placeholder.className = "pp-file-placeholder";
          placeholder.textContent = "ARQ";
          figure.append(placeholder);
        }

        caption.textContent = source === "paste"
          ? `Imagem ${index + 1}`
          : file.name || `Arquivo ${index + 1}`;
        figure.append(caption);
        previewGrid.append(figure);
      }

      if (files.length > 6) {
        const remaining = document.createElement("span");
        remaining.className = "pp-preview-more";
        remaining.textContent = `+${files.length - 6}`;
        remaining.setAttribute("aria-label", `Mais ${files.length - 6} arquivos`);
        previewGrid.append(remaining);
      }

      requestAnimationFrame(positionBubble);
    }

    function positionBubble() {
      if (closed) {
        return;
      }

      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const margin = 12;
      const gap = 14;
      const inputRect = input.getBoundingClientRect();
      const point = {
        x: Number.isFinite(anchor?.x)
          ? anchor.x
          : inputRect.left + inputRect.width / 2,
        y: Number.isFinite(anchor?.y)
          ? anchor.y
          : inputRect.top + inputRect.height / 2
      };

      point.x = Math.min(viewportWidth - margin, Math.max(margin, point.x));
      point.y = Math.min(viewportHeight - margin, Math.max(margin, point.y));

      dialog.style.maxHeight = `${viewportHeight - margin * 2}px`;

      let rect = bubble.getBoundingClientRect();
      const width = rect.width;
      const spaceRight = viewportWidth - point.x - margin - gap;
      const spaceLeft = point.x - margin - gap;
      const spaceBelow = viewportHeight - point.y - margin - gap;
      const spaceAbove = point.y - margin - gap;
      let placement;
      let left;
      let top;

      if (spaceRight >= width) {
        placement = "right";
      } else if (spaceLeft >= width) {
        placement = "left";
      } else if (spaceBelow >= rect.height || spaceBelow >= spaceAbove) {
        placement = "below";
      } else {
        placement = "above";
      }

      if (placement === "below" || placement === "above") {
        dialog.style.maxHeight = `${Math.max(0, placement === "below" ? spaceBelow : spaceAbove)}px`;
        rect = bubble.getBoundingClientRect();
      }

      const height = rect.height;

      if (placement === "right") {
        left = point.x + gap;
        top = point.y - Math.min(72, height * 0.2);
      } else if (placement === "left") {
        left = point.x - width - gap;
        top = point.y - Math.min(72, height * 0.2);
      } else if (placement === "below") {
        left = point.x - Math.min(72, width * 0.2);
        top = point.y + gap;
      } else {
        left = point.x - Math.min(72, width * 0.2);
        top = point.y - height - gap;
      }

      left = Math.min(viewportWidth - width - margin, Math.max(margin, left));
      top = Math.min(viewportHeight - height - margin, Math.max(margin, top));

      bubble.style.left = `${left}px`;
      bubble.style.top = `${top}px`;
      bubble.style.setProperty("--pp-tail-x", `${Math.min(width - 28, Math.max(28, point.x - left))}px`);
      bubble.style.setProperty("--pp-tail-y", `${Math.min(height - 28, Math.max(28, point.y - top))}px`);
      bubble.dataset.placement = placement;
      bubble.classList.add("is-positioned");
    }

    function close(reason = "dismissed", restoreFocus = true) {
      if (closed) {
        return;
      }

      closed = true;
      clearTimeout(closeTimer);
      clearPreviewUrls();
      abortController.abort();
      host.remove();
      onClose(reason);

      if (restoreFocus && previousFocus?.isConnected && typeof previousFocus.focus === "function") {
        previousFocus.focus({ preventScroll: true });
      }
    }

    async function processFiles(files, source) {
      clearTimeout(closeTimer);
      closeTimer = null;

      if (!files.length) {
        setStatus(
          source === "paste"
            ? "Nenhuma imagem foi encontrada na área de transferência."
            : "Nenhuma imagem válida foi encontrada nos arquivos arrastados.",
          "error"
        );
        return;
      }

      showPreview(files, source);
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

    window.addEventListener("resize", positionBubble, { signal });
    window.visualViewport?.addEventListener("resize", positionBubble, { signal });
    stylesheet.addEventListener("load", positionBubble, { signal });

    requestAnimationFrame(() => {
      positionBubble();
      pasteZone.focus({ preventScroll: true });
    });

    return Object.freeze({
      close,
      setStatus,
      focus: () => pasteZone.focus({ preventScroll: true })
    });
  }

  globalThis.__pastePortModal = Object.freeze({ createModal });
})();
