# كتالوج الموصلات — Business Partner AI

> تاريخ البحث: 2026-10-16 · النطاق: موصلات يربطها العميل بنفسه من حقل إعدادات (لا في المحادثة)، معزولة لكل شركة.

## مفتاح القراءة

**المرحلة**
- **1** = مفتاح API / رمز شخصي / كلمة مرور تطبيق. يستخرجه العميل من إعدادات المنتج ويلصقه عندنا. لا يحتاج موافقة من المورّد.
- **1 (بدليل)** = لا يحتاج موافقة المورّد، لكن العميل (أو مسؤول IT عنده) ينشئ «تطبيقاً داخلياً» في حسابه ثم يلصق المعرّف والسر أو الرمز عندنا: Meta System User، أو Slack app، أو Zoom S2S، أو Entra app، أو حساب خدمة Google. يحتاج دليلاً مصوّراً خطوة بخطوة، وقد لا يقدر عليه غير التقني وحده.
- **2** = OAuth بتطبيقنا نحن (متعدد العملاء). المورّد لا يشترط مراجعة، أو مراجعته خفيفة.
- **3** = يحتاج مراجعة أو تحقق أو شراكة مع المورّد: CASA، App Review، نشر في متجر، أو شراكة.

**درجة التحقق في عمود المصدر**
- ✅ تحقّقتُ منه في هذه الجلسة من المصدر المذكور.
- 📘 من التوثيق الرسمي المعروف (الرابط مرفق)، ولم يُعَد فتحه في هذه الجلسة.
- ❓ غير متحقق. لا يُبنى عليه قبل التأكد من المورّد.

**🇸🇦** = أداة سعودية أو خليجية، أو ذات انتشار عالٍ في السوق السعودي.

---

## 1) مساحات العمل والمعرفة والمستندات

| الأداة | ماذا تفعل | طريقة الربط | يستخرجها العميل بنفسه؟ (وأين) | موافقة المورّد؟ | المرحلة | مصدر |
|---|---|---|---|---|---|---|
| Notion | صفحات وقواعد بيانات ومعرفة الفريق | Internal integration token | نعم: Settings → Connections → Develop or manage integrations (notion.so/my-integrations). ثم يشارك الصفحات المطلوبة مع التكامل. الإنشاء لمالك مساحة العمل | لا (تكامل داخلي) | 1 | 📘 developers.notion.com/docs/authorization |
| Coda | مستندات تفاعلية بجداول وأتمتة | API token | نعم: Account settings → API settings → Generate API token | لا | 1 | 📘 coda.io/developers/apis/v1 |
| Confluence (Cloud) | ويكي ومعرفة الشركة | البريد + API token (يُفضَّل scoped) | نعم: id.atlassian.com → Security → API tokens. الرمز المقيَّد صلاحيته من 1 إلى 365 يوماً، والقديم غير المقيَّد مُهمَل | لا | 1 | ✅ [support.atlassian.com – Scoped API tokens](https://support.atlassian.com/confluence/kb/scoped-api-tokens-in-confluence-cloud/) · [getknit.dev](https://getknit.dev/blog/jira-api-key) |
| Airtable | قواعد بيانات على شكل جداول | Personal Access Token (PAT) | نعم: Builder hub → Personal access tokens (airtable.com/create/tokens)، مع اختيار الصلاحيات والقواعد | لا | 1 | 📘 airtable.com/developers/web/guides/personal-access-tokens |
| Slab | قاعدة معرفة للفرق | API token (GraphQL) | نعم للمسؤول: Team settings → Developer. ❓ قد يقتصر على باقات أعلى | لا | 1 | ❓ slab.com/api (الخطة غير متحققة) |
| Nuclino | ويكي خفيف للفرق | API key | نعم: Settings → API keys | لا | 1 | 📘 help.nuclino.com (API) |
| Slite | قاعدة معرفة للفرق | API key | نعم: Settings → API | لا | 1 | 📘 developers.slite.com |
| Obsidian | ملاحظات محلية على الجهاز | لا API سحابية | — | — | **يُستبعد** | — |

## 2) إدارة المشاريع والمهام

| الأداة | ماذا تفعل | طريقة الربط | يستخرجها العميل بنفسه؟ (وأين) | موافقة المورّد؟ | المرحلة | مصدر |
|---|---|---|---|---|---|---|
| ClickUp | مهام ومشاريع ومستندات الفريق | Personal API token (`pk_…`) لا ينتهي | نعم: Avatar → Settings → Apps → API Token → Generate | لا | 1 | ✅ [developer.clickup.com/docs/authentication](https://developer.clickup.com/docs/authentication) |
| Monday.com | لوحات عمل ومتابعة المشاريع | Personal API token | نعم: Avatar → Developers → My access tokens، وللمسؤول: Administration → Connections → API | لا | 1 | ✅ [developer.monday.com – authentication](https://developer.monday.com/api-reference/docs/authentication) |
| Asana | مهام ومشاريع وجداول زمنية | Personal Access Token | نعم: My settings → Apps → Manage developer apps (app.asana.com/0/my-apps) → Create new token | لا | 1 | 📘 developers.asana.com/docs/personal-access-token |
| Jira (Cloud) | تتبع المهام والتطوير | البريد + API token (scoped) | نعم: id.atlassian.com → Security → API tokens | لا | 1 | ✅ (مصادر Confluence نفسها) |
| Trello | لوحات كانبان بسيطة | API key + token | جزئياً: ينشئ Power-Up في trello.com/power-ups/admin ليحصل على المفتاح، ثم يولّد الرمز | لا | 1 (بدليل) | 📘 developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction |
| Basecamp | إدارة مشاريع وتواصل الفريق | OAuth 2.0 فقط (37signals Launchpad) | لا (OAuth) | لا (تسجيل تطبيق ذاتي) | 2 | 📘 github.com/basecamp/bc3-api |
| Todoist | قوائم مهام شخصية وللفرق | API token | نعم: Settings → Integrations → Developer → API token | لا | 1 | 📘 developer.todoist.com |
| Wrike | إدارة مشاريع المؤسسات | Permanent access token | نعم: Apps & Integrations → API → إنشاء تطبيق → Permanent token | لا | 1 | 📘 developers.wrike.com/oauth-20-authorization |
| Smartsheet | جداول لإدارة المشاريع | API access token | نعم: Account → Apps & Integrations → API Access → Generate new token | لا | 1 | 📘 developers.smartsheet.com |
| Linear | تتبع مهام فرق المنتج | Personal API key | نعم: Settings → Account → Security & access → Personal API keys | لا | 1 | 📘 linear.app/developers |

## 3) المحاسبة والمالية وأنظمة ERP

| الأداة | ماذا تفعل | طريقة الربط | يستخرجها العميل بنفسه؟ (وأين) | موافقة المورّد؟ | المرحلة | مصدر |
|---|---|---|---|---|---|---|
| Qoyod (قيود) 🇸🇦 | محاسبة سحابية وفوترة إلكترونية متوافقة مع زاتكا | API key في ترويسة `API-KEY` (REST v2.0) | نعم: إعدادات المنشأة العامة → Generate New Key. متاح مجاناً في كل الخطط المدفوعة | لا للمفتاح. للشراكة التقنية مسار منفصل | **1** | ✅ [qoyod.com/api-integrations](https://www.qoyod.com/api-integrations/) · [apidoc.qoyod.com](https://apidoc.qoyod.com/) |
| Daftra (دفترة) 🇸🇦 | محاسبة وفواتير ومخزون للشركات الصغيرة | API key في ترويسة `APIKEY` + النطاق الفرعي `https://<sub>.daftra.com/api2` | نعم: Settings → API → API Keys → Generate API key. الخطة المطلوبة غير مذكورة | لا | **1** | ✅ [docs.daftra.com (?p=5809)](https://docs.daftra.com/en/?p=5809). ونمط الترويسة مستخدم فعلاً في `api/_daftra.js` بالمستودع |
| Wafeq (وافق) 🇸🇦 | محاسبة وفوترة إلكترونية (السعودية والإمارات) | `Authorization: Api-Key <key>`، وفيه أيضاً OAuth للتطبيقات الشريكة | نعم: Developer → API Keys → Create new key. يتطلب تفعيل الـAPI وخطة Starter على الأقل، ويعمل في الفترة التجريبية | لا للمفتاح | **1** | ✅ [developer.wafeq.com – authenticate](https://developer.wafeq.com/docs/authenticate-and-make-your-first-request) · [developer.wafeq.com/reference](https://developer.wafeq.com/reference). تنبيه: مصادر أقدم تقول «اطلب المفتاح من المبيعات» |
| Odoo (+ Odoo CRM) 🇸🇦 | ERP شامل: محاسبة ومبيعات ومخزون وCRM | API key تحلّ محل كلمة المرور في XML-RPC/JSON-RPC، و«JSON-2» في الإصدارات الأحدث | نعم: Preferences (الملف الشخصي) → Account Security → New API Key. يُعرض مرة واحدة ويرث صلاحيات المستخدم | لا | **1** | ✅ [nango.dev – Odoo API key](https://nango.dev/docs/api-integrations/odoo-api-key/connect) · [chift.eu](https://chift.eu/blog/how-to-get-your-odoo-api-key-in-4-easy-steps). ❓ على Odoo Online قد يتطلب الـExternal API خطة «Custom» (غير متحقق) |
| ERPNext / Frappe | ERP مفتوح المصدر | API key + secret (`Authorization: token key:secret`) | نعم: User → Settings → API Access → Generate Keys | لا | 1 | 📘 docs.frappe.io/framework/user/en/api/rest |
| Zoho Books 🇸🇦 | محاسبة سحابية (منتشرة خليجياً) | OAuth 2.0 فقط، مع خيار «Self Client» | جزئياً: api-console.zoho.com → Self Client → Generate Code (صلاحية الرمز دقائق) ثم استبداله برمز تحديث. ويجب مراعاة مركز البيانات (.com أو .eu أو .in أو غيره) | لا (Self Client). ❓ لتطبيق متعدد العملاء: هل يُراجَع؟ | 1 (بدليل) / 2 | ✅ [zoho.com – Self Client flow](https://www.zoho.com/accounts/protocol/oauth/self-client/authorization-code-flow.html) |
| QuickBooks Online | محاسبة (انتشار محدود سعودياً) | OAuth 2.0 فقط | لا | **نعم**: استبيان App Assessment قبل مفاتيح الإنتاج | 3 | ✅ [docs.codat.io – QBO questionnaire](https://docs.codat.io/integrations/accounting/quickbooksonline/qbo-app-assessment-questionnaire) |
| Xero | محاسبة (انتشار محدود سعودياً) | OAuth 2.0. «Custom Connections» في AU/NZ/UK/US فقط حسب Fivetran | لا | التطبيق غير المعتمد محدود بـ25 اتصالاً، ورفع الحد يحتاج شهادة شراكة | 2 → 3 | ✅ [fivetran.com/docs/…/xero](https://fivetran.com/docs/connectors/applications/xero) · [docs.chift.eu](https://docs.chift.eu/connectors/accounting/xero) |
| Microsoft Dynamics 365 Business Central | ERP للشركات المتوسطة | OAuth 2.0 (Entra) فقط في النسخة السحابية، ومفاتيح Web Service ملغاة | جزئياً للمسؤول: يسجّل تطبيق Entra في مستأجره، ثم يضيفه في صفحة «Microsoft Entra Applications» داخل BC | لا إن كان التطبيق داخل مستأجر العميل | 1 (بدليل) / 2 | ✅ [learn.microsoft.com – BC web services auth](https://learn.microsoft.com/cs-cz/dynamics365/business-central/dev-itpro/webservices/web-services-authentication) |
| SAP Business One | ERP للشركات المتوسطة | Service Layer (مستخدم + كلمة مرور + CompanyDB)، وغالباً على خادم العميل أو الشريك | لا. يحتاج وصولاً شبكياً (VPN أو IP عام) ومشاركة شريك SAP | لا من SAP، لكن يحتاج شريك التنفيذ | 3 | 📘 help.sap.com (Service Layer) |
| Rewaa (رواء) 🇸🇦 | نقاط بيع ومخزون للتجزئة | REST APIs + webhooks (توثيق Postman عام) | ❓ طريقة الحصول على المفتاح غير موثقة علناً | ❓ غالباً شراكة | 3 (حتى التأكد) | ✅ وجود الـAPI: [doc.api.rewaatech.com](https://doc.api.rewaatech.com/view/metadata/TW6wL9V7). ❓ آلية المصادقة |
| Foodics (فودكس) 🇸🇦 | نقاط بيع وإدارة مطاعم | OAuth 2.0 (client id/secret من بوابة مطوّري Foodics، والتاجر يأذن من Foodics Console). طرف ثالث يذكر PAT | ❓ لم أجد مساراً موثقاً ليولّد التاجر رمزاً بنفسه. «API Adapter» يرسل رمز وصول لجهة محددة بالبريد بعد أن يأذن المالك | ❓ على الأرجح تسجيل تطبيق أو شراكة Marketplace | 2/3 (حتى التأكد) | ✅ [help.foodics.com – API Adapter](https://help.foodics.com/hc/en-us/articles/7494382541084-Foodics-API-Connector) · [apps.odoo.com (طرف ثالث)](https://apps.odoo.com/apps/modules/19.0/de_foodics_integration) |
| ERP خاص بالعميل (OpenAPI/REST) | ربط أي نظام داخلي له API | Base URL + API key أو Bearer + ملف OpenAPI | نعم إن كان لديه فريق تقني. Open WebUI يدعم خوادم أدوات OpenAPI | لا | 1 (تقني، لكل عميل) | — |

## 4) إدارة علاقات العملاء والمبيعات

| الأداة | ماذا تفعل | طريقة الربط | يستخرجها العميل بنفسه؟ (وأين) | موافقة المورّد؟ | المرحلة | مصدر |
|---|---|---|---|---|---|---|
| HubSpot | CRM وتسويق ومبيعات | **Service Key**، وهو بديل Private App | نعم: Settings → Integrations → Service Keys. **إنشاء Private Apps القديمة يتوقف في 26 أكتوبر 2026** للحسابات القائمة، والموجود منها يستمر | لا | 1 | ✅ [developers.hubspot.com – legacy private app sunset](https://developers.hubspot.com/changelog/legacy-private-app-creation-sunset) |
| Zoho CRM 🇸🇦 | CRM منتشر خليجياً | OAuth 2.0، مع Self Client | جزئياً (Self Client، مثل Zoho Books) | لا (Self Client) | 1 (بدليل) / 2 | ✅ (مصدر Zoho أعلاه) |
| Salesforce | CRM للمؤسسات | OAuth 2.0: يُنشئ المسؤول External Client App أو Connected App (Client Credentials) | جزئياً للمسؤول فقط. ❓ الـAPI متاح في Enterprise وما فوق، وProfessional يحتاج إضافة | لا لتطبيق داخل Org العميل. AppExchange يحتاج Security Review | 1 (بدليل) / 2 | 📘 help.salesforce.com (Connected Apps). ❓ تفاصيل الخطط |
| Pipedrive | CRM لخط المبيعات | Personal API token | نعم: Personal preferences → API | لا | 1 | 📘 pipedrive.readme.io/docs/how-to-find-the-api-token |
| Freshsales (Freshworks CRM) | CRM للمبيعات | API key + نطاق الحساب | نعم: Profile settings → API settings | لا | 1 | 📘 developers.freshworks.com/crm/api |
| Odoo CRM 🇸🇦 | CRM داخل Odoo | API key (مثل Odoo) | نعم (مثل Odoo) | لا | 1 | ✅ (مصدر Odoo أعلاه) |

## 5) الموارد البشرية والرواتب

| الأداة | ماذا تفعل | طريقة الربط | يستخرجها العميل بنفسه؟ (وأين) | موافقة المورّد؟ | المرحلة | مصدر |
|---|---|---|---|---|---|---|
| Jisr (جسر) 🇸🇦 | موارد بشرية ورواتب وحضور للسعودية | API key حسب طرف ثالث | ❓ طرف ثالث يقول «من إعدادات حساب جسر»، ولا يوجد توثيق رسمي عام | ❓ | 3 (حتى تأكيد جسر) | ⚠️ طرف ثالث فقط: [withone.ai – Jisr](https://www.withone.ai/connect/gemini/jisr/md). صفحة جسر الرسمية بلا API عام: [jisr.net/en/integrations](https://jisr.net/en/integrations) |
| ZenHR 🇸🇦 | موارد بشرية ورواتب، ومربوط بمدد | توثيق 2019: Key + Secret بتوقيع JWT (HS256)، 500 طلب يومياً، تقييد IP. فهارس خارجية تذكر v3 بـOAuth 2.0 + PKCE | نعم حسب توثيق 2019: Settings → API Keys. ❓ هل المسار ما زال قائماً | ❓ | 1 (إن تأكد المفتاح) / 2 | ✅ [developer.zenhr.com (2019)](https://developer.zenhr.com/2019/04/29/api-documentation.html). ❓ v3 من [apievangelist](https://providers.apievangelist.com/providers/zenhr-inc/). التوثيق الحالي [api-docs.zenhr.com](https://api-docs.zenhr.com/) لم يُقرأ محتواه |
| Menaitech (ميناتك) 🇸🇦 | رواتب وموارد بشرية (MenaPAY/MenaME) | «APIs» مذكورة عموماً، بلا توثيق عام | لا | ❓ مشروع تكامل مع المورّد | 3 | ✅ [menaitech.com/en-sa/faqs](https://menaitech.com/en-sa/faqs-sa/) |
| Bayzat (بيزات) 🇸🇦 | موارد بشرية وتأمين ورواتب (الإمارات والسعودية) | ❓ لم أجد API عاماً | ❓ | ❓ | 3 (حتى التأكد) | ❓ لا نتيجة رسمية |
| Mudad (مدد) 🇸🇦 | منصة حماية الأجور (WPS) | لا API عاماً. التكامل عبر البنوك وأنظمة الموارد البشرية (ZenHR وقيود وBayzat وMenaitech) | لا | — | **ليس موصلاً مباشراً**: يُخدم عبر ZenHR أو قيود | ✅ [qoyod.com – Mudad](https://www.qoyod.com/en/knowledge-base/integrations/integration-mudad/) · [zenhr.com – Mudad](https://www.zenhr.com/en/marketplace-integration/mudad) |
| BambooHR | موارد بشرية للشركات المتوسطة | API key + النطاق الفرعي | نعم: الملف الشخصي → API Keys → Add new key | لا | 1 | 📘 documentation.bamboohr.com/docs |

## 6) التجارة الإلكترونية والمواقع

| الأداة | ماذا تفعل | طريقة الربط | يستخرجها العميل بنفسه؟ (وأين) | موافقة المورّد؟ | المرحلة | مصدر |
|---|---|---|---|---|---|---|
| Salla (سلة) 🇸🇦 | منصة متاجر إلكترونية سعودية | OAuth 2.0 فقط، عبر تطبيق في Salla Partners Portal (Easy أو Custom Mode)، ثم Bearer token | **لا رمز تاجر مباشر.** يستطيع التاجر إنشاء «تطبيق خاص» لمتجره، لكن يلزمه حساب Partners وتوثيق هوية | تطبيق عام لكل التجار = نشر في متجر تطبيقات سلة ومراجعة فريق سلة | **3** | ✅ [docs.salla.dev – Authorization](https://docs.salla.dev/421118m0.md) · [help.salla.sa – private apps](https://help.salla.sa/en/article/create-and-publish-private-apps/ddivmwvwi575q35dx8o8a2wx) · [docs.salla.dev – publish](https://docs.salla.dev/playbook/launch-grow/publish-app) |
| Zid (زد) 🇸🇦 | منصة متاجر إلكترونية سعودية | OAuth 2.0 (authorization code) عبر تطبيق في Partner Dashboard. ترويستا `Authorization` و`X-Manager-Token`، وصلاحية الرمز سنة | **لا** (لا يوجد في التوثيق رمز يولّده التاجر) | ❓ متطلبات المراجعة والنشر غير مذكورة في صفحة المصادقة | **3** (تطبيق شريك) | ✅ [docs.zid.sa/authorization](https://docs.zid.sa/authorization) |
| Shopify | منصة متاجر عالمية | منذ 1 يناير 2026 لا تُنشأ «Custom apps» قديمة من لوحة المتجر. التطبيق الجديد يُنشأ في Dev Dashboard (Client ID/Secret ثم client credentials لرمز يعيش 24 ساعة) | جزئياً: ينشئ التاجر تطبيقاً في Dev Dashboard ويعطينا المعرّف والسر. التطبيقات القديمة تستمر | لا لتطبيق التاجر الخاص. التطبيق العام في App Store يُراجَع | 1 (بدليل) / 3 للعام | ✅ [community.shopify.dev – Jan 1 2026](https://community.shopify.dev/t/starting-january-1-2026-you-will-not-be-able-to-create-new-legacy-custom-apps-this-will-not-impact-any-existing-apps/26798) · [support.databuzz.com.au](https://support.databuzz.com.au/article/740-changes-to-shopify-custom-apps) |
| WooCommerce | متجر على ووردبريس | Consumer key + secret (REST) | نعم: WooCommerce → Settings → Advanced → REST API → Add key | لا | 1 | 📘 woocommerce.com/document/woocommerce-rest-api |
| WordPress | مواقع ومحتوى | Application Password (WP 5.6+) | نعم: Users → Profile → Application Passwords | لا | 1 | 📘 make.wordpress.org/core/2020/11/05/application-passwords-integration-guide |
| Wix | منشئ مواقع ومتاجر | API key + Account/Site ID | نعم (لمالك الحساب): API Keys Manager | لا | 1 | 📘 dev.wix.com/docs/rest (API keys) |
| Webflow | منشئ مواقع احترافية | Site API token | نعم: Site settings → Apps & Integrations → API access → Generate | لا | 1 | 📘 developers.webflow.com |

## 7) التواصل والبريد

| الأداة | ماذا تفعل | طريقة الربط | يستخرجها العميل بنفسه؟ (وأين) | موافقة المورّد؟ | المرحلة | مصدر |
|---|---|---|---|---|---|---|
| Gmail (Google Workspace) | البريد الإلكتروني | (أ) OAuth بنطاقات Gmail. (ب) IMAP/SMTP بكلمة مرور تطبيق. (ج) تطبيق OAuth «Internal» في مشروع Google Cloud الخاص بالعميل | (ب) نعم: myaccount.google.com → Security → App passwords، ويتطلب التحقق بخطوتين، وقد يمنعه مسؤول Workspace. (ج) لمسؤول Workspace فقط | (أ) **نعم**: النطاقات المقيّدة (`gmail.modify` وغيرها) تحتاج تحققاً + **CASA** سنوياً. `gmail.send` و`readonly` حساسة: تحقق دون CASA. (ب) و(ج) لا | (ب) 1 · (ج) 1 (بدليل) · (أ) 3 | ✅ [nango.dev – Google security review](https://nango.dev/docs/api-integrations/google-shared/google-security-review) · [deepstrike.io – CASA](https://deepstrike.io/blog/google-casa-security-assessment-2025) |
| Google Calendar | التقويم والمواعيد | OAuth (نطاق حساس)، أو تطبيق Internal أو حساب خدمة | (ج) لمسؤول Workspace | النطاق الحساس يحتاج تحقق التطبيق (دون CASA) | 1 (بدليل) / 2 | 📘 developers.google.com/workspace/calendar/api/auth |
| Microsoft 365 – Outlook / Teams | بريد ومحادثات واجتماعات | Microsoft Graph عبر OAuth. IMAP بكلمة مرور مُعطّل في Exchange Online، وSMTP AUTH الأساسي يُعطَّل افتراضياً نهاية ديسمبر 2026 | جزئياً: يسجّل مسؤول المستأجر تطبيق Entra أحادي المستأجر (Client ID + Secret + Admin consent) ويعطينا القيم | تطبيقنا متعدد المستأجرين يحتاج **Publisher Verification** (حساب Microsoft Cloud Partner Program) ليقبل المستخدمون الموافقة، وموافقة المسؤول تتجاوز ذلك. التطبيق داخل مستأجر العميل لا يحتاج | 1 (بدليل) / 2 | ✅ [learn.microsoft.com – publisher verification](https://learn.microsoft.com/en-ca/entra/identity-platform/publisher-verification-overview) · [captaindns.com – SMTP AUTH](https://www.captaindns.com/en/blog/microsoft-exchange-basic-auth-smtp-end) (يُراجع MC786329) |
| Slack | محادثات الفرق | Bot token (`xoxb-`) من تطبيق ينشئه العميل في مساحته | جزئياً: api.slack.com/apps → Create app → Install to workspace → OAuth & Permissions | لا لتطبيق غير موزّع. ❓ قيود معدّل خاصة بالتطبيقات الموزّعة خارج Marketplace (2025) | 1 (بدليل) / 2 | 📘 api.slack.com/authentication. ❓ قيود 2025 |
| WhatsApp Business Platform (Cloud API) 🇸🇦 | مراسلة العملاء على واتساب | System User token دائم + Phone Number ID + WABA ID | جزئياً: Business Settings → Users → System users → إضافة التطبيق وحساب WABA → Generate token (`whatsapp_business_messaging` و`_management`). يحتاج تطبيق Meta يملكه العميل | **لا** لـ«Direct Developer» الذي يصل بيانات نشاطه فقط. إن صرنا Tech Provider (Embedded Signup) فيلزم App Review وتوثيق نشاط | 1 (بدليل) / 3 كمزوّد | ✅ [developers.facebook.com – WhatsApp permissions](https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions) |
| Zoom | اجتماعات مرئية | Server-to-Server OAuth (Account ID + Client ID + Secret) | جزئياً للمسؤول: marketplace.zoom.us → Develop → Build App → Server-to-Server OAuth | لا (تطبيق داخلي غير منشور) | 1 (بدليل) | 📘 developers.zoom.us/docs/internal-apps/s2s-oauth |

## 8) الملفات والحزم المكتبية

| الأداة | ماذا تفعل | طريقة الربط | يستخرجها العميل بنفسه؟ (وأين) | موافقة المورّد؟ | المرحلة | مصدر |
|---|---|---|---|---|---|---|
| Google Drive / Docs / Sheets / Slides | ملفات ومستندات وجداول وعروض | (أ) OAuth بنطاق `drive.file` (غير حساس، للملفات التي يختارها المستخدم عبر Picker). (ب) نطاق `drive` الكامل (مقيّد). (ج) حساب خدمة يملكه العميل ويشارك معه مجلداً | (ج) جزئياً: ينشئ حساب خدمة في Google Cloud ويعطينا ملف JSON، ثم يشارك المجلد مع بريد حساب الخدمة | (أ) تحقق أساسي فقط. (ب) **تحقق مقيّد + CASA**. (ج) ❓ حسب مصدر ثانوي معفى إن اقتصر على بيانات العميل | (ج) 1 (بدليل) · (أ) 2 · (ب) 3 | ✅ [developers.google.com – Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) |
| OneDrive / SharePoint / Word / Excel / PowerPoint | ملفات Microsoft 365 | Graph، ومنه `Sites.Selected` لتقييد الوصول بموقع واحد | جزئياً للمسؤول (تطبيق Entra في مستأجره، كما في Outlook) | مثل Outlook: Publisher Verification لتطبيقنا متعدد المستأجرين | 1 (بدليل) / 2 | ✅ (مصدر Publisher Verification أعلاه) |
| Dropbox | تخزين ومشاركة ملفات | OAuth 2.0. الرمز المولّد من App Console قصير العمر | لا عملياً | ❓ التطبيق في «Development» محدود بعدد مستخدمين، وما فوقه يحتاج موافقة إنتاج | 2 | 📘 developers.dropbox.com/oauth-guide. ❓ الحد |
| Box | تخزين ملفات للمؤسسات | OAuth 2.0، أو Custom App بـClient Credentials | جزئياً للمسؤول (Custom App + تفويض من Admin Console) | لا لتطبيق داخلي، ومسؤول Box يعتمده | 1 (بدليل) / 2 | 📘 developer.box.com/guides/authentication |

## 9) التسويق والتواصل الاجتماعي والتحليلات

| الأداة | ماذا تفعل | طريقة الربط | يستخرجها العميل بنفسه؟ (وأين) | موافقة المورّد؟ | المرحلة | مصدر |
|---|---|---|---|---|---|---|
| Facebook Pages + Instagram (Graph API) 🇸🇦 | نشر وتحليلات الصفحات والحسابات | OAuth، أو System User token من تطبيق Meta يملكه العميل | جزئياً: تطبيق Meta للعميل + System User في Business Manager | تطبيقنا الذي يخدم حسابات لا نملكها يحتاج **Advanced Access = App Review + Business Verification**. تطبيق العميل لحساباته يكفيه Standard Access | 1 (بدليل) / 3 | ✅ [developers.facebook.com – Instagram Platform overview](https://developers.facebook.com/docs/instagram-platform/overview) |
| Meta Ads (Marketing API) 🇸🇦 | إدارة وتقارير الإعلانات | System User token لتطبيق العميل | جزئياً (مثل أعلاه) | ❓ Standard Access لحسابات العميل الإعلانية. تطبيقنا العام يحتاج App Review | 1 (بدليل) / 3 | 📘 developers.facebook.com/docs/marketing-api. ❓ تفاصيل المستويات |
| LinkedIn | نشر صفحات الشركات والتحليلات | OAuth (Community Management API، `w_organization_social`) | لا | **نعم**: مراجعة LinkedIn + توثيق صفحة الشركة، ويجب أن يكون المنتج وحيداً على التطبيق | 3 | ✅ [learn.microsoft.com – LinkedIn CM app review](https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review?view=li-lms-2023-11) |
| X (Twitter) | نشر وقراءة التغريدات | OAuth 1.0a/2.0 + مفاتيح مطوّر | جزئياً: يفتح العميل حساب مطوّر ويدفع حسب الاستخدام | لا مراجعة، لكن **الدفع حسب الاستخدام هو الافتراضي منذ 6 فبراير 2026** وأُغلقت الباقة المجانية للجدد (تقديرات طرف ثالث: نحو 0.01$ لكل منشور و0.005$ لكل قراءة) | 1 (بدليل + تكلفة) | ✅ [postproxy.dev – X API pricing 2026](https://www.postproxy.dev/blog/x-api-pricing-2026/) · [gigazine](https://gigazine.net/gsc_news/en/20260209-x-api-pay-per-use) (يُراجع docs.x.com) |
| TikTok 🇸🇦 | نشر فيديو وتحليلات | OAuth (Content Posting API) | لا | **نعم**: قبل التدقيق تكون المنشورات خاصة فقط، وبحد 5 مستخدمين كل 24 ساعة | 3 | ✅ [developers.tiktok.com – content sharing guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines) |
| Snapchat 🇸🇦 | إعلانات Snap (Marketing API) | OAuth عبر Snap Business | ❓ | ❓ | 2/3 (غير متحقق) | ❓ |
| YouTube | قناة وفيديو وتحليلات | OAuth (نطاقات YouTube حساسة) | لا | نطاق حساس = تحقق التطبيق. ❓ رفع الحصة يحتاج تدقيق YouTube API | 2/3 | 📘 developers.google.com/youtube/v3. ❓ التدقيق |
| Google Analytics 4 | تحليلات المواقع | OAuth (`analytics.readonly` حساس)، أو حساب خدمة يُضاف للخاصية | (حساب الخدمة) جزئياً: يضيف بريده كـViewer في GA4 Admin → Property access management | OAuth: تحقق (حتى 10 أيام أو أسابيع). حساب الخدمة لبيانات العميل: ❓ معفى حسب مصدر ثانوي | 1 (بدليل) / 2 | ✅ (مصدر ثانوي) [singhamandeep.com](https://singhamandeep.com/?p=1610) |
| Google Ads | إدارة حملات جوجل | OAuth + Developer token | لا | **نعم**: طلب Basic Access للـDeveloper token. ❓ خبر (ppc.land) عن نقل مستويات الوصول إلى مشروع Cloud وإلزام توثيق العلامة منذ 10 سبتمبر 2026 | 3 | ✅ [developers.google.com – access levels](https://developers.google.com/google-ads/api/docs/api-policy/access-levels) · ❓ [ppc.land](https://ppc.land/google-drops-developer-tokens-from-ads-api-access-decisions/) |
| Mailchimp | حملات بريد تسويقي | API key (مع لاحقة مركز البيانات `-us21` وغيرها) | نعم: Profile → Extras → API keys | لا | 1 | 📘 mailchimp.com/developer/marketing/guides/quick-start |
| Brevo | بريد تسويقي ورسائل SMS | API key | نعم: SMTP & API → API Keys → Generate | لا | 1 | 📘 developers.brevo.com |

## 10) التوقيع الإلكتروني والمستندات

| الأداة | ماذا تفعل | طريقة الربط | يستخرجها العميل بنفسه؟ (وأين) | موافقة المورّد؟ | المرحلة | مصدر |
|---|---|---|---|---|---|---|
| DocuSign | توقيع إلكتروني للعقود | OAuth (Auth Code أو JWT) بـIntegration Key | لا (مفتاح التكامل لنا، والعميل يوافق) | **Go-Live Review** لنقل المفتاح إلى الإنتاج: 20 استدعاءً ناجحاً ثم فحص آلي، وأحياناً يدوي | 2 (بعد Go-Live مرة واحدة) | ✅ [docusign.com – go-live failures](https://www.docusign.com/blog/the-trenches-go-live-failures) |
| Adobe Acrobat Sign | توقيع إلكتروني | Integration Key للمسؤول، أو OAuth | نعم للمسؤول: Account → Acrobat Sign API → API Information → Integration Key | لا للمفتاح. ❓ متاح في خطط Business/Enterprise فقط | 1 | 📘 helpx.adobe.com/sign (Integration key). ❓ الخطط |
| Dropbox Sign (HelloSign) | توقيع إلكتروني | API key | نعم: Settings → API → API key | لا. ❓ الإنتاج يتطلب خطة API مدفوعة، ووضع الاختبار مجاني | 1 (قد يُكلّف) | 📘 developers.hellosign.com. ❓ التسعير |

## 11) الدعم الفني ومكاتب الخدمة

| الأداة | ماذا تفعل | طريقة الربط | يستخرجها العميل بنفسه؟ (وأين) | موافقة المورّد؟ | المرحلة | مصدر |
|---|---|---|---|---|---|---|
| Zendesk | تذاكر دعم العملاء | البريد + API token | نعم للمسؤول: Admin Center → Apps and integrations → APIs → Zendesk API → Add API token | لا | 1 | 📘 support.zendesk.com (API token) |
| Freshdesk | تذاكر دعم العملاء | API key + النطاق الفرعي | نعم: Profile settings → Your API Key | لا | 1 | 📘 developers.freshdesk.com/api |
| Intercom | محادثات ودعم العملاء | Access token لتطبيق خاص بمساحة العميل | جزئياً: Developer Hub → New app → Authentication → Access token | لا للتطبيق الخاص. النشر في App Store يُراجَع | 1 (بدليل) | 📘 developers.intercom.com/docs/build-an-integration/learn-more/authentication |

---

## قائمة المرحلة الأولى الموصى بها (≈15)

مرتّبة بالقيمة للشركات السعودية ثم سهولة الربط. كلها لا تحتاج موافقة مورّد:

1. **Daftra (دفترة)**: مفتاح من الإعدادات، والنمط مجرّب في المستودع (`api/_daftra.js`).
2. **Qoyod (قيود)**: مفتاح من إعدادات المنشأة، متاح لكل الخطط المدفوعة.
3. **Wafeq (وافق)**: مفتاح من قسم المطوّر (خطة Starter فأعلى).
4. **Odoo** (ومعه Odoo CRM): مفتاح من الملف الشخصي. يُتحقق من شرط الخطة على Odoo Online.
5. **Notion**: رمز تكامل داخلي.
6. **HubSpot**: Service Key (يُكتب الدليل على Service Keys لا Private Apps، لأن إنشاء الأخيرة يتوقف في 26 أكتوبر 2026).
7. **ClickUp**: رمز شخصي لا ينتهي.
8. **Monday.com**: رمز شخصي.
9. **Jira + Confluence (Atlassian)**: رمز مقيَّد، ويُنبَّه العميل أن صلاحيته سنة كحدٍّ أقصى.
10. **Airtable**: PAT بصلاحيات وقواعد محددة.
11. **Asana**: PAT.
12. **Pipedrive**: رمز شخصي.
13. **WooCommerce + WordPress**: مفاتيح REST وكلمة مرور تطبيق (متاجر ومواقع سعودية كثيرة عليها).
14. **Zendesk / Freshdesk**: رمز أو مفتاح من الإعدادات.
15. **Mailchimp / Brevo**: مفتاح API.
16. **موصل «نظامك الخاص» (OpenAPI/REST)**: رابط + مفتاح + ملف OpenAPI، لمن لديه ERP داخلي.

**المرحلة 1 (بدليل)، عالية القيمة سعودياً، تلي القائمة مباشرة:** WhatsApp Cloud API (System User token لتطبيق العميل، ولا App Review)، وMicrosoft 365 وSharePoint (تطبيق Entra في مستأجر العميل)، وGoogle Drive وGA4 (حساب خدمة للعميل)، وZoho Books وCRM (Self Client)، وShopify (تطبيق Dev Dashboard)، وSlack، وZoom.

---

## يحتاج قرار المالك

| البند | لماذا يحتاج قراراً | التكلفة أو الجهد |
|---|---|---|
| **سلة وزد** (أعلى قيمة سعودياً في التجارة) | لا يوجد رمز يولّده التاجر. الحل الوحيد القابل للتوسع تطبيق شريك منشور في متجر تطبيقات سلة وزد ويمر بمراجعتهما | حساب Partners موثّق + بناء تطبيق + مراجعة. ❓ مدة المراجعة ورسومها غير منشورة |
| **Gmail و Google Drive الكامل (CASA)** | النطاقات المقيّدة تحتاج تحقق Google + تقييم CASA **يتجدد سنوياً**. البدائل: `drive.file`، أو حساب خدمة لكل عميل، أو كلمة مرور تطبيق لـIMAP | تقديرات CASA من طرف ثالث: من بضع مئات إلى بضعة آلاف دولار سنوياً (❓ غير رسمية) |
| **Microsoft Publisher Verification** | لازم لتطبيقنا متعدد المستأجرين حتى يوافق المستخدمون العاديون. البديل: تطبيق Entra لكل عميل (بدليل) | تسجيل في Microsoft Cloud Partner Program + نطاق ناشر مطابق. ❓ التكلفة |
| **Meta (Tech Provider / App Review / Business Verification)** | لنقدّم واتساب وإنستغرام وفيسبوك بضغطة واحدة بدل أن ينشئ كل عميل تطبيقه | توثيق نشاط Business Partner لدى Meta + App Review لكل صلاحية |
| **X API** | الدفع حسب الاستخدام منذ فبراير 2026: هل يدفع العميل من حسابه أم نحن؟ | متغيّرة حسب الاستخدام |
| **LinkedIn / TikTok / Google Ads** | كلها تمر بمراجعة أو تدقيق المورّد قبل الإنتاج | وقت وجهد تقديم، ونتائج غير مضمونة |
| **QuickBooks / Xero** | استبيان Intuit. Xero محدود بـ25 اتصالاً قبل الشهادة. انتشارهما سعودياً ضعيف | يُقترح التأجيل |
| **DocuSign Go-Live** | مراجعة لمرة واحدة لتطبيقنا | جهد تقني منخفض |
| **شراكات بلا API عام**: Jisr وRewaa وFoodics وBayzat وMenaitech | لم أجد توثيقاً عاماً يسمح للعميل بتوليد مفتاحه (Jisr فيه ادعاء طرف ثالث فقط) | تواصل رسمي مع كل مورّد لطلب توثيق API أو برنامج شراكة |
| **Odoo Online** | ❓ قد يشترط خطة «Custom» للوصول إلى الـAPI، فيدفع العميل أكثر | يُسأل Odoo أو يُجرَّب على حساب |
| **Dropbox Sign / Adobe Sign** | الـAPI قد يتطلب خطة مدفوعة أعلى لدى العميل | ❓ غير متحقق |

---

## ملاحظات أمان للتنفيذ (مختصرة)

- يُخزَّن كل رمز مشفّراً لكل مستأجر، في Azure Key Vault أو ما يعادله. لا يظهر في المحادثة ولا في السجلات، ويُعرض مقنّعاً بعد الحفظ.
- يُنصح العميل بإنشاء **مستخدم خدمة مخصّص** بأقل صلاحية، لأن كثيراً من الرموز (Odoo وClickUp وMonday) ترث صلاحيات صاحبها كاملة.
- البداية بصلاحيات **قراءة فقط** حيث يتيح المورّد ذلك (Airtable وAtlassian scoped وHubSpot Service Keys)، وأي إجراء كتابة يحتاج تأكيداً صريحاً.
- تُراقَب صلاحية الرموز التي تنتهي: Atlassian (سنة كحدٍّ أقصى)، وZid (سنة)، وShopify client credentials (24 ساعة، تجديد آلي)، وZoho وMicrosoft (رموز تحديث).
- يُختبر كل مفتاح عند الحفظ بنداء خفيف (مثل `GET /v1/organization/` في وافق)، وتُعرض للعميل نتيجة واضحة.
