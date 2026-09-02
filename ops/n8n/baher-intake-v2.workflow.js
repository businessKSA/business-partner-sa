/**
 * BP — باهر v2: من الويبهوك إلى جلسة Managed Agents
 * يستبدل نداء chainLlm القديم في baher-intake. أي رسالة عميل (من واتساب، الموقع، أو تحويل المالك)
 * تفتح جلسة لباهر المنسّق مع فريقه. الرد للعميل لا يعود عبر هذا الويبهوك بل يرسله الوكيل نفسه
 * عبر bp-agent-send، لذا الاستجابة هنا فورية (تأكيد استلام فقط).
 *
 * Body: { message, client_name?, phone?, channel?, crm_lead_id?, history?: [{role,text}] }
 * المعرّفات تُنسخ من agents/ids.env وagents/.env بعد تشغيل apply.sh وvault.sh
 */
import { workflow, node, trigger, sticky, newCredential, expr } from '@n8n/workflow-sdk';

const IDS = {
  AGENT_BAHER: 'REPLACE_WITH_AGENT_BAHER',
  ENV_ID: 'REPLACE_WITH_ENV_ID',
  MEMORY_STORE_ID: 'REPLACE_WITH_MEMORY_STORE_ID',
  VAULT_ID: 'REPLACE_WITH_VAULT_ID',
};
const SESSION_BUDGET_CENTS = '300'; // سقف 3 دولار لكل رسالة عميل

const receive = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'استقبال (baher-intake-v2)',
    position: [-460, 0],
    parameters: {
      httpMethod: 'POST',
      path: 'baher-intake-v2',
      authentication: 'headerAuth',
      responseMode: 'onReceived',
      options: { ignoreBots: true },
    },
    credentials: { httpHeaderAuth: newCredential('BP — مفتاح الوكلاء (X-BP-Agent-Key)') },
  },
  output: [{ body: { message: 'أبغى أأسس شركة', client_name: 'أحمد', phone: '966500000000', channel: 'whatsapp' } }],
});

const buildSession = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'ابنِ طلب الجلسة',
    position: [-240, 0],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const IDS = ${JSON.stringify(IDS)};
const BUDGET = ${JSON.stringify(SESSION_BUDGET_CENTS)};
const b = $input.first().json.body || {};
const message = String(b.message || '').trim();
if (!message) return [];
const channel = String(b.channel || 'whatsapp');
const lines = [
  'رسالة واردة من عميل عبر ' + channel + '.',
  b.client_name ? 'الاسم: ' + b.client_name : null,
  b.phone ? 'الجوال (للرد عبر bp-agent-send): ' + String(b.phone).replace(/[^0-9]/g, '') : null,
  b.crm_lead_id ? 'معرّف CRM: ' + b.crm_lead_id : null,
  Array.isArray(b.history) && b.history.length
    ? 'سجل المحادثة السابقة (للسياق):\\n' + b.history.map(x => (x.role === 'user' ? 'العميل: ' : 'نحن: ') + String(x.text || '').slice(0, 500)).join('\\n')
    : null,
  '',
  'رسالة العميل الآن:',
  message,
  '',
  'كلّف مازن بالرد عليه وتسجيله، وحوّل لبدر إن كانت فرصة مكتملة. الرد للعميل يُرسل عبر bp-agent-send.',
].filter(x => x !== null);
const body = {
  agent: IDS.AGENT_BAHER,
  environment_id: IDS.ENV_ID,
  title: (b.client_name ? b.client_name + ' — ' : '') + message.slice(0, 60),
  vault_ids: IDS.VAULT_ID ? [IDS.VAULT_ID] : [],
  resources: [{
    type: 'memory_store',
    memory_store_id: IDS.MEMORY_STORE_ID,
    access: 'read_write',
    instructions: 'ذاكرة الفريق. اقرأ README.md أولًا؛ سجّل القرارات والدروس المهمة فقط.',
  }],
  budget: { type: 'limit', max_list_cost: { amount: BUDGET, currency: 'USD' } },
  metadata: { channel, phone: String(b.phone || ''), crm_lead_id: String(b.crm_lead_id || '') },
  initial_events: [{ type: 'user.message', content: [{ type: 'text', text: lines.join('\\n') }] }],
};
return [{ json: { body } }];`,
    },
  },
  output: [{ body: { agent: 'agent_…', environment_id: 'env_…', initial_events: [] } }],
});

const createSession = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'افتح جلسة لباهر (Anthropic)',
    position: [-20, 0],
    parameters: {
      method: 'POST',
      url: 'https://api.anthropic.com/v1/sessions',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpTemplatedCustomAuth',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: {
        parameters: [
          { name: 'anthropic-version', value: '2023-06-01' },
          { name: 'anthropic-beta', value: 'managed-agents-2026-04-01' },
          { name: 'content-type', value: 'application/json' },
        ],
      },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: { timeout: 30000 },
    },
    credentials: { httpTemplatedCustomAuth: newCredential('BP — Anthropic API Key (x-api-key)') },
  },
  output: [{ id: 'sesn_…', status: 'running' }],
});

const logSession = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'سجّل معرّف الجلسة',
    position: [200, 0],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'sid', name: 'session_id', value: expr('{{ $json.id }}'), type: 'string' },
          { id: 'st', name: 'status', value: expr('{{ $json.status }}'), type: 'string' },
          { id: 'url', name: 'trace', value: expr('{{ "https://platform.claude.com/workspaces/default/sessions/" + $json.id }}'), type: 'string' },
        ],
      },
    },
  },
});

const note = sticky(
  '## باهر v2 — جلسة Managed Agents لكل رسالة\n' +
    'قبل التفعيل: (1) شغّل agents/scripts/apply.sh وvault.sh وانسخ المعرّفات إلى IDS أعلى الملف،\n' +
    '(2) أنشئ اعتماد Templated Custom Auth بالقالب {"headers":{"x-api-key":"{{api_key}}"}} بمفتاح Anthropic،\n' +
    '(3) اعتماد Header Auth باسم X-BP-Agent-Key (نفس مفتاح bp-agent-send)،\n' +
    '(4) وجّه BP-WhatsApp-Main إلى /webhook/baher-intake-v2 بدل baher-intake.',
  [receive, buildSession, createSession, logSession],
  { color: 4 },
);

export default workflow('bp-baher-intake-v2', 'BP — باهر v2: استقبال → جلسة الفريق الذكي', { timezone: 'Asia/Riyadh' })
  .add(receive)
  .to(buildSession)
  .to(createSession)
  .to(logSession)
  .add(note);
