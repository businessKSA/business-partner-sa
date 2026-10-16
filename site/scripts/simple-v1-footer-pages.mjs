// Business Partner — Simple V1: صفحات التذييل (/ai-agents · /packages).
//
// وكيل footer-pages (تحت إدارة محمد، 2026-10-16). كانت الصفحتان «نصف جديدتين»:
// ترويسة وتذييل SV1 حول محتوى بتخطيط أقدم (`bp-public-brand-v5` + `main.js`)،
// وزرّاهما يرجعان إلى الموقع القديم (`/account`). هنا تُبنيان بقالب SV1 كاملاً
// عبر `SV1.shell()`، ورحلتهما تبقى في الجديد: سلة ← دفع ← `/my`.
//
// الشكل والرحلة لنا، والمحتوى لأصحابه: بطاقات المستشارين ونصوصها وأسعارها
// للـ`smart-advisors`، وبنود الباقات وأسعارها للـ`packages`. الأسعار تُقرأ من
// الكتالوج بالـSKU ومن `site.packages` ولا تُكتب هنا. والزائر لا يرى سعراً
// (`SHOW_PRICES=false`): صنف `price-amt` / `emp-price` تُخفيه قاعدة
// `html[data-prices="off"]` التي يحقنها `head()`، و`[data-guest-note]` تُظهر البديل.
//
// عقد السلة هو عقد كل الموقع حرفاً بحرف (انظر simple-v1-catalog.mjs: cartItem):
// `localStorage.bp_cart` — عنصر بحقوله بهذا الترتيب، و`amount` رقم، و`price` نصّ
// عرض، وتكرار الإضافة يزيد `qty` على السطر نفسه بالـid ولا يضيف سطراً.
//
// الاعتماديات تُمرَّر من generate.mjs في موضع الاستدعاء (لا استيراد منه):
//   ctx = { lang, esc, localizeLabel, pageVisible,  services,                // المستشارون
//           site, pkgCode, employerYearly, portalQuoteUrl }                  // الباقات
// fr و zh تعرض الإنجليزية حتى تُترجم، كبقية صفحات SV1.

const cx = (lang) => (en, ar) => (lang === "ar" ? ar : en);

// ---------------------------------------------------------------- السلة --
// مشتركة بين الصفحتين: عنصر الزرّ ← bp_cart ← حدث bp:cart لعدّاد الترويسة.
function cartScript(toastText, failText) {
  return `<script>(function(){"use strict";
var T=${JSON.stringify({ ok: toastText, fail: failText })};
var box=document.getElementById('fpToast'),tx=document.getElementById('fpToastTx'),tm=0;
function toast(m,err){if(!box)return;tx.textContent=m;box.classList.toggle('err',!!err);box.classList.remove('sv1-hide');clearTimeout(tm);tm=setTimeout(function(){box.classList.add('sv1-hide')},4200)}
function item(b){var a=b.getAttribute('data-amount');return {id:b.getAttribute('data-id'),nameEn:b.getAttribute('data-name-en')||'',nameAr:b.getAttribute('data-name-ar')||'',amount:a?Number(a):null,price:b.getAttribute('data-price')||'',kind:b.getAttribute('data-kind')||'service',qty:1,surchargeAmount:null,surchargeFreeCount:null,pricePublic:0,billingPeriod:'',renewsAt:null,commissionPercent:0}}
function add(b){var c;try{c=JSON.parse(localStorage.getItem('bp_cart'))||[];if(!Array.isArray(c))c=[]}catch(e){c=[]}
var it=item(b),ex=c.filter(function(x){return x.id===it.id})[0];if(ex)ex.qty=(ex.qty||1)+1;else c.push(it);
try{localStorage.setItem('bp_cart',JSON.stringify(c))}catch(e){return false}
try{document.dispatchEvent(new CustomEvent('bp:cart',{bubbles:true}))}catch(e){}return true}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.fp-add');if(!b)return;e.preventDefault();
if(add(b))toast(T.ok,false);else toast(T.fail,true)});
})();</script>`;
}

const SHARED_CSS = `<style id="sv1-fp-css">
.fp-head{max-width:820px;margin:0 0 34px}
.fp-head h1{font-size:clamp(30px,4.4vw,52px);line-height:1.12;margin:16px 0 14px;letter-spacing:-.035em;font-weight:200;color:var(--ink)}
.fp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.fp-card{position:relative;display:flex;flex-direction:column;gap:10px;background:#fff;border:1px solid var(--l);border-radius:14px;padding:22px;box-shadow:var(--sh);transition:transform .15s ease,border-color .2s ease,box-shadow .2s ease}
.fp-card:hover{border-color:var(--acLine);box-shadow:var(--sh2)}
.fp-card[data-badge]::before{content:attr(data-badge);position:absolute;top:-11px;inset-inline-start:18px;background:var(--ac);color:#fff;font-size:11px;padding:2px 11px;border-radius:999px;font-weight:500}
.fp-card small{font-family:var(--fm);font-size:11px;color:var(--faint);letter-spacing:.06em}
.fp-card h3{font-size:19px;font-weight:500;color:var(--ink);margin:0;line-height:1.4}
.fp-card .tg{font-size:13.5px;color:var(--mut);margin:0;line-height:1.85}
.fp-card ul{list-style:none;margin:2px 0 0;padding:0;display:flex;flex-direction:column;gap:7px}
.fp-card li{font-size:13px;color:var(--t);padding-inline-start:20px;position:relative;line-height:1.7}
.fp-card li::before{content:"✓";position:absolute;inset-inline-start:0;color:var(--ok);font-size:12px;font-weight:700}
.fp-price{font-size:20px;font-weight:300;color:var(--ink);margin-top:4px}
.fp-price .pk-per,.fp-price small{font-size:12px;color:var(--mut);font-family:inherit;letter-spacing:0}
.fp-guest{font-size:12.5px;color:var(--mut);margin:0}
.fp-acts{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:auto;padding-top:12px}
.fp-acts .sv1-btn{min-height:44px}
.fp-more{font-size:13px;color:var(--ac);font-weight:500;min-height:44px;display:inline-flex;align-items:center;padding:0 4px}
.fp-note{margin:22px 0 0;text-align:center;font-size:12.5px;color:var(--mut)}
.fp-band{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;background:var(--n);color:#fff;border-radius:16px;padding:28px;margin:44px 0 0}
.fp-band h2{font-size:22px;font-weight:300;color:#fff;margin:0 0 6px}
.fp-band p{margin:0;color:rgba(255,255,255,.75);font-size:14px;max-width:620px;line-height:1.8}
.fp-band .sv1-btn{background:#fff;color:var(--n);border-color:#fff;min-height:44px}
.fp-band .sv1-btn.ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.45)}
.fp-after{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:0}
.fp-step{background:var(--soft);border:1px solid var(--line2);border-radius:14px;padding:18px}
.fp-step i{font-style:normal;font-family:var(--fm);font-size:12px;color:var(--faint)}
.fp-step b{display:block;font-weight:500;color:var(--ink);margin:4px 0 4px;font-size:14.5px}
.fp-step span{font-size:12.5px;color:var(--mut);line-height:1.75}
.fp-h2{font-size:clamp(22px,2.6vw,30px);font-weight:300;color:var(--ink);margin:56px 0 6px;letter-spacing:-.025em}
.fp-sub{color:var(--mut);margin:0 0 18px;font-size:14px}
.fp-toast{position:fixed;inset-inline:0;top:84px;margin-inline:auto;width:max-content;max-width:calc(100vw - 28px);z-index:2147483100;background:var(--ink);color:#fff;border-radius:12px;padding:11px 16px;font-size:13px;font-weight:600;box-shadow:0 10px 28px rgba(11,27,90,.3);display:flex;gap:14px;align-items:center}
.fp-toast a{color:#fff;text-decoration:underline;white-space:nowrap}
.fp-toast.err{background:#8a1c1c}
@media(max-width:1000px){.fp-grid{grid-template-columns:repeat(2,1fr)}.fp-after{grid-template-columns:repeat(2,1fr)}}
@media(max-width:620px){.fp-grid,.fp-after{grid-template-columns:1fr}.fp-band{padding:20px}.fp-card{padding:18px}}
</style>`;

function toastHtml(u, viewCart) {
  return `<div class="fp-toast sv1-hide" id="fpToast" role="status" aria-live="polite"><span id="fpToastTx"></span><a href="${u("/cart")}">${viewCart}</a></div>`;
}

// ---------------------------------------------------------------- المستشارون --
export function buildSimpleAiAgents(SV1, ctx) {
  const { lang: langFn, esc, localizeLabel, pageVisible, services } = ctx;
  const lang = langFn();
  const L = cx(lang);
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;
  const home = lang === "en" ? "/" : "/" + lang + "/";

  const byCode = (code) => services.find((s) => (s.code || "").toUpperCase() === String(code).toUpperCase()) || null;
  const price = (code) => { const s = byCode(code); return s && s.price ? { amount: s.price.amount ?? null, label: s.price.label || "" } : { amount: null, label: "" }; };
  const emp = price("BP-AI-SMART-EMPLOYEE");
  const comp = price("BP-AI-03");
  const shared = price("BP-AI-04");
  const rev = price("REV-LAUNCH");

  const guest = `<p class="fp-guest" data-guest-note>${L("Price shown after sign-in", "السعر يظهر بعد تسجيل الدخول")}</p>`;
  const fixed = (lbl) => `<div class="fp-price price-amt">${esc(localizeLabel(lbl))}</div>${guest}`;
  const from = (lbl) => `<div class="fp-price price-amt">${L("From", "يبدأ من")} ${esc(localizeLabel(lbl))}</div>${guest}`;

  // الشراء: بند له سعر ← سلة؛ بلا سعر ← استشارة (كما في cartBtns القديم).
  const buy = ({ id, code, nameEn, nameAr, amount, label }) => amount == null
    ? `<a class="sv1-btn primary" href="${u("/consultation")}?topic=ai&about=${encodeURIComponent(lang === "ar" ? nameAr : nameEn)}">${L("Book a consultation", "احجز استشارة")}</a>`
    : `<button type="button" class="sv1-btn primary fp-add" data-id="${esc(id)}" data-bp-code="${esc(code)}" data-name-en="${esc(nameEn)}" data-name-ar="${esc(nameAr)}" data-amount="${amount}" data-price="${esc(localizeLabel(label || ""))}" data-kind="agent">${L("Add to cart", "أضف إلى السلة")}</button>`;
  const cta = (href, en, ar) => `<a class="sv1-btn primary" href="${esc(href)}">${L(en, ar)}</a>`;
  const more = (href) => `<a class="fp-more" href="${esc(href)}">${L("Details", "التفاصيل")}</a>`;

  const cards = [
    {
      tag: "B10X", name: L("B10X Smart Advisor", "مستشار B10X الذكي"),
      tg: L("The operating layer over everything: ask, it routes you to the right service, requirements and execution.", "طبقة التشغيل فوق كل شيء: اسأل، وهو يوصلك للخدمة الصحيحة والمتطلبات والتنفيذ."),
      feats: [L("Understands your goal 24/7", "يفهم هدفك 24/7"), L("Routes to any of 140+ services", "يوجهك لأي خدمة من +140"), L("From question to tracked request", "من السؤال إلى طلب مُتابَع")],
      price: "", acts: cta(u("/b10x"), "Explore B10X", "اكتشف B10X") + `<a class="fp-more" href="${home}#advisor">${L("Try it now", "جرّبه الآن")}</a>`,
    },
    {
      tag: "AI", name: L("Compliance Advisor", "مستشار الامتثال"),
      tg: L("Qiwa, Muqeem, GOSI, Mudad and Nitaqat under constant watch — your role is approval only.", "قوى ومقيم والتأمينات ومدد ونطاقات تحت مراقبة دائمة — ودورك الموافقة فقط."),
      feats: [L("Deadlines before they become fines", "المهل قبل أن تصير غرامات"), L("Violation review & objection filing", "مراجعة المخالفات وتقديم الاعتراض"), L("Periodic compliance reports", "تقارير امتثال دورية")],
      price: comp.amount != null ? fixed(comp.label) : "",
      acts: buy({ id: "agent-Compliance-Agent", code: "BP-AI-03", nameEn: "Compliance & obligations agent", nameAr: "مستشار الامتثال والالتزام", amount: comp.amount, label: comp.label }) + more(u("/compliance-agent")),
    },
    {
      tag: "AI", name: L("Specialist Smart Employee", "الموظف الذكي المتخصص"),
      tg: L("A 24-hour specialist — marketing, admin, sales, tech or procurement — without the hiring cost.", "متخصص يعمل 24 ساعة — تسويق، إداري، مبيعات، تقني أو مشتريات — بدون تكلفة توظيف."),
      feats: [L("12 specialties to pick from", "12 تخصصاً تختار منها"), L("Works inside your policies", "يعمل ضمن سياساتك"), L("Each specialty its own subscription", "كل تخصص اشتراك مستقل")],
      price: emp.amount != null ? from(emp.label) : "",
      // التفعيل يفتح تخصصاً بعينه، فلا يُشترى عاماً من هنا: الاختيار في /connect ثم السلة.
      acts: cta(u("/connect"), "Pick your employee", "اختر موظفك") + more(u("/smart-employee")),
    },
    {
      tag: "AI", name: L("Document Advisor", "مستشار المستندات"),
      tg: L("Reads your documents once, then fills any form — Word, Excel and PDF, in place, traceable to the source.", "يقرأ مستنداتك مرة واحدة ثم يعبّئ أي نموذج — Word وExcel وPDF في مكانها، وكل قيمة بمصدرها."),
      feats: [L("Extraction with provenance", "استخراج بمصدر لكل قيمة"), L("Fills forms in place", "يعبّئ النماذج في مكانها"), L("Private to your company vault", "خاص بخزنة شركتك")],
      price: "",
      acts: buy({ nameEn: "Document advisor", nameAr: "مستشار المستندات", amount: null }) + more(u("/ai-document-agent")),
    },
    {
      tag: "AI", name: L("Business Development Advisor", "مستشار تطوير الأعمال"),
      tg: L("Customers, suppliers, partners and a pipeline that never sleeps — growth as an operating system.", "عملاء وموردون وشركاء وPipeline لا ينام — النمو كنظام تشغيل."),
      feats: [L("Always-on sales pipeline", "بايبلاين مبيعات دائم"), L("Supplier sourcing & vendor registration", "توريد موردين وتسجيل لدى العملاء"), L("Monthly plans by stage", "خطط شهرية حسب مرحلتك")],
      price: rev.amount != null ? from(rev.label) : "",
      acts: cta(u("/business-development"), "Explore the plans", "استعرض الخطط"),
      hide: !pageVisible("business-development"),
    },
    {
      tag: "OPS", name: L("Shared Services Team", "فريق الخدمات المشتركة"),
      tg: L("The Compliance Advisor plus a full working team — one workspace for your platforms and your people.", "مستشار الامتثال مع فريق عمل كامل — لوحة واحدة لمنصاتك وفريقك."),
      feats: [L("Compliance + execution in one", "امتثال وتنفيذ في واحد"), L("Available to companies & individuals", "متاح للمنشآت والأفراد"), L("Scales as you grow", "يتوسع مع نموك")],
      price: shared.amount != null ? fixed(shared.label) : "",
      acts: buy({ id: "agent-Shared-services-team", code: "BP-AI-04", nameEn: "Shared services team", nameAr: "فريق الخدمات المشتركة", amount: shared.amount, label: shared.label }) + more(u("/shared-services")),
    },
  ].filter((c) => !c.hide).map((c) => `<article class="fp-card"><small>${c.tag}</small><h3>${c.name}</h3><p class="tg">${c.tg}</p><ul>${c.feats.map((f) => `<li>${f}</li>`).join("")}</ul>${c.price}<div class="fp-acts">${c.acts}</div></article>`).join("");

  const after = [
    [L("Add to cart", "أضف إلى السلة"), L("Pick the advisor you want, or combine several.", "اختر المستشار الذي تريده، أو اجمع أكثر من واحد.")],
    [L("Pay online", "ادفع إلكترونياً"), L("Card, mada, Apple Pay or Tamara — the fee is confirmed before you pay.", "بطاقة أو مدى أو Apple Pay أو تمارا — والمبلغ يتأكد قبل الدفع.")],
    [L("We activate it", "نفعّله لك"), L("Activation starts once payment is confirmed.", "يبدأ التفعيل فور تأكيد الدفع.")],
    [L("Follow it from your account", "تابعه من حسابك"), L("Your requests, invoices and documents live in one place.", "طلباتك وفواتيرك ومستنداتك في مكان واحد.")],
  ].map(([b, s], i) => `<div class="fp-step"><i>${String(i + 1).padStart(2, "0")}</i><b>${b}</b><span>${s}</span></div>`).join("");

  const title = L("Smart Advisors", "المستشارون الأذكياء");
  const desc = L(
    "Compliance, documents, growth and specialist smart employees — one subscription mechanism, all followed from your account.",
    "الامتثال والمستندات والنمو وموظفون أذكياء متخصصون — آلية اشتراك واحدة، وكلها تُتابَع من حسابك.",
  );

  const body = `${SV1.header("/ai-agents")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="fp-head">
      <span class="sv1-tag">${title}</span>
      <h1>${L("A smart team that works 24/7 — and a human team behind it.", "فريق ذكي يعمل 24/7 — وخلفه فريق بشري.")}</h1>
      <p class="sv1-lead" style="max-width:none">${L(
        "Every advisor does one job extremely well: compliance, documents, growth, or a full specialist employee. Subscribe to one, or combine them — they all buy the same way and you follow them from your account.",
        "كل مستشار يتقن مهمة واحدة تماماً: الامتثال، المستندات، النمو، أو موظف متخصص كامل. اشترك في واحد أو اجمعها — كلها تُشترى بنفس الطريقة وتتابعها من حسابك.",
      )}</p>
    </div>
    <div class="fp-grid">${cards}</div>
    <p class="fp-note">${L("Prices are our fees; government fees, where relevant, are separate and disclosed before you pay.", "الأسعار أتعابنا؛ والرسوم الحكومية — حيث تنطبق — منفصلة ومعلنة قبل الدفع.")}</p>
    <h2 class="fp-h2">${L("How it works", "كيف تبدأ؟")}</h2>
    <p class="fp-sub">${L("Four steps from choosing to following your advisor.", "أربع خطوات من الاختيار إلى متابعة مستشارك.")}</p>
    <div class="fp-after">${after}</div>
    <div class="fp-band">
      <div><h2>${L("Not sure where to start?", "مو متأكد من وين تبدأ؟")}</h2><p>${L("Tell the B10X smart advisor what you need — it routes you to the right advisor and the right plan.", "قل للمستشار الذكي وش تحتاج — وهو يوجهك للمستشار الصحيح والخطة الصحيحة.")}</p></div>
      <div style="display:flex;gap:9px;flex-wrap:wrap">
        <a class="sv1-btn" href="${home}#advisor">${L("Talk to the smart advisor", "كلّم المستشار الذكي")}</a>
        <a class="sv1-btn ghost" href="${u("/consultation")}">${L("Book a free consultation", "احجز استشارة مجانية")}</a>
      </div>
    </div>
  </div></section>
  </main>
  ${toastHtml(u, L("View cart", "عرض السلة"))}
${SV1.footer()}`;

  return SV1.shell({
    title: `${title} — Business Partner`,
    desc,
    path: "/ai-agents",
    body: SHARED_CSS + body,
    script: cartScript(L("Added to your cart", "تمت الإضافة إلى السلة"), L("Could not add to the cart — please try again", "تعذّرت الإضافة إلى السلة — حاول مجدداً")),
  });
}

// ---------------------------------------------------------------- الباقات --
// الشكل فقط: بنود الباقات وأسعارها من site.packages (للـ`packages`). الزرّ الشهري
// يحمل نسختي الشهري والسنوي في data-*، ويبدّلهما التبديل أدناه كما كان في main.js.
export function buildSimplePackages(SV1, ctx) {
  const { lang: langFn, esc, localizeLabel, site, pkgCode, employerYearly, portalQuoteUrl } = ctx;
  const lang = langFn();
  const L = cx(lang);
  const pre = lang === "en" ? "" : "/" + lang;
  const u = (p) => pre + p;
  const p = site.packages;
  const groups = p.groups || [{ key: "business", ar: p.title, en: p.titleEn, descAr: p.subtitle, descEn: p.subtitleEn, tiers: p.tiers }];
  const yearlyDiscount = (site.employerPlans && site.employerPlans.yearlyDiscount) || 0;
  const fmt = (n) => Number(n).toLocaleString(lang === "ar" ? "ar-SA" : "en-US");
  const isMonthly = (t) => /شهري|monthly/i.test(t.priceEn || t.price || "");
  const pick = (en, ar) => L(en || ar, ar || en);

  const tierCard = (t) => {
    const name = pick(t.nameEn || t.name, t.nameAr);
    const feats = `<ul>${t.features.map((f, i) => `<li>${esc(pick((t.featuresEn && t.featuresEn[i]) || f, f))}</li>`).join("")}</ul>`;
    const badge = t.highlight ? ` data-badge="${esc(L(t.badgeEn || "Most requested", t.badgeAr || "الأكثر طلباً"))}"` : "";
    const guest = `<p class="fp-guest" data-guest-note>${L("Sign in to see the price", "سجّل دخولك لعرض السعر")}</p>`;
    const code = pkgCode(t);
    const quote = `<a class="fp-more" href="${esc(portalQuoteUrl(code))}">${L("Get an official quotation", "احصل على عرض سعر رسمي")}</a>`;
    if (t.amount != null && isMonthly(t)) {
      const yearly = employerYearly(t.amount, yearlyDiscount);
      const nm = { m: [`${t.nameEn || t.name} — Monthly subscription`, `${t.nameAr} — اشتراك شهري`], y: [`${t.nameEn || t.name} — Yearly subscription`, `${t.nameAr} — اشتراك سنوي`] };
      const lm = `${fmt(t.amount)} ${L("SAR / mo", "ريال / شهرياً")}`;
      const ly = `${fmt(yearly)} ${L("SAR / yr", "ريال / سنوياً")}`;
      return `<article class="fp-card"${badge}>
        <h3>${esc(name)}</h3>
        <div class="fp-price"><span class="emp-price emp-price-m">${esc(lm)}</span><span class="emp-price emp-price-y" hidden>${esc(ly)}</span></div>${guest}
        <p class="tg">${esc(pick(t.forEn || t.for, t.for))}</p>
        ${feats}
        <div class="fp-acts"><button type="button" class="sv1-btn primary fp-add" data-kind="package" data-id="pkg-${esc(t.key)}-monthly" data-name-en="${esc(nm.m[0])}" data-name-ar="${esc(nm.m[1])}" data-amount="${t.amount}" data-price="${esc(lm)}"
          data-id-m="pkg-${esc(t.key)}-monthly" data-id-y="pkg-${esc(t.key)}-yearly" data-amount-m="${t.amount}" data-amount-y="${yearly}"
          data-name-en-m="${esc(nm.m[0])}" data-name-ar-m="${esc(nm.m[1])}" data-name-en-y="${esc(nm.y[0])}" data-name-ar-y="${esc(nm.y[1])}" data-price-m="${esc(lm)}" data-price-y="${esc(ly)}">${L("Add to cart", "أضف إلى السلة")}</button>${quote}</div>
      </article>`;
    }
    const label = localizeLabel(lang === "ar" ? t.price : (t.priceEn || t.price));
    const buy = t.amount != null
      ? `<button type="button" class="sv1-btn primary fp-add" data-kind="package" data-id="pkg-${esc(t.key || t.name)}" data-name-en="${esc(t.nameEn || t.name || t.nameAr)}" data-name-ar="${esc(t.nameAr)}" data-amount="${t.amount}" data-price="${esc(label)}">${L("Add to cart", "أضف إلى السلة")}</button>`
      : `<a class="sv1-btn primary" href="${u("/consultation")}?topic=other&about=${encodeURIComponent(L(t.nameEn || t.name || t.nameAr, t.nameAr))}">${L("Book a consultation", "احجز استشارة")}</a>`;
    return `<article class="fp-card"${badge}>
        <h3>${esc(name)}</h3>
        ${t.price ? `<div class="fp-price price-amt">${esc(label)}</div>${guest}` : ""}
        <p class="tg">${esc(pick(t.forEn || t.for, t.for))}</p>
        ${feats}
        <div class="fp-acts">${buy}${quote}</div>
      </article>`;
  };

  const tabs = groups.map((g, i) => `<button type="button" class="fp-tab${i === 0 ? " on" : ""}" data-group="${esc(g.key)}" aria-pressed="${i === 0}">${esc(L(g.en, g.ar))}</button>`).join("");
  const panels = groups.map((g, i) => {
    const hasMonthly = yearlyDiscount > 0 && g.tiers.some((t) => t.amount != null && isMonthly(t));
    const toggle = hasMonthly ? `<div class="fp-bill emp-billing-toggle" role="group"><button type="button" class="fp-bill-b on" data-bill="m">${L("Monthly", "شهري")}</button><button type="button" class="fp-bill-b" data-bill="y">${L("Yearly", "سنوي")} <span>${L(`Save ${Math.round(yearlyDiscount * 100)}%`, `وفّر ${Math.round(yearlyDiscount * 100)}٪`)}</span></button></div>` : "";
    return `<div class="fp-panel${i === 0 ? " on" : ""}" id="pkg-${esc(g.key)}">
      ${g.descAr || g.descEn ? `<p class="fp-sub">${esc(pick(g.descEn, g.descAr))}</p>` : ""}${toggle}
      <div class="fp-grid fp-grid-${g.tiers.length === 4 ? 4 : g.tiers.length === 2 ? 2 : 3}">${g.tiers.map(tierCard).join("")}</div>
    </div>`;
  }).join("");

  const steps = [
    [L("Register / log in", "سجّل أو سجّل دخولك"), L("Create your account on the site.", "أنشئ حسابك في الموقع.")],
    [L("Add the package to your cart", "أضف الباقة للسلة"), L("Then pay online by card, mada, Apple Pay or Tamara.", "ثم ادفع إلكترونياً بالبطاقة أو مدى أو Apple Pay أو تمارا.")],
    [L("Payment is confirmed", "يتأكد الدفع"), L("Your subscription activates once the payment is confirmed.", "يتفعّل اشتراكك فور تأكيد الدفع.")],
    [L("We start managing your account", "نبدأ إدارة حسابك"), L("Your dedicated team starts on the platforms your package covers.", "فريقك المخصّص يبدأ العمل على المنصات المشمولة بباقتك.")],
  ].map(([b, s], i) => `<div class="fp-step"><i>${String(i + 1).padStart(2, "0")}</i><b>${b}</b><span>${s}</span></div>`).join("");

  const title = L("Packages", "الباقات");
  const desc = pick(p.subtitleEn || p.subtitle, p.subtitle);
  const css = `<style id="sv1-fp-pk-css">
.fp-tabs{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 22px}
.fp-tab,.fp-bill-b{font:inherit;font-size:13px;padding:10px 16px;min-height:44px;border:1px solid var(--l);border-radius:999px;background:#fff;color:var(--ink);cursor:pointer}
.fp-tab.on,.fp-bill-b.on{background:var(--ac);border-color:var(--ac);color:#fff}
.fp-bill{display:inline-flex;gap:6px;margin:0 0 20px}
.fp-bill-b span{font-size:11px;opacity:.85}
.fp-panel{display:none}.fp-panel.on{display:block}
.fp-grid-4{grid-template-columns:repeat(4,1fr)}.fp-grid-2{grid-template-columns:repeat(2,1fr)}
.fp-panel .fp-grid{margin-top:14px;row-gap:22px}
@media(max-width:1100px){.fp-grid-4{grid-template-columns:repeat(2,1fr)}}
@media(max-width:620px){.fp-grid-4,.fp-grid-2{grid-template-columns:1fr}}
</style>`;
  const js = `<script>(function(){"use strict";
var tabs=document.querySelectorAll('.fp-tab'),panels=document.querySelectorAll('.fp-panel');
function show(g){tabs.forEach(function(t){var on=t.getAttribute('data-group')===g;t.classList.toggle('on',on);t.setAttribute('aria-pressed',on)});panels.forEach(function(x){x.classList.toggle('on',x.id==='pkg-'+g)})}
tabs.forEach(function(t){t.addEventListener('click',function(){show(t.getAttribute('data-group'))})});
var h=(location.hash||'').replace('#pkg-','');if(h&&document.getElementById('pkg-'+h))show(h);
function bill(b){document.querySelectorAll('.fp-bill-b').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-bill')===b)});
document.querySelectorAll('.emp-price-m').forEach(function(e){e.hidden=b!=='m'});document.querySelectorAll('.emp-price-y').forEach(function(e){e.hidden=b!=='y'});
document.querySelectorAll('.fp-add[data-id-m]').forEach(function(a){['id','amount','name-en','name-ar','price'].forEach(function(k){a.setAttribute('data-'+k,a.getAttribute('data-'+k+'-'+b))})})}
document.querySelectorAll('.fp-bill-b').forEach(function(x){x.addEventListener('click',function(){bill(x.getAttribute('data-bill'))})});
})();</script>`;

  const body = `${SV1.header("/packages")}
  <main>
  <section class="sv1-sec"><div class="wrap">
    <div class="fp-head">
      <span class="sv1-tag">${title}</span>
      <h1>${L("Choose the package that fits your establishment", "اختر الباقة التي تناسب منشأتك")}</h1>
      <p class="sv1-lead" style="max-width:none">${L("Annual service packages, plus one-time company-formation and investment services — all from our official catalog.", "باقات خدمات سنوية، وخدمات تأسيس شركات واستثمار لمرة واحدة — كلها من الكتالوج الرسمي.")}</p>
      <div style="margin-top:18px"><a class="sv1-btn" href="${u("/catalog")}">${L("Or pick single services from the catalog", "أو اختر خدمات مفردة من الكتالوج")}</a></div>
    </div>
    <div class="fp-tabs" role="group">${tabs}</div>
    ${panels}
    <p class="fp-note">${esc(pick(p.noteEn, p.note))}</p>
    <h2 class="fp-h2">${L("How to subscribe", "كيف تشترك؟")}</h2>
    <p class="fp-sub">${L("Four steps from registering to activation.", "أربع خطوات من التسجيل إلى التفعيل.")}</p>
    <div class="fp-after">${steps}</div>
    <div class="fp-band">
      <div><h2>${L("Not sure which package fits you?", "محتار أي باقة تناسبك؟")}</h2><p>${L("Book a free consultation and we recommend the best package in minutes.", "احجز استشارة مجانية ونرشّح لك الباقة الأنسب في دقائق.")}</p></div>
      <div style="display:flex;gap:9px;flex-wrap:wrap"><a class="sv1-btn" href="${u("/consultation")}">${L("Book a free consultation", "احجز استشارة مجانية")}</a><a class="sv1-btn ghost" href="${u("/my")}">${L("Already subscribed? Open your account", "مشترك بالفعل؟ افتح حسابك")}</a></div>
    </div>
  </div></section>
  </main>
  ${toastHtml(u, L("View cart", "عرض السلة"))}
${SV1.footer()}`;

  return SV1.shell({
    title: `${title} — Business Partner`, desc, path: "/packages",
    body: SHARED_CSS + css + body,
    script: js + cartScript(L("Added to your cart", "تمت الإضافة إلى السلة"), L("Could not add to the cart — please try again", "تعذّرت الإضافة إلى السلة — حاول مجدداً")),
  });
}
