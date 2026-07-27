(() => {
  "use strict";

  let stylesheetUrl;
  try {
    stylesheetUrl = chrome.runtime.getURL("content/styles.css");
  } catch (error) {
    return;
  }

  function createModal({
    input,
    anchor,
    settings,
    onFiles,
    onHistoryLoad,
    onHistorySelect,
    onHistoryRemove,
    onHistoryClear,
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
    stylesheet.href = stylesheetUrl;

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
            <span class="pp-clipboard-actions">
              <span class="pp-clipboard-badge">Carregando…</span>
              <button class="pp-clear-history" type="button" hidden>Limpar</button>
            </span>
          </div>

          <div class="pp-history-panel">
            <div class="pp-history-loading" role="status">Lendo imagens recentes…</div>
            <div class="pp-history-list" role="list" aria-label="Imagens recentes da área de transferência" hidden></div>
            <div class="pp-history-empty" hidden>
              <strong>Nenhuma imagem recente</strong>
              <span>As próximas imagens copiadas aparecerão aqui.</span>
            </div>
          </div>

          <div class="pp-paste-zone" contenteditable="true" role="textbox" tabindex="0"
            spellcheck="false" aria-label="Área de transferência para colar ou arrastar imagens">
            <div class="pp-empty-state">
              <div class="pp-zone-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"></path>
                </svg>
              </div>
              <strong>Cole outra imagem agora</strong>
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
    const historyPanel = overlay.querySelector(".pp-history-panel");
    const historyLoading = overlay.querySelector(".pp-history-loading");
    const historyList = overlay.querySelector(".pp-history-list");
    const historyEmpty = overlay.querySelector(".pp-history-empty");
    const clipboardBadge = overlay.querySelector(".pp-clipboard-badge");
    const clearHistoryButton = overlay.querySelector(".pp-clear-history");
    const status = overlay.querySelector(".pp-status");
    const closeButton = overlay.querySelector(".pp-close");
    const nativeButton = overlay.querySelector(".pp-native-button");
    const abortController = new AbortController();
    const { signal } = abortController;
    let closed = false;
    let dragDepth = 0;
    let closeTimer = null;
    let clearConfirmationTimer = null;
    let previewUrls = [];
    let processing = false;

    if (!settings.dragDropEnabled) {
      overlay.querySelector(".pp-drop-copy").hidden = true;
    }

    function setBusy(busy) {
      processing = busy;
      dialog.setAttribute("aria-busy", String(busy));
      pasteZone.classList.toggle("is-busy", busy);
      historyPanel.classList.toggle("is-busy", busy);
      nativeButton.disabled = busy;
      clearHistoryButton.disabled = busy;
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

    function historyTime(timestamp) {
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(timestamp));
    }

    function renderHistory(items) {
      historyList.replaceChildren();
      historyLoading.hidden = true;
      historyList.hidden = items.length === 0;
      historyEmpty.hidden = items.length > 0;
      clearHistoryButton.hidden = items.length === 0;
      clearHistoryButton.classList.remove("is-confirming");
      clearHistoryButton.textContent = "Limpar";
      clipboardBadge.textContent = items.length === 1
        ? "1 imagem recente"
        : `${items.length} imagens recentes`;

      for (const item of items) {
        const card = document.createElement("article");
        card.className = "pp-history-card";
        card.setAttribute("role", "listitem");

        const selectButton = document.createElement("button");
        selectButton.className = "pp-history-select";
        selectButton.type = "button";
        selectButton.dataset.historyId = item.id;
        selectButton.setAttribute("aria-label", `Usar imagem copiada em ${historyTime(item.createdAt)}`);

        if (item.thumbnail) {
          const image = document.createElement("img");
          image.src = item.thumbnail;
          image.alt = "";
          selectButton.append(image);
        } else {
          const placeholder = document.createElement("span");
          placeholder.className = "pp-history-placeholder";
          placeholder.textContent = "IMG";
          selectButton.append(placeholder);
        }

        const caption = document.createElement("span");
        caption.textContent = historyTime(item.createdAt);
        selectButton.append(caption);

        const removeButton = document.createElement("button");
        removeButton.className = "pp-remove-history";
        removeButton.type = "button";
        removeButton.dataset.removeHistoryId = item.id;
        removeButton.setAttribute("aria-label", `Remover imagem copiada em ${historyTime(item.createdAt)}`);
        removeButton.textContent = "×";

        card.append(selectButton, removeButton);
        historyList.append(card);
      }

      requestAnimationFrame(positionBubble);
    }

    async function loadHistory() {
      const response = await onHistoryLoad();
      if (closed) {
        return;
      }

      if (!response.success) {
        historyLoading.textContent = response.message;
        clipboardBadge.textContent = "Indisponível";
        return;
      }

      renderHistory(response.items || []);
      if (response.warning) {
        setStatus(response.warning, "error");
      }
    }

    async function useHistoryItem(id) {
      if (processing) {
        return;
      }

      clearTimeout(closeTimer);
      closeTimer = null;
      setBusy(true);
      setStatus("Inserindo imagem do histórico…");

      try {
        const result = await onHistorySelect(id);
        setStatus(result.message, result.success ? "success" : "error");

        if (result.success && result.closeAfterMs !== null) {
          closeTimer = setTimeout(() => close("history-item-inserted"), result.closeAfterMs);
        }
      } catch (error) {
        setStatus("Não foi possível inserir esta imagem do histórico.", "error");
      } finally {
        setBusy(false);
      }
    }

    async function removeHistoryItem(id) {
      if (processing) {
        return;
      }

      setBusy(true);
      try {
        const response = await onHistoryRemove(id);
        if (!response.success) {
          setStatus(response.message, "error");
          return;
        }

        renderHistory(response.items || []);
        setStatus("Imagem removida do histórico.", "success");
      } catch (error) {
        setStatus("Não foi possível remover esta imagem.", "error");
      } finally {
        setBusy(false);
      }
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
      clearTimeout(clearConfirmationTimer);
      clearPreviewUrls();
      abortController.abort();
      host.remove();
      onClose(reason);

      if (restoreFocus && previousFocus?.isConnected && typeof previousFocus.focus === "function") {
        previousFocus.focus({ preventScroll: true });
      }
    }

    async function processFiles(files, source) {
      if (processing) {
        return;
      }

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

    historyList.addEventListener("click", (event) => {
      const removeButton = event.target.closest?.("[data-remove-history-id]");
      if (removeButton) {
        removeHistoryItem(removeButton.dataset.removeHistoryId);
        return;
      }

      const selectButton = event.target.closest?.("[data-history-id]");
      if (selectButton) {
        useHistoryItem(selectButton.dataset.historyId);
      }
    }, { signal });

    clearHistoryButton.addEventListener("click", async () => {
      if (processing) {
        return;
      }

      if (!clearHistoryButton.classList.contains("is-confirming")) {
        clearHistoryButton.classList.add("is-confirming");
        clearHistoryButton.textContent = "Confirmar";
        clearTimeout(clearConfirmationTimer);
        clearConfirmationTimer = setTimeout(() => {
          clearHistoryButton.classList.remove("is-confirming");
          clearHistoryButton.textContent = "Limpar";
        }, 4000);
        return;
      }

      clearTimeout(clearConfirmationTimer);
      setBusy(true);
      try {
        const response = await onHistoryClear();
        if (!response.success) {
          setStatus(response.message, "error");
          return;
        }

        clearHistoryButton.classList.remove("is-confirming");
        clearHistoryButton.textContent = "Limpar";
        renderHistory([]);
        setStatus("Histórico local removido.", "success");
      } catch (error) {
        setStatus("Não foi possível limpar o histórico.", "error");
      } finally {
        setBusy(false);
      }
    }, { signal });

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

      const focusable = Array.from(
        dialog.querySelectorAll('button:not([disabled]), [tabindex="0"]')
      ).filter((element) => !element.hidden && !element.closest("[hidden]"));
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
    loadHistory();

    return Object.freeze({
      close,
      setStatus,
      focus: () => pasteZone.focus({ preventScroll: true })
    });
  }

  globalThis.__pastePortModal = Object.freeze({ createModal });
})();
