(() => {
  "use strict";

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

  const NON_IMAGE_EXTENSIONS = new Set([
    ".7z",
    ".aac",
    ".avi",
    ".csv",
    ".doc",
    ".docx",
    ".flac",
    ".gz",
    ".json",
    ".m4a",
    ".mkv",
    ".mov",
    ".mp3",
    ".mp4",
    ".ogg",
    ".pdf",
    ".rar",
    ".tar",
    ".txt",
    ".wav",
    ".webm",
    ".xls",
    ".xlsx",
    ".xml",
    ".zip"
  ]);

  const UPLOAD_HINT = /(?:^|[\s_-])(upload|uploader|dropzone|drop-area|drop_area|file-picker|file_picker|file-input|file_input|image-picker|image_picker|attachment|media-upload|media_upload|avatar|photo|image)(?:$|[\s_-])/i;
  const TRIGGER_TEXT_HINT = /\b(upload|choose|select|attach|browse|image|photo|avatar|file|selecionar|escolher|anexar|imagem|foto|arquivo)\b/i;

  function isFileInput(element) {
    return element?.nodeType === Node.ELEMENT_NODE
      && element.localName === "input"
      && element.type === "file";
  }

  function parseAccept(input) {
    return (input.getAttribute("accept") || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }

  function getImageEligibility(input, settings = {}) {
    if (!isFileInput(input)) {
      return { eligible: false, reason: "not-file-input" };
    }

    const rules = parseAccept(input);
    if (!rules.length) {
      if (settings.onlyImageUploads === false) {
        return { eligible: true, ambiguous: true };
      }

      return { eligible: false, reason: "accept-missing" };
    }

    const acceptsImages = rules.some((rule) => {
      if (rule === "image/*" || rule.startsWith("image/")) {
        return true;
      }

      const extension = rule.startsWith(".") ? rule : `.${rule}`;
      return IMAGE_EXTENSIONS.has(extension);
    });

    if (acceptsImages) {
      return { eligible: true, ambiguous: false };
    }

    if (settings.onlyImageUploads === false) {
      const clearlyNonImage = rules.every((rule) => {
        if (/^(audio|video|text|font)\//.test(rule)) {
          return true;
        }

        if (rule === "application/pdf"
          || rule === "application/zip"
          || rule === "application/x-zip-compressed") {
          return true;
        }

        return rule.startsWith(".") && NON_IMAGE_EXTENSIONS.has(rule);
      });

      if (!clearlyNonImage) {
        return { eligible: true, ambiguous: true };
      }
    }

    return { eligible: false, reason: "accept-excludes-images" };
  }

  function uniqueEligibleInputs(inputs, settings) {
    return [...new Set(inputs)].filter((input) => getImageEligibility(input, settings).eligible);
  }

  function collectFileInputs(root, limit = 20) {
    if (!root || limit < 1) {
      return [];
    }

    const inputs = [];
    const visitedRoots = new Set();

    function visit(currentRoot) {
      if (!currentRoot || visitedRoots.has(currentRoot) || inputs.length >= limit) {
        return;
      }

      visitedRoots.add(currentRoot);

      if (isFileInput(currentRoot)) {
        inputs.push(currentRoot);
      }

      if (typeof currentRoot.querySelectorAll !== "function") {
        return;
      }

      for (const input of currentRoot.querySelectorAll('input[type="file"]')) {
        inputs.push(input);
        if (inputs.length >= limit) {
          return;
        }
      }

      for (const element of currentRoot.querySelectorAll("*")) {
        if (element.shadowRoot) {
          visit(element.shadowRoot);
        }

        if (inputs.length >= limit) {
          return;
        }
      }
    }

    visit(root);
    return inputs;
  }

  function findById(element, id) {
    if (!id) {
      return null;
    }

    const root = element.getRootNode?.();
    if (root && typeof root.getElementById === "function") {
      const match = root.getElementById(id);
      if (match) {
        return match;
      }
    }

    return element.ownerDocument?.getElementById(id) || null;
  }

  function inputFromLabel(label) {
    if (isFileInput(label.control)) {
      return label.control;
    }

    if (label.htmlFor) {
      const controlled = findById(label, label.htmlFor);
      if (isFileInput(controlled)) {
        return controlled;
      }
    }

    return collectFileInputs(label, 2)[0] || null;
  }

  function isEditableControl(element) {
    if (element.localName === "input") {
      return element.type !== "file";
    }

    return element.localName === "textarea"
      || element.localName === "select"
      || element.isContentEditable;
  }

  function isLayeredElement(element) {
    const style = element.ownerDocument?.defaultView?.getComputedStyle?.(element);
    if (!style || style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    return style.position === "absolute"
      || style.position === "fixed"
      || style.position === "sticky"
      || style.zIndex !== "auto";
  }

  function describedElementInputs(element) {
    const ids = [
      element.getAttribute("aria-controls"),
      element.getAttribute("aria-owns"),
      element.getAttribute("data-target"),
      element.getAttribute("data-for")
    ]
      .filter(Boolean)
      .flatMap((value) => value.replace(/^#/, "").split(/\s+/));

    const inputs = [];
    for (const id of ids) {
      const controlled = findById(element, id);
      if (isFileInput(controlled)) {
        inputs.push(controlled);
        continue;
      }

      inputs.push(...collectFileInputs(controlled, 4));
    }

    return inputs;
  }

  function hasUploadHint(element) {
    if (isEditableControl(element)) {
      return false;
    }

    const attributes = [
      element.id,
      element.className,
      element.getAttribute("name"),
      element.getAttribute("role"),
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid"),
      element.getAttribute("data-cy")
    ]
      .filter((value) => typeof value === "string")
      .join(" ");

    if (UPLOAD_HINT.test(` ${attributes} `)) {
      return true;
    }

    const isInteractive = element.localName === "button"
      || element.localName === "label"
      || element.getAttribute("role") === "button";

    if (!isInteractive) {
      return false;
    }

    return TRIGGER_TEXT_HINT.test((element.textContent || "").trim().slice(0, 160));
  }

  function blocksUploadAncestor(element, trigger = null) {
    if (isEditableControl(element)) {
      return true;
    }

    if (element.localName === "a" && element.href) {
      return !hasUploadHint(element);
    }

    if (element.localName === "button" || element.getAttribute("role") === "button") {
      return !hasUploadHint(element);
    }

    if (!trigger) {
      return false;
    }

    if (!trigger.contains(element)) {
      return true;
    }

    if (trigger.localName === "button"
      || trigger.localName === "label"
      || trigger.getAttribute("role") === "button") {
      return false;
    }

    if (hasUploadHint(element)) {
      return false;
    }

    return isLayeredElement(element);
  }

  function pointFromEvent(event, interaction) {
    if (Number.isFinite(event.clientX)
      && Number.isFinite(event.clientY)
      && (event.isTrusted || event.clientX !== 0 || event.clientY !== 0)) {
      return { x: event.clientX, y: event.clientY };
    }

    if (Number.isFinite(interaction?.point?.x) && Number.isFinite(interaction.point.y)) {
      return interaction.point;
    }

    return null;
  }

  function visualBlocker(event, trigger, interaction) {
    const point = pointFromEvent(event, interaction);
    const root = trigger.getRootNode?.();
    const elementsFromPoint = root?.elementsFromPoint
      || trigger.ownerDocument?.elementsFromPoint;

    if (!point || typeof elementsFromPoint !== "function") {
      return null;
    }

    const stackedElements = elementsFromPoint
      .call(root?.elementsFromPoint ? root : trigger.ownerDocument, point.x, point.y)
      .filter((element) => element?.nodeType === Node.ELEMENT_NODE);
    const triggerIndex = stackedElements.indexOf(trigger);
    if (triggerIndex < 1) {
      return null;
    }

    return stackedElements
      .slice(0, triggerIndex)
      .find((element) => blocksUploadAncestor(element, trigger)) || null;
  }

  function resultFromCandidates(candidates, source, settings) {
    const inputs = uniqueEligibleInputs(candidates, settings);

    if (inputs.length === 1) {
      return { input: inputs[0], source };
    }

    if (inputs.length > 1) {
      return { input: null, reason: "multiple-inputs", candidates: inputs };
    }

    return null;
  }

  function findAssociatedInput(event, settings = {}, interaction = null) {
    const path = typeof event.composedPath === "function"
      ? event.composedPath()
      : [event.target];

    const elements = path.filter((entry) => entry?.nodeType === Node.ELEMENT_NODE);

    for (const element of elements) {
      if (!isFileInput(element)) {
        continue;
      }

      if (!event.isTrusted && interaction) {
        const interactionPath = Array.isArray(interaction.path)
          ? interaction.path
          : [interaction.target].filter(Boolean);
        const interactionDetection = findAssociatedInput({
          isTrusted: true,
          target: interaction.target,
          clientX: interaction.point?.x ?? 0,
          clientY: interaction.point?.y ?? 0,
          composedPath: () => interactionPath
        }, settings);

        if (interactionDetection.input !== element) {
          return {
            input: null,
            reason: "blocked-by-interaction-target",
            target: interaction.target
          };
        }
      }

      if (getImageEligibility(element, settings).eligible) {
        return { input: element, source: "input" };
      }

      return { input: null, reason: "not-image-upload" };
    }

    for (const element of elements) {
      if (element.localName !== "label") {
        continue;
      }

      const input = inputFromLabel(element);
      if (!input) {
        continue;
      }

      if (getImageEligibility(input, settings).eligible) {
        return { input, source: "label" };
      }

      return { input: null, reason: "not-image-upload" };
    }

    for (const element of elements.slice(0, 6)) {
      const ariaResult = resultFromCandidates(describedElementInputs(element), "aria", settings);
      if (ariaResult) {
        return ariaResult;
      }
    }

    const trigger = elements.find(hasUploadHint);
    if (!trigger) {
      return { input: null, reason: "no-upload-trigger" };
    }

    const triggerIndex = elements.indexOf(trigger);
    const blocker = elements
      .slice(0, triggerIndex)
      .find((element) => blocksUploadAncestor(element, trigger));
    if (blocker) {
      return { input: null, reason: "blocked-by-interactive-element", blocker };
    }

    const layer = visualBlocker(event, trigger, interaction);
    if (layer) {
      return { input: null, reason: "blocked-by-visual-layer", blocker: layer };
    }

    let container = trigger;
    for (let depth = 0; container && depth < 3; depth += 1) {
      const containerResult = resultFromCandidates(
        collectFileInputs(container, 4),
        depth === 0 ? "container" : "shared-container",
        settings
      );

      if (containerResult?.input || containerResult?.reason === "multiple-inputs") {
        return containerResult;
      }

      container = container.parentElement;
    }

    const form = trigger.closest?.("form");
    if (form) {
      const formResult = resultFromCandidates(collectFileInputs(form, 4), "form", settings);
      if (formResult) {
        return formResult;
      }
    }

    return { input: null, reason: "no-associated-input" };
  }

  function discoverOpenShadowRoots(root, onRoot) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }

    for (const element of root.querySelectorAll("*")) {
      if (!element.shadowRoot) {
        continue;
      }

      onRoot(element.shadowRoot);
      discoverOpenShadowRoots(element.shadowRoot, onRoot);
    }
  }

  globalThis.__pastePortUploadDetector = Object.freeze({
    collectFileInputs,
    discoverOpenShadowRoots,
    findAssociatedInput,
    getImageEligibility,
    isFileInput
  });
})();
