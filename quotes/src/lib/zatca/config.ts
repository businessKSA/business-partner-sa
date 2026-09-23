/**
 * إعدادات الفوترة الإلكترونية — كلها من البيئة، ولا مفتاح في المستودع.
 *
 * المرحلة الأولى (فاتورة): لا تحتاج إلا بيانات البائع — QR وحقول إلزامية.
 * المرحلة الثانية (الربط): تحتاج مفتاحاً خاصاً وشهادة ختم من بوابة فاتورة —
 *   ZATCA_PRIVATE_KEY   المفتاح الخاص secp256k1 (PEM أو سطر base64)
 *   ZATCA_CERTIFICATE   binarySecurityToken كما أعادته الهيئة
 *   ZATCA_SECRET        السر المرافق للشهادة
 *   ZATCA_ENV           sandbox | simulation | production (الافتراضي sandbox)
 *
 * الغياب لا يكسر شيئاً: بلا شهادة يصدر النظام فواتير المرحلة الأولى كاملة
 * الحقول، وهو الوضع النظامي للمنشآت التي لم تصل موجتها في الربط بعد.
 */
import { COMPANY } from '@config/company';
import { vatNumberLooksValid } from './qr';

export type ZatcaEnv = 'sandbox' | 'simulation' | 'production';

const API_BASES: Record<ZatcaEnv, string> = {
  sandbox: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
  simulation: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
  production: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
};

export function zatcaEnv(): ZatcaEnv {
  const e = (process.env.ZATCA_ENV || 'sandbox').trim().toLowerCase();
  return e === 'production' || e === 'simulation' ? (e as ZatcaEnv) : 'sandbox';
}

export function zatcaApiBase(): string {
  return API_BASES[zatcaEnv()];
}

/** المفتاح الخاص كـPEM مهما كانت صيغة المتغير. */
export function zatcaPrivateKeyPem(): string | null {
  const raw = (process.env.ZATCA_PRIVATE_KEY || '').trim();
  if (!raw) return null;
  if (raw.includes('BEGIN')) return raw.replace(/\\n/g, '\n');
  return `-----BEGIN EC PRIVATE KEY-----\n${raw.replace(/\s+/g, '')}\n-----END EC PRIVATE KEY-----`;
}

/**
 * جسم الشهادة base64 (بلا رؤوس PEM). binarySecurityToken من الهيئة هو
 * base64 لنص base64 للشهادة — نفكّه إن كان كذلك ونقبل الصيغتين.
 */
export function zatcaCertificateBody(): string | null {
  let raw = (process.env.ZATCA_CERTIFICATE || '').trim();
  if (!raw) return null;
  raw = raw.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');
  // إن كان فكّ الـbase64 يعطي base64 آخر يبدأ بـ MII فهو binarySecurityToken
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (/^MII[A-Za-z0-9+/=\s]+$/.test(decoded.trim())) return decoded.replace(/\s+/g, '');
  } catch { /* ليس مغلفاً */ }
  return raw;
}

export function zatcaSecret(): string {
  return (process.env.ZATCA_SECRET || '').trim();
}

/** جاهزية المرحلة الثانية: مفتاح + شهادة + سر. */
export function zatcaPhase2Ready(): boolean {
  return Boolean(zatcaPrivateKeyPem() && zatcaCertificateBody() && zatcaSecret());
}

export interface SellerProfile {
  name: string;
  vatNumber: string;
  crNumber: string;
  street: string;
  building: string;
  city: string;
  postalZone: string;
  district: string;
  countryCode: string;
  ready: boolean;
  missing: string[];
}

/** بيانات البائع — من ثوابت الشركة مع إمكانية تجاوزها من البيئة. */
export function sellerProfile(): SellerProfile {
  const name = (process.env.ZATCA_SELLER_NAME || COMPANY.legalName.ar).trim();
  const vat = (process.env.ZATCA_SELLER_VAT || COMPANY.vatNumber).replace(/\D/g, '');
  const cr = (process.env.ZATCA_SELLER_CR || COMPANY.crNumber).replace(/\D/g, '');
  const vatOk = vatNumberLooksValid(vat);
  return {
    name,
    vatNumber: vat,
    crNumber: cr,
    street: process.env.ZATCA_SELLER_STREET || 'ريحانة بنت زيد',
    building: process.env.ZATCA_SELLER_BUILDING || '5890',
    city: process.env.ZATCA_SELLER_CITY || 'الرياض',
    postalZone: process.env.ZATCA_SELLER_POSTAL || '13331',
    district: process.env.ZATCA_SELLER_DISTRICT || 'العارض',
    countryCode: 'SA',
    ready: Boolean(name && vatOk),
    missing: [
      name ? null : 'ZATCA_SELLER_NAME',
      vatOk ? null : 'ZATCA_SELLER_VAT',
    ].filter((x): x is string => Boolean(x)),
  };
}
