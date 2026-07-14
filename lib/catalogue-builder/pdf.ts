import chromium from '@sparticuz/chromium';
import puppeteer, { type Page } from 'puppeteer-core';

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
        if (img.complete && img.naturalWidth > 0) {
          try {
            if (typeof (img as any).decode === 'function') {
              await (img as any).decode();
            }
          } catch {}
          return;
        }

        await new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 10000);
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