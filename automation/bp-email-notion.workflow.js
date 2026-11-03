import { workflow, node, trigger, merge, ifElse, newCredential, languageModel, outputParser, expr } from '@n8n/workflow-sdk';

const gmailCred = { gmailOAuth2: newCredential('Gmail account') };
const notionCred = { notionOAuth2Api: newCredential('Notion OAuth2 API') };

const EMAILS_DB = '9f7749a7-d9ef-4202-800f-43f078f6b2f8';
const ATTACH_DB = '2cb6e4f1-5051-4017-bdef-f616ea45063c';
const DRIVE_FOLDER = '1JrneNTS2v13cxg4rMgGcjWakP_2NGGoy';

const NORMALIZE_CODE =
  'const j = $json;\n' +
  'const owner = "business@businesspartnerksa.com";\n' +
  'const fromText = (j.from && j.from.text) || j.from || "";\n' +
  'let senderEmail = (j.from && j.from.value && j.from.value[0] && j.from.value[0].address) || "";\n' +
  'if (!senderEmail && fromText.includes("<")) { const m = fromText.match(/<([^>]+)>/); senderEmail = m ? m[1] : ""; }\n' +
  'if (!senderEmail && fromText.includes("@")) senderEmail = fromText.trim();\n' +
  'let senderName = fromText.replace(/<[^>]*>/g, "").replace(/["\\\\]/g, "").trim();\n' +
  'if (!senderName) senderName = senderEmail;\n' +
  'const toText = (j.to && j.to.text) || j.to || "";\n' +
  'const ccText = (j.cc && j.cc.text) || j.cc || "";\n' +
  'const bccText = (j.bcc && j.bcc.text) || j.bcc || "";\n' +
  'const body = String(j.text || j.textAsHtml || j.snippet || "");\n' +
  'const dateIso = j.date ? new Date(j.date).toISOString() : new Date().toISOString();\n' +
  'const labels = Array.isArray(j.labelIds) ? j.labelIds.join(", ") : (j.Labels || "");\n' +
  'const rx = /(\\+?\\d[\\d\\s().-]{7,}\\d)/g;\n' +
  'const found = (fromText + " " + body).match(rx) || [];\n' +
  'const phones = Array.from(new Set(found.map(function(s){return s.replace(/[\\s().-]/g,"");}).filter(function(s){return s.length>=9 && s.length<=15;}))).join(", ");\n' +
  'const direction = senderEmail.toLowerCase() === owner ? "Outgoing" : "Incoming";\n' +
  'return { json: {\n' +
  '  subject: j.subject || "(no subject)",\n' +
  '  senderName: senderName, senderEmail: senderEmail,\n' +
  '  recipient: toText, cc: ccText, bcc: bccText,\n' +
  '  dateIso: dateIso, labels: labels, phones: phones, direction: direction,\n' +
  '  body: body.slice(0, 1900),\n' +
  '  messageId: j.id || j.messageId || "",\n' +
  '  threadId: j.threadId || "",\n' +
  '  source: j.source || "new"\n' +
  '} };';

const BUILD_CODE =
  'const ai = ($json.output) || $json || {};\n' +
  'const n = $("Normalize Email").item.json;\n' +
  'const classes = ["Business Development","Company Formation","Foreign Investment","Premium Residency","Recruitment","GRO","HR Services","Tourism","Medical Tourism","Government Relations","Real Estate","Finance","Contracts","Quotations","Invoices","Payments","Complaints","Support Requests","Internal Communication","Marketing","Other"];\n' +
  'const prio = ["Low","Medium","High","Critical"];\n' +
  'const senti = ["Positive","Neutral","Negative","Urgent"];\n' +
  'const pick = function(v, list, def){ return list.indexOf(v) >= 0 ? v : def; };\n' +
  'return { json: Object.assign({}, n, {\n' +
  '  classification: pick(ai.classification, classes, "Other"),\n' +
  '  priority: pick(ai.priority, prio, "Medium"),\n' +
  '  sentiment: pick(ai.sentiment, senti, "Neutral"),\n' +
  '  summary: String(ai.summary || "").slice(0, 1900),\n' +
  '  actionRequired: !!ai.actionRequired,\n' +
  '  taskName: String(ai.taskName || "")\n' +
  '}) };';

const SPREAD_CODE =
  'const out = [];\n' +
  'const typeFor = function(ext){\n' +
  '  ext = (ext||"").toLowerCase();\n' +
  '  if (ext === "pdf") return "PDF";\n' +
  '  if (ext === "doc" || ext === "docx") return "DOCX";\n' +
  '  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "XLSX";\n' +
  '  if (ext === "ppt" || ext === "pptx") return "PPTX";\n' +
  '  if (["png","jpg","jpeg","gif","webp","bmp","tiff","heic"].indexOf(ext) >= 0) return "Image";\n' +
  '  if (ext === "zip" || ext === "rar" || ext === "7z") return "ZIP";\n' +
  '  return "Other";\n' +
  '};\n' +
  'for (const item of $input.all()) {\n' +
  '  const j = item.json || {};\n' +
  '  const bin = item.binary || {};\n' +
  '  const subject = j.subject || "(no subject)";\n' +
  '  const messageId = j.id || j.messageId || "";\n' +
  '  const threadId = j.threadId || "";\n' +
  '  const dateIso = j.date ? new Date(j.date).toISOString() : new Date().toISOString();\n' +
  '  for (const key of Object.keys(bin)) {\n' +
  '    if (key.indexOf("attachment_") !== 0) continue;\n' +
  '    const b = bin[key];\n' +
  '    const fileName = b.fileName || ("file_" + key);\n' +
  '    const ext = (fileName.indexOf(".") >= 0 ? fileName.split(".").pop() : "").toLowerCase();\n' +
  '    out.push({ json: { fileName: fileName, ext: ext, fileType: typeFor(ext), mimeType: b.mimeType || "", fileSize: Number(b.fileSize || 0) || 0, subject: subject, messageId: messageId, threadId: threadId, dateIso: dateIso }, binary: { data: b } });\n' +
  '  }\n' +
  '}\n' +
  'return out;';

const newEmailTrigger = trigger({
  type: 'n8n-nodes-base.gmailTrigger',
  version: 1.4,
  config: {
    name: 'New Email (Gmail)',
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      simple: false,
      filters: {},
      options: { downloadAttachments: true, dataPropertyAttachmentsPrefixName: 'attachment_' }
    },
    credentials: gmailCred
  },
  output: [{ id: 'msg1', threadId: 'thr1', subject: 'Hello', from: { text: 'A <a@x.com>', value: [{ address: 'a@x.com', name: 'A' }] }, to: { text: 'business@businesspartnerksa.com' }, date: '2026-07-01T10:00:00Z', text: 'Body text', labelIds: ['Label_3'] }]
});

const setSourceNew = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Mark New',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: { assignments: [{ id: 's1', name: 'source', value: 'new', type: 'string' }] }
    }
  },
  output: [{ source: 'new' }]
});

const backfillTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Historical Backfill' },
  output: [{}]
});

const fetchLabeled = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Fetch Labeled Emails',
    parameters: {
      resource: 'message',
      operation: 'getAll',
      returnAll: false,
      limit: 3,
      simple: false,
      filters: { q: 'has:userlabels' },
      options: { downloadAttachments: true, dataPropertyAttachmentsPrefixName: 'attachment_' }
    },
    credentials: gmailCred
  },
  output: [{ id: 'msg2', threadId: 'thr2', subject: 'Old email', from: { text: 'B <b@y.com>', value: [{ address: 'b@y.com', name: 'B' }] }, date: '2026-06-01T10:00:00Z', text: 'Body' }]
});

const setSourceHist = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Mark Historical',
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: { assignments: [{ id: 's2', name: 'source', value: 'historical', type: 'string' }] }
    }
  },
  output: [{ source: 'historical' }]
});

const mergeSources = merge({
  version: 3.2,
  config: { name: 'Merge Email Sources', parameters: { mode: 'append' } },
  output: [{ id: 'msg1' }]
});

const normalize = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalize Email',
    parameters: { mode: 'runOnceForEachItem', jsCode: NORMALIZE_CODE }
  },
  output: [{ subject: 'Hello', senderName: 'A', senderEmail: 'a@x.com', dateIso: '2026-07-01T10:00:00Z', body: 'Body text', direction: 'Incoming', source: 'new' }]
});

const aiModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'GPT-4o-mini',
    parameters: { model: { __rl: true, mode: 'list', value: 'gpt-4o-mini', cachedResultName: 'gpt-4o-mini' }, options: { temperature: 0.2 } },
    credentials: { openAiApi: newCredential('OpenAI account') }
  }
});

const aiParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Email Fields Parser',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample: '{"classification":"Marketing","priority":"Medium","sentiment":"Neutral","summary":"Brief summary of the email in one or two sentences","actionRequired":false,"taskName":""}'
    }
  }
});

const aiExtract = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'AI Email Analyzer',
    parameters: {
      promptType: 'define',
      text: expr('Analyze this business email and extract structured fields.\nSubject: {{ $json.subject }}\nFrom: {{ $json.senderName }} <{{ $json.senderEmail }}>\nTo: {{ $json.recipient }}\nDate: {{ $json.dateIso }}\nBody:\n{{ $json.body }}\n\nclassification MUST be exactly one of: Business Development, Company Formation, Foreign Investment, Premium Residency, Recruitment, GRO, HR Services, Tourism, Medical Tourism, Government Relations, Real Estate, Finance, Contracts, Quotations, Invoices, Payments, Complaints, Support Requests, Internal Communication, Marketing, Other.\npriority one of: Low, Medium, High, Critical.\nsentiment one of: Positive, Neutral, Negative, Urgent.\nsummary: 1-2 sentence summary. actionRequired: true/false. taskName: short task if action required else empty.'),
      hasOutputParser: true,
      options: { systemMessage: 'You are an expert email classifier for a Saudi business-services company. Return only the structured fields.' }
    },
    subnodes: { model: aiModel, outputParser: aiParser }
  },
  output: [{ output: { classification: 'Marketing', priority: 'Medium', sentiment: 'Neutral', summary: 'A short summary', actionRequired: false, taskName: '' } }]
});

const buildRecord = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Email Record',
    parameters: { mode: 'runOnceForEachItem', jsCode: BUILD_CODE }
  },
  output: [{ subject: 'Hello', classification: 'Marketing', priority: 'Medium', sentiment: 'Neutral', summary: 'A short summary', source: 'new' }]
});

const createEmail = node({
  type: 'n8n-nodes-base.notion',
  version: 2.2,
  config: {
    name: 'Create Email Record',
    parameters: {
      authentication: 'oAuth2',
      resource: 'databasePage',
      operation: 'create',
      databaseId: { __rl: true, mode: 'list', value: EMAILS_DB, cachedResultName: 'Emails' },
      title: expr('{{ $json.subject }}'),
      simple: false,
      propertiesUi: {
        propertyValues: [
          { key: 'Sender Name|rich_text', textContent: expr('{{ $json.senderName }}') },
          { key: 'Sender Email|email', emailValue: expr('{{ $json.senderEmail }}') },
          { key: 'Recipient|rich_text', textContent: expr('{{ $json.recipient }}') },
          { key: 'CC|rich_text', textContent: expr('{{ $json.cc }}') },
          { key: 'BCC|rich_text', textContent: expr('{{ $json.bcc }}') },
          { key: 'Date|date', includeTime: true, date: expr('{{ $json.dateIso }}') },
          { key: 'Full Body|rich_text', textContent: expr('{{ $json.body }}') },
          { key: 'Summary|rich_text', textContent: expr('{{ $json.summary }}') },
          { key: 'Phone Numbers|rich_text', textContent: expr('{{ $json.phones }}') },
          { key: 'Gmail Labels|rich_text', textContent: expr('{{ $json.labels }}') },
          { key: 'Message ID|rich_text', textContent: expr('{{ $json.messageId }}') },
          { key: 'Thread ID|rich_text', textContent: expr('{{ $json.threadId }}') },
          { key: 'Direction|select', selectValue: expr('{{ $json.direction }}') },
          { key: 'AI Classification|select', selectValue: expr('{{ $json.classification }}') },
          { key: 'AI Priority|select', selectValue: expr('{{ $json.priority }}') },
          { key: 'Sentiment|select', selectValue: expr('{{ $json.sentiment }}') }
        ]
      },
      options: {}
    },
    credentials: notionCred,
    onError: 'continueRegularOutput'
  },
  output: [{ id: 'notion-page-1', source: 'new' }]
});

const isNew = ifElse({
  version: 2.3,
  config: {
    name: 'Is New Email?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr("{{ $('Build Email Record').item.json.source }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'new' }],
        combinator: 'and'
      }
    }
  }
});

const waAlert = node({
  type: 'n8n-nodes-base.whatsApp',
  version: 1.1,
  config: {
    name: 'WhatsApp Alert (Owner)',
    parameters: {
      resource: 'message',
      operation: 'send',
      phoneNumberId: '1216029938250852',
      recipientPhoneNumber: '966530540231',
      messageType: 'text',
      textBody: expr('📩 إيميل جديد في نوشن\nمن: {{ $(\'Build Email Record\').item.json.senderName }} ({{ $(\'Build Email Record\').item.json.senderEmail }})\nالموضوع: {{ $(\'Build Email Record\').item.json.subject }}\nالتصنيف: {{ $(\'Build Email Record\').item.json.classification }} | الأولوية: {{ $(\'Build Email Record\').item.json.priority }}\nملخص: {{ $(\'Build Email Record\').item.json.summary }}')
    },
    credentials: { whatsAppApi: newCredential('WhatsApp account') },
    onError: 'continueRegularOutput'
  },
  output: [{ messaging_product: 'whatsapp' }]
});

const spreadAttachments = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Spread Email Attachments',
    parameters: { mode: 'runOnceForAllItems', jsCode: SPREAD_CODE }
  },
  output: [{ fileName: 'doc.pdf', ext: 'pdf', fileType: 'PDF', subject: 'Hello', messageId: 'msg1', threadId: 'thr1', dateIso: '2026-07-01T10:00:00Z' }]
});

const driveUpload = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Upload Attachment to Drive',
    parameters: {
      resource: 'file',
      operation: 'upload',
      inputDataFieldName: 'data',
      name: expr('{{ $json.fileName }}'),
      driveId: { __rl: true, mode: 'list', value: 'My Drive', cachedResultName: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: DRIVE_FOLDER, cachedResultName: 'BP Email Attachments' },
      options: {}
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive OAuth2 API') },
    onError: 'continueRegularOutput'
  },
  output: [{ id: 'drive-file-1', webViewLink: 'https://drive.google.com/file/d/drive-file-1/view' }]
});

const createAttachment = node({
  type: 'n8n-nodes-base.notion',
  version: 2.2,
  config: {
    name: 'Create Attachment Record',
    parameters: {
      authentication: 'oAuth2',
      resource: 'databasePage',
      operation: 'create',
      databaseId: { __rl: true, mode: 'list', value: ATTACH_DB, cachedResultName: 'Attachments' },
      title: expr("{{ $('Spread Email Attachments').item.json.fileName }}"),
      simple: false,
      propertiesUi: {
        propertyValues: [
          { key: 'File Type|select', selectValue: expr("{{ $('Spread Email Attachments').item.json.fileType }}") },
          { key: 'File Extension|rich_text', textContent: expr("{{ $('Spread Email Attachments').item.json.ext }}") },
          { key: 'File Size|number', numberValue: expr("{{ $('Spread Email Attachments').item.json.fileSize }}") },
          { key: 'Download URL|url', urlValue: expr('{{ $json.webViewLink }}') },
          { key: 'Drive File ID|rich_text', textContent: expr('{{ $json.id }}') },
          { key: 'Source Email Subject|rich_text', textContent: expr("{{ $('Spread Email Attachments').item.json.subject }}") },
          { key: 'Message ID|rich_text', textContent: expr("{{ $('Spread Email Attachments').item.json.messageId }}") },
          { key: 'Thread ID|rich_text', textContent: expr("{{ $('Spread Email Attachments').item.json.threadId }}") },
          { key: 'Upload Date|date', includeTime: true, date: expr("{{ $('Spread Email Attachments').item.json.dateIso }}") },
          { key: 'Attachment Status|select', selectValue: 'Downloaded' }
        ]
      },
      options: {}
    },
    credentials: notionCred,
    onError: 'continueRegularOutput'
  },
  output: [{ id: 'attach-page-1' }]
});

export default workflow('bp-email-notion', 'BP — Email → Notion CRM + Drive + Alerts')
  .add(newEmailTrigger)
  .to(setSourceNew)
  .to(mergeSources.input(0))
  .add(backfillTrigger)
  .to(fetchLabeled)
  .to(setSourceHist)
  .to(mergeSources.input(1))
  .add(mergeSources)
  .to(normalize.to(aiExtract).to(buildRecord).to(createEmail).to(isNew.onTrue(waAlert)))
  .add(mergeSources)
  .to(spreadAttachments.to(driveUpload).to(createAttachment));
