/**
 * BP — قناة إرسال الوكلاء (bp-agent-send)
 * الوكلاء الأذكياء (Managed Agents: باهر، مازن، بدر، فرح، محمد) لا يملكون توكن واتساب.
 * عندما يريد أحدهم مراسلة عميل أو المالك، ينادي هذا الويبهوك بمفتاح X-BP-Agent-Key،
 * وn8n هو من يرسل فعليًا عبر WhatsApp Cloud. الحوكمة (لا التزامات مالية) في برومبت الوكيل نفسه.
 *
 * Body: { channel: "whatsapp", to: "9665xxxxxxxx" | "OWNER", text: "...", agent: "mazen" }
 */
import { workflow, node, trigger, sticky, newCredential, ifElse, expr } from '@n8n/workflow-sdk';

// رقم المالك الدولي بلا + (يُملأ قبل التفعيل). "OWNER" في الطلب يُستبدل به.
const OWNER_WHATSAPP = 'REPLACE_WITH_OWNER_WHATSAPP';
// Phone Number ID لرقم +966507034157 (نفس المستخدم في BP-WhatsApp-Main)
const WA_PHONE_NUMBER_ID = '126029938250852';

const receive = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'استقبال طلب إرسال من وكيل',
    position: [-460, 0],
    parameters: {
      httpMethod: 'POST',
      path: 'bp-agent-send',
      authentication: 'headerAuth',
      responseMode: 'onReceived',
      options: { ignoreBots: true },
    },
    credentials: { httpHeaderAuth: newCredential('BP — مفتاح الوكلاء (X-BP-Agent-Key)') },
  },
  output: [{ body: { channel: 'whatsapp', to: '966500000000', text: 'مرحبًا', agent: 'mazen' } }],
});

const normalize = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'طبّع الطلب',
    position: [-240, 0],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const OWNER = ${JSON.stringify(OWNER_WHATSAPP)};
const b = $input.first().json.body || {};
let to = String(b.to || '').trim();
if (to === 'OWNER') to = OWNER;
to = to.replace(/[^0-9]/g, '');
const text = String(b.text || '').trim().slice(0, 4000);
const channel = String(b.channel || 'whatsapp').toLowerCase();
const agent = String(b.agent || 'unknown');
if (!to || !text) return [];
return [{ json: { channel, to, text, agent, sent_at: new Date().toISOString() } }];`,
    },
  },
  output: [{ channel: 'whatsapp', to: '966500000000', text: 'مرحبًا', agent: 'mazen' }],
});

const isWhatsApp = ifElse({
  version: 2.3,
  config: {
    name: 'واتساب؟',
    position: [-20, 0],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          { leftValue: expr('{{ $json.channel }}'), rightValue: 'whatsapp', operator: { type: 'string', operation: 'equals' } },
        ],
        combinator: 'and',
      },
    },
  },
});

const sendWhatsApp = node({
  type: 'n8n-nodes-base.whatsApp',
  version: 1.1,
  config: {
    name: 'أرسل واتساب',
    position: [220, -100],
    parameters: {
      resource: 'message',
      operation: 'send',
      phoneNumberId: WA_PHONE_NUMBER_ID,
      recipientPhoneNumber: expr('{{ $json.to }}'),
      messageType: 'text',
      textBody: expr('{{ $json.text }}'),
    },
    credentials: { whatsAppApi: newCredential('BP — WhatsApp Cloud') },
  },
  output: [{ messages: [{ id: 'wamid.…' }] }],
});

const unsupported = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'قناة غير مدعومة بعد',
    position: [220, 100],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [{ id: 'err', name: 'error', value: expr('{{ "unsupported channel: " + $json.channel }}'), type: 'string' }],
      },
    },
  },
});

const note = sticky(
  '## قناة إرسال الوكلاء\n' +
    'الوكلاء الأذكياء ينادون هذا الويبهوك بمفتاح X-BP-Agent-Key المحفوظ في خزنة Anthropic.\n' +
    'قبل التفعيل: (1) أنشئ اعتماد Header Auth باسم X-BP-Agent-Key وقيمة = BP_N8N_HOOK_KEY في agents/.env،\n' +
    '(2) اربط اعتماد WhatsApp Cloud، (3) ضع رقم المالك في OWNER_WHATSAPP.',
  [receive, normalize, isWhatsApp, sendWhatsApp, unsupported],
  { color: 4 },
);

export default workflow('bp-agent-send', 'BP — قناة إرسال الوكلاء (واتساب)', { timezone: 'Asia/Riyadh' })
  .add(receive)
  .to(normalize)
  .to(isWhatsApp.onTrue(sendWhatsApp).onFalse(unsupported))
  .add(note);
