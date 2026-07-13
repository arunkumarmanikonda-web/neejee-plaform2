import chromium from '@sparticuz/chromium';

export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const playwright = await import('playwright-core');

  const executablePath = process.env.CHROME_EXECUTABLE_PATH || (await chromium.executablePath());
  const browser = await playwright.chromium.launch({
    executablePath,
    args: chromium.args,
    headless: true,
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 1980 },
      deviceScaleFactor: 1.5,
    });

    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      tagged: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
