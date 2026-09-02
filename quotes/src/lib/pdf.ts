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
import { appBase } from './base';

let browserPromise: Promise<Browser> | null = null;

function pdfDriver(): 'local' | 'serverless' {
  return (process.env.PDF_DRIVER || 'local').toLowerCase() === 'serverless' ? 'serverless' : 'local';
}

function localExecutablePath(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (root) return `${root}/chromium`;
  return undefined;
}

/**
 * دوال Vercel لا تتضمن متصفحاً، فيُحمَّل Chromium مضغوطاً من @sparticuz/chromium
 * ويُفك داخل مجلد مؤقت عند أول استدعاء. لهذا تحديداً يعمل توليد المستندات في
 * عامل خلفي لا داخل طلب المستخدم.
 */
async function serverlessLaunchArgs() {
  const chromium = (await import('@sparticuz/chromium')).default;
  return {
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, '--font-render-hinting=none'],
  };
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import('playwright-core');
      if (pdfDriver() === 'serverless') {
        const { executablePath, args } = await serverlessLaunchArgs();
        return chromium.launch({ executablePath, args });
      }
      return chromium.launch({
        executablePath: localExecutablePath(),
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
  const base = process.env.INTERNAL_URL || appBase();
  return `${base}/d/${token}/print`;
}
