// Business Partner — Simple V1: «مسار الزائر» في الرئيسية (أمر المالك 2026-10-10:
// «ولازم نبني مسار واضح للعميل أول ما يدخل الموقع»).
//
// الهدف: زائر جديد يعرف خلال خمس ثوانٍ ماذا نقدّم وما خطوته التالية. فوق الطيّ
// أربعة أشياء فقط: جملة بما نقدّمه، سؤال «ما الذي تحتاجه اليوم؟»، مربع بحث،
// وأربع بطاقات — لكل بطاقة مسارٌ واحد ووجهةٌ واحدة:
//
//   أ) أؤسس شركة         → /catalog?door=formation   (الكتالوج مصفّى بمجال التأسيس)
//   ب) خدمة حكومية      → /catalog?door=government  (مصفّى بمجال العلاقات الحكومية)
//   ج) لا أعرف          → #advisor                  (المستشار الذكي بباب الاستشارة)
//   د) لديّ حساب/طلب    → /my                       (وللمسجَّل: شريط «طلباتك» بدل البطاقة)
//
// والبحث لا يبني محرّكاً جديداً: ينقل إلى /catalog?q= حيث يعمل بحث الكتالوج
// نفسه، ويعرض فوراً اقتراحات من الأسماء الظاهرة (١٩٥ خدمة بلا المخفي) المضمَّنة
// وقت البناء — فما أُخفي في site/data/hidden.json لا يظهر هنا.
//
// لا أسعار هنا (SHOW_PRICES=false): البطاقات الشائعة بلا مبلغ، وزر «أضف للسلة»
// يخصّ ما له سعر في الكتالوج وليس عقاراً ولا سياحة — عقد السلة نفسه في
// simple-v1-catalog.mjs (`localStorage.bp_cart`).
import fs from "node:fs";
import path from "node:path";
import { visibleCatalogRows } from "./hidden.mjs";

// ست خدمات شائعة بأكوادها (اختيار تحريري لا بيانات مخترعة): تُرسم من الكتالوج
// المبني بأسمائه، وما أُخفي أو غاب عن الكتالوج يُسقَط ولا يترك فراغاً.
const POPULAR = ["BP-SBC-02", "BP-SBC-19", "BP-ZATCA-04", "BP-GOSI-01", "BP-MUQEEM-03", "BP-SAIP-01"];
const NO_CART = new Set(["Real Estate", "Tourism"]);

export function buildHomePath({ t, esc, href, lang, eorTitle }) {
  const l = lang();
  const ar = l === "ar";
  const arrow = ar ? "←" : "→";

  let raw = { services: [] };
  try { raw = JSON.parse(fs.readFileSync(path.resolve("site/assets/data/catalog.json"), "utf8")); } catch {}
  const rows = visibleCatalogRows(raw.services || []);

  const nameOf = (s) => (ar ? s.nameAr : s.nameEn) || s.nameAr || s.nameEn || "";
  // مصفوفة مضغوطة للاقتراحات: [الاسم بلغة الصفحة، الـslug، نص البحث المطبَّع الأولي]
  const search = rows.filter((s) => s.code && nameOf(s)).map((s) => [
    nameOf(s), s.code.toLowerCase(), `${s.nameAr || ""} ${s.nameEn || ""} ${s.code}`,
  ]);
  const popular = POPULAR.map((c) => rows.find((s) => s.code === c)).filter(Boolean).map((s) => ({
    slug: s.code.toLowerCase(),
    name: nameOf(s),
    buy: s.amount != null && Number(s.amount) > 0 && !NO_CART.has(s.category)
      ? { id: "svc-" + s.code.toLowerCase(), nameAr: s.nameAr || s.nameEn || "", nameEn: s.nameEn || s.nameAr || "", amount: Number(s.amount) }
      : null,
  }));

  const cards = [
    ["formation", "🏢", t("hpCardFormation"), t("hpCardFormationSub"), href("/catalog") + "?door=formation", ""],
    ["government", "🏛️", t("hpCardGov"), t("hpCardGovSub"), href("/catalog") + "?door=government", ""],
    ["unsure", "💬", t("hpCardUnsure"), t("hpCardUnsureSub"), "#advisor", ' data-door="consulting"'],
    ["account", "👤", t("hpCardAccount"), t("hpCardAccountSub"), href("/my"), ""],
  ].map(([k, ic, h, sub, to, extra]) =>
    `<a class="sv1-pcard" id="path-${k}" href="${esc(to)}"${extra} data-track="مسار: ${k}"><span class="ico" aria-hidden="true">${ic}</span><span class="tx"><b>${h}</b><small>${sub}</small></span><span class="go" aria-hidden="true">${arrow}</span></a>`).join("");

  const hero = `
  <section class="sv1-hero sv1-path"><div class="wrap">
    <h1>${t("hpTitle")}</h1>
    <p class="sv1-lead">${t("hpSub")}</p>
    <div class="sv1-pask">
      <h2>${t("hpQ")}</h2>
      <form class="sv1-psearch" id="hpSearch" action="${esc(href("/catalog"))}" method="get" role="search" autocomplete="off">
        <label for="hpQ">${t("hpSearchLbl")}</label>
        <div class="row">
          <input id="hpQ" name="q" type="search" placeholder="${esc(t("hpSearchPh"))}" enterkeyhint="search">
          <button type="submit" class="sv1-btn primary" data-track="بحث الرئيسية">${t("hpSearchGo")}</button>
        </div>
        <div class="sv1-psug" id="hpSug" hidden></div>
      </form>
    </div>
    <div class="sv1-pcards" id="hpCards">${cards}</div>
    <div class="sv1-porders sv1-hide" id="hpOrders">
      <div><b>${t("hpOrders")}</b><small>${t("hpOrdersSub")}</small></div>
      <a class="sv1-btn primary" href="${esc(href("/my"))}" data-track="مسار: طلباتك">${t("hpOrdersBtn")} ${arrow}</a>
    </div>
    <p class="sv1-pmore">${t("hpEorLead")} <a id="door-eor" href="${esc(href("/eor"))}" data-track="مسار: eor">${eorTitle} ${arrow}</a></p>
  </div></section>`;

  const steps = [1, 2, 3, 4].map((n) => `<li><i>${n}</i><b>${t("hpS" + n)}</b><small>${t("hpS" + n + "s")}</small></li>`).join("");
  const how = `
  <section class="sv1-sec sv1-gray" id="how"><div class="wrap">
    <div class="sv1-title"><h2>${t("hpHow")}</h2></div>
    <ol class="sv1-hsteps">${steps}</ol>
    <ul class="sv1-htrust">
      <li><b>${t("hpT1")}</b></li>
      <li><b>${t("hpT2")}</b></li>
      <li><b>${t("hpT3")}</b></li>
    </ul>
  </div></section>`;

  const pop = popular.length ? `
  <section class="sv1-sec" id="popular"><div class="wrap">
    <div class="sv1-title"><h2>${t("hpPopular")}</h2></div>
    <div class="sv1-pops">${popular.map((p, i) => `<div class="sv1-pop">
      <b>${esc(p.name)}</b>
      <div class="acts">${p.buy ? `<button type="button" class="sv1-btn primary sm" data-pop="${i}" data-track="أضف للسلة">${t("hpAdd")}</button>` : ""}<a class="sv1-btn sm" href="${esc(href("/services/" + p.slug))}">${t("hpDetails")}</a></div>
    </div>`).join("")}</div>
    <p class="sv1-pall"><a href="${esc(href("/catalog"))}" data-track="تصفّح الخدمات واشترِ مباشرة">${t("hpAll")} ${arrow}</a></p>
  </div></section>` : "";

  const faq = `
  <section class="sv1-sec sv1-gray" id="faq"><div class="wrap">
    <div class="sv1-title"><h2>${t("hpFaq")}</h2></div>
    <div class="sv1-faq">${[1, 2, 3, 4].map((n) => `<details><summary>${t("hpFq" + n)}</summary><p>${t("hpFa" + n)}</p></details>`).join("")}</div>
  </div></section>`;

  const css = `<style id="sv1-path-css">
.sv1-path{padding:46px 0 38px}
.sv1-path .wrap{text-align:center}
.sv1-path h1{font-size:clamp(26px,3.2vw,40px);line-height:1.3;margin:0 auto 12px;max-width:30ch;font-weight:300}
.sv1-path .sv1-lead{margin:0 auto;max-width:56ch;font-size:16px;line-height:1.8}
.sv1-pask{margin:26px auto 0;max-width:660px}
.sv1-pask h2{font-size:20px;font-weight:500;margin:0 0 12px}
.sv1-psearch{position:relative;text-align:start}
.sv1-psearch label{display:block;font-size:14px;font-weight:600;color:var(--ink);margin-bottom:6px}
.sv1-psearch .row{display:flex;gap:8px}
.sv1-psearch input{flex:1;min-width:0;border:1.5px solid var(--acLine);border-radius:12px;padding:14px 16px;font:inherit;font-size:16px;background:#fff;outline:none;box-shadow:var(--sh)}
.sv1-psearch input:focus{border-color:var(--ac)}
.sv1-psearch .sv1-btn{padding:0 24px;border-radius:12px;font-size:15px}
.sv1-psug{position:absolute;inset-inline:0;top:calc(100% + 4px);z-index:15;background:#fff;border:1px solid var(--l);border-radius:12px;box-shadow:var(--sh2);padding:6px;display:grid;text-align:start}
.sv1-psug[hidden]{display:none}
.sv1-psug a{padding:10px 12px;border-radius:8px;font-size:14px;color:var(--ink)}
.sv1-psug a:hover,.sv1-psug a:focus{background:var(--acSoft)}
.sv1-psug a.all{color:var(--ac);font-weight:600;border-top:1px solid var(--line2);border-radius:0 0 8px 8px;margin-top:4px}
.sv1-psug .none{padding:10px 12px;font-size:13px;color:var(--mut)}
.sv1-pcards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:22px;text-align:start}
.sv1-pcard{display:flex;flex-direction:column;gap:10px;background:#fff;border:1px solid var(--l);border-radius:14px;padding:18px;box-shadow:var(--sh);transition:.15s;position:relative}
.sv1-pcard:hover,.sv1-pcard:focus-visible{border-color:var(--ac);box-shadow:var(--sh2);transform:translateY(-2px)}
.sv1-pcard .ico{width:40px;height:40px;border-radius:10px;background:var(--acSoft);display:grid;place-items:center;font-size:19px}
.sv1-pcard .tx b{display:block;font-size:17px;color:var(--ink);font-weight:600;line-height:1.4}
.sv1-pcard .tx small{display:block;font-size:12.5px;color:var(--s);line-height:1.6;margin-top:4px}
.sv1-pcard .go{margin-top:auto;color:var(--ac);font-weight:600;font-size:15px}
.sv1-pcards.three{grid-template-columns:repeat(3,1fr)}
.sv1-porders{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:12px;background:var(--acSoft);border:1px solid var(--acLine);border-radius:14px;padding:14px 18px;text-align:start}
.sv1-porders b{display:block;color:var(--ink);font-size:16px}
.sv1-porders small{color:var(--s);font-size:12.5px}
.sv1-porders.sv1-hide{display:none!important}
.sv1-pmore{margin:16px 0 0;font-size:13px;color:var(--mut)}
.sv1-pmore a{color:var(--ac);font-weight:600;border-bottom:1px solid var(--acLine)}
.sv1-hsteps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.sv1-hsteps li{background:#fff;border:1px solid var(--l);border-radius:12px;padding:18px;text-align:center}
.sv1-hsteps i{font-style:normal;font-family:var(--fm);width:34px;height:34px;background:var(--acSoft);color:var(--ac);border-radius:9px;display:grid;place-items:center;margin:0 auto 10px;font-weight:500;font-size:13px}
.sv1-hsteps b{display:block;font-size:15px;color:var(--ink);font-weight:600}
.sv1-hsteps small{display:block;font-size:12.5px;color:var(--s);margin-top:4px;line-height:1.65}
.sv1-htrust{list-style:none;margin:18px 0 0;padding:0;display:flex;gap:8px 26px;flex-wrap:wrap;justify-content:center;font-size:13.5px;color:var(--t)}
.sv1-htrust li::before{content:"✓";color:var(--ok);font-weight:700;margin-inline-end:7px}
.sv1-htrust b{font-weight:500}
.sv1-pops{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.sv1-pop{display:flex;flex-direction:column;justify-content:space-between;gap:14px;background:#fff;border:1px solid var(--l);border-radius:12px;padding:16px}
.sv1-pop>b{font-size:15px;color:var(--ink);font-weight:600;line-height:1.55}
.sv1-pop .acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sv1-pall{text-align:center;margin:18px 0 0;font-size:14px}
.sv1-pall a{color:var(--ac);font-weight:600}
.sv1-faq{max-width:760px;margin:0 auto;display:grid;gap:8px}
.sv1-faq details{background:#fff;border:1px solid var(--l);border-radius:12px;padding:0 16px}
.sv1-faq summary{cursor:pointer;padding:14px 0;font-weight:600;color:var(--ink);font-size:14.5px}
.sv1-faq p{margin:0 0 14px;color:var(--s);font-size:13.5px;line-height:1.85}
.sv1-chatctx{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.sv1-chatctx button{border:1px solid var(--l);background:#fff;border-radius:999px;padding:6px 12px;font:inherit;font-size:12px;color:var(--mut);cursor:pointer}
.sv1-chatctx button.on{background:var(--ac);border-color:var(--ac);color:#fff}
@media(max-width:900px){.sv1-pcards,.sv1-pcards.three{grid-template-columns:1fr 1fr}.sv1-hsteps{grid-template-columns:1fr 1fr}.sv1-pops{grid-template-columns:1fr 1fr}}
@media(max-width:600px){
 .sv1-path{padding:22px 0 24px}
 .sv1-path h1{font-size:25px;line-height:1.35}
 .sv1-path .sv1-lead{font-size:13.5px;line-height:1.65}
 .sv1-pask{margin-top:14px}
 .sv1-pask h2{font-size:16px;margin-bottom:8px}
 .sv1-psearch label{display:none}
 .sv1-psearch input{padding:12px 13px;font-size:15px}
 .sv1-psearch .sv1-btn{padding:0 16px;font-size:14px}
 .sv1-pcards{gap:8px;margin-top:12px}
 .sv1-pcard{padding:11px;gap:6px}
 .sv1-pcard .ico{width:30px;height:30px;font-size:15px;border-radius:8px}
 .sv1-pcard .tx b{font-size:14px}
 .sv1-pcard .tx small{font-size:11px;line-height:1.5;margin-top:2px}
 .sv1-pcard .go{display:none}
 .sv1-pmore{font-size:12px;margin-top:10px}
 .sv1-hsteps,.sv1-pops{grid-template-columns:1fr}
}
</style>`;

  const script = `<script>
(function(){
var TXP=${JSON.stringify({ none: t("hpNone"), all: t("hpSugAll"), added: t("hpAdded"), cart: t("hpViewCart") })};
var SVC=${JSON.stringify(search)},POP=${JSON.stringify(popular)};
var CATALOG=${JSON.stringify(href("/catalog"))},HOMEP=${JSON.stringify(href("/"))},CART=${JSON.stringify(href("/cart"))},SERV=${JSON.stringify(href("/services/"))};
var $=function(id){return document.getElementById(id)};
// تطبيع خفيف يطابق بحث /catalog: حروف صغيرة، وهمزات وتاء مربوطة وألف مقصورة وتشكيل.
function norm(s){return String(s||'').toLowerCase().replace(/[\\u064B-\\u0652\\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')}
var q=$('hpQ'),sug=$('hpSug');
if(q&&sug){
 var IDX=SVC.map(function(r){return {n:r[0],s:r[1],h:norm(r[0]+' '+r[2])}});
 function draw(){
  var v=norm(q.value).trim();sug.innerHTML='';
  if(v.length<2){sug.hidden=true;return}
  var tk=v.split(/\\s+/),hits=IDX.filter(function(r){return tk.every(function(x){return r.h.indexOf(x)>=0})});
  hits.slice(0,6).forEach(function(r){var a=document.createElement('a');a.href=SERV+r.s;a.textContent=r.n;sug.appendChild(a)});
  if(!hits.length){var d=document.createElement('div');d.className='none';d.textContent=TXP.none;sug.appendChild(d)}
  var all=document.createElement('a');all.className='all';all.href=CATALOG+'?q='+encodeURIComponent(q.value.trim());all.textContent=TXP.all+(hits.length>6?' ('+hits.length+')':'');sug.appendChild(all);
  sug.hidden=false}
 q.addEventListener('input',draw);
 q.addEventListener('keydown',function(e){if(e.key==='Escape')sug.hidden=true});
 document.addEventListener('click',function(e){if(!$('hpSearch').contains(e.target))sug.hidden=true});
}
// السلة: عقد صفحات الخدمات القديمة وsimple-v1-catalog.mjs نفسه (bp_cart، qty يزيد).
function cartAdd(b){var c;try{c=JSON.parse(localStorage.getItem('bp_cart'))||[];if(!Array.isArray(c))c=[]}catch(e){c=[]}
 var ex=c.filter(function(x){return x.id===b.id})[0];
 if(ex)ex.qty=(ex.qty||1)+1;else c.push({id:b.id,nameEn:b.nameEn||'',nameAr:b.nameAr||'',amount:b.amount?Number(b.amount):null,price:'',kind:'service',qty:1,surchargeAmount:null,surchargeFreeCount:null,pricePublic:0,billingPeriod:'',renewsAt:null,commissionPercent:0});
 try{localStorage.setItem('bp_cart',JSON.stringify(c))}catch(e){return false}
 try{document.dispatchEvent(new CustomEvent('bp:cart',{bubbles:true}))}catch(e){}return true}
Array.prototype.forEach.call(document.querySelectorAll('[data-pop]'),function(btn){btn.onclick=function(){
 var p=POP[Number(btn.getAttribute('data-pop'))];if(!p||!p.buy||!cartAdd(p.buy))return;
 var a=document.createElement('a');a.className='sv1-btn sm';a.href=CART;a.textContent=TXP.cart;btn.parentNode.replaceChild(a,btn)}});
// المسجَّل: شريط «طلباتك» بدل بطاقة «لديّ حساب». التلميح المحلي يرسم فوراً، والخادم يصحّح.
function orders(on){var c=$('path-account'),o=$('hpOrders');if(!c||!o)return;
 c.style.display=on?'none':'';o.classList.toggle('sv1-hide',!on);
 var g=$('hpCards');if(g)g.classList.toggle('three',!!on)}
var S=window.SV1S;
if(S){var h=S.hint&&S.hint();if(h)orders(true);
 var pt=S.paint;S.paint=function(on,hh){pt.call(S,on,hh);orders(!!on)}}
// ملاحظة: ?door= و?q= يقرؤهما /catalog (simple-v1-catalog.mjs).
})();</script>`;

  return { hero, how, pop, faq, css, script };
}
