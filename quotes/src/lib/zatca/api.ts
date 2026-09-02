/**
 * عميل بوابة «فاتورة» — الإبلاغ (المبسطة) والاعتماد (المعيارية) وطلبات
 * شهادات الختم. المصادقة Basic بشهادة الختم binarySecurityToken والسر.
 *
 * البيئات الثلاث لنفس المسارات: developer-portal للتجارب بلا أثر، simulation
 * ببيانات المنشأة الحقيقية بلا أثر ضريبي، core هي الإنتاج الفعلي.
 */
import { zatcaApiBase, zatcaCertificateBody, zatcaSecret } from './config';

export interface ZatcaApiResult {
  ok: boolean;
  status: number;
  /** REPORTED | CLEARED | NOT_REPORTED | NOT_CLEARED | '' */
  disposition: string;
  warnings: string[];
  errors: string[];
  raw: unknown;
}

function authHeader(): string {
  const cert = zatcaCertificateBody() || '';
  // اسم المستخدم هو binarySecurityToken: base64 لجسم base64 للشهادة
  const user = Buffer.from(cert, 'utf8').toString('base64');
  return 'Basic ' + Buffer.from(`${user}:${zatcaSecret()}`, 'utf8').toString('base64');
}

function collectMessages(raw: unknown): { warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const r = raw as Record<string, unknown> | null;
  const vr = (r?.validationResults ?? r) as Record<string, unknown> | null;
  const takeAll = (list: unknown, into: string[]) => {
    if (!Array.isArray(list)) return;
    for (const m of list) {
      const msg = m as Record<string, unknown>;
      const text = [msg?.code, msg?.message].filter(Boolean).join(': ');
      if (text) into.push(text);
    }
  };
  takeAll(vr?.warningMessages, warnings);
  takeAll(vr?.errorMessages, errors);
  return { warnings, errors };
}

async function callZatca(path: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<ZatcaApiResult> {
  const res = await fetch(`${zatcaApiBase()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Version': 'V2',
      'Accept-Language': 'en',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  let raw: unknown = null;
  try { raw = await res.json(); } catch { /* بعض الأخطاء بلا جسم */ }
  const r = raw as Record<string, unknown> | null;
  const disposition = String(r?.reportingStatus || r?.clearanceStatus || '');
  const { warnings, errors } = collectMessages(raw);
  return { ok: res.status === 200 || res.status === 202, status: res.status, disposition, warnings, errors, raw };
}

/** إبلاغ فاتورة مبسطة — خلال 24 ساعة من الإصدار. */
export async function reportSimplifiedInvoice(args: { uuid: string; invoiceHash: string; signedXmlBase64: string }): Promise<ZatcaApiResult> {
  return callZatca('/invoices/reporting/single', {
    invoiceHash: args.invoiceHash,
    uuid: args.uuid,
    invoice: args.signedXmlBase64,
  }, { Authorization: authHeader() });
}

/** اعتماد فاتورة معيارية — قبل تسليمها للمشتري. */
export async function clearStandardInvoice(args: { uuid: string; invoiceHash: string; signedXmlBase64: string }): Promise<ZatcaApiResult> {
  return callZatca('/invoices/clearance/single', {
    invoiceHash: args.invoiceHash,
    uuid: args.uuid,
    invoice: args.signedXmlBase64,
  }, { Authorization: authHeader(), 'Clearance-Status': '1' });
}

/** فحص التوافق أثناء التأهيل — بشهادة الالتزام المؤقتة CCSID. */
export async function complianceCheckInvoice(args: {
  uuid: string; invoiceHash: string; signedXmlBase64: string;
  ccsidToken: string; ccsidSecret: string;
}): Promise<ZatcaApiResult> {
  const auth = 'Basic ' + Buffer.from(`${args.ccsidToken}:${args.ccsidSecret}`, 'utf8').toString('base64');
  return callZatca('/compliance/invoices', {
    invoiceHash: args.invoiceHash,
    uuid: args.uuid,
    invoice: args.signedXmlBase64,
  }, { Authorization: auth });
}

/** طلب شهادة الالتزام CCSID: CSR + رمز التحقق من بوابة فاتورة. */
export async function requestComplianceCsid(csrBase64: string, otp: string): Promise<{ status: number; raw: unknown }> {
  const res = await fetch(`${zatcaApiBase()}/compliance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Version': 'V2',
      OTP: otp,
    },
    body: JSON.stringify({ csr: csrBase64 }),
  });
  let raw: unknown = null;
  try { raw = await res.json(); } catch { /* لا جسم */ }
  return { status: res.status, raw };
}

/** طلب شهادة الإنتاج PCSID بعد نجاح فحوصات الالتزام. */
export async function requestProductionCsid(args: {
  complianceRequestId: string; ccsidToken: string; ccsidSecret: string;
}): Promise<{ status: number; raw: unknown }> {
  const auth = 'Basic ' + Buffer.from(`${args.ccsidToken}:${args.ccsidSecret}`, 'utf8').toString('base64');
  const res = await fetch(`${zatcaApiBase()}/production/csids`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Version': 'V2',
      Authorization: auth,
    },
    body: JSON.stringify({ compliance_request_id: args.complianceRequestId }),
  });
  let raw: unknown = null;
  try { raw = await res.json(); } catch { /* لا جسم */ }
  return { status: res.status, raw };
}
