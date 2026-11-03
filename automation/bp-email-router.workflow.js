import { workflow, node, trigger, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const notionCred = { notionOAuth2Api: newCredential('Notion OAuth2 API') };
const EMAILS_DB = '9f7749a7-d9ef-4202-800f-43f078f6b2f8';
const ATTACH_DB = '2cb6e4f1-5051-4017-bdef-f616ea45063c';
const THREADS_DB = '9804562f-f121-4e3e-bb1b-95cb28f8b532';
const RE_DB = '63afa145-3753-4693-a391-d32fb5224bc0';
const CRM_DB = 'b322a7ec-23a9-4ceb-875e-52c07b00eadf';

const PLAN_CODE =
  'const j = $json;\n' +
  'const emailPageId = j.id;\n' +
  'const messageId = j.property_message_id || "";\n' +
  'const threadId = j.property_thread_id || "";\n' +
  'const cls = j.property_ai_classification || "Other";\n' +
  'const direction = j.property_direction || "Incoming";\n' +
  'const senderEmail = String(j.property_sender_email || "").toLowerCase();\n' +
  'const senderName = j.property_sender_name || "";\n' +
  'const subject = j.property_subject || j.name || "(no subject)";\n' +
  'const dateIso = (j.property_date && j.property_date.start) ? j.property_date.start : "";\n' +
  'const crmRel = j.property_crm_lead || [];\n' +
  'const reRel = j.property_real_estate_request || [];\n' +
  'const threadRel = j.property_thread || [];\n' +
  'const domain = senderEmail.indexOf("@") >= 0 ? senderEmail.split("@")[1] : "";\n' +
  'const autoList = ["github.com","notion.so","x.com","twitter.com","google.com","zatca.gov.sa","instagram.com","facebookmail.com","facebook.com","linkedin.com","vercel.com","resend","amazonaws","sentry","atlassian","microsoft","moyasar","tokenizer","mailchimp","substack","medium.com","paypal","stripe"];\n' +
  'let isAuto = senderEmail.indexOf("noreply") >= 0 || senderEmail.indexOf("no-reply") >= 0 || senderEmail.indexOf("notify") >= 0 || senderEmail.indexOf("notifications") >= 0 || senderEmail.indexOf("newsletter") >= 0 || senderEmail.indexOf("no_reply") >= 0;\n' +
  'for (const d of autoList) { if (domain.indexOf(d) >= 0) { isAuto = true; } }\n' +
  'if (/newsletter|weekly|digest|unsubscribe|نشرة|رسالة اخبارية/i.test(subject)) { isAuto = true; }\n' +
  'const clientClasses = ["Company Formation","Foreign Investment","Premium Residency","Recruitment","GRO","HR Services","Tourism","Medical Tourism","Government Relations","Business Development"];\n' +
  'const svcMap = {"Company Formation":"Company Setup","Foreign Investment":"Company Setup","GRO":"GRO","Government Relations":"GRO","HR Services":"Recruitment","Recruitment":"Recruitment","Tourism":"Tourism","Medical Tourism":"Tourism","Premium Residency":"Legal","Business Development":"Consultation"};\n' +
  'const service = svcMap[cls] || "Consultation";\n' +
  'const atts = $("Get All Attachments").all();\n' +
  'const ids = [];\n' +
  'for (const a of atts) { const aj = a.json || {}; if (messageId && (aj.property_message_id || "") === messageId) { ids.push(aj.id); } }\n' +
  'let threadPageId = "";\n' +
  'const threads = $("Get All Threads").all();\n' +
  'for (const t of threads) { const tj = t.json || {}; if (threadId && (tj.property_thread_id || "") === threadId) { threadPageId = tj.id; break; } }\n' +
  'const threadEmpty = Array.isArray(threadRel) && threadRel.length === 0;\n' +
  'const needLinkThread = threadEmpty && threadPageId !== "";\n' +
  'const needCreateThread = threadEmpty && threadPageId === "" && threadId !== "";\n' +
  'const needRE = (cls === "Real Estate") && !isAuto && (Array.isArray(reRel) && reRel.length === 0);\n' +
  'const needCRM = clientClasses.indexOf(cls) >= 0 && !isAuto && direction === "Incoming" && (Array.isArray(crmRel) && crmRel.length === 0);\n' +
  'return { json: { emailPageId: emailPageId, messageId: messageId, threadId: threadId, threadPageId: threadPageId, subject: subject, senderEmail: senderEmail, senderName: senderName, dateIso: dateIso, service: service, attachmentIds: ids, hasAttach: ids.length > 0, needRE: needRE, needCRM: needCRM, needLinkThread: needLinkThread, needCreateThread: needCreateThread } };';

const runTrigger = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Run Linker' }, output: [{}] });
const schedule = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.3, config: { name: 'Every 15 Minutes', parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 15 }] } } }, output: [{}] });

const getAttachments = node({
  type: 'n8n-nodes-base.notion', version: 2.2,
  config: { name: 'Get All Attachments', parameters: { authentication: 'oAuth2', resource: 'databasePage', operation: 'getAll', databaseId: { __rl: true, mode: 'list', value: ATTACH_DB, cachedResultName: 'Attachments' }, returnAll: true, simple: true, options: {} }, credentials: notionCred, alwaysOutputData: true },
  output: [{ id: 'att1', property_message_id: 'm1' }]
});

const getThreads = node({
  type: 'n8n-nodes-base.notion', version: 2.2,
  config: { name: 'Get All Threads', parameters: { authentication: 'oAuth2', resource: 'databasePage', operation: 'getAll', databaseId: { __rl: true, mode: 'list', value: THREADS_DB, cachedResultName: 'Email Threads' }, returnAll: true, simple: true, options: {} }, credentials: notionCred, executeOnce: true, alwaysOutputData: true },
  output: [{ id: 'thr1', property_thread_id: 't1' }]
});

const getEmails = node({
  type: 'n8n-nodes-base.notion', version: 2.2,
  config: { name: 'Get Emails', parameters: { authentication: 'oAuth2', resource: 'databasePage', operation: 'getAll', databaseId: { __rl: true, mode: 'list', value: EMAILS_DB, cachedResultName: 'Emails' }, returnAll: true, simple: true, options: {} }, credentials: notionCred, executeOnce: true },
  output: [{ id: 'em1', property_message_id: 'm1', property_thread_id: 't1', property_ai_classification: 'Company Formation', property_direction: 'Incoming', property_sender_email: 'client@acme.com' }]
});

const planCode = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Plan Links & Routing', parameters: { mode: 'runOnceForEachItem', jsCode: PLAN_CODE } },
  output: [{ emailPageId: 'em1', messageId: 'm1', threadId: 't1', threadPageId: 'thr1', subject: 'Hi', senderEmail: 'client@acme.com', senderName: 'Acme', dateIso: '2026-07-01T10:00:00Z', service: 'Company Setup', attachmentIds: [], hasAttach: false, needRE: false, needCRM: true, needLinkThread: true, needCreateThread: false }]
});

const ifAttach = ifElse({ version: 2.3, config: { name: 'Has Attachments?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.hasAttach }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } } });
const ifRE = ifElse({ version: 2.3, config: { name: 'Route Real Estate?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.needRE }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } } });
const ifCRM = ifElse({ version: 2.3, config: { name: 'Route CRM Lead?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.needCRM }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } } });
const ifLinkThread = ifElse({ version: 2.3, config: { name: 'Link Existing Thread?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.needLinkThread }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } } });
const ifCreateThread = ifElse({ version: 2.3, config: { name: 'Create New Thread?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.needCreateThread }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } } });

const linkAttach = node({
  type: 'n8n-nodes-base.notion', version: 2.2,
  config: { name: 'Link Attachments to Email', parameters: { authentication: 'oAuth2', resource: 'databasePage', operation: 'update', pageId: { __rl: true, mode: 'id', value: expr('{{ $json.emailPageId }}') }, simple: false, propertiesUi: { propertyValues: [{ key: 'Attachments|relation', relationValue: expr('{{ $json.attachmentIds }}') }] }, options: {} }, credentials: notionCred, onError: 'continueRegularOutput' },
  output: [{ id: 'em1' }]
});

const linkThread = node({
  type: 'n8n-nodes-base.notion', version: 2.2,
  config: { name: 'Link Email to Thread', parameters: { authentication: 'oAuth2', resource: 'databasePage', operation: 'update', pageId: { __rl: true, mode: 'id', value: expr('{{ $json.emailPageId }}') }, simple: false, propertiesUi: { propertyValues: [{ key: 'Thread|relation', relationValue: expr('{{ [$json.threadPageId] }}') }] }, options: {} }, credentials: notionCred, onError: 'continueRegularOutput' },
  output: [{ id: 'em1' }]
});

const createThread = node({
  type: 'n8n-nodes-base.notion', version: 2.2,
  config: {
    name: 'Create Email Thread',
    parameters: {
      authentication: 'oAuth2', resource: 'databasePage', operation: 'create',
      databaseId: { __rl: true, mode: 'list', value: THREADS_DB, cachedResultName: 'Email Threads' },
      title: expr('{{ $json.subject }}'), simple: false,
      propertiesUi: { propertyValues: [
        { key: 'Thread ID|rich_text', textContent: expr('{{ $json.threadId }}') },
        { key: 'Emails|relation', relationValue: expr('{{ [$json.emailPageId] }}') }
      ] }, options: {}
    },
    credentials: notionCred, onError: 'continueRegularOutput'
  },
  output: [{ id: 'thr2' }]
});

const createRE = node({
  type: 'n8n-nodes-base.notion', version: 2.2,
  config: {
    name: 'Create Real Estate Request',
    parameters: {
      authentication: 'oAuth2', resource: 'databasePage', operation: 'create',
      databaseId: { __rl: true, mode: 'list', value: RE_DB, cachedResultName: 'Real Estate Requests' },
      title: expr('{{ $json.subject }}'), simple: false,
      propertiesUi: { propertyValues: [
        { key: 'Client Email|email', emailValue: expr('{{ $json.senderEmail }}') },
        { key: 'Client Name|rich_text', textContent: expr('{{ $json.senderName }}') },
        { key: 'Source Email Subject|rich_text', textContent: expr('{{ $json.subject }}') },
        { key: 'Message ID|rich_text', textContent: expr('{{ $json.messageId }}') },
        { key: 'Status|select', selectValue: 'New' },
        { key: 'Date|date', includeTime: true, date: expr('{{ $json.dateIso }}') },
        { key: 'Emails|relation', relationValue: expr('{{ [$json.emailPageId] }}') }
      ] }, options: {}
    },
    credentials: notionCred, onError: 'continueRegularOutput'
  },
  output: [{ id: 're1' }]
});

const createCRM = node({
  type: 'n8n-nodes-base.notion', version: 2.2,
  config: {
    name: 'Create CRM Lead',
    parameters: {
      authentication: 'oAuth2', resource: 'databasePage', operation: 'create',
      databaseId: { __rl: true, mode: 'list', value: CRM_DB, cachedResultName: 'CRM' },
      title: expr('{{ $json.senderName || $json.subject }}'), simple: false,
      propertiesUi: { propertyValues: [
        { key: 'Email|email', emailValue: expr('{{ $json.senderEmail }}') },
        { key: 'Service Interest|multi_select', multiSelectValue: [expr('{{ $json.service }}')] },
        { key: 'Status|status', statusValue: 'New Lead' },
        { key: 'Lead Source|select', selectValue: 'Other' },
        { key: 'Notes|rich_text', textContent: expr('Auto-created from inbound email: {{ $json.subject }}') },
        { key: 'Emails|relation', relationValue: expr('{{ [$json.emailPageId] }}') }
      ] }, options: {}
    },
    credentials: notionCred, onError: 'continueRegularOutput'
  },
  output: [{ id: 'crm1' }]
});

export default workflow('bp-email-router-v3', 'BP — Email CRM Router & Linker')
  .add(runTrigger)
  .to(getAttachments)
  .to(getThreads)
  .to(getEmails)
  .to(planCode)
  .add(schedule)
  .to(getAttachments)
  .add(planCode)
  .to(ifAttach.onTrue(linkAttach))
  .add(planCode)
  .to(ifRE.onTrue(createRE))
  .add(planCode)
  .to(ifCRM.onTrue(createCRM))
  .add(planCode)
  .to(ifLinkThread.onTrue(linkThread))
  .add(planCode)
  .to(ifCreateThread.onTrue(createThread));
