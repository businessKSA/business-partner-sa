// Business Partner — Simple V1: «الباقات» (/packages).
//
// كانت الصفحة على قشرة الموقع القديم: ترويستان فوق بعض (هيرو B10X ثم هيرو
// الصفحة)، ورأسها يقول «أربع باقات سنوية» وبطاقاتها «شهرياً»، وبلا مقارنة،
// وسعرٌ مخفي عن الزائر بلا أي إشارة إلى السبب، وأزرارها تقود إلى /account
// القديم وإلى بوابة عروض الأسعار المتقاعدة. وصارت هنا بلغة الموقع الجديد.
//
// **مصدر المحتوى:** صفوف الباقات `BP-PKG-*` — `site.packages.groups` في ذاكرة
// المولّد، وهي بعينها ما يُكتب في `catalog.json → packages` بعد تسعيرها من
// اللوحة (انظر آخر generate.mjs). لا نصّ ولا رقم يُكتب هنا باليد إلا عناوين
// الصفحة. ولا يُخترع سعرٌ ولا خصمٌ سنوي: ما ليس في الكتالوج (سعر سنوي، مدة
// التزام، شروط تجديد) لا يظهر، ويُبلَّغ عنه المالك.
//
// **الشراء:** «أضف للسلة» يكتب في `localStorage.bp_cart` بند `pkg-<sku>`
// (SKU بأحرف صغيرة: `pkg-bp-pkg-launch`) و`amount` رقم من الكتالوج و`price`
// نصّ عرض — العقد نفسه الذي تقرؤه /cart و/checkout و`api/pay.js`
// (`catalogPrices()` يفهرس الباقة بكودها ومفتاحها، فيجد السعر من الخادم
// لا من المتصفح). الدفع ينتهي بزر «افتح طلباتي» إلى /my الجديدة.
//
// **الأسعار للمسجّلين فقط** (سياسة المالك SHOW_PRICES=false): كل رقم يحمل صنف
// `price-amt` فتخفيه القاعدة العامة `html[data-prices="off"]`، ويظهر مكانه
// `data-guest-note` للزائر — بدل خانةٍ فارغة بلا تفسير.
//
// الأزرار الأربعة وجهاتها:
//   أضف للسلة            → bp_cart ثم /cart          (باقة بسعر)
//   اسأل / اطلب عرضاً    → bp_sva_request ثم /#advisor (المحادثة ← عرض سعر ← عقد)
//   احجز استشارة         → /consultation              (الباقة حسب الطلب)
//   تصفّح الخدمات المنفردة → /catalog
// لا رابط إلى /account ولا إلى بوابة عروض الأسعار القديمة ولا إلى الحاسبة.

const T = {
  title:   { ar: "الباقات", en: "Packages", fr: "Forfaits", zh: "套餐" },
  h1:      { ar: "باقات واضحة لإدارة منشأتك", en: "Clear packages to run your business",
             fr: "Des forfaits clairs pour gérer votre entreprise", zh: "清晰明了的套餐，助您管理企业" },
  desc:    { ar: "اشتراكات تدير منصاتك الحكومية وامتثالك، وباقات تأسيس الشركات، وباقات قانونية — اختر، قارن، وأضف إلى السلة.",
             en: "Subscriptions that run your government platforms and compliance, company-formation packages and legal packages — pick, compare and add to your cart.",
             fr: "Des abonnements qui gèrent vos plateformes gouvernementales et votre conformité, des forfaits de création et des forfaits juridiques — choisissez, comparez, ajoutez au panier.",
             zh: "负责管理政府平台与合规的订阅、公司设立套餐和法律套餐——选择、对比并加入购物车。" },
  tag:     { ar: "{n} باقة في {g} مسارات", en: "{n} packages in {g} tracks", fr: "{n} forfaits dans {g} parcours", zh: "{g} 个类别共 {n} 个套餐" },
  cmp:     { ar: "قارن الباقات", en: "Compare packages", fr: "Comparer les forfaits", zh: "对比套餐" },
  ask:     { ar: "اسأل المستشار الذكي", en: "Ask the smart advisor", fr: "Demander au conseiller intelligent", zh: "咨询智能顾问" },
  nPk:     { ar: "{n} باقات", en: "{n} packages", fr: "{n} forfaits", zh: "{n} 个套餐" },
  g_management: { ar: "باقات الخدمات", en: "Service packages", fr: "Forfaits de services", zh: "服务套餐" },
  g_formation:  { ar: "تأسيس الشركات", en: "Company formation", fr: "Création de société", zh: "公司设立" },
  g_legal:      { ar: "الباقات القانونية", en: "Legal packages", fr: "Forfaits juridiques", zh: "法律套餐" },
  d_management: { ar: "اشتراك شهري نتولّى به سجلّك التجاري وقوى والتأمينات والامتثال، وتتدرّج الباقة بحجم منشأتك.",
                  en: "A monthly subscription where we run your commercial registration, Qiwa, GOSI and compliance — the package scales with your headcount.",
                  fr: "Un abonnement mensuel pour gérer registre de commerce, Qiwa, GOSI et conformité — le forfait évolue avec votre effectif.",
                  zh: "按月订阅，由我们负责商业登记、Qiwa、GOSI 与合规——套餐随员工规模递增。" },
  d_formation:  { ar: "تأسيس شركتك من الترخيص إلى السجل والتسجيل في المنصات، حسب جنسية المؤسّس.",
                  en: "Set up your company from licence to registration and platform enrolment, by the founder's nationality.",
                  fr: "Créez votre société, de la licence à l'enregistrement sur les plateformes, selon la nationalité du fondateur.",
                  zh: "从许可证到登记及平台注册，按创始人国籍完成公司设立。" },
  d_legal:      { ar: "استشارات وعقود وتمثيل قضائي بحصص محدّدة لكل باقة، باشتراك شهري.",
                  en: "Consultations, contracts and litigation representation with defined allowances per package, on a monthly subscription.",
                  fr: "Consultations, contrats et représentation en justice avec des quotas définis par forfait, en abonnement mensuel.",
                  zh: "咨询、合同与诉讼代理，每个套餐有明确额度，按月订阅。" },
  badge:   { ar: "موصى به", en: "Recommended", fr: "Recommandé", zh: "推荐" },
  addCart: { ar: "أضف للسلة", en: "Add to cart", fr: "Ajouter au panier", zh: "加入购物车" },
  added:   { ar: "أُضيف ✓", en: "Added ✓", fr: "Ajouté ✓", zh: "已加入 ✓" },
  askPk:   { ar: "اسأل المستشار عن هذه الباقة", en: "Ask the advisor about this package", fr: "Interroger le conseiller sur ce forfait", zh: "向顾问咨询此套餐" },
  reqQuote:{ ar: "اطلب عرضاً مخصّصاً", en: "Request a custom quote", fr: "Demander un devis sur mesure", zh: "申请定制报价" },
  book:    { ar: "احجز استشارة", en: "Book a consultation", fr: "Réserver une consultation", zh: "预约咨询" },
  custom:  { ar: "باقة حسب الطلب", en: "Custom package", fr: "Forfait sur mesure", zh: "定制套餐" },
  customD: { ar: "تُسعَّر على حجم منشأتك ونطاق عملك، فيصلك عرض سعر رسمي بعد أن نفهم احتياجك.",
             en: "Priced to your headcount and scope — you receive a formal quotation once we understand your needs.",
             fr: "Tarifée selon votre effectif et votre périmètre — vous recevez un devis formel une fois votre besoin compris.",
             zh: "按您的规模与范围定价——了解需求后向您提供正式报价。" },
  guest:   { ar: "السعر يظهر بعد تسجيل الدخول", en: "Price shown after you sign in", fr: "Prix affiché après connexion", zh: "登录后显示价格" },
  signIn:  { ar: "سجّل الدخول", en: "Sign in", fr: "Se connecter", zh: "登录" },
  allFeat: { ar: "كل المزايا ({n})", en: "All features ({n})", fr: "Toutes les fonctionnalités ({n})", zh: "全部内容（{n}）" },
  extra:   { ar: "رسوم إضافية", en: "Additional fees", fr: "Frais supplémentaires", zh: "额外费用" },
  rowPrice:{ ar: "السعر", en: "Price", fr: "Prix", zh: "价格" },
  rowFor:  { ar: "تناسب", en: "Best for", fr: "Pour qui", zh: "适用对象" },
  rowAdd:  { ar: "اشترِ", en: "Buy", fr: "Acheter", zh: "购买" },
  rowIncl: { ar: "المزايا", en: "What's included", fr: "Contenu", zh: "包含内容" },
  yes:     { ar: "مشمولة", en: "Included", fr: "Inclus", zh: "包含" },
  no:      { ar: "غير مشمولة", en: "Not included", fr: "Non inclus", zh: "不包含" },
  entity:  { ar: "تأسيس أو تحويل الكيانات", en: "Entity formation / conversion", fr: "Création / transformation d'entités", zh: "实体设立 / 转换" },
  hint:    { ar: "اسحب الجدول يميناً ويساراً لرؤية كل الباقات.", en: "Swipe the table sideways to see every package.",
             fr: "Faites défiler le tableau latéralement pour voir tous les forfaits.", zh: "左右滑动表格查看所有套餐。" },
  howT:    { ar: "من الاختيار إلى التنفيذ", en: "From choosing to delivery", fr: "Du choix à la réalisation", zh: "从选择到执行" },
  s1:      { ar: "اختر الباقة", en: "Choose a package", fr: "Choisissez un forfait", zh: "选择套餐" },
  s1d:     { ar: "قارن بين الباقات وأضف الأنسب لمنشأتك إلى السلة.", en: "Compare packages and add the right one to your cart.", fr: "Comparez les forfaits et ajoutez le bon au panier.", zh: "对比套餐，将合适的加入购物车。" },
  s2:      { ar: "ادفع إلكترونياً", en: "Pay online", fr: "Payez en ligne", zh: "在线支付" },
  s2d:     { ar: "من السلة إلى صفحة الدفع الآمن، وتصلك الفاتورة الضريبية فور تأكيد الدفع.", en: "From the cart to secure checkout — your tax invoice arrives as soon as payment is confirmed.", fr: "Du panier au paiement sécurisé — votre facture fiscale arrive dès confirmation.", zh: "从购物车进入安全支付，确认付款后即收到税务发票。" },
  s3:      { ar: "يُسجَّل طلبك", en: "Your request is opened", fr: "Votre demande est ouverte", zh: "订单登记" },
  s3d:     { ar: "يظهر في «طلباتي» داخل حسابك، وتتابع حالته منه.", en: "It appears under “My orders” in your account, where you follow its status.", fr: "Elle apparaît dans « Mes commandes » de votre compte, où vous suivez son statut.", zh: "订单显示在账户的“我的订单”中，可在此跟踪状态。" },
  s4:      { ar: "نبدأ العمل", en: "We start work", fr: "Nous commençons", zh: "开始执行" },
  s4d:     { ar: "فريقنا يتولّى المنصات والإجراءات المشمولة بباقتك.", en: "Our team takes over the platforms and procedures your package covers.", fr: "Notre équipe prend en charge les plateformes et démarches de votre forfait.", zh: "我们的团队负责您套餐涵盖的平台与手续。" },
  terms:   { ar: "الأسعار أتعاب Business Partner فقط وغير شاملة ضريبة القيمة المضافة؛ الرسوم الحكومية (إن وجدت) منفصلة وتُسدَّد بتكلفتها الفعلية وتُعلن قبل البدء.",
             en: "Prices are Business Partner fees only and exclude VAT; government fees (if any) are separate, paid at actual cost and announced before we start.",
             fr: "Les prix correspondent aux seuls honoraires de Business Partner, hors TVA ; les frais gouvernementaux (le cas échéant) sont distincts, payés au coût réel et annoncés avant le début.",
             zh: "价格仅为 Business Partner 服务费，不含增值税；政府费用（如有）另计，按实际成本支付，并在开始前告知。" },
  notSure: { ar: "لست متأكداً أي باقة تناسبك؟", en: "Not sure which package fits?", fr: "Pas sûr du forfait qui vous convient ?", zh: "不确定哪个套餐适合您？" },
  notSureD:{ ar: "اشرح حالتك للمستشار الذكي ويرشّح لك الأنسب، أو احجز استشارة مع الفريق.",
             en: "Describe your case to the smart advisor and it recommends the best fit — or book a consultation with the team.",
             fr: "Décrivez votre cas au conseiller intelligent, il recommande le forfait adapté — ou réservez une consultation.",
             zh: "向智能顾问说明您的情况，它会推荐最合适的套餐——或预约团队咨询。" },
  single:  { ar: "تبحث عن خدمة منفردة؟ تصفّح كل الخدمات", en: "Looking for a single service? Browse all services", fr: "Un service à l'unité ? Parcourez tous les services", zh: "只需单项服务？浏览全部服务" },
  addedToast:{ ar: "أُضيفت الباقة إلى السلة", en: "Package added to your cart", fr: "Forfait ajouté au panier", zh: "套餐已加入购物车" },
  viewCart:{ ar: "عرض السلة ←", en: "View cart →", fr: "Voir le panier →", zh: "查看购物车 →" },
  cartFail:{ ar: "تعذّر حفظ السلة في هذا المتصفح. اطلب الباقة عبر المستشار الذكي بدلاً من ذلك.",
             en: "Your browser could not save the cart. Ask the smart advisor to request this package instead.",
             fr: "Ce navigateur n'a pas pu enregistrer le panier. Demandez plutôt ce forfait au conseiller.",
             zh: "此浏览器无法保存购物车。请改为通过智能顾问申请此套餐。" },
};

// الباب الذي يفتحه المستشار لكل مسار.
const DOOR = { management: "government", formation: "formation", legal: "consulting" };

export function buildSimplePackages(SV1, ctx) {
  const lang = ctx.lang();
  const ar = lang === "ar";
  const esc = ctx.esc;
  const site = ctx.site;
  const t = (k, v) => {
    const e = T[k]; let s = e[lang] != null ? e[lang] : e.en;
    if (v) for (const x of Object.keys(v)) s = s.split("{" + x + "}").join(v[x]);
    return s;
  };
  const home = lang === "en" ? "/" : "/" + lang + "/";
  const pre = lang === "en" ? "" : "/" + lang;
  const L = (a, e) => (ar ? a : e != null && e !== "" ? e : a);

  const groups = ((site.packages && site.packages.groups) || [])
    .filter((g) => g.tiers && g.tiers.length)
    .map((g) => ({
      key: g.key,
      tiers: g.tiers.map((p) => {
        const code = String(p.code || "").toUpperCase();
        const amount = p.amount != null && Number(p.amount) > 0 ? Number(p.amount) : null;
        const monthly = /شهري|monthly/i.test(p.priceEn || p.price || "");
        return {
          code, key: p.key, amount, monthly, highlight: !!p.highlight,
          nameAr: p.nameAr || p.name || "", nameEn: p.nameEn || p.name || p.nameAr || "",
          name: L(p.nameAr || p.name, p.nameEn || p.name),
          forTx: L(p.for, p.forEn),
          price: L(p.price, p.priceEn || p.price) || "",
          // الرسوم الإضافية: العربية للعربية والإنجليزية لغيرها. لا تُعرض لباقةٍ بلا
          // سعر (حسب الطلب)، ولا يُعرض نصٌّ إنجليزي في صفحة عربية.
          sur: amount != null ? (ar ? p.surcharge || "" : p.surchargeEn || p.surcharge || "") : "",
          featAr: p.features || [],
          featL: ar ? p.features || [] : p.featuresEn && p.featuresEn.length ? p.featuresEn : p.features || [],
          badge: p.highlight ? L(p.badgeAr, p.badgeEn) || t("badge") : "",
        };
      }),
    }));
  const total = groups.reduce((n, g) => n + g.tiers.length, 0);

  const check = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-11"/></svg>';
  const guestNote = (cls = "") => `<span class="sv1-pk-guest${cls}" data-guest-note>${esc(t("guest"))}</span>`;
  const priceHtml = (p) => p.amount != null
    ? `<span class="amt price-amt">${esc(p.price)}</span>${guestNote()}`
    : `<span class="amt">${esc(t("custom"))}</span>`;

  // ---------------------------------------------------------------- buttons --
  // كل زر شراء يحمل بياناته بنفسه؛ معالج واحد مفوَّض في الأسفل.
  const addBtn = (p, cls = "primary") => `<button type="button" class="sv1-btn ${cls} sv1-pk-add" data-track="أضف الباقة للسلة" data-code="${esc(p.code)}">${esc(t("addCart"))}</button>`;
  const askBtn = (p, g, label, cls = "ghost") => `<button type="button" class="sv1-btn ${cls} sv1-pk-ask" data-track="اسأل عن الباقة" data-code="${esc(p.code)}" data-group="${esc(g.key)}">${esc(label)}</button>`;

  // ------------------------------------------------------------------ cards --
  const card = (p, g) => {
    const vis = p.featL.slice(0, 4), rest = p.featL.slice(4);
    const li = (x) => `<li>${check}<span>${esc(x)}</span></li>`;
    const feats = g.tiers.length <= 2
      ? `<ul class="feat">${p.featL.map(li).join("")}</ul>`
      : `<ul class="feat">${vis.map(li).join("")}</ul>${rest.length ? `<details class="more"><summary>${esc(t("allFeat", { n: p.featL.length }))}</summary><ul class="feat">${p.featL.map(li).join("")}</ul></details>` : ""}`;
    return `<article class="sv1-pk${p.highlight ? " hl" : ""}" id="${esc(p.code.toLowerCase())}" data-code="${esc(p.code)}">
      ${p.badge ? `<span class="bdg">${esc(p.badge)}</span>` : ""}
      <h3>${esc(p.name)}</h3>
      ${p.forTx ? `<p class="for">${esc(p.forTx)}</p>` : ""}
      <div class="price">${priceHtml(p)}</div>
      ${feats}
      ${p.sur ? `<p class="sur"><b>${esc(t("extra"))}:</b> ${esc(p.sur)}</p>` : ""}
      <div class="acts">${addBtn(p, p.highlight ? "primary" : "")}${askBtn(p, g, t("askPk"), "ghost sm")}</div>
    </article>`;
  };
  const customCard = (p, g) => {
    const li = (x) => `<li>${check}<span>${esc(x)}</span></li>`;
    return `<article class="sv1-pk wide" id="${esc(p.code.toLowerCase())}" data-code="${esc(p.code)}">
      <div class="lft">
        <h3>${esc(p.name)}</h3>
        ${p.forTx ? `<p class="for">${esc(p.forTx)}</p>` : ""}
        <div class="price"><span class="amt">${esc(t("custom"))}</span></div>
        <p class="cd">${esc(t("customD"))}</p>
        <div class="acts">${askBtn(p, g, t("reqQuote"), "primary")}<a class="sv1-btn" href="${esc(pre)}/consultation?topic=other&amp;about=${encodeURIComponent(p.name)}" data-track="احجز استشارة — باقة حسب الطلب">${esc(t("book"))}</a></div>
      </div>
      <ul class="feat">${p.featL.map(li).join("")}</ul>
    </article>`;
  };

  // ------------------------------------------------------ comparison tables --
  // لا يُخترع شيء: الصفوف مشتقّة من نصوص المزايا نفسها.
  //  · خدمات: «كل ما في باقة X» تعني الوراثة صراحةً، فتُحسب المزايا الفعلية لكل
  //    باقة (ما كتبته + ما ورثته) ويُرسم جدول ✓/—. الصفّ مفتاحه النصّ العربي،
  //    فتتطابق الصفوف عبر اللغات حتى لو اختلفت صياغة الإنجليزية بين باقتين.
  //  · قانونية: «البند: القيمة» → صفٌّ لكل بند وخلية بقيمته.
  //  · تأسيس (باقتان): المزايا ليست بدرجة تفصيل واحدة (جمع في واحدة وتفصيل في
  //    الأخرى) فجدول ✓/— يوهم بنقصٍ غير موجود؛ تكفي بطاقتان بكل مزاياهما.
  const INHERIT_AR = /^كل ما في باقة /;
  const colHead = (p) => `<th scope="col"${p.highlight ? ' class="hl"' : ""}>${esc(p.name)}${p.badge ? `<small>${esc(p.badge)}</small>` : ""}</th>`;
  function factRows(g) {
    const rows = [];
    rows.push(`<tr><th scope="row">${esc(t("rowPrice"))}</th>${g.tiers.map((p) => `<td${p.highlight ? ' class="hl"' : ""}>${p.amount != null ? `<b class="price-amt">${esc(p.price)}</b>${guestNote()}` : `<b>${esc(t("custom"))}</b>`}</td>`).join("")}</tr>`);
    rows.push(`<tr><th scope="row">${esc(t("rowFor"))}</th>${g.tiers.map((p) => `<td${p.highlight ? ' class="hl"' : ""}>${esc(p.forTx || "—")}</td>`).join("")}</tr>`);
    if (g.tiers.some((p) => p.sur)) rows.push(`<tr><th scope="row">${esc(t("extra"))}</th>${g.tiers.map((p) => `<td class="sm${p.highlight ? " hl" : ""}">${esc(p.sur || "—")}</td>`).join("")}</tr>`);
    return rows;
  }
  function featRows(g) {
    const tiers = g.tiers;
    const cell = (hl, inner) => `<td class="c${hl ? " hl" : ""}">${inner}</td>`;
    const yes = `<span class="y" role="img" aria-label="${esc(t("yes"))}">${check}</span>`;
    const no = `<span class="n" role="img" aria-label="${esc(t("no"))}">—</span>`;
    // ‏خدمات: وراثة
    if (tiers.some((p) => p.featAr[0] && INHERIT_AR.test(p.featAr[0]))) {
      const eff = [];  // لكل باقة: Set من نصوص عربية
      const rows = []; const label = new Map();
      tiers.forEach((p, i) => {
        const own = new Set();
        p.featAr.forEach((f, j) => {
          if (INHERIT_AR.test(f) && i > 0) { eff[i - 1].forEach((x) => own.add(x)); return; }
          if (INHERIT_AR.test(f)) return;
          own.add(f);
          if (!label.has(f)) { rows.push(f); label.set(f, p.featL[j] || f); }
        });
        eff.push(own);
      });
      return rows.map((k) => `<tr><th scope="row">${esc(label.get(k))}</th>${tiers.map((p, i) => cell(p.highlight, eff[i].has(k) ? yes : no)).join("")}</tr>`);
    }
    // ‏قانونية: بند: قيمة
    const split = (s) => { const m = /^(.*?)\s*[:：]\s*(.+)$/.exec(s); return m ? [m[1], m[2]] : [s, null]; };
    const keyOf = (lab) => (/^تأسيس\//.test(lab) ? "__entity" : lab);
    const rows = [], label = new Map(), val = tiers.map(() => new Map());
    tiers.forEach((p, i) => p.featAr.forEach((f, j) => {
      const [kAr, vAr] = split(f); const k = keyOf(kAr);
      const [kL, vL] = split(p.featL[j] || f);
      if (!label.has(k)) { rows.push(k); label.set(k, k === "__entity" ? t("entity") : kL); }
      val[i].set(k, vAr == null ? true : (ar ? vAr : vL || vAr));
    }));
    return rows.map((k) => `<tr><th scope="row">${esc(label.get(k))}</th>${tiers.map((p, i) => cell(p.highlight, val[i].has(k) ? (val[i].get(k) === true ? yes : `<span class="v">${esc(val[i].get(k))}</span>`) : no)).join("")}</tr>`);
  }
  const table = (g) => {
    const withFeat = g.tiers.length > 2;
    const head = `<tr><th scope="col" class="corner"><span class="sr">${esc(t("cmp"))}</span></th>${g.tiers.map(colHead).join("")}</tr>`;
    const buy = `<tr class="buy"><th scope="row">${esc(t("rowAdd"))}</th>${g.tiers.map((p) => `<td${p.highlight ? ' class="hl"' : ""}>${p.amount != null ? addBtn(p, p.highlight ? "primary sm" : "sm") : askBtn(p, g, t("reqQuote"), "sm")}</td>`).join("")}</tr>`;
    const inclHd = withFeat ? `<tr class="sec"><th scope="colgroup" colspan="${g.tiers.length + 1}">${esc(t("rowIncl"))}</th></tr>` : "";
    return `<div class="sv1-pk-cmp" id="cmp-${esc(g.key)}">
      <h4>${esc(t("cmp"))} — ${esc(t("g_" + g.key))}</h4>
      <p class="sv1-muted hint">${esc(t("hint"))}</p>
      <div class="tw" tabindex="0" role="region" aria-label="${esc(t("cmp") + " — " + t("g_" + g.key))}"><table>
        <thead>${head}</thead>
        <tbody>${factRows(g).join("")}${inclHd}${withFeat ? featRows(g).join("") : ""}${buy}</tbody>
      </table></div>
    </div>`;
  };

  // --------------------------------------------------------------- sections --
  const section = (g) => {
    const priced = g.tiers.filter((p) => p.amount != null), custom = g.tiers.filter((p) => p.amount == null);
    const cols = priced.length >= 4 ? 4 : priced.length === 3 ? 3 : 2;
    return `<section class="sv1-sec sv1-pk-sec${g.key === "formation" ? " gray" : ""}" id="pkg-${esc(g.key)}"><div class="wrap">
      <div class="sv1-title"><span class="sv1-tag">${esc(t("nPk", { n: g.tiers.length }))}</span><h2>${esc(t("g_" + g.key))}</h2><p>${esc(t("d_" + g.key))}</p></div>
      <div class="sv1-pk-grid c${cols}">${priced.map((p) => card(p, g)).join("")}</div>
      ${custom.map((p) => customCard(p, g)).join("")}
      ${table(g)}
    </div></section>`;
  };

  const doorCards = groups.map((g, i) => {
    return `<a class="sv1-door${i === 0 ? " on" : ""}" href="#pkg-${esc(g.key)}" data-track="مسار الباقات: ${esc(g.key)}"><div class="ico">${["🧾", "🏢", "⚖️"][["management", "formation", "legal"].indexOf(g.key)] || "📦"}</div><h3>${esc(t("g_" + g.key))}</h3><p>${esc(t("nPk", { n: g.tiers.length }))}</p></a>`;
  }).join("");

  const steps = [1, 2, 3, 4].map((n) => `<div><i>${n}</i><b>${esc(t("s" + n))}</b><small>${esc(t("s" + n + "d"))}</small></div>`).join("");

  const body = `${SV1.header("/packages")}
  <main>
  <section class="sv1-hero sv1-pk-hero"><div class="wrap grid">
    <div>
      <span class="sv1-tag">${esc(t("tag", { n: total, g: groups.length }))}</span>
      <h1>${esc(t("h1"))}</h1>
      <p class="sv1-lead">${esc(t("desc"))}</p>
      <div class="sv1-actions">
        <a class="sv1-btn primary" href="#cmp-${esc((groups[0] || {}).key || "management")}" data-track="قارن الباقات">${esc(t("cmp"))}</a>
        <a class="sv1-btn" href="${esc(home)}#advisor" data-track="اسأل المستشار من الباقات">${esc(t("ask"))}</a>
      </div>
    </div>
    <div class="sv1-doors sv1-pk-doors">${doorCards}</div>
  </div></section>
  ${groups.map(section).join("")}
  <section class="sv1-sec"><div class="wrap">
    <div class="sv1-title"><h2>${esc(t("howT"))}</h2></div>
    <div class="sv1-pk-flow">${steps}</div>
    <p class="sv1-pk-terms">${esc(t("terms"))}</p>
  </div></section>
  <section class="sv1-sec sv1-gray"><div class="wrap">
    <div class="sv1-panel sv1-pk-help">
      <h4>${esc(t("notSure"))}</h4>
      <p>${esc(t("notSureD"))}</p>
      <div class="sv1-actions" style="justify-content:center">
        <a class="sv1-btn primary" href="${esc(home)}#advisor" data-track="اسأل المستشار — لست متأكداً">${esc(t("ask"))}</a>
        <a class="sv1-btn" href="${esc(pre)}/consultation" data-track="احجز استشارة — الباقات">${esc(t("book"))}</a>
      </div>
      <a class="sv1-browse" href="${esc(pre)}/catalog" data-track="تصفّح الخدمات المنفردة">${esc(t("single"))}</a>
    </div>
  </div></section>
  </main>
  <div class="sv1-pk-toast sv1-hide" id="pkToast" role="status" aria-live="polite"><span id="pkToastTx"></span><a id="pkToastCart" href="${esc(pre)}/cart">${esc(t("viewCart"))}</a></div>
${SV1.footer()}`;

  const CSS = `<style id="sv1-pk-css">
.sv1-pk-hero{padding:56px 0 48px}
.sv1-pk-hero h1{font-size:clamp(32px,4.6vw,52px)}
.sv1-pk-doors{grid-template-columns:1fr;gap:9px}
.sv1-pk-doors .sv1-door{display:flex;align-items:center;gap:14px;padding:14px 16px;width:100%}
.sv1-pk-doors .sv1-door .ico{flex:none}
.sv1-pk-doors .sv1-door h3{margin:0;font-size:16px}
.sv1-pk-doors .sv1-door p{margin:2px 0 0;font-size:12px}
.sv1-pk-doors .sv1-door>div:last-child,.sv1-pk-doors .sv1-door h3{flex:0 1 auto}
.sv1-pk-sec{scroll-margin-top:84px}
.sv1-pk-sec.gray{background:var(--g)}
.sv1-pk-grid{display:grid;gap:14px;align-items:stretch}
.sv1-pk-grid.c4{grid-template-columns:repeat(4,minmax(0,1fr))}
.sv1-pk-grid.c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.sv1-pk-grid.c2{grid-template-columns:repeat(2,minmax(0,1fr));max-width:860px;margin-inline:auto}
.sv1-pk{position:relative;display:flex;flex-direction:column;gap:10px;background:#fff;border:1px solid var(--l);border-radius:16px;padding:22px 20px 20px;box-shadow:var(--sh);min-width:0}
.sv1-pk.hl{border-color:var(--ac);box-shadow:var(--sh2)}
.sv1-pk .bdg{position:absolute;top:-11px;inset-inline-start:18px;background:var(--ac);color:#fff;font-size:11px;font-weight:600;padding:3px 12px;border-radius:999px}
.sv1-pk h3{font-size:18px;margin:0;font-weight:500;line-height:1.4}
.sv1-pk .for{margin:0;font-size:12.5px;color:var(--mut)}
.sv1-pk .price{min-height:34px;display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
.sv1-pk .amt{font-size:21px;font-weight:500;color:var(--ink);font-family:var(--fm);line-height:1.35}
.sv1-pk-guest{font-size:12px;color:var(--faint)}
.sv1-pk .feat{list-style:none;margin:4px 0 0;padding:0;display:grid;gap:7px}
.sv1-pk .feat li{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.65;color:var(--t)}
.sv1-pk .feat svg{flex:none;margin-top:3px;color:var(--ok)}
.sv1-pk .more{margin-top:2px}
.sv1-pk .more summary{cursor:pointer;font-size:12.5px;font-weight:600;color:var(--ac);list-style:none;padding:4px 0}
.sv1-pk .more summary::-webkit-details-marker{display:none}
.sv1-pk .more[open] summary{margin-bottom:8px}
.sv1-pk .more[open]>.feat:first-of-type{margin-top:0}
.sv1-pk .sur{margin:0;font-size:12px;color:var(--mut);line-height:1.7;background:var(--soft);border-radius:9px;padding:8px 10px}
.sv1-pk .acts{display:flex;flex-direction:column;gap:7px;margin-top:auto;padding-top:8px}
.sv1-pk .acts .sv1-btn{width:100%}
.sv1-btn.ghost{background:transparent}
.sv1-btn.ghost.sm{border-color:transparent;color:var(--ac);text-decoration:underline;text-underline-offset:3px;padding:5px 8px}
.sv1-pk.wide{margin-top:14px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:22px;border-style:dashed}
.sv1-pk.wide .lft{display:flex;flex-direction:column;gap:10px}
.sv1-pk.wide .cd{margin:0;font-size:13px;color:var(--s);line-height:1.8}
.sv1-pk.wide .acts{flex-direction:row;flex-wrap:wrap;margin-top:6px}
.sv1-pk.wide .acts .sv1-btn{width:auto}
.sv1-pk.wide .feat{margin:0;grid-template-columns:1fr 1fr;gap:9px 18px;align-content:start}
.sv1-pk-cmp{margin-top:34px}
.sv1-pk-cmp h4{margin:0 0 4px;font-size:16px;font-weight:500;color:var(--ink)}
.sv1-pk-cmp .hint{display:none;margin:0 0 8px}
.sv1-pk-cmp .tw{overflow-x:auto;border:1px solid var(--l);border-radius:14px;background:#fff;-webkit-overflow-scrolling:touch}
.sv1-pk-cmp table{border-collapse:separate;border-spacing:0;width:100%;min-width:640px;font-size:13px}
.sv1-pk-cmp th,.sv1-pk-cmp td{padding:11px 14px;border-bottom:1px solid var(--line2);text-align:start;vertical-align:top;line-height:1.65}
.sv1-pk-cmp thead th{background:var(--g);color:var(--ink);font-weight:600;font-size:13.5px;position:sticky;top:0}
.sv1-pk-cmp thead th small{display:block;font-weight:500;font-size:10.5px;color:var(--ac);margin-top:1px}
.sv1-pk-cmp tbody th[scope=row]{font-weight:500;color:var(--ink);background:#fff;position:sticky;inset-inline-start:0;min-width:160px;max-width:230px;z-index:1;border-inline-end:1px solid var(--line2)}
.sv1-pk-cmp thead th.corner{position:sticky;inset-inline-start:0;z-index:2}
.sv1-pk-cmp td.hl,.sv1-pk-cmp th.hl{background:var(--acSoft)}
.sv1-pk-cmp td.sm{font-size:12px;color:var(--mut)}
.sv1-pk-cmp td.c{text-align:center}
.sv1-pk-cmp .y{color:var(--ok);display:inline-flex}
.sv1-pk-cmp .n{color:#B7BECE}
.sv1-pk-cmp .v{font-weight:500;color:var(--ink)}
.sv1-pk-cmp tr.sec th{background:var(--soft);font-size:12px;color:var(--mut);font-weight:700;position:static;border-inline-end:0}
.sv1-pk-cmp tr.buy td,.sv1-pk-cmp tr.buy th{border-bottom:0;vertical-align:middle}
.sv1-pk-cmp tr.buy td .sv1-btn{width:100%;white-space:normal}
.sv1-pk-cmp .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.sv1-pk-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.sv1-pk-flow>div{background:#fff;border:1px solid var(--l);border-radius:14px;padding:18px;box-shadow:var(--sh)}
.sv1-pk-flow i{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--ac);color:#fff;font-style:normal;font-size:12.5px;font-weight:600;margin-bottom:8px}
.sv1-pk-flow b{display:block;color:var(--ink);font-weight:500;font-size:14.5px}
.sv1-pk-flow small{display:block;color:var(--mut);font-size:12.5px;line-height:1.75;margin-top:4px}
.sv1-pk-terms{max-width:760px;margin:20px auto 0;text-align:center;font-size:12px;color:var(--mut);line-height:1.9}
.sv1-pk-help{text-align:center;max-width:680px;margin:0 auto;padding:28px 22px}
.sv1-pk-help h4{font-size:19px;font-weight:400;margin:0 0 6px}
.sv1-pk-help p{margin:0 0 14px;color:var(--mut);font-size:14px;line-height:1.85}
.sv1-pk-toast{position:fixed;inset-inline:0;top:84px;margin-inline:auto;width:max-content;max-width:calc(100vw - 28px);z-index:2147483100;background:var(--ink);color:#fff;border-radius:12px;padding:11px 16px;font-size:13px;font-weight:600;box-shadow:0 10px 28px rgba(11,27,90,.3);display:flex;gap:14px;align-items:center}
.sv1-pk-toast.err{background:#8a1c1c}
.sv1-pk-toast a{color:#fff;text-decoration:underline;white-space:nowrap}
@media(max-width:1020px){.sv1-pk-grid.c4{grid-template-columns:repeat(2,minmax(0,1fr))}.sv1-pk-flow{grid-template-columns:repeat(2,minmax(0,1fr))}.sv1-pk.wide{grid-template-columns:1fr}}
@media(max-width:820px){.sv1-pk-hero .grid{grid-template-columns:1fr}.sv1-pk-grid.c3{grid-template-columns:1fr}}
@media(max-width:620px){.sv1-pk-hero{padding:38px 0 30px}.sv1-pk-grid.c4,.sv1-pk-grid.c2{grid-template-columns:1fr}.sv1-pk.wide .feat{grid-template-columns:1fr}.sv1-pk-flow{grid-template-columns:1fr}.sv1-pk-cmp .hint{display:block}.sv1-pk-cmp tbody th[scope=row]{min-width:128px;max-width:150px;font-size:12px}.sv1-pk-cmp th,.sv1-pk-cmp td{padding:9px 10px}.sv1-pk-sec{padding:44px 0}}
</style>`;

  // سلّةٌ بالعقد نفسه الذي تكتبه صفحات الكتالوج والخدمات: المفتاح bp_cart،
  // amount رقم، price نصّ عرض لا يُقرأ حسابياً، وتكرار الإضافة يزيد qty.
  const PKGS = {};
  for (const g of groups) for (const p of g.tiers) {
    PKGS[p.code] = {
      id: "pkg-" + p.code.toLowerCase(), nameAr: p.nameAr, nameEn: p.nameEn, amount: p.amount,
      price: p.price, monthly: p.monthly, title: p.name, group: g.key, door: DOOR[g.key] || "consulting",
    };
  }
  const TX = { added: t("added"), addCart: t("addCart"), addedToast: t("addedToast"), cartFail: t("cartFail") };

  const script = `<script>
(function(){
var PK=${JSON.stringify(PKGS)},TX=${JSON.stringify(TX)},HOME=${JSON.stringify(home)};
var $=function(id){return document.getElementById(id)};
function cartAdd(p){
 var c;
 try{c=JSON.parse(localStorage.getItem('bp_cart'))||[];if(!Array.isArray(c))c=[]}catch(e){c=[]}
 var ex=c.filter(function(x){return x.id===p.id})[0];
 if(ex)ex.qty=(ex.qty||1)+1;
 else c.push({id:p.id,nameEn:p.nameEn,nameAr:p.nameAr,amount:Number(p.amount),price:p.price,kind:'package',qty:1,
  surchargeAmount:null,surchargeFreeCount:null,pricePublic:0,billingPeriod:p.monthly?'monthly':'',renewsAt:null,commissionPercent:0});
 try{localStorage.setItem('bp_cart',JSON.stringify(c))}catch(e){return false}
 try{document.dispatchEvent(new CustomEvent('bp:cart',{bubbles:true}))}catch(e){}
 return true;
}
var tt=0;
function toast(msg,err,link){
 var bx=$('pkToast');$('pkToastTx').textContent=msg;$('pkToastCart').style.display=link?'':'none';
 bx.classList.toggle('err',!!err);bx.classList.remove('sv1-hide');
 clearTimeout(tt);tt=setTimeout(function(){bx.classList.add('sv1-hide')},4200);
}
// تسليم إلى محادثة الرئيسية (عقد bp_sva_request نفسه في الكتالوج): الباقة تصير نطاق الطلب.
function handoff(p,code){
 try{sessionStorage.setItem('bp_sva_request',JSON.stringify({items:[{code:code,title:p.title,why:''}],door:p.door,text:p.title,name:p.title,code:code,at:Date.now()}))}catch(e){}
 location.href=HOME+'#advisor';
}
document.addEventListener('click',function(e){
 var b=e.target.closest&&e.target.closest('button[data-code]');if(!b)return;
 var code=b.getAttribute('data-code'),p=PK[code];if(!p)return;
 if(b.classList.contains('sv1-pk-add')){
  if(!p.amount)return;
  if(!cartAdd(p)){toast(TX.cartFail,true,false);return}
  var old=b.textContent;b.textContent=TX.added;setTimeout(function(){b.textContent=old},1600);
  toast(TX.addedToast,false,true);
 }else if(b.classList.contains('sv1-pk-ask')){handoff(p,code)}
});
// المسار النشط في بطاقات الأبواب يتبع القسم المعروض.
var doors=document.querySelectorAll('.sv1-pk-doors .sv1-door');
if('IntersectionObserver' in window&&doors.length){
 var io=new IntersectionObserver(function(es){es.forEach(function(en){if(!en.isIntersecting)return;
  doors.forEach(function(d){d.classList.toggle('on',d.getAttribute('href')==='#'+en.target.id)})})},{rootMargin:'-35% 0px -55% 0px'});
 document.querySelectorAll('.sv1-pk-sec').forEach(function(s){io.observe(s)});
}
})();</script>`;

  return SV1.shell({
    title: `${t("title")} — Business Partner`,
    desc: t("desc"),
    path: "/packages",
    body: CSS + body,
    script,
  });
}
