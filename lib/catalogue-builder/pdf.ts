import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

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
      waitUntil: 'domcontentloaded'
    });

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
