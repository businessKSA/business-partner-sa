// مركز التواصل — حاقن الزرّ العائم الواحد في كل صفحات الموقع (Simple V1 + الكلاسيكية).
//
// كان في كل صفحة زرّان عائمان: واتساب الأخضر (`.sv1-wa-fab`، من تذييل SV1) وزرّ
// «الدعم». صارا زرّاً واحداً «تواصل معنا» يتوسّع إلى ثلاث قنوات:
//   (أ) المستشار الذكي على واتساب  — contact.whatsappAgent
//   (ب) فريقنا البشري على واتساب   — contact.whatsappSupport  (لا يُحذف)
//   (ج) الدعم داخل الموقع          — site/assets/js/bp-support-hub.js
//
// الواجهة نفسها (CSS/JS) ملفّان ثابتان في site/assets/{css,js}/bp-support-hub.*
// يُحمَّلان بمُعرِّف المحتوى (?v=) كبقية الأصول؛ فلا ١٤٠٠ نسخة من الكود في الصفحات.
// هنا فقط: قراءة الأرقام من site/data/site.json (لا رقم مكتوب في الكود)، وحقن
// ثلاثة أسطر في كل صفحة، وإزالة زرّ واتساب القديم من الصفحات التي يُحقن فيها المركز
// (وإلا ظهر زرّان). الصفحات المستثناة (SKIP) تبقى كما هي بزرّها القديم.
//
// يُشغَّل في نهاية سلسلة البناء بعد بناة الصفحات كلها، فيغطّي كل صفحة عامة.
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const SITE = join(process.cwd(), "site");
const IMG = "/assets/img/baher.jpg";

// قرار المالك (SHOW_PRICES=false): الأسعار للمسجَّلين فقط. المركز يلتزم به:
// يعرض سعر الخدمة لمن له جلسة، ولغيره «السعر بعد الدخول». قلبها إلى true
// يُظهر الأسعار لكل زائر في أجوبة المركز (قرارٌ للمالك لا للمطوّر).
const PRICES_PUBLIC = false;

// صفحات لا نضع فيها المركز (لوحات داخلية/مضمّنة/مونيتور).
const SKIP = [/compliance-solutions\.html$/, /\/portal\//, /\/admin(\.|\/)/, /\/monitor(\.|\/)/, /\/ops(\.|\/)/, /\/checkout(\.|\/)/,
  // كل ما في assets/data هو نسخة مصدر تنسخها سلسلة البناء إلى جذر الموقع وهناك
  // يُحقن المركز. الحقن في المصدر نفسه يجمّده فيه (الحاقن يتخطّى ما فيه مركز
  // سابق) ويُبطل مُعرِّف المحتوى حين يتغيّر الملف لاحقاً.
  /^\/assets\/data\//];

// ------------------------------------------------------------- الأرقام ----
// كلها من site/data/site.json. إن غاب رقمٌ يفشل البناء بدل أن يُنشر مركزٌ
// بلا قناة — «لا تحذف أي قناة» تشمل أن لا تسقط بصمت.
const site = JSON.parse(readFileSync(join(SITE, "data", "site.json"), "utf8"));
const contact = site.contact || {};
const intl = (n) => {
  const d = String(n || "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("966") ? d : "966" + d.replace(/^0/, "");
};
const fromUrl = (u) => intl(String(u || "").replace(/^.*wa\.me\//, ""));
const AGENT = intl(contact.whatsappAgent) || fromUrl(site.whatsapp);
const HUMAN = intl(contact.whatsappSupport) || fromUrl(site.whatsappSupport);
if (!AGENT || !HUMAN) throw new Error("baher-support: site.json لا يحمل contact.whatsappAgent / whatsappSupport");
if (AGENT === HUMAN) throw new Error("baher-support: رقم المستشار الذكي ورقم الفريق البشري متطابقان في site.json");

const CFG = {
  agent: AGENT,
  human: HUMAN,
  humanLocal: contact.whatsappSupport || "",
  email: contact.email || "",
  address: contact.address || "",
  addressEn: contact.addressEn || "",
  hours: contact.hoursRule || { tz: "Asia/Riyadh", days: [0, 1, 2, 3, 4], from: 9, to: 18 },
  pricesPublic: PRICES_PUBLIC,
  img: IMG,
};

// -------------------------------------------------------- الأصول ومُعرِّفها --
const ASSET_CSS = "assets/css/bp-support-hub.css";
const ASSET_JS = "assets/js/bp-support-hub.js";
const hash = (rel) => createHash("md5").update(readFileSync(join(SITE, rel))).digest("hex").slice(0, 10);
const CSS_V = hash(ASSET_CSS);
const JS_V = hash(ASSET_JS);

// ما يُحقن في الصفحة: الأنماط، ثم الإعداد، ثم السكربت. بلا HTML ثابت — يبنيه
// السكربت بلغة الصفحة (html[lang]).
const BLOCK = `<link rel="stylesheet" href="/${ASSET_CSS}?v=${CSS_V}">` +
  `<script id="bpsCfg">window.BPS_CFG=${JSON.stringify(CFG).replace(/</g, "\\u003c")}</script>` +
  `<script defer src="/${ASSET_JS}?v=${JS_V}"></script>`;

// الودجت القديم («الدعم» + نموذج الاسم والجوال) كان يُحقن كاملاً في كل صفحة. إن بقي
// في صفحةٍ مولَّدة من مصدرٍ مجمَّد فيه، نستبدله بالمركز بدل أن يظهر زرّان.
const OLD_WIDGET = /<style>\s*\.bps-fab\{[\s\S]*?<\/style>\s*<button class="bps-fab" id="bpsFab"[\s\S]*?<\/section>\s*<script>\(function\(\)\{var AR=[\s\S]*?<\/script>/;
const OLD_WA_FAB = /<a class="sv1-wa-fab"[^>]*>[\s\S]*?<\/a>/;

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
}

const files = [];
walk(SITE, files);
let patched = 0, replacedOld = 0, droppedWa = 0;
for (const f of files) {
  const rel = f.slice(SITE.length).replace(/\\/g, "/");
  if (SKIP.some((re) => re.test(rel))) continue;
  let html = readFileSync(f, "utf8");
  if (html.includes('id="bpsCfg"')) continue; // موجود مسبقاً
  if (OLD_WIDGET.test(html)) { html = html.replace(OLD_WIDGET, ""); replacedOld++; }
  const idx = html.lastIndexOf("</body>");
  if (idx === -1) continue;
  if (OLD_WA_FAB.test(html)) { html = html.replace(OLD_WA_FAB, ""); droppedWa++; }
  const at = html.lastIndexOf("</body>");
  html = html.slice(0, at) + BLOCK + html.slice(at);
  writeFileSync(f, html);
  patched++;
}
console.log(`baher-support: contact hub injected into ${patched} page(s) (old widget replaced in ${replacedOld}, legacy WhatsApp button folded into the hub on ${droppedWa}) · agent ${AGENT} · team ${HUMAN}`);
