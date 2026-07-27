import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pngjs from "pngjs";

const { PNG } = pngjs;
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const OUTPUT_DIRECTORY = path.resolve(PROJECT_ROOT, "store-assets");
const VIEWPORT = Object.freeze({ width: 1280, height: 800 });
const EXTENSION_DIRECTORY_NAMES = [
  "pasteport",
  "extension",
  "chrome-extension"
];
const SITE_DIRECTORY_NAMES = [
  "pixeldesk-demo",
  "demo",
  "website"
];
const SCREENSHOTS = Object.freeze({
  modal: path.resolve(OUTPUT_DIRECTORY, "screenshot-01-paste-modal.png"),
  success: path.resolve(OUTPUT_DIRECTORY, "screenshot-02-upload-success.png"),
  workflow: path.resolve(OUTPUT_DIRECTORY, "screenshot-03-workflow.png")
});
const CAPTURE_CSS = `
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }

  html,
  body {
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
  }

  .main-content {
    scrollbar-width: none !important;
  }

  .main-content::-webkit-scrollbar {
    display: none !important;
  }

  :focus {
    outline: none !important;
  }
`;
const SHADOW_CAPTURE_CSS = `
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }

  :focus,
  :focus-visible {
    outline: none !important;
  }

  .pp-dialog {
    scrollbar-width: none !important;
  }

  .pp-dialog::-webkit-scrollbar,
  .pp-history-list::-webkit-scrollbar {
    display: none !important;
  }
`;

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findDirectoriesContaining(fileName, preferredNames) {
  const matches = [];
  const visited = new Set();
  const ignored = new Set([
    ".git",
    "node_modules",
    "store-assets"
  ]);

  async function visit(directory, depth) {
    const resolvedDirectory = path.resolve(directory);
    if (visited.has(resolvedDirectory) || depth > 4) {
      return;
    }

    visited.add(resolvedDirectory);
    if (await pathExists(path.resolve(resolvedDirectory, fileName))) {
      matches.push(resolvedDirectory);
    }

    const entries = await fs.readdir(resolvedDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || ignored.has(entry.name)) {
        continue;
      }

      await visit(path.resolve(resolvedDirectory, entry.name), depth + 1);
    }
  }

  for (const preferredName of preferredNames) {
    const preferredDirectory = path.resolve(PROJECT_ROOT, preferredName);
    if (await pathExists(preferredDirectory)) {
      await visit(preferredDirectory, 0);
    }
  }

  await visit(PROJECT_ROOT, 0);
  const uniqueMatches = [...new Set(matches)];
  uniqueMatches.sort((left, right) => {
    const leftRank = preferredNames.indexOf(path.basename(left));
    const rightRank = preferredNames.indexOf(path.basename(right));
    const normalizedLeftRank = leftRank === -1 ? preferredNames.length : leftRank;
    const normalizedRightRank = rightRank === -1 ? preferredNames.length : rightRank;
    return normalizedLeftRank - normalizedRightRank || left.length - right.length;
  });
  return uniqueMatches;
}

async function discoverProjectPaths() {
  const extensionCandidates = await findDirectoriesContaining(
    "manifest.json",
    EXTENSION_DIRECTORY_NAMES
  );
  const siteCandidates = await findDirectoriesContaining(
    "index.html",
    SITE_DIRECTORY_NAMES
  );

  if (!extensionCandidates.length) {
    throw new Error("Nenhuma pasta de extensão com manifest.json foi encontrada.");
  }

  if (!siteCandidates.length) {
    throw new Error("Nenhum site com index.html foi encontrado.");
  }

  const extensionDirectory = path.resolve(extensionCandidates[0]);
  const siteDirectory = path.resolve(siteCandidates[0]);
  const manifestPath = path.resolve(extensionDirectory, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

  if (manifest.manifest_version !== 3) {
    throw new Error(`O manifesto encontrado não usa Manifest V3: ${manifestPath}`);
  }

  console.log(`Extensão: ${extensionDirectory}`);
  console.log(`Manifesto: ${manifestPath}`);
  console.log(`Site PixelDesk: ${siteDirectory}`);

  if (extensionCandidates.length > 1) {
    console.log(`Outras extensões encontradas: ${extensionCandidates.slice(1).join(", ")}`);
  }

  if (siteCandidates.length > 1) {
    console.log(`Outros sites encontrados: ${siteCandidates.slice(1).join(", ")}`);
  }

  return { extensionDirectory, siteDirectory };
}

function contentType(filePath) {
  const types = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml; charset=utf-8",
    ".webp": "image/webp"
  };
  return types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function startSiteServer(siteDirectory) {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      if (requestUrl.pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }

      const requestedPath = decodeURIComponent(requestUrl.pathname)
        .replace(/^\/+/, "") || "index.html";
      const filePath = path.resolve(siteDirectory, requestedPath);
      const relativePath = path.relative(siteDirectory, filePath);

      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Acesso negado.");
        return;
      }

      const file = await fs.readFile(filePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": file.length,
        "Content-Type": contentType(filePath)
      });
      response.end(file);
    } catch (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end(error.code === "ENOENT" ? "Arquivo não encontrado." : "Erro interno.");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Não foi possível determinar a porta do servidor local.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`PixelDesk: ${baseUrl}/index.html`);
  return { server, baseUrl };
}

function collectPageDiagnostics(page, label) {
  const diagnostics = {
    label,
    console: [],
    errors: [],
    failedRequests: []
  };

  page.on("console", (message) => {
    diagnostics.console.push(`[${message.type()}] ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    diagnostics.errors.push(error.stack || error.message);
  });
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push(
      `${request.method()} ${request.url()} — ${request.failure()?.errorText || "falha desconhecida"}`
    );
  });
  return diagnostics;
}

function printDiagnostics(diagnostics, serviceWorkerDiagnostics) {
  console.error(`\nDiagnóstico da página: ${diagnostics.label}`);
  console.error("Console:", diagnostics.console.length ? diagnostics.console.join("\n") : "sem mensagens");
  console.error("Erros:", diagnostics.errors.length ? diagnostics.errors.join("\n") : "sem erros");
  console.error(
    "Requisições com falha:",
    diagnostics.failedRequests.length ? diagnostics.failedRequests.join("\n") : "nenhuma"
  );
  console.error(
    "Service worker:",
    serviceWorkerDiagnostics.length ? serviceWorkerDiagnostics.join("\n") : "sem mensagens"
  );
}

async function waitForStableLayout(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => {
        if (image.complete) {
          return image.decode?.().catch(() => {});
        }

        return new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      })
    );
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  });
}

async function preparePixelDeskPage(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: CAPTURE_CSS });
  await page.waitForFunction(() => document.body.classList.contains("is-screenshot"));
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const mainContent = document.querySelector(".main-content");
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
  });
  await waitForStableLayout(page);
}

async function assertCleanPixelDeskPage(page) {
  const state = await page.evaluate(() => {
    const mainContent = document.querySelector(".main-content");
    const demoPanel = document.querySelector("#demo-panel");
    const uploadCard = document.querySelector(".upload-card");
    const uploadRect = uploadCard?.getBoundingClientRect();
    return {
      bodyHeight: document.body.scrollHeight,
      bodyWidth: document.body.scrollWidth,
      demoHidden: demoPanel ? getComputedStyle(demoPanel).display === "none" : true,
      documentHeight: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      mainClientHeight: mainContent?.clientHeight || 0,
      mainScrollHeight: mainContent?.scrollHeight || 0,
      uploadVisible: Boolean(
        uploadRect
        && uploadRect.bottom > 0
        && uploadRect.top < innerHeight
        && uploadRect.right > 0
        && uploadRect.left < innerWidth
      ),
      viewportHeight: innerHeight,
      viewportWidth: innerWidth
    };
  });

  if (state.viewportWidth !== VIEWPORT.width || state.viewportHeight !== VIEWPORT.height) {
    throw new Error(
      `Viewport incorreta: ${state.viewportWidth} × ${state.viewportHeight}.`
    );
  }

  if (!state.demoHidden) {
    throw new Error("O painel de demonstração está visível no modo screenshot.");
  }

  if (!state.uploadVisible) {
    throw new Error("A área principal de upload não está visível.");
  }

  if (state.documentWidth > state.viewportWidth || state.bodyWidth > state.viewportWidth) {
    throw new Error("A página possui rolagem horizontal.");
  }

  if (state.documentHeight > state.viewportHeight || state.bodyHeight > state.viewportHeight) {
    throw new Error("A página possui rolagem vertical externa.");
  }

  if (state.mainScrollHeight > state.mainClientHeight + 1) {
    throw new Error("O conteúdo principal exige rolagem em 1280 × 800.");
  }
}

async function openPastePortModal(page) {
  const selectors = [
    "#main-dropzone .upload-label",
    "#top-upload-button",
    "#main-image-upload"
  ];
  const foundSelectors = [];

  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    if (count) {
      foundSelectors.push(`${selector} (${count})`);
    }
  }

  console.log(`Seletores de upload encontrados: ${foundSelectors.join(", ") || "nenhum"}`);
  const uploadLabel = page.locator("#main-dropzone .upload-label");
  if (await uploadLabel.count() !== 1) {
    throw new Error("O label principal de upload não foi encontrado de forma inequívoca.");
  }

  await uploadLabel.click({
    position: { x: 260, y: 96 }
  });
  const host = page.locator("#pasteport-extension-root");
  await host.waitFor({ state: "attached", timeout: 10000 });
  await page.waitForFunction(() => {
    const shadowRoot = document.querySelector("#pasteport-extension-root")?.shadowRoot;
    const bubble = shadowRoot?.querySelector(".pp-bubble");
    return Boolean(bubble?.classList.contains("is-positioned"));
  });
  await page.waitForFunction(() => {
    const shadowRoot = document.querySelector("#pasteport-extension-root")?.shadowRoot;
    const loading = shadowRoot?.querySelector(".pp-history-loading");
    return Boolean(!loading || loading.hidden || loading.textContent.includes("Não foi possível"));
  });

  const historyItems = await page.evaluate(() => {
    const shadowRoot = document.querySelector("#pasteport-extension-root")?.shadowRoot;
    return shadowRoot?.querySelectorAll(".pp-history-card").length || 0;
  });

  if (historyItems > 0) {
    const clearButton = page.locator(".pp-clear-history");
    if (await clearButton.count() !== 1) {
      throw new Error("O histórico contém imagens, mas o botão Limpar não foi encontrado.");
    }

    await clearButton.click();
    await clearButton.click();
    await page.waitForFunction(() => {
      const shadowRoot = document.querySelector("#pasteport-extension-root")?.shadowRoot;
      return (shadowRoot?.querySelectorAll(".pp-history-card").length || 0) === 0;
    });
  }

  const modalState = await page.evaluate((shadowCaptureCss) => {
    const hostElement = document.querySelector("#pasteport-extension-root");
    const shadowRoot = hostElement?.shadowRoot;
    const dialog = shadowRoot?.querySelector(".pp-dialog");
    const overlay = shadowRoot?.querySelector(".pp-overlay");
    const uploadCard = document.querySelector(".upload-card");
    if (!shadowRoot || !dialog || !overlay || !uploadCard) {
      return null;
    }

    const captureStyle = document.createElement("style");
    captureStyle.dataset.storeCapture = "";
    captureStyle.textContent = shadowCaptureCss;
    shadowRoot.append(captureStyle);
    shadowRoot.activeElement?.blur?.();
    document.activeElement?.blur?.();

    const dialogRect = dialog.getBoundingClientRect();
    const uploadRect = uploadCard.getBoundingClientRect();
    const text = dialog.textContent.replace(/\s+/g, " ").trim();
    return {
      dialog: {
        bottom: dialogRect.bottom,
        centerX: dialogRect.left + dialogRect.width / 2,
        centerY: dialogRect.top + dialogRect.height / 2,
        height: dialogRect.height,
        left: dialogRect.left,
        right: dialogRect.right,
        top: dialogRect.top,
        width: dialogRect.width
      },
      hasAddImage: text.includes("Adicionar imagem"),
      hasComputerButton: text.includes("Selecionar do computador"),
      hasCtrlV: text.includes("Ctrl") && text.includes("V"),
      hasPasteInstruction: text.includes("Cole") || text.includes("colar"),
      overlayCoversViewport:
        overlay.getBoundingClientRect().width === innerWidth
        && overlay.getBoundingClientRect().height === innerHeight,
      uploadBehindVisible:
        uploadRect.bottom > 0
        && uploadRect.top < innerHeight
        && uploadRect.right > 0
        && uploadRect.left < innerWidth
    };
  }, SHADOW_CAPTURE_CSS);

  if (!modalState) {
    throw new Error("O Shadow DOM do modal PastePort não pôde ser inspecionado.");
  }

  if (
    !modalState.hasAddImage
    || !modalState.hasComputerButton
    || !modalState.hasCtrlV
    || !modalState.hasPasteInstruction
  ) {
    throw new Error(`Conteúdo obrigatório ausente no modal: ${JSON.stringify(modalState)}`);
  }

  if (!modalState.overlayCoversViewport || !modalState.uploadBehindVisible) {
    throw new Error("O overlay ou a área de upload ao fundo não estão visíveis corretamente.");
  }

  const dialog = modalState.dialog;
  if (
    dialog.left < 0
    || dialog.top < 0
    || dialog.right > VIEWPORT.width
    || dialog.bottom > VIEWPORT.height
  ) {
    throw new Error(`O modal está cortado: ${JSON.stringify(dialog)}`);
  }

  if (Math.abs(dialog.centerX - VIEWPORT.width / 2) > 180) {
    throw new Error(`O modal está distante do centro horizontal: ${JSON.stringify(dialog)}`);
  }

  console.log(
    `Modal PastePort: ${Math.round(dialog.width)} × ${Math.round(dialog.height)}`
    + ` em (${Math.round(dialog.left)}, ${Math.round(dialog.top)})`
  );
  await waitForStableLayout(page);
}

async function captureModalScreenshot(context, baseUrl, outputPath, serviceWorkerDiagnostics) {
  const page = await context.newPage();
  const diagnostics = collectPageDiagnostics(page, "screenshot-01-paste-modal");

  try {
    const url = `${baseUrl}/index.html?screenshot=true&state=initial`;
    await preparePixelDeskPage(page, url);
    await assertCleanPixelDeskPage(page);
    await openPastePortModal(page);
    await page.screenshot({
      path: outputPath,
      type: "png",
      fullPage: false
    });
  } catch (error) {
    printDiagnostics(diagnostics, serviceWorkerDiagnostics);
    throw error;
  } finally {
    await page.close();
  }
}

async function captureSuccessScreenshot(context, baseUrl, outputPath, serviceWorkerDiagnostics) {
  const page = await context.newPage();
  const diagnostics = collectPageDiagnostics(page, "screenshot-02-upload-success");

  try {
    const url = `${baseUrl}/index.html?screenshot=true&state=uploaded`;
    await preparePixelDeskPage(page, url);
    await page.waitForFunction(() => {
      const name = document.querySelector("#uploaded-filename")?.textContent;
      const result = document.querySelector("#upload-result");
      const firstRecentName = document.querySelector("#asset-grid .asset-card strong")?.textContent;
      return name === "pasteport-demo.png"
        && result
        && !result.hidden
        && firstRecentName === "pasteport-demo.png";
    });
    await waitForStableLayout(page);
    await assertCleanPixelDeskPage(page);

    const successState = await page.evaluate(() => ({
      filename: document.querySelector("#uploaded-filename")?.textContent,
      hasPreview: Boolean(document.querySelector("#uploaded-image")?.getAttribute("src")),
      hasSuccess: document.querySelector("#upload-result")?.textContent.includes("Upload concluído"),
      recentName: document.querySelector("#asset-grid .asset-card strong")?.textContent
    }));

    if (
      successState.filename !== "pasteport-demo.png"
      || !successState.hasPreview
      || !successState.hasSuccess
      || successState.recentName !== "pasteport-demo.png"
    ) {
      throw new Error(`Estado de upload incompleto: ${JSON.stringify(successState)}`);
    }

    await page.screenshot({
      path: outputPath,
      type: "png",
      fullPage: false
    });
  } catch (error) {
    printDiagnostics(diagnostics, serviceWorkerDiagnostics);
    throw error;
  } finally {
    await page.close();
  }
}

async function captureWorkflowScreenshot(context, baseUrl, outputPath, serviceWorkerDiagnostics) {
  const page = await context.newPage();
  const diagnostics = collectPageDiagnostics(page, "screenshot-03-workflow");

  try {
    const url = `${baseUrl}/index.html?screenshot=true&state=initial&guide=true`;
    await preparePixelDeskPage(page, url);
    await page.waitForFunction(() => {
      const guide = document.querySelector("#guide-banner");
      const text = guide?.textContent.replace(/\s+/g, " ") || "";
      return guide
        && !guide.hidden
        && text.includes("Copie uma imagem")
        && text.includes("Clique em Adicionar imagem")
        && text.includes("Pressione Ctrl + V");
    });
    await assertCleanPixelDeskPage(page);

    if (await page.locator("#pasteport-extension-root").count()) {
      throw new Error("O modal PastePort não deveria estar aberto no screenshot de fluxo.");
    }

    await page.screenshot({
      path: outputPath,
      type: "png",
      fullPage: false
    });
  } catch (error) {
    printDiagnostics(diagnostics, serviceWorkerDiagnostics);
    throw error;
  } finally {
    await page.close();
  }
}

async function normalizeAndValidatePng(filePath) {
  const source = await fs.readFile(filePath);
  const png = PNG.sync.read(source);

  for (let offset = 0; offset < png.data.length; offset += 4) {
    const alpha = png.data[offset + 3] / 255;
    if (alpha < 1) {
      png.data[offset] = Math.round(png.data[offset] * alpha + 255 * (1 - alpha));
      png.data[offset + 1] = Math.round(png.data[offset + 1] * alpha + 255 * (1 - alpha));
      png.data[offset + 2] = Math.round(png.data[offset + 2] * alpha + 255 * (1 - alpha));
      png.data[offset + 3] = 255;
    }
  }

  const rgbBuffer = PNG.sync.write(png, {
    bitDepth: 8,
    colorType: 2,
    inputColorType: 6,
    inputHasAlpha: true
  });
  await fs.writeFile(filePath, rgbBuffer);

  const normalizedBuffer = await fs.readFile(filePath);
  const normalized = PNG.sync.read(normalizedBuffer);
  const statistics = await fs.stat(filePath);
  let allWhite = true;
  let allBlack = true;
  let effectiveAlpha = false;

  for (let offset = 0; offset < normalized.data.length; offset += 4) {
    const red = normalized.data[offset];
    const green = normalized.data[offset + 1];
    const blue = normalized.data[offset + 2];
    const alpha = normalized.data[offset + 3];
    allWhite &&= red === 255 && green === 255 && blue === 255;
    allBlack &&= red === 0 && green === 0 && blue === 0;
    effectiveAlpha ||= alpha !== 255;
  }

  if (normalized.width !== VIEWPORT.width || normalized.height !== VIEWPORT.height) {
    throw new Error(
      `${path.basename(filePath)} possui ${normalized.width} × ${normalized.height}.`
    );
  }

  if (normalized.colorType !== 2 || normalized.depth !== 8 || effectiveAlpha) {
    throw new Error(
      `${path.basename(filePath)} não é um PNG RGB de 24 bits sem transparência.`
    );
  }

  if (statistics.size <= 50 * 1024) {
    throw new Error(`${path.basename(filePath)} possui apenas ${statistics.size} bytes.`);
  }

  if (allWhite || allBlack) {
    throw new Error(`${path.basename(filePath)} está totalmente ${allWhite ? "branco" : "preto"}.`);
  }

  return {
    filePath,
    width: normalized.width,
    height: normalized.height,
    colorType: normalized.colorType,
    depth: normalized.depth,
    bytes: statistics.size,
    hash: createHash("sha256").update(normalizedBuffer).digest("hex")
  };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
}

async function main() {
  let browserContext = null;
  let server = null;
  let profileDirectory = null;
  const serviceWorkerDiagnostics = [];

  try {
    const { extensionDirectory, siteDirectory } = await discoverProjectPaths();
    await fs.mkdir(OUTPUT_DIRECTORY, { recursive: true });
    await Promise.all(
      Object.values(SCREENSHOTS).map((filePath) => fs.rm(filePath, { force: true }))
    );

    const localSite = await startSiteServer(siteDirectory);
    server = localSite.server;
    profileDirectory = await fs.mkdtemp(path.resolve(os.tmpdir(), "pasteport-store-"));

    browserContext = await chromium.launchPersistentContext(profileDirectory, {
      headless: false,
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      args: [
        `--disable-extensions-except=${extensionDirectory}`,
        `--load-extension=${extensionDirectory}`,
        "--no-default-browser-check",
        "--no-first-run",
        "--window-position=-10000,-10000"
      ]
    });
    browserContext.on("console", (message) => {
      const location = message.location();
      if (location.url.startsWith("chrome-extension://")) {
        serviceWorkerDiagnostics.push(
          `[${message.type()}] ${message.text()} (${location.url})`
        );
      }
    });
    browserContext.on("weberror", (webError) => {
      serviceWorkerDiagnostics.push(webError.error().stack || webError.error().message);
    });

    let serviceWorker = browserContext.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await browserContext.waitForEvent("serviceworker", { timeout: 10000 });
    }

    if (!serviceWorker?.url().startsWith("chrome-extension://")) {
      throw new Error("O service worker da extensão PastePort não foi carregado.");
    }

    console.log(`Service worker: ${serviceWorker.url()}`);
    await captureModalScreenshot(
      browserContext,
      localSite.baseUrl,
      SCREENSHOTS.modal,
      serviceWorkerDiagnostics
    );
    await captureSuccessScreenshot(
      browserContext,
      localSite.baseUrl,
      SCREENSHOTS.success,
      serviceWorkerDiagnostics
    );
    await captureWorkflowScreenshot(
      browserContext,
      localSite.baseUrl,
      SCREENSHOTS.workflow,
      serviceWorkerDiagnostics
    );

    const reports = [];
    for (const filePath of Object.values(SCREENSHOTS)) {
      reports.push(await normalizeAndValidatePng(filePath));
    }

    if (new Set(reports.map((report) => report.hash)).size !== reports.length) {
      throw new Error("Dois ou mais screenshots gerados são idênticos.");
    }

    console.log("\nScreenshots validados:");
    for (const report of reports) {
      console.log(
        `- ${report.filePath}`
        + ` — ${report.width} × ${report.height}`
        + ` — PNG RGB ${report.depth * 3} bits`
        + ` — ${formatBytes(report.bytes)}`
      );
    }
  } finally {
    if (browserContext) {
      await browserContext.close().catch(() => {});
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    if (profileDirectory) {
      await fs.rm(profileDirectory, {
        force: true,
        maxRetries: 5,
        recursive: true,
        retryDelay: 200
      }).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(`\nFalha ao gerar screenshots: ${error.stack || error.message}`);
  process.exitCode = 1;
});
