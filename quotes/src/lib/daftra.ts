/**
 * جسر دفترة — نظام المحاسبة الرسمي على businesspartner.daftra.com
 *
 * دفترة هي مصدر الحقيقة للفاتورة الضريبية المعتمدة من هيئة الزكاة والضريبة
 * والجمارك. نظامنا يولّد عرض السعر والعقد ويحصّل السداد عبر ميسر — وميسر
 * ليست ضمن بوابات دفترة، فالربط بينهما يمر عبر هذا الجسر حصراً — ثم تُرحَّل
 * الفاتورة إلى دفترة لتصدر برقمها الضريبي ورمز الاستجابة السريعة.
 *
 * لا يُنادى هذا الجسر إطلاقاً ما لم يكن DAFTRA_MODE=live — حماية من ازدواج
 * الفواتير مع أي مصدر آخر يُصدر فواتير على الحساب نفسه.
 *
 * العقد مأخوذ من التوثيق الرسمي docs.daftara.dev:
 *   الجذر     https://{subdomain}.daftara.com/api2
 *   المصادقة  ترويسة apikey
 *   الفاتورة  POST /invoices بجسم { Invoice: {...}, InvoiceItem: [...] }
 *   النجاح    202 مع { code, result, id }
 */

export type DaftraProbeRow = {
  origin: string;
  base: string;
  path: string;
  header: string;
  status: number | null;
  ok: boolean;
  contentType: string | null;
  preview: string;
  error?: string;
};

/** ترويسة المصادقة الموثّقة لدى دفترة، ثم بدائل احتياطية. */
const AUTH_HEADERS = ['APIKEY', 'apikey', 'X-API-KEY', 'Authorization'] as const;
/** جذر الواجهة الموثّق. */
const API_BASES = ['/api2'] as const;
/** النطاق العامل المثبت من تكامل الموقع القائم: daftra.com لا daftara.com. */
const API_HOSTS = ['daftra.com'] as const;
/** نقطة قراءة غير مؤثّرة — للفحص فقط. */
const PROBE_PATHS = ['/clients.json?limit=1'] as const;

const TIMEOUT_MS = 12_000;

export function daftraSubdomain(): string {
  return (process.env.DAFTRA_SUBDOMAIN || '').trim();
}

function originFor(host: string): string {
  const sub = daftraSubdomain();
  return sub.includes('.') ? `https://${sub}` : `https://${sub}.${host}`;
}

/** الأصل المعتمد — يُثبَّت بمتغيّر بيئة بعد نجاح الفحص. */
export function daftraOrigin(): string {
  return originFor(process.env.DAFTRA_API_HOST || API_HOSTS[0]);
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
  origin: string,
  base: string,
  path: string,
  header: string,
  init: RequestInit = {},
): Promise<Response> {
  const key = process.env.DAFTRA_API_KEY || '';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${origin}${base}${path}`, {
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
 * يجرّب تركيبات المضيف والجذر والترويسة على نقطة قراءة فقط، ويُرجع أيّها قُبل.
 * لا يكتب شيئاً ولا يُظهر المفتاح. يُستدعى من مسار محمي بحساب المدير.
 */
export async function probeDaftra(): Promise<{
  configured: boolean;
  mode: string;
  rows: DaftraProbeRow[];
  recommended: { host: string; base: string; header: string } | null;
}> {
  const configured = daftraConfigured();
  const rows: DaftraProbeRow[] = [];
  if (!configured) {
    return { configured, mode: process.env.DAFTRA_MODE || 'off', rows, recommended: null };
  }

  for (const host of API_HOSTS) {
    const origin = originFor(host);
    for (const base of API_BASES) {
      for (const path of PROBE_PATHS) {
        for (const header of AUTH_HEADERS) {
          try {
            const res = await call(origin, base, path, header);
            const text = (await res.text()).slice(0, 400);
            rows.push({
              origin,
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
              origin,
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
  }

  const hit = rows.find((r) => r.ok);
  const host = hit ? API_HOSTS.find((h) => hit.origin.endsWith(h)) : undefined;
  return {
    configured,
    mode: process.env.DAFTRA_MODE || 'off',
    rows,
    recommended: hit && host ? { host, base: hit.base, header: hit.header } : null,
  };
}

/** الجذر والترويسة المعتمدان — يُثبَّتان بمتغيّرات بيئة بعد نجاح الفحص. */
function settled(): { origin: string; base: string; header: string } {
  return {
    origin: daftraOrigin(),
    base: process.env.DAFTRA_API_BASE || API_BASES[0],
    header: process.env.DAFTRA_API_HEADER || AUTH_HEADERS[0],
  };
}

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { origin, base, header } = settled();
  const res = await call(origin, base, path, header, init);
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
  /** معرّف الضريبة في دفترة، أو null للبنود المستثناة كالرسوم الحكومية. */
  taxId: number | null;
};

export type DaftraInvoiceInput = {
  clientId: number | string;
  /** رقم فاتورتنا — يُمرَّر في po_number ليطابق السجلّين. */
  reference: string;
  issueDate: Date;
  lines: DaftraInvoiceLine[];
  notesAr?: string;
};

/** قائمة الضرائب المعرّفة في الحساب — لاستخراج معرّف ضريبة القيمة المضافة. */
export async function listDaftraTaxes(): Promise<unknown> {
  if (!daftraConfigured()) throw new Error('مفاتيح دفترة غير مضبوطة.');
  return json('/taxes.json?limit=100');
}

/** يبحث عن العميل بالبريد ثم ينشئه إن لم يوجد. يُرجع معرّفه في دفترة. */
export async function findOrCreateDaftraClient(input: DaftraClientInput): Promise<string> {
  if (!daftraLive()) throw new Error('ترحيل دفترة غير مفعّل — DAFTRA_MODE ليس live.');

  if (input.email) {
    const found = await json<{ data?: Array<{ Client?: { id?: number | string }; id?: number | string }> }>(
      `/clients.json?filter[email]=${encodeURIComponent(input.email)}&limit=20`,
    ).catch(() => null);
    const hit = found?.data?.[0];
    const id = hit?.Client?.id ?? hit?.id;
    if (id) return String(id);
  }

  const body = {
    Client: {
      business_name: input.nameAr,
      email: input.email || undefined,
      phone1: input.phone || undefined,
      bn1: input.vatNumber || undefined, // الرقم الضريبي
      bn2: input.crNumber || undefined, // السجل التجاري
      city: input.city || undefined,
      address1: input.addressAr || undefined,
      country_code: 'SA',
    },
  };
  const created = await json<{ id?: number | string }>('/clients.json', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!created.id) throw new Error('دفترة لم تُعِد معرّف العميل بعد الإنشاء.');
  return String(created.id);
}

/**
 * ينشئ فاتورة في دفترة ويُرجع معرّفها.
 * لا يُمرَّر رقم الفاتورة `no` عمداً — الترقيم المتسلسل يبقى بيد دفترة
 * حفاظاً على تسلسل الفواتير الضريبية.
 */
export async function createDaftraInvoice(
  input: DaftraInvoiceInput,
): Promise<{ id: string }> {
  if (!daftraLive()) throw new Error('ترحيل دفترة غير مفعّل — DAFTRA_MODE ليس live.');

  const payload = {
    Invoice: {
      client_id: input.clientId,
      date: input.issueDate.toISOString().slice(0, 10),
      currency_code: 'SAR',
      draft: false,
      po_number: input.reference,
      notes: input.notesAr,
    },
    InvoiceItem: input.lines.map((l) => ({
      item: l.descriptionAr,
      description: l.descriptionAr,
      unit_price: l.unitPrice,
      quantity: l.quantity,
      tax1: l.taxId,
      tax2: null,
      discount: 0,
    })),
  };

  const res = await json<{ code?: number; result?: string; id?: number | string }>(
    '/invoices.json',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  if (!res.id) throw new Error('دفترة لم تُعِد معرّف الفاتورة بعد الإنشاء.');
  return { id: String(res.id) };
}
