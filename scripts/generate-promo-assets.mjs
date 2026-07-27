import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pngjs from "pngjs";

const { PNG } = pngjs;
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const SOURCE_DIRECTORY = path.resolve(PROJECT_ROOT, "store-assets-source");
const OUTPUT_DIRECTORY = path.resolve(PROJECT_ROOT, "store-assets");
const ASSETS = Object.freeze([
  {
    name: "small",
    width: 440,
    height: 280,
    safe: { top: 24, right: 24, bottom: 24, left: 24 },
    minimumFontSize: 18,
    outputPath: path.resolve(OUTPUT_DIRECTORY, "promo-small-440x280.png")
  },
  {
    name: "marquee",
    width: 1400,
    height: 560,
    safe: { top: 40, right: 60, bottom: 40, left: 60 },
    minimumFontSize: 28,
    outputPath: path.resolve(OUTPUT_DIRECTORY, "promo-marquee-1400x560.png")
  }
]);

function contentType(filePath) {
  const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
  };
  return types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function startSourceServer() {
  const requiredFiles = ["promo.html", "promo.css", "promo.js"];
  for (const fileName of requiredFiles) {
    const filePath = path.resolve(SOURCE_DIRECTORY, fileName);
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`Arquivo-fonte ausente: ${filePath}`);
    }
  }

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      if (requestUrl.pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }

      const requestedPath = decodeURIComponent(requestUrl.pathname)
        .replace(/^\/+/, "") || "promo.html";
      const filePath = path.resolve(SOURCE_DIRECTORY, requestedPath);
      const relativePath = path.relative(SOURCE_DIRECTORY, filePath);

      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        response.writeHead(403);
        response.end();
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
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end();
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Não foi possível detectar a porta do servidor promocional.");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function waitForStableComposition(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  });
}

async function validateComposition(page, asset) {
  const result = await page.evaluate(({
    name,
    width,
    height,
    safe,
    minimumFontSize
  }) => {
    const promo = document.querySelector(`.promo-${name}`);
    const requiredText = [
      "PastePort",
      "Cole imagens direto no upload",
      "Sem baixar. Sem salvar. Só colar."
    ];

    if (!promo) {
      return { error: "A composição ativa não foi encontrada." };
    }

    const essentialBounds = Array.from(
      promo.querySelectorAll("[data-essential]"),
      (element) => {
        const rect = element.getBoundingClientRect();
        return {
          element: element.className || element.tagName,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left
        };
      }
    );
    const fontSizes = Array.from(
      promo.querySelectorAll("[data-font-check]"),
      (element) => ({
        element: element.className || element.tagName,
        size: Number.parseFloat(getComputedStyle(element).fontSize),
        text: element.textContent.replace(/\s+/g, " ").trim()
      })
    );
    const promoRect = promo.getBoundingClientRect();
    const text = promo.innerText.replace(/\s+/g, " ").trim();

    return {
      bodyScrollHeight: document.body.scrollHeight,
      bodyScrollWidth: document.body.scrollWidth,
      essentialBounds,
      fontSizes,
      missingText: requiredText.filter((value) => !text.includes(value)),
      promoRect: {
        top: promoRect.top,
        right: promoRect.right,
        bottom: promoRect.bottom,
        left: promoRect.left,
        width: promoRect.width,
        height: promoRect.height
      },
      viewport: { width: innerWidth, height: innerHeight },
      limits: {
        top: safe.top,
        right: width - safe.right,
        bottom: height - safe.bottom,
        left: safe.left,
        minimumFontSize
      }
    };
  }, asset);

  if (result.error) {
    throw new Error(result.error);
  }

  if (
    result.viewport.width !== asset.width
    || result.viewport.height !== asset.height
    || result.promoRect.width !== asset.width
    || result.promoRect.height !== asset.height
  ) {
    throw new Error(`Viewport ou arte incorreta: ${JSON.stringify(result)}`);
  }

  if (
    result.bodyScrollWidth > asset.width
    || result.bodyScrollHeight > asset.height
  ) {
    throw new Error(`A composição ${asset.name} possui barras de rolagem.`);
  }

  if (result.missingText.length) {
    throw new Error(
      `Texto obrigatório ausente em ${asset.name}: ${result.missingText.join(", ")}`
    );
  }

  for (const bounds of result.essentialBounds) {
    if (
      bounds.left < result.limits.left
      || bounds.right > result.limits.right
      || bounds.top < result.limits.top
      || bounds.bottom > result.limits.bottom
    ) {
      throw new Error(
        `Elemento fora da área segura em ${asset.name}: ${JSON.stringify(bounds)}`
      );
    }
  }

  for (const font of result.fontSizes) {
    if (font.size < asset.minimumFontSize) {
      throw new Error(
        `Texto menor que ${asset.minimumFontSize}px em ${asset.name}:`
        + ` "${font.text}" (${font.size}px).`
      );
    }
  }
}

async function captureAsset(browser, baseUrl, asset) {
  const context = await browser.newContext({
    viewport: {
      width: asset.width,
      height: asset.height
    },
    deviceScaleFactor: 1,
    colorScheme: "light"
  });
  const page = await context.newPage();
  const pageErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.stack || error.message);
  });

  try {
    const url = `${baseUrl}/promo.html?asset=${asset.name}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction(
      (name) => document.body.dataset.asset === name
        && document.body.dataset.ready === "true",
      asset.name
    );
    await waitForStableComposition(page);
    await validateComposition(page, asset);

    if (pageErrors.length) {
      throw new Error(`Erros da página ${asset.name}:\n${pageErrors.join("\n")}`);
    }

    await page.screenshot({
      path: asset.outputPath,
      type: "png",
      fullPage: false
    });
  } finally {
    await context.close();
  }
}

async function normalizeAndValidatePng(asset) {
  const source = await fs.readFile(asset.outputPath);
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
    deflateLevel: 6,
    inputColorType: 6,
    inputHasAlpha: true
  });
  await fs.writeFile(asset.outputPath, rgbBuffer);

  const normalizedBuffer = await fs.readFile(asset.outputPath);
  const normalized = PNG.sync.read(normalizedBuffer);
  const statistics = await fs.stat(asset.outputPath);
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

  if (normalized.width !== asset.width || normalized.height !== asset.height) {
    throw new Error(
      `${path.basename(asset.outputPath)} possui`
      + ` ${normalized.width} × ${normalized.height}.`
    );
  }

  if (normalized.colorType !== 2 || normalized.depth !== 8 || effectiveAlpha) {
    throw new Error(
      `${path.basename(asset.outputPath)} não é PNG RGB de 24 bits sem alfa.`
    );
  }

  if (statistics.size <= 20 * 1024) {
    throw new Error(
      `${path.basename(asset.outputPath)} possui apenas ${statistics.size} bytes.`
    );
  }

  if (allWhite || allBlack) {
    throw new Error(
      `${path.basename(asset.outputPath)} está totalmente ${allWhite ? "branco" : "preto"}.`
    );
  }

  return {
    path: asset.outputPath,
    width: normalized.width,
    height: normalized.height,
    bytes: statistics.size,
    depth: normalized.depth,
    colorType: normalized.colorType,
    hash: createHash("sha256").update(normalizedBuffer).digest("hex")
  };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
}

async function main() {
  let browser = null;
  let server = null;

  try {
    await fs.mkdir(OUTPUT_DIRECTORY, { recursive: true });
    await Promise.all(
      ASSETS.map((asset) => fs.rm(asset.outputPath, { force: true }))
    );

    const sourceServer = await startSourceServer();
    server = sourceServer.server;
    browser = await chromium.launch({ headless: true });

    for (const asset of ASSETS) {
      await captureAsset(browser, sourceServer.baseUrl, asset);
    }

    const reports = [];
    for (const asset of ASSETS) {
      reports.push(await normalizeAndValidatePng(asset));
    }

    if (new Set(reports.map((report) => report.hash)).size !== reports.length) {
      throw new Error("Os dois materiais promocionais são idênticos.");
    }

    console.log("Materiais promocionais validados:");
    for (const report of reports) {
      console.log(
        `- ${report.path}`
        + ` — ${report.width} × ${report.height}`
        + ` — PNG RGB ${report.depth * 3} bits`
        + ` — sem alfa`
        + ` — ${formatBytes(report.bytes)}`
      );
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

main().catch((error) => {
  console.error(`Falha ao gerar materiais promocionais: ${error.stack || error.message}`);
  process.exitCode = 1;
});
