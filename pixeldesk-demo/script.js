(() => {
  "use strict";

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ACCEPTED_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif"
  ]);

  const mainInput = document.querySelector("#main-image-upload");
  const topInput = document.querySelector("#top-image-upload");
  const topUploadButton = document.querySelector("#top-upload-button");
  const dropzone = document.querySelector("#main-dropzone");
  const uploadLabel = document.querySelector(".upload-label");
  const uploadDefault = document.querySelector("#upload-default");
  const uploadResult = document.querySelector("#upload-result");
  const uploadedImage = document.querySelector("#uploaded-image");
  const uploadedFilename = document.querySelector("#uploaded-filename");
  const uploadedMetadata = document.querySelector("#uploaded-metadata");
  const uploadFeedback = document.querySelector("#upload-feedback");
  const dropInstruction = document.querySelector("#drop-instruction");
  const assetGrid = document.querySelector("#asset-grid");
  const assetCount = document.querySelector("#asset-count");
  const guideBanner = document.querySelector("#guide-banner");
  const demoPanel = document.querySelector("#demo-panel");
  const mobileMenu = document.querySelector("#mobile-menu");
  const mobileBackdrop = document.querySelector("#mobile-backdrop");

  let activeObjectUrl = null;
  let activeRecentCard = null;
  let dragDepth = 0;

  function formatFileSize(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }

  function friendlyFileType(type) {
    const names = {
      "image/png": "PNG",
      "image/jpeg": "JPEG",
      "image/webp": "WebP",
      "image/gif": "GIF"
    };

    return names[type] || "Imagem";
  }

  function validateFile(file) {
    if (!file) {
      return "Nenhuma imagem foi selecionada.";
    }

    if (!ACCEPTED_TYPES.has(file.type.toLowerCase())) {
      return "Escolha uma imagem PNG, JPEG, WebP ou GIF.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "A imagem deve ter no máximo 10 MB.";
    }

    return "";
  }

  function clearActivePreview() {
    if (activeRecentCard) {
      activeRecentCard.remove();
      activeRecentCard = null;
      assetGrid.classList.remove("has-new");
    }

    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }

    uploadedImage.removeAttribute("src");
  }

  function updateAssetCount() {
    const total = 24 + (activeRecentCard ? 1 : 0);
    assetCount.textContent = `${total} arquivos`;
  }

  function createRecentCard(file, objectUrl, resolution) {
    const card = document.createElement("article");
    card.className = "asset-card is-new";

    const preview = document.createElement("div");
    preview.className = "asset-preview";

    const image = document.createElement("img");
    image.src = objectUrl;
    image.alt = "";
    preview.append(image);

    const info = document.createElement("div");
    info.className = "asset-info";

    const details = document.createElement("div");
    const name = document.createElement("strong");
    const metadata = document.createElement("span");
    name.textContent = file.name;
    metadata.textContent = `${resolution} · ${formatFileSize(file.size)}`;
    details.append(name, metadata);

    const menu = document.createElement("button");
    menu.type = "button";
    menu.setAttribute("aria-label", `Mais opções para ${file.name}`);
    menu.textContent = "•••";

    info.append(details, menu);
    card.append(preview, info);
    assetGrid.classList.add("has-new");
    assetGrid.prepend(card);
    return card;
  }

  function readImageDimensions(objectUrl) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(`${image.naturalWidth} × ${image.naturalHeight}`);
      image.onerror = () => resolve("Dimensões indisponíveis");
      image.src = objectUrl;
    });
  }

  async function showFile(file) {
    const validationError = validateFile(file);
    if (validationError) {
      uploadFeedback.textContent = validationError;
      return false;
    }

    clearActivePreview();
    uploadFeedback.textContent = "";
    activeObjectUrl = URL.createObjectURL(file);

    const resolution = await readImageDimensions(activeObjectUrl);
    uploadedImage.src = activeObjectUrl;
    uploadedFilename.textContent = file.name;
    uploadedMetadata.textContent =
      `${friendlyFileType(file.type)} · ${formatFileSize(file.size)} · ${resolution}`;
    uploadDefault.hidden = true;
    uploadResult.hidden = false;
    dropzone.classList.add("has-file");

    activeRecentCard = createRecentCard(file, activeObjectUrl, resolution);
    updateAssetCount();
    return true;
  }

  function restoreInitialState() {
    clearActivePreview();
    mainInput.value = "";
    topInput.value = "";
    uploadDefault.hidden = false;
    uploadResult.hidden = true;
    uploadFeedback.textContent = "";
    dropzone.classList.remove("has-file", "is-dragging");
    dropInstruction.textContent =
      "Arraste uma imagem para esta área ou selecione um arquivo do computador";
    dragDepth = 0;
    updateAssetCount();
  }

  function assignFileToMainInput(file) {
    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      mainInput.files = dataTransfer.files;
      mainInput.dispatchEvent(new Event("input", { bubbles: true }));
      mainInput.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (error) {
      showFile(file);
    }
  }

  function createDemoFile() {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 760;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas indisponível."));
        return;
      }

      const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      background.addColorStop(0, "#25273a");
      background.addColorStop(.55, "#5357a5");
      background.addColorStop(1, "#7476d9");
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = "rgba(255, 255, 255, 0.09)";
      context.beginPath();
      context.arc(1020, 30, 330, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "#f1a583";
      context.beginPath();
      context.arc(955, 245, 132, 0, Math.PI * 2);
      context.fill();

      context.save();
      context.translate(885, 555);
      context.rotate(-.18);
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.roundRect(-180, -125, 360, 250, 28);
      context.fill();

      context.fillStyle = "#5b5bd6";
      context.beginPath();
      context.roundRect(-140, -78, 160, 16, 8);
      context.fill();

      context.fillStyle = "#dedff0";
      context.beginPath();
      context.roundRect(-140, -38, 250, 11, 6);
      context.fill();
      context.beginPath();
      context.roundRect(-140, -8, 210, 11, 6);
      context.fill();
      context.restore();

      context.fillStyle = "#ffffff";
      context.font = "700 74px Arial, sans-serif";
      context.fillText("Sua próxima ideia", 96, 270);
      context.fillText("começa com uma imagem.", 96, 356);

      context.fillStyle = "rgba(255, 255, 255, 0.72)";
      context.font = "400 26px Arial, sans-serif";
      context.fillText("Organize o visual. Compartilhe o resultado.", 101, 414);

      context.fillStyle = "#ffffff";
      context.beginPath();
      context.roundRect(101, 486, 204, 54, 12);
      context.fill();
      context.fillStyle = "#4c4f96";
      context.font = "700 19px Arial, sans-serif";
      context.fillText("PIXELDESK", 137, 521);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Não foi possível gerar a imagem."));
          return;
        }

        resolve(new File([blob], "pasteport-demo.png", {
          type: "image/png",
          lastModified: Date.now()
        }));
      }, "image/png");
    });
  }

  async function loadDemoImage() {
    uploadFeedback.textContent = "";

    try {
      const file = await createDemoFile();
      assignFileToMainInput(file);
    } catch (error) {
      uploadFeedback.textContent = "Não foi possível preparar a imagem de exemplo.";
    }
  }

  function setDragging(active) {
    dropzone.classList.toggle("is-dragging", active);
    dropInstruction.textContent = active
      ? "Solte a imagem aqui"
      : "Arraste uma imagem para esta área ou selecione um arquivo do computador";
  }

  function setMobileMenu(open) {
    document.body.classList.toggle("nav-open", open);
    mobileMenu.setAttribute("aria-expanded", String(open));
    mobileMenu.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  }

  topUploadButton.addEventListener("click", () => {
    topInput.click();
  });

  topInput.addEventListener("change", () => {
    showFile(topInput.files[0]);
  });

  mainInput.addEventListener("change", () => {
    showFile(mainInput.files[0]);
  });

  uploadLabel.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    mainInput.click();
  });

  dropzone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dragDepth += 1;
    setDragging(true);
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  });

  dropzone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      setDragging(false);
    }
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    setDragging(false);

    const file = Array.from(event.dataTransfer?.files || [])
      .find((candidate) => candidate.type.startsWith("image/"));

    if (!file) {
      uploadFeedback.textContent = "Solte um arquivo de imagem compatível.";
      return;
    }

    assignFileToMainInput(file);
  });

  mobileMenu.addEventListener("click", () => {
    setMobileMenu(!document.body.classList.contains("nav-open"));
  });

  mobileBackdrop.addEventListener("click", () => {
    setMobileMenu(false);
    mobileMenu.focus();
  });

  document.querySelector(".sidebar-nav").addEventListener("click", () => {
    setMobileMenu(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
      setMobileMenu(false);
      mobileMenu.focus();
    }
  });

  demoPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-demo-action]");
    if (!button) {
      return;
    }

    if (button.dataset.demoAction === "uploaded") {
      loadDemoImage();
      return;
    }

    restoreInitialState();
  });

  window.addEventListener("beforeunload", () => {
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
    }
  });

  const parameters = new URLSearchParams(location.search);
  if (parameters.get("screenshot") === "true") {
    document.body.classList.add("is-screenshot");
  }

  if (parameters.get("guide") === "true") {
    guideBanner.hidden = false;
  }

  if (parameters.get("state") === "uploaded") {
    loadDemoImage();
  }
})();
