/**
 * جسر الفاتورة الضريبية — تفويض، لا تنفيذ.
 *
 * الفاتورة الضريبية المعتمدة تصدر من الدفترة عبر الشيفرة المجرَّبة في
 * `api/_daftra.js` بالموقع التعريفي، وهي التي تُصدر فواتير الموقع منذ شهور.
 * هذه اللوحة لا تنادي الدفترة مباشرة عمداً: نسختان من العميل تعنيان تسلسلين
 * لأرقام الفواتير لمنشأة واحدة — وهو ما لا تقبله هيئة الزكاة والضريبة، ثم
 * ازدواج فواتير على السداد الواحد.
 *
 * فما تفعله اللوحة: تُرسل من دفع وبماذا وكم، وتستقبل رقم الفاتورة وملفها.
 *
 * ولا شيء يُرسَل ما لم يكن DAFTRA_MODE=live — الافتراضي صامت تماماً.
 */

export type DaftraLineInput = { name: string; quantity: number; unitPrice: number };

export type DaftraBuyer = {
  name: string;
  email: string;
  phone?: string;
  city?: string;
  taxNumber?: string;
  isCompany?: boolean;
  contact?: string;
  address?: Record<string, string> | null;
};

export type DaftraIssued = {
  ok: true;
  id: string;
  number: string;
  net: number;
  vat: number;
  total: number;
  vatRate: number;
  paymentRecorded: boolean;
  paymentError: string;
  pdfBase64: string;
  publicUrl: string;
};

export type DaftraFailure = { ok: false; error: string; detail?: string; expected?: number; paid?: number };

export function daftraConfigured(): boolean {
  return Boolean(process.env.PANEL_BRIDGE_TOKEN && process.env.SITE_API_URL);
}

/** الترحيل مغلق افتراضياً. يُفتح بعد أن تُرى فاتورة واحدة تصدر صحيحة. */
export function daftraLive(): boolean {
  return daftraConfigured() && process.env.DAFTRA_MODE === 'live';
}

export function daftraStatus(): { configured: boolean; live: boolean; mode: string; endpoint: string } {
  const base = (process.env.SITE_API_URL || '').replace(/\/+$/, '');
  return {
    configured: daftraConfigured(),
    live: daftraLive(),
    mode: process.env.DAFTRA_MODE || 'off',
    endpoint: base ? `${base}/api/daftra-invoice` : '',
  };
}

/**
 * إصدار الفاتورة الضريبية للسداد الذي قُيِّد في هذه اللوحة.
 *
 * `paidHalalas` ليس اختيارياً في المعنى: الموقع يقارنه بمجموع البنود ويرفض
 * الإصدار عند اختلافهما بأكثر من ريال — فاتورة لا تطابق ما دُفع أسوأ من
 * غياب الفاتورة.
 */
export async function issueTaxInvoice(input: {
  buyer: DaftraBuyer;
  items: DaftraLineInput[];
  paidHalalas: number;
  payId?: string;
  method?: string;
  ref?: string;
  sourceNumber?: string;
}): Promise<DaftraIssued | DaftraFailure> {
  if (!daftraLive()) {
    return { ok: false, error: 'daftra_not_live', detail: `DAFTRA_MODE=${process.env.DAFTRA_MODE || 'off'}` };
  }
  const base = (process.env.SITE_API_URL || '').replace(/\/+$/, '');

  try {
    const res = await fetch(`${base}/api/daftra-invoice`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.PANEL_BRIDGE_TOKEN}`,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(45000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.ok !== true) {
      return {
        ok: false,
        error: String(data.error || `HTTP ${res.status}`),
        detail: String(data.detail || ''),
        expected: typeof data.expected === 'number' ? data.expected : undefined,
        paid: typeof data.paid === 'number' ? data.paid : undefined,
      };
    }
    return data as unknown as DaftraIssued;
  } catch (e) {
    return { ok: false, error: 'bridge_unreachable', detail: e instanceof Error ? e.message : String(e) };
  }
}
