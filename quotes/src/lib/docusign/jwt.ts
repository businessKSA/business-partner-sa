/**
 * مصادقة DocuSign عبر JWT Grant.
 * المفاتيح كلها متغيرات بيئة. راجع quotes/docs/docusign.md لخطوات الحصول عليها
 * ولخطوة منح الموافقة (consent) لمرة واحدة.
 */
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { appBase } from '../base';

export interface DocuSignConfig {
  mode: 'demo' | 'production' | 'mock';
  integrationKey: string;
  userId: string;
  accountId: string;
  authBase: string;
  apiBase: string;
  privateKey: string;
}

export class DocuSignNotConfigured extends Error {
  constructor(public readonly missing: string[]) {
    super(`تكامل DocuSign غير مكتمل الإعداد. المتغيرات الناقصة: ${missing.join(', ')}`);
    this.name = 'DocuSignNotConfigured';
  }
}

function readPrivateKey(): string {
  const inline = process.env.DOCUSIGN_PRIVATE_KEY;
  if (inline && inline.includes('BEGIN')) return inline.replace(/\\n/g, '\n');
  const p = process.env.DOCUSIGN_PRIVATE_KEY_PATH;
  if (p) {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    if (fs.existsSync(abs)) return fs.readFileSync(abs, 'utf8');
  }
  return '';
}

export function docusignMode(): 'demo' | 'production' | 'mock' {
  const m = (process.env.DOCUSIGN_MODE || 'mock').toLowerCase();
  return m === 'demo' || m === 'production' ? m : 'mock';
}

export function getConfig(): DocuSignConfig {
  const mode = docusignMode();
  const cfg: DocuSignConfig = {
    mode,
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY || '',
    userId: process.env.DOCUSIGN_USER_ID || '',
    accountId: process.env.DOCUSIGN_ACCOUNT_ID || '',
    authBase: process.env.DOCUSIGN_AUTH_BASE || 'account-d.docusign.com',
    apiBase: process.env.DOCUSIGN_API_BASE || 'https://demo.docusign.net/restapi',
    privateKey: readPrivateKey(),
  };
  if (mode === 'mock') return cfg;

  const missing: string[] = [];
  if (!cfg.integrationKey) missing.push('DOCUSIGN_INTEGRATION_KEY');
  if (!cfg.userId) missing.push('DOCUSIGN_USER_ID');
  if (!cfg.accountId) missing.push('DOCUSIGN_ACCOUNT_ID');
  if (!cfg.privateKey) missing.push('DOCUSIGN_PRIVATE_KEY أو DOCUSIGN_PRIVATE_KEY_PATH');
  if (missing.length) throw new DocuSignNotConfigured(missing);
  return cfg;
}

/** هل التكامل جاهز للاستخدام؟ لا يرمي استثناء — يُستخدم لعرض تنبيه في الواجهة. */
export function docusignStatus(): { ready: boolean; mode: string; missing: string[] } {
  const mode = docusignMode();
  if (mode === 'mock') return { ready: true, mode, missing: [] };
  try {
    getConfig();
    return { ready: true, mode, missing: [] };
  } catch (e) {
    if (e instanceof DocuSignNotConfigured) return { ready: false, mode, missing: e.missing };
    return { ready: false, mode, missing: ['unknown'] };
  }
}

let cachedToken: { token: string; exp: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const cfg = getConfig();

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: cfg.integrationKey,
      sub: cfg.userId,
      aud: cfg.authBase,
      iat: now,
      exp: now + 3600,
      scope: 'signature impersonation',
    },
    cfg.privateKey,
    { algorithm: 'RS256' },
  );

  const res = await fetch(`https://${cfg.authBase}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !body.access_token) {
    if (body.error === 'consent_required') {
      throw new Error(
        `DocuSign تحتاج منح الموافقة لمرة واحدة. افتح الرابط التالي وسجّل الدخول ووافق:\n${consentUrl()}`,
      );
    }
    throw new Error(`فشل الحصول على رمز DocuSign: ${body.error_description || body.error || res.status}`);
  }

  cachedToken = { token: body.access_token, exp: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

/** رابط منح الموافقة لمرة واحدة (consent) — يُفتح في المتصفح ويُوافَق عليه. */
export function consentUrl(): string {
  const cfg = { authBase: process.env.DOCUSIGN_AUTH_BASE || 'account-d.docusign.com', ik: process.env.DOCUSIGN_INTEGRATION_KEY || '' };
  const redirect = `${appBase()}/api/docusign/consent-callback`;
  const q = new URLSearchParams({
    response_type: 'code',
    scope: 'signature impersonation',
    client_id: cfg.ik,
    redirect_uri: redirect,
  });
  return `https://${cfg.authBase}/oauth/auth?${q.toString()}`;
}

export function resetTokenCache() {
  cachedToken = null;
}
