/**
 * جسر دفترة — نظام المحاسبة الرسمي على businesspartner.daftra.com
 *
 * دفترة هي مصدر الحقيقة للفاتورة الضريبية المعتمدة من هيئة الزكاة والضريبة
 * والجمارك. نظامنا يولّد عرض السعر والعقد ويحصّل السداد، ثم يُرحّل الفاتورة
 * إلى دفترة لتصدر برقمها الضريبي ورمز الاستجابة السريعة.
 *
 * لا يُنادى هذا الجسر إطلاقاً ما لم يكن DAFTRA_MODE=live — حماية من ازدواج
 * الفواتير مع أي تكامل قائم على الحساب نفسه.
 */

export type DaftraProbeRow = {
  base: string;
  path: string;
  header: string;
  status: number | null;
  ok: boolean;
  contentType: string | null;
  preview: string;
  error?: string;
};

/** ترويسات المصادقة المحتملة — الأولى هي الافتراضية الموثّقة لدى دفترة. */
const AUTH_HEADERS = ['APIKEY', 'apikey', 'X-API-KEY', 'Authorization'] as const;
/** جذور واجهة البرمجة المحتملة حسب إصدار الحساب. */
const API_BASES = ['/api2', '/v2/api'] as const;
/** نقاط قراءة غير مؤثّرة — تُستخدم للفحص فقط. */
const PROBE_PATHS = ['/clients?limit=1', '/clients.json?limit=1'] as const;

const TIMEOUT_MS = 12_000;

export function daftraSubdomain(): string {
  return (process.env.DAFTRA_SUBDOMAIN || '').trim();
}

export function daftraOrigin(): string {
  const sub = daftraSubdomain();
  return sub.includes('.') ? `https://${sub}` : `https://${sub}.daftra.com`;
}

/** هل المفاتيح موجودة؟ لا يعني أن الترحيل مفعّل. */
export function daftraConfigured(): boolean {
  return Boolean(process.env.DAFTRA_API_KEY && daftraSubdomain());
}

/** هل يُسمح فعلياً بإرسال بيانات إلى دفترة؟ */
export function daftraLive(): boolean {
  return daftraConfigured() && process.env.DAFTRA_MODE === 'live';
}

function authHeader(name: string, key: string): Record<string, string> {
  if (name === 'Authorization') return { Authorization: `Bearer ${key}` };
  return { [name]: key };
}

async function call(
  base: string,
  path: string,
  header: string,
  init: RequestInit = {},
): Promise<Response> {
  const key = process.env.DAFTRA_API_KEY || '';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${daftraOrigin()}${base}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...authHeader(header, key),
        ...(init.headers as Record<string, string> | undefined),
      },
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * يجرّب تركيبات الجذر والترويسة على نقطة قراءة فقط، ويُرجع أيّها نجح.
 * لا يكتب شيئاً ولا يُظهر المفتاح. يُستدعى من مسار محمي بحساب المدير.
 */
export async function probeDaftra(): Promise<{
  origin: string;
  configured: boolean;
  mode: string;
  rows: DaftraProbeRow[];
  recommended: { base: string; header: string } | null;
}> {
  const origin = daftraOrigin();
  const configured = daftraConfigured();
  const rows: DaftraProbeRow[] = [];
  if (!configured) {
    return { origin, configured, mode: process.env.DAFTRA_MODE || 'off', rows, recommended: null };
  }

  for (const base of API_BASES) {
    for (const path of PROBE_PATHS) {
      for (const header of AUTH_HEADERS) {
        try {
          const res = await call(base, path, header);
          const text = (await res.text()).slice(0, 400);
          rows.push({
            base,
            path,
            header,
            status: res.status,
            ok: res.ok && !/<html/i.test(text),
            contentType: res.headers.get('content-type'),
            preview: text.replace(/\s+/g, ' ').slice(0, 300),
          });
        } catch (e) {
          rows.push({
            base,
            path,
            header,
            status: null,
            ok: false,
            contentType: null,
            preview: '',
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
  }

  const hit = rows.find((r) => r.ok);
  return {
    origin,
    configured,
    mode: process.env.DAFTRA_MODE || 'off',
    rows,
    recommended: hit ? { base: hit.base, header: hit.header } : null,
  };
}

/** الجذر والترويسة المعتمدان — يُثبَّتان بمتغيّر بيئة بعد نجاح الفحص. */
function settled(): { base: string; header: string } {
  return {
    base: process.env.DAFTRA_API_BASE || API_BASES[0],
    header: process.env.DAFTRA_API_HEADER || AUTH_HEADERS[0],
  };
}

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { base, header } = settled();
  const res = await call(base, path, header, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`دفترة ${res.status} على ${path}: ${text.replace(/\s+/g, ' ').slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`دفترة أعادت رداً غير JSON على ${path}: ${text.slice(0, 200)}`);
  }
}

export type DaftraClientInput = {
  nameAr: string;
  email?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  crNumber?: string | null;
  city?: string | null;
  addressAr?: string | null;
};

export type DaftraInvoiceLine = {
  descriptionAr: string;
  quantity: number;
  unitPrice: number;
  /** نسبة الضريبة كنسبة مئوية: 15 أو 0 للرسوم الحكومية المستثناة. */
  taxPercent: number;
};

export type DaftraInvoiceInput = {
  clientId: number | string;
  /** رقم فاتورتنا — يُمرَّر كمرجع حتى نطابق الفاتورتين. */
  reference: string;
  issueDate: Date;
  lines: DaftraInvoiceLine[];
  notesAr?: string;
};

/** يبحث عن العميل بالبريد ثم بالاسم، وينشئه إن لم يوجد. يُرجع معرّفه في دفترة. */
export async function findOrCreateDaftraClient(input: DaftraClientInput): Promise<string> {
  if (!daftraLive()) throw new Error('ترحيل دفترة غير مفعّل — DAFTRA_MODE ليس live.');

  if (input.email) {
    const found = await json<{ data?: Array<{ id: number | string }> }>(
      `/clients?email=${encodeURIComponent(input.email)}&limit=1`,
    ).catch(() => null);
    const hit = found?.data?.[0];
    if (hit) return String(hit.id);
  }

  const created = await json<{ id?: number | string; data?: { id?: number | string } }>('/clients', {
    method: 'POST',
    body: JSON.stringify({
      business_name: input.nameAr,
      email: input.email || undefined,
      phone1: input.phone || undefined,
      bn1: input.vatNumber || undefined, // الرقم الضريبي
      bn2: input.crNumber || undefined, // السجل التجاري
      city: input.city || undefined,
      address1: input.addressAr || undefined,
      country_code: 'SA',
    }),
  });
  const id = created.id ?? created.data?.id;
  if (!id) throw new Error('دفترة لم تُعِد معرّف العميل بعد الإنشاء.');
  return String(id);
}

/** ينشئ فاتورة في دفترة ويُرجع معرّفها ورقمها. */
export async function createDaftraInvoice(
  input: DaftraInvoiceInput,
): Promise<{ id: string; number?: string }> {
  if (!daftraLive()) throw new Error('ترحيل دفترة غير مفعّل — DAFTRA_MODE ليس live.');

  const payload = {
    Invoice: {
      client_id: input.clientId,
      date: input.issueDate.toISOString().slice(0, 10),
      client_business_name: undefined as string | undefined,
      no: undefined as string | undefined,
      notes: input.notesAr,
      client_reference: input.reference,
    },
    InvoiceItem: input.lines.map((l) => ({
      item: l.descriptionAr,
      description: l.descriptionAr,
      unit_price: l.unitPrice,
      quantity: l.quantity,
      tax1: l.taxPercent,
    })),
  };

  const res = await json<{ id?: number | string; data?: { id?: number | string; no?: string } }>(
    '/invoices',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  const id = res.id ?? res.data?.id;
  if (!id) throw new Error('دفترة لم تُعِد معرّف الفاتورة بعد الإنشاء.');
  return { id: String(id), number: res.data?.no };
}
