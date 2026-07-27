(() => {
  "use strict";

  const DATABASE_NAME = "pasteport-clipboard-history";
  const STORE_NAME = "images";
  const HISTORY_LIMIT = 10;
  const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
  const POLL_INTERVAL_MS = 3000;
  const MIME_EXTENSIONS = Object.freeze({
    "image/avif": ".avif",
    "image/bmp": ".bmp",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp"
  });

  let databasePromise = null;
  let capturePromise = null;
  let lastClipboardFingerprint = null;
  let useLegacyPaste = false;
  let monitoringEnabled = false;

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function openDatabase() {
    if (databasePromise) {
      return databasePromise;
    }

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);

      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("hash", "hash", { unique: true });
        store.createIndex("createdAt", "createdAt");
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return databasePromise;
  }

  async function getAllRecords() {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll());
    await transactionDone(transaction);
    return records.sort((first, second) => second.createdAt - first.createdAt);
  }

  async function getRecord(id) {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const record = await requestResult(transaction.objectStore(STORE_NAME).get(id));
    await transactionDone(transaction);
    return record;
  }

  async function getRecordByHash(hash) {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const record = await requestResult(
      transaction.objectStore(STORE_NAME).index("hash").get(hash)
    );
    await transactionDone(transaction);
    return record;
  }

  async function saveRecord(record) {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    await transactionDone(transaction);

    const records = await getAllRecords();
    if (records.length <= HISTORY_LIMIT) {
      return;
    }

    const pruneTransaction = database.transaction(STORE_NAME, "readwrite");
    const store = pruneTransaction.objectStore(STORE_NAME);
    for (const expired of records.slice(HISTORY_LIMIT)) {
      store.delete(expired.id);
    }
    await transactionDone(pruneTransaction);
  }

  async function removeRecord(id) {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    await transactionDone(transaction);
  }

  async function clearRecords() {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    await transactionDone(transaction);
  }

  function dataUrlFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function hashBuffer(buffer) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function timestamp(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
      String(date.getSeconds()).padStart(2, "0")
    ].join("-");
  }

  async function createThumbnail(blob) {
    try {
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, 260 / bitmap.width, 150 / bitmap.height);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
      bitmap.close();

      const thumbnailBlob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/webp", 0.82);
      });

      return {
        thumbnail: thumbnailBlob ? await dataUrlFromBlob(thumbnailBlob) : "",
        width,
        height
      };
    } catch (error) {
      return {
        thumbnail: "",
        width: 0,
        height: 0
      };
    }
  }

  function readClipboardWithPasteEvent() {
    return new Promise((resolve, reject) => {
      const sink = document.createElement("div");
      sink.contentEditable = "true";
      sink.tabIndex = -1;
      document.body.append(sink);

      let settled = false;
      const timeout = setTimeout(() => {
        finish(new Error("Tempo esgotado ao ler a área de transferência."));
      }, 500);

      function finish(error, blobs = []) {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        document.removeEventListener("paste", onPaste, true);
        sink.remove();

        if (error) {
          reject(error);
          return;
        }

        resolve(blobs);
      }

      function onPaste(event) {
        event.preventDefault();
        const blobs = [];

        for (const item of event.clipboardData?.items || []) {
          if (item.kind !== "file" || !item.type.startsWith("image/")) {
            continue;
          }

          const blob = item.getAsFile();
          if (blob) {
            blobs.push(blob);
          }
        }

        finish(null, blobs);
      }

      document.addEventListener("paste", onPaste, true);
      sink.focus();

      try {
        if (!document.execCommand("paste")) {
          finish(new Error("O navegador bloqueou a leitura da área de transferência."));
        }
      } catch (error) {
        finish(error);
      }
    });
  }

  async function readClipboardImages() {
    if (!useLegacyPaste) {
      try {
        const clipboardItems = await navigator.clipboard.read();
        const blobs = [];

        for (const clipboardItem of clipboardItems) {
          const type = clipboardItem.types.find((candidate) => candidate.startsWith("image/"));
          if (type) {
            blobs.push(await clipboardItem.getType(type));
          }
        }

        return blobs;
      } catch (error) {
        useLegacyPaste = true;
      }
    }

    return readClipboardWithPasteEvent();
  }

  async function captureClipboard() {
    if (!monitoringEnabled) {
      return;
    }

    if (capturePromise) {
      return capturePromise;
    }

    capturePromise = (async () => {
      const images = [];
      const blobs = await readClipboardImages();

      if (!monitoringEnabled) {
        return;
      }

      for (const blob of blobs) {
        if (blob.size > MAX_IMAGE_BYTES) {
          continue;
        }

        const buffer = await blob.arrayBuffer();
        images.push({
          blob,
          buffer,
          hash: await hashBuffer(buffer),
          type: blob.type
        });
      }

      if (!images.length) {
        lastClipboardFingerprint = "no-image";
        return;
      }

      const fingerprint = images.map((image) => image.hash).join("|");
      if (fingerprint === lastClipboardFingerprint) {
        return;
      }

      lastClipboardFingerprint = fingerprint;

      for (const image of images) {
        const existing = await getRecordByHash(image.hash);
        if (existing) {
          existing.createdAt = Date.now();
          await saveRecord(existing);
          continue;
        }

        const now = new Date();
        const preview = await createThumbnail(image.blob);
        await saveRecord({
          id: crypto.randomUUID(),
          hash: image.hash,
          name: `pasteport-${timestamp(now)}${MIME_EXTENSIONS[image.type] || ".img"}`,
          type: image.type,
          size: image.blob.size,
          width: preview.width,
          height: preview.height,
          thumbnail: preview.thumbnail,
          blob: image.blob,
          createdAt: now.getTime()
        });
      }
    })();

    try {
      await capturePromise;
    } finally {
      capturePromise = null;
    }
  }

  async function historyList() {
    return (await getAllRecords()).slice(0, HISTORY_LIMIT).map((record) => ({
      id: record.id,
      name: record.name,
      type: record.type,
      size: record.size,
      width: record.width,
      height: record.height,
      thumbnail: record.thumbnail,
      createdAt: record.createdAt
    }));
  }

  async function onRuntimeMessageCallback(message) {
    if (message.type === "monitor:set") {
      monitoringEnabled = message.enabled !== false;
      if (monitoringEnabled) {
        await captureClipboard();
      }

      return { success: true };
    }

    if (message.type === "history:list") {
      let warning = "";
      try {
        await captureClipboard();
      } catch (error) {
        warning = "Não foi possível ler o item atual da área de transferência.";
      }

      return {
        success: true,
        items: await historyList(),
        warning
      };
    }

    if (message.type === "history:get") {
      const record = await getRecord(message.id);
      if (!record) {
        return {
          success: false,
          message: "Esta imagem não está mais no histórico."
        };
      }

      return {
        success: true,
        item: {
          id: record.id,
          name: record.name,
          type: record.type,
          dataUrl: await dataUrlFromBlob(record.blob)
        }
      };
    }

    if (message.type === "history:remove") {
      await removeRecord(message.id);
      return {
        success: true,
        items: await historyList()
      };
    }

    if (message.type === "history:clear") {
      await clearRecords();
      return {
        success: true,
        items: []
      };
    }

    return {
      success: false,
      message: "Operação de histórico desconhecida."
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.target !== "pasteport-offscreen") {
      return false;
    }

    onRuntimeMessageCallback(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          success: false,
          message: error.message || "Não foi possível acessar o histórico local."
        });
      });

    return true;
  });

  setInterval(() => {
    captureClipboard().catch(() => {});
  }, POLL_INTERVAL_MS);
})();
