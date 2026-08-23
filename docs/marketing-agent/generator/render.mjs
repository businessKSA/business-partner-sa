// Renders any HTML file in a pack to PNG at 2x.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";

export async function renderAll(jobs) {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  try {
    for (const { html, out, width, height } of jobs) {
      const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 2,
      });
      await page.setContent(html, { waitUntil: "networkidle" });
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await page.screenshot({ path: out });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
