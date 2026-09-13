import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || dir;

const targets = [
  { file: "instagram-post.html", out: "instagram-post.png", width: 1080, height: 1350 },
  { file: "facebook-post.html", out: "facebook-post.png", width: 1200, height: 630 },
  { file: "linkedin-card.html", out: "linkedin-card.png", width: 1200, height: 627 },
  { file: "story-vertical.html", out: "story-vertical.png", width: 1080, height: 1920 },
  { file: "broadcast-square.html", out: "broadcast-square.png", width: 1080, height: 1080 },
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.width, height: t.height }, deviceScaleFactor: 2 });
  await page.goto("file://" + path.join(dir, t.file));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(outDir, t.out) });
  await page.close();
  console.log("rendered", t.out);
}
await browser.close();
