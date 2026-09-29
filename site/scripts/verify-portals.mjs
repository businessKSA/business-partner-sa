// ‏حارس البوابات: تصميم اللوحات إمّا حيٌّ أو البناء يسقط.
//
// وُجد هذا الحارس بعد جردٍ كشف ثغرةً صامتة في سلسلة البناء. الرقع الأربعة
// (`client-portal-v6`, `doc-agent-portal-v7`, `compliance-dashboard-v6`,
// `admin-command-center-v8`) تحقن CSS وJS عند `</head>` و`</body>` — وهما في
// كل صفحة HTML، فالحقن نفسه لا يفشل أبداً وتطبع كلٌّ منها سطر «applied».
//
// لكن المحقون مكتوب بالكامل على بنية تلك الصفحات بالذات: `#sideNav`,
// `.viewwrap`, `#navDesk`, `#view-overview`, `.hero-copy`, `.tl-row`... فلو
// تغيّرت البنية — بإعادة تصميم، أو بنقل الصفحة إلى قالب آخر، أو بإعادة توليد
// مصدرها في `scripts/assets/` — بقي الحقن ناجحاً، وبقي البناء ناجحاً، وفقد
// كل محدّد هدفه: تخرج اللوحة إلى الإنتاج بلا تصميمها، ولا شيء يشتكي.
//
// و`verify-pages.mjs` لا يمسك هذا: يفحص أن كل سكربت **يُحلَّل نحوياً**، لا أن
// محدّداته تجد أهدافها. حارسٌ للنحو لا للبنية.
//
// فهذا الملف يثبّت العقد نصّاً: لكل لوحة، العلامات التي يجب أن تكون محقونة،
// والمرتكزات التي يعتمد عليها المحقون. نقصُ أيٍّ منها يُسقط البناء — فتبقى
// النشرة السابقة السليمة حيّة. عطلٌ في البناء بدل عطلٍ في الإنتاج.
//
// إن نُقلت لوحة عن قصد إلى بنية جديدة، فالعقد هنا يُحدَّث في الدفعة نفسها.
// سقوطه ليس عائقاً يُزاح، بل سؤال: هل التصميم ما زال يصل العميل؟
import fs from "node:fs";
import path from "node:path";

// ‏لكل ملف: `markers` علامات الحقن، و`anchors` ما يعتمد عليه المحقون.
const CONTRACT = [
  {
    file: "site/ar/account.html",
    why: "بوابة العميل العربية — رقعتا client-portal-v6 و doc-agent-portal-v7",
    markers: [
      'id="bp-client-portal-v6-css"',
      'id="bp-client-portal-v6-js"',
      'id="bp-docagent-v7-css"',
      'id="bp-docagent-v7-js"',
    ],
    anchors: ['id="sideNav"', 'class="viewwrap"', 'id="topOrgName"',
              'data-v="company"', 'data-v="documents"'],
  },
  {
    file: "site/account.html",
    why: "بوابة العميل الإنجليزية — رقعة doc-agent-portal-v7",
    markers: ['id="bp-docagent-v7-css"', 'id="bp-docagent-v7-js"'],
    anchors: ['id="sideNav"', 'class="viewwrap"'],
  },
  {
    file: "site/admin.html",
    why: "لوحة تحكم الموقع — رقعة admin-command-center-v8",
    markers: ['id="bp-admin-v8-css"', 'id="bp-admin-v8-js"'],
    anchors: ['id="navDesk"', 'id="view-overview"', "pagehead"],
  },
  {
    file: "site/ar/compliance-dashboard.html",
    why: "لوحة الامتثال — رقعة compliance-dashboard-v6",
    markers: ['id="bp-compliance-v6-css"', 'id="bp-compliance-v6-js"'],
    anchors: ["hero-copy", "tl-row"],
  },
];

// ‏عقد الهوية للوحات الداخلية: الشعار الرسمي، والاسم «Business Partner» كما
// تفرضه سياسة العلامة، وطريقٌ واحد على الأقل للعودة إلى الموقع. اللوحة التي
// تُفتح ولا يُخرج منها عيبُ استخدامٍ لا تصميم. (`chat.html` مستثناة بقرار
// مكتوب في `generate.mjs`: صفحةٌ مخفية غير موصولة بشيء عن قصد.)
const IDENTITY = [
  { file: "site/dashboard.html", why: "لوحة فريق الإيجنتس" },
  { file: "site/doc-agent-admin.html", why: "لوحة مستشار المستندات" },
  { file: "site/monitor.html", why: "BP Inbox" },
  { file: "site/connect.html", why: "الأدوات ورحلة العميل" },
  { file: "site/portal.html", why: "بوابة الموظفين الأذكياء" },
];

const problems = [];
let checked = 0;

for (const item of CONTRACT) {
  const abs = path.resolve(item.file);
  if (!fs.existsSync(abs)) {
    problems.push(`${item.file}: الملف غير موجود — ${item.why}`);
    continue;
  }
  const html = fs.readFileSync(abs, "utf8");
  for (const m of item.markers) {
    if (!html.includes(m)) problems.push(`${item.file}: علامة الحقن ${m} غائبة — الرقعة لم تُطبَّق (${item.why})`);
  }
  for (const a of item.anchors) {
    if (!html.includes(a)) problems.push(`${item.file}: المرتكز ${a} غائب — المحقون لن يجد هدفه فيتبخّر التصميم بصمت (${item.why})`);
  }
  checked++;
}

for (const item of IDENTITY) {
  const abs = path.resolve(item.file);
  if (!fs.existsSync(abs)) {
    problems.push(`${item.file}: الملف غير موجود — ${item.why}`);
    continue;
  }
  const html = fs.readFileSync(abs, "utf8");
  if (!html.includes("/assets/img/logo.png"))
    problems.push(`${item.file}: الشعار الرسمي غائب — ${item.why}`);
  if (!html.includes("Business Partner"))
    problems.push(`${item.file}: اسم العلامة «Business Partner» غائب — ${item.why}`);
  // ‏رابط داخلي إلى الموقع: الجذر، أو العربية، أو أي صفحة داخلية.
  if (!/href="\/(ar\b|"|[a-z])/.test(html))
    problems.push(`${item.file}: لا رابط عودة إلى الموقع — من يفتح اللوحة لا يجد مخرجاً (${item.why})`);
  // ‏سياسة العلامة: الاسم العربي ممنوع في كل اللغات.
  for (const bad of ["شريك الأعمال", "شريك أعمالك"]) {
    if (html.includes(bad)) problems.push(`${item.file}: الاسم «${bad}» مخالف لسياسة العلامة — ${item.why}`);
  }
  checked++;
}

if (problems.length) {
  console.error(`حارس البوابات: ${problems.length} خلل — النشر متوقّف.`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`حارس البوابات OK — ${checked} لوحة، عقدها كامل.`);
