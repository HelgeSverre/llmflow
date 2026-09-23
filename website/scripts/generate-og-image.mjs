import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const outputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : fileURLToPath(new URL('../og-image.png', import.meta.url))
const browser = await chromium.launch({ headless: true })
try {
    const page = await browser.newPage({
        viewport: { width: 1200, height: 630 },
        deviceScaleFactor: 2,
    })
    await page.goto(new URL('./og-image.html', import.meta.url).href)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: outputPath })
    console.log(`Generated: ${outputPath}`)
} finally {
    await browser.close()
}
