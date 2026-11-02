// Business Partner — Simple V1: الشركاء والموردون (تنفيذ الخدمات).
//
// يملكها وكيل `suppliers-partners`. صفحتان على SV1.shell() بلا main.js ولا قشرة قديمة:
//   buildSimplePartners()          → /suppliers          صفحة التعريف والدعوة (عامة، تُفهرَس).
//   buildSimplePartnerDashboard()  → /partner-dashboard  الدخول والتسجيل والتفعيل ولوحة الشريك (بوابة بيانات خاصة، لا فهرسة).
//
// المسار الواحد: تسجيل ← رمز البريد ← لوحة الشريك (حالة الاعتماد/التأهيل ظاهرة فيها) ← أوامر العمل والمحفظة.
// لا مصادقة جديدة: api/_suppliers.js القائم نفسه (POST /api/suppliers). والجلسة بريد وكلمة مرور في sessionStorage
// (تُمحى بإغلاق التبويب) — لا localStorage ولا كلمة مرور في الرابط. النداءان الوحيدان للقراءة، `portal` و`wallet`،
// يُرسَلان POST لهذا الغرض.
//
// الأسعار والعمولات تُقرأ من كتالوج الموقع (/assets/data/catalog.json) بالرمز، لا يُكتب رقم هنا.
// كل نصّ قادم من الخادم يدخل الصفحة بـtextContent لا innerHTML.
// السكربت العميل دالةٌ عاديّة (partnerClient) تُسلسَل بـtoString، فلا يُضاعَف فيها الـbackslash كما في قوالب النصوص.
//
// النصوص: `ctx.Lraw(en, ar)` — العربية والإنجليزية من الأصل، وبقية اللغات من قاموس الموقع بمفتاح النص الإنجليزي
// (ما ليس في القاموس يظهر بالإنجليزية).

const CSS = `<style id="sv1-prt-css">
.sv1-prt-hero{padding:48px 0 26px;text-align:center}
.sv1-prt-hero h1{font-size:clamp(26px,4vw,40px);margin:14px 0 10px}
.sv1-prt-hero .lead{max-width:700px;margin:0 auto;color:var(--mut);line-height:1.95}
.sv1-prt-acts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:22px 0 0}
.sv1-prt-trust{list-style:none;margin:20px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px 26px;justify-content:center}
.sv1-prt-trust li{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--mut)}
.sv1-prt-trust li::before,.sv1-prt-list li::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--ok);flex:none}
.sv1-prt-h{max-width:760px;margin:0 auto 22px;text-align:center}
.sv1-prt-h h2{font-size:clamp(20px,2.6vw,26px);margin:0 0 6px}
.sv1-prt-h p{margin:0;color:var(--mut);font-size:14px;line-height:1.85}
.sv1-prt-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;padding:0;margin:0;list-style:none}
.sv1-prt-step{display:flex;flex-direction:column;gap:8px;background:#fff;border:1px solid var(--l);border-radius:14px;box-shadow:var(--sh);padding:20px}
.sv1-prt-n{width:34px;height:34px;border-radius:50%;background:var(--ac);color:#fff;display:grid;place-items:center;font-size:15px;font-weight:500;flex:none}
.sv1-prt-step h3{margin:2px 0 0;font-size:15.5px;font-weight:500}
.sv1-prt-step p{margin:0;font-size:13px;color:var(--mut);line-height:1.85}
.sv1-prt-panels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.sv1-prt-panel{background:#fff;border:1px solid var(--l);border-radius:14px;box-shadow:var(--sh);padding:22px 24px}
.sv1-prt-panel h3{margin:0 0 6px;font-size:16.5px;font-weight:500}
.sv1-prt-list{list-style:none;margin:0;padding:0}
.sv1-prt-list li{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid var(--l);font-size:13.5px;line-height:1.8;color:var(--t)}
.sv1-prt-list li:first-child{border-top:0}
.sv1-prt-list li::before{margin-top:9px}
.sv1-prt-cats{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
.sv1-prt-cats li{display:flex;align-items:center;justify-content:center;text-align:center;min-height:44px;padding:6px 12px;background:#fff;border:1px solid var(--acLine);border-radius:999px;font-size:13px;line-height:1.4;color:var(--ink)}
.sv1-prt-cta{background:var(--n);border-radius:16px;padding:36px 26px;text-align:center;margin-top:34px}
.sv1-prt-cta h2{margin:0 0 18px;color:#fff;font-size:clamp(19px,2.4vw,24px)}
.sv1-prt-cta .sv1-prt-acts{margin:0}
.sv1-prt-cta .sv1-btn:not(.primary){background:transparent;border-color:rgba(255,255,255,.5);color:#fff}
.sv1-prt-cta .sv1-btn:not(.primary):hover{border-color:#fff}
.sv1-prt-cta .sv1-btn.primary{background:#fff;border-color:#fff;color:var(--n);box-shadow:none}
.sv1-prt-help{margin:18px 0 0;text-align:center;font-size:13px;color:var(--mut)}
.sv1-prt-help a{color:var(--ac);text-decoration:underline}
/* سطر وصف الشركة في التذييل: قاعدة p العامة تعطيه رمادياً خافتاً على الكحلي (تباين ~2.4:1)؛ يُصلح في صفحتَي الشركاء وحدهما */
.sv1-foot-col>p:not(.sv1-foot-note){color:#ccd4ed}
/* بوابة الشريك */
.sv1-prt-box{max-width:1000px;margin:0 auto;border:1px solid var(--l);border-radius:15px;padding:24px;box-shadow:var(--sh2);background:#fff}
.sv1-prt-auth{max-width:520px}
.sv1-prt-tabs{display:flex;gap:6px;border-bottom:1px solid var(--l);margin:0 0 18px;flex-wrap:wrap}
.sv1-prt-tabs button{border:0;background:none;font:inherit;font-size:14px;padding:10px 14px;cursor:pointer;color:var(--mut);border-bottom:2px solid transparent;margin-bottom:-1px}
.sv1-prt-tabs button[aria-selected=true]{color:var(--ink);border-bottom-color:var(--ac)}
.sv1-prt-form label{display:block;font-size:11.5px;color:var(--mut);margin:0 0 5px}
.sv1-prt-in{width:100%;border:1px solid var(--l);border-radius:10px;padding:11px 13px;font:inherit;font-size:13.5px;outline:none;background:transparent;color:var(--t)}
.sv1-prt-in:focus{border-color:var(--ac)}
.sv1-prt-in[aria-invalid=true]{border-color:var(--warn)}
textarea.sv1-prt-in{min-height:76px;resize:vertical;line-height:1.7}
.sv1-prt-f{margin-bottom:13px}
.sv1-prt-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sv1-prt-cols>*,.sv1-prt-cols3>*{min-width:0}
.sv1-prt-msg{font-size:12.5px;line-height:1.8;margin-top:10px;min-height:1em}
.sv1-prt-msg.ok{color:var(--ok)}
.sv1-prt-note{font-size:11.5px;color:var(--faint);line-height:1.85;margin:12px 0 0}
.sv1-prt-link{background:none;border:0;padding:0;font:inherit;color:var(--ac);text-decoration:underline;cursor:pointer;font-size:12.5px}
.sv1-prt-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.sv1-prt-bar h2{margin:0;font-size:19px;font-weight:500}
.sv1-prt-bar p{margin:2px 0 0;color:var(--mut);font-size:12.5px}
.sv1-prt-qual{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;list-style:none;padding:0;margin:0 0 6px}
.sv1-prt-qual li{border:1px solid var(--l);border-radius:11px;padding:11px 13px;font-size:12.5px;color:var(--mut);display:flex;gap:9px;align-items:flex-start;line-height:1.6;background:var(--soft)}
.sv1-prt-qual li b{display:block;font-weight:500;color:var(--ink);font-size:13px}
.sv1-prt-qual li i{font-style:normal;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;flex:none;background:#fff;border:1px solid var(--l);color:var(--faint)}
.sv1-prt-qual li.done{background:var(--okSoft);border-color:transparent}
.sv1-prt-qual li.done i{background:var(--ok);border-color:var(--ok);color:#fff}
.sv1-prt-qual li.wait i{border-color:var(--warn);color:var(--warn)}
.sv1-prt-qualnote{margin:0 0 16px;font-size:12.5px;color:var(--mut);line-height:1.85}
.sv1-prt-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 14px}
.sv1-prt-stat{border:1px solid var(--l);border-radius:12px;padding:13px 15px;background:var(--soft)}
.sv1-prt-stat b{display:block;font-size:22px;font-weight:500;color:var(--ink);line-height:1.3}
.sv1-prt-stat span{font-size:11.5px;color:var(--mut)}
.sv1-prt-ref{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px;color:var(--mut);margin:0 0 16px}
.sv1-prt-ref code{direction:ltr;unicode-bidi:isolate;background:var(--soft);border:1px solid var(--l);padding:3px 9px;border-radius:7px;font-size:12px;overflow-wrap:anywhere}
.sv1-prt-pane h3{font-size:16.5px;font-weight:500;margin:0 0 6px}
.sv1-prt-pane>p{margin:0 0 14px;color:var(--mut);font-size:13px;line-height:1.85}
.sv1-prt-list2{display:grid;gap:11px;padding:0;margin:0;list-style:none}
.sv1-prt-card{border:1px solid var(--l);border-radius:12px;padding:15px 16px;background:var(--soft)}
.sv1-prt-card-h{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
.sv1-prt-card-h b{font-weight:500;color:var(--ink);font-size:14.5px}
.sv1-prt-sub{font-size:12px;color:var(--mut);line-height:1.8;overflow-wrap:anywhere}
.sv1-prt-chip{display:inline-block;border-radius:999px;background:var(--acSoft);color:var(--ac);padding:3px 10px;font-size:11.5px}
.sv1-prt-chip.ok{background:var(--okSoft);color:var(--ok)}
.sv1-prt-trail{margin:10px 0 0;padding:9px 12px;border-radius:10px;background:#fff;border:1px solid var(--l)}
.sv1-prt-trail div{display:flex;gap:8px;font-size:12px;line-height:1.8;color:var(--mut)}
.sv1-prt-trail div.mine{color:var(--ok);font-weight:500}
.sv1-prt-trail div span:nth-child(2){flex:1}
.sv1-prt-frm{border:1px solid var(--acLine);border-radius:11px;padding:14px;margin:12px 0 0;background:#fff}
.sv1-prt-acts2{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
.sv1-prt-line{display:grid;grid-template-columns:2fr 64px 1fr auto;gap:6px;margin-bottom:6px;align-items:center}
.sv1-prt-row3{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center}
.sv1-prt-tbl{overflow-x:auto;border:1px solid var(--l);border-radius:12px}
.sv1-prt-tbl table{border-collapse:collapse;width:100%;font-size:12.5px;min-width:520px}
.sv1-prt-tbl th,.sv1-prt-tbl td{padding:9px 12px;text-align:start;border-top:1px solid var(--l);vertical-align:top}
.sv1-prt-tbl th{background:var(--soft);font-weight:500;color:var(--mut);border-top:0}
.sv1-prt-tbl td.n{direction:ltr;unicode-bidi:isolate;white-space:nowrap}
.sv1-prt-tx{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--l);font-size:13px}
.sv1-prt-tx:first-child{border-top:0}
.sv1-prt-tx .pos{color:var(--ok)}.sv1-prt-tx .neg{color:#b42318}
.sv1-prt-sec{margin:0 0 16px;border:1px solid var(--l);border-radius:12px;padding:16px;background:#fff}
.sv1-prt-sec h4{margin:0 0 6px;font-size:14.5px;font-weight:500}
@media(max-width:860px){.sv1-prt-steps{grid-template-columns:repeat(2,minmax(0,1fr))}.sv1-prt-panels{grid-template-columns:1fr}}
@media(max-width:640px){
 .sv1-prt-cols,.sv1-prt-qual{grid-template-columns:1fr}
 .sv1-prt-stat{padding:11px 12px}.sv1-prt-stat b{font-size:19px}.sv1-prt-stat span{font-size:11px;line-height:1.5;display:block}
 .sv1-prt-steps{grid-template-columns:1fr}
 .sv1-prt-box{padding:18px}
 .sv1-prt-line{grid-template-columns:1fr 64px 1fr auto}.sv1-prt-line .nm{grid-column:1/-1}
 .sv1-prt-row3{grid-template-columns:1fr 1fr}.sv1-prt-row3 .nm{grid-column:1/-1}
 .sv1-prt-acts .sv1-btn{width:100%}
 .sv1-prt-end{padding-bottom:calc(104px + env(safe-area-inset-bottom,0px))!important}
 .sv1-prt-tabs{overflow-x:auto;flex-wrap:nowrap}.sv1-prt-tabs button{white-space:nowrap}
}
</style>`;

/* ───────────────────────── /suppliers — صفحة التعريف ───────────────────────── */
export function buildSimplePartners(sv1, ctx) {
  const { esc, Lraw, u, cats } = ctx;
  const t = (en, ar) => esc(Lraw(en, ar));
  const join = u("/partner-dashboard") + "#signup";
  const login = u("/partner-dashboard") + "#login";
  const li = (en, ar) => `<li>${t(en, ar)}</li>`;
  const step = (n, h, p) => `<li class="sv1-prt-step"><span class="sv1-prt-n" aria-hidden="true">${n}</span><h3>${h}</h3><p>${p}</p></li>`;
  const body = CSS + sv1.header("/suppliers", { cta: false }) + `
<main>
  <section class="sv1-prt-hero"><div class="wrap">
    <span class="sv1-tag">${t("Partners", "الشركاء")}</span>
    <h1>${t("Join the Business Partner network", "انضم إلى شبكة شركاء Business Partner")}</h1>
    <p class="lead">${t("We route our clients' service requests to registered partners and collect competing offers. Register once, and the requests that match your activity reach you.", "نُسند طلبات عملائنا من الخدمات والفعاليات إلى الشركاء المسجَّلين ونجمع العروض المتنافسة. سجّل مرة واحدة، فتصلك الطلبات المناسبة لنشاطك.")}</p>
    <div class="sv1-prt-acts">
      <a class="sv1-btn primary" href="${join}">${t("Create your partner account", "أنشئ حسابك كشريك")}</a>
      <a class="sv1-btn" href="${login}">${t("Already a partner? Sign in", "شريك بالفعل؟ سجّل الدخول")}</a>
    </div>
    <ul class="sv1-prt-trust">
      ${li("Requests from our corporate clients", "طلبات من عملائنا من الشركات")}
      ${li("No registration fees", "بدون رسوم تسجيل")}
      ${li("Coordination by e-mail and phone", "تنسيق مباشر عبر البريد والهاتف")}
    </ul>
  </div></section>

  <section class="sv1-sec" style="padding-top:26px"><div class="wrap">
    <div class="sv1-prt-h"><h2>${t("From registration to your first work order", "من التسجيل إلى أول أمر عمل")}</h2>
      <p>${t("Registration takes a couple of minutes and costs nothing.", "التسجيل يستغرق دقيقتين ولا يكلّفك شيئاً.")}</p></div>
    <ol class="sv1-prt-steps">
      ${step(1, t("Create your account", "أنشئ حسابك"), t("Company name, contact person, mobile, e-mail, a password and your service category.", "اسم الشركة والشخص المسؤول والجوال والبريد وكلمة المرور وتصنيف خدمتك."))}
      ${step(2, t("Verify your e-mail", "أكّد بريدك"), t("A six-digit code reaches your inbox and is valid for fifteen minutes.", "يصلك رمز من ستة أرقام على بريدك، وهو صالح لخمس عشرة دقيقة."))}
      ${step(3, t("Our team approves your account", "يعتمد فريقنا حسابك"), t("Your dashboard opens straight away. Approval is what lets us assign work to you.", "تُفتح لوحتك فوراً. والاعتماد هو ما يتيح لنا إسناد العمل إليك."))}
      ${step(4, t("You receive work orders", "تستلم أوامر العمل"), t("Update each order's status, upload your invoice and follow what is held for you.", "تحدّث حالة كل أمر، وترفع فاتورتك، وتتابع ما هو محجوز لك."))}
    </ol>
  </div></section>

  <section class="sv1-sec" style="padding-top:8px"><div class="wrap">
    <div class="sv1-prt-panels">
      <div class="sv1-prt-panel">
        <h3>${t("Why join?", "لماذا تنضم؟")}</h3>
        <ul class="sv1-prt-list">
          ${li("Requests from our corporate clients", "طلبات من عملائنا من الشركات")}
          ${li("You compete on clear, scoped requests", "تتنافس على طلبات واضحة ومحدّدة")}
          ${li("No registration fees", "بدون رسوم تسجيل")}
          ${li("Coordination by e-mail and phone", "تنسيق مباشر عبر البريد والهاتف")}
          ${li("Your own referral link to share with your clients", "رابط إحالة خاص بك تشاركه مع عملائك")}
        </ul>
      </div>
      <div class="sv1-prt-panel">
        <h3>${t("What your dashboard gives you", "ماذا تجد في لوحتك")}</h3>
        <ul class="sv1-prt-list">
          ${li("Work orders assigned to you, with their status", "أوامر العمل المسندة إليك وحالاتها")}
          ${li("Your own services and prices", "خدماتك وأسعارك")}
          ${li("Every catalogue service and your share of it", "كل خدمات الكتالوج ونصيبك من كل واحدة")}
          ${li("Propose a service we do not offer yet", "اقتراح خدمة غير موجودة لدينا")}
          ${li("Your wallet: what is held for you and what is released", "محفظتك: المحجوز لك والمُفرَج عنه")}
        </ul>
      </div>
    </div>
  </div></section>

  <section class="sv1-sec sv1-prt-end" style="padding-top:8px"><div class="wrap">
    <div class="sv1-prt-h"><h2>${t("Categories we register", "التصنيفات التي نسجّلها")}</h2>
      <p>${t("Pick yours while creating the account.", "تختار تصنيفك أثناء إنشاء الحساب.")}</p></div>
    <ul class="sv1-prt-cats">${cats.map((c) => `<li>${t(c.en, c.ar)}</li>`).join("")}</ul>
    <div class="sv1-prt-cta">
      <h2>${t("Register once — the requests come to you", "سجّل مرة واحدة — وتصلك الطلبات")}</h2>
      <div class="sv1-prt-acts">
        <a class="sv1-btn primary" href="${join}">${t("Create your partner account", "أنشئ حسابك كشريك")}</a>
        <a class="sv1-btn" href="${login}">${t("Already a partner? Sign in", "شريك بالفعل؟ سجّل الدخول")}</a>
      </div>
    </div>
    <p class="sv1-prt-help">${t("Questions before you register?", "لديك سؤال قبل التسجيل؟")} <a href="${u("/contact")}">${t("Contact us", "تواصل معنا")}</a></p>
  </div></section>
</main>
${sv1.footer()}`;
  return sv1.shell({
    title: Lraw("Partner network — Business Partner", "شبكة الشركاء — Business Partner"),
    desc: Lraw("Register as a Business Partner partner and receive the client requests that match your activity.", "سجّل شريكاً لدى Business Partner وتصلك طلبات العملاء المناسبة لنشاطك."),
    path: "/suppliers", body,
  });
}

/* ───────────────────────── /partner-dashboard — الدخول واللوحة ───────────────────────── */
export function buildSimplePartnerDashboard(sv1, ctx) {
  const { esc, Lraw, lang, cats } = ctx;
  const t = (en, ar) => esc(Lraw(en, ar));
  const r = Lraw;
  const AR = lang() === "ar";

  // نصوص العميل (JSON). كل مفتاح له ترجمته من القاموس بمفتاحه الإنجليزي.
  const TX = {
    wait: r("One moment…", "لحظة…"),
    eCreds: r("Email or password is incorrect.", "البريد أو كلمة المرور غير صحيحة."),
    eFields: r("Fill in every required field with a valid e-mail.", "أكمل الحقول المطلوبة ببريد إلكتروني صحيح."),
    ePass: r("Password must be at least 8 characters.", "كلمة المرور يجب أن تكون ٨ أحرف فأكثر."),
    eCode: r("The code is wrong or has expired.", "الرمز غير صحيح أو انتهت صلاحيته."),
    eCfg: r("Sign-up is not available right now — contact us.", "التسجيل غير متاح حالياً — تواصل معنا."),
    eNet: r("Connection issue — please try again.", "مشكلة في الاتصال — حاول مرة أخرى."),
    eSession: r("Your session ended. Sign in again.", "انتهت الجلسة. سجّل الدخول من جديد."),
    eUnverified: r("Verify your email first — enter the code we sent you.", "فعّل بريدك أولاً — أدخل الرمز الذي أرسلناه لك."),
    codeSent: r("We sent a 6-digit code to ", "أرسلنا رمزاً من ٦ أرقام إلى "),
    resetSent: r("We sent a 6-digit code — enter it to set your new password and sign in.", "أرسلنا رمزاً من ٦ أرقام — أدخله لتعيين كلمة المرور الجديدة والدخول."),
    resent: r("Code sent", "أُرسل الرمز"),
    forgotNeed: r("Type your e-mail and a new password above, then press the link again.", "اكتب بريدك وكلمة المرور الجديدة أعلاه ثم اضغط الرابط مرة أخرى."),
    hello: r("Welcome", "مرحباً"),
    commission: r("Our commission {c}% · your share {n}% of the catalogue price", "عمولتنا {c}٪ · نصيبك {n}٪ من سعر الكتالوج"),
    commissionPer: r("Commission is set per order", "العمولة تُحدَّد لكل أمر"),
    sar: r("SAR", "ريال"),
    qRegistered: r("Account created", "أُنشئ الحساب"),
    qVerified: r("E-mail verified", "تم توثيق البريد"),
    qApproval: r("Team approval", "اعتماد الفريق"),
    qApproved: r("Approved — work orders can be assigned to you.", "معتمد — يمكن إسناد أوامر العمل إليك."),
    qPending: r("Under review", "قيد المراجعة"),
    qPendingNote: r("Our team is reviewing your account. You can explore the catalogue and your share now; work orders are assigned only after approval, and we e-mail you when it happens.", "يراجع فريقنا حسابك. يمكنك الآن الاطلاع على الكتالوج ونصيبك منه، ولا تُسنَد إليك أوامر العمل إلا بعد الاعتماد، وسنراسلك بالبريد عند ذلك."),
    qBlocked: r("Not active", "غير فعّال"),
    qBlockedNote: r("This account is not active. Contact us to review it.", "هذا الحساب غير فعّال. تواصل معنا لمراجعته."),
    stOpen: r("Active work orders", "أوامر عمل جارية"),
    stDone: r("Delivered", "تم تسليمها"),
    stDue: r("Awaiting your invoice", "بانتظار فاتورتك"),
    oNone: r("No work orders yet — new assignments appear here and reach you by e-mail.", "لا توجد أوامر عمل بعد — كل إسناد جديد يظهر هنا ويصلك على بريدك."),
    oValue: r("Order value", "قيمة الأمر"),
    oComm: r("Commission invoiced to you", "عمولة مفوترة عليك"),
    oInvoice: r("Invoice", "الفاتورة"),
    oQuoteBtn: r("Submit your quote", "قدّم عرض سعرك"),
    oUpdBtn: r("Update / upload invoice", "تحديث / رفع فاتورة"),
    oClient: r("Client activity", "حركة العميل"),
    oLabelQuote: r("Your quote", "عرض سعرك"),
    oLabelQuoteHint: r("Line items, not one number — the invoice that follows is these same lines.", "بنود لا رقماً واحداً — والفاتورة التي تلي هي البنود نفسها."),
    oPick: r("Add from my services…", "أضف من خدماتي…"),
    oBlank: r("Blank line", "بند فارغ"),
    oItem: r("Item", "البند"),
    oPrice: r("Price", "السعر"),
    oTotal: r("Quote total: ", "إجمالي العرض: "),
    oLead: r("Proposed lead time", "مدة التنفيذ المقترحة"),
    oLeadPh: r("e.g. 5 working days", "مثال: ٥ أيام عمل"),
    oNeedLine: r("Add at least one line with a price above zero.", "أضف بنداً واحداً على الأقل بسعر أكبر من صفر."),
    oStatus: r("Status", "الحالة"),
    oAccept: r("I accept this work order", "أقبل أمر العمل"),
    oProg: r("In progress", "قيد التنفيذ"),
    oDeliv: r("Delivered", "تم التسليم"),
    oInv: r("Your invoice (PDF or image) — optional", "فاتورتك (PDF أو صورة) — اختياري"),
    oInvHint: r("Invoice us for the approved quote once you deliver.", "فوترنا بقيمة العرض المعتمد بعد التسليم."),
    oInvQuote: r("Invoice us for the approved quote: {q} SAR — the same lines you quoted.", "فوترنا بقيمة العرض المعتمد: {q} ريال — البنود نفسها التي عرضتها."),
    oInvBig: r("Invoice must be under 4MB.", "حجم الفاتورة يجب أن يكون أقل من ٤ ميجابايت."),
    oProgress: r("Progress update the client sees", "تحديث يراه العميل"),
    oProgressPh: r("e.g. Name reservation submitted to the Ministry", "مثال: قُدِّم حجز الاسم لدى الوزارة"),
    oProgressHint: r("Dated and added to the client's tracking page. Earlier updates stay.", "يُؤرَّخ ويُضاف لصفحة متابعة العميل. التحديثات السابقة تبقى."),
    oNotes: r("Internal notes", "ملاحظات داخلية"),
    oQLink: r("Client link for this quote", "رابط العميل لهذا العرض"),
    oQLinkHint: r("Send it to the client. They open it without an account, review the quote and accept it — and both of us are told.", "أرسله للعميل. يفتحه بلا حساب، ويراجع العرض ويقبله — ونُشعَر كلانا."),
    copy: r("Copy", "انسخ"),
    copied: r("Copied", "نُسخ"),
    save: r("Save update", "احفظ التحديث"),
    cancel: r("Cancel", "إلغاء"),
    saving: r("Saving…", "جارٍ الحفظ…"),
    saved: r("Saved — the team has been notified.", "تم الحفظ — أُشعر الفريق."),
    eSave: r("Could not save — please try again.", "تعذّر الحفظ — حاول مرة أخرى."),
    mNone: r("No services yet — add your first one below.", "لا خدمات بعد — أضف أولى خدماتك بالأسفل."),
    mSvc: r("Service", "الخدمة"),
    mDelivery: r("Delivery", "المدة"),
    mSaved: r("Saved — these now appear when you build a quote.", "حُفظت — تظهر الآن عند بناء عرض السعر."),
    cNone: r("No matching service.", "لا توجد خدمة مطابقة."),
    cErr: r("Could not load the catalogue.", "تعذّر تحميل الكتالوج."),
    cRate: r("Your commission rate: ", "نسبة عمولة Business Partner عليك: "),
    cVat: r("prices exclude VAT", "الأسعار قبل ضريبة القيمة المضافة"),
    cCode: r("Code", "الكود"),
    cSvc: r("Service", "الخدمة"),
    cSite: r("Site price", "سعر الموقع"),
    cFee: r("Commission", "العمولة"),
    cShare: r("Your share", "نصيبك"),
    cReq: r("On request", "حسب الطلب"),
    cQuoted: r("Quoted", "بعرض سعر"),
    cAll: r("All categories", "كل التصنيفات"),
    pOk: r("Sent — the team reviews and prices it, and we come back to you. It is not published yet.", "أُرسل — يراجعه الفريق ويسعّره ونعود إليك. لم يُنشر بعد."),
    pNeed: r("Enter the service name and a price above zero.", "أدخل اسم الخدمة وسعراً أكبر من صفر."),
    pErr: r("Could not send it — try again.", "تعذّر الإرسال — حاول مرة أخرى."),
    wNone: r("No escrows held for you yet.", "لا ضمانات محجوزة لصالحك حالياً."),
    wHeld: r("Held — declare delivery when the work is done", "محجوز — أعلن التسليم عند إتمام العمل"),
    wDelivered: r("You declared delivery — awaiting the client's approval", "أعلنتَ التسليم — بانتظار اعتماد العميل للاستلام"),
    wRefund: r("The client asked for a refund — your consent or the platform's decision settles it", "طلب العميل الاسترجاع — يُحسم بموافقتك أو بقرار المنصة"),
    wDeliverBtn: r("I delivered the work", "سلّمت المشروع"),
    wDeliverAsk: r("Confirm delivery — add a note the client will see (what was delivered, links…)", "تأكيد التسليم — أضف ملاحظة يراها العميل (ماذا سلّمت، روابط…)"),
    wConfirm: r("Confirm", "تأكيد"),
    wAgreeBtn: r("I agree to refund the client", "أوافق على إرجاع المبلغ للعميل"),
    wAgreeAsk: r("Confirm: return the full amount to the client's wallet? This cannot be undone.", "تأكيد: إرجاع كامل المبلغ إلى محفظة العميل؟ لا يمكن التراجع."),
    wRefundHint: r("Delivered and you object? Do nothing — the platform arbitrates. Not delivered? Declare delivery now or the money returns to the client automatically.", "سلّمت وتعترض؟ لا تفعل شيئاً — تفصل المنصة. لم تسلّم؟ أعلن التسليم الآن وإلا عاد المبلغ للعميل تلقائياً."),
    wDone: r("Done", "تم التنفيذ"),
    wErr: r("Could not complete — refresh and try again.", "تعذّر التنفيذ — حدّث الصفحة وحاول مرة أخرى."),
    wNoTx: r("No movements yet.", "لا حركات بعد."),
    wOff: r("The wallet is not available yet.", "المحفظة غير متاحة بعد."),
    wAmt: r("Enter an amount above zero.", "أدخل مبلغاً أكبر من صفر."),
    wSent: r("Request received — we transfer to your bank and confirm by e-mail.", "استلمنا طلبك — ننفذ التحويل البنكي ونؤكد لك بالبريد."),
    wOver: r("Amount exceeds your available balance ({b} SAR).", "المبلغ أكبر من رصيدك المتاح ({b} ريال)."),
    wErrW: r("Could not send the request — try again.", "تعذّر إرسال الطلب — حاول مرة أخرى."),
  };
  // حالات أوامر العمل كما يعيدها الخادم (عربية) ← عرض بلغة الصفحة.
  const ST = {
    "طلب عرض سعر": r("Quote requested", "طلب عرض سعر"),
    "عرض مُقدَّم": r("Quote submitted", "عرض مُقدَّم"),
    "أُرسل للمورّد": r("Assigned to you", "أُرسل إليك"),
    "قبله المورّد": r("Accepted", "قبلتَه"),
    "قيد التنفيذ": r("In progress", "قيد التنفيذ"),
    "تم التسليم": r("Delivered", "تم التسليم"),
    "معتمد": r("Approved", "معتمد"),
    "لم تُرفع": r("Not uploaded", "لم تُرفع"),
  };
  const CFG = { lang: lang(), ar: AR, tx: TX, st: ST, cats: cats.map((c) => [c.ar, AR ? c.ar : c.en]) };

  const body = CSS + sv1.header("/partner-dashboard", { cta: false }) + `
<main>
  <section class="sv1-prt-hero"><div class="wrap">
    <span class="sv1-tag">${t("Partners portal", "بوابة الشركاء")}</span>
    <h1>${t("Partner dashboard", "لوحة الشريك")}</h1>
    <p class="lead">${t("Your work orders, your services and prices, your share of every catalogue service and your wallet — in one place.", "أوامر العمل المسندة إليك، وخدماتك وأسعارك، ونصيبك من كل خدمة في الكتالوج، ومحفظتك — في مكان واحد.")}</p>
  </div></section>

  <section class="sv1-sec sv1-prt-end" style="padding-top:8px"><div class="wrap">
    <div class="sv1-prt-box sv1-prt-auth" id="pAuth">
      <div class="sv1-prt-tabs" role="tablist" id="pAuthTabs">
        <button type="button" role="tab" id="pTabLogin" aria-selected="true">${t("Sign in", "تسجيل الدخول")}</button>
        <button type="button" role="tab" id="pTabSignup" aria-selected="false">${t("Create an account", "حساب جديد")}</button>
      </div>

      <form class="sv1-prt-form" id="pLogin" novalidate>
        <div class="sv1-prt-f"><label for="plEmail">${t("E-mail", "البريد الإلكتروني")}</label><input class="sv1-prt-in" id="plEmail" type="email" maxlength="160" autocomplete="email" dir="ltr"></div>
        <div class="sv1-prt-f"><label for="plPass">${t("Password", "كلمة المرور")}</label><input class="sv1-prt-in" id="plPass" type="password" maxlength="200" autocomplete="current-password" dir="ltr"></div>
        <button type="submit" class="sv1-btn primary" style="width:100%" id="plGo">${t("Sign in", "دخول")}</button>
        <p class="sv1-prt-note" style="text-align:center">${t("Forgot your password?", "نسيت كلمة المرور؟")} <button type="button" class="sv1-prt-link" id="plForgot">${t("Type your e-mail and a new password, then get a code", "اكتب بريدك وكلمة مرور جديدة ثم اطلب الرمز")}</button></p>
      </form>

      <form class="sv1-prt-form sv1-hide" id="pSignup" novalidate autocomplete="off">
        <div class="sv1-prt-cols sv1-prt-f">
          <div><label for="psCompany">${t("Company name", "اسم الشركة")} *</label><input class="sv1-prt-in" id="psCompany" maxlength="200" autocomplete="organization"></div>
          <div><label for="psPerson">${t("Contact person", "الشخص المسؤول")} *</label><input class="sv1-prt-in" id="psPerson" maxlength="160" autocomplete="name"></div>
        </div>
        <div class="sv1-prt-cols sv1-prt-f">
          <div><label for="psEmail">${t("E-mail", "البريد الإلكتروني")} *</label><input class="sv1-prt-in" id="psEmail" type="email" maxlength="160" autocomplete="email" dir="ltr"></div>
          <div><label for="psPhone">${t("Mobile", "رقم الجوال")} *</label><input class="sv1-prt-in" id="psPhone" type="tel" maxlength="40" autocomplete="tel" dir="ltr"></div>
        </div>
        <div class="sv1-prt-cols sv1-prt-f">
          <div><label for="psPass">${t("Password (8+ characters)", "كلمة المرور (٨ أحرف فأكثر)")} *</label><input class="sv1-prt-in" id="psPass" type="password" maxlength="200" autocomplete="new-password" dir="ltr"></div>
          <div><label for="psCity">${t("City", "المدينة")}</label><input class="sv1-prt-in" id="psCity" maxlength="80" autocomplete="address-level2"></div>
        </div>
        <div class="sv1-prt-f"><label for="psCat">${t("Service category", "تصنيف الخدمة")}</label><select class="sv1-prt-in" id="psCat"></select></div>
        <button type="submit" class="sv1-btn primary" style="width:100%" id="psGo">${t("Create account", "أنشئ الحساب")}</button>
        <p class="sv1-prt-note">${t("Registration is free. After you verify your e-mail your dashboard opens, and our team then approves the account.", "التسجيل مجاني. بعد توثيق بريدك تُفتح لوحتك، ثم يعتمد فريقنا الحساب.")}</p>
      </form>

      <form class="sv1-prt-form sv1-hide" id="pVerify" novalidate autocomplete="off">
        <p class="sv1-prt-note" id="pvNote" style="margin:0 0 12px;font-size:13px"></p>
        <div class="sv1-prt-f"><label for="pvCode">${t("Verification code", "رمز التحقق")}</label><input class="sv1-prt-in" id="pvCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" dir="ltr"></div>
        <button type="submit" class="sv1-btn primary" style="width:100%" id="pvGo">${t("Verify & open the dashboard", "تحقّق وافتح اللوحة")}</button>
        <button type="button" class="sv1-btn sm" style="width:100%;margin-top:8px" id="pvResend">${t("Resend the code", "أعد إرسال الرمز")}</button>
      </form>

      <div class="sv1-prt-msg" id="pAuthMsg" role="status" aria-live="polite"></div>
    </div>

    <div class="sv1-prt-box sv1-hide" id="pDash">
      <div class="sv1-prt-bar">
        <div><h2 id="pdName">—</h2><p id="pdMeta"></p></div>
        <button type="button" class="sv1-btn sm" id="pdOut">${t("Sign out", "خروج")}</button>
      </div>
      <ul class="sv1-prt-qual" id="pdQual"></ul>
      <p class="sv1-prt-qualnote" id="pdQualNote"></p>
      <div class="sv1-prt-stats">
        <div class="sv1-prt-stat"><b id="pdOpen">0</b><span>${t("Active work orders", "أوامر عمل جارية")}</span></div>
        <div class="sv1-prt-stat"><b id="pdDone">0</b><span>${t("Delivered", "تم تسليمها")}</span></div>
        <div class="sv1-prt-stat"><b id="pdDue">0</b><span>${t("Awaiting your invoice", "بانتظار فاتورتك")}</span></div>
      </div>
      <p class="sv1-prt-sub" id="pdRate" style="margin:0 0 8px"></p>
      <div class="sv1-prt-ref">${t("Your referral link", "رابط الإحالة الخاص بك")}: <code id="pdRef">—</code>
        <button type="button" class="sv1-btn sm" id="pdRefCopy">${t("Copy", "انسخ")}</button></div>

      <div class="sv1-prt-tabs" role="tablist" id="pdTabs">
        <button type="button" role="tab" data-tab="orders" aria-selected="true">${t("Your work orders", "أوامر العمل الخاصة بك")}</button>
        <button type="button" role="tab" data-tab="mine" aria-selected="false">${t("My services & prices", "خدماتي وأسعاري")}</button>
        <button type="button" role="tab" data-tab="catalog" aria-selected="false">${t("Services & your share", "الخدمات ونصيبك")}</button>
        <button type="button" role="tab" data-tab="propose" aria-selected="false">${t("Propose a service", "اقترح خدمة")}</button>
        <button type="button" role="tab" data-tab="wallet" aria-selected="false">${t("My wallet", "محفظتي")}</button>
      </div>

      <div class="sv1-prt-pane" data-pane="orders">
        <h3>${t("Your work orders", "أوامر العمل الخاصة بك")}</h3>
        <p>${t("Assigned to you by the Business Partner team. Update the status as you go, and upload your invoice once delivered.", "مسندة إليك من فريق Business Partner. حدّث الحالة أثناء العمل، وارفع فاتورتك بعد التسليم.")}</p>
        <ul class="sv1-prt-list2" id="pdOrders"></ul>
      </div>

      <div class="sv1-prt-pane sv1-hide" data-pane="mine">
        <h3>${t("My services & prices", "خدماتي وأسعاري")}</h3>
        <p>${t("Build each service once with your price and delivery time. Every quote is then assembled by picking from this list. This is your price list with us — what you charge Business Partner. It is not published on the site.", "ابنِ كل خدمة مرة واحدة بسعرك ومدة تنفيذها، فيُبنى كل عرض سعر بالاختيار من هذه القائمة. هذه قائمة أسعارك معنا — ما تفوتره على Business Partner، ولا تُنشر في الموقع.")}</p>
        <div id="pmList"></div>
        <div class="sv1-prt-acts2">
          <button type="button" class="sv1-btn sm" id="pmAdd">＋ ${t("Add a service", "أضف خدمة")}</button>
          <button type="button" class="sv1-btn primary sm" id="pmSave">${t("Save my list", "احفظ قائمتي")}</button>
        </div>
        <div class="sv1-prt-msg" id="pmMsg" role="status" aria-live="polite"></div>
      </div>

      <div class="sv1-prt-pane sv1-hide" data-pane="catalog">
        <h3>${t("Services you can execute", "الخدمات التي يمكنك تنفيذها")}</h3>
        <p>${t("Business Partner's published catalogue. The price is what the client pays before VAT; your share is that less our commission.", "كتالوج Business Partner المنشور. السعر هو ما يدفعه العميل قبل الضريبة، ونصيبك هو السعر بعد خصم عمولتنا.")}</p>
        <div class="sv1-prt-cols sv1-prt-f">
          <div><label for="pcSearch" style="display:block;font-size:11.5px;color:var(--mut);margin:0 0 5px">${t("Search a service", "ابحث عن خدمة")}</label><input class="sv1-prt-in" id="pcSearch" type="search" maxlength="80"></div>
          <div><label for="pcCat" style="display:block;font-size:11.5px;color:var(--mut);margin:0 0 5px">${t("Category", "التصنيف")}</label><select class="sv1-prt-in" id="pcCat"><option value="">${t("All categories", "كل التصنيفات")}</option></select></div>
        </div>
        <div id="pcBox"></div>
      </div>

      <div class="sv1-prt-pane sv1-hide" data-pane="propose">
        <h3>${t("Propose a service we don't offer yet", "اقترح خدمة غير موجودة لدينا")}</h3>
        <p>${t("Something you execute that is not in the catalogue. It reaches the team for pricing and review — nothing is published until we agree.", "خدمة تنفّذها وليست في الكتالوج. تصل الفريق للتسعير والمراجعة — ولا يُنشر شيء قبل الاتفاق.")}</p>
        <form class="sv1-prt-form" id="ppForm" novalidate>
          <div class="sv1-prt-cols sv1-prt-f">
            <div><label for="ppName">${t("Service name", "اسم الخدمة")}</label><input class="sv1-prt-in" id="ppName" maxlength="140"></div>
            <div><label for="ppCat">${t("Category", "التصنيف")}</label><input class="sv1-prt-in" id="ppCat" maxlength="80"></div>
          </div>
          <div class="sv1-prt-cols sv1-prt-f">
            <div><label for="ppPrice">${t("Your price before VAT (SAR)", "سعرك قبل الضريبة (ريال)")}</label><input class="sv1-prt-in" id="ppPrice" type="number" min="0" step="0.01" dir="ltr"></div>
            <div><label for="ppDays">${t("Delivery time", "مدة التنفيذ")}</label><input class="sv1-prt-in" id="ppDays" maxlength="60"></div>
          </div>
          <div class="sv1-prt-f"><label for="ppNotes">${t("What it covers, and what you need from the client", "ما تشمله الخدمة، وما تحتاجه من العميل")}</label><textarea class="sv1-prt-in" id="ppNotes" rows="4" maxlength="1200"></textarea></div>
          <button type="submit" class="sv1-btn primary" id="ppGo">${t("Send the proposal", "أرسل الاقتراح")}</button>
          <div class="sv1-prt-msg" id="ppMsg" role="status" aria-live="polite"></div>
        </form>
      </div>

      <div class="sv1-prt-pane sv1-hide" data-pane="wallet">
        <h3>${t("My wallet", "محفظتي")}</h3>
        <p>${t("Escrow amounts clients are holding for you release here the moment the client approves delivery — then you request a bank withdrawal.", "مبالغ الضمان التي يحجزها العملاء لصالحك تُفرَج هنا لحظة اعتماد العميل للتسليم — ثم تطلب سحباً إلى حسابك البنكي.")}</p>
        <div class="sv1-prt-stats" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="sv1-prt-stat"><b id="pwHeld">—</b><span>${t("Held in escrow for you (SAR)", "محجوز ضماناً لصالحك (ريال)")}</span></div>
          <div class="sv1-prt-stat"><b id="pwBal">—</b><span>${t("Available balance (SAR)", "رصيد متاح للسحب (ريال)")}</span></div>
        </div>
        <div class="sv1-prt-sec">
          <h4>${t("Escrows held for you", "ضمانات محجوزة لصالحك")}</h4>
          <p class="sv1-prt-sub" style="margin:0 0 10px">${t("The client funded these with Business Partner as the guarantor. Each releases to your balance when the client approves delivery.", "موّلها العميل وBusiness Partner هو الضامن. وكل واحد منها يُفرَج إلى رصيدك عند اعتماد العميل للتسليم.")}</p>
          <div id="pwEsc"></div>
        </div>
        <div class="sv1-prt-sec">
          <h4>${t("Request a withdrawal", "اطلب سحب رصيدك")}</h4>
          <p class="sv1-prt-sub" style="margin:0 0 10px">${t("We transfer your available balance to your bank and confirm by e-mail.", "نحوّل رصيدك المتاح إلى حسابك البنكي ونؤكد لك بالبريد.")}</p>
          <form class="sv1-prt-form" id="pwForm" novalidate autocomplete="off">
            <div class="sv1-prt-cols sv1-prt-f">
              <div><label for="pwAmount">${t("Amount (SAR)", "المبلغ (ريال)")}</label><input class="sv1-prt-in" id="pwAmount" type="number" min="1" step="0.01" dir="ltr"></div>
              <div><label for="pwIban">${t("IBAN", "الآيبان IBAN")}</label><input class="sv1-prt-in" id="pwIban" maxlength="34" dir="ltr" placeholder="SA…"></div>
            </div>
            <button type="submit" class="sv1-btn primary" id="pwGo">${t("Request withdrawal", "اطلب السحب")}</button>
            <div class="sv1-prt-msg" id="pwMsg" role="status" aria-live="polite"></div>
          </form>
        </div>
        <div class="sv1-prt-sec">
          <h4>${t("Wallet movements", "حركات المحفظة")}</h4>
          <div id="pwTx"></div>
        </div>
      </div>
    </div>
  </div></section>
</main>
${sv1.footer()}`;

  function partnerClient(C) {
    var TX = C.tx, ST = C.st, AR = C.ar;
    var API = "/api/suppliers", KEY = "bp_partner_sess";
    var ACTIVE = ["أُرسل للمورّد", "قبله المورّد", "قيد التنفيذ"];
    var $ = function (id) { return document.getElementById(id); };
    var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    var show = function (n, on) { n.classList[on ? "remove" : "add"]("sv1-hide"); };
    var say = function (id, cls, text) { var m = $(id); m.className = "sv1-prt-msg" + (cls === "err" ? " sv1-err" : cls ? " " + cls : ""); m.textContent = text || ""; };
    var fill = function (s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); };
    var money = function (n) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); };

    // أثر قديم: الصفحة القديمة كانت تحفظ كلمة المرور في localStorage بنصٍّ صريح.
    try { localStorage.removeItem("bp_supplier"); } catch (e) {}

    var sess = null, state = { supplier: null, orders: [] }, pending = null, myList = [], CATALOG = null, openOrder = "", walletLoaded = false;
    function readSess() { try { var v = sessionStorage.getItem(KEY); var o = v ? JSON.parse(v) : null; return o && o.email && o.pw ? o : null; } catch (e) { return null; } }
    function writeSess(o) { try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
    function dropSess() { try { sessionStorage.removeItem(KEY); } catch (e) {} }

    function call(body) {
      return fetch(API, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (o) { return { s: r.status, o: o || {} }; }); });
    }
    function authed(type, extra) {
      var b = { type: type, email: sess.email, password: sess.pw, pw: sess.pw };
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) b[k] = extra[k];
      return call(b).then(function (x) { if (x.s === 401) signOut(TX.eSession); return x; });
    }
    function errText(x) {
      var e = x.o && x.o.error;
      if (x.s === 429) return TX.eNet;
      if (e === "weak_password") return TX.ePass;
      if (e === "invalid_code") return TX.eCode;
      if (e === "invalid_fields") return TX.eFields;
      if (e === "not_configured") return TX.eCfg;
      if (e === "email_unverified") return TX.eUnverified;
      if (e === "bad_credentials" || e === "unauthorized") return TX.eCreds;
      return TX.eNet;
    }

    /* ───── الدخول والتسجيل والتفعيل ───── */
    var pane = "login";
    function paneTo(p) {
      pane = p;
      show($("pLogin"), p === "login"); show($("pSignup"), p === "signup"); show($("pVerify"), p === "verify");
      show($("pAuthTabs"), p !== "verify");
      $("pTabLogin").setAttribute("aria-selected", p === "login" ? "true" : "false");
      $("pTabSignup").setAttribute("aria-selected", p === "signup" ? "true" : "false");
      say("pAuthMsg", "", "");
    }
    $("pTabLogin").addEventListener("click", function () { paneTo("login"); });
    $("pTabSignup").addEventListener("click", function () { paneTo("signup"); });
    (function () {
      var sel = $("psCat");
      C.cats.forEach(function (c) { var o = el("option", "", c[1]); o.value = c[0]; sel.appendChild(o); });
    })();
    function validEmail(s) { return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(s); }

    $("pLogin").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = $("plEmail").value.trim().toLowerCase(), pw = $("plPass").value;
      if (!validEmail(email) || !pw) return say("pAuthMsg", "err", TX.eCreds);
      var btn = $("plGo"); btn.disabled = true; say("pAuthMsg", "", TX.wait);
      call({ type: "portal", email: email, password: pw }).then(function (x) {
        btn.disabled = false;
        if (x.o.ok) { $("plPass").value = ""; sess = { email: email, pw: pw }; writeSess(sess); apply(x.o); return; }
        if (x.o.error === "email_unverified") {
          // الحساب موجود ولم يُوثَّق بريده: الرمز الجديد يُرسَل ويُفتح مربع التفعيل.
          call({ type: "resend-code", email: email }).then(function (y) {
            if (y.o.ok) { pending = { email: email, pw: pw, token: y.o.token, exp: y.o.exp }; $("pvNote").textContent = TX.codeSent + email; paneTo("verify"); }
            else say("pAuthMsg", "err", errText(x));
          });
          return;
        }
        say("pAuthMsg", "err", errText(x));
      }).catch(function () { btn.disabled = false; say("pAuthMsg", "err", TX.eNet); });
    });

    $("pSignup").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var v = function (id) { return $(id).value.trim(); };
      var email = v("psEmail").toLowerCase(), pw = $("psPass").value;
      if (!v("psCompany") || !v("psPerson") || !v("psPhone") || !validEmail(email)) return say("pAuthMsg", "err", TX.eFields);
      if (pw.length < 8) return say("pAuthMsg", "err", TX.ePass);
      var btn = $("psGo"); btn.disabled = true; say("pAuthMsg", "", TX.wait);
      call({ type: "signup", company: v("psCompany"), person: v("psPerson"), phone: v("psPhone"), email: email, password: pw, city: v("psCity"), categories: [$("psCat").value].filter(Boolean) })
        .then(function (x) {
          btn.disabled = false;
          if (!x.o.ok) return say("pAuthMsg", "err", errText(x));
          pending = { email: email, pw: pw, token: x.o.token, exp: x.o.exp };
          $("pvNote").textContent = TX.codeSent + email;
          paneTo("verify");
        }).catch(function () { btn.disabled = false; say("pAuthMsg", "err", TX.eNet); });
    });

    $("pVerify").addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!pending) return paneTo("login");
      var code = $("pvCode").value.trim();
      if (!code) return;
      var btn = $("pvGo"); btn.disabled = true; say("pAuthMsg", "", TX.wait);
      call({ type: "verify-email", email: pending.email, code: code, token: pending.token, exp: pending.exp, password: pending.pw }).then(function (x) {
        if (!x.o.ok) { btn.disabled = false; return say("pAuthMsg", "err", errText(x)); }
        // وُثّق البريد: ندخل بكلمة المرور التي اختارها الشريك للتوّ.
        call({ type: "portal", email: pending.email, password: pending.pw }).then(function (y) {
          btn.disabled = false;
          if (!y.o.ok) return say("pAuthMsg", "err", errText(y));
          sess = { email: pending.email, pw: pending.pw }; writeSess(sess); pending = null; $("pvCode").value = ""; apply(y.o);
        });
      }).catch(function () { btn.disabled = false; say("pAuthMsg", "err", TX.eNet); });
    });
    $("pvResend").addEventListener("click", function () {
      if (!pending) return;
      var b = $("pvResend"); b.disabled = true;
      call({ type: "resend-code", email: pending.email }).then(function (x) {
        b.disabled = false;
        if (x.o.ok) { pending.token = x.o.token; pending.exp = x.o.exp; say("pAuthMsg", "ok", TX.resent); }
      }).catch(function () { b.disabled = false; });
    });
    // نسيان كلمة المرور: الرمز المُرسَل للبريد يثبت ملكيته، فيؤكّد البريد وكلمة المرور الجديدة معاً.
    $("plForgot").addEventListener("click", function () {
      var email = $("plEmail").value.trim().toLowerCase(), pw = $("plPass").value;
      if (!validEmail(email) || pw.length < 8) return say("pAuthMsg", "err", TX.forgotNeed);
      call({ type: "resend-code", email: email }).then(function (x) {
        if (!x.o.ok) return say("pAuthMsg", "err", errText(x));
        pending = { email: email, pw: pw, token: x.o.token, exp: x.o.exp };
        $("pvNote").textContent = TX.resetSent;
        paneTo("verify");
      }).catch(function () { say("pAuthMsg", "err", TX.eNet); });
    });

    /* ───── اللوحة ───── */
    function apply(o) {
      state.supplier = o.supplier; state.orders = o.orders || [];
      if (state.supplier && state.supplier.priceList && state.supplier.priceList.length && !myList.length) myList = state.supplier.priceList.slice();
      show($("pAuth"), false); show($("pDash"), true);
      walletLoaded = false; openOrder = "";
      render();
    }
    function signOut(msg) {
      dropSess(); sess = null; state = { supplier: null, orders: [] }; pending = null; myList = [];
      show($("pDash"), false); show($("pAuth"), true);
      paneTo("login"); say("pAuthMsg", msg ? "err" : "", msg || "");
    }
    $("pdOut").addEventListener("click", function () { signOut(""); });
    function reload() {
      return call({ type: "portal", email: sess.email, password: sess.pw }).then(function (x) {
        if (x.o.ok) { state.supplier = x.o.supplier; state.orders = x.o.orders || []; render(); }
        else if (x.s === 401) signOut(TX.eSession);
      });
    }

    function copyText(txt, btn) {
      var done = function () { var o = btn.textContent; btn.textContent = TX.copied; setTimeout(function () { btn.textContent = o; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, done);
      else { var ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); done(); }
    }
    $("pdRefCopy").addEventListener("click", function () { copyText($("pdRef").textContent, $("pdRefCopy")); });

    function render() {
      var s = state.supplier || {}, orders = state.orders || [];
      $("pdName").textContent = s.name || "—";
      $("pdMeta").textContent = [s.person, s.code, s.city, (s.categories || []).join("، ")].filter(Boolean).join(" · ");

      // التأهيل: ثلاث محطات، آخرها اعتماد الفريق. حالة الخادم: جديد ← معتمد، أو موقوف/مرفوض.
      var approved = s.status === "معتمد", blocked = s.status === "موقوف" || s.status === "مرفوض";
      var q = $("pdQual"); q.textContent = "";
      [[TX.qRegistered, "done", "✓"], [TX.qVerified, "done", "✓"],
       [TX.qApproval, approved ? "done" : "wait", approved ? "✓" : "…"]].forEach(function (it) {
        var li = el("li", it[1]); li.appendChild(el("i", "", it[2]));
        var d = el("div"); d.appendChild(el("b", "", it[0]));
        d.appendChild(document.createTextNode(it[0] === TX.qApproval ? (approved ? TX.qApproved.split(" — ")[0] : blocked ? TX.qBlocked : TX.qPending) : ""));
        li.appendChild(d); q.appendChild(li);
      });
      $("pdQualNote").textContent = approved ? TX.qApproved : blocked ? TX.qBlockedNote : TX.qPendingNote;

      var pct = Number(s.commission);
      $("pdRate").textContent = isFinite(pct) && s.commission != null ? fill(TX.commission, { c: pct, n: 100 - pct }) : TX.commissionPer;
      var done = orders.filter(function (o) { return o.status === "تم التسليم" || o.status === "معتمد"; });
      $("pdOpen").textContent = orders.filter(function (o) { return ACTIVE.indexOf(o.status) !== -1; }).length;
      $("pdDone").textContent = done.length;
      $("pdDue").textContent = done.filter(function (o) { return o.supplierInvoiceStatus === "لم تُرفع"; }).length;
      // رابط واحد يشاركه الشريك: من يشتري عبره يُنسَب إليه فتقوم العمولة على دليل.
      $("pdRef").textContent = s.code ? location.origin + (C.lang === "en" ? "" : "/" + C.lang) + "/services?p=" + s.code : "—";
      drawOrders(); drawMine(); drawCatalog();
    }

    function tab(which) {
      [].forEach.call(document.querySelectorAll("#pdTabs button"), function (b) { b.setAttribute("aria-selected", b.getAttribute("data-tab") === which ? "true" : "false"); });
      [].forEach.call(document.querySelectorAll("[data-pane]"), function (p) { show(p, p.getAttribute("data-pane") === which); });
      if (which === "wallet" && !walletLoaded) { walletLoaded = true; loadWallet(); }
    }
    [].forEach.call(document.querySelectorAll("#pdTabs button"), function (b) { b.addEventListener("click", function () { tab(b.getAttribute("data-tab")); }); });

    /* أوامر العمل */
    function inputEl(cls, type, val, ph) {
      var i = el("input", "sv1-prt-in " + cls); i.type = type || "text"; if (val != null) i.value = val; if (ph) i.placeholder = ph; return i;
    }
    function drawOrders() {
      var ul = $("pdOrders"); ul.textContent = "";
      var orders = state.orders || [];
      if (!orders.length) { ul.appendChild(el("li", "sv1-prt-sub", TX.oNone)); return; }
      orders.forEach(function (o) {
        var li = el("li", "sv1-prt-card");
        var head = el("div", "sv1-prt-card-h");
        var l = el("div");
        l.appendChild(el("b", "", o.service || o.ref));
        var meta = [o.ref, o.city, o.due, o.clientRef].filter(Boolean).join(" · ");
        l.appendChild(el("div", "sv1-prt-sub", meta));
        if (o.details) l.appendChild(el("div", "sv1-prt-sub", o.details));
        var money2 = [];
        if (o.amount != null) money2.push(TX.oValue + ": " + money(o.amount) + " " + TX.sar);
        if (o.commission != null && o.commission > 0) money2.push(TX.oComm + ": " + money(o.commission) + " " + TX.sar);
        if (money2.length) l.appendChild(el("div", "sv1-prt-sub", money2.join(" · ")));
        head.appendChild(l);
        var r = el("div"); r.style.textAlign = "end";
        r.appendChild(el("span", "sv1-prt-chip" + (o.status === "تم التسليم" || o.status === "معتمد" ? " ok" : ""), ST[o.status] || o.status || "—"));
        r.appendChild(el("div", "sv1-prt-sub", TX.oInvoice + ": " + (ST[o.supplierInvoiceStatus] || o.supplierInvoiceStatus || "—")));
        head.appendChild(r);
        li.appendChild(head);
        var log = (o.log || []).slice(-4);
        if (log.length) {
          var tr = el("div", "sv1-prt-trail"); tr.appendChild(el("div", "sv1-prt-sub", TX.oClient));
          log.forEach(function (g) {
            var text = String(g.text || ""), mine = /قَبِل عرض السعر|وقّع العميل|استلمنا المبلغ|رفض عرض السعر/.test(text);
            var d = el("div", mine ? "mine" : ""); d.appendChild(el("span", "", mine ? "●" : "·")); d.appendChild(el("span", "", text)); d.appendChild(el("span", "", String(g.at || "").slice(0, 10)));
            tr.appendChild(d);
          });
          li.appendChild(tr);
        }
        var isRfq = o.status === "طلب عرض سعر";
        var acts = el("div", "sv1-prt-acts2");
        var b = el("button", "sv1-btn primary sm", isRfq ? TX.oQuoteBtn : TX.oUpdBtn); b.type = "button";
        b.addEventListener("click", function () { openOrder = openOrder === o.id ? "" : o.id; drawOrders(); });
        acts.appendChild(b); li.appendChild(acts);
        if (openOrder === o.id) li.appendChild(orderForm(o, isRfq));
        ul.appendChild(li);
      });
    }

    function orderForm(o, isRfq) {
      var f = el("form", "sv1-prt-frm sv1-prt-form"); f.noValidate = true;
      var lines = el("div"), totalEl = el("div", "sv1-prt-sub"), sel = null, lead = null, status = null, file = null;
      var ctl = function (labelText, node) { var d = el("div", "sv1-prt-f"); d.appendChild(el("label", "", labelText)); d.appendChild(node); return d; };
      function readLines() {
        return [].map.call(lines.querySelectorAll(".sv1-prt-line"), function (r) {
          return { name: r.querySelector(".pl-n").value.trim(), qty: Number(r.querySelector(".pl-q").value) || 1, price: Number(r.querySelector(".pl-p").value) || 0 };
        });
      }
      function total() {
        var t = Math.round(readLines().reduce(function (a, l) { return a + l.price * l.qty; }, 0) * 100) / 100;
        totalEl.textContent = TX.oTotal + money(t) + " " + TX.sar; return t;
      }
      function drawLines(arr) {
        lines.textContent = "";
        arr.forEach(function (l) {
          var r = el("div", "sv1-prt-line");
          var n = inputEl("pl-n nm", "text", l.name || "", TX.oItem), q = inputEl("pl-q", "number", l.qty || 1), p = inputEl("pl-p", "number", l.price == null ? "" : l.price, TX.oPrice);
          q.min = 1; p.min = 0; p.step = "0.01"; q.setAttribute("dir", "ltr"); p.setAttribute("dir", "ltr");
          var x = el("button", "sv1-btn sm", "✕"); x.type = "button"; x.addEventListener("click", function () { r.remove(); total(); });
          [n, q, p].forEach(function (i) { i.addEventListener("input", total); });
          r.appendChild(n); r.appendChild(q); r.appendChild(p); r.appendChild(x); lines.appendChild(r);
        });
        total();
      }
      if (isRfq) {
        var qb = el("div", "sv1-prt-f"); qb.appendChild(el("label", "", TX.oLabelQuote)); qb.appendChild(el("p", "sv1-prt-sub", TX.oLabelQuoteHint)); qb.appendChild(lines);
        var tools = el("div", "sv1-prt-acts2");
        sel = el("select", "sv1-prt-in"); sel.style.flex = "1"; sel.style.minWidth = "180px";
        var o0 = el("option", "", TX.oPick); o0.value = ""; sel.appendChild(o0);
        myList.forEach(function (it, i) { var op = el("option", "", it.name + " — " + it.price + " " + TX.sar); op.value = i; sel.appendChild(op); });
        sel.addEventListener("change", function () {
          var it = myList[Number(sel.value)]; if (sel.value === "" || !it) return;
          drawLines(readLines().filter(function (l) { return l.name || l.price > 0; }).concat([{ name: it.name, qty: 1, price: it.price }])); sel.value = "";
        });
        var blank = el("button", "sv1-btn sm", "＋ " + TX.oBlank); blank.type = "button";
        blank.addEventListener("click", function () { drawLines(readLines().concat([{ name: "", qty: 1, price: "" }])); });
        tools.appendChild(sel); tools.appendChild(blank); qb.appendChild(tools); qb.appendChild(totalEl);
        f.appendChild(qb);
        lead = inputEl("", "text", o.leadTime || "", TX.oLeadPh); f.appendChild(ctl(TX.oLead, lead));
        drawLines((o.lines && o.lines.length) ? o.lines : [{ name: "", qty: 1, price: "" }]);
      } else {
        status = el("select", "sv1-prt-in");
        [["قبله المورّد", TX.oAccept], ["قيد التنفيذ", TX.oProg], ["تم التسليم", TX.oDeliv]].forEach(function (p) {
          var op = el("option", "", p[1]); op.value = p[0]; if (o.status === p[0]) op.selected = true; status.appendChild(op);
        });
        f.appendChild(ctl(TX.oStatus, status));
        file = el("input", "sv1-prt-in"); file.type = "file"; file.accept = ".pdf,image/*";
        var fd = ctl(TX.oInv, file);
        fd.insertBefore(el("p", "sv1-prt-sub", o.quote != null ? fill(TX.oInvQuote, { q: money(o.quote) }) : TX.oInvHint), file);
        f.appendChild(fd);
      }
      var prog = inputEl("", "text", "", TX.oProgressPh); prog.maxLength = 400;
      var pd = ctl(TX.oProgress, prog); pd.appendChild(el("p", "sv1-prt-sub", TX.oProgressHint)); f.appendChild(pd);
      var notes = el("textarea", "sv1-prt-in"); notes.rows = 3; notes.value = o.notes || ""; f.appendChild(ctl(TX.oNotes, notes));
      var link = null;
      if (o.quote != null || (o.lines && o.lines.length)) {
        link = el("div", "sv1-prt-f sv1-hide"); link.appendChild(el("label", "", TX.oQLink)); link.appendChild(el("p", "sv1-prt-sub", TX.oQLinkHint));
        var lr = el("div", "sv1-prt-acts2"), li2 = inputEl("", "text", ""); li2.readOnly = true; li2.setAttribute("dir", "ltr"); li2.style.flex = "1";
        var cb = el("button", "sv1-btn sm", TX.copy); cb.type = "button"; cb.addEventListener("click", function () { copyText(li2.value, cb); });
        lr.appendChild(li2); lr.appendChild(cb); link.appendChild(lr); f.appendChild(link);
        authed("quote-link", { orderId: o.id }).then(function (x) { if (x.o && x.o.ok && x.o.url) { li2.value = x.o.url; show(link, true); } });
      }
      var acts = el("div", "sv1-prt-acts2");
      var save = el("button", "sv1-btn primary", TX.save); save.type = "submit";
      var cancel = el("button", "sv1-btn", TX.cancel); cancel.type = "button"; cancel.addEventListener("click", function () { openOrder = ""; drawOrders(); });
      acts.appendChild(save); acts.appendChild(cancel); f.appendChild(acts);
      var msg = el("div", "sv1-prt-msg"); f.appendChild(msg);
      var flash = function (cls, text) { msg.className = "sv1-prt-msg" + (cls === "err" ? " sv1-err" : cls ? " " + cls : ""); msg.textContent = text; };

      f.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var payload = { orderId: o.id, notes: notes.value.trim(), progress: prog.value.trim() };
        if (isRfq) {
          var ls = readLines().filter(function (l) { return l.name && l.price > 0; });
          if (!ls.length) return flash("err", TX.oNeedLine);
          payload.lines = ls; payload.leadTime = lead.value.trim();
        } else payload.status = status.value;
        var f0 = file && file.files && file.files[0];
        if (f0 && f0.size > 4 * 1024 * 1024) return flash("err", TX.oInvBig);
        save.disabled = true; flash("", TX.saving);
        var go = function () {
          authed("order-update", payload).then(function (x) {
            save.disabled = false;
            if (x.o.ok) { flash("ok", TX.saved); setTimeout(function () { openOrder = ""; reload(); }, 900); }
            else flash("err", TX.eSave);
          }).catch(function () { save.disabled = false; flash("err", TX.eSave); });
        };
        if (f0) {
          var fr = new FileReader();
          fr.onload = function () { payload.invoiceBase64 = String(fr.result).split(",")[1] || ""; payload.invoiceName = f0.name; payload.invoiceType = f0.type; go(); };
          fr.onerror = function () { save.disabled = false; flash("err", TX.eSave); };
          fr.readAsDataURL(f0);
        } else go();
      });
      return f;
    }

    /* خدماتي وأسعاري */
    function readMine() {
      return [].map.call($("pmList").querySelectorAll(".sv1-prt-row3"), function (r) {
        return { name: r.querySelector(".pm-n").value.trim(), price: Number(r.querySelector(".pm-p").value), lead: r.querySelector(".pm-l").value.trim() };
      });
    }
    function drawMine() {
      var box = $("pmList"); box.textContent = "";
      if (!myList.length) { box.appendChild(el("p", "sv1-prt-sub", TX.mNone)); return; }
      myList.forEach(function (it, i) {
        var r = el("div", "sv1-prt-row3");
        var n = inputEl("pm-n nm", "text", it.name || "", TX.mSvc), p = inputEl("pm-p", "number", it.price == null ? "" : it.price, TX.oPrice), l = inputEl("pm-l", "text", it.lead || "", TX.mDelivery);
        p.min = 0; p.step = "0.01"; p.setAttribute("dir", "ltr");
        var x = el("button", "sv1-btn sm", "✕"); x.type = "button";
        x.addEventListener("click", function () { myList = readMine().filter(function (_, j) { return j !== i; }); drawMine(); });
        r.appendChild(n); r.appendChild(p); r.appendChild(l); r.appendChild(x); box.appendChild(r);
      });
    }
    $("pmAdd").addEventListener("click", function () { myList = readMine().concat([{ name: "", price: "", lead: "" }]); drawMine(); });
    $("pmSave").addEventListener("click", function () {
      var list = readMine().filter(function (it) { return it.name && isFinite(it.price) && it.price >= 0; });
      var b = $("pmSave"); b.disabled = true; say("pmMsg", "", TX.saving);
      authed("my-services", { services: list }).then(function (x) {
        b.disabled = false;
        if (x.o.ok) { myList = x.o.priceList || list; drawMine(); say("pmMsg", "ok", TX.mSaved); }
        else say("pmMsg", "err", TX.eSave);
      }).catch(function () { b.disabled = false; say("pmMsg", "err", TX.eNet); });
    });

    /* الكتالوج ونصيب الشريك */
    function drawCatalog() {
      var box = $("pcBox");
      if (!CATALOG) {
        fetch("/assets/data/catalog.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : { services: [] }; })
          .then(function (d) {
            CATALOG = (d && d.services) || [];
            var seen = {}, sel = $("pcCat");
            CATALOG.forEach(function (x) {
              var c = AR ? (x.categoryAr || x.category) : (x.category || x.categoryAr); if (!c || seen[c]) return; seen[c] = 1;
              var o = el("option", "", c); o.value = c; sel.appendChild(o);
            });
            sel.addEventListener("change", drawCatalog); $("pcSearch").addEventListener("input", drawCatalog);
            drawCatalog();
          }).catch(function () { box.textContent = TX.cErr; });
        return;
      }
      var s = state.supplier || {}, pct = s.commission != null ? Number(s.commission) : 20;
      var q = $("pcSearch").value.trim().toLowerCase(), cat = $("pcCat").value;
      var rows = CATALOG.filter(function (x) {
        if (cat && (AR ? (x.categoryAr || x.category) : (x.category || x.categoryAr)) !== cat) return false;
        if (!q) return true;
        return ((x.nameAr || "") + " " + (x.nameEn || "") + " " + (x.code || "")).toLowerCase().indexOf(q) !== -1;
      });
      box.textContent = "";
      if (!rows.length) { box.appendChild(el("p", "sv1-prt-sub", TX.cNone)); return; }
      box.appendChild(el("p", "sv1-prt-sub", TX.cRate + pct + "% · " + TX.cVat));
      var wrap = el("div", "sv1-prt-tbl"), tb = el("table"), th = el("thead"), hr = el("tr");
      [TX.cCode, TX.cSvc, TX.cSite, TX.cFee, TX.cShare].forEach(function (h) { hr.appendChild(el("th", "", h)); });
      th.appendChild(hr); tb.appendChild(th);
      var body = el("tbody");
      rows.forEach(function (x) {
        var p = Number(x.amount) || 0, fee = Math.round(p * pct) / 100, net = Math.round((p - fee) * 100) / 100;
        var tr = el("tr");
        tr.appendChild(el("td", "n", x.code || "—"));
        var td = el("td", "", AR ? (x.nameAr || x.nameEn || "—") : (x.nameEn || x.nameAr || "—"));
        td.appendChild(el("div", "sv1-prt-sub", (AR ? (x.categoryAr || x.category) : (x.category || x.categoryAr)) || "")); tr.appendChild(td);
        tr.appendChild(el("td", "n", p ? money(p) + " " + TX.sar : TX.cReq));
        tr.appendChild(el("td", "n", p ? money(fee) + " " + TX.sar : "—"));
        var sh = el("td", "n"); sh.appendChild(el("b", "", p ? money(net) + " " + TX.sar : TX.cQuoted)); tr.appendChild(sh);
        body.appendChild(tr);
      });
      tb.appendChild(body); wrap.appendChild(tb); box.appendChild(wrap);
    }

    /* اقتراح خدمة */
    $("ppForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var v = function (id) { return $(id).value.trim(); }, price = Number(v("ppPrice"));
      if (!v("ppName") || !(price > 0)) return say("ppMsg", "err", TX.pNeed);
      var b = $("ppGo"); b.disabled = true; say("ppMsg", "", TX.wait);
      authed("propose-service", { name: v("ppName"), category: v("ppCat"), price: price, lead: v("ppDays"), notes: v("ppNotes") }).then(function (x) {
        b.disabled = false;
        if (x.o.ok) { say("ppMsg", "ok", TX.pOk); $("ppForm").reset(); } else say("ppMsg", "err", TX.pErr);
      }).catch(function () { b.disabled = false; say("ppMsg", "err", TX.pErr); });
    });

    /* المحفظة: القراءة والإعلان بالتسليم والموافقة على الاسترجاع وطلب السحب. المنطق في الخادم لا هنا. */
    function loadWallet() {
      authed("wallet", {}).then(function (x) {
        var d = x.o;
        if (!d || !d.ok) { walletLoaded = false; return; }
        if (d.enabled === false) { $("pwEsc").textContent = TX.wOff; return; }
        $("pwHeld").textContent = money(d.heldTotal || 0); $("pwBal").textContent = money(d.balance || 0);
        var box = $("pwEsc"); box.textContent = "";
        var held = d.held || [];
        if (!held.length) box.appendChild(el("p", "sv1-prt-sub", TX.wNone));
        held.forEach(function (e) {
          var row = el("div", "sv1-prt-card"); row.style.marginBottom = "10px";
          var h = el("div", "sv1-prt-card-h"), l = el("div");
          l.appendChild(el("b", "", e.title || e.ref)); l.appendChild(el("div", "sv1-prt-sub", e.ref + " · " + String(e.created_at || "").slice(0, 10)));
          var r = el("div"); r.style.textAlign = "end";
          r.appendChild(el("b", "", money(e.amount) + " " + TX.sar));
          r.appendChild(el("div", "sv1-prt-sub", e.status === "refund_requested" ? TX.wRefund : e.status === "delivered" ? TX.wDelivered : TX.wHeld));
          h.appendChild(l); h.appendChild(r); row.appendChild(h);
          var area = el("div", "sv1-prt-acts2");
          // خطوة تأكيد صريحة قبل أي إجراء يمسّ المال: زرّ يفتح لوحة تأكيد، ولا تنفيذ من النقرة الأولى.
          function confirmer(label, ask, withNote, type) {
            var b = el("button", "sv1-btn sm", label); b.type = "button";
            b.addEventListener("click", function () {
              area.textContent = "";
              var p = el("div", "sv1-prt-f"); p.style.width = "100%"; p.appendChild(el("label", "", ask));
              var note = null; if (withNote) { note = el("textarea", "sv1-prt-in"); note.rows = 2; note.maxLength = 400; p.appendChild(note); }
              var go = el("button", "sv1-btn primary sm", TX.wConfirm); go.type = "button";
              var no = el("button", "sv1-btn sm", TX.cancel); no.type = "button"; no.addEventListener("click", loadWallet);
              var bar = el("div", "sv1-prt-acts2"); bar.appendChild(go); bar.appendChild(no); p.appendChild(bar);
              var m = el("div", "sv1-prt-msg"); p.appendChild(m); area.appendChild(p);
              go.addEventListener("click", function () {
                go.disabled = true;
                authed(type, { ref: e.ref, note: note ? note.value.trim() : "" }).then(function (y) {
                  if (y.o && y.o.ok) loadWallet(); else { go.disabled = false; m.className = "sv1-prt-msg sv1-err"; m.textContent = TX.wErr; }
                }).catch(function () { go.disabled = false; m.className = "sv1-prt-msg sv1-err"; m.textContent = TX.eNet; });
              });
            });
            area.appendChild(b);
          }
          if (e.status === "held") confirmer(TX.wDeliverBtn, TX.wDeliverAsk, true, "escrow-deliver");
          if (e.status === "refund_requested") { confirmer(TX.wAgreeBtn, TX.wAgreeAsk, false, "escrow-agree-refund"); area.appendChild(el("span", "sv1-prt-sub", TX.wRefundHint)); }
          if (area.childNodes.length) row.appendChild(area);
          box.appendChild(row);
        });
        var tx = $("pwTx"); tx.textContent = "";
        var rows = d.transactions || [];
        if (!rows.length) tx.appendChild(el("p", "sv1-prt-sub", TX.wNoTx));
        rows.forEach(function (t2) {
          var amt = Number(t2.amount) || 0, r = el("div", "sv1-prt-tx"), l = el("span", "", t2.note || t2.type);
          l.appendChild(el("div", "sv1-prt-sub", String(t2.created_at || "").slice(0, 10)));
          r.appendChild(l); r.appendChild(el("b", amt >= 0 ? "pos" : "neg", (amt >= 0 ? "+" : "") + money(amt) + " " + TX.sar)); tx.appendChild(r);
        });
      }).catch(function () { walletLoaded = false; });
    }
    $("pwForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var amount = Number($("pwAmount").value);
      if (!(amount > 0)) return say("pwMsg", "err", TX.wAmt);
      var b = $("pwGo"); b.disabled = true; say("pwMsg", "", TX.wait);
      authed("withdraw", { amount: amount, iban: $("pwIban").value.trim() }).then(function (x) {
        b.disabled = false;
        if (x.o.ok) { say("pwMsg", "ok", TX.wSent); $("pwForm").reset(); loadWallet(); }
        else say("pwMsg", "err", x.o.error === "insufficient_funds" ? fill(TX.wOver, { b: money(x.o.balance || 0) }) : TX.wErrW);
      }).catch(function () { b.disabled = false; say("pwMsg", "err", TX.wErrW); });
    });

    /* ───── الإقلاع ───── */
    function hashPane() { paneTo(/^#signup$/i.test(location.hash) ? "signup" : "login"); }
    hashPane();
    window.addEventListener("hashchange", function () { if (!sess && pane !== "verify") hashPane(); });
    sess = readSess();
    if (sess) reload().then(function () { if (state.supplier) { show($("pAuth"), false); show($("pDash"), true); } });
  }

  const safe = (s) => s.replace(/</g, "\\u003c");
  const script = `<script>(${partnerClient.toString()})(${safe(JSON.stringify(CFG))});</script>`;
  return sv1.shell({
    title: Lraw("Partner dashboard — Business Partner", "لوحة الشريك — Business Partner"),
    desc: Lraw("Sign in or register as a Business Partner partner: work orders, your services and prices, your share of every catalogue service, and your wallet.", "سجّل الدخول أو سجّل شريكاً لدى Business Partner: أوامر العمل وخدماتك وأسعارك ونصيبك من كل خدمة في الكتالوج ومحفظتك."),
    path: "/partner-dashboard", body, script, noindex: true,
  });
}
