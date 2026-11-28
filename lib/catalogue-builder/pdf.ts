import chromium from '@sparticuz/chromium';
import puppeteer, { type Page } from 'puppeteer-core';
import LambdaFS from '@sparticuz/chromium/build/lambdafs';
import { join } from 'node:path';

import { access, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

type BrowserRuntime = { executablePath: string; env?: Record<string, string | undefined> };
let packagedRuntime: Promise<BrowserRuntime> | undefined;

async function packagedBrowser(): Promise<BrowserRuntime> {
  const executablePath = await chromium.executablePath();
  if (process.platform !== 'linux') return { executablePath };

  const archive = join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br');
  const libraryPath = join(await LambdaFS.inflate(archive), 'lib');
  await access(join(libraryPath, 'libnss3.so'));

  // Set the library path in the child immediately before starting the native binary.
  const directory = await mkdtemp(join(tmpdir(), 'neejee-pdf-'));
  const launcher = join(directory, 'chrome');
  await writeFile(launcher, '#!/bin/sh\nexport LD_LIBRARY_PATH="$NEEJEE_CHROME_LIBS"\nexec "$NEEJEE_CHROME_BIN" "$@"\n', { mode: 0o700 });
  return {
    executablePath: launcher,
    env: {
      PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
      LANG: process.env.LANG, TZ: process.env.TZ, FONTCONFIG_PATH: process.env.FONTCONFIG_PATH || '/tmp/fonts',
      NEEJEE_CHROME_BIN: executablePath,
      NEEJEE_CHROME_LIBS: [libraryPath, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'),
    },
  };
}

function browserRuntime(): Promise<BrowserRuntime> {
  if (process.env.CHROME_EXECUTABLE_PATH) return Promise.resolve({ executablePath: process.env.CHROME_EXECUTABLE_PATH });
  packagedRuntime ??= packagedBrowser().catch(error => {
    packagedRuntime = undefined;
    throw error;
  });
  return packagedRuntime;
}

function resolveArgs(): string[] {
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return [
      '--disable-setuid-sandbox',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none'
    ];
  }

  return [...chromium.args];
}

async function waitForAssets(page: Page): Promise<void> {
  try {
    await page.waitForNetworkIdle({
      idleTime: 800,
      timeout: 15000
    });
  } catch {}

  await page.evaluate(async () => {
    const fonts = (document as any).fonts;
    if (fonts?.ready) {
      try {
        await fonts.ready;
      } catch {}
    }

    const images = Array.from(document.images || []);
    await Promise.all(
      images.map(async (img) => {
        if (img.complete) {
          try {
            if (typeof (img as any).decode === 'function') {
              await (img as any).decode();
            }
          } catch {}
          return;
        }

        await new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
          setTimeout(resolve, 10000);
        });

        try {
          if (typeof (img as any).decode === 'function') {
            await (img as any).decode();
          }
        } catch {}
      })
    );
  });
}

export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    ...await browserRuntime(),
    args: resolveArgs(),
    headless: true,
    defaultViewport: {
      width: 1400,
      height: 1980,
      deviceScaleFactor: 1.5
    }
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'load'
    });

    await waitForAssets(page);
    await page.emulateMediaType('print');

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px'
      }
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}