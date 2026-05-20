const { chromium } = require('playwright');
const path = require('path');

async function generateOgImage() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
  });

  const htmlPath = path.join(__dirname, 'og-image.html');
  await page.goto(`file://${htmlPath}`);

  // Wait for fonts to load
  await page.waitForFunction(() => document.fonts.ready);
  await page.waitForTimeout(500); // Extra buffer for rendering

  const outputPath = path.join(__dirname, '..', 'website', 'og-image.png');
  await page.screenshot({ path: outputPath });

  await browser.close();
  console.log(`Generated: ${outputPath}`);
}

generateOgImage().catch(console.error);
