import { workflow, node, trigger, sticky, newCredential, expr } from '@n8n/workflow-sdk';

// قناة واتساب للوكيل الذكي للمستندات: العميل يرسل «عندي هذي الملفات أبغى
// أعبيها» ومعها الملفات، وn8n يمررها إلى محرك الوكيل في الموقع
// (POST /api/doc-agent بمفتاح X-Doc-Agent-Key) ويعيد رد الوكيل نفسه إلى
// واتساب. المحادثة نفسها تُخزَّن في doc_agent_messages بقناة whatsapp،
// فإذا فتح العميل الموقع لاحقاً وجد الطلب نفسه مستمراً (Conversation ID
// واحد عبر القنوات — الطلب يُلتقط برقم جوال العميل contact).

const SITE = 'https://businesspartner.sa';

const waIn = trigger({
  type: 'n8n-nodes-base.whatsAppTrigger',
  version: 1,
  config: {
    name: 'رسالة واتساب واردة',
    position: [-620, 0],
    parameters: { updates: ['messages'] },
    credentials: { whatsAppTriggerApi: { id: 'REPLACE_WITH_WA_TRIGGER_CRED', name: 'BP — WhatsApp Cloud' } },
  },
  output: [{ messages: [{ from: '9665xxxxxxxx', type: 'text', text: { body: 'عندي هذي الملفات أبغى أعبيها' } }] }],
});

const normalize = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'طبّع الرسالة: جوال ونص ووسائط',
    position: [-400, 0],
    parameters: {
      jsCode: `
// رسالة Cloud API تصل نصاً أو وثيقة/صورة برقم وسائط يُسحب من Graph لاحقاً.
const m = ($json.messages || [])[0] || {};
const media = m.document || m.image || null;
return [{ json: {
  contact: 'wa:' + String(m.from || ''),
  message: (m.text && m.text.body) || (media && media.caption) || '',
  mediaId: media ? media.id : '',
  fileName: (media && media.filename) || (media ? 'whatsapp-upload' : ''),
  fileType: (media && media.mime_type) || '',
} }];`,
    },
  },
  output: [{ contact: 'wa:9665xxxxxxxx', message: 'عندي هذي الملفات أبغى أعبيها', mediaId: '', fileName: '', fileType: '' }],
});

const hasMedia = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: {
    name: 'فيها ملف؟',
    position: [-180, 0],
    parameters: {
      conditions: {
        options: { caseSensitive: true, typeValidation: 'strict', version: 2 },
        combinator: 'and',
        conditions: [{ operator: { type: 'string', operation: 'notEmpty', singleValue: true }, leftValue: expr('{{ $json.mediaId }}') }],
      },
    },
  },
  output: [{}, {}],
});

const fetchMediaUrl = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'اسحب رابط الوسائط من Graph',
    position: [40, -120],
    parameters: {
      url: expr('=https://graph.facebook.com/v20.0/{{ $json.mediaId }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: {},
    },
    credentials: { httpHeaderAuth: { id: 'REPLACE_WITH_WA_TOKEN_CRED', name: 'BP — WhatsApp Bearer' } },
  },
  output: [{ url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/…' }],
});

const fetchMediaBytes = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'نزّل الملف نفسه',
    position: [240, -120],
    parameters: {
      url: expr('={{ $json.url }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: { response: { response: { responseFormat: 'file' } } },
    },
    credentials: { httpHeaderAuth: { id: 'REPLACE_WITH_WA_TOKEN_CRED', name: 'BP — WhatsApp Bearer' } },
  },
  output: [{}],
});

const toBase64 = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'حوّله Base64 وأعد بيانات الرسالة',
    position: [440, -120],
    parameters: {
      jsCode: `
const bin = await this.helpers.getBinaryDataBuffer(0, 'data');
const src = $('طبّع الرسالة: جوال ونص ووسائط').first().json;
return [{ json: { ...src, fileBase64: bin.toString('base64') } }];`,
    },
  },
  output: [{ contact: 'wa:9665xxxxxxxx', fileBase64: 'JVBERi0…', fileName: 'CR.pdf', fileType: 'application/pdf' }],
});

const callAgent = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'مرّرها لمحرك الوكيل في الموقع',
    position: [660, 0],
    parameters: {
      method: 'POST',
      url: `${SITE}/api/doc-agent`,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpCustomAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(`={{ JSON.stringify({
        contact: $json.contact,
        message: $json.message,
        fileBase64: $json.fileBase64 || undefined,
        fileName: $json.fileName || undefined,
        fileType: $json.fileType || undefined,
        locale: 'ar',
      }) }}`),
      options: { response: { response: { neverError: true } } },
    },
    // Templated Custom Auth بقالب {"headers":{"X-Doc-Agent-Key":"{{api_key}}"}}
    credentials: { httpCustomAuth: { id: 'REPLACE_WITH_DOC_AGENT_KEY_CRED', name: 'BP — مفتاح وكيل المستندات' } },
  },
  output: [{ ok: true, ref: 'DOC-394812', reply: 'استلمت السجل التجاري وأضفت بياناته. بقي أن ترفع النموذج المطلوب تعبئته.' }],
});

const replyText = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'جهّز نص الرد',
    position: [880, 0],
    parameters: {
      jsCode: `
// رد الوكيل إن وُجد، وإلا رسالة تعذّر مهذبة — لا نترك العميل بلا رد أبداً.
const d = $json || {};
const text = d.ok && d.reply ? d.reply
  : (d.ok ? 'استلمت ملفك وسجلته في طلبك ' + (d.ref || '') + '.'
          : 'تعذّر استلام رسالتك الآن — أعد الإرسال بعد قليل أو افتح businesspartner.sa/ai-document-agent');
return [{ json: { to: $('طبّع الرسالة: جوال ونص ووسائط').first().json.contact.replace('wa:',''), text } }];`,
    },
  },
  output: [{ to: '9665xxxxxxxx', text: 'استلمت السجل التجاري وأضفت بياناته…' }],
});

const waReply = node({
  type: 'n8n-nodes-base.whatsApp',
  version: 1,
  config: {
    name: 'أرسل رد الوكيل واتساب',
    position: [1100, 0],
    parameters: {
      operation: 'send',
      phoneNumberId: 'REPLACE_WITH_WA_PHONE_ID',
      recipientPhoneNumber: expr('={{ $json.to }}'),
      textBody: expr('={{ $json.text }}'),
    },
    credentials: { whatsAppApi: { id: 'REPLACE_WITH_WA_SEND_CRED', name: 'BP — WhatsApp Cloud' } },
    onError: 'continueRegularOutput',
  },
  output: [{}],
});

const note = sticky(
  'قناة واتساب → محرك الوكيل\n\nالمحرك نفسه الذي يخدم الموقع (api/_docagent.js) يخدم واتساب: ' +
  'n8n لا يحلل ولا يخزن شيئاً — يطبّع الرسالة، ينزّل الوسائط، ويمررها بمفتاح ' +
  'X-Doc-Agent-Key. الطلب يُلتقط بجوال العميل فيبقى Conversation واحداً عبر القنوات.',
  { color: 4, position: [-620, -320], width: 640, height: 140 },
);

export default workflow('bp-doc-agent-whatsapp', 'BP — وكيل المستندات: قناة واتساب', { timezone: 'Asia/Riyadh' })
  .add(note)
  .add(waIn.to(normalize).to(hasMedia))
  .add(hasMedia.true.to(fetchMediaUrl).to(fetchMediaBytes).to(toBase64).to(callAgent))
  .add(hasMedia.false.to(callAgent))
  .add(callAgent.to(replyText).to(waReply));
