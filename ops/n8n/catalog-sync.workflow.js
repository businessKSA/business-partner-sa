import { workflow, node, trigger, sticky, newCredential, expr } from '@n8n/workflow-sdk';

const PANEL = 'https://bp-quotes-three.vercel.app';

const notionPull = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'كل ساعة — اسحب من نوشن',
    position: [-460, -120],
    parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1, triggerAtMinute: 10 }] } },
  },
  output: [{}],
});

const readCatalog = node({
  type: 'n8n-nodes-base.notion',
  version: 3,
  config: {
    name: 'اقرأ كتالوج نوشن الرسمي',
    position: [-240, -120],
    parameters: {
      resource: 'databasePage',
      operation: 'getAll',
      authentication: 'oAuth2',
      dataSourceId: { __rl: true, mode: 'id', value: 'a5ab4695-38fc-48d7-b447-ddd84fa50b03' },
      returnAll: true,
      simple: true,
      filterType: 'none',
      options: {},
    },
    credentials: { notionOAuth2Api: { id: 'USVPflXCkLXwDvRx', name: 'Notion — Business Partner OS — Production' } },
  },
  output: [{ id: '3a6d108d-ee5c-81ed-a844-ebc814a071af', name: 'وكيل الامتثال والالتزام', 'Service Code': 'BP-AI-03' }],
});

const mapToPanel = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'حوّل صفوف نوشن إلى شكل الكتالوج',
    position: [-20, -120],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// كود نوشن هو مفتاح المطابقة. الباقات وحدها تختلف تسميتها بين النظامين،
// فجدول المرادفات هنا ظاهر ويُعدَّل بلا نشر.
const ALIAS = {
  'BP-PKG-LAUNCH': 'PKG-SILVER',
  'BP-PKG-GROWTH': 'PKG-GOLD',
  'BP-PKG-SCALE': 'PKG-PLATINUM',
  'BP-PKG-ENTERPRISE': 'PKG-DIAMOND',
  'BP-PKG-FORM-FOREIGN': 'PKG-FOREIGN-FORMATION',
  'BP-PKG-FORM-SAUDI': 'PKG-SAUDI-GULF-FORMATION',
  'BP-PKG-LEGAL-STRAT': 'PKG-STRATEGIC',
  'BP-PKG-LEGAL-COMP': 'PKG-COMPREHENSIVE',
  'BP-PKG-LEGAL-ADV': 'PKG-ADVANCED',
  'BP-PKG-LEGAL-BASIC': 'PKG-BASIC-LEGAL',
};

// السعر المفتوح: لا رقم، أو تسعير بنسبة من قيمة الصفقة.
// «يبدأ من» لم تعد مفتوحة بقرار المالك — الرقم المنشور هو السعر.
const OPEN_MODELS = ['Percent', 'Custom Pricing'];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const txt = (v) => (v === null || v === undefined ? "" : String(v).trim());

const services = [];
const skipped = [];

for (const item of $input.all()) {
  const r = item.json;
  const rawCode = txt(r['Service Code']).toUpperCase();
  const nameAr = txt(r['اسم الخدمة بالعربي']) || txt(r.name);
  if (!rawCode || !nameAr) {
    skipped.push({ code: rawCode, nameAr, why: "بلا كود أو بلا اسم عربي" });
    continue;
  }
  const code = ALIAS[rawCode] || rawCode;
  const model = txt(r['Pricing Model']);
  const price = num(r['Minimum Price']) || num(r['One-Time Fee']) || num(r['Monthly Fee']);
  const monthly = model === "Monthly";
  services.push({
    code,
    nameAr,
    nameEn: txt(r['Service Name EN']) || nameAr,
    category: txt(r['Service Category']) || 'Uncategorized',
    descAr: txt(r['وصف الخدمة بالعربي']) || txt(r['Description']) || null,
    descEn: txt(r['Description EN']) || null,
    unitPrice: price,
    openPrice: price <= 0 || OPEN_MODELS.indexOf(model) !== -1,
    unitAr: monthly ? 'شهرياً' : 'خدمة',
    unitEn: monthly ? 'per month' : 'service',
    attachGovFees: r['Gov Fees Separate'] === true,
    govPlatform: txt(r['Gov Platform']) || null,
    active: r['Active'] === true,
    notionPageId: txt(r.id).replace(/-/g, ''),
  });
}

return [{ json: { source: "notion", count: services.length, skipped, services } }];`,
    },
  },
  output: [{ source: 'notion', count: 130, skipped: [], services: [{ code: 'BP-AI-03', unitPrice: 250 }] }],
});

const pushToPanel = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'ادفعها إلى كتالوج اللوحة',
    position: [200, -120],
    parameters: {
      method: 'POST',
      url: PANEL + '/api/catalog/sync',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpTemplatedCustomAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json) }}'),
      options: { timeout: 60000, response: { response: { neverError: true, fullResponse: true } } },
    },
    credentials: { httpTemplatedCustomAuth: newCredential('BP — مفتاح مزامنة الكتالوج') },
  },
  output: [{ statusCode: 200, body: { summary: { created: 3, updated: 12, unchanged: 115, rejected: 0 } } }],
});

const pullReport = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'خلاصة السحب',
    position: [420, -120],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const res = $input.first().json;
const body = res.body || res;
const s = body.summary || {};
const rejected = (body.results || []).filter((r) => r.action === "rejected");
return [{ json: {
  direction: "notion → panel",
  httpStatus: res.statusCode || null,
  created: s.created || 0,
  updated: s.updated || 0,
  unchanged: s.unchanged || 0,
  rejected: s.rejected || 0,
  rejectedRows: rejected,
  at: new Date().toISOString(),
} }];`,
    },
  },
  output: [{ direction: 'notion → panel', created: 3, updated: 12, rejected: 0 }],
});

const panelChanged = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'تغيّر سعر في اللوحة',
    position: [-460, 300],
    parameters: {
      httpMethod: 'POST',
      path: 'bp-catalog-changed',
      authentication: 'none',
      responseMode: 'onReceived',
      options: { responseData: '{"ok":true}' },
    },
  },
  output: [{ body: { codes: ['BP-AI-03'], source: 'panel', actor: 'admin' } }],
});

const readPanel = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'اقرأ الجرد الكامل من اللوحة',
    position: [-240, 300],
    executeOnce: true,
    parameters: {
      method: 'GET',
      url: PANEL + '/api/catalog/full',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpTemplatedCustomAuth',
      options: { timeout: 60000 },
    },
    credentials: { httpTemplatedCustomAuth: newCredential('BP — مفتاح مزامنة الكتالوج') },
  },
  output: [{ counts: { total: 129 }, services: [{ code: 'BP-AI-03', priceExclVat: 250 }] }],
});

const pickChanged = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'اختر الصفوف المتغيّرة ذات صفحة نوشن',
    position: [-20, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// الخدمات التي أبلغت اللوحة بتغيّرها. بلا قائمة أكواد تُحدَّث كلها.
const hook = $("تغيّر سعر في اللوحة").first().json;
const asked = (hook.body && hook.body.codes) || hook.codes || [];
const wanted = new Set(asked.map((c) => String(c).toUpperCase()));

const all = $input.first().json.services || [];
const rows = [];
const unlinked = [];

for (const s of all) {
  if (wanted.size && !wanted.has(String(s.code).toUpperCase())) continue;
  const links = s.links || {};
  const pageId = links.notion ? String(links.notion).split("/").pop() : null;
  if (!pageId) { unlinked.push(s.code); continue; }
  const methods = (s.paymentMethods || []).map((m) => m.ar).join(" · ");
  rows.push({ json: {
    code: s.code,
    notionPageId: pageId,
    priceExclVat: s.priceExclVat,
    priceInclVat: s.priceInclVat,
    active: s.active,
    openPrice: s.openPrice,
    autoIssue: s.autoIssue === true,
    siteUrl: links.site || "",
    panelUrl: links.panel || "",
    quoteUrl: links.portal || "",
    paymentMethods: methods,
    unlinkedInThisRun: unlinked,
  } });
}

// خدمة بلا صفحة نوشن لا تُنشأ هنا بصمت — تُذكر في مخرجات التشغيل.
if (!rows.length) return [{ json: { nothingToUpdate: true, unlinked } }];
return rows;`,
    },
  },
  output: [{ code: 'BP-AI-03', notionPageId: '3a6d108dee5c81eda844ebc814a071af', priceExclVat: 250, active: true }],
});

const writeNotion = node({
  type: 'n8n-nodes-base.notion',
  version: 3,
  config: {
    name: 'حدّث صف نوشن بالسعر الجديد',
    position: [200, 300],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'databasePage',
      operation: 'update',
      authentication: 'oAuth2',
      pageId: { __rl: true, mode: 'id', value: expr('{{ $json.notionPageId }}') },
      simple: true,
      propertiesUi: {
        propertyValues: [
          { key: 'Minimum Price|number', numberValue: expr('{{ $json.priceExclVat }}') },
          { key: 'Active|checkbox', checkboxValue: expr('{{ $json.active }}') },
          { key: 'Auto Issue|checkbox', checkboxValue: expr('{{ $json.autoIssue }}') },
          { key: 'Panel Code|rich_text', textContent: expr('{{ $json.code }}') },
          { key: 'Site URL|url', urlValue: expr('{{ $json.siteUrl }}'), ignoreIfEmpty: true },
          { key: 'Panel URL|url', urlValue: expr('{{ $json.panelUrl }}'), ignoreIfEmpty: true },
          { key: 'Quote URL|url', urlValue: expr('{{ $json.quoteUrl }}'), ignoreIfEmpty: true },
          { key: 'Payment Methods|rich_text', textContent: expr('{{ $json.paymentMethods }}') },
          { key: 'Sync Source|select', selectValue: 'panel' },
          { key: 'Last Updated|date', includeTime: false, date: expr('{{ $now.toISO() }}') },
          { key: 'Internal Notes|rich_text', textContent: expr('حُدِّث من لوحة العروض — {{ $json.code }} — السعر شامل الضريبة {{ $json.priceInclVat }} — {{ $now.toFormat("yyyy-MM-dd HH:mm") }}') },
        ],
      },
      options: {},
    },
    credentials: { notionOAuth2Api: { id: 'USVPflXCkLXwDvRx', name: 'Notion — Business Partner OS — Production' } },
  },
  output: [{ id: '3a6d108d-ee5c-81ed-a844-ebc814a071af', name: 'وكيل الامتثال والالتزام' }],
});

const rebuildSite = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'أعد نشر الموقع التعريفي',
    position: [420, 300],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://api.vercel.com/v1/integrations/deploy/REPLACE_WITH_VERCEL_DEPLOY_HOOK',
      sendBody: false,
      options: { timeout: 30000, response: { response: { neverError: true, fullResponse: true } } },
    },
  },
  output: [{ statusCode: 201, body: { job: { state: 'PENDING' } } }],
});

const noteTop = sticky(
  '## نوشن ← اللوحة (كل ساعة)\n' +
    'كتالوج نوشن الرسمي هو سطح التحرير البشري. يُقرأ كل ساعة، تُطابَق صفوفه بالكود، ويُدفع إلى اللوحة.\n' +
    'الباقات تختلف تسميتها بين النظامين، وجدول المرادفات داخل عقدة التحويل.',
  [notionPull, readCatalog, mapToPanel, pushToPanel, pullReport],
  { color: 4 },
);

const noteBottom = sticky(
  '## اللوحة ← نوشن + الموقع (فوري)\n' +
    'أي حفظ في /admin/catalog يستدعي هذا الويبهوك، فيُحدَّث صف نوشن ويُعاد نشر الموقع.\n' +
    'ضع رابط Deploy Hook من Vercel في العقدة الأخيرة قبل تفعيلها.',
  [panelChanged, readPanel, pickChanged, writeNotion, rebuildSite],
  { color: 3 },
);

export default workflow('bp-catalog-sync', 'BP — مزامنة الكتالوج: نوشن ⇄ اللوحة ⇄ الموقع')
  .add(notionPull)
  .to(readCatalog)
  .to(mapToPanel)
  .to(pushToPanel)
  .to(pullReport)
  .add(panelChanged)
  .to(readPanel)
  .to(pickChanged)
  .to(writeNotion)
  .to(rebuildSite)
  .add(noteTop)
  .add(noteBottom);
