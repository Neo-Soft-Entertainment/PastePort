(() => {
  "use strict";

  const MIME_EXTENSIONS = Object.freeze({
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/svg+xml": ".svg",
    "image/avif": ".avif"
  });

  const IMAGE_EXTENSIONS = new Set([
    ".avif",
    ".bmp",
    ".gif",
    ".heic",
    ".heif",
    ".jfif",
    ".jpeg",
    ".jpg",
    ".png",
    ".svg",
    ".tif",
    ".tiff",
    ".webp"
  ]);

  const FORMAT_NAMES = Object.freeze({
    ".avif": "AVIF",
    ".bmp": "BMP",
    ".gif": "GIF",
    ".heic": "HEIC",
    ".heif": "HEIF",
    ".jfif": "JPEG",
    ".jpeg": "JPEG",
    ".jpg": "JPEG",
    ".png": "PNG",
    ".svg": "SVG",
    ".tif": "TIFF",
    ".tiff": "TIFF",
    ".webp": "WebP",
    "image/avif": "AVIF",
    "image/bmp": "BMP",
    "image/gif": "GIF",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/svg+xml": "SVG",
    "image/webp": "WebP"
  });

  function extensionFromName(name) {
    const match = String(name || "").toLowerCase().match(/\.[a-z0-9]+$/);
    return match?.[0] || "";
  }

  function isImageFile(file) {
    if (!file) {
      return false;
    }

    if (String(file.type || "").toLowerCase().startsWith("image/")) {
      return true;
    }

    return IMAGE_EXTENSIONS.has(extensionFromName(file.name));
  }

  function parseAccept(input) {
    return (input.getAttribute("accept") || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }

  function acceptsFile(input, file) {
    const rules = parseAccept(input);
    if (!rules.length) {
      return true;
    }

    const type = String(file.type || "").toLowerCase();
    const extension = extensionFromName(file.name);

    return rules.some((rule) => {
      if (rule === "image/*") {
        return type.startsWith("image/") || IMAGE_EXTENSIONS.has(extension);
      }

      if (rule.endsWith("/*")) {
        return Boolean(type) && type.startsWith(rule.slice(0, -1));
      }

      if (rule.startsWith(".")) {
        return extension === rule;
      }

      return Boolean(type) && type === rule;
    });
  }

  function formatName(file) {
    const type = String(file?.type || "").toLowerCase();
    return FORMAT_NAMES[type]
      || FORMAT_NAMES[extensionFromName(file?.name)]
      || type.replace(/^image\//, "").toUpperCase()
      || "desconhecido";
  }

  function acceptedFormats(input) {
    const names = parseAccept(input)
      .filter((rule) => rule === "image/*" || rule.startsWith("image/") || rule.startsWith("."))
      .map((rule) => {
        if (rule === "image/*") {
          return "qualquer imagem";
        }

        return FORMAT_NAMES[rule] || rule.replace(/^image\//, "").toUpperCase();
      });

    return [...new Set(names)];
  }

  function acceptError(input, file) {
    const formats = acceptedFormats(input);
    const suffix = formats.length
      ? ` Formatos aceitos: ${new Intl.ListFormat("pt-BR", { type: "conjunction" }).format(formats)}.`
      : "";

    return `Este campo não aceita imagens do tipo ${formatName(file)}.${suffix}`;
  }

  function inputError(input) {
    if (!input?.isConnected) {
      return {
        success: false,
        code: "input-removed",
        message: "O campo de upload foi removido da página. Tente abrir o upload novamente."
      };
    }

    if (input.disabled) {
      return {
        success: false,
        code: "input-disabled",
        message: "Este campo de upload está desabilitado."
      };
    }

    if (input.localName !== "input" || input.type !== "file") {
      return {
        success: false,
        code: "invalid-input",
        message: "O campo de upload original não está mais disponível."
      };
    }

    return null;
  }

  function assignFilesToInput(input, files, settings = {}) {
    const invalidInput = inputError(input);
    if (invalidInput) {
      return invalidInput;
    }

    if (typeof DataTransfer !== "function") {
      return {
        success: false,
        code: "data-transfer-unsupported",
        message: "Este navegador não oferece suporte à inserção de arquivos pelo PastePort."
      };
    }

    const rejected = [];
    const valid = [];

    for (const file of Array.from(files || [])) {
      if (!isImageFile(file)) {
        rejected.push({
          file,
          code: "not-image",
          message: `"${file?.name || "Arquivo"}" não é uma imagem reconhecida.`
        });
        continue;
      }

      if (!acceptsFile(input, file)) {
        rejected.push({
          file,
          code: "accept-rejected",
          message: acceptError(input, file)
        });
        continue;
      }

      valid.push(file);
    }

    if (!valid.length) {
      return {
        success: false,
        code: rejected[0]?.code || "no-valid-files",
        message: rejected[0]?.message || "Nenhuma imagem válida foi encontrada.",
        rejected
      };
    }

    const maxFiles = Math.max(1, Number.parseInt(settings.maxFiles, 10) || 10);
    const existingFiles = input.multiple && settings.combineExistingFiles
      ? Array.from(input.files || [])
      : [];
    const availableSlots = input.multiple
      ? Math.max(0, maxFiles - existingFiles.length)
      : 1;
    const selected = valid.slice(0, availableSlots);
    const ignored = valid.slice(selected.length).map((file) => ({
      file,
      code: input.multiple ? "limit-exceeded" : "multiple-not-supported",
      message: input.multiple
        ? `O limite de ${maxFiles} arquivos foi atingido.`
        : "Este campo aceita somente um arquivo."
    }));

    if (!selected.length) {
      return {
        success: false,
        code: "limit-exceeded",
        message: `O limite de ${maxFiles} arquivos já foi atingido.`,
        rejected,
        ignored
      };
    }

    const finalFiles = [...existingFiles, ...selected];

    let dataTransfer;
    try {
      dataTransfer = new DataTransfer();
      for (const file of finalFiles) {
        dataTransfer.items.add(file);
      }
      input.files = dataTransfer.files;
    } catch (error) {
      return {
        success: false,
        code: "assignment-blocked",
        message: "O site ou o navegador bloqueou a inserção dos arquivos.",
        error
      };
    }

    if (input.files.length !== finalFiles.length) {
      return {
        success: false,
        code: "assignment-blocked",
        message: "O site não aceitou os arquivos inseridos pelo PastePort."
      };
    }

    input.dispatchEvent(new Event("input", {
      bubbles: true,
      composed: true
    }));

    input.dispatchEvent(new Event("change", {
      bubbles: true,
      composed: true
    }));

    return {
      success: true,
      code: "files-assigned",
      message: selected.length === 1
        ? "Imagem adicionada com sucesso."
        : `${selected.length} imagens adicionadas com sucesso.`,
      files: finalFiles,
      added: selected,
      rejected,
      ignored
    };
  }

  function timestamp() {
    const now = new Date();
    const parts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ];

    return `${parts.slice(0, 3).join("-")}-${parts.slice(3).join("-")}`;
  }

  function safeBaseName(value) {
    return String(value || "pasteport")
      .trim()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "pasteport";
  }

  async function sniffImageExtension(blob) {
    const bytes = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
    const ascii = String.fromCharCode(...bytes);

    if (bytes.length >= 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4e
      && bytes[3] === 0x47
      && bytes[4] === 0x0d
      && bytes[5] === 0x0a
      && bytes[6] === 0x1a
      && bytes[7] === 0x0a) {
      return ".png";
    }

    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return ".jpg";
    }

    if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) {
      return ".gif";
    }

    if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") {
      return ".webp";
    }

    if (ascii.startsWith("BM")) {
      return ".bmp";
    }

    if (ascii.slice(4, 8) === "ftyp" && /avif|avis/.test(ascii.slice(8, 16))) {
      return ".avif";
    }

    const text = await blob.slice(0, 512).text();
    if (/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text.replace(/^\uFEFF/, ""))) {
      return ".svg";
    }

    return "";
  }

  async function createPastedFile(blob, baseName = "pasteport", index = 0) {
    const originalType = String(blob?.type || "").toLowerCase();
    let extension = MIME_EXTENSIONS[originalType] || "";

    if (!extension) {
      extension = await sniffImageExtension(blob);
    }

    if (!extension) {
      return {
        success: false,
        code: "unknown-image-type",
        message: `O formato ${formatName(blob)} não pôde ser identificado com segurança.`
      };
    }

    const suffix = index > 0 ? `-${index + 1}` : "";
    const file = new File(
      [blob],
      `${safeBaseName(baseName)}-${timestamp()}${suffix}${extension}`,
      {
        type: blob.type,
        lastModified: Date.now()
      }
    );

    return { success: true, file };
  }

  globalThis.__pastePortFileInjector = Object.freeze({
    acceptError,
    acceptsFile,
    assignFilesToInput,
    createPastedFile,
    isImageFile
  });
})();
