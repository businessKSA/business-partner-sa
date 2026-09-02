/**
 * عميل واجهات هيئة الزكاة والضريبة والدخل.
 *
 * ثلاث بيئات ومسارات ثابتة. البيئة تُختار في إعدادات المنشأة، ولا تُخلط:
 * شهادة بيئة الاختبار لا تعمل على الإنتاج والعكس، والخلط بينهما هو أشيع
 * سبب لرسالة «غير مصرّح» التي لا تقول شيئاً.
 *
 * مساران للفواتير:
 *  ـ الإجازة (clearance) للفاتورة الضريبية بين المنشآت: تُرسل قبل تسليمها
 *    للعميل، وتعود مُجازةً بختم الهيئة. النسخة المُجازة هي التي تُسلَّم.
 *  ـ الإبلاغ (reporting) للفاتورة المبسطة: تُسلَّم للعميل فوراً وتُبلَّغ
 *    خلال أربع وعشرين ساعة.
 *
 * الاستجابة قد تكون قبولاً، أو قبولاً بملاحظات، أو رفضاً. القبول بملاحظات
 * ليس فشلاً — الفاتورة نافذة والملاحظات تُعالج لاحقاً — والخلط بينه وبين
 * الرفض يجعل النظام يعيد الإرسال بلا داعٍ ويكسر تسلسل العدّاد.
 */
export type ZatcaEnvironment = 'SANDBOX' | 'SIMULATION' | 'PRODUCTION';

const BASE_URL: Record<ZatcaEnvironment, string> = {
  SANDBOX: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
  SIMULATION: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
  PRODUCTION: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
};

export type ZatcaResult<T = unknown> = {
  ok: boolean;
  status: number;
  /** ACCEPTED مقبولة | ACCEPTED_WITH_WARNINGS مقبولة بملاحظات | REJECTED مرفوضة */
  outcome: 'ACCEPTED' | 'ACCEPTED_WITH_WARNINGS' | 'REJECTED' | 'ERROR';
  body: T;
  warnings: unknown[];
  errors: unknown[];
  /** رسالة عربية صالحة للعرض في الشاشة */
  message: string;
};

export class ZatcaClient {
  constructor(
    private readonly environment: ZatcaEnvironment,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private url(path: string): string {
    return `${BASE_URL[this.environment]}${path}`;
  }

  private authHeader(username: string, password: string): string {
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  private async call<T>(
    path: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<ZatcaResult<T>> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url(path), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Language': 'ar',
          'Accept-Version': 'V2',
          ...headers,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      return {
        ok: false, status: 0, outcome: 'ERROR', body: null as T,
        warnings: [], errors: [String(e)],
        message: `تعذّر الاتصال بخوادم الهيئة: ${e instanceof Error ? e.message : e}`,
      };
    }

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }

    return this.interpret<T>(res.status, parsed);
  }

  /**
   * يترجم الاستجابة إلى نتيجة واضحة.
   *
   * الهيئة تستعمل ٢٠٢ للقبول بملاحظات و٢٠٠ للقبول التام، و٤٠٠ للرفض.
   * التعامل مع ٢٠٢ كفشل يجعل النظام يعيد الإرسال، وإعادةُ إرسال فاتورةٍ
   * قُبلت تكسر العدّاد وتُنتج فاتورةً مكرّرة في سجلّ الهيئة.
   */
  private interpret<T>(status: number, body: unknown): ZatcaResult<T> {
    const b = (body ?? {}) as Record<string, unknown>;
    const info = (b.validationResults ?? {}) as Record<string, unknown>;
    const warnings = (info.warningMessages ?? b.warnings ?? []) as unknown[];
    const errors = (info.errorMessages ?? b.errors ?? []) as unknown[];

    if (status === 200) {
      return {
        ok: true, status, outcome: 'ACCEPTED', body: body as T,
        warnings, errors: [], message: 'قُبلت من الهيئة.',
      };
    }
    if (status === 202) {
      return {
        ok: true, status, outcome: 'ACCEPTED_WITH_WARNINGS', body: body as T,
        warnings, errors: [],
        message: `قُبلت مع ${warnings.length} ملاحظة. الفاتورة نافذة، والملاحظات تُعالج في الفواتير القادمة.`,
      };
    }
    if (status === 400 || status === 303) {
      return {
        ok: false, status, outcome: 'REJECTED', body: body as T,
        warnings, errors,
        message: `رُفضت من الهيئة: ${describeErrors(errors)}`,
      };
    }
    if (status === 401 || status === 403) {
      return {
        ok: false, status, outcome: 'ERROR', body: body as T,
        warnings, errors,
        message: 'الهيئة رفضت بيانات الربط. تحقّق من الشهادة والرمز السري وأن البيئة المختارة تطابق الشهادة.',
      };
    }
    return {
      ok: false, status, outcome: 'ERROR', body: body as T,
      warnings, errors,
      message: `استجابة غير متوقّعة من الهيئة (${status}).`,
    };
  }

  // ── الربط (Onboarding) ────────────────────────────────────────────────

  /**
   * المرحلة الأولى من الربط: طلب شهادة الامتثال بالرمز الذي يولّده بوّابة
   * فاتورة (OTP صالح لساعة واحدة).
   */
  async requestComplianceCsid(csrBase64: string, otp: string) {
    return this.call<{ requestID: string; binarySecurityToken: string; secret: string }>(
      '/compliance',
      { csr: csrBase64 },
      { OTP: otp },
    );
  }

  /**
   * اختبار الامتثال: تُرسل فواتير نموذجية بكل الأنواع التي ستصدرها المنشأة.
   * الهيئة لا تمنح شهادة الإنتاج قبل اجتيازه.
   */
  async checkCompliance(
    complianceToken: string,
    secret: string,
    payload: { invoiceHash: string; uuid: string; invoice: string },
  ) {
    return this.call('/compliance/invoices', payload, {
      Authorization: this.authHeader(complianceToken, secret),
    });
  }

  /** المرحلة الثانية: شهادة الإنتاج بعد اجتياز الامتثال. */
  async requestProductionCsid(complianceToken: string, secret: string, requestId: string) {
    return this.call<{ binarySecurityToken: string; secret: string }>(
      '/production/csids',
      { compliance_request_id: requestId },
      { Authorization: this.authHeader(complianceToken, secret) },
    );
  }

  /** تجديد شهادة الإنتاج قبل انتهائها. */
  async renewProductionCsid(token: string, secret: string, csrBase64: string, otp: string) {
    return this.call<{ binarySecurityToken: string; secret: string }>(
      '/production/csids',
      { csr: csrBase64 },
      { Authorization: this.authHeader(token, secret), OTP: otp },
    );
  }

  // ── الفواتير ──────────────────────────────────────────────────────────

  /** الإجازة — للفاتورة الضريبية. تعود بنسخة مُجازة تُسلَّم للعميل. */
  async clearInvoice(
    token: string,
    secret: string,
    payload: { invoiceHash: string; uuid: string; invoice: string },
  ) {
    return this.call<{ clearedInvoice?: string; clearanceStatus?: string }>(
      '/invoices/clearance/single',
      payload,
      { Authorization: this.authHeader(token, secret), 'Clearance-Status': '1' },
    );
  }

  /** الإبلاغ — للفاتورة المبسطة، خلال أربع وعشرين ساعة من إصدارها. */
  async reportInvoice(
    token: string,
    secret: string,
    payload: { invoiceHash: string; uuid: string; invoice: string },
  ) {
    return this.call<{ reportingStatus?: string }>(
      '/invoices/reporting/single',
      payload,
      { Authorization: this.authHeader(token, secret), 'Clearance-Status': '0' },
    );
  }
}

function describeErrors(errors: unknown[]): string {
  if (!errors.length) return 'بلا تفصيل من الهيئة';
  return errors
    .slice(0, 3)
    .map((e) => {
      const o = e as Record<string, unknown>;
      return String(o.message ?? o.code ?? JSON.stringify(e));
    })
    .join(' — ');
}
