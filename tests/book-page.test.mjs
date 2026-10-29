// صفحة الحجز «الاتصال المرئي — استشارة مجانية» وقسم الموعد في /my — على الصفحات
// المولَّدة (شغّل npm run build قبله)، بالعربية والإنجليزية والفرنسية والصينية.
//
// ما يُثبَّت: الاسم والتجربة (مجانية، المدة، Meet، الرابط بالبريد ودعوة التقويم)،
// وأن الساعات والأيام لا تُكتب في الصفحة بل تُقرأ من ?action=slots، وأن /my
// يعرض الموعد القادم برابط الاجتماع ويفتح «انضم» قبل الموعد بخمس دقائق، وأن
// نصّ /my لا يقول ما يخالف الخادم (كان: «الأحد إلى الخميس» والخادم يقبل السبت).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRE = { ar: "/ar", en: "", fr: "/fr", zh: "/zh" };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const tx = (html) => JSON.parse(/TX=(\{.*?\}),(?:HOME=|ST=)/s.exec(html)[1]);

const TITLE = { ar: "الاتصال المرئي — استشارة مجانية", en: "Video call — free consultation", fr: "Appel vidéo — consultation gratuite", zh: "视频通话 — 免费咨询" };

for (const lang of Object.keys(PRE)) {
  const book = read(`site${PRE[lang]}/consultation.html`);

  test(`${lang}: صفحة الحجز باسم «الاتصال المرئي — استشارة مجانية» وتقول إنها مجانية وبالفيديو عبر Meet`, () => {
    assert.ok(book.includes(`<h2>${TITLE[lang]}</h2>`), "العنوان");
    assert.ok(book.includes("Google Meet"), "Google Meet مذكور");
    const t = tx(book);
    for (const k of ["fHours", "fDays", "fDaysAll", "doneT", "pendT", "pendMsg", "invMsg", "joinNote", "mgChange", "mgCancel", "confirm"]) assert.ok(t[k] && t[k].length > 2, `${lang}: ${k}`);
    if (lang !== "ar") for (const k of ["fHours", "doneT", "pendT", "pendMsg", "joinNote", "mgCancel", "confirm"]) assert.ok(!/[؀-ۿ]/.test(t[k]), `${lang}.${k} بلا حروف عربية`);
  });

  test(`${lang}: المدة والساعات والأيام تأتي من ?action=slots لا من نصٍّ ثابت`, () => {
    assert.ok(book.includes("/api/book?action=slots"), "تقرأ الفترات من الخادم");
    assert.ok(/META\.hours/.test(book) && /offDays/.test(book) && /slotMinutes/.test(book), "تعرض hours/offDays/slotMinutes من الرد");
    assert.ok(/id="bkFactHours"/.test(book) && /id="bkFactMin"/.test(book), "مواضع الساعات والمدة");
    assert.equal(/\b15:00\b|\b22:00\b|\b21:30\b|\b13:00\b|\b21:00\b|\b20:30\b/.test(book), false, "لا ساعةٌ مكتوبة في الصفحة");
    assert.equal(/الأحد إلى الخميس|Sunday to Thursday/.test(book), false, "لا أيامَ مكتوبة");
  });

  test(`${lang}: التوقيت بالرياض صراحةً، و«الموعد مؤكَّد» لا يُقال إلا لحدثٍ حقيقي (confirmed)`, () => {
    assert.ok(/GMT\+3/.test(book));
    assert.ok(/var ok=!!o\.confirmed/.test(book), "العنوان يتبع confirmed لا ok");
    assert.ok(/TX\.pendMsg/.test(book) && /TX\.doneT/.test(book));
    assert.ok(/o\.gcalUrl/.test(book) && /o\.meet/.test(book), "زرّ التقويم ورابط الاجتماع");
    assert.ok(/manageUrl/.test(book) && /action:'cancel'/.test(book) && /action:'reschedule'/.test(book), "تغيير/إلغاء الموعد");
    assert.ok(/lang:LANGC/.test(book), "لغة الزائر تصل الخادم فيردّ بها");
  });

  test(`${lang}: /my يعرض الموعد القادم برابط الاجتماع، و«انضم» يُفتح قبل الموعد بخمس دقائق`, () => {
    const my = read(`site${PRE[lang]}/my.html`);
    assert.ok(/function nextAppt\(\)/.test(my) && /function joinBox\(a\)/.test(my) && /function nextApptCard\(\)/.test(my));
    assert.ok(/id:'sv1NextAppt'/.test(my), "بطاقة الموعد القادم");
    assert.ok(/if\(a&&a\.status!=='CANCELLED'\)\{ac\.appendChild\(h\('p',\{class:'note'\},\[TX\.videoFree\]\)\)/.test(my), "كتلة الموعد الفعّال بأقواسٍ: بلا موعد (a=null) لا يُقرأ a.date (كسرت صفحة الطلب في المتصفح)");
    assert.ok(/now>=s-300000/.test(my), "الانضمام قبل الموعد بخمس دقائق (٣٠٠٠٠٠ مللي ثانية)");
    assert.ok(/now>e/.test(my), "ينتهي بانتهاء الجلسة");
    assert.ok(/var nca=nextApptCard\(\);if\(nca\)m\.appendChild\(nca\)/.test(my), "تظهر في الرئيسية");
    const t = tx(my);
    for (const k of ["nextAppt", "videoFree", "joinNow", "joinSoon", "meetLink", "addCal", "apptPending", "apptHours", "apptDays", "apptOut", "apptSoon", "apptTaken", "apptMany"]) assert.ok(t[k] && t[k].length > 3, `${lang}: ${k}`);
    if (lang !== "ar") for (const k of ["nextAppt", "joinNow", "joinSoon", "apptPending", "apptOut", "apptSoon", "apptTaken", "apptMany", "apptNote"]) assert.ok(!/[؀-ۿ]/.test(t[k]), `${lang}.${k} بلا حروف عربية`);
  });

  test(`${lang}: نصّ /my لا يخالف الخادم: لا «الأحد–الخميس» ولا ساعاتٌ مكتوبة، ومختار الفترات من ?action=slots`, () => {
    const my = read(`site${PRE[lang]}/my.html`);
    const t = tx(my);
    assert.equal(/الأحد إلى الخميس|Sunday to Thursday|du dimanche au jeudi|周日至周四/i.test(t.apptNote), false);
    assert.ok(/function slotPicker\(\)/.test(my) && my.includes("/api/book?action=slots"), "الفترات من الخادم");
    assert.equal(/type:'time'/.test(my), false, "لا حقل وقتٍ حرّ يقبل أي ساعة");
    assert.equal(/\b15:00\b|\b22:00\b|\b13:00\b|\b21:00\b/.test(t.apptHours), false);
    assert.ok(/apptErr\(o\)/.test(my) && /'out_of_hours'/.test(my) && /'friday'/.test(my) && /'off_day'/.test(my));
  });
}
