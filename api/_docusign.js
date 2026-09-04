// Business Partner — DocuSign eSignature, for the contract between the
// accepted quote and the invoice.
//
// Underscore-prefixed so Vercel treats it as a module, not a 13th serverless
// function — the plan caps at 12.
//
// Auth is JWT Grant: the app holds an RSA private key, signs an assertion for
// one impersonated user, and exchanges it for an access token. No user is
// present when a contract goes out, so the interactive flows do not apply.
// Signing is done with node's crypto — this repo adds no dependencies.
//
// Env:
//   DOCUSIGN_INTEGRATION_KEY  the app's Integration Key (client id)
//   DOCUSIGN_USER_ID          API Username (a GUID) of the impersonated user
//   DOCUSIGN_ACCOUNT_ID       the account the envelopes are created in
//   DOCUSIGN_PRIVATE_KEY      the RSA private key, PEM, newlines or \n escapes
//   DOCUSIGN_ENV              "demo" (default) or "production"
//
// A word on jurisdiction, because it decides whether any of this is the right
// tool: DocuSign is accepted for commercial agreements between the parties to
// them. A document that must stand before a Saudi government body needs نفاذ —
// this does not substitute for it, and nothing here should be read as saying
// it does.

import { createSign, createPrivateKey } from "crypto";
import { LEGAL_NAME, UNIFIED_NUMBER, VAT_NUMBER } from "./_identity.js";

const env = (n, d = "") => (process.env[n] && String(process.env[n]).trim()) || d;
const INTEGRATION_KEY = env("DOCUSIGN_INTEGRATION_KEY");
const USER_ID = env("DOCUSIGN_USER_ID");
const ACCOUNT_ID = env("DOCUSIGN_ACCOUNT_ID");
// Vercel's UI keeps real newlines, but a key pasted through a shell often
// arrives with literal \n. Both are accepted rather than one being assumed.
const PRIVATE_KEY = env("DOCUSIGN_PRIVATE_KEY").replace(/\\n/g, "\n");
const IS_PROD = /^prod/i.test(env("DOCUSIGN_ENV", "demo"));
const OAUTH_HOST = IS_PROD ? "account.docusign.com" : "account-d.docusign.com";
// DocuSign's admin screen shows the Account Base URI without the /restapi
// suffix the API needs ("https://demo.docusign.net"), so a value copied
// straight off that screen — the obvious thing to do — would 404 every call.
// Both forms are accepted.
const API_BASE = (() => {
  const raw = env("DOCUSIGN_BASE_URI", IS_PROD ? "https://na1.docusign.net" : "https://demo.docusign.net").replace(/\/+$/, "");
  return /\/restapi$/.test(raw) ? raw : `${raw}/restapi`;
})();
const SITE = env("MKT_SITE_BASE", "https://www.businesspartner.sa");

export const docusignConfigured = () => !!(INTEGRATION_KEY && USER_ID && ACCOUNT_ID && PRIVATE_KEY);
export const docusignEnv = () => (IS_PROD ? "production" : "demo");

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---- auth ------------------------------------------------------------------

let _token = null, _tokenExp = 0;

/**
 * A JWT Grant access token, cached for the warm instance. DocuSign issues these
 * for an hour; it is refreshed a minute early so a request never starts with a
 * token that expires mid-flight.
 */
export async function docusignToken() {
  if (!docusignConfigured()) throw new Error("docusign_not_configured");
  if (_token && Date.now() < _tokenExp - 60_000) return _token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: INTEGRATION_KEY,
    sub: USER_ID,
    aud: OAUTH_HOST,
    iat: now,
    exp: now + 3600,
    scope: "signature impersonation",
  }));
  let signature;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claim}`);
    signer.end();
    signature = b64url(signer.sign(PRIVATE_KEY));
  } catch (e) {
    const err = new Error("docusign_bad_key");
    err.detail = `المفتاح الخاص غير مقروء: ${String(e.message || e).slice(0, 120)}`;
    throw err;
  }

  const r = await fetch(`https://${OAUTH_HOST}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${signature}`,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) {
    // consent_required is the one failure with a specific, actionable remedy,
    // and it is the one that happens first — so it is named, not lumped in.
    if (String(data.error || "") === "consent_required") {
      const err = new Error("docusign_consent_required");
      err.detail = consentUrl();
      throw err;
    }
    const err = new Error("docusign_auth_failed");
    err.detail = `${r.status}: ${JSON.stringify(data).slice(0, 300)}`;
    throw err;
  }
  _token = data.access_token;
  _tokenExp = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  return _token;
}

/**
 * The one-time consent URL. JWT impersonation does not work until the account
 * has granted it, and the grant is a human clicking this link once.
 */
export function consentUrl(redirect = `${SITE}/admin`) {
  return `https://${OAUTH_HOST}/oauth/auth?response_type=code&scope=signature%20impersonation` +
    `&client_id=${encodeURIComponent(INTEGRATION_KEY)}&redirect_uri=${encodeURIComponent(redirect)}`;
}

async function dsFetch(path, { method = "GET", body } = {}) {
  const token = await docusignToken();
  const r = await fetch(`${API_BASE}/v2.1/accounts/${ACCOUNT_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!r.ok) {
    const err = new Error("docusign_failed");
    err.detail = `${r.status}: ${(data ? JSON.stringify(data) : text).slice(0, 400)}`;
    throw err;
  }
  return data;
}

// ---- the contract ----------------------------------------------------------

/**
 * The agreement itself, as HTML. DocuSign renders HTML documents directly, so
 * no PDF generator is needed and the Arabic stays right-to-left and selectable
 * rather than becoming an image of text.
 *
 * `/sig1/` and `/date1/` are anchor strings: DocuSign places the signature and
 * date fields wherever it finds them, so the tabs follow the text if the
 * template changes rather than sitting at fixed coordinates that silently drift.
 */
// Arabic ordinals for clause headings. The clause list is now built as data so
// a subscription contract can carry three extra clauses without every heading
// after them being renumbered by hand — which is how a contract ends up saying
// "سابعاً" twice.
const ORDINALS = ["أولاً", "ثانياً", "ثالثاً", "رابعاً", "خامساً", "سادساً", "سابعاً", "ثامناً", "تاسعاً", "عاشراً", "حادي عشر", "ثاني عشر", "ثالث عشر"];

// العقد ثنائي اللغة: العمود العربي هو المرجع نظاماً، ويقابله عمود بلغة
// العميل حين لا تكون العربية. الترجمة للفهم لا للاحتجاج — وهذا منصوصٌ عليه
// في بند «لغة العقد» أدناه، وهو ما يجري عليه العمل في العقود السعودية.
const LANGS = ["ar", "en", "fr", "zh"];
const DOC_DIR = { ar: "rtl", en: "ltr", fr: "ltr", zh: "ltr" };
const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DOC_TX = {
  title:   { ar: "عقد تقديم خدمات", en: "Services Agreement", fr: "Contrat de prestation de services", zh: "服务协议" },
  refLbl:  { ar: "رقم المرجع", en: "Reference", fr: "Référence", fr2: "", zh: "编号" },
  dateLbl: { ar: "تاريخ التحرير", en: "Date", fr: "Date", zh: "日期" },
  item:    { ar: "البند", en: "Item", fr: "Prestation", zh: "项目" },
  qty:     { ar: "الكمية", en: "Qty", fr: "Qté", zh: "数量" },
  value:   { ar: "القيمة", en: "Amount", fr: "Montant", zh: "金额" },
  sar:     { ar: "﷼", en: "SAR", fr: "SAR", zh: "SAR" },
  signBy:  { ar: "الطرف الثاني (العميل)", en: "Second Party (Client)", fr: "Seconde partie (Client)", zh: "乙方（客户）" },
  sign:    { ar: "التوقيع", en: "Signature", fr: "Signature", zh: "签字" },
  sdate:   { ar: "التاريخ", en: "Date", fr: "Date", zh: "日期" },
  govern:  { ar: "النص العربي هو المرجع", en: "The Arabic text governs",
             fr: "Le texte arabe fait foi", zh: "以阿拉伯文文本为准" },
};
const tx = (k, l) => (DOC_TX[k] && (DOC_TX[k][l] || DOC_TX[k].ar)) || "";

function clauses(v) {
  const { esc: e, net, vat, total, vatRate, leadTime, executor, clientName, clientCr, clientVat,
          legalName, unified, vatNo, rows, sub, pct } = v;
  const party = (l) => {
    const first = {
      ar: `<b>الطرف الأول (مقدّم الخدمة):</b> ${e(legalName)}${unified ? ` — الرقم الموحد: ${e(unified)}` : ""}${vatNo ? ` — الرقم الضريبي: ${e(vatNo)}` : ""} — المملكة العربية السعودية.`,
      en: `<b>First Party (Service Provider):</b> ${e(legalName)}${unified ? ` — Unified No.: ${e(unified)}` : ""}${vatNo ? ` — VAT No.: ${e(vatNo)}` : ""} — Kingdom of Saudi Arabia.`,
      fr: `<b>Première partie (Prestataire) :</b> ${e(legalName)}${unified ? ` — N° unifié : ${e(unified)}` : ""}${vatNo ? ` — N° TVA : ${e(vatNo)}` : ""} — Royaume d'Arabie saoudite.`,
      zh: `<b>甲方（服务提供方）：</b>${e(legalName)}${unified ? ` — 统一编号：${e(unified)}` : ""}${vatNo ? ` — 增值税号：${e(vatNo)}` : ""} — 沙特阿拉伯王国。`,
    }[l];
    const second = {
      ar: `<b>الطرف الثاني (العميل):</b> ${e(clientName)}${clientCr ? ` — سجل تجاري: ${e(clientCr)}` : ""}${clientVat ? ` — الرقم الضريبي: ${e(clientVat)}` : ""}.`,
      en: `<b>Second Party (Client):</b> ${e(clientName)}${clientCr ? ` — CR No.: ${e(clientCr)}` : ""}${clientVat ? ` — VAT No.: ${e(clientVat)}` : ""}.`,
      fr: `<b>Seconde partie (Client) :</b> ${e(clientName)}${clientCr ? ` — N° RC : ${e(clientCr)}` : ""}${clientVat ? ` — N° TVA : ${e(clientVat)}` : ""}.`,
      zh: `<b>乙方（客户）：</b>${e(clientName)}${clientCr ? ` — 商业登记号：${e(clientCr)}` : ""}${clientVat ? ` — 增值税号：${e(clientVat)}` : ""}。`,
    }[l];
    const exec = !executor ? "" : {
      ar: `<p class="muted">يُنفّذ الطرف الأول هذه الخدمات بنفسه أو عبر شركائه المعتمدين (${e(executor)})، ويظل مسؤولاً أمام العميل عن التنفيذ.</p>`,
      en: `<p class="muted">The First Party performs these services itself or through its approved partners (${e(executor)}), and remains responsible to the Client for performance.</p>`,
      fr: `<p class="muted">La Première partie exécute ces prestations elle-même ou par ses partenaires agréés (${e(executor)}), et demeure responsable envers le Client de leur exécution.</p>`,
      zh: `<p class="muted">甲方自行或通过其认可的合作伙伴（${e(executor)}）履行本服务，并就履行情况对客户负责。</p>`,
    }[l];
    return `<p>${first}<br>${second}</p>${exec}`;
  };

  const scopeTable = (l) => `<table><thead><tr><th>${tx("item", l)}</th>` +
    `<th class="c">${tx("qty", l)}</th><th class="e">${tx("value", l)}</th></tr></thead><tbody>${rows(l)}</tbody></table>`;

  const list = [
    { t: { ar: "أطراف العقد", en: "The Parties", fr: "Les parties", zh: "合同双方" },
      h: party },
    { t: { ar: "محل العقد", en: "Scope of the Agreement", fr: "Objet du contrat", zh: "合同标的" },
      h: (l) => ({
        ar: "<p>يلتزم الطرف الأول بتقديم الخدمات الموضّحة أدناه:</p>",
        en: "<p>The First Party undertakes to provide the services set out below:</p>",
        fr: "<p>La Première partie s'engage à fournir les prestations décrites ci-dessous :</p>",
        zh: "<p>甲方承诺提供下列服务：</p>",
      }[l] + scopeTable(l)) },
    { t: { ar: "المقابل المالي", en: "Consideration", fr: "Contrepartie financière", zh: "价款" },
      h: (l) => ({
        ar: `<p>${sub ? "قيمة الدفعة الأولى قبل الضريبة" : "الإجمالي قبل الضريبة"}: <b>${money(net)} ﷼</b><br>ضريبة القيمة المضافة (${vatRate}%): <b>${money(vat)} ﷼</b><br><b>${sub ? "المستحق الآن" : "الإجمالي المستحق"}: ${money(total)} ﷼</b> (شامل ضريبة القيمة المضافة).</p><p>تُصدر فاتورة ضريبية نظامية بهذه القيمة عبر نظام الفوترة المعتمد لدى الطرف الأول، ويُسدَّد المقابل إلكترونياً أو بالتحويل البنكي.</p>`,
        en: `<p>${sub ? "First instalment before VAT" : "Total before VAT"}: <b>SAR ${money(net)}</b><br>Value Added Tax (${vatRate}%): <b>SAR ${money(vat)}</b><br><b>${sub ? "Due now" : "Total due"}: SAR ${money(total)}</b> (VAT inclusive).</p><p>A compliant tax invoice for this amount is issued through the First Party's approved invoicing system; payment is made electronically or by bank transfer.</p>`,
        fr: `<p>${sub ? "Premier versement hors TVA" : "Total hors TVA"} : <b>${money(net)} SAR</b><br>Taxe sur la valeur ajoutée (${vatRate} %) : <b>${money(vat)} SAR</b><br><b>${sub ? "Dû maintenant" : "Total dû"} : ${money(total)} SAR</b> (TVA comprise).</p><p>Une facture fiscale conforme est émise pour ce montant via le système de facturation agréé de la Première partie ; le règlement s'effectue par voie électronique ou par virement bancaire.</p>`,
        zh: `<p>${sub ? "首期款（不含税）" : "税前合计"}：<b>${money(net)} SAR</b><br>增值税（${vatRate}%）：<b>${money(vat)} SAR</b><br><b>${sub ? "当期应付" : "应付总额"}：${money(total)} SAR</b>（含增值税）。</p><p>甲方通过其经批准的开票系统就该金额开具合规税务发票；款项以电子方式或银行转账支付。</p>`,
      }[l]) },
  ];

  if (sub) {
    list.push({ t: { ar: "مدة الاشتراك وتجديده وإنهاؤه", en: "Term, Renewal and Termination of the Subscription",
                     fr: "Durée, renouvellement et résiliation de l'abonnement", zh: "订阅期限、续订与终止" },
      h: (l) => ({
        ar: `<p>هذه الخدمة اشتراك شهري يبدأ من تاريخ سداد الدفعة الأولى.</p><ol><li>يتجدد الاشتراك تلقائياً لمدد شهرية مماثلة بقيمة <b>${e(String(sub.renewsAt))} ﷼</b> شهرياً (تُضاف عليها ضريبة القيمة المضافة)، ما لم يُخطر أحد الطرفين الآخر برغبته في عدم التجديد.</li><li>لأي من الطرفين إنهاء الاشتراك بإشعار كتابي قبل سبعة أيام على الأقل من نهاية الشهر الجاري، ويسري الإنهاء من بداية الشهر التالي.</li><li>لا يترتب على الإنهاء استرداد رسوم الشهر الجاري، ويستكمل الطرف الأول التزامات ذلك الشهر.</li></ol>`,
        en: `<p>This service is a monthly subscription commencing on the date the first instalment is paid.</p><ol><li>It renews automatically for successive monthly terms at <b>SAR ${e(String(sub.renewsAt))}</b> per month (plus VAT), unless either party notifies the other that it does not wish to renew.</li><li>Either party may terminate on written notice given at least seven days before the end of the current month; termination takes effect from the start of the following month.</li><li>Termination does not entitle the Client to a refund of the current month's fees, and the First Party completes that month's obligations.</li></ol>`,
        fr: `<p>Cette prestation est un abonnement mensuel prenant effet à la date de paiement du premier versement.</p><ol><li>Il se renouvelle automatiquement par périodes mensuelles successives au tarif de <b>${e(String(sub.renewsAt))} SAR</b> par mois (hors TVA), sauf notification contraire de l'une des parties.</li><li>Chaque partie peut résilier par écrit au moins sept jours avant la fin du mois en cours ; la résiliation prend effet au début du mois suivant.</li><li>La résiliation n'ouvre pas droit au remboursement des frais du mois en cours, et la Première partie achève les obligations de ce mois.</li></ol>`,
        zh: `<p>本服务为按月订阅，自首期款支付之日起生效。</p><ol><li>除任一方通知不再续订外，订阅按每月 <b>${e(String(sub.renewsAt))} SAR</b>（另加增值税）自动续期。</li><li>任一方可在当月结束前至少七日以书面通知终止，终止自次月起生效。</li><li>终止不退还当月费用，甲方仍应完成当月义务。</li></ol>`,
      }[l]) });
    list.push({ t: { ar: "عمولة النجاح", en: "Success Fee", fr: "Commission de succès", zh: "成功佣金" },
      h: (l) => (pct ? {
        ar: `<ol><li>تستحق للطرف الأول عمولة نجاح بنسبة <b>${e(String(pct))}%</b> تُحتسب على الإيراد الذي حصّله الطرف الثاني <b>فعلياً</b> من الصفقات المشمولة.</li><li>لا تستحق العمولة على عقد موقّع لم يُحصّل، ولا على فاتورة صادرة لم تُدفع، ولا على أي مبلغ رُدّ إلى العميل النهائي.</li><li>لا تستحق العمولة على إيراد من عملاء الطرف الثاني القائمين قبل بدء الاشتراك، ولا على فرص لم يولّدها الطرف الأول.</li><li>تُستحق خلال خمسة عشر يوماً من تاريخ التحصيل، وتصدر بها فاتورة ضريبية مستقلة.</li></ol>`,
        en: `<ol><li>The First Party earns a success fee of <b>${e(String(pct))}%</b>, calculated on revenue <b>actually collected</b> by the Second Party from covered deals.</li><li>No fee is due on a signed but uncollected contract, an issued but unpaid invoice, or any amount refunded to the end client.</li><li>No fee is due on revenue from the Second Party's clients existing before the subscription began, nor on opportunities the First Party did not originate.</li><li>It falls due within fifteen days of collection and is invoiced separately with its own tax invoice.</li></ol>`,
        fr: `<ol><li>La Première partie perçoit une commission de succès de <b>${e(String(pct))} %</b>, calculée sur le chiffre d'affaires <b>effectivement encaissé</b> par la Seconde partie au titre des affaires couvertes.</li><li>Aucune commission n'est due sur un contrat signé mais non encaissé, une facture émise mais impayée, ou tout montant remboursé au client final.</li><li>Aucune commission n'est due sur les revenus provenant des clients de la Seconde partie antérieurs à l'abonnement, ni sur des opportunités non générées par la Première partie.</li><li>Elle est exigible dans les quinze jours suivant l'encaissement et fait l'objet d'une facture fiscale distincte.</li></ol>`,
        zh: `<ol><li>甲方就乙方在覆盖交易中<b>实际收讫</b>的收入收取 <b>${e(String(pct))}%</b> 的成功佣金。</li><li>已签署但未收款的合同、已开具但未支付的发票、以及退还给最终客户的任何款项，均不产生佣金。</li><li>订阅开始前乙方既有客户的收入，以及并非由甲方开发的商机，均不产生佣金。</li><li>佣金于收款之日起十五日内到期，并单独开具税务发票。</li></ol>`,
      }[l] : {
        ar: `<p>لا تستحق على هذا الاشتراك أي عمولة مهما بلغ الإيراد المحصّل؛ فالمقابل هو الرسوم الشهرية الثابتة وحدها.</p>`,
        en: `<p>No success fee is payable under this subscription regardless of revenue collected; the consideration is the fixed monthly fee alone.</p>`,
        fr: `<p>Aucune commission n'est due au titre de cet abonnement quel que soit le chiffre d'affaires encaissé ; la contrepartie est le seul forfait mensuel.</p>`,
        zh: `<p>本订阅不论收入多少均不产生成功佣金；对价仅为固定月费。</p>`,
      }[l]) });
  } else {
    list.push({ t: { ar: "مدة التنفيذ", en: "Delivery Time", fr: "Délai d'exécution", zh: "履行期限" },
      h: (l) => ({
        ar: leadTime ? `<p>يلتزم الطرف الأول بالتنفيذ خلال ${e(leadTime)} من تاريخ سداد المقابل واستكمال العميل للمستندات المطلوبة.</p>`
                     : `<p>يبدأ التنفيذ من تاريخ سداد المقابل واستكمال العميل للمستندات المطلوبة، وفق المدة المتفق عليها.</p>`,
        en: leadTime ? `<p>The First Party shall perform within ${e(leadTime)} from payment and the Client's submission of the required documents.</p>`
                     : `<p>Performance begins on payment and the Client's submission of the required documents, within the agreed period.</p>`,
        fr: leadTime ? `<p>La Première partie exécute dans un délai de ${e(leadTime)} à compter du paiement et de la remise par le Client des documents requis.</p>`
                     : `<p>L'exécution commence au paiement et à la remise par le Client des documents requis, dans le délai convenu.</p>`,
        zh: leadTime ? `<p>甲方应自付款且客户提交所需文件之日起 ${e(leadTime)} 内履行。</p>`
                     : `<p>履行自付款且客户提交所需文件之日开始，并在约定期限内完成。</p>`,
      }[l]) });
  }

  list.push(
    { t: { ar: "التزامات العميل", en: "Client Obligations", fr: "Obligations du Client", zh: "客户义务" },
      h: (l) => ({
        ar: `<ol><li>تزويد الطرف الأول بالمستندات والبيانات الصحيحة اللازمة للتنفيذ.</li><li>سداد المقابل المالي في موعده.</li><li>الرد على طلبات الاستيفاء خلال مدة معقولة؛ ولا يُحتسب على الطرف الأول أي تأخير ناشئ عن تأخر العميل.</li></ol>`,
        en: `<ol><li>Provide the First Party with the correct documents and data needed for performance.</li><li>Pay the consideration when due.</li><li>Respond to requests for completion within a reasonable time; delay caused by the Client is not counted against the First Party.</li></ol>`,
        fr: `<ol><li>Fournir à la Première partie les documents et données exacts nécessaires à l'exécution.</li><li>Régler la contrepartie à l'échéance.</li><li>Répondre aux demandes de complément dans un délai raisonnable ; tout retard imputable au Client n'est pas opposable à la Première partie.</li></ol>`,
        zh: `<ol><li>向甲方提供履行所需的真实文件与资料。</li><li>按期支付价款。</li><li>在合理期限内回应补正要求；因客户迟延造成的延误不计入甲方。</li></ol>`,
      }[l]) },
    { t: { ar: "الرسوم الحكومية", en: "Government Fees", fr: "Frais gouvernementaux", zh: "政府规费" },
      h: (l) => ({
        ar: `<p>ما لم يُنص صراحةً على خلاف ذلك في جدول البنود أعلاه، لا تشمل قيمة هذا العقد الرسوم الحكومية أو رسوم الجهات الرسمية، ويتحملها العميل عند استحقاقها.</p>`,
        en: `<p>Unless expressly stated otherwise in the schedule above, the price of this Agreement excludes government and official-body fees, which the Client bears when they fall due.</p>`,
        fr: `<p>Sauf mention expresse contraire dans le tableau ci-dessus, le prix du présent contrat exclut les frais gouvernementaux et les frais des organismes officiels, à la charge du Client à leur échéance.</p>`,
        zh: `<p>除上表另有明确约定外，本合同价款不含政府及官方机构规费，该等费用于到期时由客户承担。</p>`,
      }[l]) },
    { t: { ar: "السرية", en: "Confidentiality", fr: "Confidentialité", zh: "保密" },
      h: (l) => ({
        ar: `<p>يلتزم كل طرف بالحفاظ على سرية ما يطّلع عليه من بيانات الطرف الآخر، وعدم إفشائها لغير أغراض تنفيذ هذا العقد أو ما توجبه الأنظمة.</p>`,
        en: `<p>Each party shall keep confidential the other party's data to which it gains access, and shall not disclose it other than for performing this Agreement or as required by law.</p>`,
        fr: `<p>Chaque partie préserve la confidentialité des données de l'autre auxquelles elle accède et ne les divulgue qu'aux fins de l'exécution du présent contrat ou lorsque la loi l'exige.</p>`,
        zh: `<p>各方应对其获知的对方资料保密，除为履行本合同或法律要求外不得披露。</p>`,
      }[l]) },
    { t: { ar: "الإنهاء", en: "Termination", fr: "Résiliation", zh: "解除" },
      h: (l) => ({
        ar: `<p>لأي طرف إنهاء العقد بإشعار كتابي عند إخلال الطرف الآخر بالتزاماته وعدم تصحيح الإخلال خلال خمسة عشر يوماً من الإشعار. ويُسوّى المستحق عن الأعمال المنفَّذة فعلياً حتى تاريخ الإنهاء.</p>`,
        en: `<p>Either party may terminate on written notice if the other breaches its obligations and fails to cure within fifteen days of the notice. Amounts due for work actually performed up to termination are settled.</p>`,
        fr: `<p>Chaque partie peut résilier par notification écrite si l'autre manque à ses obligations et n'y remédie pas dans les quinze jours suivant la notification. Les sommes dues au titre des travaux effectivement réalisés jusqu'à la résiliation sont réglées.</p>`,
        zh: `<p>一方违反义务且在收到书面通知后十五日内未予纠正的，另一方可书面通知解除合同。截至解除之日实际完成工作的应付款项予以结清。</p>`,
      }[l]) },
    { t: { ar: "لغة العقد", en: "Language of the Agreement", fr: "Langue du contrat", zh: "合同语言" },
      h: (l) => ({
        ar: `<p>حُرِّر هذا العقد بالعربية وبلغة العميل جنباً إلى جنب تيسيراً للفهم. وعند أي اختلاف في المعنى بين النصّين، يكون النص العربي هو المرجع المعتمد.</p>`,
        en: `<p>This Agreement is set out in Arabic alongside the Client's language for ease of understanding. In the event of any difference in meaning between the two texts, the Arabic text prevails.</p>`,
        fr: `<p>Le présent contrat est rédigé en arabe et dans la langue du Client, côte à côte, pour faciliter la compréhension. En cas de divergence de sens entre les deux textes, le texte arabe prévaut.</p>`,
        zh: `<p>本合同以阿拉伯文与客户语言并列列明，以便理解。两文本含义如有差异，以阿拉伯文文本为准。</p>`,
      }[l]) },
    { t: { ar: "النظام الواجب التطبيق", en: "Governing Law", fr: "Droit applicable", zh: "适用法律" },
      h: (l) => ({
        ar: `<p>يخضع هذا العقد لأنظمة المملكة العربية السعودية، وتختص الجهات القضائية المختصة بالمملكة بالفصل في أي نزاع ينشأ عنه.</p>`,
        en: `<p>This Agreement is governed by the laws of the Kingdom of Saudi Arabia, and the competent judicial authorities in the Kingdom have jurisdiction over any dispute arising from it.</p>`,
        fr: `<p>Le présent contrat est régi par les lois du Royaume d'Arabie saoudite ; les autorités judiciaires compétentes du Royaume connaissent de tout litige en découlant.</p>`,
        zh: `<p>本合同适用沙特阿拉伯王国法律，因本合同产生的任何争议由王国有管辖权的司法机关管辖。</p>`,
      }[l]) },
  );
  return list;
}

export function contractHtml({ ref, clientName, clientCr = "", clientVat = "", service, lines = [], net, vat, total, vatRate = 15, leadTime = "", executor = "", today = "", subscription = null, lang = "ar" }) {
  const L = LANGS.indexOf(String(lang || "ar")) >= 0 ? String(lang) : "ar";
  const cols = L === "ar" ? ["ar"] : ["ar", L];
  const sub = subscription && Number(subscription.renewsAt) > 0 ? subscription : null;

  // سطر البند: القيمة تُقرأ من line المحسوبة في عرض السعر، وإن غابت فمن
  // price×qty. قراءة price وحده — والحقل الوارد هو amount — كانت تكتب صفراً
  // في كل سطرٍ من العقد بينما عرض السعر يعرض المبالغ صحيحة.
  const lineTotal = (l) => {
    const q = Number(l.qty) || 1;
    const v = [l.line, l.amount, (Number(l.price) || 0) * q].find((x) => Number(x) > 0);
    return Number(v) || 0;
  };
  const rows = (l) => (lines || []).length
    ? lines.map((it) => `<tr><td>${esc((l === "ar" ? (it.name || it.title) : (it.nameEn || it.titleEn || it.name || it.title)) || "")}</td><td class="c">${Number(it.qty) || 1}</td><td class="e">${money(lineTotal(it))} ${tx("sar", l)}</td></tr>`).join("")
    : `<tr><td colspan="3">${esc(service || "")}</td></tr>`;

  const list = clauses({
    esc, net, vat, total, vatRate, leadTime, executor, clientName, clientCr, clientVat,
    legalName: LEGAL_NAME, unified: UNIFIED_NUMBER, vatNo: VAT_NUMBER, rows, sub,
    pct: sub ? Number(sub.commissionPercent) || 0 : 0,
  });

  const ORD = { ar: ORDINALS, en: null, fr: null, zh: null };
  const heading = (i, l) => (l === "ar" ? (ORD.ar[i] || i + 1) + ": " : `${i + 1}. `);

  const body = list.map((sec, i) => `<section class="cl">${cols.map((l) => `
  <div class="col ${l === "ar" ? "a" : "b"}" dir="${DOC_DIR[l]}" lang="${l}">
    <h2>${heading(i, l)}${esc(sec.t[l] || sec.t.ar)}</h2>
    ${sec.h(l)}
  </div>`).join("")}</section>`).join("\n");

  const head = cols.map((l) => `
  <div class="col ${l === "ar" ? "a" : "b"}" dir="${DOC_DIR[l]}" lang="${l}">
    <h1>${esc(tx("title", l))}</h1>
    <p class="muted">${esc(tx("refLbl", l))}: <b>${esc(ref)}</b> — ${esc(tx("dateLbl", l))}: ${esc(today)}</p>
  </div>`).join("");

  const signBlock = cols.map((l) => `
  <div class="col ${l === "ar" ? "a" : "b"}" dir="${DOC_DIR[l]}" lang="${l}">
    <p><b>${esc(tx("signBy", l))}: ${esc(clientName)}</b></p>
    <p>${esc(tx("sign", l))}: ${l === "ar" ? "/sig1/" : "&nbsp;"}</p>
    <p>${esc(tx("sdate", l))}: ${l === "ar" ? "/date1/" : "&nbsp;"}</p>
  </div>`).join("");

  return docPage({ L, cols, head, body, foot: `<div class="sign">${signBlock}</div>` });
}

// قشرة المستند: نفس الورقة للعرض والعقد — عمود عربي حاكم، وعمودٌ بلغة
// العميل بجانبه، وتنسيقُ طباعةٍ يخرج A4 كاملاً لا مقصوصاً في نافذة.
function docPage({ L, cols, head, body, foot }) {
  const two = cols.length === 2;
  return `<!DOCTYPE html><html dir="${DOC_DIR[L]}" lang="${L}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
 :root{--line:#dbe1ec;--ink:#1F2430;--nav:#0B1B5A;--mut:#64748b}
 *{box-sizing:border-box}
 body{font-family:"IBM Plex Sans Arabic",Arial,"Traditional Arabic",sans-serif;color:var(--ink);
   line-height:1.9;font-size:13.5px;margin:0;padding:34px;background:#fff}
 h1{color:var(--nav);font-size:21px;margin:0 0 4px}
 h2{color:var(--nav);font-size:14.5px;margin:0 0 6px}
 p{margin:0 0 9px} ol{padding-inline-start:20px;margin:0 0 9px}
 table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12.5px}
 td,th{border:1px solid var(--line);padding:8px 10px;vertical-align:top}
 th{background:#f1f5f9} .c{text-align:center} .e{text-align:end;white-space:nowrap}
 tfoot td{background:#f8fafc;font-weight:700} tfoot tr:last-child td{font-size:14px;color:var(--nav)}
 .muted{color:var(--mut);font-size:12px}
 .cl{display:grid;grid-template-columns:${two ? "1fr 1fr" : "1fr"};gap:0;
   border-top:1px solid #eef1f7;padding:14px 0;break-inside:avoid}
 .cl:first-of-type{border-top:0}
 .col{padding:0 ${two ? "20px" : "0"};min-width:0}
 ${two ? ".col.b{border-inline-start:1px solid #eef1f7}" : ""}
 .doc-head{display:grid;grid-template-columns:${two ? "1fr 1fr" : "1fr"};gap:0;
   padding-bottom:14px;border-bottom:2px solid var(--nav)}
 .sign{display:grid;grid-template-columns:${two ? "1fr 1fr" : "1fr"};gap:0;
   margin-top:30px;border-top:1px solid var(--line);padding-top:18px;break-inside:avoid}
 .gov{margin-top:16px;font-size:11.5px;color:var(--mut);text-align:center}
 @media print{@page{size:A4;margin:14mm}
   body{padding:0;font-size:11px} h1{font-size:17px} h2{font-size:12px} .cl{padding:10px 0}}
 @media(max-width:760px){.cl,.doc-head,.sign{grid-template-columns:1fr}
   .col{padding:0} .col.b{border-inline-start:0;border-top:1px solid #eef1f7;margin-top:10px;padding-top:10px}}
</style></head><body>
<div class="doc-head">${head}</div>

${body}

${foot || ""}
${two ? `<p class="gov">${esc(tx("govern", "ar"))} · ${esc(tx("govern", L))}</p>` : ""}
</body></html>`;
}

// ---- envelopes -------------------------------------------------------------

/**
 * Create and send the contract for signature.
 * @returns {{envelopeId:string, status:string, uri:string}}
 */
export async function docusignSendContract({ ref, email, clientName, subject, html }) {
  if (!docusignConfigured()) throw new Error("docusign_not_configured");
  const body = {
    emailSubject: String(subject || `عقد تقديم خدمات — ${ref}`).slice(0, 100),
    status: "sent",
    documents: [{
      documentBase64: Buffer.from(html, "utf8").toString("base64"),
      name: `عقد ${ref}`,
      fileExtension: "html",
      documentId: "1",
    }],
    recipients: {
      signers: [{
        email: String(email || "").trim(),
        name: String(clientName || "").slice(0, 100) || "العميل",
        recipientId: "1",
        routingOrder: "1",
        // Anchors, not coordinates: the fields follow the text.
        tabs: {
          signHereTabs: [{ anchorString: "/sig1/", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "0" }],
          dateSignedTabs: [{ anchorString: "/date1/", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "0" }],
        },
      }],
    },
    // Ties the envelope back to the order without a lookup table of our own.
    customFields: { textCustomFields: [{ name: "bp_ref", value: String(ref || "").slice(0, 100), show: "false" }] },
  };
  const out = await dsFetch("/envelopes", { method: "POST", body });
  return { envelopeId: out.envelopeId, status: out.status, uri: out.uri || "" };
}

/** Where an envelope has got to, and who has done what. */
export async function docusignStatus(envelopeId) {
  const e = await dsFetch(`/envelopes/${encodeURIComponent(envelopeId)}`);
  let recipients = null;
  try { recipients = await dsFetch(`/envelopes/${encodeURIComponent(envelopeId)}/recipients`); } catch { recipients = null; }
  const signers = ((recipients && recipients.signers) || []).map((s) => ({
    name: s.name, email: s.email, status: s.status, signedAt: s.signedDateTime || "",
  }));
  return {
    envelopeId,
    status: e.status,
    sentAt: e.sentDateTime || "",
    completedAt: e.completedDateTime || "",
    signers,
  };
}

/** The signed document itself, so the completed contract can be filed and sent. */
export async function docusignSignedPdf(envelopeId) {
  const token = await docusignToken();
  const r = await fetch(`${API_BASE}/v2.1/accounts/${ACCOUNT_ID}/envelopes/${encodeURIComponent(envelopeId)}/documents/combined`, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/pdf" },
  });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  // Magic bytes decide, so an error page never goes out named ".pdf".
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
  return { base64: buf.toString("base64"), bytes: buf.length };
}

/**
 * Whether the private key is usable, decided by signing with it — not by
 * looking at it. This runs entirely locally, so it separates "the key is
 * wrong" from "consent is missing" from "the network failed", which otherwise
 * all arrive as one indistinguishable failure.
 *
 * Describes shape, never content: length and structure only, never a byte of
 * the key itself.
 */
export function docusignKeyCheck() {
  const raw = PRIVATE_KEY;
  if (!raw) return { present: false };
  const out = {
    present: true,
    chars: raw.length,
    lines: raw.split("\n").length,
    hasBegin: /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(raw),
    hasEnd: /-----END [A-Z ]*PRIVATE KEY-----/.test(raw),
    // Pasting the public half is the single most common mistake here: both
    // appear on the same DocuSign screen, seconds apart, and they look alike.
    looksPublic: /-----BEGIN [A-Z ]*PUBLIC KEY-----/.test(raw),
    // A key pasted into a single-line field arrives with its newlines eaten,
    // and every parser rejects it for a reason that never mentions newlines.
    singleLine: raw.split("\n").length <= 2 && raw.length > 200,
  };
  if (out.looksPublic) return { ...out, usable: false, why: "هذا هو المفتاح العام لا الخاص — انسخ الجزء الذي يبدأ بـ BEGIN RSA PRIVATE KEY." };
  if (!out.hasBegin || !out.hasEnd) return { ...out, usable: false, why: "المفتاح ناقص — لا بد أن يشمل سطر BEGIN وسطر END وكل ما بينهما." };
  if (out.singleLine) return { ...out, usable: false, why: "المفتاح لُصق في سطر واحد وفقد فواصل الأسطر — أعد لصقه كما هو بأسطره." };
  try {
    const key = createPrivateKey(raw);
    const signer = createSign("RSA-SHA256");
    signer.update("bp-key-check");
    signer.end();
    signer.sign(key);
    return { ...out, usable: true, type: key.asymmetricKeyType, bits: key.asymmetricKeyDetails && key.asymmetricKeyDetails.modulusLength };
  } catch (e) {
    return { ...out, usable: false, why: `المفتاح غير مقروء: ${String(e.message || e).slice(0, 120)}` };
  }
}

/**
 * Read-only reachability check for the panel: does the key authenticate, and
 * which account does it land in. Reports the consent URL when that is what is
 * missing, since it is the first thing that blocks a new integration.
 */
// "Missing" hides two different problems with two different fixes: a variable
// that never reached this environment, and one that arrived carrying nothing.
// Telling them apart is the whole diagnosis, so it is reported rather than
// left to be guessed at.
const rawState = (n) => {
  const v = process.env[n];
  if (v === undefined) return "not_set";                  // not exposed to this environment
  if (String(v).trim() === "") return "empty";            // exists, holds nothing
  return "set";
};

export async function docusignPing() {
  const vars = {
    DOCUSIGN_INTEGRATION_KEY: rawState("DOCUSIGN_INTEGRATION_KEY"),
    DOCUSIGN_USER_ID: rawState("DOCUSIGN_USER_ID"),
    DOCUSIGN_ACCOUNT_ID: rawState("DOCUSIGN_ACCOUNT_ID"),
    DOCUSIGN_PRIVATE_KEY: rawState("DOCUSIGN_PRIVATE_KEY"),
    DOCUSIGN_ENV: rawState("DOCUSIGN_ENV"),
  };
  if (!docusignConfigured()) {
    return {
      ok: false, error: "docusign_not_configured", vars,
      missing: [
        !INTEGRATION_KEY && "DOCUSIGN_INTEGRATION_KEY",
        !USER_ID && "DOCUSIGN_USER_ID",
        !ACCOUNT_ID && "DOCUSIGN_ACCOUNT_ID",
        !PRIVATE_KEY && "DOCUSIGN_PRIVATE_KEY",
      ].filter(Boolean),
    };
  }
  const key = docusignKeyCheck();
  // The two GUIDs are checked for shape before anything is sent: an account id
  // that is really the short numeric one, or an email pasted where the user
  // GUID belongs, both fail at DocuSign with a message that names neither.
  const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const shape = {
    userIdLooksGuid: GUID.test(USER_ID),
    accountIdLooksGuid: GUID.test(ACCOUNT_ID),
    integrationKeyLooksGuid: GUID.test(INTEGRATION_KEY),
  };
  if (!key.usable) {
    return { ok: false, error: "docusign_bad_key", key, shape, vars, detail: key.why || "المفتاح الخاص غير صالح." };
  }
  try {
    await docusignToken();
    const acct = await dsFetch("");
    return { ok: true, env: docusignEnv(), accountName: acct && acct.accountName, accountId: ACCOUNT_ID, base: API_BASE, key, shape, vars };
  } catch (e) {
    return { ok: false, error: String(e.message || e), detail: String(e.detail || "").slice(0, 400), key, shape, vars, consentUrl: e.message === "docusign_consent_required" ? consentUrl() : undefined };
  }
}


const Q_TX = {
  title:   { ar: "عرض سعر", en: "Quotation", fr: "Devis", zh: "报价单" },
  qref:    { ar: "رقم العرض", en: "Quotation No.", fr: "N° du devis", zh: "报价单号" },
  reqref:  { ar: "رقم الطلب", en: "Request", fr: "Demande", zh: "请求编号" },
  to:      { ar: "مقدَّم إلى", en: "Prepared for", fr: "Établi pour", zh: "致" },
  from:    { ar: "مقدَّم من", en: "Prepared by", fr: "Établi par", zh: "由" },
  net:     { ar: "الإجمالي قبل الضريبة", en: "Subtotal before VAT", fr: "Total hors TVA", zh: "税前合计" },
  vatL:    { ar: "ضريبة القيمة المضافة ١٥٪", en: "VAT 15%", fr: "TVA 15 %", zh: "增值税 15%" },
  totalL:  { ar: "الإجمالي شامل الضريبة", en: "Total incl. VAT", fr: "Total TTC", zh: "含税总额" },
  valid:   { ar: "صالح حتى", en: "Valid until", fr: "Valable jusqu'au", zh: "有效期至" },
  terms:   { ar: "شروط الدفع", en: "Payment terms", fr: "Conditions de paiement", zh: "付款条件" },
  notes:   { ar: "ملاحظات", en: "Notes", fr: "Remarques", zh: "备注" },
  govFee:  { ar: "لا تشمل هذه الأسعار الرسوم الحكومية ما لم يُنص عليها صراحةً في بنود العرض.",
             en: "These prices exclude government fees unless a line above states otherwise.",
             fr: "Ces prix excluent les frais gouvernementaux, sauf mention expresse dans les lignes ci-dessus.",
             zh: "除上述条目另有明确说明外，本报价不含政府规费。" },
};
const qtx = (k, l) => (Q_TX[k] && (Q_TX[k][l] || Q_TX[k].ar)) || "";

export function quoteHtml({ ref, number, clientName, clientCr = "", clientVat = "", items = [], net, vat, total,
                            validUntil = "", paymentTerms = "", notes = "", today = "", lang = "ar" }) {
  const L = LANGS.indexOf(String(lang || "ar")) >= 0 ? String(lang) : "ar";
  const cols = L === "ar" ? ["ar"] : ["ar", L];
  const lineTotal = (l) => {
    const q = Number(l.qty) || 1;
    const v = [l.line, l.amount, (Number(l.price) || 0) * q].find((x) => Number(x) > 0);
    return Number(v) || 0;
  };
  const head = cols.map((l) => `
  <div class="col ${l === "ar" ? "a" : "b"}" dir="${DOC_DIR[l]}" lang="${l}">
    <h1>${esc(qtx("title", l))}</h1>
    <p class="muted">${esc(qtx("qref", l))}: <b>${esc(number || "")}</b> — ${esc(qtx("reqref", l))}: ${esc(ref)} — ${esc(tx("dateLbl", l))}: ${esc(today)}</p>
  </div>`).join("");

  const parties = `<section class="cl">${cols.map((l) => `
  <div class="col ${l === "ar" ? "a" : "b"}" dir="${DOC_DIR[l]}" lang="${l}">
    <h2>${esc(qtx("from", l))}</h2>
    <p>${esc(LEGAL_NAME)}${UNIFIED_NUMBER ? `<br>${l === "ar" ? "الرقم الموحد" : "Unified No."}: ${esc(UNIFIED_NUMBER)}` : ""}${VAT_NUMBER ? `<br>${l === "ar" ? "الرقم الضريبي" : "VAT No."}: ${esc(VAT_NUMBER)}` : ""}</p>
    <h2>${esc(qtx("to", l))}</h2>
    <p>${esc(clientName)}${clientCr ? `<br>${l === "ar" ? "سجل تجاري" : "CR No."}: ${esc(clientCr)}` : ""}${clientVat ? `<br>${l === "ar" ? "الرقم الضريبي" : "VAT No."}: ${esc(clientVat)}` : ""}</p>
  </div>`).join("")}</section>`;

  const rows = (l) => (items || []).map((it) => `<tr><td><b>${esc((l === "ar" ? (it.title || it.name) : (it.titleEn || it.nameEn || it.title || it.name)) || "")}</b>${it.description ? `<br><span class="muted">${esc(it.description)}</span>` : ""}${it.code ? `<br><span class="muted">${esc(it.code)}</span>` : ""}</td><td class="c">${Number(it.qty) || 1}</td><td class="e">${money(lineTotal(it))} ${tx("sar", l)}</td></tr>`).join("");
  const table = (l) => `<table><thead><tr><th>${tx("item", l)}</th><th class="c">${tx("qty", l)}</th><th class="e">${tx("value", l)}</th></tr></thead>
<tbody>${rows(l)}</tbody>
<tfoot>
 <tr><td colspan="2">${qtx("net", l)}</td><td class="e">${money(net)} ${tx("sar", l)}</td></tr>
 <tr><td colspan="2">${qtx("vatL", l)}</td><td class="e">${money(vat)} ${tx("sar", l)}</td></tr>
 <tr><td colspan="2">${qtx("totalL", l)}</td><td class="e">${money(total)} ${tx("sar", l)}</td></tr>
</tfoot></table>`;

  const scope = `<section class="cl">${cols.map((l) => `
  <div class="col ${l === "ar" ? "a" : "b"}" dir="${DOC_DIR[l]}" lang="${l}">
    <h2>${esc(tx("item", l))}</h2>${table(l)}
  </div>`).join("")}</section>`;

  const terms = `<section class="cl">${cols.map((l) => `
  <div class="col ${l === "ar" ? "a" : "b"}" dir="${DOC_DIR[l]}" lang="${l}">
    ${validUntil ? `<p><b>${esc(qtx("valid", l))}:</b> ${esc(validUntil)}</p>` : ""}
    ${paymentTerms ? `<p><b>${esc(qtx("terms", l))}:</b> ${esc(paymentTerms)}</p>` : ""}
    ${notes ? `<p><b>${esc(qtx("notes", l))}:</b> ${esc(notes)}</p>` : ""}
    <p class="muted">${esc(qtx("govFee", l))}</p>
  </div>`).join("")}</section>`;

  return docPage({ L, cols, head, body: parties + scope + terms, foot: "" });
}
