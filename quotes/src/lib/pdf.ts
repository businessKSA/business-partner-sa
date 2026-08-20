/**
 * توليد PDF عبر طباعة نفس صفحة المستند من Chromium (Playwright print-to-PDF).
 *
 * لماذا هذه الطريقة لا @react-pdf/renderer:
 * الـPDF يخرج مطابقاً للصفحة حرفياً، ويتولى محرك Chromium تشكيل الحروف العربية
 * (Arabic shaping) والاتجاه ثنائي الاتجاه (bidi) وربط الحروف بشكل صحيح تماماً،
 * وهو ما لا تضمنه المكتبات التي ترسم النص حرفاً حرفاً.
 * خط Tajawal مُستضاف محلياً في public/fonts فلا يعتمد التوليد على الشبكة.
 */
import type { Browser } from 'playwright-core';

let browserPromise: Promise<Browser> | null = null;

function executablePath(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (root) return `${root}/chromium`;
  return undefined;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import('playwright-core');
      return chromium.launch({
        executablePath: executablePath(),
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
      });
    })().catch((e) => {
      browserPromise = null;
      throw e;
    });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    await b?.close().catch(() => undefined);
  }
}

export interface PdfOptions {
  /** رابط الصفحة المراد طباعتها (صفحة المستند نفسها بوضع الطباعة). */
  url: string;
  landscape?: boolean;
}

export async function renderPdf({ url, landscape = false }: PdfOptions): Promise<Buffer> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    locale: 'ar-SA',
    viewport: { width: 1100, height: 1400 },
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    // ضمان تحميل الخطوط قبل الطباعة حتى لا يُطبع نص بخط بديل
    await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);
    await page.emulateMedia({ media: 'print' });
    const buf = await page.pdf({
      format: 'A4',
      landscape,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    return Buffer.from(buf);
  } finally {
    await page.close().catch(() => undefined);
    await ctx.close().catch(() => undefined);
  }
}

/** الرابط الداخلي لصفحة الطباعة الخاصة بمستند. */
export function printUrl(token: string): string {
  const base = process.env.INTERNAL_URL || process.env.APP_URL || 'http://localhost:3000';
  return `${base}/d/${token}/print`;
}
