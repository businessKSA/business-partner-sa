import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

// مرآة خزنة الوكيل الذكي للمستندات: كل ملف يرفعه عميل (أو يولّده الوكيل)
// يُرسل من api/_docagent.js إلى هذا السير (DOC_AGENT_SYNC_URL) بمفتاح
// X-Doc-Agent-Key، فيؤمَّن له:
//   * مجلد خاص بالعميل في Google Drive (يُنشأ عند أول ملف) ونسخة من الملف فيه.
//   * صفحة خاصة بالعميل في نوشن (قاعدة «عملاء الخزنة») وسطر لكل ملف في
//     قاعدة «مستندات العملاء»: الاسم، النوع، الدور، الطلب، المرفق، ورابط Drive.
//
// المصدر الحقيقي يبقى خزنة Supabase؛ هذه مرآة تشغيلية للفريق. العزل محفوظ:
// كل شيء مفتاحه org_id، ولا يختلط ملف عميل بملف عميل آخر.

// معرّفات حقيقية جاهزة (أُنشئت في حساب Business Partner):
const DRIVE_ROOT = '16iNgyPD6iBjn1vsjlxF2OjaxjKbK-dYN';            // مجلد «BP — خزنة مستندات العملاء»
const NOTION_CLIENTS_DS = 'b9702e03-d038-4e2d-b67b-985eee069310';   // قاعدة «عملاء الخزنة»
const NOTION_DOCS_DS = '50e75298-2f2f-448a-ae21-177e0befd864';      // قاعدة «مستندات العملاء»

const hook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2,
  config: {
    name: 'ملف جديد من الوكيل',
    position: [-860, 0],
    parameters: { httpMethod: 'POST', path: 'doc-agent-vault-sync', responseMode: 'onReceived', options: {} },
  },
  output: [{ body: { kind: 'upload', org_id: 'uuid', org_name: 'شركة …', ref: 'DOC-000000', file: { name: 'CR.pdf', mime: 'application/pdf', role: 'source', doc_kind: 'cr', size: 12345 }, download_url: 'https://…signed' } }],
});

const guard = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: {
    name: 'المفتاح صحيح وorg معروف؟',
    position: [-640, 0],
    parameters: {
      conditions: {
        options: { caseSensitive: true, typeValidation: 'strict', version: 2 },
        combinator: 'and',
        conditions: [
          { operator: { type: 'string', operation: 'equals' }, leftValue: expr('{{ $json.headers["x-doc-agent-key"] }}'), rightValue: expr('{{ $env.DOC_AGENT_HOOK_KEY }}') },
          { operator: { type: 'string', operation: 'notEmpty', singleValue: true }, leftValue: expr('{{ $json.body.org_id }}') },
        ],
      },
    },
  },
});

// اسم مجلد/صفحة العميل: الاسم + أول 8 من org_id (يفكّ تشابه الأسماء المكررة).
const shape = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'جهّز أسماء العميل والملف',
    position: [-420, 0],
    parameters: {
      jsCode: `
const b = $json.body;
const short = String(b.org_id).slice(0, 8);
return [{ json: {
  ...b,
  clientKey: b.org_id,
  clientFolderName: (b.org_name ? b.org_name + ' — ' : 'عميل ') + short,
  fileName: (b.file && b.file.name) || 'file',
  docKind: (b.file && b.file.doc_kind) || 'other',
  role: b.kind === 'package' ? 'package' : b.kind === 'output' ? 'filled_output' : ((b.file && b.file.role) || 'unknown'),
  mime: (b.file && b.file.mime) || '',
} }];`,
    },
  },
});

const findFolder = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'ابحث عن مجلد العميل في Drive',
    position: [-200, 0],
    parameters: {
      resource: 'fileFolder',
      searchMethod: 'query',
      queryString: expr("={{ 'name = \\'' + $json.clientFolderName.replace(/'/g, \"\\\\'\") + '\\' and \\'" + DRIVE_ROOT + "\\' in parents and trashed = false' }}"),
      returnAll: false,
      limit: 1,
      options: {},
    },
    credentials: { googleDriveOAuth2Api: { id: 'REPLACE_WITH_GDRIVE_CRED', name: 'BP — Google Drive' } },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  },
});

const folderExists = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: {
    name: 'المجلد موجود؟',
    position: [20, 0],
    parameters: {
      conditions: {
        options: { caseSensitive: true, typeValidation: 'loose', version: 2 },
        combinator: 'and',
        conditions: [{ operator: { type: 'string', operation: 'notEmpty', singleValue: true }, leftValue: expr('{{ $json.id }}') }],
      },
    },
  },
});

const makeFolder = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'أنشئ مجلد العميل',
    position: [240, 120],
    parameters: {
      resource: 'folder',
      operation: 'create',
      name: expr("={{ $('جهّز أسماء العميل والملف').item.json.clientFolderName }}"),
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: DRIVE_ROOT },
      options: {},
    },
    credentials: { googleDriveOAuth2Api: { id: 'REPLACE_WITH_GDRIVE_CRED', name: 'BP — Google Drive' } },
  },
});

const pickFolder = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'معرّف مجلد العميل',
    position: [460, 0],
    parameters: {
      jsCode: `
const src = $('جهّز أسماء العميل والملف').item.json;
return [{ json: { ...src, driveFolderId: $json.id, driveFolderUrl: 'https://drive.google.com/drive/folders/' + $json.id } }];`,
    },
  },
});

const download = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'نزّل الملف من الخزنة (رابط موقّع)',
    position: [680, 0],
    parameters: { url: expr('={{ $json.download_url }}'), options: { response: { response: { responseFormat: 'file' } } } },
  },
});

const uploadDrive = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'ارفع نسخة إلى مجلد العميل',
    position: [900, 0],
    parameters: {
      resource: 'file',
      operation: 'upload',
      inputDataFieldName: 'data',
      name: expr("={{ $('معرّف مجلد العميل').item.json.ref + ' — ' + $('معرّف مجلد العميل').item.json.fileName }}"),
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr("={{ $('معرّف مجلد العميل').item.json.driveFolderId }}") },
      options: {},
    },
    credentials: { googleDriveOAuth2Api: { id: 'REPLACE_WITH_GDRIVE_CRED', name: 'BP — Google Drive' } },
  },
});

const findClient = node({
  type: 'n8n-nodes-base.notion',
  version: 2.2,
  config: {
    name: 'ابحث عن صفحة العميل في نوشن',
    position: [1120, 0],
    parameters: {
      resource: 'databasePage',
      operation: 'getAll',
      databaseId: { __rl: true, mode: 'id', value: NOTION_CLIENTS_DS },
      returnAll: false,
      limit: 1,
      filterType: 'manual',
      matchType: 'anyFilter',
      filters: { conditions: [{ key: 'org_id|rich_text', condition: 'equals', richTextValue: expr("={{ $('معرّف مجلد العميل').item.json.clientKey }}") }] },
      options: {},
    },
    credentials: { notionApi: { id: 'REPLACE_WITH_NOTION_CRED', name: 'BP — Notion' } },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  },
});

const clientExists = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: {
    name: 'صفحة العميل موجودة؟',
    position: [1340, 0],
    parameters: {
      conditions: {
        options: { caseSensitive: true, typeValidation: 'loose', version: 2 },
        combinator: 'and',
        conditions: [{ operator: { type: 'string', operation: 'notEmpty', singleValue: true }, leftValue: expr('{{ $json.id }}') }],
      },
    },
  },
});

const makeClient = node({
  type: 'n8n-nodes-base.notion',
  version: 2.2,
  config: {
    name: 'أنشئ صفحة (مجلد) العميل',
    position: [1560, 120],
    parameters: {
      resource: 'databasePage',
      operation: 'create',
      databaseId: { __rl: true, mode: 'id', value: NOTION_CLIENTS_DS },
      title: expr("={{ $('معرّف مجلد العميل').item.json.clientFolderName }}"),
      propertiesUi: {
        propertyValues: [
          { key: 'org_id|rich_text', textContent: expr("={{ $('معرّف مجلد العميل').item.json.clientKey }}") },
          { key: 'مجلد Google Drive|url', urlValue: expr("={{ $('معرّف مجلد العميل').item.json.driveFolderUrl }}") },
          { key: 'القناة|select', selectValue: expr("={{ $('معرّف مجلد العميل').item.json.channel || 'web' }}") },
        ],
      },
      options: {},
    },
    credentials: { notionApi: { id: 'REPLACE_WITH_NOTION_CRED', name: 'BP — Notion' } },
  },
});

const addDocRow = node({
  type: 'n8n-nodes-base.notion',
  version: 2.2,
  config: {
    name: 'سطر المستند: اسم + نوع + مرفق',
    position: [1780, 0],
    parameters: {
      resource: 'databasePage',
      operation: 'create',
      databaseId: { __rl: true, mode: 'id', value: NOTION_DOCS_DS },
      title: expr("={{ $('معرّف مجلد العميل').item.json.fileName }}"),
      propertiesUi: {
        propertyValues: [
          { key: 'العميل|relation', relationValue: expr('={{ [$json.id] }}') },
          { key: 'النوع|select', selectValue: expr("={{ $('معرّف مجلد العميل').item.json.docKind }}") },
          { key: 'الدور|select', selectValue: expr("={{ $('معرّف مجلد العميل').item.json.role }}") },
          { key: 'الطلب|rich_text', textContent: expr("={{ $('معرّف مجلد العميل').item.json.ref }}") },
          { key: 'org_id|rich_text', textContent: expr("={{ $('معرّف مجلد العميل').item.json.clientKey }}") },
          { key: 'صيغة الملف|rich_text', textContent: expr("={{ $('معرّف مجلد العميل').item.json.mime }}") },
          { key: 'رابط Google Drive|url', urlValue: expr("={{ $('ارفع نسخة إلى مجلد العميل').item.json.webViewLink }}") },
          { key: 'المرفق|files', fileUrls: { fileUrl: [{ name: expr("={{ $('معرّف مجلد العميل').item.json.fileName }}"), url: expr("={{ $('ارفع نسخة إلى مجلد العميل').item.json.webViewLink }}") }] } },
        ],
      },
      options: {},
    },
    credentials: { notionApi: { id: 'REPLACE_WITH_NOTION_CRED', name: 'BP — Notion' } },
  },
});

const note = sticky(
  'مرآة الخزنة: Supabase → Drive + نوشن\n\nكل ملف من الوكيل يمر هنا مرة واحدة: مجلد للعميل في Drive ' +
  '(يُنشأ عند أول ملف)، نسخة من الملف فيه، صفحة للعميل في نوشن، وسطر للمستند باسمه ونوعه ' +
  'ومرفقه ورابط Drive. المصدر الحقيقي خزنة Supabase — هذه مرآة للفريق، والعزل مفتاحه org_id.',
  { color: 4, position: [-860, -320], width: 720, height: 150 },
);

export default workflow('bp-doc-agent-vault-sync', 'BP — وكيل المستندات: مرآة الخزنة (Drive + نوشن)', { timezone: 'Asia/Riyadh' })
  .add(note)
  .add(hook.to(guard))
  .add(guard.true.to(shape).to(findFolder).to(folderExists))
  .add(folderExists.true.to(pickFolder))
  .add(folderExists.false.to(makeFolder).to(pickFolder))
  .add(pickFolder.to(download).to(uploadDrive).to(findClient).to(clientExists))
  .add(clientExists.true.to(addDocRow))
  .add(clientExists.false.to(makeClient).to(addDocRow));
