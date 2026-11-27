import chromium from '@sparticuz/chromium';
import puppeteer, { type Page } from 'puppeteer-core';
import LambdaFS from '@sparticuz/chromium/build/lambdafs';
import { join } from 'node:path';

let linuxLibraries: Promise<string> | undefined;
async function serverlessBrowserEnv() {
  if (process.env.VERCEL !== '1' || process.env.CHROME_EXECUTABLE_PATH) return undefined;
  // Chromium 126 only auto-loads these libraries on specific Lambda Node versions.
  // Vercel's Node 22 runtime needs the same NSS/NSPR libraries for the browser process.
  const archive = join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br');
  linuxLibraries ??= LambdaFS.inflate(archive).catch(error => {
    linuxLibraries = undefined;
    throw error;
  });
  const libraryPath = join(await linuxLibraries, 'lib');
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    LANG: process.env.LANG,
    TZ: process.env.TZ,
    FONTCONFIG_PATH: process.env.FONTCONFIG_PATH || '/tmp/fonts',
    LD_LIBRARY_PATH: [libraryPath, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'),
  };
}

async function resolveExecutablePath(): Promise<string> {
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }

  const executablePath = await chromium.executablePath();

  if (!executablePath) {
    throw new Error(
      'No Chrome/Chromium executable found. Set CHROME_EXECUTABLE_PATH or install a Chromium runtime.'
    );
  }

  return executablePath;
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
    executablePath: await resolveExecutablePath(),
    args: resolveArgs(),
    env: await serverlessBrowserEnv(),
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