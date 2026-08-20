/* Business Partner — site interactions (no framework) */
(function () {
  "use strict";

  // Mobile navigation toggle
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen);
      document.body.classList.toggle("nav-open", isOpen);
    });
  }

  // FAQ accordion
  document.addEventListener("click", function (e) {
    var q = e.target.closest(".faq-q");
    if (!q) return;
    var item = q.closest(".faq-item");
    item.classList.toggle("open");
    q.setAttribute("aria-expanded", item.classList.contains("open"));
  });

  // Cost calculator
  var calc = document.getElementById("calc");
  if (calc && window.BP_SERVICES) {
    var services = window.BP_SERVICES;
    var sel = document.getElementById("calc-service");
    var qtyEl = document.getElementById("calc-qty");
    var VAT = 0.15;

    // Group services by category into optgroups
    var byCat = {};
    services.forEach(function (s) {
      (byCat[s.categoryAr] = byCat[s.categoryAr] || []).push(s);
    });
    Object.keys(byCat).forEach(function (cat) {
      var og = document.createElement("optgroup");
      og.label = cat;
      byCat[cat].forEach(function (s) {
        var o = document.createElement("option");
        o.value = s.code;
        o.textContent = s.name;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });

    var elFee = document.getElementById("calc-fee");
    var elVat = document.getElementById("calc-vat");
    var elTotal = document.getElementById("calc-total");
    var elNote = document.getElementById("calc-extra-note");
    var elGov = document.getElementById("calc-gov");
    var waBtn = document.getElementById("calc-wa");
    var waBase = waBtn ? waBtn.getAttribute("data-wa") : "#";

    function money(n) {
      return n.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " ﷼";
    }

    function update() {
      var s = services.find(function (x) { return x.code === sel.value; });
      if (!s) return;
      var qty = Math.max(1, parseInt(qtyEl.value, 10) || 1);
      var amount = s.price.amount;

      if (amount == null) {
        elFee.textContent = "—";
        elVat.textContent = "—";
        elTotal.textContent = s.price.label;
        elNote.textContent = "هذه الخدمة تُسعّر بعرض مخصّص حسب حالتك. تواصل معنا لعرض دقيق.";
        elGov.style.display = "none";
      } else {
        var fee = amount * qty;
        var vat = fee * VAT;
        elFee.textContent = money(fee);
        elVat.textContent = money(vat);
        elTotal.textContent = money(fee + vat);
        elNote.textContent = qty > 1 ? "الأتعاب مضروبة في العدد المطلوب." : "";
        elGov.style.display = s.govFeesSeparate ? "flex" : "none";
      }
      if (waBtn) {
        var msg = "مرحباً، أرغب بمعرفة تفاصيل خدمة: " + s.name + " (" + s.code + ")";
        waBtn.href = waBase; // primary short link; message hint shown in UI
        waBtn.setAttribute("data-msg", msg);
      }
    }

    sel.addEventListener("change", update);
    qtyEl.addEventListener("input", update);

    // Preselect from ?service= query
    var params = new URLSearchParams(location.search);
    var pre = params.get("service");
    if (pre && services.some(function (x) { return x.code === pre; })) sel.value = pre;
    update();
  }
})();

/* ---------- Language context (fixed per URL tree: / = EN, /ar/ = AR) ---------- */
var BP = window.BP = window.BP || {};
(function () {
  "use strict";
  // Language is decided at build time (separate EN and AR page trees); read it from the document.
  BP.lang = (document.documentElement.lang || "en").toLowerCase().indexOf("ar") === 0 ? "ar" : "en";
  BP.t = function (en, ar) { return BP.lang === "ar" ? ar : en; };
  BP.money = function (n) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " ﷼"; };
  // Owner policy: never reveal any price anywhere (set via data-prices="off" on <html>).
  BP.pricesOn = document.documentElement.getAttribute("data-prices") !== "off";
  // Canonical Field/sector taxonomy — must stay in sync with generate.mjs's
  // FIELD_TAXONOMY, api/candidates.js's FIELD_OPTIONS and api/candidate.js's
  // guessField() classifier. [arabic value, english label] — the Arabic
  // string is always the stored/filtered value; the label shown flips with
  // BP.lang so filter dropdowns built at runtime (fillFilters()) localize
  // correctly instead of showing raw Arabic values on English pages.
  BP.FIELD_TAXONOMY = [
    ["هندسة", "Engineering"], ["تقنية معلومات", "IT & Software"], ["مبيعات وتسويق", "Sales & Marketing"],
    ["محاسبة ومالية", "Accounting & Finance"], ["إداري وسكرتارية", "Admin & Secretarial"], ["موارد بشرية", "Human Resources"],
    ["ضيافة وسياحة", "Hospitality & Tourism"], ["مقاولات وإنشاءات", "Construction"], ["عقارات", "Real Estate"],
    ["صحة وطب", "Health & Medical"], ["تعليم", "Education"], ["لوجستيات ونقل", "Logistics & Transportation"],
    ["قانون", "Legal"], ["تصنيع وصناعة", "Manufacturing & Industrial"], ["طاقة ونفط وغاز", "Energy, Oil & Gas"],
    ["إعلام وإبداع", "Media & Creative"], ["حكومي وقطاع عام", "Government & Public Sector"], ["زراعة وبيئة", "Agriculture & Environment"],
    ["تجزئة وتجارة إلكترونية", "Retail & E-commerce"], ["أمن وسلامة", "Security & Safety"], ["حرف مهنية وصيانة", "Skilled Trades & Maintenance"],
    ["علوم وأبحاث", "Science & Research"], ["طيران وبحري", "Aviation & Maritime"], ["تجميل وعناية", "Beauty & Wellness"],
    ["خدمات منزلية", "Domestic & Household Services"], ["أخرى", "Other"],
  ];
})();

/* ---------- Cart (localStorage) ---------- */
(function () {
  "use strict";
  var KEY = "bp_cart";
  var VAT = 0.15;
  // Owner policy: never reveal any price. When prices are off the cart is a
  // request basket — line items and totals show "quoted", never an amount.
  var PRICES_ON = document.documentElement.getAttribute("data-prices") !== "off";

  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function write(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} updateBadge(); }
  BP.cart = { read: read, write: write };

  function count() { return read().reduce(function (n, i) { return n + (i.qty || 1); }, 0); }
  function subtotal() { return read().reduce(function (s, i) { return s + (i.amount ? i.amount * (i.qty || 1) : 0); }, 0); }
  function hasQuoteItems() { return read().some(function (i) { return !i.amount; }); }

  function updateBadge() {
    var b = document.getElementById("cart-badge");
    if (!b) return;
    var c = count();
    b.textContent = c;
    b.hidden = c === 0;
  }

  function itemFromBtn(btn) {
    var a = btn.getAttribute("data-amount");
    var surA = btn.getAttribute("data-surcharge-amount");
    var surF = btn.getAttribute("data-surcharge-free");
    return {
      id: btn.getAttribute("data-id"),
      nameEn: btn.getAttribute("data-name-en") || "",
      nameAr: btn.getAttribute("data-name-ar") || "",
      amount: a ? Number(a) : null,
      price: btn.getAttribute("data-price") || "",
      kind: btn.getAttribute("data-kind") || "service",
      qty: 1,
      surchargeAmount: surA ? Number(surA) : null,
      surchargeFreeCount: surF ? Number(surF) : null,
    };
  }

  function add(item) {
    var c = read();
    var ex = c.find(function (x) { return x.id === item.id; });
    if (ex) ex.qty = (ex.qty || 1) + 1;
    else c.push(item);
    write(c);
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "bp-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("show"); }, 10);
    setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.remove(); }, 300); }, 2200);
  }

  document.addEventListener("click", function (e) {
    var addBtn = e.target.closest(".add-cart");
    if (addBtn) {
      add(itemFromBtn(addBtn));
      toast(BP.t("Added to cart ✓", "أُضيفت إلى السلة ✓"));
    }
  });

  function name(i) { return (BP.lang === "ar" ? i.nameAr : i.nameEn) || i.nameAr || i.nameEn; }

  function renderCart() {
    var wrap = document.getElementById("cart-items");
    if (!wrap) return;
    var c = read();
    var empty = document.getElementById("cart-empty");
    if (!c.length) { wrap.innerHTML = ""; if (empty) empty.hidden = false; }
    else {
      if (empty) empty.hidden = true;
      wrap.innerHTML = c.map(function (i, idx) {
        var priceTxt = (PRICES_ON && i.amount) ? BP.money(i.amount) : BP.t("Quoted on review", "يُسعّر عند المراجعة");
        return '<div class="cart-item">' +
          '<div class="ci-main"><strong>' + esc(name(i)) + '</strong><span class="ci-kind">' + kindLabel(i.kind) + '</span></div>' +
          '<div class="ci-qty"><button type="button" class="ci-dec" data-i="' + idx + '">−</button><span>' + (i.qty || 1) + '</span><button type="button" class="ci-inc" data-i="' + idx + '">+</button></div>' +
          '<div class="ci-price">' + esc(priceTxt) + '</div>' +
          '<button type="button" class="ci-del" data-i="' + idx + '" aria-label="remove">✕</button>' +
          '</div>';
      }).join("");
    }
    renderTotals("cart-subtotal", "cart-vat", "cart-total");
    // Registration is required before payment: if the visitor isn't signed in,
    // the checkout button takes them to register/sign in first (then back to checkout).
    var co = document.getElementById("cart-checkout");
    if (co) {
      var signed = false; try { signed = !!JSON.parse(localStorage.getItem("bp_session") || "null"); } catch (e) {}
      var note = document.getElementById("cart-signin-note");
      if (c.length && !signed) {
        co.setAttribute("href", (BP.lang === "ar" ? "/ar/account" : "/account") + "?redirect=checkout");
        co.textContent = BP.t("Sign in / register to check out", "سجّل الدخول أو أنشئ حساباً لإتمام الطلب");
        if (note) note.hidden = false;
      } else {
        co.setAttribute("href", BP.lang === "ar" ? "/ar/checkout" : "/checkout");
        co.textContent = BP.t("Checkout", "إتمام الطلب");
        if (note) note.hidden = true;
      }
    }
  }

  function kindLabel(k) {
    var m = { service: ["Service", "خدمة"], package: ["Package", "باقة"], agent: ["AI agent", "وكيل ذكي"], employee: ["AI employee", "موظف ذكي"], misa: ["Investor track", "مسار مستثمر"], trip: ["Trip", "رحلة"] };
    var p = m[k] || m.service;
    return BP.t(p[0], p[1]);
  }

  function renderTotals(subId, vatId, totId) {
    function set0(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
    if (!PRICES_ON) {
      var q0 = BP.t("Quoted on review", "يُسعّر عند المراجعة");
      set0(subId, q0); set0(vatId, "—"); set0(totId, q0);
      return;
    }
    var extra = (typeof BP.extraCheckoutFee === "function") ? (BP.extraCheckoutFee() || 0) : 0;
    var sub = subtotal() + extra, vat = sub * VAT, tot = sub + vat;
    var q = hasQuoteItems();
    var suffix = q ? (" + " + BP.t("quoted items", "بنود تُسعّر")) : "";
    set(subId, sub ? BP.money(sub) : (q ? BP.t("Quoted", "تُسعّر") : "—"));
    set(vatId, sub ? BP.money(vat) : "—");
    set(totId, (sub ? BP.money(tot) : (q ? BP.t("Quoted on review", "يُسعّر عند المراجعة") : "—")) );
    function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // cart item qty/delete
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.classList.contains("ci-del") || t.classList.contains("ci-inc") || t.classList.contains("ci-dec")) {
      var i = parseInt(t.getAttribute("data-i"), 10);
      var c = read();
      if (!c[i]) return;
      if (t.classList.contains("ci-del")) c.splice(i, 1);
      else if (t.classList.contains("ci-inc")) c[i].qty = (c[i].qty || 1) + 1;
      else { c[i].qty = (c[i].qty || 1) - 1; if (c[i].qty < 1) c.splice(i, 1); }
      write(c);
      renderCart();
      renderCheckout();
    }
  });

  function renderCheckout() {
    var wrap = document.getElementById("checkout-items");
    if (!wrap) return;
    var c = read();
    wrap.innerHTML = c.length ? c.map(function (i) {
      var priceTxt = (PRICES_ON && i.amount) ? BP.money(i.amount * (i.qty || 1)) : BP.t("Quoted on review", "يُسعّر عند المراجعة");
      return '<div class="co-line"><span>' + esc(name(i)) + ' ×' + (i.qty || 1) + '</span><span>' + esc(priceTxt) + '</span></div>';
    }).join("") : '<p class="text-soft">' + BP.t("Cart is empty.", "السلة فارغة.") + '</p>';
    renderTotals("co-subtotal", "co-vat", "co-total");
  }

  BP.renderCart = renderCart;
  BP.renderCheckout = renderCheckout;
  BP.cartName = name;

  document.addEventListener("DOMContentLoaded", function () { updateBadge(); renderCart(); renderCheckout(); });
  document.addEventListener("bp:langchange", function () { updateBadge(); renderCart(); renderCheckout(); });
})();

/* ---------- File-drop labels ---------- */
(function () {
  "use strict";
  function bind(inputId, labelId) {
    var inp = document.getElementById(inputId), lbl = document.getElementById(labelId);
    if (!inp || !lbl) return;
    inp.addEventListener("change", function () {
      if (!inp.files || !inp.files.length) return;
      var names = [];
      for (var i = 0; i < inp.files.length; i++) names.push(inp.files[i].name);
      lbl.textContent = "📎 " + names.join(", ");
      lbl.closest(".file-drop").classList.add("has-file");
    });
  }
  document.addEventListener("DOMContentLoaded", function () {
    bind("c-cv", "cv-filename");
    bind("co-docs", "docs-filename");
    bind("co-receipt", "receipt-filename");
  });
})();

/* ---------- Searchable combobox (job titles / cities / experience) ---------- */
(function () {
  "use strict";

  var JOB_TITLES = [
    ["Accountant", "محاسب"], ["Senior Accountant", "محاسب أول"], ["Chief Accountant", "رئيس حسابات"],
    ["Financial Analyst", "محلل مالي"], ["Finance Manager", "مدير مالي"], ["CFO", "المدير المالي التنفيذي"],
    ["Auditor", "مدقق حسابات"], ["Internal Auditor", "مدقق داخلي"], ["Bookkeeper", "مُمسك دفاتر"],
    ["Payroll Specialist", "أخصائي رواتب"], ["Treasury Analyst", "محلل خزينة"], ["Credit Controller", "مراقب ائتمان"],
    ["Software Engineer", "مهندس برمجيات"], ["Frontend Developer", "مطوّر واجهات أمامية"], ["Backend Developer", "مطوّر خلفي"],
    ["Full Stack Developer", "مطوّر متكامل"], ["Mobile App Developer", "مطوّر تطبيقات جوال"], ["DevOps Engineer", "مهندس DevOps"],
    ["QA Engineer", "مهندس ضمان جودة"], ["Data Analyst", "محلل بيانات"], ["Data Scientist", "عالم بيانات"],
    ["Data Engineer", "مهندس بيانات"], ["Machine Learning Engineer", "مهندس تعلّم آلي"], ["IT Support Specialist", "أخصائي دعم تقني"],
    ["Network Engineer", "مهندس شبكات"], ["System Administrator", "مدير أنظمة"], ["Database Administrator", "مدير قواعد بيانات"],
    ["Cybersecurity Analyst", "محلل أمن سيبراني"], ["IT Manager", "مدير تقنية معلومات"], ["Product Manager", "مدير منتج"],
    ["UI/UX Designer", "مصمم UI/UX"], ["Solutions Architect", "معماري حلول"], ["Cloud Engineer", "مهندس سحابة"],
    ["Sales Representative", "مندوب مبيعات"], ["Sales Executive", "تنفيذي مبيعات"], ["Sales Manager", "مدير مبيعات"],
    ["Business Development Manager", "مدير تطوير أعمال"], ["Account Manager", "مدير حسابات عملاء"], ["Retail Sales Associate", "مساعد مبيعات تجزئة"],
    ["Marketing Specialist", "أخصائي تسويق"], ["Marketing Manager", "مدير تسويق"], ["Digital Marketing Specialist", "أخصائي تسويق رقمي"],
    ["Social Media Manager", "مدير سوشيال ميديا"], ["Content Creator", "صانع محتوى"], ["SEO Specialist", "أخصائي SEO"],
    ["Brand Manager", "مدير علامة تجارية"], ["Public Relations Officer", "مسؤول علاقات عامة"], ["Graphic Designer", "مصمم جرافيك"],
    ["Customer Service Representative", "ممثل خدمة عملاء"], ["Call Center Agent", "موظف مركز اتصال"], ["Receptionist", "موظف استقبال"],
    ["Administrative Assistant", "مساعد إداري"], ["Executive Secretary", "سكرتير تنفيذي"], ["Office Manager", "مدير مكتب"],
    ["Data Entry Clerk", "مُدخل بيانات"], ["Personal Assistant", "مساعد شخصي"], ["Procurement Officer", "مسؤول مشتريات"],
    ["HR Specialist", "أخصائي موارد بشرية"], ["HR Manager", "مدير موارد بشرية"], ["Recruiter", "أخصائي توظيف"],
    ["Talent Acquisition Specialist", "أخصائي استقطاب مواهب"], ["Training & Development Officer", "مسؤول تدريب وتطوير"], ["Compensation & Benefits Specialist", "أخصائي تعويضات ومزايا"],
    ["Chef", "شيف"], ["Sous Chef", "مساعد شيف"], ["Pastry Chef", "شيف حلويات"], ["Kitchen Assistant", "مساعد مطبخ"],
    ["Waiter / Waitress", "نادل / نادلة"], ["Barista", "باريستا"], ["Restaurant Manager", "مدير مطعم"],
    ["Hotel Manager", "مدير فندق"], ["Front Office Agent", "موظف استقبال فندقي"], ["Housekeeping Supervisor", "مشرف تدبير منزلي"],
    ["Guest Relations Officer", "مسؤول علاقات نزلاء"], ["Event Coordinator", "منسّق فعاليات"], ["Bartender", "ساقي مشروبات"],
    ["Civil Engineer", "مهندس مدني"], ["Mechanical Engineer", "مهندس ميكانيكي"], ["Electrical Engineer", "مهندس كهربائي"],
    ["Structural Engineer", "مهندس إنشائي"], ["Site Engineer", "مهندس موقع"], ["Project Manager", "مدير مشروع"],
    ["Construction Manager", "مدير مقاولات"], ["Quantity Surveyor", "مساح كميات"], ["Architect", "مهندس معماري"],
    ["Safety Officer (HSE)", "مسؤول سلامة (HSE)"], ["Foreman", "مقدم عمال"], ["Surveyor", "مساح"],
    ["Physician", "طبيب"], ["General Practitioner", "طبيب عام"], ["Dentist", "طبيب أسنان"], ["Pharmacist", "صيدلي"],
    ["Registered Nurse", "ممرض/ة مسجّل/ة"], ["Nursing Assistant", "مساعد تمريض"], ["Physiotherapist", "أخصائي علاج طبيعي"],
    ["Lab Technician", "فني مختبر"], ["Radiologist", "أخصائي أشعة"], ["Medical Secretary", "سكرتير طبي"],
    ["Teacher", "معلّم/ة"], ["Kindergarten Teacher", "معلّم/ة رياض أطفال"], ["English Teacher", "معلّم/ة لغة إنجليزية"],
    ["Math Teacher", "معلّم/ة رياضيات"], ["School Principal", "مدير مدرسة"], ["Academic Advisor", "مرشد أكاديمي"],
    ["Curriculum Coordinator", "منسّق مناهج"], ["Tutor", "معلّم خصوصي"],
    ["Truck Driver", "سائق شاحنة"], ["Delivery Driver", "سائق توصيل"], ["Warehouse Supervisor", "مشرف مستودع"],
    ["Logistics Coordinator", "منسّق لوجستيات"], ["Supply Chain Manager", "مدير سلسلة إمداد"], ["Fleet Manager", "مدير أسطول"],
    ["Forklift Operator", "مشغّل رافعة شوكية"], ["Shipping & Customs Clerk", "موظف شحن وجمارك"],
    ["Legal Counsel", "مستشار قانوني"], ["Lawyer", "محامٍ"], ["Paralegal", "مساعد قانوني"], ["Compliance Officer", "مسؤول امتثال"],
    ["Operations Manager", "مدير عمليات"], ["General Manager", "مدير عام"], ["Managing Director", "مدير تنفيذي"],
    ["Store Manager", "مدير متجر"], ["Cashier", "أمين صندوق"], ["Merchandiser", "أخصائي عرض بضائع"],
    ["Security Guard", "حارس أمن"], ["Cleaner / Housekeeper", "عامل نظافة"], ["Driver", "سائق"],
    ["Electrician", "كهربائي"], ["Plumber", "سبّاك"], ["Technician", "فني"], ["Mechanic", "ميكانيكي"],
    ["Photographer", "مصوّر"], ["Video Editor", "محرر فيديو"], ["Translator", "مترجم"], ["Interpreter", "مترجم فوري"],
    ["Real Estate Agent", "وسيط عقاري"], ["Insurance Agent", "وكيل تأمين"], ["Bank Teller", "موظف صراف بنك"],
    ["Relationship Manager (Banking)", "مدير علاقات مصرفي"], ["Investment Analyst", "محلل استثمار"],
    // Additional coverage across the same 12 fields — the box still accepts
    // free typing for anything not listed here, this just widens the presets.
    ["VAT / Tax Specialist", "أخصائي ضرائب وقيمة مضافة"], ["Zakat & Tax Officer", "موظف زكاة وضريبة"],
    ["Budget Analyst", "محلل ميزانية"], ["Cost Accountant", "محاسب تكاليف"], ["AR/AP Accountant", "محاسب ذمم"],
    ["Financial Controller", "مراقب مالي"], ["Risk Analyst", "محلل مخاطر"], ["Actuary", "خبير اكتواري"],
    ["Game Developer", "مطوّر ألعاب"], ["Embedded Systems Engineer", "مهندس أنظمة مدمجة"], ["ERP Consultant (SAP/Oracle)", "استشاري أنظمة ERP"],
    ["Business Intelligence Analyst", "محلل ذكاء أعمال"], ["Site Reliability Engineer", "مهندس موثوقية أنظمة"], ["IT Auditor", "مدقق تقنية معلومات"],
    ["Penetration Tester", "مختبر اختراق"], ["Technical Writer", "كاتب تقني"], ["Scrum Master / Agile Coach", "مدرّب Scrum / Agile"],
    ["Key Account Manager", "مدير حسابات رئيسية"], ["Telesales Agent", "مندوب مبيعات هاتفي"], ["E-commerce Manager", "مدير تجارة إلكترونية"],
    ["Category Manager", "مدير فئة منتجات"], ["Franchise Manager", "مدير امتياز تجاري"], ["Export Sales Manager", "مدير مبيعات تصدير"],
    ["Copywriter", "كاتب محتوى إعلاني"], ["Media Buyer", "مشتري إعلانات"], ["Growth Marketing Manager", "مدير تسويق نمو"],
    ["Community Manager", "مدير مجتمع رقمي"], ["Market Research Analyst", "محلل أبحاث سوق"], ["Events Manager", "مدير فعاليات"],
    ["Government Relations Officer", "أخصائي علاقات حكومية"], ["Office Boy / Office Girl", "عامل خدمات مكتبية"],
    ["Facilities Manager", "مدير مرافق"], ["Front Desk Coordinator", "منسّق استقبال"], ["Records & Archive Officer", "أمين سجلات وأرشيف"],
    ["Learning & Development Manager", "مدير تدريب وتطوير"], ["HRIS Specialist", "أخصائي أنظمة معلومات الموارد البشرية"],
    ["Employee Relations Specialist", "أخصائي علاقات موظفين"], ["Organizational Development Consultant", "استشاري تطوير تنظيمي"],
    ["Head Chef", "شيف تنفيذي"], ["Butcher", "جزّار"], ["Baker", "خبّاز"], ["Food & Beverage Manager", "مدير أغذية ومشروبات"],
    ["Catering Manager", "مدير تموين وضيافة"], ["Reservations Agent", "موظف حجوزات"], ["Concierge", "موظف كونسيرج"],
    ["Spa Therapist", "معالج سبا"], ["Tour Guide", "مرشد سياحي"], ["Travel Consultant", "مستشار سفر"],
    ["HVAC Engineer", "مهندس تكييف وتهوية"], ["Structural Draftsman", "رسّام إنشائي"], ["Land Surveyor", "مساح أراضٍ"],
    ["MEP Engineer", "مهندس MEP"], ["Contracts Manager (Construction)", "مدير عقود مقاولات"], ["Estimation Engineer", "مهندس تسعير مشاريع"],
    ["Interior Designer", "مصمم داخلي"], ["Urban Planner", "مخطط عمراني"], ["Welder", "لحّام"], ["Carpenter", "نجّار"],
    ["Painter", "دهّان"], ["Crane Operator", "مشغّل رافعة برجية"], ["Heavy Equipment Operator", "مشغّل معدات ثقيلة"],
    ["Surgeon", "جرّاح"], ["Anesthesiologist", "أخصائي تخدير"], ["Pediatrician", "طبيب أطفال"], ["Cardiologist", "أخصائي قلب"],
    ["Dermatologist", "أخصائي جلدية"], ["Psychiatrist", "طبيب نفسي"], ["Optometrist", "أخصائي بصريات"],
    ["Occupational Therapist", "أخصائي علاج وظيفي"], ["Speech Therapist", "أخصائي نطق"], ["Dietitian", "أخصائي تغذية"],
    ["Midwife", "قابلة"], ["Paramedic", "مسعف"], ["Medical Coder / Biller", "مُرمّز طبي"], ["Hospital Administrator", "مدير مستشفى"],
    ["Infection Control Specialist", "أخصائي مكافحة عدوى"], ["Quality Assurance Nurse", "ممرض ضمان جودة"],
    ["University Lecturer", "محاضر جامعي"], ["Special Education Teacher", "معلّم تربية خاصة"], ["Librarian", "أمين مكتبة"],
    ["Instructional Designer", "مصمم تعليمي"], ["Corporate Trainer", "مدرّب مؤسسي"], ["Admissions Officer", "موظف قبول وتسجيل"],
    ["Import/Export Coordinator", "منسّق استيراد وتصدير"], ["Freight Forwarder", "وكيل شحن"], ["Inventory Controller", "مراقب مخزون"],
    ["Last-Mile Delivery Manager", "مدير توصيل الميل الأخير"], ["Aviation Ground Staff", "طاقم أرضي للطيران"], ["Pilot", "طيار"],
    ["Cabin Crew", "مضيف/ة طيران"], ["Sea Captain / Marine Officer", "ربان / ضابط بحري"],
    ["Contract Manager (Legal)", "مدير عقود قانونية"], ["Notary", "كاتب عدل"], ["Litigation Specialist", "أخصائي تقاضي"],
    ["Intellectual Property Specialist", "أخصائي ملكية فكرية"],
    ["Store Supervisor", "مشرف متجر"], ["Visual Merchandiser", "مصمم عرض تجاري"], ["Inventory Clerk", "كاتب مخزون"],
    ["Loss Prevention Officer", "مسؤول منع الفاقد"], ["Fashion Buyer", "مشتري أزياء"],
    ["Production Supervisor (Manufacturing)", "مشرف إنتاج"], ["Process Engineer", "مهندس عمليات"], ["Maintenance Engineer", "مهندس صيانة"],
    ["Quality Control Inspector", "مفتش ضبط جودة"], ["Plant Manager", "مدير مصنع"], ["CNC Operator", "مشغّل CNC"],
    ["Petroleum Engineer", "مهندس بترول"], ["Drilling Engineer", "مهندس حفر"], ["Reservoir Engineer", "مهندس مكامن"],
    ["Geologist", "جيولوجي"], ["Environmental Engineer", "مهندس بيئي"], ["Agricultural Engineer", "مهندس زراعي"],
    ["Veterinarian", "طبيب بيطري"], ["Food Scientist", "عالم أغذية"],
    ["Journalist", "صحفي"], ["Editor", "محرر"], ["Animator", "رسّام متحرك"], ["Sound Engineer", "مهندس صوت"],
    ["Fitness Trainer", "مدرّب لياقة"], ["Barber / Hairstylist", "حلّاق / مصفف شعر"], ["Nail Technician", "فنّي عناية بالأظافر"],
    // Second major expansion — domestic staff, skilled trades, maritime, mining,
    // science, arts/media, sports, more security/insurance/real estate/gov't,
    // agriculture, energy, telecom, manufacturing, warehouse/transport, exec
    // roles, social services, beauty/wellness, printing, culture & tourism.
    // Still free-text with suggestions underneath — nothing here is a closed list.
    ["Private Driver", "سائق خاص"], ["Domestic Worker", "عاملة منزلية"], ["Nanny / Babysitter", "مربية / جليسة أطفال"],
    ["Private Chef / Cook", "طباخ منزلي"], ["Gardener", "بستاني"], ["Butler / House Manager", "خادم خاص / مدير منزل"],
    ["Elderly Caregiver", "مرافق كبار سن"], ["Home Nurse", "ممرض منزلي"], ["Household Manager", "مدير شؤون منزلية"],
    ["Mason / Bricklayer", "بنّاء"], ["Tiler", "مبلّط"], ["Glazier", "فنّي زجاج"], ["Locksmith", "صانع أقفال"],
    ["Upholsterer", "منجّد"], ["Roofer", "عامل أسطح"], ["Blacksmith", "حداد"], ["Aluminum Fabricator", "فنّي ألمنيوم"],
    ["Scaffolder", "منصّب سقالات"], ["Insulation Installer", "فنّي عزل"], ["Pipefitter", "فنّي تمديدات أنابيب"],
    ["Boilermaker", "فنّي مراجل"], ["Sheet Metal Worker", "فنّي صاج"], ["Tailor / Seamstress", "خيّاط / خيّاطة"],
    ["Shoemaker / Cobbler", "إسكافي"], ["Watch Repairer", "فنّي إصلاح ساعات"], ["Jeweler / Goldsmith", "صائغ"],
    ["Upfitter / Auto Detailer", "فنّي تلميع سيارات"], ["Tire Technician", "فنّي إطارات"], ["Auto Body Repair Technician", "فنّي سمكرة"],
    ["Marine Engineer", "مهندس بحري"], ["Deck Officer", "ضابط سطح"], ["Able Seaman", "بحّار"],
    ["Port Operations Officer", "مسؤول عمليات ميناء"], ["Tugboat Operator", "مشغّل قاطرة بحرية"], ["Naval Architect", "مهندس تصميم سفن"],
    ["Stevedore / Dock Worker", "عامل رصيف ميناء"], ["Marine Surveyor", "مساح بحري"],
    ["Air Traffic Controller", "مراقب حركة جوية"], ["Aircraft Maintenance Engineer", "مهندس صيانة طائرات"], ["Flight Dispatcher", "منسّق رحلات جوية"],
    ["Airport Operations Officer", "مسؤول عمليات مطار"], ["Ramp Agent", "عامل مدرج"], ["Aviation Safety Officer", "مسؤول سلامة طيران"],
    ["Mining Engineer", "مهندس تعدين"], ["Quarry Supervisor", "مشرف محجر"], ["Blaster", "فنّي تفجير"], ["Mine Surveyor", "مساح مناجم"],
    ["Research Scientist", "باحث علمي"], ["Chemist", "كيميائي"], ["Physicist", "فيزيائي"], ["Biologist", "أحيائي"],
    ["Laboratory Manager", "مدير مختبر"], ["Research Assistant", "مساعد بحث"], ["Biomedical Engineer", "مهندس طبي حيوي"],
    ["Statistician", "إحصائي"], ["Astronomer", "فلكي"],
    ["Actor", "ممثل"], ["Musician", "موسيقي"], ["Music Teacher", "معلّم موسيقى"], ["Radio Host", "مذيع إذاعي"],
    ["TV Presenter", "مذيع تلفزيوني"], ["Film Director", "مخرج أفلام"], ["Producer", "منتج"], ["Screenwriter", "كاتب سيناريو"],
    ["Set Designer", "مصمم ديكور"], ["Costume Designer", "مصمم أزياء استعراضية"], ["Makeup Artist", "خبير مكياج"],
    ["Illustrator", "رسّام توضيحي"], ["Art Director", "مدير فني"], ["Voice Actor", "ممثل صوتي"], ["DJ", "دي جي"],
    ["Fashion Designer", "مصمم أزياء"], ["Museum Curator", "أمين متحف"], ["Cultural Heritage Specialist", "أخصائي تراث ثقافي"],
    ["Sports Coach", "مدرّب رياضي"], ["Referee / Umpire", "حكم رياضي"], ["Sports Physiotherapist", "أخصائي علاج طبيعي رياضي"],
    ["Lifeguard", "منقذ سباحة"], ["Recreation Coordinator", "منسّق ترفيه"], ["Sports Team Manager", "مدير فريق رياضي"],
    ["Swimming Instructor", "مدرّب سباحة"], ["Golf Instructor", "مدرّب غولف"],
    ["Security Manager", "مدير أمن"], ["CCTV Operator", "مشغّل كاميرات مراقبة"], ["Fire Safety Officer", "مسؤول سلامة من الحريق"],
    ["Emergency Response Officer", "مسؤول استجابة للطوارئ"], ["Close Protection Officer", "حارس شخصي"], ["Access Control Officer", "مسؤول تحكم بالدخول"],
    ["Underwriter", "خبير اكتتاب تأمين"], ["Claims Adjuster", "خبير تسوية مطالبات"], ["Actuarial Analyst", "محلل اكتواري"],
    ["Insurance Broker", "سمسار تأمين"], ["Reinsurance Analyst", "محلل إعادة تأمين"],
    ["Property Manager", "مدير أملاك"], ["Leasing Consultant", "استشاري تأجير"], ["Real Estate Appraiser", "مُقيّم عقاري"],
    ["Facilities Coordinator", "منسّق مرافق"], ["Property Development Manager", "مدير تطوير عقاري"],
    ["Municipal Inspector", "مفتش بلدي"], ["Customs Officer", "ضابط جمارك"], ["Immigration Officer", "ضابط جوازات"],
    ["Public Policy Analyst", "محلل سياسات عامة"], ["Diplomat", "دبلوماسي"], ["Urban Planning Officer", "مسؤول تخطيط عمراني"],
    ["Civil Defense Officer", "ضابط دفاع مدني"], ["Public Sector Program Manager", "مدير برامج قطاع عام"],
    ["Farm Manager", "مدير مزرعة"], ["Livestock Supervisor", "مشرف ثروة حيوانية"], ["Irrigation Technician", "فنّي ري"],
    ["Agronomist", "أخصائي زراعة"], ["Beekeeper", "نحّال"], ["Fisheries Technician", "فنّي ثروة سمكية"],
    ["Greenhouse Technician", "فنّي بيوت محمية"], ["Landscape Architect", "مهندس تنسيق حدائق"],
    ["Renewable Energy Engineer", "مهندس طاقة متجددة"], ["Solar Technician", "فنّي طاقة شمسية"], ["Power Plant Operator", "مشغّل محطة طاقة"],
    ["Electrical Substation Technician", "فنّي محطة تحويل كهرباء"], ["Water Treatment Operator", "مشغّل معالجة مياه"],
    ["Energy Analyst", "محلل طاقة"], ["Wind Turbine Technician", "فنّي توربينات رياح"],
    ["Telecom Engineer", "مهندس اتصالات"], ["RF Engineer", "مهندس ترددات لاسلكية"], ["NOC Engineer", "مهندس مركز عمليات شبكة"],
    ["Fiber Optic Technician", "فنّي ألياف بصرية"], ["Telecom Sales Consultant", "استشاري مبيعات اتصالات"],
    ["Assembly Line Worker", "عامل خط تجميع"], ["Machine Operator", "مشغّل آلات"], ["Textile Worker", "عامل نسيج"],
    ["Packaging Operator", "مشغّل تعبئة وتغليف"], ["Injection Molding Operator", "مشغّل قولبة بالحقن"],
    ["Print Operator", "مشغّل مطبعة"], ["Bookbinder", "مجلّد كتب"], ["Publisher", "ناشر"], ["Proofreader", "مدقق لغوي"],
    ["Laundry Attendant", "عامل مغسلة"], ["Janitor", "عامل نظافة عام"], ["Pest Control Technician", "فنّي مكافحة حشرات"],
    ["Commercial Landscaper", "عامل تنسيق حدائق تجاري"], ["Window Cleaner", "منظّف زجاج"],
    ["Picker / Packer", "عامل تحضير وتعبئة طلبات"], ["Bus Driver", "سائق حافلة"], ["Taxi / Limousine Driver", "سائق أجرة / ليموزين"],
    ["Courier", "ساعي بريد"], ["Dispatcher", "منسّق مناوبات"], ["Route Planner", "مخطط مسارات"],
    ["Chief Executive Officer (CEO)", "الرئيس التنفيذي"], ["Chief Operating Officer (COO)", "رئيس العمليات التنفيذي"],
    ["Chief Technology Officer (CTO)", "رئيس التقنية التنفيذي"], ["Chief Marketing Officer (CMO)", "رئيس التسويق التنفيذي"],
    ["Chief Human Resources Officer (CHRO)", "رئيس الموارد البشرية التنفيذي"], ["Board Secretary", "أمين سر مجلس الإدارة"],
    ["Chief Strategy Officer", "رئيس الاستراتيجية التنفيذي"], ["Vice President", "نائب رئيس"], ["Executive Director", "مدير تنفيذي أول"],
    ["Social Worker", "أخصائي اجتماعي"], ["Counselor", "مرشد نفسي"], ["Psychologist", "أخصائي نفسي"],
    ["Rehabilitation Specialist", "أخصائي تأهيل"], ["Childcare Worker", "عامل رعاية أطفال"], ["Community Outreach Officer", "مسؤول توعية مجتمعية"],
    ["Massage Therapist", "معالج تدليك"], ["Esthetician", "أخصائي تجميل بشرة"], ["Yoga Instructor", "مدرّب يوغا"],
    ["Nutrition Coach", "مدرّب تغذية"], ["Makeup Trainer", "مدرّب مكياج"], ["Salon Manager", "مدير صالون تجميل"],
    ["Tour Operator", "منظّم رحلات سياحية"], ["Tourism Officer", "موظف سياحة"], ["Heritage Site Guide", "مرشد مواقع تراثية"],
    ["Cruise Staff", "طاقم رحلات بحرية"],
    ["Investment Banker", "مصرفي استثمار"], ["Wealth Manager", "مدير ثروات"], ["Mortgage Officer", "موظف تمويل عقاري"],
    ["Branch Manager (Banking)", "مدير فرع مصرفي"], ["Compliance Analyst (Banking)", "محلل امتثال مصرفي"],
    ["Fraud Investigator", "محقق احتيال مالي"], ["Trade Finance Officer", "موظف تمويل تجاري"],
    ["AI Engineer", "مهندس ذكاء اصطناعي"], ["Blockchain Developer", "مطوّر بلوك تشين"], ["IoT Engineer", "مهندس إنترنت الأشياء"],
    ["Systems Analyst", "محلل أنظمة"], ["IT Project Coordinator", "منسّق مشاريع تقنية"], ["Help Desk Technician", "فنّي دعم فني"],
    ["Visual Merchandising Manager", "مدير عرض تجاري"], ["Shop Floor Supervisor", "مشرف صالة عرض"], ["Pricing Analyst", "محلل تسعير"],
    ["Textile Designer", "مصمم منسوجات"], ["Pattern Maker", "صانع باترون"],
    // Third expansion round — remaining gaps across product/startup roles,
    // industrial automation, allied health, education support, supply chain,
    // hospitality operations, entry-level labor, creative/UX, agribusiness,
    // governance, and BPO/retail floor roles.
    ["Product Owner", "مالك منتج"], ["Growth Hacker", "خبير نمو"], ["Developer Relations Engineer", "مهندس علاقات المطورين"],
    ["Technical Program Manager", "مدير برامج تقنية"], ["Innovation Manager", "مدير ابتكار"], ["Chief of Staff", "رئيس الأركان"],
    ["Industrial Engineer", "مهندس صناعي"], ["Automation Engineer", "مهندس أتمتة"], ["Robotics Engineer", "مهندس روبوتات"],
    ["Lean / Six Sigma Specialist", "أخصائي Lean / Six Sigma"], ["Instrumentation Engineer", "مهندس أجهزة قياس"],
    ["Optician", "أخصائي نظارات"], ["Anesthesia Technician", "فنّي تخدير"], ["Radiographer", "فنّي أشعة"],
    ["Nutritionist", "أخصائي تغذية علاجية"], ["Phlebotomist", "فنّي سحب دم"], ["Dialysis Technician", "فنّي غسيل كلى"],
    ["Emergency Medical Technician (EMT)", "فنّي طوارئ طبية"], ["Medical Equipment Technician", "فنّي أجهزة طبية"],
    ["ESL / Language Instructor", "معلّم لغة إنجليزية كلغة أجنبية"], ["School Counselor", "مرشد طلابي"],
    ["Teaching Assistant", "مساعد تدريس"], ["Vocational Trainer", "مدرّب مهني"], ["E-learning Specialist", "أخصائي تعليم إلكتروني"],
    ["Supply Chain Analyst", "محلل سلسلة إمداد"], ["Customs Broker", "وسيط جمركي"], ["Procurement Manager", "مدير مشتريات"],
    ["Demand Planner", "مخطط طلب"],
    ["Valet Attendant", "موظف صف سيارات"], ["Doorman", "بواب"], ["Laundry Manager", "مدير مغسلة"],
    ["Banquet Manager", "مدير حفلات"], ["Room Service Attendant", "موظف خدمة الغرف"],
    ["General Laborer", "عامل عام"], ["Porter", "حمّال"], ["Loader", "عامل تحميل"],
    ["UX Researcher", "باحث تجربة مستخدم"], ["Motion Graphics Designer", "مصمم موشن غرافيك"], ["Podcast Producer", "منتج بودكاست"],
    ["Community Moderator", "مشرف مجتمع رقمي"],
    ["Poultry Farm Manager", "مدير مزرعة دواجن"], ["Dairy Farm Manager", "مدير مزرعة ألبان"],
    ["Chairman", "رئيس مجلس الإدارة"], ["Board Member", "عضو مجلس إدارة"], ["Non-Executive Director", "عضو مجلس إدارة غير تنفيذي"],
    ["Municipal Engineer", "مهندس بلدي"], ["Government Auditor", "مدقق حكومي"], ["Policy Advisor", "مستشار سياسات"],
    ["Intern", "متدرّب"], ["Trainee", "متدرّب مبتدئ"], ["Volunteer Coordinator", "منسّق متطوعين"],
    ["Technical Support Agent", "موظف دعم فني"], ["Chat Support Agent", "موظف دعم عبر المحادثة"],
    ["Stock Clerk", "كاتب مخزون تجزئة"], ["Visual Display Artist", "فنان عرض تجاري"],
    ["Elevator Technician", "فنّي مصاعد"], ["Solar Panel Installer", "فنّي تركيب ألواح شمسية"],
  ];

  var SA_CITIES = [
    "Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar", "Dhahran", "Taif", "Buraidah",
    "Tabuk", "Hail", "Hafr Al-Batin", "Jubail", "Yanbu", "Abha", "Khamis Mushait", "Najran",
    "Jazan", "Al Ahsa", "Qatif", "Sakaka", "Arar", "Al Bahah", "Al Kharj", "Unaizah", "Rabigh",
    // Further coverage of every Saudi region's district/governorate seats —
    // still free-typed, this just widens what shows up while typing.
    "Diriyah", "Al Majmaah", "Az Zulfi", "Shaqra", "Al Quwayiyah", "Afif", "Dawadmi",
    "Wadi ad-Dawasir", "Al Aflaj", "Al Ghat", "Huraymila", "Al Muzahmiyah",
    "Al Lith", "Khulais", "Al Jumum", "Turubah", "King Abdullah Economic City",
    "Al Ula", "Badr",
    "Al Rass", "Al Bukayriyah", "Riyadh Al Khabra", "Al Midhnab", "Al Badayea",
    "Ras Tanura", "Al Khafji", "Buqayq", "Al Nairyah", "Qaisumah",
    "Bisha", "Al Namas", "Muhayil Aseer", "Ahad Rafidah", "Rijal Almaa", "Tanomah",
    "Duba", "Umluj", "Al Wajh", "Haql", "Tayma", "NEOM",
    "Baqaa", "Rafha", "Turaif", "Al Uwayqilah", "Al Qurayyat",
    "Sharurah", "Badr Al Janoub",
    "Sabya", "Abu Arish", "Samtah", "Al Darb", "Farasan",
    "Baljurashi", "Al Mikhwah",
  ];
  var SA_CITIES_AR = [
    "الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "الظهران", "الطائف", "بريدة",
    "تبوك", "حائل", "حفر الباطن", "الجبيل", "ينبع", "أبها", "خميس مشيط", "نجران",
    "جازان", "الأحساء", "القطيف", "سكاكا", "عرعر", "الباحة", "الخرج", "عنيزة", "رابغ",
    "الدرعية", "المجمعة", "الزلفي", "شقراء", "القويعية", "عفيف", "الدوادمي",
    "وادي الدواسر", "الأفلاج", "الغاط", "حريملاء", "المزاحمية",
    "الليث", "خليص", "الجموم", "تربة", "مدينة الملك عبدالله الاقتصادية",
    "العلا", "بدر",
    "الرس", "البكيرية", "رياض الخبراء", "المذنب", "البدائع",
    "رأس تنورة", "الخفجي", "بقيق", "النعيرية", "القيصومة",
    "بيشة", "النماص", "محايل عسير", "أحد رفيدة", "رجال ألمع", "تنومة",
    "ضباء", "أملج", "الوجه", "حقل", "تيماء", "نيوم",
    "البقعاء", "رفحاء", "طريف", "العويقيلة", "القريات",
    "شرورة", "بدر الجنوب",
    "صبيا", "أبو عريش", "صامطة", "الدرب", "فرسان",
    "بلجرشي", "المخواة",
  ];
  var WORLD_CITIES = [
    ["Dubai", "United Arab Emirates", "دبي", "الإمارات"], ["Abu Dhabi", "United Arab Emirates", "أبوظبي", "الإمارات"],
    ["Sharjah", "United Arab Emirates", "الشارقة", "الإمارات"], ["Doha", "Qatar", "الدوحة", "قطر"],
    ["Manama", "Bahrain", "المنامة", "البحرين"], ["Kuwait City", "Kuwait", "مدينة الكويت", "الكويت"],
    ["Muscat", "Oman", "مسقط", "عُمان"], ["Cairo", "Egypt", "القاهرة", "مصر"], ["Alexandria", "Egypt", "الإسكندرية", "مصر"],
    ["Giza", "Egypt", "الجيزة", "مصر"], ["Amman", "Jordan", "عمّان", "الأردن"], ["Beirut", "Lebanon", "بيروت", "لبنان"],
    ["Damascus", "Syria", "دمشق", "سوريا"], ["Baghdad", "Iraq", "بغداد", "العراق"], ["Sanaa", "Yemen", "صنعاء", "اليمن"],
    ["Khartoum", "Sudan", "الخرطوم", "السودان"], ["Rabat", "Morocco", "الرباط", "المغرب"], ["Casablanca", "Morocco", "الدار البيضاء", "المغرب"],
    ["Tunis", "Tunisia", "تونس", "تونس"], ["Algiers", "Algeria", "الجزائر", "الجزائر"], ["Tripoli", "Libya", "طرابلس", "ليبيا"],
    ["Istanbul", "Turkey", "إسطنبول", "تركيا"], ["Ankara", "Turkey", "أنقرة", "تركيا"],
    ["Mumbai", "India", "مومباي", "الهند"], ["Delhi", "India", "دلهي", "الهند"], ["Bangalore", "India", "بنغالور", "الهند"],
    ["Chennai", "India", "تشيناي", "الهند"], ["Hyderabad", "India", "حيدر أباد", "الهند"], ["Kochi", "India", "كوتشي", "الهند"],
    ["Karachi", "Pakistan", "كراتشي", "باكستان"], ["Lahore", "Pakistan", "لاهور", "باكستان"], ["Islamabad", "Pakistan", "إسلام آباد", "باكستان"],
    ["Dhaka", "Bangladesh", "دكا", "بنغلاديش"], ["Chittagong", "Bangladesh", "شيتاغونغ", "بنغلاديش"],
    ["Colombo", "Sri Lanka", "كولومبو", "سريلانكا"], ["Kathmandu", "Nepal", "كاتماندو", "نيبال"],
    ["Manila", "Philippines", "مانيلا", "الفلبين"], ["Cebu", "Philippines", "سيبو", "الفلبين"],
    ["Jakarta", "Indonesia", "جاكرتا", "إندونيسيا"], ["Kuala Lumpur", "Malaysia", "كوالالمبور", "ماليزيا"],
    ["Bangkok", "Thailand", "بانكوك", "تايلاند"], ["Hanoi", "Vietnam", "هانوي", "فيتنام"],
    ["Beijing", "China", "بكين", "الصين"], ["Shanghai", "China", "شنغهاي", "الصين"], ["Hong Kong", "China", "هونغ كونغ", "الصين"],
    ["Tokyo", "Japan", "طوكيو", "اليابان"], ["Seoul", "South Korea", "سيول", "كوريا الجنوبية"],
    ["Nairobi", "Kenya", "نيروبي", "كينيا"], ["Kampala", "Uganda", "كمبالا", "أوغندا"], ["Addis Ababa", "Ethiopia", "أديس أبابا", "إثيوبيا"],
    ["Lagos", "Nigeria", "لاغوس", "نيجيريا"], ["Accra", "Ghana", "أكرا", "غانا"], ["Dakar", "Senegal", "داكار", "السنغال"],
    ["Johannesburg", "South Africa", "جوهانسبرغ", "جنوب أفريقيا"], ["Cape Town", "South Africa", "كيب تاون", "جنوب أفريقيا"],
    ["London", "United Kingdom", "لندن", "المملكة المتحدة"], ["Manchester", "United Kingdom", "مانشستر", "المملكة المتحدة"],
    ["Paris", "France", "باريس", "فرنسا"], ["Berlin", "Germany", "برلين", "ألمانيا"], ["Frankfurt", "Germany", "فرانكفورت", "ألمانيا"],
    ["Madrid", "Spain", "مدريد", "إسبانيا"], ["Rome", "Italy", "روما", "إيطاليا"], ["Amsterdam", "Netherlands", "أمستردام", "هولندا"],
    ["Zurich", "Switzerland", "زيورخ", "سويسرا"], ["Vienna", "Austria", "فيينا", "النمسا"], ["Warsaw", "Poland", "وارسو", "بولندا"],
    ["Moscow", "Russia", "موسكو", "روسيا"], ["Athens", "Greece", "أثينا", "اليونان"],
    ["New York", "United States", "نيويورك", "الولايات المتحدة"], ["Los Angeles", "United States", "لوس أنجلوس", "الولايات المتحدة"],
    ["Chicago", "United States", "شيكاغو", "الولايات المتحدة"], ["Houston", "United States", "هيوستن", "الولايات المتحدة"],
    ["Toronto", "Canada", "تورونتو", "كندا"], ["Vancouver", "Canada", "فانكوفر", "كندا"], ["Montreal", "Canada", "مونتريال", "كندا"],
    ["Mexico City", "Mexico", "مكسيكو سيتي", "المكسيك"], ["Sao Paulo", "Brazil", "ساو باولو", "البرازيل"],
    ["Buenos Aires", "Argentina", "بوينس آيرس", "الأرجنتين"],
    ["Sydney", "Australia", "سيدني", "أستراليا"], ["Melbourne", "Australia", "ملبورن", "أستراليا"], ["Auckland", "New Zealand", "أوكلاند", "نيوزيلندا"],
    // At least one (usually the capital) city for every remaining country in
    // COUNTRIES so the combobox has a matching city suggestion everywhere —
    // still free-typed, this just widens what shows up while typing.
    ["Ramallah", "Palestine", "رام الله", "فلسطين"], ["Nouakchott", "Mauritania", "نواكشوط", "موريتانيا"],
    ["Mogadishu", "Somalia", "مقديشو", "الصومال"], ["Djibouti City", "Djibouti", "مدينة جيبوتي", "جيبوتي"],
    ["Moroni", "Comoros", "موروني", "جزر القمر"], ["Tehran", "Iran", "طهران", "إيران"], ["Kabul", "Afghanistan", "كابل", "أفغانستان"],
    ["Thimphu", "Bhutan", "تيمفو", "بوتان"], ["Malé", "Maldives", "ماليه", "المالديف"], ["Yangon", "Myanmar", "يانغون", "ميانمار"],
    ["Phnom Penh", "Cambodia", "بنوم بنه", "كمبوديا"], ["Vientiane", "Laos", "فيينتيان", "لاوس"],
    ["Singapore", "Singapore", "سنغافورة", "سنغافورة"], ["Bandar Seri Begawan", "Brunei", "بندر سري بكاوان", "بروناي"],
    ["Dili", "Timor-Leste", "ديلي", "تيمور الشرقية"], ["Pyongyang", "North Korea", "بيونغيانغ", "كوريا الشمالية"],
    ["Ulaanbaatar", "Mongolia", "أولان باتور", "منغوليا"], ["Taipei", "Taiwan", "تايبيه", "تايوان"],
    ["Astana", "Kazakhstan", "أستانا", "كازاخستان"], ["Tashkent", "Uzbekistan", "طشقند", "أوزبكستان"],
    ["Ashgabat", "Turkmenistan", "عشق آباد", "تركمانستان"], ["Dushanbe", "Tajikistan", "دوشنبه", "طاجيكستان"],
    ["Bishkek", "Kyrgyzstan", "بيشكك", "قيرغيزستان"], ["Baku", "Azerbaijan", "باكو", "أذربيجان"],
    ["Yerevan", "Armenia", "يريفان", "أرمينيا"], ["Tbilisi", "Georgia", "تبليسي", "جورجيا"],
    ["Dublin", "Ireland", "دبلن", "أيرلندا"], ["Brussels", "Belgium", "بروكسل", "بلجيكا"],
    ["Luxembourg City", "Luxembourg", "مدينة لوكسمبورغ", "لوكسمبورغ"], ["Lisbon", "Portugal", "لشبونة", "البرتغال"],
    ["Nicosia", "Cyprus", "نيقوسيا", "قبرص"], ["Valletta", "Malta", "فاليتا", "مالطا"],
    ["Stockholm", "Sweden", "ستوكهولم", "السويد"], ["Oslo", "Norway", "أوسلو", "النرويج"],
    ["Copenhagen", "Denmark", "كوبنهاغن", "الدنمارك"], ["Helsinki", "Finland", "هلسنكي", "فنلندا"],
    ["Reykjavik", "Iceland", "ريكيافيك", "آيسلندا"], ["Prague", "Czech Republic", "براغ", "التشيك"],
    ["Bratislava", "Slovakia", "براتيسلافا", "سلوفاكيا"], ["Budapest", "Hungary", "بودابست", "المجر"],
    ["Bucharest", "Romania", "بوخارست", "رومانيا"], ["Sofia", "Bulgaria", "صوفيا", "بلغاريا"],
    ["Zagreb", "Croatia", "زغرب", "كرواتيا"], ["Belgrade", "Serbia", "بلغراد", "صربيا"],
    ["Sarajevo", "Bosnia and Herzegovina", "سراييفو", "البوسنة والهرسك"], ["Skopje", "North Macedonia", "سكوبيه", "مقدونيا الشمالية"],
    ["Tirana", "Albania", "تيرانا", "ألبانيا"], ["Ljubljana", "Slovenia", "ليوبليانا", "سلوفينيا"],
    ["Podgorica", "Montenegro", "بودغوريتسا", "الجبل الأسود"], ["Pristina", "Kosovo", "بريشتينا", "كوسوفو"],
    ["Chisinau", "Moldova", "كيشيناو", "مولدوفا"], ["Kyiv", "Ukraine", "كييف", "أوكرانيا"],
    ["Minsk", "Belarus", "مينسك", "بيلاروسيا"], ["Tallinn", "Estonia", "تالين", "إستونيا"],
    ["Riga", "Latvia", "ريغا", "لاتفيا"], ["Vilnius", "Lithuania", "فيلنيوس", "ليتوانيا"],
    ["Santiago", "Chile", "سانتياغو", "تشيلي"], ["Bogotá", "Colombia", "بوغوتا", "كولومبيا"],
    ["Lima", "Peru", "ليما", "بيرو"], ["Caracas", "Venezuela", "كراكاس", "فنزويلا"], ["Quito", "Ecuador", "كيتو", "الإكوادور"],
    ["La Paz", "Bolivia", "لا باز", "بوليفيا"], ["Montevideo", "Uruguay", "مونتيفيديو", "أوروغواي"],
    ["Asunción", "Paraguay", "أسونسيون", "باراغواي"], ["Panama City", "Panama", "مدينة بنما", "بنما"],
    ["San José", "Costa Rica", "سان خوسيه", "كوستاريكا"], ["Havana", "Cuba", "هافانا", "كوبا"],
    ["Santo Domingo", "Dominican Republic", "سانتو دومينغو", "جمهورية الدومينيكان"], ["Kingston", "Jamaica", "كينغستون", "جامايكا"],
    ["Guatemala City", "Guatemala", "مدينة غواتيمالا", "غواتيمالا"], ["Tegucigalpa", "Honduras", "تيغوسيغالبا", "هندوراس"],
    ["San Salvador", "El Salvador", "سان سلفادور", "السلفادور"], ["Managua", "Nicaragua", "ماناغوا", "نيكاراغوا"],
    ["Dar es Salaam", "Tanzania", "دار السلام", "تنزانيا"], ["Abidjan", "Ivory Coast", "أبيدجان", "ساحل العاج"],
    ["Yaoundé", "Cameroon", "ياوندي", "الكاميرون"], ["Lusaka", "Zambia", "لوساكا", "زامبيا"],
    ["Harare", "Zimbabwe", "هراري", "زيمبابوي"], ["Kigali", "Rwanda", "كيغالي", "رواندا"],
    ["Bamako", "Mali", "باماكو", "مالي"], ["Niamey", "Niger", "نيامي", "النيجر"], ["N'Djamena", "Chad", "إنجامينا", "تشاد"],
    ["Luanda", "Angola", "لواندا", "أنغولا"], ["Maputo", "Mozambique", "مابوتو", "موزمبيق"],
    ["Gaborone", "Botswana", "غابورون", "بوتسوانا"], ["Windhoek", "Namibia", "ويندهوك", "ناميبيا"],
    ["Lilongwe", "Malawi", "ليلونغوي", "ملاوي"], ["Libreville", "Gabon", "ليبرفيل", "الغابون"],
    ["Suva", "Fiji", "سوفا", "فيجي"], ["Port Moresby", "Papua New Guinea", "بورت مورسبي", "بابوا غينيا الجديدة"],
    ["Andorra la Vella", "Andorra", "أندورا لا فيلا", "أندورا"], ["Vaduz", "Liechtenstein", "فادوز", "ليختنشتاين"],
    ["Monaco", "Monaco", "موناكو", "موناكو"], ["San Marino", "San Marino", "سان مارينو", "سان مارينو"],
    ["Vatican City", "Vatican City", "الفاتيكان", "الفاتيكان"],
    ["Nassau", "Bahamas", "ناسو", "باهاماس"], ["Bridgetown", "Barbados", "بريدجتاون", "باربادوس"],
    ["Belmopan", "Belize", "بلموبان", "بليز"], ["Saint John's", "Antigua and Barbuda", "سانت جونز", "أنتيغوا وباربودا"],
    ["Roseau", "Dominica", "روزو", "دومينيكا"], ["Saint George's", "Grenada", "سانت جورجز", "غرينادا"],
    ["Georgetown", "Guyana", "جورجتاون", "غيانا"], ["Port-au-Prince", "Haiti", "بورت أو برنس", "هايتي"],
    ["Basseterre", "Saint Kitts and Nevis", "باستير", "سانت كيتس ونيفيس"], ["Castries", "Saint Lucia", "كاستريز", "سانت لوسيا"],
    ["Kingstown", "Saint Vincent and the Grenadines", "كينغستاون", "سانت فينسنت والغرينادين"],
    ["Paramaribo", "Suriname", "باراماريبو", "سورينام"], ["Port of Spain", "Trinidad and Tobago", "بورت أوف سبين", "ترينيداد وتوباغو"],
    ["Cotonou", "Benin", "كوتونو", "بنين"], ["Ouagadougou", "Burkina Faso", "واغادوغو", "بوركينا فاسو"],
    ["Bujumbura", "Burundi", "بوجمبورا", "بوروندي"], ["Praia", "Cabo Verde", "برايا", "الرأس الأخضر"],
    ["Bangui", "Central African Republic", "بانغي", "جمهورية أفريقيا الوسطى"], ["Brazzaville", "Republic of the Congo", "برازافيل", "الكونغو"],
    ["Kinshasa", "Democratic Republic of the Congo", "كينشاسا", "جمهورية الكونغو الديمقراطية"],
    ["Malabo", "Equatorial Guinea", "مالابو", "غينيا الاستوائية"], ["Asmara", "Eritrea", "أسمرة", "إريتريا"],
    ["Mbabane", "Eswatini", "مبابان", "إسواتيني"], ["Banjul", "Gambia", "بانجول", "غامبيا"],
    ["Conakry", "Guinea", "كوناكري", "غينيا"], ["Bissau", "Guinea-Bissau", "بيساو", "غينيا بيساو"],
    ["Maseru", "Lesotho", "ماسيرو", "ليسوتو"], ["Monrovia", "Liberia", "مونروفيا", "ليبيريا"],
    ["Antananarivo", "Madagascar", "أنتاناناريفو", "مدغشقر"], ["Port Louis", "Mauritius", "بورت لويس", "موريشيوس"],
    ["São Tomé", "Sao Tome and Principe", "ساو تومي", "ساو تومي وبرينسيبي"], ["Victoria", "Seychelles", "فيكتوريا", "سيشل"],
    ["Freetown", "Sierra Leone", "فريتاون", "سيراليون"], ["Juba", "South Sudan", "جوبا", "جنوب السودان"],
    ["Lomé", "Togo", "لومي", "توغو"], ["Tarawa", "Kiribati", "تاراوا", "كيريباتي"],
    ["Majuro", "Marshall Islands", "ماجورو", "جزر مارشال"], ["Palikir", "Micronesia", "باليكير", "ميكرونيزيا"],
    ["Yaren", "Nauru", "يارين", "ناورو"], ["Ngerulmud", "Palau", "نغيرولمود", "بالاو"],
    ["Apia", "Samoa", "أبيا", "ساموا"], ["Honiara", "Solomon Islands", "هونيارا", "جزر سليمان"],
    ["Nuku'alofa", "Tonga", "نوكوعالوفا", "تونغا"], ["Funafuti", "Tuvalu", "فونافوتي", "توفالو"],
    ["Port Vila", "Vanuatu", "بورت فيلا", "فانواتو"],
    ["Remote / Work from home", "", "عن بُعد / من المنزل", ""],
  ];

  // Used for both Country and Nationality fields — candidates and jobs can be
  // based anywhere, not just Saudi Arabia, so this deliberately covers the
  // full range of countries rather than a Gulf/MENA-only shortlist.
  var COUNTRIES = [
    ["Saudi Arabia", "السعودية"], ["United Arab Emirates", "الإمارات"], ["Qatar", "قطر"], ["Bahrain", "البحرين"],
    ["Kuwait", "الكويت"], ["Oman", "عُمان"], ["Egypt", "مصر"], ["Jordan", "الأردن"], ["Lebanon", "لبنان"],
    ["Syria", "سوريا"], ["Iraq", "العراق"], ["Yemen", "اليمن"], ["Palestine", "فلسطين"], ["Sudan", "السودان"],
    ["Libya", "ليبيا"], ["Tunisia", "تونس"], ["Algeria", "الجزائر"], ["Morocco", "المغرب"], ["Mauritania", "موريتانيا"],
    ["Somalia", "الصومال"], ["Djibouti", "جيبوتي"], ["Comoros", "جزر القمر"],
    ["Turkey", "تركيا"], ["Iran", "إيران"], ["Afghanistan", "أفغانستان"],
    ["India", "الهند"], ["Pakistan", "باكستان"], ["Bangladesh", "بنغلاديش"], ["Sri Lanka", "سريلانكا"],
    ["Nepal", "نيبال"], ["Bhutan", "بوتان"], ["Maldives", "المالديف"],
    ["Philippines", "الفلبين"], ["Indonesia", "إندونيسيا"], ["Malaysia", "ماليزيا"], ["Thailand", "تايلاند"],
    ["Vietnam", "فيتنام"], ["Myanmar", "ميانمار"], ["Cambodia", "كمبوديا"], ["Laos", "لاوس"], ["Singapore", "سنغافورة"],
    ["Brunei", "بروناي"], ["Timor-Leste", "تيمور الشرقية"],
    ["China", "الصين"], ["Japan", "اليابان"], ["South Korea", "كوريا الجنوبية"], ["North Korea", "كوريا الشمالية"],
    ["Mongolia", "منغوليا"], ["Taiwan", "تايوان"], ["Hong Kong", "هونغ كونغ"],
    ["Kazakhstan", "كازاخستان"], ["Uzbekistan", "أوزبكستان"], ["Turkmenistan", "تركمانستان"], ["Tajikistan", "طاجيكستان"],
    ["Kyrgyzstan", "قيرغيزستان"], ["Azerbaijan", "أذربيجان"], ["Armenia", "أرمينيا"], ["Georgia", "جورجيا"],
    ["United Kingdom", "المملكة المتحدة"], ["Ireland", "أيرلندا"], ["France", "فرنسا"], ["Germany", "ألمانيا"],
    ["Netherlands", "هولندا"], ["Belgium", "بلجيكا"], ["Luxembourg", "لوكسمبورغ"], ["Switzerland", "سويسرا"],
    ["Austria", "النمسا"], ["Spain", "إسبانيا"], ["Portugal", "البرتغال"], ["Italy", "إيطاليا"],
    ["Greece", "اليونان"], ["Cyprus", "قبرص"], ["Malta", "مالطا"],
    ["Sweden", "السويد"], ["Norway", "النرويج"], ["Denmark", "الدنمارك"], ["Finland", "فنلندا"], ["Iceland", "آيسلندا"],
    ["Poland", "بولندا"], ["Czech Republic", "التشيك"], ["Slovakia", "سلوفاكيا"], ["Hungary", "المجر"],
    ["Romania", "رومانيا"], ["Bulgaria", "بلغاريا"], ["Croatia", "كرواتيا"], ["Serbia", "صربيا"],
    ["Bosnia and Herzegovina", "البوسنة والهرسك"], ["North Macedonia", "مقدونيا الشمالية"], ["Albania", "ألبانيا"],
    ["Slovenia", "سلوفينيا"], ["Montenegro", "الجبل الأسود"], ["Kosovo", "كوسوفو"], ["Moldova", "مولدوفا"],
    ["Ukraine", "أوكرانيا"], ["Belarus", "بيلاروسيا"], ["Russia", "روسيا"], ["Estonia", "إستونيا"],
    ["Latvia", "لاتفيا"], ["Lithuania", "ليتوانيا"],
    ["United States", "الولايات المتحدة"], ["Canada", "كندا"], ["Mexico", "المكسيك"],
    ["Brazil", "البرازيل"], ["Argentina", "الأرجنتين"], ["Chile", "تشيلي"], ["Colombia", "كولومبيا"],
    ["Peru", "بيرو"], ["Venezuela", "فنزويلا"], ["Ecuador", "الإكوادور"], ["Bolivia", "بوليفيا"],
    ["Uruguay", "أوروغواي"], ["Paraguay", "باراغواي"], ["Panama", "بنما"], ["Costa Rica", "كوستاريكا"],
    ["Cuba", "كوبا"], ["Dominican Republic", "جمهورية الدومينيكان"], ["Jamaica", "جامايكا"], ["Guatemala", "غواتيمالا"],
    ["Honduras", "هندوراس"], ["El Salvador", "السلفادور"], ["Nicaragua", "نيكاراغوا"],
    ["Nigeria", "نيجيريا"], ["Kenya", "كينيا"], ["Ethiopia", "إثيوبيا"], ["Ghana", "غانا"], ["Uganda", "أوغندا"],
    ["Tanzania", "تنزانيا"], ["South Africa", "جنوب أفريقيا"], ["Senegal", "السنغال"], ["Ivory Coast", "ساحل العاج"],
    ["Cameroon", "الكاميرون"], ["Zambia", "زامبيا"], ["Zimbabwe", "زيمبابوي"], ["Rwanda", "رواندا"],
    ["Mali", "مالي"], ["Niger", "النيجر"], ["Chad", "تشاد"], ["Angola", "أنغولا"], ["Mozambique", "موزمبيق"],
    ["Botswana", "بوتسوانا"], ["Namibia", "ناميبيا"], ["Malawi", "ملاوي"], ["Gabon", "الغابون"],
    ["Australia", "أستراليا"], ["New Zealand", "نيوزيلندا"], ["Fiji", "فيجي"], ["Papua New Guinea", "بابوا غينيا الجديدة"],
    // Remaining UN member/observer states not already covered above — added
    // for full world coverage even though this field is free-typed anyway.
    ["Andorra", "أندورا"], ["Liechtenstein", "ليختنشتاين"], ["Monaco", "موناكو"], ["San Marino", "سان مارينو"],
    ["Vatican City", "الفاتيكان"],
    ["Bahamas", "باهاماس"], ["Barbados", "باربادوس"], ["Belize", "بليز"], ["Antigua and Barbuda", "أنتيغوا وباربودا"],
    ["Dominica", "دومينيكا"], ["Grenada", "غرينادا"], ["Guyana", "غيانا"], ["Haiti", "هايتي"], ["Saint Kitts and Nevis", "سانت كيتس ونيفيس"],
    ["Saint Lucia", "سانت لوسيا"], ["Saint Vincent and the Grenadines", "سانت فينسنت والغرينادين"], ["Suriname", "سورينام"],
    ["Trinidad and Tobago", "ترينيداد وتوباغو"],
    ["Benin", "بنين"], ["Burkina Faso", "بوركينا فاسو"], ["Burundi", "بوروندي"], ["Cabo Verde", "الرأس الأخضر"],
    ["Central African Republic", "جمهورية أفريقيا الوسطى"], ["Republic of the Congo", "الكونغو"],
    ["Democratic Republic of the Congo", "جمهورية الكونغو الديمقراطية"], ["Equatorial Guinea", "غينيا الاستوائية"],
    ["Eritrea", "إريتريا"], ["Eswatini", "إسواتيني"], ["Gambia", "غامبيا"], ["Guinea", "غينيا"], ["Guinea-Bissau", "غينيا بيساو"],
    ["Lesotho", "ليسوتو"], ["Liberia", "ليبيريا"], ["Madagascar", "مدغشقر"], ["Mauritius", "موريشيوس"],
    ["Sao Tome and Principe", "ساو تومي وبرينسيبي"], ["Seychelles", "سيشل"], ["Sierra Leone", "سيراليون"],
    ["South Sudan", "جنوب السودان"], ["Togo", "توغو"],
    ["Kiribati", "كيريباتي"], ["Marshall Islands", "جزر مارشال"], ["Micronesia", "ميكرونيزيا"], ["Nauru", "ناورو"],
    ["Palau", "بالاو"], ["Samoa", "ساموا"], ["Solomon Islands", "جزر سليمان"], ["Tonga", "تونغا"], ["Tuvalu", "توفالو"],
    ["Vanuatu", "فانواتو"],
    ["Other / not listed", "أخرى / غير مدرجة"],
  ];

  function jobTitleOptions(lang) {
    return JOB_TITLES.map(function (t) { return lang === "ar" ? t[1] : t[0]; });
  }
  function cityOptions(lang) {
    var sa = lang === "ar" ? SA_CITIES_AR : SA_CITIES;
    var saLabel = lang === "ar" ? "السعودية" : "Saudi Arabia";
    var out = sa.map(function (c) { return lang === "ar" ? (saLabel + " — " + c) : (saLabel + " — " + c); });
    WORLD_CITIES.forEach(function (c) {
      var city = lang === "ar" ? c[2] : c[0];
      var country = lang === "ar" ? c[3] : c[1];
      out.push(country ? (country + " — " + city) : city);
    });
    return out;
  }
  function experienceOptions(lang) {
    var yr = lang === "ar" ? "سنوات" : "years";
    var y1 = lang === "ar" ? "سنة" : "year";
    var none = lang === "ar" ? "بدون خبرة" : "No experience";
    var out = [none, "1 " + y1, "2 " + yr, "3 " + yr, "4 " + yr];
    [5, 10, 15, 20, 25, 30, 35, 40, 45, 50].forEach(function (n) { out.push(n + "+ " + yr); });
    return out;
  }
  function countryOptions(lang) {
    return COUNTRIES.map(function (c) { return lang === "ar" ? c[1] : c[0]; });
  }

  function initCombobox(input, getOptions) {
    if (!input) return;
    var wrap = document.createElement("div");
    wrap.className = "bp-combo-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.setAttribute("autocomplete", "off");
    var list = document.createElement("div");
    list.className = "bp-combo-list";
    list.hidden = true;
    wrap.appendChild(list);
    var active = -1;

    function render(items) {
      list.innerHTML = items.map(function (opt, i) {
        return '<div class="bp-combo-opt' + (i === active ? " active" : "") + '" data-i="' + i + '">' + esc(opt) + "</div>";
      }).join("");
      list.hidden = !items.length;
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    // Capped at 40 (not 8) so the dropdown itself makes it obvious this is a
    // long, scrollable list rather than a handful of fixed options — direct
    // feedback was that only seeing ~6 suggestions on an empty query read as
    // "the list is incomplete" even though the full list (500+ job titles)
    // was already there and just needed typing to search.
    function filtered() {
      var q = input.value.trim().toLowerCase();
      var all = getOptions();
      if (!q) return all.slice(0, 40);
      return all.filter(function (o) { return o.toLowerCase().indexOf(q) !== -1; }).slice(0, 40);
    }
    input.addEventListener("input", function () { active = -1; render(filtered()); });
    input.addEventListener("focus", function () { render(filtered()); });
    input.addEventListener("keydown", function (e) {
      var items = list.querySelectorAll(".bp-combo-opt");
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, items.length - 1); render(filtered()); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); render(filtered()); }
      else if (e.key === "Enter" && active >= 0 && items[active]) { e.preventDefault(); input.value = items[active].textContent; list.hidden = true; }
      else if (e.key === "Escape") { list.hidden = true; }
    });
    list.addEventListener("mousedown", function (e) {
      var opt = e.target.closest(".bp-combo-opt");
      if (!opt) return;
      input.value = opt.textContent;
      list.hidden = true;
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) list.hidden = true; });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var lang = (window.BP && BP.lang) || document.documentElement.lang || "ar";
    initCombobox(document.getElementById("c-field"), function () { return jobTitleOptions(lang); });
    initCombobox(document.getElementById("c-city"), function () { return cityOptions(lang); });
    initCombobox(document.getElementById("c-exp"), function () { return experienceOptions(lang); });
    initCombobox(document.getElementById("c-country"), function () { return countryOptions(lang); });
    initCombobox(document.getElementById("c-nationality"), function () { return countryOptions(lang); });
  });

  // Exposed so other pages (e.g. the employer job-posting form) can reuse
  // the same standardized job-title/city/country taxonomy and combobox widget.
  window.BP = window.BP || {};
  BP.initCombobox = initCombobox;
  BP.jobTitleOptions = jobTitleOptions;
  BP.cityOptions = cityOptions;
  BP.countryOptions = countryOptions;
})();

/* ---------- Careers: join candidate pool → /api/candidate (Notion) ---------- */
(function () {
  "use strict";
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function setSelectedJob(id, title) {
    var jid = document.getElementById("c-job-id");
    var jt = document.getElementById("c-job-title");
    var box = document.getElementById("ats-selected-job");
    if (jid) jid.value = id || "candidate-pool";
    if (jt) jt.value = title || (BP.lang === "ar" ? "قاعدة المرشحين العامة" : "General candidate pool");
    if (box) box.innerHTML = (BP.lang === "ar" ? "التقديم على: " : "Applying for: ") + "<strong>" + (jt ? jt.value : title) + "</strong>";
  }
  function readCvFile(input) {
    return new Promise(function (resolve) {
      if (!input || !input.files || !input.files[0]) return resolve(null);
      var file = input.files[0];
      var max = 4 * 1024 * 1024;
      if (file.size > max) return resolve({ tooLarge: true, name: file.name, size: file.size, type: file.type });
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || "");
        resolve({ name: file.name, size: file.size, type: file.type || "application/octet-stream", dataUrl: result, base64: result.split(",")[1] || "" });
      };
      reader.onerror = function () { resolve(null); };
      reader.readAsDataURL(file);
    });
  }
  // Delegated so it also covers client-job cards rendered later by fetch.
  document.addEventListener("click", function (e) {
    var a = e.target.closest(".ats-apply-link");
    if (!a) return;
    setSelectedJob(a.getAttribute("data-job-id"), a.getAttribute("data-job-title"));
  });
  function loadClientJobs() {
    var grid = document.getElementById("client-jobs-grid"), status = document.getElementById("client-jobs-status");
    if (!grid) return;
    fetch("/api/candidates?openJobs=1").then(function (r) { return r.json(); })
      .then(function (d) {
        var jobs = (d && d.ok && d.jobs) || [];
        // The grid is server-rendered with Business Partner's own vacancies —
        // employer postings are added alongside them, never over them.
        if (!jobs.length) {
          if (grid.children.length) status.hidden = true;
          else status.textContent = BP.t("No employer-posted jobs right now — check back soon.", "لا توجد وظائف من أصحاب العمل حالياً — تابع لاحقاً.");
          return;
        }
        status.hidden = true;
        grid.insertAdjacentHTML("afterbegin", jobs.map(function (j) {
          var tag = [j.company, j.city].filter(Boolean).join(" · ") || (j.field || "");
          // Show a short, tidy teaser on the card only — the full description
          // is intentionally kept out of the card so every card stays uniform;
          // applicants get the details in the application step.
          var teaser = clipTeaser(j.description || "", 140);
          return '<article class="card ats-job-card"><span class="emp-tag">' + esc2(tag) + '</span><h3>' + esc2(j.title) + '</h3>' +
            (teaser ? '<p>' + esc2(teaser) + '</p>' : '') +
            '<div class="talent-actions"><a class="btn btn-primary btn-sm" href="' + jobPageHref(j.id) + '">' + BP.t("View job", "عرض الوظيفة") + '</a><a class="btn btn-ghost btn-sm ats-apply-link" href="#seeker-form" data-job-id="' + esc2(j.id) + '" data-job-title="' + esc2(j.title) + '">' + BP.t("Apply", "تقديم") + "</a></div></article>";
        }).join(""));
        // The board is translated in batches, one request at a time. Firing
        // every batch at once tripped the AI provider's rate limit and the
        // whole board fell back to Arabic, so batches run in sequence and a
        // rate-limited batch is retried once.
        if (pageLang() !== "ar") {
          var batches = [];
          for (var b0 = 0; b0 < jobs.length; b0 += 8) batches.push(jobs.slice(b0, b0 + 8));
          (function runNext(i) {
            if (i >= batches.length) return;
            var batch = batches[i];
            var parts = [];
            batch.forEach(function (j) { parts.push(j.title, clipTeaser(j.description || "", 140) || "—", [j.company, j.city].filter(Boolean).join(" · ") || "—"); });
            var key = "board-" + batch.map(function (j) { return j.id.slice(-6); }).join("");
            translateParts(parts, key).then(function (tr) {
              if (!tr) return new Promise(function (res) { setTimeout(function () { res(translateParts(parts, key)); }, 1500); });
              return tr;
            }).then(function (tr) {
              if (tr) {
                batch.forEach(function (j, k) {
                  var lnk = grid.querySelector('a.ats-apply-link[data-job-id="' + j.id + '"]');
                  var card = lnk && lnk.closest(".ats-job-card");
                  if (!card) return;
                  var h = card.querySelector("h3"); if (h) h.textContent = tr[k * 3];
                  var pEl = card.querySelector("p"); if (pEl && tr[k * 3 + 1] !== "—") pEl.textContent = tr[k * 3 + 1];
                  var tag = card.querySelector(".emp-tag"); if (tag && tr[k * 3 + 2] !== "—") tag.textContent = tr[k * 3 + 2];
                  if (lnk) lnk.setAttribute("data-job-title", tr[k * 3]);
                });
              }
              runNext(i + 1);
            });
          })(0);
        }
        // Deep link support: /ar/careers?job=<posting id> (the link the
        // employer console shares) preselects that posting in the form and
        // brings its card into view, so an ad can point at one specific job
        // instead of the whole board.
        try {
          var want = new URLSearchParams(location.search || "").get("job");
          var hit = want && jobs.filter(function (j) { return j.id === want; })[0];
          if (hit) {
            setSelectedJob(hit.id, hit.title);
            var lnk = grid.querySelector('a.ats-apply-link[data-job-id="' + hit.id + '"]');
            var card = lnk && lnk.closest(".ats-job-card");
            if (card) {
              card.style.outline = "2px solid var(--brand)";
              card.style.outlineOffset = "3px";
              card.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
        } catch (e2) {}
      })
      .catch(function () { status.textContent = BP.t("Couldn't load employer jobs.", "تعذّر تحميل وظائف أصحاب العمل."); });
  }
  // Every console posting gets its own advert page (/job?id=…) instead of only
  // a button that jumps to the shared application form.
  function jobPageHref(id) {
    return (BP.lang === "ar" ? "/ar/job?id=" : "/job?id=") + encodeURIComponent(id);
  }
  // Job adverts are authored once in Arabic (Notion). On the site's other
  // languages they are machine-translated on demand and cached per browser,
  // so switching language no longer leaves the advert in Arabic.
  function pageLang() { return (document.documentElement.lang || "en").toLowerCase().split("-")[0]; }
  function translateParts(parts, id) {
    var lang = pageLang();
    if (lang === "ar") return Promise.resolve(null);
    var key = "bp_jobtr_" + lang + "_" + id;
    try {
      var hit = JSON.parse(localStorage.getItem(key) || "null");
      if (hit && hit.n === parts.length) return Promise.resolve(hit.parts);
    } catch (e) {}
    return fetch("/api/hire", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: "translate", lang: lang, items: parts }),
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok || !Array.isArray(d.items) || d.items.length !== parts.length) {
        if (window.console) console.warn("job translation unavailable", d && d.error);
        return null;
      }
      try { localStorage.setItem(key, JSON.stringify({ n: parts.length, parts: d.items })); } catch (e2) {}
      return d.items;
    }).catch(function () { return null; });
  }
  // Splits an advert's plain text into its intro / duties / requirements /
  // details parts so the page can show them as separate cards instead of one
  // wall of text.
  function parseAdvert(text) {
    var out = { intro: "", duties: [], reqs: [], details: "" };
    String(text || "").split(/\n\s*\n/).forEach(function (para) {
      var t = para.trim();
      if (!t) return;
      var m = t.match(/^(المهام|المسؤوليات|المتطلبات|الشروط|التفاصيل)\s*(?:والمسؤوليات)?\s*:\s*([\s\S]*)$/);
      if (!m) { out.intro += (out.intro ? "\n" : "") + t; return; }
      var head = m[1], rest = m[2].trim();
      var items = rest.split(/[؛;]\s*|\n+/).map(function (x) { return x.replace(/^[-•\s]+/, "").trim(); }).filter(Boolean);
      if (head === "المهام" || head === "المسؤوليات") out.duties = items;
      else if (head === "المتطلبات" || head === "الشروط") out.reqs = items;
      else out.details = rest;
    });
    return out;
  }
  // Renders the advert page: content from the posting API, laid out as cards,
  // with the application form scoped to this posting.
  function loadPostingPage() {
    var titleEl = document.getElementById("jp-title");
    if (!titleEl) return;
    var status = document.getElementById("jp-status");
    var id = new URLSearchParams(location.search || "").get("id") || "";
    if (!id) { status.textContent = BP.t("No job selected.", "لم تُحدَّد وظيفة."); return; }
    fetch("/api/candidates?posting=" + encodeURIComponent(id))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var j = d && d.ok && d.posting;
        if (!j) { status.textContent = BP.t("This job is no longer available.", "هذه الوظيفة لم تعد متاحة."); return; }
        status.hidden = true;
        document.getElementById("jp-body").hidden = false;
        var a = parseAdvert(j.description);
        var labels = ["نبذة عن الوظيفة", "المهام والمسؤوليات", "المتطلبات", "تفاصيل الوظيفة"];
        // One flat list keeps the translation to a single request: title,
        // then the four headings, then the content in a fixed order.
        var parts = [j.title, j.company || "—", j.city || "—", j.field || "—"].concat(labels, [a.intro, a.details], a.duties, a.reqs);
        translateParts(parts, j.id).then(function (tr) {
          var t = tr || parts;
          var nD = a.duties.length;
          render({
            title: t[0], company: t[1], city: t[2], field: t[3],
            labels: t.slice(4, 8), intro: t[8], details: t[9],
            duties: t.slice(10, 10 + nD), reqs: t.slice(10 + nD),
            translated: !!tr,
          }, j);
        });
      })
      .catch(function () { status.textContent = BP.t("Could not load this job.", "تعذّر تحميل الوظيفة."); });

    function render(v, j) {
      titleEl.textContent = v.title;
      document.title = v.title + (BP.lang === "ar" ? " — بيزنس بارتنر" : " — Business Partner");
      document.getElementById("jp-company").textContent = [v.company, v.city].filter(function (x) { return x && x !== "—"; }).join(" · ");
      document.getElementById("jp-city").textContent = v.city || "—";
      document.getElementById("jp-field").textContent = v.field || "—";
      function card(head, inner, wide) {
        return '<section class="card" style="text-align:start' + (wide ? ";grid-column:1/-1" : "") + '">' +
          "<h3>" + esc2(head) + "</h3>" + inner + "</section>";
      }
      function list(items) {
        return '<ul class="check-list" style="margin:0">' + items.map(function (x) { return "<li>" + esc2(x) + "</li>"; }).join("") + "</ul>";
      }
      function paras(text) {
        return String(text || "").split(/\n+/).filter(function (x) { return x.trim(); })
          .map(function (x) { return "<p>" + esc2(x.trim()) + "</p>"; }).join("");
      }
      var cards = "";
      if (v.intro) cards += card(v.labels[0], paras(v.intro), true);
      if (v.duties.length) cards += card(v.labels[1], list(v.duties));
      if (v.reqs.length) cards += card(v.labels[2], list(v.reqs));
      if (v.details) cards += card(v.labels[3], paras(v.details), !v.duties.length && !v.reqs.length);
      // Adverts that don't follow the sectioned format still render readably.
      if (!cards) cards = card(v.labels[0], paras(j.description), true);
      document.getElementById("jp-desc").innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;align-items:start">' + cards + "</div>" +
        (v.translated ? '<p class="emp-note" style="margin-top:10px">' + BP.t("Machine-translated from Arabic.", "ترجمة آلية من العربية.") + "</p>" : "");
      setSelectedJob(j.id, j.title);
      if (!j.open) {
        var box = document.getElementById("apply-form");
        if (box) box.insertAdjacentHTML("afterbegin", '<p class="emp-note" style="text-align:center">' + BP.t("This posting is closed — you can still join the candidate pool.", "هذا الإعلان مغلق — تقدر تنضم لقاعدة المرشحين.") + "</p>");
      }
    }
  }
  function esc2(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // Collapse whitespace/bullets and cut to a short teaser at a word boundary so
  // long job descriptions don't overflow the client-job cards.
  function clipTeaser(s, n) {
    var t = String(s == null ? "" : s).replace(/[•\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
    if (t.length <= n) return t;
    var cut = t.slice(0, n);
    var sp = cut.lastIndexOf(" ");
    if (sp > n * 0.6) cut = cut.slice(0, sp);
    return cut.replace(/[\s،,.:;-]+$/, "") + "…";
  }
  document.addEventListener("DOMContentLoaded", function () {
    loadClientJobs();
    loadPostingPage();
    var form = document.getElementById("cv-form");
    if (!form) return;
    try {
      var params = new URLSearchParams(location.search || "");
      var job = params.get("job");
      var map = {
        "hr-operations-specialist": BP.t("HR Operations & Government Relations Specialist", "أخصائي عمليات موارد بشرية وعلاقات حكومية"),
        "recruitment-coordinator": BP.t("Recruitment Coordinator", "منسق توظيف"),
      };
      if (job && map[job]) setSelectedJob(job, map[job]);
    } catch (err) {}
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = val("c-name"), phone = val("c-phone");
      if (!name || !phone) { alert(BP.t("Please enter your name and mobile.", "الرجاء إدخال الاسم ورقم الجوال.")); return; }
      var consentEl = document.getElementById("c-consent");
      if (consentEl && !consentEl.checked) { alert(BP.t("Please tick the consent box to join the pool.", "الرجاء الموافقة على الانضمام لقاعدة المرشّحين.")); return; }
      var cvEl = document.getElementById("c-cv");
      var payload = {
        name: name, phone: phone, email: val("c-email"), field: val("c-field"),
        experience: val("c-exp"), city: val("c-city"), country: val("c-country"),
        nationality: val("c-nationality"), residenceStatus: val("c-residence"),
        salary: val("c-salary"),
        linkedin: val("c-linkedin"), consent: consentEl ? consentEl.checked : false,
        jobId: val("c-job-id"), jobTitle: val("c-job-title"),
        questions: {
          interest: val("c-q1"),
          strengths: val("c-q2"),
          notice: val("c-notice"),
          workAuthorization: val("c-residence"),
        },
      };
      var btn = form.querySelector("button[type=submit]"); var lbl = btn.textContent;
      btn.disabled = true; btn.textContent = BP.t("Sending…", "جارٍ الإرسال…");

      function ok(ref) {
        var box = form.querySelector(".form-success");
        // Only prompt to send the CV over WhatsApp when the form submission
        // didn't actually include one — asking for it again after a
        // successful upload is redundant and confusing.
        var hasCv = cvEl && cvEl.files && cvEl.files.length;
        var waTxt = encodeURIComponent("تقديم مرشّح " + (ref || "") + "\nالاسم: " + name + "\nالجوال: " + phone + "\n(أرفق السيرة الذاتية هنا)");
        box.hidden = false;
        box.innerHTML = "✅ <strong>" + BP.t("You're in the candidate pool", "تم إضافتك لقاعدة المرشّحين") + (ref ? " — " + ref : "") + "</strong><br>" +
          BP.t("We'll reach out when a suitable role opens.", "سنتواصل معك عند توفّر فرصة مناسبة.") +
          (!hasCv ? "<br>" + BP.t("Send your CV file to us on WhatsApp to attach it to your profile:", "أرسل ملف سيرتك عبر واتساب لإرفاقه بملفك:") +
            ' <a class="btn btn-wa" style="margin-top:10px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + waTxt + '">' + BP.t("Send CV on WhatsApp", "أرسل السيرة عبر واتساب") + "</a>" : "");
        box.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      function fallback() {
        // Not configured / network error → keep it local + offer WhatsApp
        try { var a = JSON.parse(localStorage.getItem("bp_cv") || "[]"); a.push(payload); localStorage.setItem("bp_cv", JSON.stringify(a)); } catch (err) {}
        ok(null);
      }

      readCvFile(cvEl).then(function (cvFile) {
        if (cvFile && cvFile.tooLarge) {
          alert(BP.t("The CV file is too large. Please use WhatsApp for files over 4 MB.", "حجم السيرة كبير. استخدم واتساب للملفات أكبر من 4 ميجابايت."));
        } else if (cvFile) {
          payload.cvFile = cvFile;
        }
        return fetch("/api/candidate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      })
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          btn.textContent = lbl;
          if (res.s === 200 && res.d && res.d.ok) ok(res.d.ref);
          else fallback();
        })
        .catch(function () { btn.textContent = lbl; fallback(); });
    });
  });
})();

/* ---------- Careers: track my application status ---------- */
(function () {
  "use strict";
  function esc4(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("track-form");
    if (!form) return;
    var result = document.getElementById("track-result");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var phone = document.getElementById("tr-phone").value.trim();
      var email = document.getElementById("tr-email").value.trim();
      if (!phone || !email) return;
      var btn = form.querySelector("button[type=submit]"); var lbl = btn.textContent;
      btn.disabled = true; btn.textContent = BP.t("Checking…", "جارٍ التحقق…");
      fetch("/api/candidate?phone=" + encodeURIComponent(phone) + "&email=" + encodeURIComponent(email))
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          btn.disabled = false; btn.textContent = lbl;
          result.hidden = false;
          if (res.s === 200 && res.d && res.d.ok) {
            var c = res.d.candidate;
            var rows = [
              [BP.t("Name", "الاسم"), c.name],
              [BP.t("Field", "المجال"), c.field],
              [BP.t("City", "المدينة"), [c.city, c.country].filter(Boolean).join(" — ")],
              [BP.t("Status", "الحالة"), c.pipelineStage],
            ].filter(function (r) { return r[1]; });
            var links = "";
            if (c.atsCvLink) links += '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc4(c.atsCvLink) + '">' + BP.t("View ATS CV", "عرض السيرة الذاتية") + "</a>";
            result.innerHTML = '<div class="card">' + rows.map(function (r) { return "<p><b>" + esc4(r[0]) + ":</b> " + esc4(r[1]) + "</p>"; }).join("") +
              (links ? '<div class="talent-actions" style="margin-top:10px">' + links + "</div>" : "") + "</div>";
          } else if (res.s === 404) {
            result.innerHTML = '<p class="text-soft center">' + BP.t("No application found with this phone and email.", "لا يوجد طلب بهذا الجوال والبريد.") + "</p>";
          } else {
            result.innerHTML = '<p class="text-soft center">' + BP.t("Couldn't check status right now.", "تعذّر التحقق من الحالة الآن.") + "</p>";
          }
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = lbl;
          result.hidden = false;
          result.innerHTML = '<p class="text-soft center">' + BP.t("Couldn't check status right now.", "تعذّر التحقق من الحالة الآن.") + "</p>";
        });
    });
  });
})();

/* ---------- Live news feed (reads straight from Notion, no redeploy) ---------- */
(function () {
  "use strict";
  function esc3(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // The daily digest is Arabic-only source content — split it into clean
  // bullet lines instead of dumping one dense paragraph, and pull the
  // "source:" boilerplate out into its own small line.
  function newsCard(it) {
    var raw = String(it.text || "").replace(/\r/g, "");
    var lines = raw.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    var sourceLine = null;
    var content = [];
    lines.forEach(function (l) {
      if (/^(المصدر|Source)\s*[:：]/i.test(l)) { sourceLine = l; return; }
      content.push(l.replace(/^[-•*]\s*/, "").replace(/^\d+[.\)]\s*/, ""));
    });
    if (content.length > 1 && /^(نشرة|عنوان)/.test(content[0])) content.shift();
    var listHtml = content.length > 1
      ? '<ul class="news-list">' + content.map(function (c) { return "<li>" + esc3(c) + "</li>"; }).join("") + "</ul>"
      : '<p class="desc">' + esc3(content[0] || raw) + "</p>";
    var sourceHtml = sourceLine ? '<p class="news-source">' + esc3(sourceLine) + "</p>" : "";
    return '<div class="card news-card"><span class="tag">📅 ' + esc3(it.date) + "</span>" + listHtml + sourceHtml + "</div>";
  }
  document.addEventListener("DOMContentLoaded", function () {
    var boxes = document.querySelectorAll("[data-live-news]");
    if (!boxes.length) return;
    boxes.forEach(function (box) {
      // Source content is Arabic-only — showing it raw on English pages reads
      // as broken, so point English visitors to the Arabic page instead.
      if (BP.lang !== "ar") {
        var arHref = location.pathname === "/" ? "/ar/" : "/ar" + location.pathname;
        box.innerHTML = '<p class="text-soft">' + BP.t("This live feed is currently Arabic-only.", "") +
          ' <a href="' + arHref + '">' + BP.t("View the Arabic page", "") + "</a></p>";
        return;
      }
      var limit = box.getAttribute("data-live-news") || "6";
      box.innerHTML = '<p class="text-soft">جارٍ تحميل آخر الأخبار…</p>';
      fetch("/api/newsletter?feed=news&limit=" + encodeURIComponent(limit))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok || !d.items || !d.items.length) {
            box.innerHTML = '<p class="text-soft">لا توجد أخبار لعرضها حالياً.</p>';
            return;
          }
          box.innerHTML = d.items.map(newsCard).join("");
          if (box.getAttribute("data-auto-print")) setTimeout(function () { window.print(); }, 400);
        })
        .catch(function () {
          box.innerHTML = '<p class="text-soft">تعذّر تحميل آخر الأخبار. حاول مرة أخرى بعد قليل.</p>';
        });
    });
  });
})();

/* ---------- Magazine PDF download gate ---------- */
(function () {
  "use strict";
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("mag-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = val("mag-name"), phone = val("mag-phone"), email = val("mag-email");
      if (!name || !phone || !email) { alert(BP.t("Please fill all fields.", "الرجاء تعبئة كل الحقول.")); return; }
      var btn = form.querySelector("button[type=submit]"); var lbl = btn.textContent;
      btn.disabled = true; btn.textContent = BP.t("Sending…", "جارٍ الإرسال…");
      fetch("/api/requests", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "magazine", name: name, phone: phone, email: email }),
      }).then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          btn.textContent = lbl;
          var box = document.getElementById("mag-success");
          if (res.d && res.d.ok) {
            box.hidden = false;
            box.innerHTML = "✅ " + BP.t("Opening your printable issue — also emailed to you.", "جارٍ فتح عددك القابل للطباعة — أرسلناه لبريدك أيضاً.");
            window.open(res.d.printUrl || "/magazine/print", "_blank");
          } else {
            btn.disabled = false;
            alert(BP.t("Couldn't send. Try again.", "تعذّر الإرسال. حاول مرة أخرى."));
          }
        })
        .catch(function () { btn.disabled = false; btn.textContent = lbl; alert(BP.t("Couldn't send. Try again.", "تعذّر الإرسال. حاول مرة أخرى.")); });
    });
  });
})();

/* ---------- Checkout submit ---------- */
(function () {
  "use strict";
  function checkoutSession() { try { return JSON.parse(localStorage.getItem("bp_session") || "null"); } catch (e) { return null; } }

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("checkout-form");
    if (!form) return;
    // Whose name the tax invoice is issued in. A standard (company) tax invoice
    // carries the buyer's VAT number and national address and cannot be
    // corrected after issuance, so those fields are required up front rather
    // than chased afterwards.
    (function () {
      var box = document.getElementById("co-tax-company");
      if (!box) return;
      var radios = form.querySelectorAll('input[name="taxkind"]');
      function sync() {
        var company = false;
        for (var i = 0; i < radios.length; i++) if (radios[i].checked && radios[i].value === "company") company = true;
        box.hidden = !company;
      }
      for (var i = 0; i < radios.length; i++) radios[i].addEventListener("change", sync);

      // Read the buyer's certificate and fill the fields. The result is a
      // starting point they confirm, never a silent submission: a wrong VAT
      // number on an issued tax invoice can only be voided, not corrected.
      var docIn = document.getElementById("co-tax-doc");
      if (docIn) docIn.addEventListener("change", function () {
        var file = this.files && this.files[0];
        var msg = document.getElementById("taxdoc-msg");
        var nameEl = document.getElementById("taxdoc-filename");
        if (!file || !msg) return;
        if (file.size > 6 * 1024 * 1024) { msg.hidden = false; msg.className = "calc-note err"; msg.textContent = BP.t("File must be under 6MB.", "حجم الملف يجب أن يكون أقل من ٦ ميجابايت."); return; }
        if (nameEl) nameEl.textContent = file.name;
        msg.hidden = false; msg.className = "calc-note"; msg.textContent = BP.t("Reading the document…", "⏳ جاري قراءة المستند…");
        var fr = new FileReader();
        fr.onload = function () {
          fetch("/api/requests", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "read-doc", fileBase64: String(fr.result).split(",")[1] || "", fileType: file.type || "" })
          }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d || !d.ok) {
              msg.className = "calc-note err";
              msg.textContent = d && d.error === "not_configured"
                ? BP.t("Automatic reading is unavailable — please fill the fields below.", "القراءة التلقائية غير متاحة — رجاءً عبّئ الحقول بالأسفل.")
                : BP.t("Couldn't read the document — please fill the fields below.", "ما قدرت أقرأ المستند — رجاءً عبّئ الحقول بالأسفل.");
              return;
            }
            var f = d.fields, filled = [], set = function (id, v) { var el = document.getElementById(id); if (el && v) { el.value = v; filled.push(id); } };
            set("co-tax-name", f.companyNameAr || f.companyNameEn);
            set("co-tax-vat", f.vatNumber); set("co-tax-cr", f.crNumber);
            set("co-tax-contact", f.contactName); set("co-tax-mobile", f.contactPhone);
            var a = f.address || {};
            set("co-na-bno", a.buildingNo); set("co-na-street", a.street); set("co-na-district", a.district);
            set("co-na-city", a.city); set("co-na-post", a.postalCode); set("co-na-add", a.additionalNo);
            if (!filled.length) { msg.className = "calc-note warn"; msg.textContent = BP.t("Nothing readable was found in this document — please fill the fields below.", "ما لقيت بيانات واضحة في هذا المستند — رجاءً عبّئ الحقول بالأسفل."); return; }
            msg.className = "calc-note ok";
            msg.textContent = BP.t("Filled " + filled.length + " field(s) — please check them before continuing.", "عبّيت " + filled.length + " حقلاً — راجعها قبل المتابعة.")
              + (f.vatSuspect ? BP.t(" A number that isn't 15 digits was ignored: " + f.vatSuspect, " وتجاهلت رقماً ليس 15 خانة: " + f.vatSuspect) : "");
          }).catch(function () {
            msg.className = "calc-note err";
            msg.textContent = BP.t("Couldn't read the document — please fill the fields below.", "ما قدرت أقرأ المستند — رجاءً عبّئ الحقول بالأسفل.");
          });
        };
        fr.readAsDataURL(file);
      });
      // Prefill from the last company checkout so a returning buyer types nothing.
      try {
        var bc = JSON.parse(localStorage.getItem("bp_company") || "{}");
        var set = function (id, v) { var el = document.getElementById(id); if (el && v && !el.value) el.value = v; };
        set("co-tax-name", bc.nameAr || bc.name); set("co-tax-vat", bc.vat); set("co-tax-cr", bc.cr);
        set("co-tax-contact", bc.contact); set("co-tax-mobile", bc.contactPhone);
        var a = bc.address || {};
        set("co-na-bno", a.buildingNo); set("co-na-street", a.street); set("co-na-district", a.district);
        set("co-na-city", a.city); set("co-na-post", a.postalCode); set("co-na-add", a.additionalNo);
        if (bc.vat) { for (var j = 0; j < radios.length; j++) if (radios[j].value === "company") radios[j].checked = true; }
      } catch (e) {}
      sync();
    })();
    // Registration is mandatory before checkout — no guest purchases. Bounce
    // straight to /account and bring the customer back here once signed in.
    var session = checkoutSession();
    if (!session) {
      location.href = (BP.lang === "ar" ? "/ar/account" : "/account") + "?redirect=checkout";
      return;
    }
    // Name + email come from the signed-in account, phone from the saved
    // profile of the previous order — a returning client lands on a form
    // that is already filled and only uploads the receipt.
    var profile = {}; try { profile = JSON.parse(localStorage.getItem("bp_profile") || "{}"); } catch (e9) {}
    if (session) {
      var nameEl = document.getElementById("co-name"), emailEl = document.getElementById("co-email");
      var phonePre = document.getElementById("co-phone");
      if (emailEl) { emailEl.value = session.email || ""; emailEl.readOnly = true; }
      if (nameEl) {
        nameEl.value = session.name || profile.name || "";
        // Lock the name only when the account actually has one — an empty
        // readonly field would make checkout impossible to complete.
        nameEl.readOnly = !!nameEl.value;
      }
      if (phonePre && !phonePre.value && profile.phone) phonePre.value = profile.phone;
    }

    // Packages need establishment details (CR number, headcount, national
    // address) before payment, same as the reference competitor flow, and
    // per-extra-employee surcharges (already priced per package) apply once
    // headcount is entered.
    var pkgBox = document.getElementById("pkg-details-box");
    var entityLabel = document.getElementById("co-entity-label");
    var headcountEl = document.getElementById("co-headcount");
    var crEl = document.getElementById("co-cr");
    var entityEl = document.getElementById("co-entity");
    function cartHasPackage() { return BP.cart.read().some(function (i) { return i.kind === "package"; }); }
    function togglePkgBox() {
      var hasPkg = cartHasPackage();
      if (pkgBox) pkgBox.hidden = !hasPkg;
      if (entityLabel) entityLabel.textContent = hasPkg ? BP.t("Company name *", "اسم الشركة *") : BP.t("Company / entity (optional)", "المنشأة (اختياري)");
      if (entityEl) entityEl.required = hasPkg;
      if (crEl) crEl.required = hasPkg;
    }
    togglePkgBox();

    // Pre-fill from the company profile saved earlier in the account dashboard, if any.
    try {
      var savedCompany = JSON.parse(localStorage.getItem("bp_company") || "{}");
      if (savedCompany.name && entityEl && !entityEl.value) entityEl.value = savedCompany.name;
      if (savedCompany.cr && crEl && !crEl.value) crEl.value = savedCompany.cr;
      if (savedCompany.size && headcountEl && headcountEl.value === "1") headcountEl.value = savedCompany.size;
    } catch (e1) {}

    BP.extraCheckoutFee = function () {
      var hc = headcountEl ? parseInt(headcountEl.value, 10) || 0 : 0;
      return BP.cart.read().reduce(function (s, i) {
        if (i.kind === "package" && i.surchargeAmount) {
          var extraHeads = Math.max(0, hc - (i.surchargeFreeCount || 0));
          s += extraHeads * i.surchargeAmount * (i.qty || 1);
        }
        return s;
      }, 0);
    };
    function renderSurchargeNote() {
      var note = document.getElementById("pkg-surcharge-note");
      if (!note) return;
      var fee = BP.extraCheckoutFee();
      if (fee > 0 && BP.pricesOn) {
        note.hidden = false;
        note.textContent = BP.t("Extra employee fee included: ", "رسوم الموظفين الإضافيين مضمّنة: ") + BP.money(fee);
      } else {
        note.hidden = true;
      }
      BP.renderCheckout();
    }
    if (headcountEl) headcountEl.addEventListener("input", renderSurchargeNote);
    renderSurchargeNote();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var cart = BP.cart.read();
      if (!cart.length) { alert(BP.t("Your cart is empty.", "سلتك فارغة.")); location.href = BP.lang === "ar" ? "/ar/services" : "/services"; return; }
      var session2 = checkoutSession();
      var name = (session2 && session2.name) || document.getElementById("co-name").value.trim();
      var phone = document.getElementById("co-phone").value.trim();
      var email = ((session2 && session2.email) || document.getElementById("co-email").value.trim()).toLowerCase();
      var isEmailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
      if (!name || !phone || !isEmailValid) { alert(BP.t("Please sign in to your account, then enter your mobile.", "سجّل الدخول لحسابك أولاً، ثم أدخل رقم جوالك.")); if (!session2) location.href = BP.lang === "ar" ? "/ar/account" : "/account"; return; }
      var pkgVisible = pkgBox && !pkgBox.hidden;
      var companyName = entityEl ? entityEl.value.trim() : "";
      var crNumber = crEl ? crEl.value.trim() : "";
      var headcount = headcountEl ? (parseInt(headcountEl.value, 10) || 0) : 0;
      var nationalAddress = document.getElementById("co-address") ? document.getElementById("co-address").value.trim() : "";
      if (pkgVisible && (!companyName || !crNumber)) { alert(BP.t("Please enter the company name and Commercial Registration number for your package subscription.", "الرجاء إدخال اسم الشركة ورقم السجل التجاري للاشتراك في الباقة.")); return; }
      // Tax-invoice profile. Collected here because a standard tax invoice
      // cannot be amended once issued — a missing VAT number or national
      // address means a void-and-reissue, not an edit.
      var val = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; };
      var taxKind = "personal";
      var tkRadios = form.querySelectorAll('input[name="taxkind"]');
      for (var tk = 0; tk < tkRadios.length; tk++) if (tkRadios[tk].checked) taxKind = tkRadios[tk].value;
      var taxProfile = { kind: taxKind };
      if (taxKind === "company") {
        var vatNo = val("co-tax-vat").replace(/\D/g, "");
        var addr = {
          buildingNo: val("co-na-bno"), street: val("co-na-street"), district: val("co-na-district"),
          city: val("co-na-city"), postalCode: val("co-na-post"), additionalNo: val("co-na-add")
        };
        if (!val("co-tax-name")) { alert(BP.t("Enter the company name in Arabic as registered.", "أدخل اسم الشركة بالعربي كما هو في السجل.")); return; }
        if (vatNo.length !== 15) { alert(BP.t("The VAT number must be exactly 15 digits.", "الرقم الضريبي يجب أن يكون ١٥ رقماً بالضبط.")); return; }
        if (!val("co-tax-contact") || !val("co-tax-mobile")) { alert(BP.t("Enter the responsible person's name and mobile.", "أدخل اسم الشخص المسؤول ورقم جواله.")); return; }
        if (!addr.buildingNo || !addr.street || !addr.district || !addr.city || !addr.postalCode) {
          alert(BP.t("Complete the national address: building number, street, district, city and postal code.", "أكمل العنوان الوطني: رقم المبنى، الشارع، الحي، المدينة، والرمز البريدي.")); return;
        }
        taxProfile = {
          kind: "company", nameAr: val("co-tax-name"), vat: vatNo, cr: val("co-tax-cr"),
          contact: val("co-tax-contact"), contactPhone: val("co-tax-mobile"), address: addr
        };
      }
      var termsBox = document.getElementById("co-terms");
      if (termsBox && !termsBox.checked) { alert(BP.t("Please agree to the Terms & Conditions to continue.", "الرجاء الموافقة على الشروط والأحكام للمتابعة.")); return; }
      var receipt = document.getElementById("co-receipt");
      var receiptFile = receipt && receipt.files && receipt.files.length ? receipt.files[0] : null;
      var okReceipt = receiptFile && (
        receiptFile.type === "application/pdf" || /\.pdf$/i.test(receiptFile.name || "") ||
        /^image\//.test(receiptFile.type || "") || /\.(jpe?g|png|webp)$/i.test(receiptFile.name || "")
      );
      if (!receiptFile) { alert(BP.t("A bank transfer receipt (image or PDF) is required to submit your order.", "إيصال التحويل البنكي (صورة أو PDF) إلزامي لإرسال الطلب.")); return; }
      if (!okReceipt) { alert(BP.t("The receipt must be an image or PDF file matching your order total.", "يجب أن يكون الإيصال صورة أو ملف PDF ويطابق إجمالي طلبك.")); return; }
      var ref = "BP-" + Date.now().toString().slice(-6);
      var docs = document.getElementById("co-docs");
      var files = [];
      [docs, receipt].forEach(function (inp) { if (inp && inp.files) for (var i = 0; i < inp.files.length; i++) files.push(inp.files[i].name); });
      var surchargeFee = BP.extraCheckoutFee ? BP.extraCheckoutFee() : 0;
      // VAT-inclusive total — must equal the total shown on the page and the
      // amount on the client's bank receipt, or auto-verification can't match.
      var subTotal = (cart.reduce(function (s, i) { return s + (i.amount ? i.amount * (i.qty || 1) : 0); }, 0) || 0) + surchargeFee;
      var total = Math.round(subTotal * 1.15 * 100) / 100;
      var order = {
        ref: ref, name: name, phone: phone, email: email,
        items: cart.map(function (i) { return { id: i.id || "", name: BP.cartName(i), qty: i.qty || 1, price: i.amount ? i.amount * (i.qty || 1) : null, priceLabel: i.price }; }),
        files: files, receipt: receiptFile.name,
        at: new Date().toISOString().slice(0, 10), status: BP.t("Under review", "قيد المراجعة"),
      };
      try {
        var orders = JSON.parse(localStorage.getItem("bp_orders") || "[]");
        orders.unshift(order);
        localStorage.setItem("bp_orders", JSON.stringify(orders));
      } catch (err) {}
      // Remember the client's details so the next checkout is prefilled.
      try {
        localStorage.setItem("bp_profile", JSON.stringify({ name: name, phone: phone }));
        var s3 = checkoutSession();
        if (s3 && !s3.name && name) { s3.name = name; localStorage.setItem("bp_session", JSON.stringify(s3)); }
        if (companyName || taxProfile.kind === "company") {
          var bc = {}; try { bc = JSON.parse(localStorage.getItem("bp_company") || "{}"); } catch (e7) {}
          if (!bc.name) bc.name = companyName;
          if (!bc.cr && crNumber) bc.cr = crNumber;
          if (taxProfile.kind === "company") {
            bc.nameAr = taxProfile.nameAr; bc.vat = taxProfile.vat;
            if (taxProfile.cr) bc.cr = taxProfile.cr;
            bc.contact = taxProfile.contact; bc.contactPhone = taxProfile.contactPhone;
            bc.address = taxProfile.address;
          }
          localStorage.setItem("bp_company", JSON.stringify(bc));
        }
      } catch (e8) {}
      // Register the order with the team + CRM (best-effort; never blocks the client) and
      // upload the receipt PDF so the n8n verification agent can check it matches the total.
      var employeeSlugs = cart.filter(function (i) { return i.kind === "employee" && (i.id || "").indexOf("employee-") === 0; })
        .map(function (i) { return i.id.slice("employee-".length); });
      // The shared-services team SKU entitles the buyer to every employee: the
      // "all" marker becomes AGENTS:all in the CRM row, which the portal login
      // resolves to full access once the payment is confirmed.
      if (cart.some(function (i) { return (i.id || "").indexOf("agent-Shared-services") === 0; })) employeeSlugs.push("all");
      var boughtCompliance = cart.some(function (i) { return (i.id || "").indexOf("agent-Compliance") === 0; });
      var employerPlanItem = cart.filter(function (i) { return (i.id || "").indexOf("employer-plan-") === 0; })[0];
      var employerPlanKey = employerPlanItem ? employerPlanItem.id.replace("employer-plan-", "").replace(/-monthly$|-yearly$/, "") : "";
      var employerBilling = employerPlanItem && /-yearly$/.test(employerPlanItem.id) ? "yearly" : "monthly";
      var companyProfile = {}; try { companyProfile = JSON.parse(localStorage.getItem("bp_company") || "{}"); } catch (e0) {}
      function sendOrder(receiptBase64) {
        try {
          fetch("/api/requests", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({
              type: "order", ref: ref, name: name, phone: phone, email: email,
              items: order.items.map(function (i) { return i.name + " ×" + (i.qty || 1); }),
              itemsData: cart.map(function (i) { return { id: i.id || "", qty: i.qty || 1, price: i.amount || 0 }; }),
              total: total,
              agents: employeeSlugs,
              compliance: boughtCompliance,
              employerPlan: employerPlanKey, employerBilling: employerBilling,
              company: companyName || companyProfile.name || "",
              cr: crNumber, headcount: pkgVisible ? headcount : "", nationalAddress: nationalAddress, surchargeFee: surchargeFee,
              taxProfile: taxProfile,
              receiptName: receiptFile.name, receiptType: receiptFile.type || "", receiptBase64: receiptBase64 || ""
            })
          }).catch(function () {});
        } catch (e) {}
      }
      var reader = new FileReader();
      reader.onload = function () { sendOrder(String(reader.result || "").split(",").pop()); };
      reader.onerror = function () { sendOrder(""); };
      reader.readAsDataURL(receiptFile);
      BP.cart.write([]);
      var box = document.getElementById("checkout-success");
      box.hidden = false;
      box.innerHTML = "✅ <strong>" + BP.t("Order received", "تم استلام طلبك") + "</strong><br>" +
        BP.t("Order number: ", "رقم الطلب: ") + "<strong dir=\"ltr\">" + ref + "</strong><br>" +
        BP.t("Status: pending verification — your receipt is being checked against your order total.", "الحالة: بانتظار التحقق — يجري فحص إيصالك ومطابقته مع إجمالي طلبك.") + "<br>" +
        '<a class="btn btn-primary" style="margin-top:12px;display:inline-flex" href="' + (BP.lang === "ar" ? "/ar/account" : "/account") + '">' +
        BP.t("Back to client portal", "العودة إلى بوابة العميل") + "</a>";
      box.scrollIntoView({ behavior: "smooth", block: "center" });
      form.querySelector("button[type=submit]").disabled = true;
      BP.renderCheckout();
    });
  });
})();

/* ---------- Header account button: reflect the signed-in user ---------- */
(function () {
  "use strict";
  function lbl(en, ar) { return (window.BP && BP.lang === "ar") ? ar : en; }
  function upd() {
    var a = document.querySelector("[data-account-link]");
    if (!a) return;
    var span = a.querySelector("[data-account-label]");
    var ses = null; try { ses = JSON.parse(localStorage.getItem("bp_session") || "null"); } catch (e) {}
    if (ses) {
      var comp = {}; try { comp = JSON.parse(localStorage.getItem("bp_company") || "{}"); } catch (e2) {}
      var name = (ses.name && ses.name.trim()) || (comp.name && comp.name.trim()) || (ses.email ? ses.email.split("@")[0] : "");
      if (!name) name = lbl("My account", "حسابي");
      if (span) span.textContent = name.length > 20 ? name.slice(0, 19) + "…" : name;
      a.setAttribute("aria-label", name);
      a.classList.add("hdr-btn--signedin");
    } else {
      if (span) span.textContent = lbl("Sign in", "تسجيل الدخول");
      a.setAttribute("aria-label", lbl("Sign in", "تسجيل الدخول"));
      a.classList.remove("hdr-btn--signedin");
    }
  }
  document.addEventListener("DOMContentLoaded", upd);
  document.addEventListener("bp:auth", upd);
  document.addEventListener("bp:langchange", upd);
  window.addEventListener("storage", function (e) { if (!e || e.key === "bp_session" || e.key === "bp_company") upd(); });
})();

/* ---------- Account (client-side demo auth + dashboard) ---------- */
(function () {
  "use strict";
  function session() { try { return JSON.parse(localStorage.getItem("bp_session") || "null"); } catch (e) { return null; } }
  function users() { try { return JSON.parse(localStorage.getItem("bp_users") || "{}"); } catch (e) { return {}; } }
  function saveUsers(u) { try { localStorage.setItem("bp_users", JSON.stringify(u)); } catch (e) {} }

  document.addEventListener("DOMContentLoaded", function () {
    var auth = document.getElementById("account-auth");
    var dash = document.getElementById("account-dash");
    if (!auth || !dash) return;

    var tabs = auth.querySelectorAll(".auth-tab");
    var loginF = document.getElementById("login-form");
    var regF = document.getElementById("register-form");
    var otpF = document.getElementById("otp-form");
    var pending = null; // { name, email, phone, pass, challenge }
    var redirectKind = new URLSearchParams(location.search).get("redirect");
    if (redirectKind === "checkout") {
      var note = document.getElementById("checkout-redirect-note");
      if (note) note.hidden = false;
    } else if (redirectKind === "quote") {
      var qnote = document.getElementById("quote-redirect-note");
      if (qnote) qnote.hidden = false;
    } else if (redirectKind === "formation") {
      var fnote = document.getElementById("fc-redirect-note");
      if (fnote) fnote.hidden = false;
    }
    tabs.forEach(function (tb) {
      tb.addEventListener("click", function () {
        tabs.forEach(function (x) { x.classList.remove("active"); });
        tb.classList.add("active");
        var t = tb.getAttribute("data-tab");
        loginF.hidden = t !== "login";
        regF.hidden = t !== "register";
        if (otpF) otpF.hidden = true; // leaving a flow resets the code step
      });
    });

    // A quote request stashed by the cost calculator (bp_pending_quote) becomes
    // a real dashboard request the moment the visitor is signed in — that's the
    // whole flow: calculator → register/sign in → the request shows in المهام.
    function consumePendingQuote(s) {
      var pending = null;
      try { pending = JSON.parse(localStorage.getItem("bp_pending_quote") || "null"); } catch (e) {}
      if (!pending || !pending.items || !pending.items.length) return;
      try { localStorage.removeItem("bp_pending_quote"); } catch (e) {}
      var ref = "BPQ-" + Date.now().toString().slice(-6);
      var order = {
        ref: ref, name: s.name || "", email: s.email || "",
        items: pending.items.map(function (i) { return { name: (BP.lang === "ar" ? i.nameAr : i.nameEn) || i.nameAr || i.nameEn, qty: 1, priceLabel: i.price }; }),
        at: new Date().toISOString().slice(0, 10),
        status: BP.t("Quote requested", "بانتظار التسعير"),
      };
      var orders = ordersData();
      orders.unshift(order);
      try { localStorage.setItem("bp_orders", JSON.stringify(orders)); } catch (e) {}
      try {
        fetch("/api/requests", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "quote", ref: ref, name: s.name || "", email: s.email || "", phone: s.phone || "", items: order.items.map(function (i) { return i.name; }) }),
        }).catch(function () {});
      } catch (e) {}
    }

    function render() {
      var s = session();
      if (s) {
        auth.hidden = true; dash.hidden = false;
        consumePendingQuote(s);
        var nm = s.name || s.email;
        document.getElementById("dash-hello").textContent = BP.t("Welcome, ", "مرحباً، ") + nm;
        document.getElementById("dash-email").textContent = s.email;
        var av = document.getElementById("dash-avatar");
        if (av) av.textContent = (nm || "BP").trim().slice(0, 2).toUpperCase();
        renderOrders();
        renderCompany();
        syncLiveOrderStatuses();
        var aiLink = document.getElementById("ai-employees-link");
        if (aiLink && s.email) aiLink.href = aiLink.getAttribute("href") + "?email=" + encodeURIComponent(s.email);
      } else { auth.hidden = false; dash.hidden = true; }
    }

    // Dashboard panel navigation
    (function () {
      var navis = document.querySelectorAll(".dash-navi");
      navis.forEach(function (b) {
        b.addEventListener("click", function () {
          var key = b.getAttribute("data-panel");
          navis.forEach(function (x) { x.classList.remove("active"); });
          b.classList.add("active");
          document.querySelectorAll(".dash-panel").forEach(function (p) { p.classList.remove("active"); });
          var panel = document.getElementById("panel-" + key);
          if (panel) panel.classList.add("active");
        });
      });
    })();

    // Company profile (saved locally per this device)
    var COMPANY_KEY = "bp_company";
    var COMPANY_FIELDS = ["name", "cr", "city", "vat", "activity", "size"];
    function renderCompany() {
      var data = {};
      try { data = JSON.parse(localStorage.getItem(COMPANY_KEY) || "{}"); } catch (e) {}
      var filled = 0;
      document.querySelectorAll("#company-form [data-k]").forEach(function (inp) {
        var k = inp.getAttribute("data-k");
        if (data[k] != null && data[k] !== "") { inp.value = data[k]; filled++; }
      });
      var bar = document.getElementById("co-progress-bar");
      var cnt = document.getElementById("co-progress-count");
      if (bar) bar.style.width = Math.round((filled / COMPANY_FIELDS.length) * 100) + "%";
      if (cnt) cnt.textContent = filled + "/" + COMPANY_FIELDS.length;
    }
    var companyForm = document.getElementById("company-form");
    if (companyForm) {
      companyForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var data = {};
        companyForm.querySelectorAll("[data-k]").forEach(function (inp) { data[inp.getAttribute("data-k")] = inp.value.trim(); });
        try { localStorage.setItem(COMPANY_KEY, JSON.stringify(data)); } catch (er) {}
        renderCompany();
        var ok = document.getElementById("company-saved");
        if (ok) { ok.hidden = false; setTimeout(function () { ok.hidden = true; }, 2200); }
      });
    }

    function esc2(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function ordersData() { try { return JSON.parse(localStorage.getItem("bp_orders") || "[]"); } catch (e) { return []; } }
    function isDone(st) { return /done|complete|منته|مكتمل|مُنجز/i.test(st || ""); }
    function isCancelled(st) { return /cancel|ملغ/i.test(st || ""); }

    // Live status (set by the ops team in Notion after confirming payment).
    var LIVE_STATUS_LABEL = {
      "قيد المراجعة": ["Under review", "قيد المراجعة"],
      "بانتظار التسعير": ["Quote in progress", "بانتظار التسعير"],
      "بانتظار الدفع": ["Awaiting payment", "بانتظار الدفع"],
      "مؤكد - قيد التنفيذ": ["Confirmed — in progress", "مؤكد - قيد التنفيذ"],
      "مكتمل": ["Completed", "مكتمل"],
      "ملغي": ["Cancelled", "ملغي"],
    };
    function syncLiveOrderStatuses() {
      var orders = ordersData();
      var refs = orders.map(function (o) { return o.ref; }).filter(Boolean);
      if (!refs.length) return;
      fetch("/api/requests?refs=" + encodeURIComponent(refs.join(",")))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok || !d.statuses) return;
          var changed = false;
          orders.forEach(function (o) {
            var live = d.statuses[o.ref];
            var label = live && LIVE_STATUS_LABEL[live];
            var text = label ? BP.t(label[0], label[1]) : null;
            if (text && text !== o.status) { o.status = text; changed = true; }
          });
          if (changed) {
            try { localStorage.setItem("bp_orders", JSON.stringify(orders)); } catch (e) {}
            renderOrders();
          }
        })
        .catch(function () {});
    }

    function orderCard(o) {
      var items = (o.items || []).map(function (i) { return esc2(i.name) + " ×" + (i.qty || 1); }).join("، ");
      var done = isDone(o.status);
      var cancelled = isCancelled(o.status);
      var cls = cancelled ? "off" : (done ? "ok" : "wait");
      var waMsg = BP.t("Regarding my request ", "بخصوص طلبي ") + (o.ref || "");
      var waIcon = '<a class="ord-wa" href="https://wa.me/966507034157?text=' + encodeURIComponent(waMsg) +
        '" target="_blank" rel="noopener" title="' + BP.t("Contact us on WhatsApp", "تواصل معنا عبر واتساب") + '" aria-label="WhatsApp">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 00-7.7 13.6L3 21l4.5-1.2A9 9 0 1012 3zm0 2a7 7 0 11-3.6 13l-.3-.2-2.3.6.6-2.2-.2-.3A7 7 0 0112 5zm3.9 8.4c-.2-.1-1.3-.6-1.5-.7-.2-.1-.3-.1-.5.1l-.6.8c-.1.1-.2.1-.4 0-.2-.1-.9-.3-1.6-1-.6-.5-1-1.2-1.1-1.4-.1-.2 0-.3.1-.4l.3-.4.2-.3v-.3c0-.1-.5-1.2-.7-1.6-.2-.4-.3-.4-.5-.4h-.4c-.1 0-.4.1-.5.3-.2.2-.7.7-.7 1.7s.7 2 .8 2.1c.1.2 1.5 2.3 3.6 3.1 1.7.7 2 .6 2.4.5.4 0 1.3-.5 1.4-1 .2-.5.2-.9.1-1z"/></svg></a>';
      var cancelBtn = (!cancelled && !done)
        ? '<button type="button" class="ord-cancel" data-ref="' + esc2(o.ref) + '" data-email="' + esc2(o.email || "") + '" data-name="' + esc2(o.name || "") + '">' + BP.t("Cancel order", "إلغاء الطلب") + '</button>'
        : "";
      return '<div class="ord"><div class="ord-main"><strong>' + esc2(o.ref) + '</strong>' +
        '<span class="text-soft"> · ' + esc2(o.at || "") + '</span>' +
        '<div class="text-soft ord-items">' + items + '</div></div>' +
        '<div class="ord-side"><span class="ord-status ' + cls + '">' + esc2(o.status || BP.t("In review", "قيد المراجعة")) + '</span>' + waIcon + cancelBtn + '</div></div>';
    }

    function renderOrders() {
      // Only this account's requests: orders on this device made under another
      // email stay stored but never render for the current session. Entries
      // without an email (legacy) are kept visible.
      var s0 = session();
      var orders = ordersData().filter(function (o) { return !o.email || !s0 || String(o.email).toLowerCase() === String(s0.email || "").toLowerCase(); });
      var total = orders.length;
      var done = orders.filter(function (o) { return isDone(o.status); }).length;
      var active = total - done;
      function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
      set("stat-total", total); set("stat-active", active); set("stat-done", done);
      var badge = document.getElementById("nav-orders-badge");
      if (badge) { badge.textContent = total; badge.hidden = total === 0; }

      var ov = document.getElementById("ov-orders");
      var all = document.getElementById("all-orders");
      if (orders.length) {
        var recent = orders.slice(-4).reverse().map(orderCard).join("");
        if (ov) ov.innerHTML = recent;
        if (all) all.innerHTML = orders.slice().reverse().map(orderCard).join("");
      }

      // Documents from order attachments
      var files = orders.reduce(function (a, o) { return a.concat(o.files || [], o.receipt ? [o.receipt] : []); }, []);
      var uw = document.getElementById("all-uploads");
      if (uw && files.length) uw.innerHTML = files.map(function (f) { return '<div class="upl">📎 ' + esc2(f) + '</div>'; }).join("");

      // Active package = latest order line of kind "package"
      var pkgItem = null;
      orders.forEach(function (o) { (o.items || []).forEach(function (i) { if (i.kind === "package") pkgItem = i; }); });
      var pb = document.getElementById("pkg-box");
      if (pb && pkgItem) {
        pb.innerHTML = '<div class="dash-card pkg-active"><span class="pkg-tag">' + BP.t("Active", "مفعّلة") + '</span>' +
          '<h3>' + esc2(pkgItem.name) + '</h3>' +
          '<p class="text-soft">' + BP.t("Your consultant is setting up the services included in this package.", "مستشارك يجهّز الخدمات المشمولة في هذه الباقة.") + '</p>' +
          '<a class="btn btn-ghost" href="' + (BP.lang === "ar" ? "/ar" : "") + '/packages">' + BP.t("View package details", "تفاصيل الباقة") + '</a></div>';
      }
    }

    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".ord-cancel");
      if (!btn) return;
      var ref = btn.getAttribute("data-ref");
      var email = btn.getAttribute("data-email");
      var name = btn.getAttribute("data-name");
      if (!ref || !email) return;
      if (!confirm(BP.t("Cancel this order? This can't be undone.", "إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء."))) return;
      var lbl = btn.textContent;
      btn.disabled = true;
      btn.textContent = BP.t("Cancelling…", "جارٍ الإلغاء…");
      fetch("/api/requests", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "cancel-order", ref: ref, email: email, name: name }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.ok) {
          btn.disabled = false; btn.textContent = lbl;
          alert(d && d.error === "already_completed"
            ? BP.t("This order is already completed and can't be cancelled online — contact us on WhatsApp.", "هذا الطلب مكتمل بالفعل ولا يمكن إلغاؤه من هنا — تواصل معنا عبر واتساب.")
            : BP.t("Couldn't cancel the order. Try again or contact us on WhatsApp.", "تعذّر إلغاء الطلب. حاول مرة أخرى أو تواصل معنا عبر واتساب."));
          return;
        }
        var orders = ordersData();
        orders.forEach(function (o) { if (o.ref === ref) o.status = BP.t("Cancelled", "ملغي"); });
        try { localStorage.setItem("bp_orders", JSON.stringify(orders)); } catch (er) {}
        renderOrders();
      }).catch(function () {
        btn.disabled = false; btn.textContent = lbl;
        alert(BP.t("Network error — try again.", "خطأ في الاتصال — حاول مرة أخرى."));
      });
    });

    function finishLogin(email, name) {
      try { localStorage.setItem("bp_session", JSON.stringify({ email: email, name: name })); } catch (er) {}
      try { document.dispatchEvent(new CustomEvent("bp:auth")); } catch (e2) {}
      goToRedirectTarget();
      render();
    }
    // Employer-subscription credentials live server-side (Notion), while portal
    // accounts are per-device. Verifying against the server both logs the
    // customer in on a new device and hands back their employer access code,
    // which auto-unlocks the employer dashboard without retyping it.
    function serverLogin(email, pass) {
      return fetch("/api/employer", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "login", email: email, password: pass }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.ok) return null;
        if (d.code) { try { localStorage.setItem("bp_emp_code", d.code); localStorage.setItem("bp_emp_company", d.company || ""); } catch (e3) {} }
        return d;
      }).catch(function () { return null; });
    }
    if (loginF) loginF.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("lg-email").value.trim().toLowerCase();
      var pass = document.getElementById("lg-pass").value;
      var u = users()[email];
      if (u && u.pass === pass) {
        serverLogin(email, pass); // background: sync employer code for the dashboard
        finishLogin(email, u.name);
        return;
      }
      var sb = loginF.querySelector('button[type="submit"]');
      var lbl = sb ? sb.textContent : "";
      if (sb) { sb.disabled = true; sb.textContent = BP.t("Signing in…", "جارٍ الدخول…"); }
      serverLogin(email, pass).then(function (d) {
        if (sb) { sb.disabled = false; sb.textContent = lbl; }
        if (!d) { alert(BP.t("No matching account. Try registering.", "لا يوجد حساب مطابق. جرّب إنشاء حساب جديد.")); return; }
        var name = d.company || email.split("@")[0];
        var all = users(); all[email] = { name: name, pass: pass }; saveUsers(all);
        finishLogin(email, name);
      });
    });

    // After sign-in/registration, return the customer to whatever page sent
    // them here (e.g. checkout) instead of stranding them on the dashboard.
    function goToRedirectTarget() {
      var target = new URLSearchParams(location.search).get("redirect");
      if (target === "checkout") location.href = BP.lang === "ar" ? "/ar/checkout" : "/checkout";
      else if (target === "formation") location.href = (BP.lang === "ar" ? "/ar/formation-contract" : "/formation-contract") + "#fc-form";
    }

    function otpErr(msg) {
      var b = document.getElementById("otp-error");
      if (!b) return; b.hidden = false; b.textContent = msg;
    }
    function startOtp(btn) {
      var label = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = BP.t("Sending…", "جارٍ الإرسال…"); }
      return fetch("/api/otp", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start", email: pending.email }),
      }).then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
        .then(function (res) {
          if (btn) { btn.disabled = false; btn.textContent = label; }
          if (res.status !== 200 || !res.d.ok) {
            alert(res.d && res.d.message ? res.d.message :
              BP.t("Email verification isn't enabled yet. Contact us on WhatsApp.", "التحقق بالبريد غير مُفعّل بعد. تواصل معنا على واتساب."));
            return false;
          }
          pending.challenge = res.d.challenge;
          var tgt = document.getElementById("otp-target"); if (tgt) tgt.textContent = res.d.to || pending.email;
          if (res.d.devCode) otpErr(BP.t("Test mode — code: ", "وضع الاختبار — الرمز: ") + res.d.devCode);
          return true;
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = label; }
          alert(BP.t("Network error. Try again.", "خطأ في الاتصال. حاول مرة أخرى."));
          return false;
        });
    }

    if (regF) regF.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("rg-name").value.trim();
      var email = document.getElementById("rg-email").value.trim().toLowerCase();
      var pass = document.getElementById("rg-pass").value;
      if (!name || !email || !pass) { alert(BP.t("Please fill all fields.", "الرجاء تعبئة كل الحقول.")); return; }
      if (users()[email]) { alert(BP.t("An account with this email already exists. Please sign in.", "يوجد حساب بهذا البريد. سجّل الدخول.")); return; }
      pending = { name: name, email: email, phone: document.getElementById("rg-phone").value.trim(), pass: pass };
      startOtp(regF.querySelector("button[type=submit]")).then(function (sent) {
        if (!sent) return;
        var er = document.getElementById("otp-error"); if (er) er.hidden = true;
        regF.hidden = true; if (otpF) { otpF.hidden = false; var c = document.getElementById("otp-code"); if (c) { c.value = ""; c.focus(); } }
      });
    });

    if (otpF) otpF.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!pending) return;
      var code = document.getElementById("otp-code").value.trim();
      if (code.length !== 6) { otpErr(BP.t("Enter the 6-digit code.", "أدخل الرمز المكوّن من 6 أرقام.")); return; }
      var btn = otpF.querySelector("button[type=submit]"); var lbl = btn.textContent;
      btn.disabled = true; btn.textContent = BP.t("Verifying…", "جارٍ التحقق…");
      fetch("/api/otp", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "verify", email: pending.email, code: code, challenge: pending.challenge }),
      }).then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
        .then(function (res) {
          btn.disabled = false; btn.textContent = lbl;
          if (res.status !== 200 || !res.d.ok) {
            otpErr(res.status === 400 && res.d.error === "expired"
              ? BP.t("Code expired. Resend a new one.", "انتهت صلاحية الرمز. أعد الإرسال.")
              : BP.t("Wrong code. Try again.", "رمز غير صحيح. حاول مرة أخرى."));
            return;
          }
          var u = users();
          u[pending.email] = { name: pending.name, pass: pending.pass, phone: pending.phone, verified: true };
          saveUsers(u);
          try { localStorage.setItem("bp_session", JSON.stringify({ email: pending.email, name: pending.name, verified: true })); } catch (er) {}
          try { document.dispatchEvent(new CustomEvent("bp:auth")); } catch (e3) {}
          if (otpF) otpF.hidden = true;
          pending = null;
          goToRedirectTarget();
          render();
        })
        .catch(function () { btn.disabled = false; btn.textContent = lbl; otpErr(BP.t("Network error. Try again.", "خطأ في الاتصال. حاول مرة أخرى.")); });
    });

    var resendBtn = document.getElementById("otp-resend");
    if (resendBtn) resendBtn.addEventListener("click", function () { if (pending) startOtp(resendBtn); });
    var backBtn = document.getElementById("otp-back");
    if (backBtn) backBtn.addEventListener("click", function () {
      if (otpF) otpF.hidden = true; if (regF) regF.hidden = false;
      var er = document.getElementById("otp-error"); if (er) er.hidden = true;
    });

    var out = document.getElementById("logout-btn");
    if (out) out.addEventListener("click", function () { try { localStorage.removeItem("bp_session"); } catch (e) {} try { document.dispatchEvent(new CustomEvent("bp:auth")); } catch (e2) {} render(); });

    var alreadyIn = session() && new URLSearchParams(location.search).get("redirect");
    if (alreadyIn === "checkout") {
      location.href = BP.lang === "ar" ? "/ar/checkout" : "/checkout";
      return;
    }
    if (alreadyIn === "formation") {
      location.href = (BP.lang === "ar" ? "/ar/formation-contract" : "/formation-contract") + "#fc-form";
      return;
    }
    render();
    document.addEventListener("bp:langchange", function () { if (session()) render(); });
  });
})();

/* ---------- Company documents wizard (account dashboard) ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var wiz = document.getElementById("docs-wizard");
    if (!wiz) return;
    var T = function (en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; };
    var KEY = "bp_docs";
    var total = parseInt(wiz.getAttribute("data-total"), 10) || 1;
    var cur = 0;
    function esc3(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
    function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
    var data = load();
    if (!data.items) data.items = {};
    if (!data.owners) data.owners = [];

    // ---- render saved state into the fields ----
    function paintItem(k) {
      var rec = data.items[k] || {};
      var nameEl = wiz.querySelector('[data-docname="' + k + '"]');
      var clr = wiz.querySelector('[data-docclear="' + k + '"]');
      var linkEl = wiz.querySelector('[data-doclink="' + k + '"]');
      var typeEl = wiz.querySelector('[data-docidtype="' + k + '"]');
      if (nameEl) nameEl.textContent = rec.name || T("Choose file", "اختر ملف");
      if (clr) clr.hidden = !rec.name;
      if (linkEl && rec.link != null) linkEl.value = rec.link;
      if (typeEl && rec.idtype != null) typeEl.value = rec.idtype;
    }
    function paintAll() { Object.keys(data.items).forEach(paintItem); wiz.querySelectorAll("[data-docfile]").forEach(function (f) { paintItem(f.getAttribute("data-docfile")); }); }

    // ---- file / link / type inputs ----
    wiz.addEventListener("change", function (e) {
      var f = e.target.closest("[data-docfile]");
      if (f) {
        var k = f.getAttribute("data-docfile");
        var names = Array.prototype.map.call(f.files || [], function (x) { return x.name; });
        data.items[k] = data.items[k] || {};
        data.items[k].name = names.length ? (names.length > 1 ? names[0] + " +" + (names.length - 1) : names[0]) : "";
        save(data); paintItem(k); return;
      }
      var lk = e.target.closest("[data-doclink]");
      if (lk) { var lkk = lk.getAttribute("data-doclink"); data.items[lkk] = data.items[lkk] || {}; data.items[lkk].link = lk.value.trim(); save(data); return; }
      var tp = e.target.closest("[data-docidtype]");
      if (tp) { var tpk = tp.getAttribute("data-docidtype"); data.items[tpk] = data.items[tpk] || {}; data.items[tpk].idtype = tp.value; save(data); return; }
    });
    wiz.addEventListener("click", function (e) {
      var clr = e.target.closest("[data-docclear]");
      if (clr) {
        var k = clr.getAttribute("data-docclear");
        if (data.items[k]) { delete data.items[k].name; }
        var input = wiz.querySelector('[data-docfile="' + k + '"]'); if (input) input.value = "";
        save(data); paintItem(k); return;
      }
    });

    // ---- owners repeater ----
    var ownersBox = document.getElementById("doc-owners");
    var TYPE_OPTS = [["", T("ID type", "نوع الهوية")], ["national", T("Saudi national ID", "هوية وطنية سعودية")], ["iqama", T("Residency (Iqama)", "إقامة")], ["passport", T("Passport", "جواز سفر")]];
    function ownerRow(o, idx) {
      var opts = TYPE_OPTS.map(function (t) { return '<option value="' + t[0] + '"' + (o.idtype === t[0] ? " selected" : "") + ">" + esc3(t[1]) + "</option>"; }).join("");
      return '<div class="docrow doc-owner" data-owner="' + idx + '">' +
        '<div class="docrow-info"><select class="doc-idtype" data-owner-type="' + idx + '">' + opts + "</select></div>" +
        '<div class="docrow-actions">' +
        '<label class="doc-file"><input type="file" data-owner-file="' + idx + '" accept=".pdf,.jpg,.jpeg,.png" hidden><span class="doc-file-btn">📎 <span data-owner-name="' + idx + '">' + esc3(o.name || T("Choose file", "اختر ملف")) + "</span></span></label>" +
        '<span class="doc-clear" data-owner-remove="' + idx + '" role="button" tabindex="0" aria-label="' + T("Remove", "إزالة") + '">✕</span>' +
        "</div></div>";
    }
    function renderOwners() {
      if (!ownersBox) return;
      ownersBox.innerHTML = data.owners.map(ownerRow).join("");
    }
    if (ownersBox) {
      ownersBox.addEventListener("change", function (e) {
        var tp = e.target.closest("[data-owner-type]");
        if (tp) { var i = +tp.getAttribute("data-owner-type"); data.owners[i].idtype = tp.value; save(data); return; }
        var f = e.target.closest("[data-owner-file]");
        if (f) { var j = +f.getAttribute("data-owner-file"); data.owners[j].name = (f.files && f.files[0]) ? f.files[0].name : ""; save(data); var nm = ownersBox.querySelector('[data-owner-name="' + j + '"]'); if (nm) nm.textContent = data.owners[j].name || T("Choose file", "اختر ملف"); return; }
      });
      ownersBox.addEventListener("click", function (e) {
        var rm = e.target.closest("[data-owner-remove]");
        if (rm) { var i = +rm.getAttribute("data-owner-remove"); data.owners.splice(i, 1); save(data); renderOwners(); }
      });
      var addBtn = document.getElementById("doc-add-owner");
      if (addBtn) addBtn.addEventListener("click", function () { data.owners.push({ idtype: "", name: "" }); save(data); renderOwners(); });
      renderOwners();
    }

    // ---- step navigation ----
    var steps = wiz.querySelectorAll(".docwiz-step");
    var backBtn = wiz.querySelector("[data-docwiz-back]");
    var nextBtn = wiz.querySelector("[data-docwiz-next]");
    var sendBtn = wiz.querySelector("[data-docwiz-send]");
    var curEl = wiz.querySelector("[data-docwiz-cur]");
    function showStep(n) {
      cur = Math.max(0, Math.min(total - 1, n));
      steps.forEach(function (s) { s.hidden = +s.getAttribute("data-step") !== cur; });
      wiz.querySelectorAll(".docwiz-dot").forEach(function (d) { d.classList.toggle("active", +d.getAttribute("data-dot") <= cur); });
      if (curEl) curEl.textContent = cur + 1;
      if (backBtn) backBtn.hidden = cur === 0;
      var last = cur === total - 1;
      if (nextBtn) nextBtn.hidden = last;
      if (sendBtn) sendBtn.hidden = !last;
    }
    if (backBtn) backBtn.addEventListener("click", function () { showStep(cur - 1); wiz.scrollIntoView({ behavior: "smooth", block: "start" }); });
    if (nextBtn) nextBtn.addEventListener("click", function () { showStep(cur + 1); wiz.scrollIntoView({ behavior: "smooth", block: "start" }); });
    wiz.querySelectorAll(".docwiz-dot").forEach(function (d) { d.addEventListener("click", function () { showStep(+d.getAttribute("data-dot")); }); });

    // ---- send the checklist to the team ----
    if (sendBtn) sendBtn.addEventListener("click", function () {
      var ses = null; try { ses = JSON.parse(localStorage.getItem("bp_session") || "null"); } catch (e) {}
      var company = {}; try { company = JSON.parse(localStorage.getItem("bp_company") || "{}"); } catch (e) {}
      var ready = [];
      Object.keys(data.items).forEach(function (k) { var r = data.items[k]; if (r && (r.name || r.link)) ready.push({ k: k, name: r.name || "", link: r.link || "", idtype: r.idtype || "" }); });
      var owners = (data.owners || []).filter(function (o) { return o.name || o.idtype; });
      if (!ready.length && !owners.length) { alert(T("Attach at least one document first.", "أرفق مستنداً واحداً على الأقل أولاً.")); return; }
      var lbl = sendBtn.textContent; sendBtn.disabled = true; sendBtn.textContent = T("Sending…", "جارٍ الإرسال…");
      var ref = "BPD-" + Date.now().toString().slice(-6);
      fetch("/api/requests", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "documents", ref: ref, name: (ses && ses.name) || company.name || "", email: (ses && ses.email) || "", company: company.name || "", cr: company.cr || "", docs: ready, owners: owners }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        sendBtn.disabled = false; sendBtn.textContent = lbl;
        var box = document.getElementById("docs-sent"); box.hidden = false;
        var waTxt = encodeURIComponent(T("Hi, I've prepared my company documents ", "السلام عليكم، جهّزت مستندات منشأتي ") + ref + T(" and want to send the files.", " وأرغب بإرسال الملفات."));
        box.innerHTML = (d && d.ok ? "✅ <strong>" + T("Sent to our team", "وصلت لفريقنا") + " — " + ref + "</strong><br>" + T("Now share the actual files with us on WhatsApp so we file them for you.", "الآن شارك الملفات نفسها معنا عبر واتساب لنحفظها في ملفك.") : "⚠️ " + T("Couldn't send — share them on WhatsApp instead.", "تعذّر الإرسال — شاركها عبر واتساب.")) +
          ' <a class="btn btn-wa" style="margin-top:10px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + waTxt + '">' + T("Send files on WhatsApp", "أرسل الملفات عبر واتساب") + "</a>";
      }).catch(function () {
        sendBtn.disabled = false; sendBtn.textContent = lbl;
        var box = document.getElementById("docs-sent"); box.hidden = false;
        var waTxt = encodeURIComponent(T("Hi, I've prepared my company documents and want to send the files.", "السلام عليكم، جهّزت مستندات منشأتي وأرغب بإرسال الملفات."));
        box.innerHTML = "⚠️ " + T("Couldn't reach the server — share them on WhatsApp.", "تعذّر الاتصال بالخادم — شاركها عبر واتساب.") + ' <a class="btn btn-wa" style="margin-top:10px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + waTxt + '">' + T("Send files on WhatsApp", "أرسل الملفات عبر واتساب") + "</a>";
      });
    });

    paintAll();
    showStep(0);
  });
})();

/* ---------- Suppliers portal — real sign-in + assigned work orders ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var gate = document.getElementById("partner-gate");
    var app = document.getElementById("partner-app");
    if (!gate || !app) return;
    var T = function (en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; };
    function esc4(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    // Credentials, not a session flag: every call re-authenticates server-side,
    // so a stale localStorage entry can never stand in for approval.
    function creds() { try { return JSON.parse(localStorage.getItem("bp_supplier") || "null"); } catch (e) { return null; } }
    function paneTo(name) {
      [].slice.call(document.querySelectorAll(".sup-pane")).forEach(function (el) { el.hidden = el.getAttribute("data-pane") !== name; });
      [].slice.call(document.querySelectorAll(".sup-tab")).forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === name); });
      var gw = document.getElementById("sup-google-wrap");
      if (gw) gw.hidden = !(name === "login" || name === "signup") || !window.BP_GOOGLE_CLIENT_ID;
    }
    function setCreds(c) { try { c ? localStorage.setItem("bp_supplier", JSON.stringify(c)) : localStorage.removeItem("bp_supplier"); } catch (e) {} }

    var state = { supplier: null, orders: [] };
    var pending = null;
    var ACTIVE = ["أُرسل للمورّد", "قبله المورّد", "قيد التنفيذ"];

    // Everything Business Partner sells, priced for the supplier: the site
    // price is what the client pays before VAT, and the supplier's share is
    // that less the commission on their own registry row. Showing both is the
    // point — a supplier who cannot see their net has to ask for every job.
    var CATALOG = null;
    function renderCatalog(sup) {
      var box = document.getElementById("pt-catalog");
      if (!box) return;
      var pct = (sup && sup.commission != null) ? Number(sup.commission) : 20;
      var draw = function () {
        var q = (document.getElementById("pt-cat-search") || {}).value || "";
        var cat = (document.getElementById("pt-cat-filter") || {}).value || "";
        q = q.trim().toLowerCase();
        var rows = CATALOG.filter(function (x) {
          if (cat && (x.categoryAr || x.category) !== cat) return false;
          if (!q) return true;
          return ((x.nameAr || "") + " " + (x.nameEn || "") + " " + (x.code || "")).toLowerCase().indexOf(q) !== -1;
        });
        if (!rows.length) { box.innerHTML = '<p class="dash-empty">' + T("No matching service.", "لا توجد خدمة مطابقة.") + "</p>"; return; }
        box.innerHTML =
          '<p class="dash-empty" style="text-align:start;margin-bottom:10px">' +
            T("Your commission rate: ", "نسبة عمولة بيزنس بارتنر عليك: ") + "<b>" + pct + "%</b> · " +
            T("prices exclude VAT", "الأسعار قبل ضريبة القيمة المضافة") + "</p>" +
          '<div class="tbl-scroll"><table class="mini-table"><thead><tr>' +
            "<th>" + T("Code", "الكود") + "</th><th>" + T("Service", "الخدمة") + "</th>" +
            "<th>" + T("Site price", "سعر الموقع") + "</th><th>" + T("Commission", "العمولة") + "</th>" +
            "<th>" + T("Your share", "نصيبك") + "</th></tr></thead><tbody>" +
          rows.map(function (x) {
            var p = Number(x.amount) || 0;
            var fee = Math.round(p * pct) / 100;
            var net = Math.round((p - fee) * 100) / 100;
            return "<tr><td style=\"direction:ltr;text-align:start\">" + esc4(x.code || "—") + "</td>" +
              "<td>" + esc4(x.nameAr || x.nameEn || "—") +
                '<br><span class="text-soft" style="font-size:.78rem">' + esc4(x.categoryAr || x.category || "") + "</span></td>" +
              "<td>" + (p ? p + " ﷼" : T("On request", "حسب الطلب")) + "</td>" +
              "<td>" + (p ? Math.round(fee * 100) / 100 + " ﷼" : "—") + "</td>" +
              "<td><b>" + (p ? net + " ﷼" : T("Quoted", "بعرض سعر")) + "</b></td></tr>";
          }).join("") + "</tbody></table></div>";
      };
      if (CATALOG) { draw(); return; }
      fetch("/assets/data/catalog.json", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : { services: [] }; })
        .then(function (d) {
          CATALOG = (d && d.services) || [];
          var sel = document.getElementById("pt-cat-filter");
          if (sel) {
            var seen = {};
            CATALOG.forEach(function (x) {
              var c = x.categoryAr || x.category; if (!c || seen[c]) return; seen[c] = 1;
              var o = document.createElement("option"); o.value = c; o.textContent = c; sel.appendChild(o);
            });
            sel.onchange = draw;
          }
          var srch = document.getElementById("pt-cat-search");
          if (srch) srch.addEventListener("input", draw);
          draw();
        })
        .catch(function () { box.innerHTML = '<p class="dash-empty">' + T("Couldn't load the catalogue.", "تعذّر تحميل الكتالوج.") + "</p>"; });
    }

      function render() {
      if (!state.supplier) { gate.hidden = false; app.hidden = true; return; }
      gate.hidden = true; app.hidden = false;
      var s = state.supplier, orders = state.orders || [];
      var co = document.getElementById("pt-company"); if (co) co.textContent = s.name || "—";
      var ct = document.getElementById("pt-contact");
      if (ct) ct.textContent = [s.person, s.code, s.city, (s.categories || []).join("، ")].filter(Boolean).join(" · ") || "—";
      // The commission decides every number on this page, so it is stated once
      // at the top rather than left to be inferred from the catalogue rows.
      var rate = document.getElementById("pt-rate");
      if (rate) {
        var pct = Number(s.commission);
        rate.textContent = isFinite(pct)
          ? T("Our commission " + pct + "% · your share " + (100 - pct) + "% of the catalogue price",
              "عمولتنا " + pct + "٪ · نصيبك " + (100 - pct) + "٪ من سعر الكتالوج")
          : T("Commission set per order", "العمولة تُحدَّد لكل أمر");
      }
      var active = orders.filter(function (o) { return ACTIVE.indexOf(o.status) !== -1; });
      var done = orders.filter(function (o) { return o.status === "تم التسليم" || o.status === "معتمد"; });
      var due = orders.filter(function (o) { return (o.status === "تم التسليم" || o.status === "معتمد") && o.supplierInvoiceStatus === "لم تُرفع"; });
      var set = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
      set("pt-stat-open", active.length); set("pt-stat-done", done.length); set("pt-stat-due", due.length);
      if (s.priceList && s.priceList.length && !(myList && myList.length)) myList = s.priceList.slice();
      drawMyList();
      renderCatalog(s);

      var feed = document.getElementById("pt-feed");
      if (!feed) return;
      if (!orders.length) {
        feed.innerHTML = '<p class="dash-empty">' + T("No work orders yet — new assignments appear here and reach you by email.", "لا توجد أوامر عمل بعد — كل إسناد جديد يظهر هنا ويصلك على بريدك.") + "</p>";
        return;
      }
      feed.innerHTML = orders.map(function (o) {
        var meta = [o.city, o.due, o.clientRef].filter(Boolean).join(" · ");
        var money = [];
        if (o.amount != null) money.push(T("Order value", "قيمة الأمر") + ": " + o.amount + " ﷼");
        if (o.commission != null && o.commission > 0) money.push(T("Commission invoiced to you", "عمولة مفوترة عليك") + ": " + o.commission + " ﷼");
        return '<div class="dash-card" style="margin-bottom:10px">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">' +
            "<div><strong>" + esc4(o.service || o.ref) + "</strong>" +
            '<br><span class="text-soft" style="font-size:.82rem">' + esc4(o.ref + (meta ? " · " + meta : "")) + "</span>" +
            (o.details ? '<br><span class="text-soft" style="font-size:.82rem">' + esc4(o.details) + "</span>" : "") +
            (money.length ? '<br><span class="text-soft" style="font-size:.82rem">' + esc4(money.join(" · ")) + "</span>" : "") +
            "</div>" +
            '<div style="text-align:end">' +
              '<span class="pkg-tag">' + esc4(o.status || "—") + "</span>" +
              '<br><span class="text-soft" style="font-size:.78rem">' + esc4(T("Invoice", "الفاتورة") + ": " + (o.supplierInvoiceStatus || "—")) + "</span>" +
            "</div>" +
          "</div>" +
          '<div style="margin-top:10px"><button class="btn btn-primary btn-sm pt-offer-btn" data-id="' + esc4(o.id) + '" data-status="' + esc4(o.status) + '" data-title="' + esc4(o.service || o.ref) + '">' +
            (o.status === "طلب عرض سعر" ? T("Submit your quote", "قدّم عرض سعرك") : T("Update / upload invoice", "تحديث / رفع فاتورة")) + "</button></div>" +
        "</div>";
      }).join("");
    }

    function load(c, onFail) {
      fetch("/api/suppliers?action=orders&email=" + encodeURIComponent(c.email) + "&pw=" + encodeURIComponent(c.pw || ""), { cache: "no-store" })
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          if (res.d && res.d.ok) { state.supplier = res.d.supplier; state.orders = res.d.orders || []; render(); return; }
          setCreds(null); state.supplier = null; render();
          if (onFail) onFail(res.d && res.d.error, res.s);
        })
        .catch(function () { if (onFail) onFail("network"); });
    }

    var errEl = document.getElementById("pl-error");
    function showErr(code) {
      if (!errEl) return;
      errEl.textContent = code === "email_unverified"
        ? T("Verify your email first — enter the code we sent you.", "فعّل بريدك أولاً — أدخل الرمز الذي أرسلناه لك.")
        : code === "weak_password" ? T("Password must be at least 8 characters.", "كلمة المرور يجب أن تكون 8 أحرف فأكثر.")
        : code === "invalid_code" ? T("The code is wrong or has expired.", "الرمز غير صحيح أو انتهت صلاحيته.")
        : code === "google_not_configured" ? T("Google sign-in is not configured yet.", "الدخول عبر Google غير مُفعّل بعد.")
        : code === "not_configured" ? T("Sign-up is not configured yet — contact us.", "التسجيل غير مُفعّل بعد — تواصل معنا.")
        : code === "network" ? T("Connection issue — please try again.", "مشكلة في الاتصال — حاول مرة أخرى.")
        : T("Email or password is incorrect.", "البريد أو كلمة المرور غير صحيحة.");
      errEl.hidden = false;
    }

    // populate the sign-up categories from the same list the registry uses
    var catSel = document.getElementById("ps-cat");
    if (catSel && window.BP_SUP_CATS) {
      window.BP_SUP_CATS.forEach(function (c) { var o = document.createElement("option"); o.value = c; o.textContent = c; catSel.appendChild(o); });
    }
    [].slice.call(document.querySelectorAll(".sup-tab")).forEach(function (t) {
      t.addEventListener("click", function () { if (errEl) errEl.hidden = true; paneTo(t.getAttribute("data-tab")); });
    });
    paneTo("login");

    // Portal sections. The work orders open first: the catalogue is 116 rows of
    // reference material and used to push the partner's actual work off-screen.
    [].slice.call(document.querySelectorAll("[data-pt-tab]")).forEach(function (t) {
      t.addEventListener("click", function () {
        var want = t.getAttribute("data-pt-tab");
        [].slice.call(document.querySelectorAll("[data-pt-tab]")).forEach(function (o) {
          o.setAttribute("aria-selected", String(o.getAttribute("data-pt-tab") === want));
        });
        [].slice.call(document.querySelectorAll("[data-pt-pane]")).forEach(function (p) {
          p.hidden = p.getAttribute("data-pt-pane") !== want;
        });
      });
    });

    // A service we don't sell yet. It goes to the team for pricing — the
    // partner is told that plainly rather than left thinking it is now live.
    var propose = document.getElementById("pt-propose-form");
    if (propose) propose.addEventListener("submit", function (e) {
      e.preventDefault();
      var okEl = document.getElementById("pp-sent"), erEl = document.getElementById("pp-err");
      okEl.hidden = true; erEl.hidden = true;
      var c = creds();
      if (!c || !c.email) { erEl.textContent = T("Sign in first.", "سجّل الدخول أولاً."); erEl.hidden = false; return; }
      var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; };
      var name = v("pp-name"), price = Number(v("pp-price"));
      if (!name || !(price > 0)) { erEl.textContent = T("Enter the service name and a price above zero.", "أدخل اسم الخدمة وسعراً أكبر من صفر."); erEl.hidden = false; return; }
      var btn = propose.querySelector("button[type=submit]"); btn.disabled = true;
      fetch("/api/suppliers", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "propose-service", email: c.email, pw: c.pw || "",
                               name: name, category: v("pp-cat"), price: price, lead: v("pp-days"), notes: v("pp-notes") })
      }).then(function (r) { return r.json(); }).then(function (r) {
        btn.disabled = false;
        if (r && r.ok) {
          okEl.textContent = T("Sent ✓ — the team reviews and prices it, and we come back to you. It is not published yet.",
                               "أُرسل ✓ — الفريق يراجعه ويسعّره ونرجع لك. لم يُنشر بعد.");
          okEl.hidden = false;
          propose.reset();
        } else {
          erEl.textContent = (r && r.error === "unauthorized")
            ? T("Sign in again, please.", "سجّل الدخول مرة أخرى من فضلك.")
            : T("Couldn't send it — try again.", "تعذّر الإرسال — حاول مرة أخرى.");
          erEl.hidden = false;
        }
      }).catch(function () {
        btn.disabled = false;
        erEl.textContent = T("Connection issue — please try again.", "مشكلة في الاتصال — حاول مرة أخرى.");
        erEl.hidden = false;
      });
    });

    var boot = creds();
    if (boot && boot.email && boot.pw) load(boot);

    var loginForm = document.getElementById("partner-login-form");
    if (loginForm) loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (errEl) errEl.hidden = true;
      var email = (document.getElementById("pl-email").value || "").trim().toLowerCase();
      var pw = document.getElementById("pl-pw").value || "";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !pw) { showErr("bad_credentials"); return; }
      var btn = loginForm.querySelector("button[type=submit]"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = T("Signing in…", "جارٍ الدخول…");
      fetch("/api/suppliers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "login", email: email, password: pw }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          btn.disabled = false; btn.textContent = lbl;
          if (!d || !d.ok) {
            if (d && d.error === "email_unverified") { pending = { email: email, pw: pw }; paneTo("verify"); }
            showErr(d && d.error); return;
          }
          setCreds({ email: email, pw: pw });
          state.supplier = d.supplier; state.orders = d.orders || []; render();
        })
        .catch(function () { btn.disabled = false; btn.textContent = lbl; showErr("network"); });
    });

    // ---- sign up -> e-mail code -> verified -> signed in ----
    // `pending` (declared above) carries {email, pw, token, exp} between the
    // sign-up POST and the verification POST.
    var signupForm = document.getElementById("partner-signup-form");
    if (signupForm) signupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (errEl) errEl.hidden = true;
      var v = function (id) { var el = document.getElementById(id); return el ? (el.value || "").trim() : ""; };
      var email = v("ps-email").toLowerCase(), pw = document.getElementById("ps-pw").value || "";
      if (!v("ps-company") || !v("ps-person") || !v("ps-phone") || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showErr("invalid_fields"); return; }
      if (pw.length < 8) { showErr("weak_password"); return; }
      var btn = signupForm.querySelector("button[type=submit]"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = T("Creating…", "جارٍ الإنشاء…");
      fetch("/api/suppliers", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "signup", company: v("ps-company"), person: v("ps-person"), phone: v("ps-phone"),
          email: email, password: pw, city: v("ps-city"), categories: [v("ps-cat")].filter(Boolean) }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          btn.disabled = false; btn.textContent = lbl;
          if (!d || !d.ok) { showErr(d && d.error); return; }
          pending = { email: email, pw: pw, token: d.token, exp: d.exp };
          var note = document.getElementById("sup-verify-note");
          if (note) note.textContent = T("We sent a 6-digit code to ", "أرسلنا رمزاً من 6 أرقام إلى ") + email;
          paneTo("verify");
        })
        .catch(function () { btn.disabled = false; btn.textContent = lbl; showErr("network"); });
    });

    var verifyForm = document.getElementById("partner-verify-form");
    if (verifyForm) verifyForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (errEl) errEl.hidden = true;
      if (!pending) { paneTo("login"); return; }
      var code = (document.getElementById("pv-code").value || "").trim();
      if (!code) return;
      var btn = verifyForm.querySelector("button[type=submit]"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = T("Verifying…", "جارٍ التحقق…");
      fetch("/api/suppliers", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "verify-email", email: pending.email, code: code, token: pending.token, exp: pending.exp, password: pending.pw }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          btn.disabled = false; btn.textContent = lbl;
          if (!d || !d.ok) { showErr(d && d.error); return; }
          // verified — sign straight in with the password just chosen
          setCreds({ email: pending.email, pw: pending.pw });
          load(pending, function (err) { showErr(err); });
        })
        .catch(function () { btn.disabled = false; btn.textContent = lbl; showErr("network"); });
    });

    // Forgetting a password used to be terminal: the only way in was a password
    // the account might never have had. The emailed code already proves control
    // of the address, so it doubles as the reset — the address and the new
    // password are typed on the sign-in pane, the code confirms both.
    var forgot = document.getElementById("pl-forgot");
    if (forgot) forgot.addEventListener("click", function (e) {
      e.preventDefault();
      var email = (document.getElementById("pl-email").value || "").trim().toLowerCase();
      var pw = document.getElementById("pl-pw").value || "";
      if (!email || email.indexOf("@") === -1) { showErr("invalid_fields"); return; }
      if (pw.length < 8) { showErr("weak_password"); return; }
      forgot.textContent = T("Sending…", "جارٍ الإرسال…");
      fetch("/api/suppliers", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "resend-code", email: email }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          forgot.textContent = T("Type your email and a new password, then get a code", "اكتب بريدك وكلمة مرور جديدة ثم اطلب الرمز");
          if (!d || !d.ok) { showErr(d && d.error); return; }
          // Same shape whether or not the address is registered, so this reveals
          // nothing about who has an account.
          pending = { email: email, pw: pw, token: d.token, exp: d.exp };
          var note = document.getElementById("sup-verify-note");
          if (note) note.textContent = T("We sent a 6-digit code to " + email + " — enter it to set your new password and sign in.",
            "أرسلنا رمزاً من 6 أرقام إلى " + email + " — أدخله لتعيين كلمة المرور الجديدة والدخول.");
          paneTo("verify");
        })
        .catch(function () {
          forgot.textContent = T("Type your email and a new password, then get a code", "اكتب بريدك وكلمة مرور جديدة ثم اطلب الرمز");
          showErr("network");
        });
    });

    var resend = document.getElementById("pv-resend");
    if (resend) resend.addEventListener("click", function () {
      if (!pending) return;
      resend.disabled = true;
      fetch("/api/suppliers", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "resend-code", email: pending.email }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { resend.disabled = false; if (d && d.ok) { pending.token = d.token; pending.exp = d.exp; resend.textContent = T("Code sent", "أُرسل الرمز"); } })
        .catch(function () { resend.disabled = false; });
    });

    // ---- Google Sign-In ----
    // The ID token is verified server-side against Google's keys; the client id
    // is a public identifier, so publishing it in the page is expected.
    window.bpSupplierGoogle = function (resp) {
      if (errEl) errEl.hidden = true;
      fetch("/api/suppliers", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "google", credential: resp && resp.credential }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok) { showErr(d && d.error); return; }
          // Google accounts have no local password; the session is this flag.
          setCreds({ email: "", pw: "", google: true });
          state.supplier = d.supplier; state.orders = d.orders || []; render();
        })
        .catch(function () { showErr("network"); });
    };
    (function initGoogle() {
      var box = document.getElementById("sup-google");
      if (!box || !window.BP_GOOGLE_CLIENT_ID) return;
      var tries = 0;
      var t = setInterval(function () {
        if (window.google && google.accounts && google.accounts.id) {
          clearInterval(t);
          google.accounts.id.initialize({ client_id: window.BP_GOOGLE_CLIENT_ID, callback: window.bpSupplierGoogle });
          google.accounts.id.renderButton(box, { theme: "outline", size: "large", shape: "pill", text: "continue_with", locale: (document.documentElement.lang || "ar") });
          var gw = document.getElementById("sup-google-wrap"); if (gw) gw.hidden = false;
        } else if (++tries > 40) clearInterval(t);
      }, 150);
    })();

    var logout = document.getElementById("pt-logout");
    if (logout) logout.addEventListener("click", function () { setCreds(null); state.supplier = null; state.orders = []; pending = null; paneTo("login"); render(); });

    // ---- the partner's own price list: build once, reuse on every quote ----
    var myList = [];
    function drawMyList() {
      if (!myList) myList = [];
      var box = document.getElementById("pm-list");
      if (!box) return;
      if (!myList.length) {
        box.innerHTML = '<p class="dash-empty">' + T("No services yet — add your first one below.", "لا خدمات بعد — أضف أولى خدماتك بالأسفل.") + "</p>";
      } else {
        box.innerHTML = myList.map(function (it, i) {
          return '<div class="pm-row" data-i="' + i + '" style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center">' +
            '<input class="pm-n" value="' + esc4(it.name || "") + '" placeholder="' + T("Service", "الخدمة") + '" style="padding:8px 10px;border:1px solid var(--gray-line);border-radius:8px;font-family:inherit">' +
            '<input class="pm-p" type="number" min="0" step="0.01" value="' + (it.price == null ? "" : it.price) + '" placeholder="' + T("Price", "السعر") + '" style="padding:8px 10px;border:1px solid var(--gray-line);border-radius:8px;font-family:inherit">' +
            '<input class="pm-l" value="' + esc4(it.lead || "") + '" placeholder="' + T("Delivery", "المدة") + '" style="padding:8px 10px;border:1px solid var(--gray-line);border-radius:8px;font-family:inherit">' +
            '<button type="button" class="btn btn-ghost btn-sm pm-x" data-i="' + i + '">✕</button></div>';
        }).join("");
      }
      fillPicker();
    }
    function readMyList() {
      return [].slice.call(document.querySelectorAll("#pm-list .pm-row")).map(function (r) {
        return { name: (r.querySelector(".pm-n").value || "").trim(),
                 price: Number(r.querySelector(".pm-p").value),
                 lead: (r.querySelector(".pm-l").value || "").trim() };
      }).filter(function (it) { return it.name && isFinite(it.price) && it.price >= 0; });
    }
    var pmAdd = document.getElementById("pm-add");
    if (pmAdd) pmAdd.addEventListener("click", function () { myList = readMyList().concat([{ name: "", price: "", lead: "" }]); drawMyList(); });
    document.addEventListener("click", function (e) {
      var x = e.target.closest && e.target.closest(".pm-x");
      if (!x) return;
      var i = Number(x.getAttribute("data-i"));
      myList = [].slice.call(document.querySelectorAll("#pm-list .pm-row")).map(function (r, j) {
        return j === i ? null : { name: (r.querySelector(".pm-n").value || "").trim(), price: Number(r.querySelector(".pm-p").value), lead: (r.querySelector(".pm-l").value || "").trim() };
      }).filter(Boolean);
      drawMyList();
    });
    var pmSave = document.getElementById("pm-save");
    if (pmSave) pmSave.addEventListener("click", function () {
      var c = creds(); if (!c) return;
      var msg = document.getElementById("pm-msg");
      var list = readMyList();
      pmSave.disabled = true; msg.textContent = T("Saving…", "جارٍ الحفظ…"); msg.style.color = "";
      fetch("/api/suppliers", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "my-services", email: c.email, pw: c.pw || "", services: list }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          pmSave.disabled = false;
          if (d && d.ok) {
            myList = d.priceList || list;
            drawMyList();
            msg.style.color = "#065f46";
            msg.textContent = T("Saved ✓ — these now appear when you build a quote.", "حُفظت ✓ — تظهر الآن عند بناء عرض السعر.");
          } else { msg.style.color = "#b91c1c"; msg.textContent = T("Could not save — try again.", "تعذّر الحفظ — حاول مرة أخرى."); }
        })
        .catch(function () { pmSave.disabled = false; msg.style.color = "#b91c1c"; msg.textContent = T("Connection issue.", "مشكلة في الاتصال."); });
    });

    // ---- quote line items: the same lines become the invoice, so they are
    // built once and carried forward rather than retyped. ----
    function fillPicker() {
      var sel = document.getElementById("pt-pick");
      if (!sel) return;
      sel.innerHTML = '<option value="">' + T("Add from my services…", "أضف من خدماتي…") + "</option>" +
        myList.map(function (it, i) { return '<option value="' + i + '">' + esc4(it.name) + " — " + it.price + " ﷼</option>"; }).join("");
    }
    function drawLines(lines) {
      var box = document.getElementById("pt-lines");
      if (!box) return;
      box.innerHTML = (lines || []).map(function (l) {
        return '<div class="pt-line" style="display:grid;grid-template-columns:2fr 60px 1fr auto;gap:6px;margin-bottom:6px;align-items:center">' +
          '<input class="pl-n" value="' + esc4(l.name || "") + '" placeholder="' + T("Item", "البند") + '" style="padding:8px 10px;border:1px solid var(--gray-line);border-radius:8px;font-family:inherit">' +
          '<input class="pl-q" type="number" min="1" value="' + (l.qty || 1) + '" style="padding:8px 6px;border:1px solid var(--gray-line);border-radius:8px;font-family:inherit;text-align:center">' +
          '<input class="pl-p" type="number" min="0" step="0.01" value="' + (l.price == null ? "" : l.price) + '" placeholder="' + T("Price", "السعر") + '" style="padding:8px 10px;border:1px solid var(--gray-line);border-radius:8px;font-family:inherit">' +
          '<button type="button" class="btn btn-ghost btn-sm pl-x">✕</button></div>';
      }).join("");
      lineTotal();
    }
    function readLines() {
      return [].slice.call(document.querySelectorAll("#pt-lines .pt-line")).map(function (r) {
        return { name: (r.querySelector(".pl-n").value || "").trim(),
                 qty: Number(r.querySelector(".pl-q").value) || 1,
                 price: Number(r.querySelector(".pl-p").value) || 0 };
      });
    }
    function lineTotal() {
      var el = document.getElementById("pt-lines-total");
      if (!el) return 0;
      var t = readLines().reduce(function (a, l) { return a + l.price * l.qty; }, 0);
      t = Math.round(t * 100) / 100;
      el.textContent = T("Quote total: ", "إجمالي العرض: ") + t + " ﷼";
      var hid = document.getElementById("pt-quote"); if (hid) hid.value = t || "";
      return t;
    }
    document.addEventListener("input", function (e) { if (e.target.closest && e.target.closest("#pt-lines")) lineTotal(); });
    document.addEventListener("click", function (e) {
      var x = e.target.closest && e.target.closest(".pl-x");
      if (!x) return;
      x.closest(".pt-line").remove();
      lineTotal();
    });
    var lineAdd = document.getElementById("pt-line-add");
    if (lineAdd) lineAdd.addEventListener("click", function () { drawLines(readLines().concat([{ name: "", qty: 1, price: "" }])); });
    var picker = document.getElementById("pt-pick");
    if (picker) picker.addEventListener("change", function () {
      var i = Number(picker.value);
      if (picker.value === "" || !myList[i]) return;
      var it = myList[i];
      // Drop the blank starter row: picking a service is the answer to it.
      var kept = readLines().filter(function (l) { return l.name || l.price > 0; });
      drawLines(kept.concat([{ name: it.name, qty: 1, price: it.price }]));
      picker.value = "";
    });

    // Work-order update modal
    var modal = document.getElementById("pt-modal");
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".pt-offer-btn");
      if (b && modal) {
        document.getElementById("pt-order-id").value = b.getAttribute("data-id");
        document.getElementById("pt-offer-for").textContent = T("Work order: ", "أمر العمل: ") + b.getAttribute("data-title");
        var isRfq = b.getAttribute("data-status") === "طلب عرض سعر";
        var qw = document.getElementById("pt-quote-wrap"), sw = document.getElementById("pt-status-wrap");
        if (qw) qw.hidden = !isRfq;
        if (sw) sw.hidden = isRfq;
        var mt = document.getElementById("pt-modal-title");
        if (mt) mt.textContent = isRfq ? T("Submit your quote", "قدّم عرض سعرك") : T("Update work order", "تحديث أمر العمل");
        // The order's own lines open in the builder, so revising a quote edits
        // what was sent rather than starting from an empty form.
        var ord = (state.orders || []).filter(function (o) { return o.id === b.getAttribute("data-id"); })[0];
        drawLines((ord && ord.lines && ord.lines.length) ? ord.lines : [{ name: "", qty: 1, price: "" }]);
        var lead = document.getElementById("pt-lead"); if (lead) lead.value = (ord && ord.leadTime) || "";
        var notes = document.getElementById("pt-offer-notes"); if (notes) notes.value = (ord && ord.notes) || "";
        // Invoicing step: the approved quote is the amount, stated rather than
        // left to be remembered — this is the one-click carry-over.
        var hint = document.getElementById("pt-inv-hint");
        if (hint) {
          hint.textContent = (ord && ord.quote != null)
            ? T("Invoice us for the approved quote: " + ord.quote + " SAR — the same lines you quoted.",
                "فوترنا بقيمة العرض المعتمد: " + ord.quote + " ﷼ — البنود نفسها التي عرضتها.")
            : T("Invoice us for the approved quote once you deliver.", "فوترنا بقيمة العرض المعتمد بعد التسليم.");
        }
        var sent = document.getElementById("pt-offer-sent"); if (sent) sent.hidden = true;
        modal.hidden = false;
      }
      if (e.target.id === "pt-modal-x" || e.target === modal) modal.hidden = true;
    });

    var form = document.getElementById("pt-offer-form");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      var c = creds(); if (!c) return;
      var payload = {
        type: "order-update", email: c.email, password: c.pw,
        orderId: document.getElementById("pt-order-id").value,
        notes: (document.getElementById("pt-offer-notes").value || "").trim(),
      };
      var qw2 = document.getElementById("pt-quote-wrap");
      if (qw2 && !qw2.hidden) {
        var ls = readLines().filter(function (l) { return l.name && l.price > 0; });
        if (!ls.length) { alert(T("Add at least one line with a price above zero.", "أضف بنداً واحداً على الأقل بسعر أكبر من صفر.")); return; }
        payload.lines = ls;
        payload.leadTime = (document.getElementById("pt-lead").value || "").trim();
      } else {
        payload.status = document.getElementById("pt-status").value;
      }
      var btn = form.querySelector("button[type=submit]"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = T("Saving…", "جارٍ الحفظ…");
    var fileEl = document.getElementById("pt-invoice");
      var file = fileEl && fileEl.files && fileEl.files[0];
      var go = function () {
        fetch("/api/suppliers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            btn.disabled = false; btn.textContent = lbl;
            var sent = document.getElementById("pt-offer-sent");
            if (d && d.ok) {
              if (sent) { sent.textContent = T("Saved — the team has been notified.", "تم الحفظ — أُشعر الفريق."); sent.hidden = false; }
              form.reset();
              load(c);
              setTimeout(function () { if (modal) modal.hidden = true; }, 1200);
            } else if (sent) { sent.textContent = T("Could not save — please try again.", "تعذّر الحفظ — حاول مرة أخرى."); sent.hidden = false; }
          })
          .catch(function () { btn.disabled = false; btn.textContent = lbl; });
      };
      if (file) {
        if (file.size > 4 * 1024 * 1024) { alert(T("Invoice must be under 4MB.", "حجم الفاتورة يجب أن يكون أقل من 4 ميجابايت.")); btn.disabled = false; btn.textContent = lbl; return; }
        var fr = new FileReader();
        fr.onload = function () {
          payload.invoiceBase64 = String(fr.result).split(",")[1] || "";
          payload.invoiceName = file.name; payload.invoiceType = file.type;
          go();
        };
        fr.onerror = function () { btn.disabled = false; btn.textContent = lbl; };
        fr.readAsDataURL(file);
      } else go();
    });
  });
})();

/* ---------- Services calculator (accordion + basket) ---------- */
(function () {
  "use strict";
  var root = document.getElementById("calc2");
  if (!root || !window.BP_CALC) return;
  var groups = window.BP_CALC;
  var isAr = (window.BP_CALC_LANG || "en") === "ar";
  var VAT = 0.15;
  var selected = {}; // id -> item
  var catsEl = document.getElementById("calc2-cats");

  function nm(x) { return isAr ? x.nameAr : x.nameEn; }
  function money(n) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 }) + " ﷼"; }
  function t(en, ar) { return isAr ? ar : en; }

  // Build accordions
  groups.forEach(function (g, gi) {
    if (!g.items.length) return;
    var acc = document.createElement("div");
    acc.className = "calc2-cat";
    var chips = g.chips.slice(0, 6).map(function (c) { return '<span class="calc2-chip">' + esc(c) + "</span>"; }).join("");
    acc.innerHTML =
      '<button type="button" class="calc2-cathead" aria-expanded="' + (gi === 0 ? "true" : "false") + '">' +
        '<span class="calc2-caticon">' + g.icon + "</span>" +
        '<span class="calc2-cattitle">' + esc(nm(g)) + '<span class="calc2-catcount">' + g.items.length + " " + t("services", "خدمة") + "</span></span>" +
        '<span class="calc2-chev">▾</span>' +
      "</button>" +
      (chips ? '<div class="calc2-chips">' + chips + "</div>" : "") +
      '<div class="calc2-list"' + (gi === 0 ? "" : ' hidden') + "></div>";
    var list = acc.querySelector(".calc2-list");
    g.items.forEach(function (it) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "calc2-item";
      row.setAttribute("data-id", it.id);
      row.innerHTML = '<span class="calc2-check">' + '</span><span class="calc2-iname">' + esc(nm(it)) + "</span>";
      row.addEventListener("click", function () { toggle(it, row); });
      list.appendChild(row);
    });
    var head = acc.querySelector(".calc2-cathead");
    head.addEventListener("click", function () {
      var open = head.getAttribute("aria-expanded") === "true";
      head.setAttribute("aria-expanded", open ? "false" : "true");
      list.hidden = open;
      var chipsEl = acc.querySelector(".calc2-chips");
    });
    catsEl.appendChild(acc);
  });

  var revealed = false;

  function toggle(it, row) {
    if (selected[it.id]) { delete selected[it.id]; row.classList.remove("on"); }
    else { selected[it.id] = it; row.classList.add("on"); }
    revealed = false;
    render();
  }

  function render() {
    var wrap = document.getElementById("calc2-selected");
    var ids = Object.keys(selected);
    if (!ids.length) {
      wrap.innerHTML = '<p class="calc2-empty" id="calc2-empty">' + t("No services selected yet. Tap a service to add it.", "لم تختر أي خدمة بعد. اضغط على أي خدمة لإضافتها.") + "</p>";
    } else {
      wrap.innerHTML = ids.map(function (id) {
        var it = selected[id];
        return '<div class="calc2-sel"><span>' + esc(nm(it)) +
          '</span><button type="button" class="calc2-rm" data-id="' + id + '" aria-label="remove">✕</button></div>';
      }).join("");
    }
    // No prices/totals — the calculator is now a request builder. The
    // "official quote" button appears once at least one service is selected.
    var quoteBtn = document.getElementById("calc2-quote");
    if (quoteBtn) quoteBtn.hidden = !ids.length;
  }

  document.addEventListener("click", function (e) {
    var rm = e.target.closest(".calc2-rm");
    if (rm) {
      var id = rm.getAttribute("data-id");
      delete selected[id];
      var row = catsEl.querySelector('.calc2-item[data-id="' + id + '"]');
      if (row) row.classList.remove("on");
      render();
    }
  });

  // "Request official quote" → NOT a purchase: the request goes to the client
  // dashboard (/account). Signed-out users register/sign in first; the pending
  // selection is stashed and turned into a dashboard request right after.
  var quote = document.getElementById("calc2-quote");
  if (quote) quote.addEventListener("click", function (e) {
    var ids = Object.keys(selected);
    if (!ids.length) return; // let default nav happen
    e.preventDefault();
    var items = ids.map(function (id) {
      var it = selected[id];
      return { nameEn: it.nameEn, nameAr: it.nameAr };
    });
    try { localStorage.setItem("bp_pending_quote", JSON.stringify({ items: items, at: new Date().toISOString().slice(0, 10) })); } catch (err) {}
    location.href = (BP.lang === "ar" ? "/ar/account" : "/account") + "?redirect=quote";
  });

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  render();
})();

/* اسأل باهر — مكتب دعم موجّه:
   ١) بيانات العميل أولاً (اسم/جوال/بريد إلزامي)،
   ٢) اختيار الخدمة من نوافذ رئيسية (فئات الموقع) وفرعية (خدماتها) ← تذكرة دعم،
   ٣) ومحادثة باهر الذكية متاحة بعد البيانات.
   كل تذكرة/محادثة تُرسل للمالك (BP Inbox + CRM + إشعار واتساب/بريد). */
(function () {
  "use strict";
  var fab = document.getElementById("advisor-fab");
  var panel = document.getElementById("advisor-panel");
  if (!fab || !panel) return;
  var T = function (en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; };
  var isAr = function () { return !(window.BP && BP.lang === "en"); };
  var $ = function (id) { return document.getElementById(id); };
  var closeBtn = $("advisor-close"), backBtn = $("advisor-back"), statusEl = $("advisor-status");
  var teaser = $("advisor-teaser"), teaserClose = $("advisor-teaser-close");
  var msgs = $("advisor-msgs"), form = $("advisor-form"), input = $("advisor-input"), chips = $("advisor-chips");
  var sendBtn = form ? form.querySelector("button[type=submit]") : null;
  var MOBILE_RE = /^(?:\+?966|0)?5\d{8}$/;
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var CAT_ICON = { "Company Formation": "🏢", "Foreign Investment": "🌍", "Premium Residency": "🪪", "Government Relations": "🏛️", "HR Services": "👥", "Recruitment": "🧑‍💼", "Business Support": "📊", "Real Estate": "🏗️", "AI Automation": "🤖", "Tourism": "✈️" };
  var busy = false;

  // ---- stable session id + saved contact (per tab) ----
  var sid = ""; try { sid = sessionStorage.getItem("bp_adv_sid") || ""; } catch (e) {}
  if (!sid) { sid = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); try { sessionStorage.setItem("bp_adv_sid", sid); } catch (e) {} }
  var contact = null; try { contact = JSON.parse(sessionStorage.getItem("bp_adv_contact") || "null"); } catch (e) {}
  function saveContact(c) { contact = c; try { sessionStorage.setItem("bp_adv_contact", JSON.stringify(c)); } catch (e) {} }

  // ---- chat history (per tab) ----
  function loadHistory() { try { return JSON.parse(sessionStorage.getItem("bp_adv_history") || "[]"); } catch (e) { return []; } }
  function saveHistory() { try { sessionStorage.setItem("bp_adv_history", JSON.stringify(history.slice(-40))); } catch (e) {} }
  var history = loadHistory();

  // ---- view manager ----
  var VIEWS = ["advisor-intake", "advisor-home", "advisor-sub", "advisor-ticket", "advisor-book", "advisor-chat"];
  var current = "advisor-intake";
  function show(view, canBack) {
    current = view;
    VIEWS.forEach(function (v) { var el = $(v); if (el) el.hidden = v !== view; });
    if (backBtn) backBtn.hidden = !canBack;
    if (statusEl) statusEl.textContent = view === "advisor-chat"
      ? T("Your smart partner — online now", "شريكك الذكي — متصل الآن")
      : T("Support desk", "مكتب الدعم");
  }
  function goHome() {
    if (!contact) { show("advisor-intake", false); setTimeout(function () { var n = $("adv-in-name"); if (n) n.focus(); }, 50); return; }
    var hello = $("advisor-hello");
    if (hello) hello.textContent = "👋 " + T("Welcome, ", "أهلاً ") + (contact.name || "") + " — " + T("how can we help?", "كيف نقدر نساعدك؟");
    show("advisor-home", false);
    loadCatalog();
  }

  // ---- catalog (9 main windows -> sub-services) ----
  var catalog = null, catalogLoading = false;
  function loadCatalog() {
    var wrap = $("advisor-cats");
    if (catalog) { renderCats(); return; }
    if (catalogLoading) return;
    catalogLoading = true;
    fetch("/assets/data/catalog.json", { cache: "force-cache" })
      .then(function (r) { return r.json(); })
      .then(function (d) { catalog = d; catalogLoading = false; renderCats(); })
      .catch(function () { catalogLoading = false; if (wrap) wrap.innerHTML = '<div class="adv-loading">' + T("Couldn't load services — use chat or WhatsApp.", "تعذّر تحميل الخدمات — استخدم المحادثة أو واتساب.") + "</div>"; });
  }
  function catName(c) { return isAr() ? c.nameAr : (c.nameEn || c.nameAr); }
  function svcName(s) { return isAr() ? s.nameAr : (s.nameEn || s.nameAr); }
  function renderCats() {
    var wrap = $("advisor-cats"); if (!wrap || !catalog) return;
    wrap.innerHTML = "";
    (catalog.categories || []).forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "adv-cat";
      b.innerHTML = '<span class="adv-cat-ico">' + (CAT_ICON[c.key] || "📁") + '</span><span class="adv-cat-nm">' + catName(c) + '</span><span class="adv-cat-n">' + (c.count || "") + "</span>";
      b.addEventListener("click", function () { openCategory(c); });
      wrap.appendChild(b);
    });
  }
  function openCategory(c) {
    var hd = $("advisor-sub-hd"); if (hd) hd.textContent = (CAT_ICON[c.key] || "📁") + " " + catName(c);
    var list = $("advisor-svcs"); list.innerHTML = "";
    (catalog.services || []).filter(function (s) { return s.category === c.key; }).forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "adv-svc";
      // بدون أسعار — نعرض «اطلب عرض سعر» بدلها (السعر يُحدّد حسب الحالة)
      b.innerHTML = '<span class="adv-svc-nm">' + svcName(s) + '</span><span class="adv-svc-p">' + T("Get a quote", "اطلب عرض سعر") + " ←</span>";
      b.addEventListener("click", function () { openTicket(c, s); });
      list.appendChild(b);
    });
    var other = document.createElement("button");
    other.type = "button"; other.className = "adv-svc adv-svc-other";
    other.innerHTML = '<span class="adv-svc-nm">🎫 ' + T("Other / general request in this area", "أخرى / طلب عام في هذا المجال") + "</span>";
    other.addEventListener("click", function () { openTicket(c, { code: "", nameAr: "طلب عام — " + c.nameAr, nameEn: "General — " + (c.nameEn || c.nameAr) }); });
    list.appendChild(other);
    show("advisor-sub", true);
  }
  var pendingService = null, pendingCat = null;
  function openTicket(c, s) {
    pendingCat = c; pendingService = s;
    var hd = $("advisor-ticket-hd");
    if (hd) hd.innerHTML = "💬 " + T("Request a quote for:", "طلب عرض سعر لـ:") + ' <strong>' + svcName(s) + "</strong>";
    var note = $("advisor-ticket-note"); if (note) note.value = "";
    var done = $("advisor-ticket-done"); if (done) { done.hidden = true; done.innerHTML = ""; }
    var go = $("advisor-ticket-go"); if (go) { go.hidden = false; go.disabled = false; go.textContent = "💬 " + T("Request a price quote", "اطلب عرض السعر"); }
    show("advisor-ticket", true);
  }

  // ---- create support ticket ----
  function createTicket() {
    if (!contact) { goHome(); return; }
    var go = $("advisor-ticket-go"), done = $("advisor-ticket-done");
    var note = ($("advisor-ticket-note") || {}).value || "";
    go.disabled = true; go.textContent = T("Opening…", "جارٍ الفتح…");
    var svc = pendingService || {}, cat = pendingCat || {};
    fetch("/api/requests", {
      method: "POST", headers: { "content-type": "application/json" }, keepalive: true,
      body: JSON.stringify({
        type: "support-ticket", sid: sid, contact: contact,
        service: { code: svc.code || "", nameAr: svc.nameAr || "", nameEn: svc.nameEn || "", category: (cat.key || ""), categoryAr: (cat.nameAr || "") },
        note: note.slice(0, 1200),
      }),
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        go.hidden = true;
        done.hidden = false;
        var ref = (d && d.ref) || "";
        done.innerHTML = "✅ <strong>" + T("We received your quote request", "استلمنا طلبك لعرض السعر") + (ref ? " — " + ref : "") + "</strong><br>" +
          T("Your advisor Baher will prepare a price tailored to your case and contact you shortly on your number/email.", "بيجهّز لك مستشارك باهر عرض سعر حسب حالتك ويتواصل معك قريباً على رقمك/بريدك.") +
          '<div class="adv-ticket-acts"><button type="button" class="adv-primary" id="adv-ticket-more">' + T("New request", "طلب جديد") + '</button>' +
          '<a class="adv-ghost" target="_blank" rel="noopener" href="https://wa.me/966503793356">' + T("WhatsApp advisor", "واتساب المستشار") + "</a></div>";
        var more = $("adv-ticket-more"); if (more) more.addEventListener("click", goHome);
      }).catch(function () {
        go.disabled = false; go.textContent = "💬 " + T("Request a price quote", "اطلب عرض السعر");
        done.hidden = false; done.innerHTML = "⚠️ " + T("Couldn't send the request — try WhatsApp.", "تعذّر إرسال الطلب — جرّب واتساب.") + ' <a target="_blank" rel="noopener" href="https://wa.me/966503793356">' + T("WhatsApp", "واتساب") + "</a>";
      });
  }

  // ---- book a consultation (BP hours: 9am–6pm Riyadh, closed Friday) ----
  var bookDate = "", bookTime = "";
  var DOW_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  var DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MON_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  var MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function ymd(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function openBooking() {
    bookDate = ""; bookTime = "";
    var done = $("advisor-book-done"); if (done) { done.hidden = true; done.innerHTML = ""; }
    var go = $("advisor-book-go"); if (go) go.hidden = true;
    renderBookDays();
    $("advisor-book-slots").innerHTML = '<div class="adv-book-hint">' + T("Pick a day first.", "اختر اليوم أولاً.") + "</div>";
    show("advisor-book", true);
  }
  function renderBookDays() {
    var wrap = $("advisor-book-days"); if (!wrap) return;
    wrap.innerHTML = "";
    var d = new Date(); d.setHours(0, 0, 0, 0);
    var shown = 0, guard = 0;
    while (shown < 12 && guard < 30) {
      guard++;
      var day = new Date(d.getTime() + guard * 86400000); // ابتداءً من الغد
      if (day.getDay() === 5) continue; // 5 = الجمعة — إجازة
      var val = ymd(day);
      var b = document.createElement("button");
      b.type = "button"; b.className = "adv-book-day"; b.setAttribute("data-d", val);
      b.innerHTML = "<b>" + (isAr() ? DOW_AR[day.getDay()] : DOW_EN[day.getDay()]) + "</b><span>" + day.getDate() + " " + (isAr() ? MON_AR[day.getMonth()] : MON_EN[day.getMonth()]) + "</span>";
      b.addEventListener("click", function () { pickDay(this.getAttribute("data-d"), this); });
      wrap.appendChild(b);
      shown++;
    }
  }
  function pickDay(val, el) {
    bookDate = val; bookTime = "";
    var days = $("advisor-book-days").querySelectorAll(".adv-book-day");
    for (var i = 0; i < days.length; i++) days[i].classList.remove("on");
    if (el) el.classList.add("on");
    var go = $("advisor-book-go"); if (go) go.hidden = true;
    var slots = $("advisor-book-slots"); slots.innerHTML = "";
    // فترات كل ساعة من ٩ ص إلى ٥ م (آخر موعد يبدأ ٥ وينتهي ٦)
    for (var h = 9; h <= 17; h++) {
      var hh = ("0" + h).slice(-2) + ":00";
      var label = (h > 12 ? (h - 12) : h) + (isAr() ? (h >= 12 ? " م" : " ص") : (h >= 12 ? " PM" : " AM"));
      var b = document.createElement("button");
      b.type = "button"; b.className = "adv-book-slot"; b.setAttribute("data-t", hh); b.textContent = label;
      b.addEventListener("click", function () { pickSlot(this.getAttribute("data-t"), this); });
      slots.appendChild(b);
    }
  }
  function pickSlot(val, el) {
    bookTime = val;
    var s = $("advisor-book-slots").querySelectorAll(".adv-book-slot");
    for (var i = 0; i < s.length; i++) s[i].classList.remove("on");
    if (el) el.classList.add("on");
    var go = $("advisor-book-go"); if (go) go.hidden = false;
  }
  function confirmBooking() {
    if (!contact) { goHome(); return; }
    if (!bookDate || !bookTime) return;
    var go = $("advisor-book-go"), done = $("advisor-book-done");
    go.disabled = true; go.textContent = T("Booking…", "جارٍ الحجز…");
    fetch("/api/requests", {
      method: "POST", headers: { "content-type": "application/json" }, keepalive: true,
      body: JSON.stringify({ type: "booking", sid: sid, contact: contact, date: bookDate, time: bookTime }),
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        go.hidden = true;
        done.hidden = false;
        var ref = (d && d.ref) || "";
        var cal = (d && d.gcalUrl) || "";
        done.innerHTML = "✅ <strong>" + T("Your consultation is booked", "تم حجز استشارتك") + (ref ? " — " + ref : "") + "</strong><br>" +
          T("Your advisor Baher will confirm shortly.", "بيأكّد لك مستشارك باهر قريباً.") +
          '<div class="adv-ticket-acts">' +
          (cal ? '<a class="adv-primary" target="_blank" rel="noopener" href="' + cal + '">📅 ' + T("Add to Google Calendar", "أضِف إلى تقويم Google") + "</a>" : "") +
          '<a class="adv-ghost" target="_blank" rel="noopener" href="https://wa.me/966503793356">' + T("WhatsApp advisor", "واتساب المستشار") + "</a></div>";
      }).catch(function () {
        go.disabled = false; go.textContent = "✅ " + T("Confirm appointment", "أكّد الموعد");
        done.hidden = false; done.innerHTML = "⚠️ " + T("Couldn't book — try WhatsApp.", "تعذّر الحجز — جرّب واتساب.") + ' <a target="_blank" rel="noopener" href="https://wa.me/966503793356">' + T("WhatsApp", "واتساب") + "</a>";
      });
  }

  // ---- intake ----
  function submitIntake() {
    var name = (($("adv-in-name") || {}).value || "").trim();
    var phone = (($("adv-in-phone") || {}).value || "").trim();
    var email = (($("adv-in-email") || {}).value || "").trim();
    var err = $("adv-intake-err");
    function fail(m) { if (err) { err.hidden = false; err.textContent = m; } }
    if (!name) return fail(T("Please enter your name.", "الرجاء إدخال اسمك."));
    if (!MOBILE_RE.test(phone.replace(/\s/g, ""))) return fail(T("Enter a valid Saudi mobile (05XXXXXXXX).", "أدخل جوالاً سعودياً صحيحاً (05XXXXXXXX)."));
    if (!EMAIL_RE.test(email)) return fail(T("Enter a valid email.", "أدخل بريداً صحيحاً."));
    if (err) err.hidden = true;
    saveContact({ name: name, phone: phone, email: email });
    goHome();
  }

  // ---- chat (available after intake) ----
  function addMsg(text, who) {
    var el = document.createElement("div"); el.className = "advisor-msg " + who; el.textContent = text;
    msgs.appendChild(el); msgs.scrollTop = msgs.scrollHeight; return el;
  }
  var historyReplayed = false;
  function openChat() {
    show("advisor-chat", true);
    if (!historyReplayed) {
      history.forEach(function (m) { addMsg(m.content, m.role === "user" ? "me" : "bot"); });
      if (chips && history.length) chips.hidden = true;
      historyReplayed = true;
    }
    setTimeout(function () { if (input) input.focus(); }, 50);
  }
  function syncConversation() {
    if (!history.length) return;
    try {
      fetch("/api/requests", {
        method: "POST", headers: { "content-type": "application/json" }, keepalive: true,
        body: JSON.stringify({ type: "advisor-chat", sid: sid, messages: history.slice(-24), notify: false, contact: contact || null }),
      }).catch(function () {});
    } catch (e) {}
  }
  function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    addMsg(text, "me"); history.push({ role: "user", content: text }); saveHistory();
    if (chips) chips.hidden = true;
    busy = true; if (sendBtn) sendBtn.disabled = true;
    var typing = addMsg(T("Typing…", "يكتب…"), "bot typing");
    fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        typing.remove();
        var reply = (data && data.reply) || T("Couldn't reply right now. Message us on WhatsApp and we'll help immediately.", "تعذّر الرد الآن. تواصل معنا على واتساب وبنساعدك فوراً.");
        addMsg(reply, "bot"); history.push({ role: "assistant", content: reply }); saveHistory();
        syncConversation();
      })
      .catch(function () { typing.remove(); addMsg(T("The advisor runs on the published site. Message us on WhatsApp and we'll help immediately.", "المستشار يعمل على النسخة المنشورة من الموقع. تواصل معنا على واتساب وبنساعدك فوراً."), "bot"); })
      .finally(function () { busy = false; if (sendBtn) sendBtn.disabled = false; if (input) input.focus(); });
  }

  // ---- open/close + back + teaser ----
  function open() { panel.hidden = false; fab.classList.add("hide"); hideTeaser(); goHome(); }
  function close() { panel.hidden = true; fab.classList.remove("hide"); }
  function back() {
    if (current === "advisor-sub" || current === "advisor-chat") goHome();
    else if (current === "advisor-ticket") { if (pendingCat) openCategory(pendingCat); else goHome(); }
    else goHome();
  }
  fab.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  if (backBtn) backBtn.addEventListener("click", back);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });

  function hideTeaser() { if (!teaser) return; teaser.hidden = true; try { sessionStorage.setItem("bp_teaser_seen", "1"); } catch (e) {} }
  var teaserSeen = false; try { teaserSeen = !!sessionStorage.getItem("bp_teaser_seen"); } catch (e) {}
  if (teaser && !teaserSeen) setTimeout(function () { if (panel.hidden) teaser.hidden = false; }, 4000);
  if (teaser) teaser.addEventListener("click", function (e) { if (e.target === teaserClose) return; open(); });
  if (teaserClose) teaserClose.addEventListener("click", function (e) { e.stopPropagation(); hideTeaser(); });

  // ---- wire controls ----
  var intakeGo = $("advisor-intake-go"); if (intakeGo) intakeGo.addEventListener("click", submitIntake);
  ["adv-in-name", "adv-in-phone", "adv-in-email"].forEach(function (id) {
    var el = $(id); if (el) el.addEventListener("keydown", function (e) { if (e.key === "Enter") submitIntake(); });
  });
  var chatOpen = $("advisor-chat-open"); if (chatOpen) chatOpen.addEventListener("click", openChat);
  var ticketGo = $("advisor-ticket-go"); if (ticketGo) ticketGo.addEventListener("click", createTicket);
  var bookOpen = $("advisor-book-open"); if (bookOpen) bookOpen.addEventListener("click", openBooking);
  var bookGo = $("advisor-book-go"); if (bookGo) bookGo.addEventListener("click", confirmBooking);
  if (form) form.addEventListener("submit", function (e) { e.preventDefault(); var v = input.value; input.value = ""; send(v); });
  if (chips) chips.addEventListener("click", function (e) { var btn = e.target.closest(".advisor-chip"); if (btn) send(btn.getAttribute("data-q") || btn.textContent); });
})();

/* ---------- Grouped nav dropdowns (Business Partner 3.0) ---------- */
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    var drop = e.target.closest(".nav-drop");
    var groups = document.querySelectorAll(".nav-group");
    if (drop) {
      var g = drop.closest(".nav-group");
      // Close every group except g itself and any of its ancestors/descendants,
      // so opening a nested flyout (e.g. service categories) doesn't collapse
      // the parent panel it lives inside.
      groups.forEach(function (x) { if (x !== g && !g.contains(x) && !x.contains(g)) x.classList.remove("open"); });
      g.classList.toggle("open");
      drop.setAttribute("aria-expanded", g.classList.contains("open"));
    } else if (!e.target.closest(".nav-menu")) {
      groups.forEach(function (x) { x.classList.remove("open"); });
    }
  });
})();

/* ---------- Consultation booking (form → /api/book → email + Google Calendar) ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("booking-form");
    if (!form) return;

    var dateEl = document.getElementById("bk-date");
    var today = new Date();
    var iso = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    if (dateEl) dateEl.min = iso;

    // Working days: Saturday–Thursday. Friday (JS getDay()===5) is off.
    function isFriday(v) { if (!v) return false; var p = v.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).getDay() === 5; }
    if (dateEl) {
      dateEl.addEventListener("change", function () {
        if (isFriday(dateEl.value)) {
          alert(BP.t("Friday is off. Please pick Saturday–Thursday.", "الجمعة إجازة. الرجاء اختيار يوم من السبت إلى الخميس."));
          dateEl.value = "";
        }
      });
    }

    // Prefill topic + note when the client arrived from a price-less item (?topic=&about=).
    var qp = new URLSearchParams(location.search);
    var qTopic = qp.get("topic"), qAbout = qp.get("about");
    if (qTopic) { var ts = document.getElementById("bk-topic"); if (ts && [].some.call(ts.options, function (o) { return o.value === qTopic; })) ts.value = qTopic; }
    if (qAbout) { var nt = document.getElementById("bk-notes"); if (nt && !nt.value) nt.value = BP.t("Regarding: ", "بخصوص: ") + qAbout; }

    var topicMap = {};
    (form.getAttribute("data-topics") || "").split("|").forEach(function (p) {
      var i = p.indexOf("="); if (i > 0) topicMap[p.slice(0, i)] = p.slice(i + 1);
    });

    function gcal(topic, date, time, notes) {
      var h = parseInt(time.slice(0, 2), 10), m = time.slice(3, 5);
      var d = date.replace(/-/g, "");
      var pad = function (n) { return String(n).padStart(2, "0"); };
      var q = new URLSearchParams({
        action: "TEMPLATE",
        text: "استشارة Business Partner — " + topic,
        dates: d + "T" + pad(h) + m + "00/" + d + "T" + pad(h + 1) + m + "00",
        ctz: "Asia/Riyadh",
        details: "استشارة مع فريق Business Partner.\n" + (notes || ""),
        location: "Business Partner — Riyadh / Online",
      });
      return "https://calendar.google.com/calendar/render?" + q.toString();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("bk-name").value.trim();
      var phone = document.getElementById("bk-phone").value.trim();
      var email = document.getElementById("bk-email").value.trim();
      var topicKey = document.getElementById("bk-topic").value;
      var topic = topicMap[topicKey] || topicKey;
      var date = document.getElementById("bk-date").value;
      var time = document.getElementById("bk-time").value;
      var notes = document.getElementById("bk-notes").value.trim();
      if (!name || !phone || !email || !date || !time) {
        alert(BP.t("Please fill the required fields.", "الرجاء تعبئة الحقول المطلوبة.")); return;
      }
      if (isFriday(date)) {
        alert(BP.t("Friday is off. Please pick Saturday–Thursday.", "الجمعة إجازة. الرجاء اختيار يوم من السبت إلى الخميس.")); return;
      }
      var btn = form.querySelector("button[type=submit]"); var lbl = btn.textContent;
      btn.disabled = true; btn.textContent = BP.t("Booking…", "جارٍ الحجز…");

      function done(ref, calUrl, emailSent) {
        var box = document.getElementById("booking-success");
        var waMsg = encodeURIComponent("حجز استشارة " + ref + "\nالاسم: " + name + "\nالموضوع: " + topic + "\nالموعد: " + date + " " + time);
        box.hidden = false;
        box.innerHTML = "✅ <strong>" + BP.t("Booking received", "تم استلام حجزك") + " — " + ref + "</strong><br>" +
          (emailSent
            ? BP.t("A confirmation was sent to your email.", "أرسلنا التأكيد إلى بريدك الإلكتروني.")
            : BP.t("Save the appointment and notify us on WhatsApp to confirm.", "احفظ الموعد وأشعرنا عبر واتساب لتأكيده.")) +
          '<br><a class="btn btn-primary" style="margin-top:12px" target="_blank" rel="noopener" href="' + calUrl + '">' +
          BP.t("Add to Google Calendar", "أضِف إلى تقويم Google") + "</a> " +
          '<a class="btn btn-ghost" style="margin-top:12px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + waMsg + '">' +
          BP.t("Notify us on WhatsApp", "أشعرنا عبر واتساب") + "</a>";
        box.scrollIntoView({ behavior: "smooth", block: "center" });
        btn.textContent = lbl;
      }

      fetch("/api/book", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name, phone: phone, email: email, topic: topic, date: date, time: time, notes: notes }),
      }).then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) done(d.ref, d.gcalUrl || gcal(topic, date, time, notes), d.emailSent);
          else { btn.disabled = false; btn.textContent = lbl; alert(BP.t("Couldn't complete the booking. Try again.", "تعذّر إتمام الحجز. حاول مرة أخرى.")); }
        })
        .catch(function () {
          done("BC-LOCAL", gcal(topic, date, time, notes), false);
        });
    });
  });
})();

/* ---------- Event request + supplier registration forms → /api/requests ---------- */
(function () {
  "use strict";
  var FREE = ["gmail.com","googlemail.com","hotmail.com","outlook.com","outlook.sa","live.com","msn.com",
    "yahoo.com","ymail.com","icloud.com","me.com","mac.com","aol.com","proton.me","protonmail.com",
    "zoho.com","mail.com","gmx.com","gmx.net","yandex.com","yandex.ru","inbox.com","hey.com"];
  function isCorporate(email) {
    var at = email.indexOf("@"); if (at < 1) return false;
    return FREE.indexOf(email.slice(at + 1).toLowerCase()) === -1;
  }
  function val(id) { var el = document.getElementById(id); return el ? (el.value || "").trim() : ""; }
  function selText(id) { var el = document.getElementById(id); return el && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : val(id); }

  function readJSON(k, fallback) { try { return JSON.parse(localStorage.getItem(k) || fallback); } catch (e) { return JSON.parse(fallback); } }
  function wire(formId, boxId, build, validate, waText, opts) {
    opts = opts || {};
    var form = document.getElementById(formId);
    if (!form) return;
    var dateEl = form.querySelector('input[type="date"]');
    if (dateEl) {
      var n = new Date();
      dateEl.min = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
    }
    // Prefill from the signed-in client's dashboard profile, so a returning
    // client doesn't retype their details (and the request stays tied to them).
    if (opts.prefill) {
      var ses0 = readJSON("bp_session", "null"), comp0 = readJSON("bp_company", "{}");
      var usr0 = (readJSON("bp_users", "{}")[ses0 && ses0.email]) || {};
      if (ses0) {
        var pf = opts.prefill;
        function setv(id, v) { var el = id && document.getElementById(id); if (el && !el.value && v) el.value = v; }
        setv(pf.person, ses0.name); setv(pf.email, ses0.email);
        setv(pf.phone, comp0.phone || usr0.phone); setv(pf.company, comp0.name);
      }
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = build();
      var err = validate(data);
      if (err) { alert(err); return; }
      var btn = form.querySelector("button[type=submit]"); var lbl = btn.textContent;
      btn.disabled = true; btn.textContent = BP.t("Sending…", "جارٍ الإرسال…");
      function done(ref, emailSent) {
        // Register the request in the client portal (/account → "My orders"),
        // so every submitted request is linked to the client dashboard and its
        // status syncs live from our team.
        try {
          if (ref && !/^(LOCAL|مبدئي)$/.test(ref)) {
            var LABELS = {
              "investor-tourism": BP.t("Business tourism — Mahfol Makfol", "سياحة أعمال — محفول مكفول"),
              "trip": BP.t("Trip — Mahfol Makfol", "رحلة — محفول مكفول"),
              "event": BP.t("Corporate event", "فعالية مؤسسية"),
              "supplier": BP.t("Partner registration", "تسجيل شريك"),
            };
            var label = LABELS[data.type] || BP.t("Request", "طلب");
            var extra = data.dest || data.sector || data.eventType || data.category || "";
            var orders = JSON.parse(localStorage.getItem("bp_orders") || "[]");
            if (!orders.some(function (o) { return o.ref === ref; })) {
              orders.unshift({
                ref: ref, name: data.person || data.name || "", phone: data.phone || "", email: data.email || "",
                items: [{ name: label + (extra ? " · " + extra : ""), qty: 1 }],
                at: new Date().toISOString().slice(0, 10),
                status: BP.t("Under review", "قيد المراجعة"), reqType: data.type,
              });
              localStorage.setItem("bp_orders", JSON.stringify(orders));
            }
          }
        } catch (e) {}
        // Register the requester as a client in the dashboard: save their company
        // profile and sign them in (soft account) so /account shows them as a client
        // with their info + this service. The CRM record is created server-side.
        var registered = false;
        if (opts.register && ref && !/^(LOCAL|مبدئي)$/.test(ref)) {
          try {
            var comp = readJSON("bp_company", "{}");
            if (data.company) comp.name = data.company;
            if (data.phone) comp.phone = data.phone;
            if (data.email) comp.email = data.email;
            if (data.person) comp.contact = data.person;
            localStorage.setItem("bp_company", JSON.stringify(comp));
            var ses = readJSON("bp_session", "null");
            if (!ses && data.email) {
              localStorage.setItem("bp_session", JSON.stringify({ email: data.email, name: data.person || data.company || "", viaRequest: true }));
            }
            registered = true;
            try { document.dispatchEvent(new CustomEvent("bp:langchange")); } catch (e2) {}
          } catch (e1) {}
        }
        var acct = BP.lang === "ar" ? "/ar/account" : "/account";
        var isLocal = !ref || /^(LOCAL|مبدئي)$/.test(ref);
        var box = document.getElementById(boxId);
        box.hidden = false;
        // "مبدئي" is an internal sentinel for "didn't reach the server" — never
        // show it as if it were a reference number; make WhatsApp the required
        // confirmation step instead.
        box.innerHTML = "✅ <strong>" + (isLocal ? BP.t("Request saved — confirm it on WhatsApp", "تم حفظ طلبك — أكّده عبر واتساب") : BP.t("Request received", "تم استلام طلبك") + " — " + ref) + "</strong><br>" +
          (registered ? BP.t("You're now registered as a client — your details and this request are saved in ", "تم تسجيلك كعميل — بياناتك وطلبك محفوظة في ") + '<a href="' + acct + '">' + BP.t("your dashboard", "لوحتك") + "</a>.<br>" : "") +
          (isLocal ? BP.t("We couldn't reach the server right now — tap the WhatsApp button so your request reaches the team directly.", "تعذّر الاتصال بالخادم حالياً — اضغط زر واتساب ليصل طلبك للفريق مباشرة.")
            : (emailSent ? BP.t("A confirmation was sent to your email.", "أرسلنا التأكيد إلى بريدك.")
                     : BP.t("You can also notify us on WhatsApp.", "تقدر كذلك تشعرنا عبر واتساب."))) +
          ' <a class="btn ' + (isLocal ? 'btn-wa' : 'btn-ghost') + '" style="margin-top:12px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' +
          encodeURIComponent(waText(data, ref)) + '">' + BP.t("Notify us on WhatsApp", "أشعرنا عبر واتساب") + "</a>";
        box.scrollIntoView({ behavior: "smooth", block: "center" });
        btn.textContent = lbl;
      }
      fetch("/api/requests", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data),
      }).then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          if (res.d && res.d.ok) { done(res.d.ref, res.d.emailSent); return; }
          btn.disabled = false; btn.textContent = lbl;
          alert(res.d && res.d.message ? res.d.message : BP.t("Couldn't send. Try again.", "تعذّر الإرسال. حاول مرة أخرى."));
        })
        .catch(function () { done(BP.t("LOCAL", "مبدئي"), false); });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    wire("event-form", "event-success",
      function () {
        return { type: "event", company: val("ev-company"), person: val("ev-person"), phone: val("ev-phone"),
          email: val("ev-email"), date: val("ev-date"), count: val("ev-count"),
          klass: selText("ev-class"), venue: selText("ev-venue"), eventType: selText("ev-type"), notes: val("ev-notes") };
      },
      function (d) {
        if (!d.company || !d.person || !d.phone || !d.email || !d.date || !d.count)
          return BP.t("Please fill all required fields.", "الرجاء تعبئة كل الحقول المطلوبة.");
        if (!isCorporate(d.email))
          return BP.t("Please use your official company email — free providers (Gmail, Hotmail…) are not accepted.",
                      "الرجاء استخدام إيميل الشركة الرسمي — لا تُقبل الإيميلات المجانية (Gmail وHotmail وغيرها).");
        return null;
      },
      function (d, ref) { return "طلب فعالية " + ref + "\nالشركة: " + d.company + "\nالنوع: " + d.eventType + "\nالتاريخ: " + d.date + "\nالأفراد: " + d.count; },
      { register: true, prefill: { company: "ev-company", person: "ev-person", email: "ev-email", phone: "ev-phone" } });

    // Supplier registration writes straight into the Suppliers registry — not
    // the customer CRM — and no session is created here: the supplier can only
    // sign in after the owner approves them and the access code is emailed.
    var spForm = document.getElementById("supplier-form");
    if (spForm) spForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var okBox = document.getElementById("supplier-success");
      var payload = {
        type: "register", company: val("sp-company"), person: val("sp-person"), phone: val("sp-phone"),
        email: (val("sp-email") || "").toLowerCase(), city: val("sp-city"), cr: val("sp-cr"), vat: val("sp-vat"),
        categories: [(document.getElementById("sp-cat") || {}).value].filter(Boolean),
        services: val("sp-notes"),
      };
      if (!payload.company || !payload.person || !payload.phone || !payload.email) {
        if (okBox) { okBox.textContent = BP.t("Please fill all required fields.", "الرجاء تعبئة كل الحقول المطلوبة."); okBox.hidden = false; }
        return;
      }
      var btn = spForm.querySelector("button[type=submit]"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = BP.t("Sending…", "جارٍ الإرسال…");
      fetch("/api/suppliers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          btn.disabled = false; btn.textContent = lbl;
          if (!okBox) return;
          if (d && d.ok) {
            okBox.innerHTML = "✅ <strong>" + BP.t("Registered", "تم التسجيل") + (d.ref ? " — " + d.ref : "") + "</strong><br>" +
              BP.t("We review your file and email your portal access code once approved.",
                   "نراجع ملفك ويصلك رمز دخول البوابة على بريدك فور الاعتماد.");
            spForm.reset();
          } else {
            okBox.textContent = BP.t("Could not register — please try again or contact us.", "تعذّر التسجيل — حاول مرة أخرى أو تواصل معنا.");
          }
          okBox.hidden = false;
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = lbl;
          if (okBox) { okBox.textContent = BP.t("Connection issue — please try again.", "مشكلة في الاتصال — حاول مرة أخرى."); okBox.hidden = false; }
        });
    });

    wire("mm-form-el", "mm-success",
      function () {
        return { type: "investor-tourism", company: val("mm-company"), person: val("mm-person"), phone: val("mm-phone"),
          email: val("mm-email"), country: val("mm-country"), count: val("mm-count"), date: val("mm-date"),
          sector: val("mm-sector"), notes: val("mm-notes") };
      },
      function (d) {
        if (!d.company || !d.person || !d.phone || !d.email)
          return BP.t("Please fill all required fields.", "الرجاء تعبئة كل الحقول المطلوبة.");
        return null;
      },
      function (d, ref) { return "طلب سياحة أعمال " + ref + "\nالشركة: " + d.company + "\nالدولة: " + d.country + "\nعدد الوفد: " + d.count; },
      { register: true, prefill: { company: "mm-company", person: "mm-person", email: "mm-email", phone: "mm-phone" } });

    wire("trip-form-el", "trip-success",
      function () {
        return { type: "trip", person: val("tr-name"), phone: val("tr-phone"), email: val("tr-email"),
          dest: val("tr-dest"), count: val("tr-count"), date: val("tr-dates"), notes: val("tr-notes") };
      },
      function (d) {
        if (!d.person || !d.phone || !d.email)
          return BP.t("Please fill all required fields.", "الرجاء تعبئة كل الحقول المطلوبة.");
        return null;
      },
      function (d, ref) { return "طلب رحلة " + ref + "\nالاسم: " + d.person + "\nالوجهة: " + (d.dest || "-") + "\nعدد الأشخاص: " + (d.count || "-") + "\nالتواريخ: " + (d.date || "-"); });
  });
})();

/* ---------- Copy buttons + online payment (auto-enabled when /api/pay has keys) ---------- */
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".copy-btn");
    if (!b) return;
    var text = b.getAttribute("data-copy") || "";
    function done() { var t = b.textContent; b.textContent = BP.t("Copied ✓", "نُسخ ✓"); setTimeout(function () { b.textContent = t; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
    else { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (err) {} ta.remove(); done(); }
  });

  var box = document.getElementById("epay-box"), mount = document.getElementById("epay-form");
  if (!box || !mount) return;

  // total incl. VAT; quote-only carts stay on bank transfer
  var total = 0;
  try {
    var c = (BP.cart && BP.cart.read()) || [];
    var extraFee = (typeof BP.extraCheckoutFee === "function") ? (BP.extraCheckoutFee() || 0) : 0;
    total = (c.reduce(function (s, i) { return s + (i.amount ? i.amount * (i.qty || 1) : 0); }, 0) + extraFee) * 1.15;
  } catch (e2) {}

  // What the invoice will be made out to. Snapshotted on every edit, because
  // Moyasar takes the buyer off-site for 3-D Secure and brings them back to a
  // fresh page — the form's contents do not survive that trip, and an invoice
  // issued without them is one that can only be voided, never corrected.
  var SNAP = "bp_pay_order";
  function fieldVal(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function taxKind() {
    var r = document.querySelectorAll('input[name="taxkind"]');
    for (var i = 0; i < r.length; i++) if (r[i].checked) return r[i].value;
    return "personal";
  }
  // A company invoice needs the full set; missing any of it means the invoice
  // would go out in the wrong name, so online payment waits until it is there.
  function taxGap() {
    if (taxKind() !== "company") return "";
    if (!fieldVal("co-tax-name")) return BP.t("company name in Arabic", "اسم الشركة بالعربي");
    if (fieldVal("co-tax-vat").replace(/\D/g, "").length !== 15) return BP.t("a 15-digit VAT number", "الرقم الضريبي (١٥ رقماً)");
    if (!fieldVal("co-tax-contact") || !fieldVal("co-tax-mobile")) return BP.t("the responsible person's name and mobile", "اسم الشخص المسؤول وجواله");
    if (!fieldVal("co-na-bno") || !fieldVal("co-na-street") || !fieldVal("co-na-district") || !fieldVal("co-na-city") || !fieldVal("co-na-post"))
      return BP.t("the full national address", "العنوان الوطني كاملاً");
    return "";
  }
  function sessionOf() { try { return JSON.parse(localStorage.getItem("bp_session") || "null"); } catch (e) { return null; } }
  function snapshot() {
    var ses = sessionOf();
    var cart2 = (BP.cart && BP.cart.read()) || [];
    var tp = { kind: taxKind() };
    if (tp.kind === "company") {
      tp = {
        kind: "company", nameAr: fieldVal("co-tax-name"), vat: fieldVal("co-tax-vat").replace(/\D/g, ""),
        cr: fieldVal("co-tax-cr"), contact: fieldVal("co-tax-contact"), contactPhone: fieldVal("co-tax-mobile"),
        address: {
          buildingNo: fieldVal("co-na-bno"), street: fieldVal("co-na-street"), district: fieldVal("co-na-district"),
          city: fieldVal("co-na-city"), postalCode: fieldVal("co-na-post"), additionalNo: fieldVal("co-na-add")
        }
      };
    }
    var order = {
      ref: "BP-" + Date.now().toString().slice(-6),
      name: (ses && ses.name) || fieldVal("co-name"),
      email: ((ses && ses.email) || fieldVal("co-email")).toLowerCase(),
      phone: fieldVal("co-phone"),
      items: cart2.map(function (i) { return { id: i.id || "", qty: i.qty || 1 }; }),
      taxProfile: tp
    };
    try { sessionStorage.setItem(SNAP, JSON.stringify(order)); } catch (e) {}
    return order;
  }

  if (total > 0) {
    fetch("/api/pay").then(function (r) { return r.json(); }).then(function (cfg) {
      if (!cfg || !cfg.enabled) return;
      var link = document.createElement("link"); link.rel = "stylesheet"; link.href = cfg.cssUrl; document.head.appendChild(link);
      var s = document.createElement("script"); s.src = cfg.scriptUrl;
      s.onload = function () {
        try {
          window.Moyasar.init({
            element: "#epay-form",
            amount: Math.round(total * 100),
            currency: cfg.currency || "SAR",
            description: "Business Partner order",
            publishable_api_key: cfg.publishableKey,
            callback_url: location.origin + location.pathname,
            methods: ["creditcard"],
          });
          box.hidden = false;
          gate();
        } catch (e3) {}
      };
      document.head.appendChild(s);
    }).catch(function () {});
  }

  // Keep the snapshot current, and keep the pay form out of reach while the
  // tax details are incomplete — paying first and discovering the invoice is
  // in the wrong name afterwards costs a credit note and a reissue.
  var gateMsg = null;
  function gate() {
    var gap = taxGap();
    if (!gateMsg) {
      gateMsg = document.createElement("div");
      gateMsg.style.cssText = "margin:10px 0;padding:10px 12px;border-radius:10px;background:#fff8ed;color:#b45309;font-size:14px;line-height:1.8";
      box.insertBefore(gateMsg, mount);
    }
    gateMsg.hidden = !gap;
    if (gap) gateMsg.textContent = BP.t("Complete " + gap + " above to enable online payment — your tax invoice is issued from these details.",
                                        "أكمل " + gap + " أعلاه لتفعيل الدفع الإلكتروني — فاتورتك الضريبية تُصدر من هذه البيانات.");
    mount.style.display = gap ? "none" : "";
    if (!gap) snapshot();
  }
  document.addEventListener("input", function (e) { if (e.target && e.target.closest && e.target.closest("#checkout-form, form")) gate(); });
  document.addEventListener("change", function (e) { if (e.target && e.target.closest && e.target.closest("#checkout-form, form")) gate(); });

  // back from 3-D Secure: ?id=<payment_id> → verify server-side
  var params = new URLSearchParams(location.search);
  var payId = params.get("id");
  if (payId) {
    var stashed = null;
    try { stashed = JSON.parse(sessionStorage.getItem(SNAP) || "null"); } catch (e4) {}
    fetch("/api/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: payId, order: stashed || undefined }) })
      .then(function (r) { return r.json(); })
      .then(function (v) {
        var ok = v && v.ok;
        var el = document.getElementById("checkout-success");
        if (el) {
          el.hidden = false;
          var inv = v && v.invoice;
          el.innerHTML = ok
            ? "✅ <strong>" + BP.t("Payment received", "تم استلام الدفعة") + "</strong><br>" +
              (inv && inv.invoiced && inv.clientEmailed
                ? BP.t("Your tax invoice (no. ", "فاتورتك الضريبية رقم ") + "<strong dir=\"ltr\">" + String(inv.number) + "</strong>" +
                  BP.t(") has been emailed to you as a PDF.", " أُرسلت إلى بريدك بصيغة PDF.")
                : (inv && inv.invoiced
                    ? BP.t("Your tax invoice no. ", "فاتورتك الضريبية رقم ") + "<strong dir=\"ltr\">" + String(inv.number) + "</strong>" +
                      BP.t(" has been issued and reaches you by email shortly.", " صدرت وتصلك على بريدك خلال دقائق.")
                    : BP.t("Your tax invoice reaches you by email shortly.", "فاتورتك الضريبية تصلك على بريدك خلال دقائق.")))
            : BP.t("Payment not completed — you can retry or use bank transfer.", "لم تكتمل الدفعة — يمكنك المحاولة مجدداً أو استخدام التحويل البنكي.");
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (ok && BP.cart) BP.cart.write([]);
        if (ok) { try { sessionStorage.removeItem(SNAP); } catch (e5) {} }
      }).catch(function () {});
  }
})();

/* ---------- Employer candidate browser (/employers) → /api/candidates (Notion ATS) ---------- */
(function () {
  "use strict";
  var grid = document.getElementById("emp-grid");
  if (!grid) return;
  var isAr = (window.BP_EMP_LANG || "en") === "ar";
  function T(en, ar) { return isAr ? ar : en; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var status = document.getElementById("emp-status");
  var loadBtn = document.getElementById("emp-load");
  var CANDS = [];
  function findC(id) { return CANDS.filter(function (c) { return c.id === id; })[0]; }

  function card(c) {
    var meta = [];
    if (c.city) meta.push("📍 " + esc(c.city));
    if (c.experience) meta.push("🧭 " + esc(c.experience) + " " + T("yrs", "سنة"));
    if (c.education) meta.push("🎓 " + esc(c.education));
    if (c.nationalityType) meta.push("🪪 " + esc(c.nationalityType));
    if (c.availability) meta.push("⏱️ " + esc(c.availability));
    var contact = "";
    if (c.name && (c.phone || c.email || c.cv)) {
      contact = '<div class="emp-contact">' +
        (c.phone ? '<a href="tel:' + esc(c.phone) + '">📞 ' + esc(c.phone) + "</a>" : "") +
        (c.email ? '<a href="mailto:' + esc(c.email) + '">✉️ ' + esc(c.email) + "</a>" : "") +
        (c.cv ? '<a target="_blank" rel="noopener" href="' + esc(c.cv) + '">📄 ' + T("CV", "السيرة") + "</a>" : "") +
        "</div>";
    }
    // Name and role are both click targets into the full profile — same
    // pattern as the full dashboard (/employer-dashboard), so this simpler
    // preview page behaves consistently instead of being a dead end.
    return '<div class="emp-card" data-id="' + esc(c.id) + '">' +
      '<div class="emp-card-top"><strong class="emp-name-link" data-id="' + esc(c.id) + '">' + esc(c.name || "—") + "</strong>" + (c.field ? '<span class="emp-tag">' + esc(c.field) + "</span>" : "") + "</div>" +
      (c.role ? '<div class="emp-role emp-role-link" data-id="' + esc(c.id) + '">' + esc(c.role) + "</div>" : "") +
      (c.skills ? '<div class="emp-skills">' + esc(c.skills) + "</div>" : "") +
      '<div class="emp-meta">' + meta.join(" · ") + "</div>" +
      contact +
      '<button type="button" class="empd-view" data-id="' + esc(c.id) + '">👤 ' + T("View profile", "عرض الملف") + "</button>" +
      "</div>";
  }

  // A Google Doc "edit" link opens the viewer; export?format=pdf triggers a
  // one-click file download instead — used for the ATS-formatted CV.
  function cvDownloadUrl(url) {
    var m = /docs\.google\.com\/document\/d\/([^/]+)/.exec(url || "");
    return m ? ("https://docs.google.com/document/d/" + m[1] + "/export?format=pdf") : url;
  }
  // Minimal markdown → HTML for the AI-generated CV text.
  function mdToHtml(md) {
    var lines = String(md || "").replace(/\r/g, "").split("\n");
    var html = "", inList = false;
    function closeList() { if (inList) { html += "</ul>"; inList = false; } }
    function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
    lines.forEach(function (line) {
      var t = line.trim();
      if (!t) { closeList(); return; }
      var h = /^(#{1,3})\s+(.*)/.exec(t);
      if (h) { closeList(); html += "<h" + (h[1].length + 2) + ">" + inline(h[2]) + "</h" + (h[1].length + 2) + ">"; return; }
      var li = /^[-*]\s+(.*)/.exec(t);
      if (li) { if (!inList) { html += "<ul>"; inList = true; } html += "<li>" + inline(li[1]) + "</li>"; return; }
      closeList();
      html += "<p>" + inline(t) + "</p>";
    });
    closeList();
    return html;
  }
  function profileHtml(c) {
    var rows = [
      [T("Name", "الاسم"), c.name ? (esc(c.name) + (c.nameAlt ? " (" + esc(c.nameAlt) + ")" : "")) : ""],
      [T("Target role", "المسمى المستهدف"), c.role],
      [T("Field", "المجال"), c.field],
      [T("City", "المدينة"), c.city],
      [T("Country", "الدولة"), c.country],
      [T("Nationality", "الجنسية"), c.nationalityType],
      [T("Residence status", "حالة الإقامة"), c.residenceStatus],
      [T("Experience", "الخبرة"), c.experience ? (c.experience + (isAr ? " سنة" : "y")) : ""],
      [T("Education", "التعليم"), c.education],
      [T("Availability", "الجاهزية"), c.availability],
      [T("Languages", "اللغات"), c.languages],
      [T("Skills", "المهارات"), c.skills],
      [T("Saudization", "التوطين"), c.saudization],
      [T("Phone", "الجوال"), c.phone ? ('<a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + "</a>") : ""],
      [T("Email", "البريد"), c.email ? ('<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a>") : ""],
    ].filter(function (r) { return r[1]; });
    var html = '<div class="empd-profile">' + rows.map(function (r) {
      return '<div class="empd-profile-row"><span class="empd-profile-k">' + esc(r[0]) + '</span><span class="empd-profile-v">' + r[1] + "</span></div>";
    }).join("") + "</div>";
    if (c.cvText) {
      html += '<h3 style="margin-top:18px">' + T("CV", "السيرة الذاتية") + '</h3><div class="empd-cv-text">' + mdToHtml(c.cvText) + "</div>";
    }
    if (c.cv) {
      html += '<a class="btn btn-primary" style="margin-top:14px;display:inline-block" href="' + esc(cvDownloadUrl(c.cv)) + '" target="_blank" rel="noopener" download>⬇️ ' +
        (c.cvKind === "ats" ? T("Download CV (ATS-formatted)", "تحميل السيرة الذاتية (منسّقة ATS)") : T("Download CV (original)", "تحميل السيرة الذاتية (الأصلية)")) + "</a>";
    } else {
      html += '<p class="emp-note" style="margin-top:14px">🔒 ' + T("Subscribe to view contact details, read the full CV and download it.", "اشترك لعرض بيانات التواصل وقراءة السيرة الذاتية كاملة وتحميلها.") + "</p>";
    }
    return html;
  }
  var modal = document.getElementById("empd-modal");
  function openModal(title, html) {
    if (!modal) return;
    document.getElementById("empd-modal-title").textContent = title;
    document.getElementById("empd-modal-body").innerHTML = html;
    modal.hidden = false;
  }
  function closeModal() { if (modal) modal.hidden = true; }
  if (modal) {
    var modalX = document.getElementById("empd-modal-x");
    if (modalX) modalX.addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  }
  function viewProfile(id) {
    var c = findC(id); if (!c) return;
    openModal(T("Candidate profile", "الملف الشخصي للمرشح"), profileHtml(c));
  }
  function bindCards() {
    grid.querySelectorAll(".empd-view, .emp-name-link, .emp-role-link").forEach(function (b) {
      b.addEventListener("click", function () { viewProfile(b.getAttribute("data-id")); });
    });
  }

  // Filters use the same shared, canonical taxonomy/combobox widget as the
  // full dashboard (/employer-dashboard) and the candidate/job-posting
  // forms — not a <select> populated by scanning whatever's on the current
  // page of results (that never localized and missed categories).
  if (window.BP && BP.initCombobox) {
    var lang = isAr ? "ar" : "en";
    BP.initCombobox(document.getElementById("emp-field"), function () { return BP.FIELD_TAXONOMY.map(function (p) { return T(p[1], p[0]); }); });
    BP.initCombobox(document.getElementById("emp-city"), function () { return BP.cityOptions ? BP.cityOptions(lang) : []; });
    BP.initCombobox(document.getElementById("emp-country"), function () { return BP.countryOptions ? BP.countryOptions(lang) : []; });
    BP.initCombobox(document.getElementById("emp-q"), function () { return BP.jobTitleOptions ? BP.jobTitleOptions(lang) : []; });
  }
  function resolveField(text) {
    var t = String(text || "").trim();
    if (!t || !window.BP || !BP.FIELD_TAXONOMY) return t;
    var hit = BP.FIELD_TAXONOMY.filter(function (p) { return p[0] === t || p[1].toLowerCase() === t.toLowerCase(); })[0];
    return hit ? hit[0] : "";
  }
  function load() {
    var q = (document.getElementById("emp-q") || {}).value || "";
    var field = resolveField((document.getElementById("emp-field") || {}).value || "");
    var city = (document.getElementById("emp-city") || {}).value || "";
    var country = (document.getElementById("emp-country") || {}).value || "";
    var nat = (document.getElementById("emp-nat") || {}).value || "";
    var code = (document.getElementById("emp-code") || {}).value || "";
    status.textContent = T("Loading candidates…", "جارٍ تحميل المرشّحين…");
    grid.innerHTML = "";
    var qs = new URLSearchParams({ q: q, field: field, city: city, country: country, nat: nat, code: code }).toString();
    fetch("/api/candidates?" + qs).then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) {
        if (res.s === 503) { status.innerHTML = T("The candidate pool isn't connected yet — ", "لم تُربط قاعدة المرشّحين بعد — ") + '<a href="https://wa.me/966507034157">' + T("contact us to subscribe.", "تواصل معنا للاشتراك.") + "</a>"; return; }
        var d = res.d;
        if (!d || !d.ok || !d.candidates) { status.textContent = T("Couldn't load candidates. Try again.", "تعذّر تحميل المرشّحين. حاول مجدداً."); return; }
        if (!d.candidates.length) { status.textContent = T("No candidates match these filters.", "لا يوجد مرشّحون مطابقون لهذه الفلاتر."); return; }
        var countTxt = d.total + " " + T(d.done ? "candidates" : "candidates (first batch)", d.done ? "مرشّح" : "مرشّح (أول دفعة)");
        status.textContent = (d.unlocked ? T("Showing full profiles — ", "عرض الملفات الكاملة — ") : T("Showing anonymized profiles — subscribe to unlock contacts. ", "عرض ملفات مموّهة — اشترك لفتح بيانات التواصل. ")) + countTxt;
        CANDS = d.candidates;
        grid.innerHTML = d.candidates.map(card).join("");
        bindCards();
      })
      .catch(function () { status.textContent = T("Network error. Try again.", "خطأ في الاتصال. حاول مجدداً."); });
  }
  if (loadBtn) loadBtn.addEventListener("click", load);
  var qEl = document.getElementById("emp-q");
  if (qEl) qEl.addEventListener("keydown", function (e) { if (e.key === "Enter") load(); });
})();

/* ---------- Employer plan cards — monthly/yearly billing toggle ---------- */
var BP_EMP_BILLING = "monthly";
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector(".emp-billing-toggle");
    if (!toggle) return;
    var btns = toggle.querySelectorAll(".emp-bill-btn");
    function applyBilling(bill) {
      document.querySelectorAll(".emp-price-m").forEach(function (el) { el.hidden = bill === "yearly"; });
      document.querySelectorAll(".emp-price-y").forEach(function (el) { el.hidden = bill === "monthly"; });
      document.querySelectorAll(".emp-plan-btn").forEach(function (b) {
        var id = b.getAttribute(bill === "yearly" ? "data-id-yearly" : "data-id-monthly");
        var amount = b.getAttribute(bill === "yearly" ? "data-amount-yearly" : "data-amount-monthly");
        var price = b.getAttribute(bill === "yearly" ? "data-price-yearly" : "data-price-monthly");
        if (id) b.setAttribute("data-id", id);
        if (amount) b.setAttribute("data-amount", amount);
        if (price != null) b.setAttribute("data-price", price);
      });
    }
    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var bill = btn.getAttribute("data-bill");
        BP_EMP_BILLING = bill;
        btns.forEach(function (b) { b.classList.toggle("active", b === btn); });
        applyBilling(bill);
      });
    });
  });
})();

/* ---------- Standalone employer registration (/portal/join → api/employer) ----------
   Registers directly against api/employer.js instead of the main site's
   cart+checkout flow — this portal is meant to work independently. Was
   previously a dead form (no submit handler at all). */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("emp-join");
    if (!form) return;
    var planEl = document.getElementById("ej-plan"), noteEl = document.getElementById("ej-plan-note");
    var isAr = (document.documentElement.lang || "en").toLowerCase().indexOf("ar") === 0;
    function T(en, ar) { return isAr ? ar : en; }
    var PLANS = window.BP_EMP_PLANS || [];
    form.querySelectorAll(".emp-plan-pick").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-plan-key");
        planEl.value = key;
        form.querySelectorAll(".emp-plan-pick").forEach(function (b) { b.classList.toggle("active", b === btn); });
        var plan = PLANS.filter(function (p) { return p.key === key; })[0];
        noteEl.style.color = "";
        if (plan) {
          var price = window.BP_EMP_BILLING === "yearly" && plan.yearlyPrice != null ? plan.yearlyPrice : plan.price;
          var showP = BP.pricesOn && price != null;
          noteEl.textContent = T("Selected: ", "تم اختيار: ") + plan.name + (showP ? " — " + price + " " + T("SAR", "ريال") : "");
        }
      });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var resultEl = document.getElementById("ej-result");
      var submitBtn = document.getElementById("ej-submit");
      if (!planEl.value) { noteEl.textContent = T("Please choose a plan first.", "الرجاء اختيار باقة أولاً."); noteEl.style.color = "#B91C1C"; return; }
      var company = document.getElementById("ej-company").value.trim();
      var phone = document.getElementById("ej-phone").value.trim();
      var email = document.getElementById("ej-email").value.trim();
      var password = document.getElementById("ej-password").value;
      if (!company || !phone || !email || !password) return; // native required attrs already cover this
      if (password.length < 8) { resultEl.hidden = false; resultEl.innerHTML = "<p>" + T("Password must be at least 8 characters.", "كلمة المرور لازم تكون 8 أحرف على الأقل.") + "</p>"; return; }
      submitBtn.disabled = true; submitBtn.textContent = T("Submitting…", "جارٍ الإرسال…");
      fetch("/api/employer", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company: company, cr: document.getElementById("ej-cr").value.trim(),
          contact: document.getElementById("ej-contact").value.trim(), phone: phone,
          email: email, password: password,
          plan: planEl.value, billing: window.BP_EMP_BILLING || "monthly",
          notes: document.getElementById("ej-notes").value.trim(),
        }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        submitBtn.disabled = false; submitBtn.textContent = T("Create account & continue to subscribe", "أنشئ حسابك وتابع الاشتراك");
        if (!d || !d.ok) { resultEl.hidden = false; resultEl.innerHTML = "<p>" + T("Something went wrong. Please try again or contact us on WhatsApp.", "صار خطأ. حاول مجدداً أو تواصل معنا عبر واتساب.") + "</p>"; return; }
        var bank = window.BP_BANK || {};
        resultEl.hidden = false;
        resultEl.innerHTML = "<h3>✅ " + T("Registered — reference", "تم التسجيل — الرقم المرجعي") + " " + d.ref + "</h3>" +
          "<p>" + T("Complete payment by bank transfer, then we'll activate your access and email your dashboard code.", "أكمل الدفع بتحويل بنكي، وسنفعّل وصولك ونرسل لك كود لوحة التحكم عبر البريد.") + "</p>" +
          (bank.iban ? "<p><strong>" + T("Bank", "البنك") + ":</strong> " + bank.bank + "<br><strong>IBAN:</strong> " + bank.iban + "<br><strong>" + T("Beneficiary", "المستفيد") + ":</strong> " + bank.beneficiary + "</p>" : "") +
          "<p class='emp-note'>" + T("Reference: use ", "الرقم المرجعي: استخدم ") + d.ref + " " + T("in your transfer note.", "في ملاحظة التحويل.") + "</p>" +
          '<a class="btn btn-wa" style="margin-top:10px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + encodeURIComponent(T("Transfer receipt for ", "إيصال تحويل لـ ") + d.ref) + '">' + T("Send receipt on WhatsApp", "أرسل الإيصال عبر واتساب") + "</a>";
        form.reset(); planEl.value = ""; noteEl.textContent = "";
        form.querySelectorAll(".emp-plan-pick").forEach(function (b) { b.classList.remove("active"); });
        resultEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }).catch(function () {
        submitBtn.disabled = false; submitBtn.textContent = T("Create account & continue to subscribe", "أنشئ حسابك وتابع الاشتراك");
        resultEl.hidden = false; resultEl.innerHTML = "<p>" + T("Network error. Please try again.", "خطأ في الاتصال. حاول مجدداً.") + "</p>";
      });
    });
  });
})();

/* ---------- Employer login (/employer-login → api/employer) ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("el-form");
    if (!form) return;
    var isAr = (document.documentElement.lang || "en").toLowerCase().indexOf("ar") === 0;
    function T(en, ar) { return isAr ? ar : en; }
    var errEl = document.getElementById("el-error");
    function dashUrl() { return "/hr/employer"; } // the new hiring console is the flagship destination

    // Email verification gate: after the password checks out, a 6-digit code
    // is emailed (via /api/otp) and must be entered before the portal opens.
    // The employer's access code + company stay in memory until the code is
    // verified — nothing is stored on a half-finished login. If OTP delivery
    // isn't available (email not configured / send failure), the login falls
    // through directly so no one gets locked out.
    var pending = null; // { code, company, status, email }
    var loginWrap = document.getElementById("el-login-wrap");
    var otpStep = document.getElementById("el-otp-step");
    var otpNote = document.getElementById("el-otp-note");
    var otpErr = document.getElementById("el-otp-error");
    function finishLogin(msgEl) {
      if (!pending) return;
      try { localStorage.setItem("bp_emp_code", pending.code); localStorage.setItem("bp_emp_company", pending.company || ""); } catch (e2) {}
      if (pending.status && pending.status !== "مفعّل" && msgEl) {
        msgEl.style.color = "";
        msgEl.textContent = T("Logged in — payment pending. You can browse, but contacts unlock once payment is confirmed.", "تم الدخول — بانتظار تأكيد الدفع. تقدر تتصفّح، وتفتح بيانات التواصل بعد تأكيد الدفع.");
        setTimeout(function () { location.href = dashUrl(); }, 1800);
        return;
      }
      location.href = dashUrl();
    }
    function startOtp() {
      return fetch("/api/otp", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start", email: pending.email }),
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!(j && j.ok && j.challenge)) return false;
        pending.challenge = j.challenge;
        if (loginWrap && otpStep) {
          loginWrap.hidden = true; otpStep.hidden = false;
          otpNote.textContent = T("We sent a 6-digit code to ", "أرسلنا رمز تحقق من 6 أرقام إلى ") + (j.to || pending.email) + T(". Enter it to open the portal.", "، أدخله لفتح البوابة.");
          otpErr.textContent = "";
          var inp = document.getElementById("el-otp-code");
          if (inp) { inp.value = ""; inp.focus(); }
        }
        return true;
      });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("el-email").value.trim();
      var password = document.getElementById("el-password").value;
      if (!email || !password) return;
      var submitBtn = document.getElementById("el-submit");
      errEl.textContent = "";
      submitBtn.disabled = true; submitBtn.textContent = T("Logging in…", "جارٍ الدخول…");
      fetch("/api/employer", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "login", email: email, password: password }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.ok) {
          submitBtn.disabled = false; submitBtn.textContent = T("Log in", "دخول");
          errEl.textContent = (d && d.error === "invalid_credentials")
            ? T("Incorrect email or password.", "البريد أو كلمة المرور غير صحيحة.")
            : T("Couldn't log in. Please try again.", "تعذّر تسجيل الدخول. حاول مجدداً.");
          return;
        }
        pending = { code: d.code, company: d.company || "", status: d.status || "", email: email.toLowerCase() };
        submitBtn.textContent = T("Sending code to your email…", "جارٍ إرسال الرمز إلى بريدك…");
        startOtp().then(function (sent) {
          submitBtn.disabled = false; submitBtn.textContent = T("Log in", "دخول");
          if (!sent) finishLogin(errEl);
        }).catch(function () {
          submitBtn.disabled = false; submitBtn.textContent = T("Log in", "دخول");
          finishLogin(errEl);
        });
      }).catch(function () {
        submitBtn.disabled = false; submitBtn.textContent = T("Log in", "دخول");
        errEl.textContent = T("Network error. Please try again.", "خطأ في الاتصال. حاول مجدداً.");
      });
    });
    var otpForm = document.getElementById("el-otp-form");
    if (otpForm) otpForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!pending || !pending.challenge) return;
      var code = document.getElementById("el-otp-code").value.trim();
      if (code.length < 4) { otpErr.textContent = T("Enter the 6-digit code from your email.", "أدخل الرمز المكوّن من 6 أرقام من بريدك."); return; }
      var vBtn = document.getElementById("el-otp-submit");
      vBtn.disabled = true; vBtn.textContent = T("Verifying…", "جارٍ التحقق…");
      fetch("/api/otp", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "verify", email: pending.email, code: code, challenge: pending.challenge, company: pending.company }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        vBtn.disabled = false; vBtn.textContent = T("Verify & open the portal", "تحقق وافتح البوابة");
        if (d && d.ok) { otpErr.textContent = ""; finishLogin(otpErr); return; }
        otpErr.textContent = (d && d.error === "expired")
          ? T("The code expired — resend a new one.", "انتهت صلاحية الرمز — أعد إرسال رمز جديد.")
          : T("Incorrect code. Try again.", "الرمز غير صحيح. حاول مجدداً.");
      }).catch(function () {
        vBtn.disabled = false; vBtn.textContent = T("Verify & open the portal", "تحقق وافتح البوابة");
        otpErr.textContent = T("Network error. Please try again.", "خطأ في الاتصال. حاول مجدداً.");
      });
    });
    var otpResend = document.getElementById("el-otp-resend");
    if (otpResend) otpResend.addEventListener("click", function (e) {
      e.preventDefault();
      if (!pending) return;
      otpErr.style.color = "";
      otpErr.textContent = T("Sending a new code…", "جارٍ إرسال رمز جديد…");
      startOtp().then(function (sent) {
        otpErr.style.color = "#B91C1C";
        otpErr.textContent = sent ? "" : T("Couldn't send right now. Try again shortly.", "تعذّر الإرسال الآن. حاول بعد قليل.");
        if (sent) { otpErr.style.color = ""; otpErr.textContent = T("A new code was sent.", "تم إرسال رمز جديد."); }
      }).catch(function () {
        otpErr.style.color = "#B91C1C";
        otpErr.textContent = T("Couldn't send right now. Try again shortly.", "تعذّر الإرسال الآن. حاول بعد قليل.");
      });
    });
    var otpBack = document.getElementById("el-otp-back");
    if (otpBack) otpBack.addEventListener("click", function (e) {
      e.preventDefault();
      pending = null;
      if (otpStep) otpStep.hidden = true;
      if (loginWrap) loginWrap.hidden = false;
    });
    // Password reset — two-step email code (stateless HMAC token from the server).
    var elForgot = document.getElementById("el-forgot");
    var elReset = document.getElementById("el-reset");
    if (elForgot && elReset) {
      var elrToken = "";
      var elrMsg = document.getElementById("elr-msg");
      elForgot.addEventListener("click", function (e) {
        e.preventDefault();
        elReset.hidden = !elReset.hidden;
        var le = document.getElementById("el-email"), re = document.getElementById("elr-email");
        if (!elReset.hidden && le && le.value && re && !re.value) re.value = le.value;
      });
      document.getElementById("elr-send").addEventListener("click", function () {
        var email = document.getElementById("elr-email").value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { elrMsg.style.color = "#B91C1C"; elrMsg.textContent = T("Enter a valid email.", "أدخل بريداً صحيحاً."); return; }
        elrMsg.style.color = ""; elrMsg.textContent = T("Sending…", "جارٍ الإرسال…");
        fetch("/api/employer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reset-password", email: email }) })
          .then(function (r) { return r.json(); })
          .then(function (o) {
            if (o && o.ok) { elrToken = o.t || ""; document.getElementById("elr-step2").hidden = false; elrMsg.textContent = o.message || T("Check your inbox for the code.", "تحقق من بريدك — وصلك رمز الاستعادة."); }
            else { elrMsg.style.color = "#B91C1C"; elrMsg.textContent = (o && o.message) || T("Could not send the code.", "تعذر إرسال الرمز."); }
          })
          .catch(function () { elrMsg.style.color = "#B91C1C"; elrMsg.textContent = T("Network error — try again.", "خطأ في الاتصال — أعد المحاولة."); });
      });
      document.getElementById("elr-set").addEventListener("click", function () {
        var email = document.getElementById("elr-email").value.trim().toLowerCase();
        var code = document.getElementById("elr-code").value.trim();
        var pass = document.getElementById("elr-pass").value;
        if (!code || pass.length < 8) { elrMsg.style.color = "#B91C1C"; elrMsg.textContent = T("Enter the code and a password of 8+ characters.", "أدخل الرمز وكلمة مرور من 8 أحرف فأكثر."); return; }
        elrMsg.style.color = ""; elrMsg.textContent = T("Setting the new password…", "جارٍ تعيين كلمة المرور…");
        fetch("/api/employer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reset-password", email: email, code: code, t: elrToken, password: pass }) })
          .then(function (r) { return r.json(); })
          .then(function (o) {
            if (o && o.ok) {
              elrMsg.style.color = "#0f9d58"; elrMsg.textContent = o.message || T("Done — sign in with your new password.", "تم — سجّل دخولك بكلمة المرور الجديدة.");
              document.getElementById("elr-step2").hidden = true;
              var le2 = document.getElementById("el-email"); if (le2 && !le2.value) le2.value = email;
            } else { elrMsg.style.color = "#B91C1C"; elrMsg.textContent = (o && o.message) || T("The code is wrong or expired.", "الرمز غير صحيح أو انتهت صلاحيته."); }
          })
          .catch(function () { elrMsg.style.color = "#B91C1C"; elrMsg.textContent = T("Network error — try again.", "خطأ في الاتصال — أعد المحاولة."); });
      });
    }
    // «أرسله إلى بريدي» — emails the registered access code to the account's
    // email (server responds the same whether or not the email exists).
    var codeMail = document.getElementById("el-code-mail");
    if (codeMail) codeMail.addEventListener("click", function (e) {
      e.preventDefault();
      var errC2 = document.getElementById("el-code-error");
      var email = document.getElementById("el-email").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        errC2.style.color = "#B91C1C";
        errC2.textContent = T("Type your account email in the email field above first.", "اكتب بريد حسابك في خانة البريد الإلكتروني أعلاه أولاً.");
        var emEl = document.getElementById("el-email");
        if (emEl) emEl.focus();
        return;
      }
      errC2.style.color = "";
      errC2.textContent = T("Sending…", "جارٍ الإرسال…");
      fetch("/api/employer", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "send-code", email: email }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.ok) {
          errC2.style.color = "";
          errC2.textContent = T("If this email is registered, your access code is on its way — check your inbox (and spam).", "إذا كان بريدك مسجلاً فرمز الوصول في طريقه إليك — تحقق من بريدك (ومجلد السبام).");
        } else {
          errC2.style.color = "#B91C1C";
          errC2.textContent = T("Couldn't send right now. Try again shortly.", "تعذّر الإرسال الآن. حاول بعد قليل.");
        }
      }).catch(function () {
        errC2.style.color = "#B91C1C";
        errC2.textContent = T("Network error. Please try again.", "خطأ في الاتصال. حاول مجدداً.");
      });
    });
    // Alternative entry: an access code (from the activation email) instead of
    // email+password — validated the same lightweight way the dashboard does,
    // then stored so the dashboard opens already unlocked.
    var codeForm = document.getElementById("el-code-form");
    if (codeForm) codeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var code = document.getElementById("el-code").value.trim();
      var errC = document.getElementById("el-code-error");
      if (!code) return;
      var btn = document.getElementById("el-code-submit");
      btn.disabled = true; errC.textContent = T("Checking…", "جارٍ التحقق…");
      fetch("/api/candidates?validate=1&code=" + encodeURIComponent(code))
        .then(function (r) { return r.json(); }).then(function (d) {
          btn.disabled = false;
          if (!d || !d.unlocked) { errC.textContent = T("Invalid or inactive code. Contact us to activate.", "رمز غير صحيح أو غير مفعّل. تواصل معنا للتفعيل."); return; }
          errC.textContent = "";
          try { localStorage.setItem("bp_emp_code", code); } catch (e2) {}
          location.href = dashUrl();
        }).catch(function () {
          btn.disabled = false;
          errC.textContent = T("Network error. Please try again.", "خطأ في الاتصال. حاول مجدداً.");
        });
    });
  });
})();

/* ---------- Employer plan cards — add to cart → go straight to /cart ---------- */
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".emp-plan-btn");
    if (!btn) return;
    location.href = BP.lang === "ar" ? "/ar/cart" : "/cart";
  });
})();

/* ---------- Newsletter signup (footer band + /newsletter) → /api/newsletter ---------- */
(function () {
  "use strict";
  var T = function (en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; };
  document.addEventListener("submit", function (e) {
    var form = e.target.closest ? e.target.closest("form[data-nl]") : null;
    if (!form) return;
    e.preventDefault();
    var emailEl = form.querySelector("[data-nl-email]");
    var msg = form.parentNode.querySelector("[data-nl-msg]");
    var email = (emailEl && emailEl.value || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      if (msg) { msg.hidden = false; msg.textContent = T("Please enter a valid email.", "الرجاء إدخال بريد صحيح."); }
      return;
    }
    var btn = form.querySelector('button[type="submit"]'), lbl = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = T("Sending…", "جارٍ الإرسال…"); }
    function show(txt) { if (msg) { msg.hidden = false; msg.textContent = txt; } }
    fetch("/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email, source: location.pathname }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        if (btn) { btn.disabled = false; btn.textContent = lbl; }
        if (d && d.ok) { show("✅ " + T("You're subscribed! Check your inbox soon.", "تم اشتراكك! ستصلك النشرة قريباً.")); if (emailEl) emailEl.value = ""; }
        else show(T("Something went wrong. Please try again.", "حدث خطأ. حاول مرة أخرى."));
      })
      .catch(function () { if (btn) { btn.disabled = false; btn.textContent = lbl; } show(T("Network error. Try again.", "خطأ في الاتصال. حاول مجدداً.")); });
  });
})();

/* ---------- Office spaces gallery (/workspaces) → /api/spaces ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var grid = document.getElementById("ws-grid");
    if (!grid) return;
    var isAr = (window.BP_WS_LANG || "ar") === "ar";
    var T = function (en, ar) { return isAr ? ar : en; };
    var status = document.getElementById("ws-status");
    var loadBtn = document.getElementById("ws-load");
    var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); };
    var cityAr = { Riyadh: "الرياض", Jeddah: "جدة", Dammam: "الدمام", Khobar: "الخبر", Makkah: "مكة", Madinah: "المدينة", Other: "أخرى" };

    function card(s) {
      var city = isAr ? (cityAr[s.city] || s.city || "") : (s.city || "");
      var loc = [city, s.district].filter(Boolean).join(" · ");
      var meta = [];
      if (s.area) meta.push((isAr ? "المساحة: " : "Area: ") + s.area + (isAr ? " م²" : " sqm"));
      if (s.seats) meta.push((isAr ? "المقاعد: " : "Seats: ") + s.seats);
      var tags = [];
      if (s.furnished) tags.push(T("Furnished", "مفروش"));
      if (s.parking) tags.push(T("Parking", "مواقف"));
      if (s.nationalAddress) tags.push(T("National Address", "عنوان وطني"));
      if (s.licenseSupport) tags.push(T("License support", "دعم الترخيص"));
      var photo = s.photo ? '<div class="ws-photo" style="background-image:url(\'' + esc(s.photo) + '\')"></div>' : '<div class="ws-photo ws-noimg">🏢</div>';
      var waMsg = encodeURIComponent((isAr ? "أرغب بالاستفسار عن مساحة: " : "Enquiry about space: ") + (s.name || "") + (loc ? " — " + loc : ""));
      return '<div class="emp-card ws-card">' + photo +
        '<div class="ws-body"><div class="emp-card-top"><strong>' + esc(s.name) + '</strong>' + (s.type ? '<span class="emp-tag">' + esc(s.type) + '</span>' : '') + '</div>' +
        (loc ? '<div class="emp-role">📍 ' + esc(loc) + '</div>' : '') +
        (s.description ? '<div class="emp-skills">' + esc(s.description) + '</div>' : '') +
        (meta.length ? '<div class="emp-meta">' + esc(meta.join(" · ")) + '</div>' : '') +
        (tags.length ? '<div class="ws-tags">' + tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join("") + '</div>' : '') +
        '<a class="btn btn-wa" style="margin-top:12px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + waMsg + '">' + T("Enquire", "استفسر") + '</a>' +
        '</div></div>';
    }

    function load() {
      var qs = new URLSearchParams();
      var q = document.getElementById("ws-q"), city = document.getElementById("ws-city"), type = document.getElementById("ws-type");
      if (q && q.value.trim()) qs.set("q", q.value.trim());
      if (city && city.value) qs.set("city", city.value);
      if (type && type.value) qs.set("type", type.value);
      status.textContent = T("Loading spaces…", "جارٍ تحميل المساحات…");
      grid.innerHTML = "";
      fetch("/api/spaces?" + qs).then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          var d = res.d;
          if (res.s === 503) { status.innerHTML = T("The space inventory isn't connected yet — ", "لم يُربط مخزون المساحات بعد — ") + '<a href="/workspace-request">' + T("send your requirements", "أرسل متطلباتك") + "</a>"; return; }
          if (!d || !d.ok) { status.textContent = T("Couldn't load spaces. Try again.", "تعذّر تحميل المساحات. حاول مجدداً."); return; }
          if (!d.spaces.length) { status.innerHTML = T("No published spaces match yet — ", "لا توجد مساحات منشورة مطابقة بعد — ") + '<a href="/workspace-request">' + T("tell us your requirements", "أخبرنا بمتطلباتك") + "</a>"; return; }
          status.textContent = d.total + " " + T("available spaces", "مساحة متاحة");
          grid.innerHTML = d.spaces.map(card).join("");
        })
        .catch(function () { status.textContent = T("Network error. Try again.", "خطأ في الاتصال. حاول مجدداً."); });
    }
    if (loadBtn) loadBtn.addEventListener("click", load);
    var qEl = document.getElementById("ws-q");
    if (qEl) qEl.addEventListener("keydown", function (e) { if (e.key === "Enter") load(); });
    load();
  });
})();

/* ---------- Workspace demand request (/workspace-request) → /api/workspace ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("ws-req");
    if (!form) return;
    var T = function (en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; };
    var WA = "966507034157";
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var phone = val("wr-phone"), city = val("wr-city");
      if (!/^(?:\+?966|0)?5\d{8}$/.test(phone.replace(/\s/g, ""))) { alert(T("Please enter a valid Saudi mobile (05XXXXXXXX).", "الرجاء إدخال جوال سعودي صحيح (05XXXXXXXX).")); return; }
      if (!city) { alert(T("Please choose a city.", "الرجاء اختيار المدينة.")); return; }
      var payload = { purpose: val("wr-purpose"), category: val("wr-category"), city: city, district: val("wr-district"), size: val("wr-size"), seats: val("wr-seats"), budget: val("wr-budget"), contact: val("wr-contact"), phone: phone, email: val("wr-email"), notes: val("wr-notes") };
      var btn = document.getElementById("wr-submit"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = T("Sending…", "جارٍ الإرسال…");
      function done(ref) {
        btn.disabled = false; btn.textContent = lbl;
        var box = document.getElementById("wr-result");
        var waMsg = encodeURIComponent(T("New workspace request", "طلب مساحة عمل") + " " + (ref || "") + "\n" + T("City", "المدينة") + ": " + city + "\n" + T("Mobile", "الجوال") + ": " + phone);
        box.hidden = false;
        box.innerHTML = "✅ <strong>" + T("Request received", "تم استلام طلبك") + (ref ? " — " + ref : "") + "</strong><br>" +
          T("Our matching engine is finding options across the Kingdom. We'll reach out shortly.", "محرّك المطابقة يبحث عن خيارات في المملكة. سنتواصل معك قريباً.") +
          '<a class="btn btn-wa btn-lg" style="margin-top:14px" target="_blank" rel="noopener" href="https://wa.me/' + WA + '?text=' + waMsg + '">' + T("Follow up on WhatsApp", "تابع عبر واتساب") + "</a>";
        box.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      fetch("/api/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) { done(res.d && res.d.ref); })
        .catch(function () { done(null); });
    });
  });
})();

/* ---------- Task Force intake (/task-force) → /api/requests ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("tf-form-el");
    if (!form) return;
    var T = function (en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; };
    var WA = "966507034157";
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var company = val("tf-company"), person = val("tf-person"), phone = val("tf-phone"), notes = val("tf-notes");
      if (!company || !person) { alert(T("Please fill in the company name and contact person.", "الرجاء تعبئة اسم الشركة والمسؤول.")); return; }
      if (!/^(?:\+?966|0)?5\d{8}$/.test(phone.replace(/\s/g, ""))) { alert(T("Please enter a valid Saudi mobile (05XXXXXXXX).", "الرجاء إدخال جوال سعودي صحيح (05XXXXXXXX).")); return; }
      if (!notes) { alert(T("Please describe the task.", "الرجاء وصف المهمة.")); return; }
      var payload = { type: "task-force", company: company, person: person, phone: phone, email: val("tf-email"), notes: notes };
      var btn = document.getElementById("tf-submit"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = T("Sending…", "جارٍ الإرسال…");
      function done(ref, failed) {
        btn.disabled = false; btn.textContent = lbl;
        var box = document.getElementById("tf-result");
        var waMsg = encodeURIComponent(T("New Task Force request", "مهمة Task Force جديدة") + " " + (ref || "") + "\n" + T("Company", "الشركة") + ": " + company + "\n" + T("Mobile", "الجوال") + ": " + phone + "\n" + T("Task", "المهمة") + ": " + notes.slice(0, 300));
        box.hidden = false;
        // Never claim the team received the task when the request didn't reach
        // the server — in that case WhatsApp IS the submission channel.
        box.innerHTML = failed
          ? "⚠️ <strong>" + T("Couldn't reach the server", "تعذّر الاتصال بالخادم حالياً") + "</strong><br>" +
            T("Send your task via WhatsApp instead — it goes straight to the team.", "أرسل مهمتك عبر واتساب بدلاً من ذلك — تصل الفريق مباشرة.") +
            '<a class="btn btn-wa btn-lg" style="margin-top:14px" target="_blank" rel="noopener" href="https://wa.me/' + WA + '?text=' + waMsg + '">' + T("Send via WhatsApp", "أرسل عبر واتساب") + "</a>"
          : "✅ <strong>" + T("Task received", "تم استلام مهمتك") + (ref ? " — " + ref : "") + "</strong><br>" +
            T("Our team is reviewing the scope and will come back with the right execution track.", "فريقنا يراجع النطاق وسيعود إليك بمسار التنفيذ المناسب.") +
            '<a class="btn btn-wa btn-lg" style="margin-top:14px" target="_blank" rel="noopener" href="https://wa.me/' + WA + '?text=' + waMsg + '">' + T("Follow up on WhatsApp", "تابع عبر واتساب") + "</a>";
        box.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) { if (res.d && res.d.ok) done(res.d.ref, false); else done(null, true); })
        .catch(function () { done(null, true); });
    });
  });
})();

/* ---------- Wallet (/account → محفظتي): top-ups & fee payments ----------
   Entries live in bp_wallet: {ref, kind: 'topup'|'pay', amount, what?, at, status}.
   Balance = confirmed top-ups − non-cancelled payments; statuses sync live from
   the CRM through the same /api/requests?refs= endpoint orders use. */
(function () {
  "use strict";
  function T(en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; }
  function session() { try { return JSON.parse(localStorage.getItem("bp_session") || "null"); } catch (e) { return null; } }
  function entries() { try { return JSON.parse(localStorage.getItem("bp_wallet") || "[]"); } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem("bp_wallet", JSON.stringify(list)); } catch (e) {} }
  function money(n) { return (window.BP && BP.money) ? BP.money(n) : n + " ﷼"; }
  var CONFIRMED = /مؤكد|مكتمل|confirmed|completed/i;
  var CANCELLED = /ملغ|cancel/i;

  document.addEventListener("DOMContentLoaded", function () {
    var panel = document.getElementById("panel-wallet");
    if (!panel) return;

    function mine() {
      var s = session();
      return entries().filter(function (e) { return !e.email || !s || String(e.email).toLowerCase() === String(s.email || "").toLowerCase(); });
    }
    function render() {
      var list = mine();
      var confirmedTopups = 0, pendingTopups = 0, spent = 0;
      list.forEach(function (e) {
        if (e.kind === "topup") {
          if (CONFIRMED.test(e.status || "")) confirmedTopups += e.amount;
          else if (!CANCELLED.test(e.status || "")) pendingTopups += e.amount;
        } else if (e.kind === "pay" && !CANCELLED.test(e.status || "")) {
          spent += e.amount;
        }
      });
      var balance = Math.max(0, confirmedTopups - spent);
      var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
      set("wal-balance", money(balance));
      set("wal-pending", money(pendingTopups));
      set("wal-spent", money(spent));
      var box = document.getElementById("wal-list");
      if (box && list.length) {
        box.innerHTML = list.map(function (e) {
          var sign = e.kind === "topup" ? "+" : "−";
          var label = e.kind === "topup" ? T("Wallet top-up", "شحن محفظة") : (e.what || T("Fee payment", "سداد رسوم"));
          var done = CONFIRMED.test(e.status || ""), off = CANCELLED.test(e.status || "");
          return '<div class="ord"><div class="ord-main"><strong>' + e.ref + '</strong><span class="text-soft"> · ' + (e.at || "") + '</span>' +
            '<div class="text-soft ord-items">' + label + '</div></div>' +
            '<div class="ord-side"><strong style="color:' + (e.kind === "topup" ? "#16a34a" : "var(--navy)") + '">' + sign + money(e.amount) + '</strong>' +
            '<span class="ord-status ' + (off ? "off" : done ? "ok" : "wait") + '">' + (e.status || T("Under review", "قيد المراجعة")) + '</span></div></div>';
        }).join("");
      }
      return balance;
    }

    // Live status sync — same CRM statuses as orders (BPW/BPP refs).
    function sync() {
      var list = entries();
      var refs = list.map(function (e) { return e.ref; }).filter(Boolean);
      if (!refs.length) return;
      fetch("/api/requests?refs=" + encodeURIComponent(refs.join(",")))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok || !d.statuses) return;
          var changed = false;
          list.forEach(function (e) { var live = d.statuses[e.ref]; if (live && live !== e.status) { e.status = live; changed = true; } });
          if (changed) { save(list); render(); }
        })
        .catch(function () {});
    }

    // Top-up form
    var tf = document.getElementById("wal-topup-form");
    if (tf) tf.addEventListener("submit", function (e) {
      e.preventDefault();
      var s = session();
      if (!s) return;
      var amount = Number((document.getElementById("wal-amount") || {}).value || 0);
      var fileInp = document.getElementById("wal-receipt");
      var file = fileInp && fileInp.files && fileInp.files.length ? fileInp.files[0] : null;
      if (!amount || amount < 50) { alert(T("Enter a top-up amount (min 50 SAR).", "أدخل مبلغ الشحن (50 ريالاً على الأقل).")); return; }
      if (!file) { alert(T("Attach the bank transfer receipt.", "أرفق إيصال التحويل البنكي.")); return; }
      var btn = tf.querySelector("button[type=submit]"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = T("Sending…", "جارٍ الإرسال…");
      var ref = "BPW-" + Date.now().toString().slice(-6);
      var reader = new FileReader();
      function finish(ok) {
        btn.disabled = false; btn.textContent = lbl;
        var box = document.getElementById("wal-topup-success");
        box.hidden = false;
        box.innerHTML = ok
          ? "✅ <strong>" + T("Top-up request received", "تم استلام طلب الشحن") + " — " + ref + "</strong><br>" + T("Balance is credited as soon as the team confirms the transfer.", "يُضاف الرصيد فور تأكيد الفريق للتحويل.")
          : "⚠️ <strong>" + T("Couldn't reach the server", "تعذّر الاتصال بالخادم") + "</strong><br>" + T("Try again, or send the receipt on WhatsApp.", "حاول مرة أخرى، أو أرسل الإيصال عبر واتساب.") + ' <a class="btn btn-wa" style="margin-top:8px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + encodeURIComponent(T("Wallet top-up ", "شحن محفظة ") + ref + " — " + amount + " ﷼") + '">' + T("WhatsApp", "واتساب") + "</a>";
        if (ok) {
          var list = entries();
          list.unshift({ ref: ref, kind: "topup", amount: amount, email: s.email || "", at: new Date().toISOString().slice(0, 10), status: T("Under review", "قيد المراجعة") });
          save(list); render(); tf.reset();
        }
      }
      reader.onload = function () {
        fetch("/api/requests", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "wallet-topup", ref: ref, name: s.name || "", email: s.email || "", phone: s.phone || "", amount: amount, receiptName: file.name, receiptType: file.type, receiptBase64: String(reader.result || "").split(",").pop() }),
        }).then(function (r) { return r.json(); }).then(function (d) { finish(d && d.ok); }).catch(function () { finish(false); });
      };
      reader.onerror = function () { finish(false); };
      reader.readAsDataURL(file);
    });

    // Pay-from-wallet form
    var pf = document.getElementById("wal-pay-form");
    if (pf) pf.addEventListener("submit", function (e) {
      e.preventDefault();
      var s = session();
      if (!s) return;
      var what = ((document.getElementById("wal-pay-what") || {}).value || "").trim();
      var amount = Number((document.getElementById("wal-pay-amount") || {}).value || 0);
      if (!what) { alert(T("Describe the fee to pay.", "صف الرسوم المطلوب سدادها.")); return; }
      if (!amount || amount < 1) { alert(T("Enter the amount.", "أدخل المبلغ.")); return; }
      var balance = render();
      if (amount > balance) { alert(T("Amount exceeds your available balance (", "المبلغ أكبر من رصيدك المتاح (") + money(balance) + T("). Top up first.", "). اشحن محفظتك أولاً.")); return; }
      var btn = pf.querySelector("button[type=submit]"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = T("Sending…", "جارٍ الإرسال…");
      var ref = "BPP-" + Date.now().toString().slice(-6);
      fetch("/api/requests", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "wallet-pay", ref: ref, name: s.name || "", email: s.email || "", what: what, amount: amount }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        btn.disabled = false; btn.textContent = lbl;
        var box = document.getElementById("wal-pay-success");
        box.hidden = false;
        if (d && d.ok) {
          box.innerHTML = "✅ <strong>" + T("Payment request received", "تم استلام طلب السداد") + " — " + ref + "</strong><br>" + T("We execute it from your wallet and attach the payment proof.", "ننفذه من محفظتك ونرفق لك إثبات السداد.");
          var list = entries();
          list.unshift({ ref: ref, kind: "pay", amount: amount, what: what, email: s.email || "", at: new Date().toISOString().slice(0, 10), status: T("Under review", "قيد المراجعة") });
          save(list); render(); pf.reset();
        } else {
          box.innerHTML = "⚠️ " + T("Couldn't send — try again.", "تعذّر الإرسال — حاول مرة أخرى.");
        }
      }).catch(function () {
        btn.disabled = false; btn.textContent = lbl;
        var box = document.getElementById("wal-pay-success");
        box.hidden = false;
        box.innerHTML = "⚠️ " + T("Couldn't reach the server — try again.", "تعذّر الاتصال بالخادم — حاول مرة أخرى.");
      });
    });

    render();
    sync();
  });
})();

/* ---------- Instalments (/installments): estimate + request ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("inst-form-el");
    if (!form) return;
    var T = function (en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; };
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
    function money(n) { return (window.BP && BP.money) ? BP.money(n) : n + " ﷼"; }
    // Live monthly estimate; ?amount= (from the cart link) prefills the amount.
    function estimate() {
      var amount = Number(val("inst-amount")), months = Number(val("inst-months")) || 6;
      var el = document.getElementById("inst-monthly");
      el.textContent = amount > 0 ? money(Math.ceil(amount / months)) + " / " + T("month", "شهرياً") : "—";
    }
    var qAmount = new URLSearchParams(location.search).get("amount");
    if (qAmount && Number(qAmount) > 0) { var ai = document.getElementById("inst-amount"); if (ai && !ai.value) ai.value = Math.round(Number(qAmount)); }
    ["inst-amount", "inst-months"].forEach(function (id) { var el = document.getElementById(id); if (el) { el.addEventListener("input", estimate); el.addEventListener("change", estimate); } });
    estimate();
    // Prefill from the signed-in session
    try {
      var ses = JSON.parse(localStorage.getItem("bp_session") || "null");
      if (ses) { if (!val("inst-name")) document.getElementById("inst-name").value = ses.name || ""; if (!val("inst-email")) document.getElementById("inst-email").value = ses.email || ""; }
    } catch (e) {}
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = val("inst-name"), phone = val("inst-phone"), email = val("inst-email"), service = val("inst-service");
      var company = val("inst-company"), cr = val("inst-cr");
      var amount = Number(val("inst-amount")), months = Number(val("inst-months")) || 6, channel = val("inst-channel") || "any";
      if (!company) { alert(T("This service is for establishments — enter your establishment name.", "هذه الخدمة للمنشآت — أدخل اسم منشأتك.")); return; }
      if (!name || !service) { alert(T("Fill in your name and the service to split.", "عبّئ اسمك والخدمة المراد تقسيطها.")); return; }
      if (!/^(?:\+?966|0)?5\d{8}$/.test(phone.replace(/\s/g, ""))) { alert(T("Enter a valid Saudi mobile (05XXXXXXXX).", "أدخل جوالاً سعودياً صحيحاً (05XXXXXXXX).")); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { alert(T("Enter a valid email.", "أدخل بريداً صحيحاً.")); return; }
      if (!amount || amount < 500) { alert(T("Enter an amount of 500 SAR or more.", "أدخل مبلغاً 500 ريال فأكثر.")); return; }
      var btn = form.querySelector("button[type=submit]"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = T("Sending…", "جارٍ الإرسال…");
      var ref = "BPI-" + Date.now().toString().slice(-6);
      var waMsg = encodeURIComponent(T("Instalment request ", "طلب تقسيط ") + ref + "\n" + service + " — " + amount + " ﷼ / " + months + " " + T("months", "أشهر"));
      fetch("/api/requests", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "installment", ref: ref, name: name, company: company, cr: cr, phone: phone, email: email, service: service, amount: amount, months: months, channel: channel }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        btn.disabled = false; btn.textContent = lbl;
        var box = document.getElementById("inst-success");
        box.hidden = false;
        if (d && d.ok) {
          box.innerHTML = "✅ <strong>" + T("Request received", "تم استلام طلبك") + " — " + ref + "</strong><br>" + T("We prepare the available offers and come back to you quickly.", "نجهّز العروض المتاحة ونعود لك سريعاً.");
          try {
            var orders = JSON.parse(localStorage.getItem("bp_orders") || "[]");
            orders.unshift({ ref: ref, name: name, email: email, items: [{ name: T("Instalment: ", "تقسيط: ") + service, qty: 1 }], at: new Date().toISOString().slice(0, 10), status: T("Under review", "قيد المراجعة") });
            localStorage.setItem("bp_orders", JSON.stringify(orders));
          } catch (err) {}
          form.reset(); estimate();
        } else {
          box.innerHTML = "⚠️ " + T("Couldn't send — contact us on WhatsApp instead.", "تعذّر الإرسال — تواصل معنا عبر واتساب.") + ' <a class="btn btn-wa" style="margin-top:8px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + waMsg + '">' + T("WhatsApp", "واتساب") + "</a>";
        }
      }).catch(function () {
        btn.disabled = false; btn.textContent = lbl;
        var box = document.getElementById("inst-success");
        box.hidden = false;
        box.innerHTML = "⚠️ " + T("Couldn't reach the server — send it on WhatsApp instead.", "تعذّر الاتصال بالخادم — أرسله عبر واتساب.") + ' <a class="btn btn-wa" style="margin-top:8px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + waMsg + '">' + T("WhatsApp", "واتساب") + "</a>";
      });
    });
  });
})();

/* ---------- Estrdad (/estrdad): eligibility assessment request ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("estrdad-form-el");
    if (!form) return;
    var T = function (en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; };
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
    try {
      var ses = JSON.parse(localStorage.getItem("bp_session") || "null");
      var comp = JSON.parse(localStorage.getItem("bp_company") || "{}");
      if (ses && !val("es-person")) document.getElementById("es-person").value = ses.name || "";
      if (ses && !val("es-email")) document.getElementById("es-email").value = ses.email || "";
      if (comp && comp.name && !val("es-company")) document.getElementById("es-company").value = comp.name;
    } catch (e) {}
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var company = val("es-company"), person = val("es-person"), phone = val("es-phone"), email = val("es-email");
      if (!company || !person) { alert(T("Fill in the establishment and contact names.", "عبّئ اسم المنشأة واسم المسؤول.")); return; }
      if (!/^(?:\+?966|0)?5\d{8}$/.test(phone.replace(/\s/g, ""))) { alert(T("Enter a valid Saudi mobile (05XXXXXXXX).", "أدخل جوالاً سعودياً صحيحاً (05XXXXXXXX).")); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { alert(T("Enter a valid email.", "أدخل بريداً صحيحاً.")); return; }
      var btn = form.querySelector("button[type=submit]"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = T("Sending…", "جارٍ الإرسال…");
      var ref = "BPE-" + Date.now().toString().slice(-6);
      var waMsg = encodeURIComponent(T("Estrdad assessment ", "تقييم استرداد ") + ref + " — " + company);
      fetch("/api/requests", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "estrdad", ref: ref, company: company, person: person, phone: phone, email: email, startYear: val("es-start"), workers: val("es-workers"), notes: val("es-notes") }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        btn.disabled = false; btn.textContent = lbl;
        var box = document.getElementById("estrdad-success");
        box.hidden = false;
        if (d && d.ok) {
          box.innerHTML = "✅ <strong>" + T("Assessment request received", "تم استلام طلب التقييم") + " — " + ref + "</strong><br>" + T("We review your establishment against the official conditions and come back with your compliance gaps and the plan.", "نراجع منشأتك وفق الاشتراطات الرسمية ونعود لك بفجوات الامتثال والخطة.");
          try {
            var orders = JSON.parse(localStorage.getItem("bp_orders") || "[]");
            orders.unshift({ ref: ref, name: person, email: email, items: [{ name: T("Estrdad assessment: ", "تقييم استرداد: ") + company, qty: 1 }], at: new Date().toISOString().slice(0, 10), status: T("Under review", "قيد المراجعة") });
            localStorage.setItem("bp_orders", JSON.stringify(orders));
          } catch (err) {}
          form.reset();
        } else {
          box.innerHTML = "⚠️ " + T("Couldn't send — contact us on WhatsApp instead.", "تعذّر الإرسال — تواصل معنا عبر واتساب.") + ' <a class="btn btn-wa" style="margin-top:8px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + waMsg + '">' + T("WhatsApp", "واتساب") + "</a>";
        }
      }).catch(function () {
        btn.disabled = false; btn.textContent = lbl;
        var box = document.getElementById("estrdad-success");
        box.hidden = false;
        box.innerHTML = "⚠️ " + T("Couldn't reach the server — send it on WhatsApp instead.", "تعذّر الاتصال بالخادم — أرسله عبر واتساب.") + ' <a class="btn btn-wa" style="margin-top:8px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + waMsg + '">' + T("WhatsApp", "واتساب") + "</a>";
      });
    });
  });
})();

/* ---------- Partners repeater + bank-account & formation-contract forms ---------- */
(function () {
  "use strict";
  function T(en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  var MOBILE = /^(?:\+?966|0)?5\d{8}$/;
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function addRow(wrap) {
    var withShare = wrap.hasAttribute("data-with-share");
    var row = document.createElement("div");
    row.className = "partner-row" + (withShare ? " with-share" : "");
    row.innerHTML =
      '<input type="text" data-p="name" placeholder="' + T("Partner name", "اسم الشريك") + '">' +
      '<input type="tel" data-p="phone" placeholder="05XXXXXXXX">' +
      '<input type="email" data-p="email" placeholder="email@company.com">' +
      (withShare ? '<input type="number" data-p="share" min="0" max="100" placeholder="%">' : "") +
      '<button type="button" class="pr-del" aria-label="' + T("Remove", "حذف") + '">✕</button>';
    row.querySelector(".pr-del").addEventListener("click", function () { row.remove(); recalc(wrap); });
    if (withShare) row.querySelector('[data-p="share"]').addEventListener("input", function () { recalc(wrap); });
    wrap.appendChild(row);
  }
  function recalc(wrap) {
    var totalEl = document.getElementById("fc-share-total");
    if (!totalEl || !wrap.hasAttribute("data-with-share")) return;
    var total = 0;
    wrap.querySelectorAll('[data-p="share"]').forEach(function (i) { total += Number(i.value) || 0; });
    totalEl.textContent = total + "%";
    totalEl.style.color = total === 100 ? "#16a34a" : "var(--navy)";
  }
  function collect(wrap) {
    var out = [];
    wrap.querySelectorAll(".partner-row").forEach(function (row) {
      var p = {};
      row.querySelectorAll("[data-p]").forEach(function (i) { p[i.getAttribute("data-p")] = i.value.trim(); });
      if (p.name || p.email || p.phone) out.push(p);
    });
    return out;
  }
  function validPartners(list) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p.name) return T("Every partner needs a name.", "كل شريك يحتاج اسماً.");
      if (!EMAIL.test(p.email || "")) return T("Enter a valid email for partner: ", "أدخل بريداً صحيحاً للشريك: ") + p.name;
      if (p.phone && !MOBILE.test(p.phone.replace(/\s/g, ""))) return T("Invalid mobile for partner: ", "جوال غير صحيح للشريك: ") + p.name;
    }
    return null;
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-partners]").forEach(function (wrap) {
      addRow(wrap); // start with one row
      var addBtn = wrap.parentElement.querySelector("[data-add-partner]");
      if (addBtn) addBtn.addEventListener("click", function () { addRow(wrap); });
    });

    // ---- Bank account opening ----
    var bank = document.getElementById("bank-form-el");
    if (bank) {
      // Company profile is the prerequisite: prefill from bp_company/bp_session
      // and surface the gate when it's incomplete.
      var comp = {}, ses = null;
      try { comp = JSON.parse(localStorage.getItem("bp_company") || "{}"); } catch (e) {}
      try { ses = JSON.parse(localStorage.getItem("bp_session") || "null"); } catch (e) {}
      if (comp.name && !val("bk2-company")) document.getElementById("bk2-company").value = comp.name;
      if (comp.cr && !val("bk2-cr")) document.getElementById("bk2-cr").value = comp.cr;
      if (ses && !val("bk2-manager")) document.getElementById("bk2-manager").value = ses.name || "";
      if (ses && !val("bk2-email")) document.getElementById("bk2-email").value = ses.email || "";
      if (comp.phone && !val("bk2-phone")) document.getElementById("bk2-phone").value = comp.phone;
      var gate = document.getElementById("bank-profile-gate");
      if (gate && (!comp.name || !comp.cr)) gate.hidden = false;

      bank.addEventListener("submit", function (e) {
        e.preventDefault();
        var company = val("bk2-company"), cr = val("bk2-cr"), manager = val("bk2-manager"), phone = val("bk2-phone"), email = val("bk2-email");
        if (!company || !cr) { alert(T("Company name and CR are required (bank prerequisite).", "اسم الشركة ورقم السجل مطلوبان (اشتراط البنك).")); return; }
        if (!manager) { alert(T("Enter the manager's name.", "أدخل اسم المدير.")); return; }
        if (!MOBILE.test(phone.replace(/\s/g, ""))) { alert(T("Enter a valid Saudi mobile.", "أدخل جوالاً سعودياً صحيحاً.")); return; }
        if (!EMAIL.test(email)) { alert(T("Enter a valid email.", "أدخل بريداً صحيحاً.")); return; }
        var partners = collect(bank.querySelector("[data-partners]"));
        var pErr = validPartners(partners);
        if (pErr) { alert(pErr); return; }
        var btn = bank.querySelector("button[type=submit]"), lbl = btn.textContent;
        btn.disabled = true; btn.textContent = T("Sending…", "جارٍ الإرسال…");
        var ref = "BPB-" + Date.now().toString().slice(-6);
        var waMsg = encodeURIComponent(T("Bank account opening ", "فتح حساب بنكي ") + ref + " — " + company);
        fetch("/api/requests", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "bank-account", ref: ref, company: company, cr: cr, manager: manager, phone: phone, email: email, bank: val("bk2-bank"), when: val("bk2-when"), partners: partners }),
        }).then(function (r) { return r.json(); }).then(function (d) {
          btn.disabled = false; btn.textContent = lbl;
          var box = document.getElementById("bank-success");
          box.hidden = false;
          if (d && d.ok) {
            box.innerHTML = "✅ <strong>" + T("Request received", "تم استلام طلبك") + " — " + ref + "</strong><br>" +
              T("We coordinate with the bank and every partner receives the online-appointment invitation by email.", "ننسق مع البنك وسيستلم كل شريك دعوة الموعد الأونلاين على بريده.");
            try {
              var orders = JSON.parse(localStorage.getItem("bp_orders") || "[]");
              orders.unshift({ ref: ref, name: manager, email: email, items: [{ name: T("Bank account opening: ", "فتح حساب بنكي: ") + company + " · " + val("bk2-bank"), qty: 1 }], at: new Date().toISOString().slice(0, 10), status: T("Under review", "قيد المراجعة") });
              localStorage.setItem("bp_orders", JSON.stringify(orders));
            } catch (err) {}
            bank.reset();
          } else {
            box.innerHTML = "⚠️ " + T("Couldn't send — contact us on WhatsApp.", "تعذّر الإرسال — تواصل عبر واتساب.") + ' <a class="btn btn-wa" style="margin-top:8px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + waMsg + '">' + T("WhatsApp", "واتساب") + "</a>";
          }
        }).catch(function () {
          btn.disabled = false; btn.textContent = lbl;
          var box = document.getElementById("bank-success");
          box.hidden = false;
          box.innerHTML = "⚠️ " + T("Couldn't reach the server — send it on WhatsApp.", "تعذّر الاتصال بالخادم — أرسله عبر واتساب.") + ' <a class="btn btn-wa" style="margin-top:8px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + waMsg + '">' + T("WhatsApp", "واتساب") + "</a>";
        });
      });
    }

    // ---- Formation contract v2 (sensitive: gated behind dashboard sign-in) ----
    // Partner identity cards (type → DOB, national address, per-type document
    // uploads) + managers with the Article-5 power bars from window.FC_CONFIG.
    var fc = document.getElementById("fc-form-el");
    var fcWrap = document.getElementById("fc-form-wrap");
    if (fc && fcWrap && window.FC_CONFIG) {
      var CFG = window.FC_CONFIG;
      var ses2 = null;
      try { ses2 = JSON.parse(localStorage.getItem("bp_session") || "null"); } catch (e) {}
      if (ses2 && ses2.email) {
        var fcGate = document.getElementById("fc-gate");
        if (fcGate) fcGate.hidden = true;
        fcWrap.hidden = false;
        initFc();
      }
    }

    function initFc() {
      var CFG = window.FC_CONFIG;
      var pWrap = document.getElementById("fc-partners");
      var mWrap = document.getElementById("fc-managers");
      var totalEl = document.getElementById("fc-share-total");
      var seq = 0;
      if (ses2 && !val("fc-person")) document.getElementById("fc-person").value = ses2.name || "";
      if (ses2 && !val("fc-email")) document.getElementById("fc-email").value = ses2.email || "";

      function typeOf(key) {
        for (var i = 0; i < CFG.types.length; i++) if (CFG.types[i].key === key) return CFG.types[i];
        return CFG.types[0];
      }
      function fcRecalc() {
        var total = 0;
        pWrap.querySelectorAll('[data-p="share"]').forEach(function (i) { total += Number(i.value) || 0; });
        totalEl.textContent = total + "%";
        totalEl.style.color = total === 100 ? "#16a34a" : "var(--navy)";
      }
      function renumber() {
        pWrap.querySelectorAll(".partner-card .fc-card-n").forEach(function (el, i) { el.textContent = T("Partner ", "الشريك ") + (i + 1); });
        mWrap.querySelectorAll(".manager-card .fc-card-n").forEach(function (el, i) { el.textContent = T("Manager ", "المدير ") + (i + 1); });
      }
      function applyType(card) {
        var t = typeOf(card.querySelector('[data-p="type"]').value);
        var dobField = card.querySelector(".fc-dob");
        dobField.hidden = !t.dob;
        card.querySelector(".fc-id-label").textContent = t.id + " *";
        // National address is a Saudi-address requirement → starred only for
        // partners resident in the Kingdom.
        var local = t.key === "saudi" || t.key === "resident";
        card.querySelector(".fc-addr-label").textContent = T("Short national address", "العنوان الوطني المختصر") + (local ? " *" : "");
        var files = card.querySelector(".fc-files");
        files.innerHTML = t.files.map(function (f) {
          return '<div class="field"><label>📎 ' + f.label + ' *</label><input type="file" data-f="' + f.key + '" data-flabel="' + f.label + '" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"></div>';
        }).join("");
      }
      function addPartner() {
        var card = document.createElement("div");
        card.className = "fc-card partner-card";
        card.innerHTML =
          '<div class="fc-card-head"><strong class="fc-card-n"></strong><button type="button" class="pr-del" aria-label="' + T("Remove", "حذف") + '">✕</button></div>' +
          '<div class="cc-grid">' +
          '<div class="field"><label>' + T("Partner type", "نوع الشريك") + '</label><select data-p="type">' + CFG.types.map(function (t) { return '<option value="' + t.key + '">' + t.label + "</option>"; }).join("") + "</select></div>" +
          '<div class="field"><label>' + T("Full name / company name", "الاسم الكامل / اسم الشركة") + ' *</label><input type="text" data-p="name"></div>' +
          '<div class="field fc-dob"><label>' + T("Date of birth (Gregorian)", "تاريخ الميلاد (بالميلادي)") + ' *</label><input type="date" data-p="dob"></div>' +
          '<div class="field"><label class="fc-id-label"></label><input type="text" data-p="idNumber"></div>' +
          '<div class="field"><label class="fc-addr-label"></label><input type="text" data-p="address" maxlength="8" placeholder="ABCD1234" style="text-transform:uppercase"></div>' +
          '<div class="field"><label>' + T("Mobile", "الجوال") + '</label><input type="tel" data-p="phone" placeholder="05XXXXXXXX"></div>' +
          '<div class="field"><label>' + T("Email", "البريد الإلكتروني") + ' *</label><input type="email" data-p="email" placeholder="email@company.com"></div>' +
          '<div class="field"><label>' + T("Ownership share %", "نسبة الملكية %") + ' *</label><input type="number" data-p="share" min="0" max="100" placeholder="%"></div>' +
          "</div>" +
          '<div class="fc-files cc-grid"></div>';
        card.querySelector(".pr-del").addEventListener("click", function () { card.remove(); renumber(); fcRecalc(); });
        card.querySelector('[data-p="type"]').addEventListener("change", function () { applyType(card); });
        card.querySelector('[data-p="share"]').addEventListener("input", fcRecalc);
        pWrap.appendChild(card);
        applyType(card);
        renumber();
      }
      function permBars(cardId) {
        return CFG.perms.map(function (g) {
          var radios = CFG.modes.map(function (m, i) {
            return '<label class="pb-pill"><input type="radio" name="pm-' + cardId + "-" + g.key + '" value="' + m.key + '"' + (i === 0 ? " checked" : "") + "> " + m.label + "</label>";
          }).join("");
          var subs = g.subs.map(function (s) {
            return '<label class="pb-sub"><input type="checkbox" data-sub="' + s.key + '"> ' + s.label + "</label>";
          }).join("");
          return '<details class="perm-bar" data-g="' + g.key + '"><summary><span class="pb-name">' + g.label + '</span><span class="pb-count">' + T("Not granted", "غير ممنوحة") + "</span></summary>" +
            '<div class="pb-body"><div class="pb-opts">' + radios + '<label class="pb-pill pb-tk"><input type="checkbox" data-tawkeel> ' + CFG.tawkeel + "</label></div>" +
            '<div class="pb-subs">' + subs + "</div></div></details>";
        }).join("");
      }
      function updateBar(bar) {
        var n = bar.querySelectorAll("[data-sub]:checked").length;
        var count = bar.querySelector(".pb-count");
        if (!n) { count.textContent = T("Not granted", "غير ممنوحة"); bar.classList.remove("granted"); return; }
        var mode = bar.querySelector('input[type="radio"]:checked');
        var modeLbl = mode && mode.value === "joint" ? T("all managers", "بموافقة الجميع") : T("solely", "منفرداً");
        var tk = bar.querySelector("[data-tawkeel]").checked;
        count.textContent = n + " · " + modeLbl + (tk ? " · " + T("delegation", "توكيل") : "");
        bar.classList.add("granted");
      }
      function whoOptions(sel) {
        var current = sel.value;
        var names = [];
        pWrap.querySelectorAll('[data-p="name"]').forEach(function (i) { names.push(i.value.trim()); });
        sel.innerHTML = '<option value="">' + T("— pick a partner —", "— اختر من الشركاء —") + "</option>" +
          names.map(function (n, i) { return '<option value="p' + i + '">' + (n || T("Partner ", "الشريك ") + (i + 1)) + "</option>"; }).join("") +
          '<option value="__ext">' + T("External manager (not a partner)", "مدير خارجي (غير شريك)") + "</option>";
        sel.value = current;
      }
      function addManager() {
        var id = ++seq;
        var card = document.createElement("div");
        card.className = "fc-card manager-card";
        card.innerHTML =
          '<div class="fc-card-head"><strong class="fc-card-n"></strong><button type="button" class="pr-del" aria-label="' + T("Remove", "حذف") + '">✕</button></div>' +
          '<div class="cc-grid">' +
          '<div class="field"><label>' + T("The manager", "المدير") + ' *</label><select data-m="who"></select></div>' +
          '<div class="field fc-ext" hidden><label>' + T("External manager name", "اسم المدير الخارجي") + ' *</label><input type="text" data-m="name"></div>' +
          '<div class="field fc-ext" hidden><label>' + T("Nationality", "جنسيته") + '</label><input type="text" data-m="nationality"></div>' +
          "</div>" +
          '<div class="perm-bars">' + permBars(id) + "</div>";
        var sel = card.querySelector('[data-m="who"]');
        whoOptions(sel);
        sel.addEventListener("focus", function () { whoOptions(sel); });
        sel.addEventListener("change", function () {
          var ext = sel.value === "__ext";
          card.querySelectorAll(".fc-ext").forEach(function (f) { f.hidden = !ext; });
        });
        card.querySelector(".pr-del").addEventListener("click", function () { card.remove(); renumber(); });
        card.querySelectorAll(".perm-bar").forEach(function (bar) {
          bar.addEventListener("change", function () { updateBar(bar); });
        });
        mWrap.appendChild(card);
        renumber();
      }

      addPartner(); addPartner(); // formation needs two partners minimum
      addManager();
      document.getElementById("fc-add-partner").addEventListener("click", addPartner);
      document.getElementById("fc-add-manager").addEventListener("click", addManager);

      function readFile(input) {
        return new Promise(function (resolve, reject) {
          var f = input.files && input.files[0];
          if (!f) return resolve(null);
          var r = new FileReader();
          r.onload = function () { resolve({ key: input.getAttribute("data-f"), label: input.getAttribute("data-flabel"), name: f.name, contentType: f.type || "application/pdf", data: String(r.result).split(",")[1] || "" }); };
          r.onerror = function () { reject(new Error("read")); };
          r.readAsDataURL(f);
        });
      }
      function collectPartners() {
        var cards = pWrap.querySelectorAll(".partner-card");
        var out = [], err = null, totalBytes = 0;
        cards.forEach(function (card, i) {
          if (err) return;
          var t = typeOf(card.querySelector('[data-p="type"]').value);
          var g = function (k) { var el = card.querySelector('[data-p="' + k + '"]'); return el ? el.value.trim() : ""; };
          var label = T("partner ", "الشريك ") + (i + 1);
          var p = { type: t.key, typeLabel: t.label, name: g("name"), dob: g("dob"), idNumber: g("idNumber"), address: g("address").toUpperCase(), phone: g("phone"), email: g("email"), share: g("share"), inputs: [] };
          if (!p.name) { err = T("Enter the name of ", "أدخل اسم ") + label; return; }
          if (t.dob && !p.dob) { err = T("Enter the Gregorian date of birth of ", "أدخل تاريخ الميلاد بالميلادي لـ") + label + " (" + p.name + ")"; return; }
          if (!p.idNumber) { err = t.id + " " + T("is required for ", "مطلوب لـ") + label + " (" + p.name + ")"; return; }
          if ((t.key === "saudi" || t.key === "resident") && !p.address) { err = T("Enter the short national address of ", "أدخل العنوان الوطني المختصر لـ") + label + " (" + p.name + ")"; return; }
          if (!EMAIL.test(p.email)) { err = T("Enter a valid email for ", "أدخل بريداً صحيحاً لـ") + label + " (" + p.name + ")"; return; }
          if (p.phone && !MOBILE.test(p.phone.replace(/\s/g, ""))) { err = T("Invalid mobile for ", "جوال غير صحيح لـ") + label + " (" + p.name + ")"; return; }
          if (p.share === "" || isNaN(Number(p.share))) { err = T("Enter the ownership share % of ", "أدخل نسبة الملكية لـ") + label + " (" + p.name + ")"; return; }
          p.share = Number(p.share);
          var fileInputs = card.querySelectorAll("input[type=file]");
          for (var k = 0; k < fileInputs.length; k++) {
            var input = fileInputs[k], f = input.files && input.files[0];
            if (!f) { err = T("Attach: ", "أرفق: ") + input.getAttribute("data-flabel") + " — " + label + " (" + p.name + ")"; return; }
            if (f.size > 2.5 * 1024 * 1024) { err = input.getAttribute("data-flabel") + " — " + label + ": " + T("file exceeds 2.5MB, compress it and retry.", "الملف يتجاوز 2.5 م.ب، صغّره وأعد المحاولة."); return; }
            totalBytes += f.size;
            p.inputs.push(input);
          }
          out.push(p);
        });
        if (!err && totalBytes > 3.2 * 1024 * 1024) err = T("Total attachments exceed the upload limit — compress the files (target under 3MB total) and retry.", "مجموع المرفقات يتجاوز حد الرفع — صغّر الملفات (أقل من 3 م.ب إجمالاً) وأعد المحاولة.");
        return { partners: out, error: err };
      }
      function collectManagers(partners) {
        var cards = mWrap.querySelectorAll(".manager-card");
        var out = [], err = null;
        cards.forEach(function (card, i) {
          if (err) return;
          var who = card.querySelector('[data-m="who"]').value;
          var m = { name: "", nationality: "", partner: false, perms: {} };
          if (who === "__ext") {
            m.name = card.querySelector('[data-m="name"]').value.trim();
            m.nationality = card.querySelector('[data-m="nationality"]').value.trim();
            if (!m.name) { err = T("Enter the external manager's name (manager ", "أدخل اسم المدير الخارجي (المدير ") + (i + 1) + ")"; return; }
          } else if (/^p\d+$/.test(who)) {
            var p = partners[Number(who.slice(1))];
            if (!p) { err = T("Pick the manager (manager ", "اختر المدير (المدير ") + (i + 1) + ")"; return; }
            m.name = p.name; m.partner = true;
          } else { err = T("Pick the manager (manager ", "اختر المدير (المدير ") + (i + 1) + ")"; return; }
          card.querySelectorAll(".perm-bar").forEach(function (bar) {
            var subs = [];
            bar.querySelectorAll("[data-sub]:checked").forEach(function (c) { subs.push(c.getAttribute("data-sub")); });
            if (!subs.length) return;
            var mode = bar.querySelector('input[type="radio"]:checked');
            m.perms[bar.getAttribute("data-g")] = { mode: mode ? mode.value : "solo", tawkeel: bar.querySelector("[data-tawkeel]").checked, subs: subs };
          });
          if (!Object.keys(m.perms).length) { err = T("Grant at least one power to the manager: ", "امنح صلاحية واحدة على الأقل للمدير: ") + m.name; return; }
          out.push(m);
        });
        return { managers: out, error: err };
      }

      fc.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = val("fc-name"), activity = val("fc-activity"), person = val("fc-person"), phone = val("fc-phone"), email = val("fc-email");
        if (!name || !activity) { alert(T("Enter the proposed name and main activity.", "أدخل الاسم المقترح والنشاط الرئيسي.")); return; }
        if (!person) { alert(T("Enter the requester's name.", "أدخل اسم مقدم الطلب.")); return; }
        if (!MOBILE.test(phone.replace(/\s/g, ""))) { alert(T("Enter a valid Saudi mobile.", "أدخل جوالاً سعودياً صحيحاً.")); return; }
        if (!EMAIL.test(email)) { alert(T("Enter a valid email.", "أدخل بريداً صحيحاً.")); return; }
        var cp = collectPartners();
        if (cp.error) { alert(cp.error); return; }
        var partners = cp.partners;
        if (partners.length < 2) { alert(T("A partners formation needs at least two partners.", "التأسيس بين شركاء يحتاج شريكين على الأقل.")); return; }
        var total = partners.reduce(function (s, p) { return s + (Number(p.share) || 0); }, 0);
        if (total !== 100) { alert(T("Partners' shares must total exactly 100% (now: ", "مجموع نسب الشركاء يجب أن يساوي 100% بالضبط (الآن: ") + total + "%)"); return; }
        var cm = collectManagers(partners);
        if (cm.error) { alert(cm.error); return; }
        if (!cm.managers.length) { alert(T("Add at least one manager with their powers.", "أضف مديراً واحداً على الأقل بصلاحياته.")); return; }
        var btn = fc.querySelector("button[type=submit]"), lbl = btn.textContent;
        btn.disabled = true; btn.textContent = T("Uploading documents…", "جارٍ رفع المستندات…");
        var ref = "BPF-" + Date.now().toString().slice(-6);
        var waMsg = encodeURIComponent(T("Formation request ", "طلب تأسيس ") + ref + " — " + name);
        function fail(net) {
          btn.disabled = false; btn.textContent = lbl;
          var box = document.getElementById("fc-success");
          box.hidden = false;
          box.innerHTML = "⚠️ " + (net ? T("Couldn't reach the server — send it on WhatsApp.", "تعذّر الاتصال بالخادم — أرسله عبر واتساب.") : T("Couldn't send — contact us on WhatsApp.", "تعذّر الإرسال — تواصل عبر واتساب.")) + ' <a class="btn btn-wa" style="margin-top:8px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' + waMsg + '">' + T("WhatsApp", "واتساب") + "</a>";
        }
        Promise.all(partners.map(function (p) {
          return Promise.all(p.inputs.map(readFile)).then(function (files) {
            var out = { type: p.type, typeLabel: p.typeLabel, name: p.name, dob: p.dob, idNumber: p.idNumber, address: p.address, phone: p.phone, email: p.email, share: p.share, files: files.filter(Boolean) };
            return out;
          });
        })).then(function (cleanPartners) {
          btn.textContent = T("Sending…", "جارٍ الإرسال…");
          return fetch("/api/requests", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "formation-contract", ref: ref, company: name, entity: val("fc-type"), capital: val("fc-capital"), activity: activity, person: person, phone: phone, email: email, partners: cleanPartners, managers: cm.managers }),
          });
        }).then(function (r) { return r.json(); }).then(function (d) {
          if (!d || !d.ok) return fail(false);
          btn.disabled = false; btn.textContent = lbl;
          var box = document.getElementById("fc-success");
          box.hidden = false;
          box.innerHTML = "✅ <strong>" + T("Formation request received", "تم استلام طلب التأسيس") + " — " + ref + "</strong><br>" +
            T("Documents received securely. We draft the incorporation contract with the managers' powers as specified and submit via the Saudi Business Center — every partner will get the signing invitation by email.", "استلمنا المستندات بأمان. نصيغ عقد التأسيس بصلاحيات المديرين كما حددتها ونقدّمه عبر المركز السعودي للأعمال — وسيستلم كل شريك دعوة التوقيع على بريده.");
          try {
            var orders = JSON.parse(localStorage.getItem("bp_orders") || "[]");
            orders.unshift({ ref: ref, name: person, email: email, items: [{ name: T("Company formation: ", "تأسيس شركة: ") + name, qty: 1 }], at: new Date().toISOString().slice(0, 10), status: T("Under review", "قيد المراجعة") });
            localStorage.setItem("bp_orders", JSON.stringify(orders));
          } catch (err) {}
          box.scrollIntoView({ behavior: "smooth", block: "center" });
        }).catch(function () { fail(true); });
      });
    }
  });
})();

/* ---------- Contact form (/contact) → WhatsApp deep-link + CRM lead ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("contact-form");
    if (!form) return;
    var T = function (en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; };
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = val("f-name"), phone = val("f-phone"), service = val("f-service"), msg = val("f-msg");
      if (!name) { alert(T("Please enter your name.", "الرجاء إدخال اسمك.")); return; }
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.style.opacity = "0.7"; }
      fetch("/api/requests", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "contact", company: name, person: name, phone: phone, email: "", eventType: service, notes: msg }),
      }).then(function () {
        form.innerHTML = '<div class="form-note" style="font-size:1rem;color:var(--navy)">✓ ' +
          T("Thank you — your request has reached our team and we'll get back to you soon.", "شكراً لك — وصل طلبك لفريقنا وسنعاود التواصل معك قريباً.") + "</div>";
      }).catch(function () {
        if (btn) { btn.disabled = false; btn.style.opacity = "1"; }
        alert(T("Couldn't reach the server. Please try again.", "تعذّر الاتصال بالخادم. حاول مرة أخرى."));
      });
    });
  });
})();

/* ---------- Deals & matchmaking (/deals) ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var drawer = document.getElementById("deal-drawer");
    if (!drawer) return;
    var T = function (en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; };
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
    function escDeal(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

    var tickets = document.querySelectorAll(".deal-ticket");
    var scrim = document.getElementById("deal-scrim");
    var bar = document.getElementById("deal-drawer-bar");
    var steps = drawer.querySelectorAll(".deal-step");
    var back = document.getElementById("deal-step-back");
    var next = document.getElementById("deal-step-next");
    var foot = document.getElementById("deal-drawer-foot");
    var wizMessage = document.getElementById("deal-wiz-message");
    var current = 1;
    var TOTAL_INPUT_STEPS = 4;

    var chips = document.querySelectorAll(".deal-chip");
    var visibleCount = document.getElementById("deal-visible-count");
    function applyFilter(kind) {
      var count = 0;
      tickets.forEach(function (t) {
        var show = kind === "all" || t.getAttribute("data-type") === kind;
        if (show) count++;
        t.toggleAttribute("hidden", !show);
      });
      if (visibleCount) visibleCount.textContent = String(count);
    }
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        chips.forEach(function (x) { x.classList.remove("active"); });
        c.classList.add("active");
        applyFilter(c.getAttribute("data-filter"));
      });
    });
    applyFilter("all");

    // An intro request is a real submission, not a cosmetic label flip: open the
    // wizard with a complementary type preselected and the target deal referenced
    // in the title, so the request reaches the team with full context.
    document.querySelectorAll(".deal-ticket-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ticket = btn.closest(".deal-ticket");
        var tTitle = ticket ? (ticket.querySelector("h3") || {}).textContent || "" : "";
        var tType = ticket ? ticket.getAttribute("data-type") : "";
        var kind = tType === "offer" ? "seek" : "offer";
        openDrawer(kind);
        var titleEl = document.getElementById("deal-title");
        if (titleEl && !titleEl.value && tTitle) titleEl.value = T("Intro request for: ", "طلب تعارف على: ") + tTitle.trim();
      });
    });

    var COMPLEMENTS = {
      offer: { offer: 0, seek: 25, idea: 25 },
      seek: { offer: 25, seek: 0, idea: 15 },
      idea: { offer: 25, seek: 15, idea: 0 },
    };

    function currentProfile() {
      var typeEl = drawer.querySelector('input[name="dealType"]:checked');
      var sectorEl = document.getElementById("deal-sector");
      var cityEl = document.getElementById("deal-city");
      return { type: typeEl ? typeEl.value : "seek", sector: sectorEl ? sectorEl.value : "", city: cityEl ? cityEl.value : "" };
    }

    function renderMatches() {
      var profile = currentProfile();
      var results = document.getElementById("deal-match-results");
      var scored = Array.prototype.map.call(tickets, function (t) {
        var reasons = [];
        var score = 0;
        if (t.getAttribute("data-city") === profile.city) { score += 40; reasons.push(T("📍 same city", "📍 نفس المدينة")); }
        if (t.getAttribute("data-sector") === profile.sector) { score += 35; reasons.push(T("🏷️ same sector", "🏷️ نفس القطاع")); }
        var bonus = (COMPLEMENTS[profile.type] || {})[t.getAttribute("data-type")] || 0;
        if (bonus) { score += bonus; reasons.push(T("🔁 complementary type", "🔁 نوع مكمّل")); }
        return { el: t, score: score, reasons: reasons };
      }).filter(function (m) { return m.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, 3);

      if (!scored.length) {
        results.innerHTML = '<div class="deal-match-empty">' + T("No strong match in our database right now — we'll watch for new deals and email you as soon as a match appears 🎯", "لا يوجد تطابق قوي في القاعدة الآن — سنراقب الصفقات الجديدة ونرسل لك بريدًا فور ظهور مطابقة تناسبك 🎯") + "</div>";
        return;
      }
      results.innerHTML = scored.map(function (m) {
        var title = m.el.querySelector("h3").textContent;
        var meta = Array.prototype.map.call(m.el.querySelectorAll(".deal-ticket-meta span"), function (s) { return s.textContent.trim(); }).join("  ·  ");
        return '<div class="deal-match-card"><div class="deal-match-head"><b>' + escDeal(title) + '</b><span class="deal-match-score">' + Math.min(m.score, 100) + "% " + T("match", "تطابق") + "</span></div>" +
          '<div class="deal-match-meta">' + escDeal(meta) + "</div>" +
          '<div class="deal-match-reasons">' + m.reasons.map(function (r) { return "<span>" + r + "</span>"; }).join("") + "</div></div>";
      }).join("");
    }

    function openDrawer(kind) {
      scrim.classList.add("open");
      drawer.classList.add("open");
      document.body.style.overflow = "hidden";
      if (kind) {
        var radio = drawer.querySelector('input[name="dealType"][value="' + kind + '"]');
        if (radio) radio.checked = true;
      }
      goToStep(1);
    }
    function closeDrawer() {
      scrim.classList.remove("open");
      drawer.classList.remove("open");
      document.body.style.overflow = "";
    }
    function goToStep(n) {
      current = n;
      steps.forEach(function (s) { s.classList.toggle("active", Number(s.getAttribute("data-step")) === n); });
      bar.style.width = Math.min(n, TOTAL_INPUT_STEPS) / TOTAL_INPUT_STEPS * 100 + "%";
      back.style.visibility = n === 1 ? "hidden" : "visible";
      if (n === TOTAL_INPUT_STEPS) renderMatches();
      if (n > TOTAL_INPUT_STEPS) {
        foot.style.display = "none";
      } else {
        foot.style.display = "flex";
        next.textContent = n === 3 ? T("Send & match", "إرسال ومطابقة") : T("Next", "التالي");
        next.removeAttribute("disabled");
      }
    }

    function showWizError(msg) { wizMessage.textContent = msg; wizMessage.hidden = false; }

    function submitDeal() {
      var profile = currentProfile();
      var payload = {
        type: "deal",
        dealType: profile.type,
        title: val("deal-title"),
        sector: profile.sector,
        city: profile.city,
        description: val("deal-desc"),
        name: val("deal-name"),
        phone: val("deal-phone"),
        email: val("deal-email"),
        consent: !!document.getElementById("deal-consent").checked,
        lang: (window.BP && BP.lang) || "ar",
      };
      if (!payload.name || !payload.phone || !payload.email) {
        showWizError(T("Fill in your name, mobile and email before continuing.", "عبّي الاسم والجوال والبريد قبل المتابعة."));
        return Promise.resolve(false);
      }
      if (!payload.consent) {
        showWizError(T("You must agree to the review and contact before sending.", "لازم توافق على المراجعة والتواصل قبل الإرسال."));
        return Promise.resolve(false);
      }
      next.setAttribute("disabled", "true");
      next.textContent = T("Sending…", "جارٍ الإرسال…");
      wizMessage.hidden = true;
      return fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (!d || !d.ok) throw new Error("failed"); return true; })
        .catch(function () {
          showWizError(T("An error occurred sending your file. Try again or contact us directly.", "حدث خطأ في إرسال الملف. حاول مرة أخرى أو تواصل معنا مباشرة."));
          next.removeAttribute("disabled");
          next.textContent = T("Send & match", "إرسال ومطابقة");
          return false;
        });
    }

    var openHero = document.getElementById("deal-open-hero");
    var openBottom = document.getElementById("deal-open-bottom");
    if (openHero) openHero.addEventListener("click", function () { openDrawer(); });
    if (openBottom) openBottom.addEventListener("click", function () { openDrawer(); });
    document.querySelectorAll(".deal-launcher").forEach(function (t) {
      t.addEventListener("click", function () { openDrawer(t.getAttribute("data-kind")); });
    });
    document.getElementById("deal-drawer-close").addEventListener("click", closeDrawer);
    scrim.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });

    back.addEventListener("click", function () { if (current > 1) goToStep(current - 1); });
    next.addEventListener("click", function () {
      if (current === 3) {
        submitDeal().then(function (ok) { if (ok) goToStep(4); });
      } else if (current === 4) {
        goToStep(5);
      } else {
        goToStep(current + 1);
      }
    });
  });
})();

/* ---------- AI Hiring OS dashboard (/employer-dashboard) ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var app = document.getElementById("empd-app");
    if (!app) return;
    var isAr = (window.BP_EMPD_LANG || "ar") === "ar";
    var T = function (en, ar) { return isAr ? ar : en; };
    var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); };
    var nl2br = function (s) { return esc(s).replace(/\n/g, "<br>"); };
    var gate = document.getElementById("empd-gate");
    var codeInput = document.getElementById("empd-code");
    var gateMsg = document.getElementById("empd-gate-msg");
    // Standard ATS pipeline (matches Greenhouse/Lever/Bayt structure): a candidate
    // moves left-to-right through funnel stages, with Rejected as a separate
    // terminal column reachable from any stage (not part of the linear order).
    var STAGES = [
      ["new", T("New", "مرشّح جديد")],
      ["screening", T("Screening", "الفرز")],
      ["interview", T("Interview", "المقابلة")],
      ["offer", T("Offer", "العرض الوظيفي")],
      ["hired", T("Hired", "تم التوظيف")],
    ];
    var REJECTED = ["rejected", T("Rejected", "مرفوض")];
    var CODE = "", CANDS = [], lastJD = "";
    var DEMO = false;
    var UNLOCKED = false;
    var PLAN = "";
    function planRank() { if (DEMO) return 3; if (!PLAN) return UNLOCKED ? 3 : 0; return ({ "أساسية": 1, "احترافية": 2, "مؤسسية": 3 })[PLAN] || 1; }
    function setUnlocked(on) {
      UNLOCKED = on;
      // Main-site dashboard: a clean gate card ↔ the full app. The standalone
      // portal variant keeps its inline unlock bar, so fall back to hiding it.
      var lk = document.getElementById("empd-locked"), mn = document.getElementById("empd-main");
      if (lk && mn) { lk.hidden = on; mn.hidden = !on; return; }
      var ub = document.getElementById("empd-unlock"); if (ub) ub.hidden = on;
    }
    // On the main-site dashboard the whole app is hidden while locked, so
    // there's nothing to preload; the portal variant still free-browses.
    function gatedApp() { return !!document.getElementById("empd-locked"); }
    function apiErr(d) { var e = d && d.error; if (e === "not_configured") return T("Notion isn't connected on the server.", "قاعدة Notion غير مربوطة بالخادم."); if (e === "notion_failed") return T("Couldn't query Notion — is the ATS DB shared with the integration?", "تعذّر الاستعلام من Notion — هل القاعدة مُشاركة مع التكامل؟"); if (e === "server_error") return T("Server error (the pool may be large — retry).", "خطأ في الخادم (قد تكون القاعدة كبيرة — أعد المحاولة)."); return T("Couldn't load candidates.", "تعذّر تحميل المرشّحين."); }
    // Only codes that exist purely client-side (never a real subscription/owner
    // code) belong here. "DEMO123" used to be listed too, which silently
    // hijacked the backend's real OWNER_DEMO_CODE override (api/candidates.js
    // defaults that to "demo123") — typing it always showed 6 fake candidates
    // instead of resolving through /api/candidates to the real, top-tier-
    // unlocked pool. Removed so any real code always goes through the API.
    var DEMO_CODES = ["BP-DEMO", "BP-EMP-DEMO"];
    function isDemoCode(x) { return DEMO_CODES.indexOf(String(x == null ? "" : x).trim().toUpperCase()) > -1; }
    var DEMO_CANDS = [
      { id: "d1", name: "محمد الشهري", role: "محاسب أول", field: "محاسبة ومالية", city: "الرياض", experience: 6, education: "بكالوريوس", nationalityType: "سعودي", skills: "SOCPA, تقارير مالية, ضريبة القيمة المضافة", phone: "+966500000001", email: "demo1@example.com", cv: "" },
      { id: "d2", name: "سارة القحطاني", role: "أخصائي موارد بشرية", field: "موارد بشرية", city: "جدة", experience: 4, education: "بكالوريوس", nationalityType: "سعودي", skills: "توظيف, قوى, GOSI, رواتب", phone: "+966500000002", email: "demo2@example.com", cv: "" },
      { id: "d3", name: "Ahmed Khan", role: "مطوّر برمجيات", field: "تقنية معلومات", city: "الرياض", experience: 5, education: "بكالوريوس", nationalityType: "غير سعودي", skills: "JavaScript, Node.js, React, APIs", phone: "+966500000003", email: "demo3@example.com", cv: "" },
      { id: "d4", name: "نورة العتيبي", role: "مسؤول مبيعات", field: "مبيعات وتسويق", city: "الدمام", experience: 3, education: "دبلوم", nationalityType: "سعودي", skills: "مبيعات, CRM, تفاوض", phone: "+966500000004", email: "demo4@example.com", cv: "" },
      { id: "d5", name: "خالد الزهراني", role: "مشرف تشغيل مطاعم", field: "ضيافة ومطاعم", city: "الرياض", experience: 8, education: "ثانوي", nationalityType: "سعودي", skills: "إدارة فروع, F&B, جودة", phone: "+966500000005", email: "demo5@example.com", cv: "" },
      { id: "d6", name: "Ravi Kumar", role: "فني صيانة", field: "مقاولات وإنشاءات", city: "جدة", experience: 7, education: "دبلوم", nationalityType: "غير سعودي", skills: "كهرباء, HVAC, صيانة وقائية", phone: "+966500000006", email: "demo6@example.com", cv: "" }
    ];
    function demoMatch(jd, st, grid) {
      var terms = String(jd).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (w) { return w.length > 1; });
      var scored = DEMO_CANDS.map(function (c) {
        var hay = (c.role + " " + c.field + " " + c.skills + " " + c.city + " " + c.nationalityType).toLowerCase();
        var hits = 0; terms.forEach(function (t) { if (hay.indexOf(t) > -1) hits++; });
        var score = Math.min(97, 55 + hits * 9 + Math.min(c.experience || 0, 8));
        var reason = isAr ? ("تطابق في " + (hits || 1) + " معيار · " + (c.experience || 0) + " سنة خبرة · " + c.field) : (hits + " criteria match · " + (c.experience || 0) + "y · " + c.field);
        return { c: c, m: { id: c.id, score: score, reason: reason } };
      }).sort(function (a, b) { return b.m.score - a.m.score; });
      st.textContent = "✨ " + scored.length + " " + (isAr ? "مرشّح مطابق (تجربة)" : "matched candidates (demo)");
      grid.innerHTML = scored.map(function (x) { return card(x.c, { match: x.m }); }).join("");
      bindCard(grid);
    }
    function demoAIAction(task, c) {
      var mbody = document.getElementById("empd-modal-body");
      var out;
      if (task === "interview") {
        out = isAr
          ? "1) احكي لنا عن تجربتك في " + c.field + ".\n2) ما أبرز إنجاز حققته كـ " + c.role + "؟\n3) كيف تتعامل مع ضغط العمل والمواعيد؟\n4) ما مستواك في: " + c.skills + "؟\n5) ما توقعاتك للراتب ومتى تقدر تباشر؟"
          : "1) Tell us about your experience in " + c.field + ".\n2) Your biggest achievement as a " + c.role + "?\n3) How do you handle deadlines?\n4) Your level in: " + c.skills + "?\n5) Salary expectation and availability?";
      } else if (task === "outreach") {
        out = isAr
          ? "مرحباً " + (c.name || "") + "، معك فريق Business Partner. لاحظنا خبرتك كـ " + c.role + " وعندنا فرصة تناسبك. هل نقدر نحدد مكالمة قصيرة؟"
          : "Hi " + (c.name || "") + ", this is the Business Partner team. We noticed your experience as a " + c.role + " and have a role that fits. Can we schedule a short call?";
      } else {
        out = isAr
          ? "تقييم سريع: " + (c.name || "") + " — " + c.role + " بخبرة " + (c.experience || 0) + " سنة في " + c.field + ". المهارات: " + c.skills + ". التعليم: " + c.education + ". " + (c.nationalityType === "سعودي" ? "يدعم نسب التوطين." : "يحتاج تصريح عمل.") + " ملائم للمرحلة القادمة."
          : "Quick assessment: " + (c.name || "") + " — " + c.role + ", " + (c.experience || 0) + "y in " + c.field + ". Skills: " + c.skills + ". Education: " + c.education + ". Good fit for the next stage.";
      }
      var html = "<div class='empd-ai-out'>" + nl2br(out) + "</div>";
      if (task === "outreach" && c.phone) { var wa = c.phone.replace(/[^\d]/g, ""); html += '<a class="btn btn-wa" style="margin-top:12px" target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + encodeURIComponent(out) + '">' + T("Send on WhatsApp", "أرسل عبر واتساب") + "</a>"; }
      mbody.innerHTML = html;
    }
    function readLS(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
    function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    var short = readLS("bp_shortlist", []);
    var pipe = readLS("bp_pipeline", {});
    function inShort(id) { return short.some(function (c) { return c.id === id; }); }
    function findC(id) { return CANDS.concat(short).filter(function (c) { return c.id === id; })[0]; }

    function validate(code, cb) {
      if (isDemoCode(code)) { cb(true, { unlocked: true, demo: true, candidates: DEMO_CANDS }); return; }
      // validate=1 answers from the Employers DB alone — no full pool scan
      // just to learn whether a code is active.
      fetch("/api/candidates?validate=1&code=" + encodeURIComponent(code)).then(function (r) { return r.json(); })
        .then(function (d) { cb(!!(d && d.unlocked), d); }).catch(function () { cb(false, null); });
    }
    function enter(code, data) {
      CODE = code; DEMO = !!(data && data.demo) || isDemoCode(code); writeLS("bp_emp_code", code);
      PLAN = (data && data.plan) || "";
      setUnlocked(true);
      // Demo mode's candidates are the fixed sample set — no need to hit the
      // API. Otherwise always go through load() so the auto-continuing scan
      // (and its live-updating count) runs, rather than settling for whatever
      // partial batch the unlock-check request happened to return.
      if (DEMO && data && data.candidates) { CANDS = data.candidates; fillFilters(); renderBrowse(); } else load();
      renderCounts();
      var planTxt = PLAN ? (" — " + T("plan", "الباقة") + ": " + PLAN) : "";
      gateMsg.textContent = DEMO ? T("Demo mode — sample data.", "وضع تجربة — بيانات عيّنة.") : (T("Unlocked — contacts enabled.", "تم الفتح — بيانات التواصل مفعّلة.") + planTxt);
      var wt = document.getElementById("empd-welcome-txt");
      if (wt) wt.textContent = DEMO ? T("Demo mode — sample data", "وضع تجربة — بيانات عيّنة")
        : T("Welcome — your account is active", "أهلاً بك — حسابك مفعّل") + (PLAN ? " · " + T("Plan:", "الباقة:") + " " + PLAN : "");
      // The gated dashboard opens on "My jobs & matches" — load the employer's
      // postings right away so the first screen is their own jobs, not filters.
      if (gatedApp()) loadPostings();
    }
    var enterBtn = document.getElementById("empd-enter");
    if (enterBtn) enterBtn.addEventListener("click", function () {
      var code = (codeInput.value || "").trim(); if (!code) return;
      gateMsg.textContent = T("Checking…", "جارٍ التحقق…");
      validate(code, function (ok, data) { if (ok) enter(code, data); else gateMsg.textContent = T("Invalid or inactive code. Contact us to activate.", "رمز غير صحيح أو غير مفعّل. تواصل معنا للتفعيل."); });
    });
    if (codeInput) codeInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { var b = document.getElementById("empd-enter"); if (b) b.click(); } });
    var demoBtn = document.getElementById("empd-demo");
    if (demoBtn) demoBtn.addEventListener("click", function () { enter("BP-DEMO", { unlocked: true, demo: true, candidates: DEMO_CANDS }); });
    document.getElementById("empd-logout").addEventListener("click", function () { try { localStorage.removeItem("bp_emp_code"); } catch (e) {} location.reload(); });
    // Never silently auto-resume a demo session from a past visit — the demo
    // must always be an explicit, one-time click so a stale localStorage
    // value can't make a real subscriber's dashboard look empty/fake forever.
    var saved = readLS("bp_emp_code", "");
    if (typeof saved === "string" && saved && !isDemoCode(saved)) { validate(saved, function (ok, data) { if (ok) enter(saved, data); else { CODE = ""; setUnlocked(false); if (!gatedApp()) load(); renderCounts(); } }); }
    else { if (isDemoCode(saved)) writeLS("bp_emp_code", ""); CODE = ""; setUnlocked(false); if (!gatedApp()) load(); renderCounts(); }

    Array.prototype.forEach.call(document.querySelectorAll(".empd-tab"), function (t) {
      t.addEventListener("click", function () {
        document.querySelectorAll(".empd-tab").forEach(function (x) { x.classList.remove("active"); });
        t.classList.add("active");
        var tab = t.getAttribute("data-tab");
        document.querySelectorAll(".empd-panel").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== tab; });
        if (tab === "shortlist") renderShort();
        if (tab === "pipeline") renderPipe();
        if (tab === "postings") loadPostings();
      });
    });

    // Filters use the same shared, canonical taxonomy/combobox widget as the
    // candidate/job-posting forms — not values scraped from whatever's on the
    // currently-loaded page (that showed raw Arabic values un-translated on
    // English pages, and missed any category not already visible).
    function fillFilters() {
      if (fillFilters.done) return; fillFilters.done = true;
      var lang = BP.lang;
      if (BP.initCombobox) {
        BP.initCombobox(document.getElementById("empd-field"), function () { return BP.FIELD_TAXONOMY.map(function (p) { return T(p[1], p[0]); }); });
        BP.initCombobox(document.getElementById("empd-city"), function () { return BP.cityOptions ? BP.cityOptions(lang) : []; });
        BP.initCombobox(document.getElementById("empd-country"), function () { return BP.countryOptions ? BP.countryOptions(lang) : []; });
        BP.initCombobox(document.getElementById("empd-q"), function () { return BP.jobTitleOptions ? BP.jobTitleOptions(lang) : []; });
      }
    }
    // A typed/picked Field label (English or Arabic) → the canonical Arabic
    // value the API filters on. Free text that isn't one of the fixed
    // categories resolves to "" (no field filter applied), since Field is an
    // exact-match property server-side — same behavior a closed <select> had.
    function resolveField(text) {
      var t = String(text || "").trim();
      if (!t) return "";
      var hit = BP.FIELD_TAXONOMY.filter(function (p) { return p[0] === t || p[1].toLowerCase() === t.toLowerCase(); })[0];
      return hit ? hit[0] : "";
    }
    function load() {
      var status = document.getElementById("empd-status"); status.textContent = T("Loading candidates…", "جارٍ تحميل المرشّحين…");
      if (DEMO) { CANDS = DEMO_CANDS.slice(); status.textContent = CANDS.length + " " + T("candidates (demo)", "مرشّح (تجربة)"); renderBrowse(); return; }
      var q = document.getElementById("empd-q").value.trim(), f = document.getElementById("empd-field").value.trim(),
        ci = document.getElementById("empd-city").value.trim(), co = document.getElementById("empd-country").value.trim(),
        n = document.getElementById("empd-nat").value;
      var params = { code: CODE };
      if (q) params.q = q; var fv = resolveField(f); if (fv) params.field = fv; if (ci) params.city = ci; if (co) params.country = co; if (n) params.nat = n;
      var loadSeq = (load.seq = (load.seq || 0) + 1); // cancels a stale in-flight auto-continuation if filters change mid-scan
      CANDS = [];
      var scanning = 0; // number of rows fetched so far, for the "N and counting…" status
      function fetchPage(cursor) {
        var qs = new URLSearchParams(params); if (cursor) qs.set("cursor", cursor);
        return fetch("/api/candidates?" + qs).then(function (r) { return r.json(); });
      }
      var grid = document.getElementById("empd-grid");
      function step(cursor) {
        fetchPage(cursor).then(function (d) {
          if (loadSeq !== load.seq) return; // filters changed since this scan started
          if (!d || !d.ok) { status.textContent = apiErr(d); return; }
          var page = d.candidates || [];
          CANDS = CANDS.concat(page);
          scanning += page.length;
          if (!CANDS.length && d.done) { status.textContent = T("No candidates match.", "لا توجد نتائج مطابقة."); return; }
          fillFilters();
          // Full re-render only for the first page (so filters/empty-state
          // render correctly); later pages append so the grid doesn't
          // flicker/reset scroll on every background continuation step.
          if (!cursor) { renderBrowse(); } else if (page.length) {
            var frag = document.createElement("div"); frag.innerHTML = page.map(function (c) { return card(c, {}); }).join("");
            bindCard(frag); // bind while detached — binding the live grid instead would double-bind every earlier card on each continuation step
            while (frag.firstChild) grid.appendChild(frag.firstChild);
          }
          var countTxt = scanning + " " + T(d.done ? "candidates" : "candidates so far — still counting…", d.done ? "مرشّح" : "مرشّح حتى الآن — العدّ مستمر…");
          status.textContent = UNLOCKED ? countTxt : countTxt + " · " + T("subscribe to reveal contacts", "اشترك لكشف بيانات التواصل");
          // Auto-continue in the background so the count keeps climbing to the
          // real total instead of freezing on whatever fit in one time budget —
          // this is what actually fixes the count getting stuck at a round
          // number as the pool grows past what one request can fully page through.
          if (!d.done && d.nextCursor) step(d.nextCursor);
        }).catch(function () { if (loadSeq === load.seq) status.textContent = T("Network error — please retry.", "خطأ في الاتصال — أعد المحاولة."); });
      }
      step(null);
    }
    document.getElementById("empd-load").addEventListener("click", load);
    document.getElementById("empd-q").addEventListener("keydown", function (e) { if (e.key === "Enter") load(); });

    function contacts(c) {
      var out = [];
      if (c.name) {
        // Clicking the name opens the same full profile as the "View profile"
        // button — it's the more discoverable click target.
        var nm = '<strong class="emp-name-link" data-id="' + esc(c.id) + '">' + esc(c.name) + "</strong>";
        if (c.nameAlt) nm += ' <span class="emp-name-alt">(' + esc(c.nameAlt) + ")</span>";
        out.push(nm);
      }
      if (c.phone) out.push('📞 <a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + "</a>");
      if (c.email) out.push('✉️ <a href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a>");
      if (c.cv) {
        var cvLabel = c.cvKind === "ats" ? T("CV (ATS-formatted)", "السيرة الذاتية (منسّقة ATS)") : T("CV (original — being formatted)", "السيرة الذاتية (أصلية — قيد التنسيق)");
        var cvCls = c.cvKind === "ats" ? "emp-cv-ats" : "emp-cv-raw";
        out.push('<a class="' + cvCls + '" href="' + esc(c.cv) + '" target="_blank" rel="noopener">' + cvLabel + "</a>");
      }
      return out.length ? '<div class="emp-contact">' + out.join(" · ") + "</div>" : "";
    }
    function stageBtns(id) {
      var cur = pipe[id] || "";
      var lin = STAGES.map(function (s) { return '<button data-id="' + esc(id) + '" data-stage="' + s[0] + '" class="empd-stage-btn' + (cur === s[0] ? " on" : "") + '">' + esc(s[1]) + "</button>"; }).join("");
      var rej = '<button data-id="' + esc(id) + '" data-stage="' + REJECTED[0] + '" class="empd-stage-btn empd-stage-reject' + (cur === REJECTED[0] ? " on" : "") + '">✕ ' + esc(REJECTED[1]) + "</button>";
      return '<div class="empd-stages">' + lin + rej + "</div>";
    }
    function aiBtns(id) {
      return '<div class="empd-ai"><button class="empd-ai-btn" data-ai="summary" data-id="' + esc(id) + '">📝 ' + T("Assess", "تقييم") + '</button>' +
        '<button class="empd-ai-btn" data-ai="interview" data-id="' + esc(id) + '">❓ ' + T("Interview Qs", "أسئلة مقابلة") + '</button>' +
        '<button class="empd-ai-btn" data-ai="outreach" data-id="' + esc(id) + '">✉️ ' + T("Outreach", "رسالة تواصل") + '</button></div>';
    }
    function viewProfile(id) {
      // A dedicated page (not a modal) — organized like a real profile
      // (header, badges, skills, full CV), and shareable/bookmarkable via
      // its own URL. It re-fetches fresh from the API rather than reusing
      // the in-memory card data, so it works even opened directly.
      location.href = "/candidate-profile?id=" + encodeURIComponent(id) + (CODE ? "&code=" + encodeURIComponent(CODE) : "");
    }
    function card(c, opts) {
      opts = opts || {};
      var meta = [c.experience ? (isAr ? c.experience + " سنة خبرة" : c.experience + "y exp") : "", c.education, c.nationalityType].filter(Boolean).join(" · ");
      var badge = opts.match ? '<div class="empd-score"><span class="empd-score-n">' + Math.round(opts.match.score) + '%</span> ' + esc(opts.match.reason || "") + "</div>" : "";
      // The role/title heading is itself a click target into the profile — not
      // just the "View profile" button and the name — since it's the most
      // prominent element on the card and users expect clicking it to work.
      return '<div class="emp-card" data-id="' + esc(c.id) + '">' + badge + '<div class="emp-card-top"><strong class="emp-role-link" data-id="' + esc(c.id) + '">' + esc(c.role || c.field || "—") + '</strong>' + (c.field ? '<span class="emp-tag">' + esc(c.field) + "</span>" : "") + "</div>" +
        (c.city ? '<div class="emp-role">📍 ' + esc([c.city, c.country].filter(Boolean).join(", ")) + "</div>" : "") +
        (c.skills ? '<div class="emp-skills">' + esc(c.skills) + "</div>" : "") +
        (meta ? '<div class="emp-meta">' + esc(meta) + "</div>" : "") +
        contacts(c) +
        '<div class="empd-actions"><button class="empd-view" data-id="' + esc(c.id) + '">👤 ' + T("View profile", "عرض الملف") + '</button>' +
        '<button class="empd-save' + (inShort(c.id) ? " on" : "") + '" data-id="' + esc(c.id) + '">' + (inShort(c.id) ? "★ " + T("Saved", "محفوظ") : "☆ " + T("Shortlist", "حفظ")) + "</button>" +
        (opts.removeShort ? '<button class="empd-rm" data-id="' + esc(c.id) + '">' + T("Remove", "إزالة") + "</button>" : "") + "</div>" +
        aiBtns(c.id) + stageBtns(c.id) + "</div>";
    }
    function bindCard(scope) {
      scope.querySelectorAll(".empd-view, .emp-name-link, .emp-role-link").forEach(function (b) {
        b.addEventListener("click", function () { viewProfile(b.getAttribute("data-id")); });
      });
      scope.querySelectorAll(".empd-save").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-id"), c = findC(id);
          if (inShort(id)) short = short.filter(function (x) { return x.id !== id; }); else if (c) short.push(c);
          writeLS("bp_shortlist", short); renderCounts();
          b.classList.toggle("on"); b.innerHTML = inShort(id) ? "★ " + T("Saved", "محفوظ") : "☆ " + T("Shortlist", "حفظ");
        });
      });
      scope.querySelectorAll(".empd-stage-btn").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-id"), st = b.getAttribute("data-stage"), c = findC(id);
          if (pipe[id] === st) delete pipe[id]; else { pipe[id] = st; if (c && !inShort(id)) { short.push(c); writeLS("bp_shortlist", short); renderCounts(); } }
          writeLS("bp_pipeline", pipe);
          b.parentNode.querySelectorAll(".empd-stage-btn").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-stage") === pipe[id]); });
          // Persist the stage (and, the first time, the interview/hired date)
          // to Notion so it's tracked internally — this used to live only in
          // this browser's localStorage with no record of when it happened.
          if (pipe[id]) {
            fetch("/api/candidates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update-stage", code: CODE, id: id, stage: pipe[id] }) })
              .catch(function () {});
          }
        });
      });
      scope.querySelectorAll(".empd-rm").forEach(function (b) { b.addEventListener("click", function () { var id = b.getAttribute("data-id"); short = short.filter(function (x) { return x.id !== id; }); writeLS("bp_shortlist", short); renderCounts(); renderShort(); }); });
      scope.querySelectorAll(".empd-ai-btn").forEach(function (b) { b.addEventListener("click", function () { aiAction(b.getAttribute("data-ai"), b.getAttribute("data-id")); }); });
    }
    function renderCounts() { var el = document.getElementById("empd-short-count"); if (el) el.textContent = short.length; }
    function renderBrowse() { var g = document.getElementById("empd-grid"), status = document.getElementById("empd-status"); status.textContent = CANDS.length + " " + T("candidates", "مرشّح"); g.innerHTML = CANDS.map(function (c) { return card(c, {}); }).join(""); bindCard(g); }
    function renderShort() { var g = document.getElementById("empd-short-grid"); if (!short.length) { g.innerHTML = '<p class="emp-note">' + T("No saved candidates yet.", "ما في مرشّحين محفوظين بعد.") + "</p>"; return; } g.innerHTML = short.map(function (c) { return card(c, { removeShort: true }); }).join(""); bindCard(g); }
    function renderPipe() {
      var wrap = document.getElementById("empd-pipe");
      var cols = STAGES.concat([REJECTED]);
      wrap.innerHTML = cols.map(function (s) {
        var items = short.filter(function (c) { return pipe[c.id] === s[0]; });
        var cards = items.length ? items.map(function (c) { return '<div class="empd-pcard"><strong>' + esc(c.name || c.role || "—") + "</strong>" + (c.role ? "<span>" + esc(c.role) + "</span>" : "") + (c.phone ? '<a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + "</a>" : "") + "</div>"; }).join("") : '<p class="empd-empty">—</p>';
        var colClass = s[0] === REJECTED[0] ? "empd-col empd-col-reject" : "empd-col";
        return '<div class="' + colClass + '"><div class="empd-col-h">' + esc(s[1]) + ' <span>' + items.length + "</span></div>" + cards + "</div>";
      }).join("");
    }

    // ---- AI Match ----
    document.getElementById("empd-jd").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); document.getElementById("empd-match-run").click(); }
    });
    document.getElementById("empd-match-run").addEventListener("click", function () {
      var jd = document.getElementById("empd-jd").value.trim();
      var st = document.getElementById("empd-match-status"), grid = document.getElementById("empd-match-grid");
      if (!jd) { st.textContent = T("Describe the role first.", "اكتب وصف الوظيفة أولاً."); return; }
      if (!CANDS.length) { st.textContent = T("Loading candidates… try again in a moment.", "يتم تحميل المرشّحين… حاول بعد لحظات."); load(); return; }
      lastJD = jd; st.textContent = "✨ " + T("AI is ranking your best-fit candidates…", "الذكاء يرتّب أنسب المرشّحين…"); grid.innerHTML = "";
      if (!UNLOCKED) { st.textContent = T("Subscribe to enable AI Match.", "اشترك لتفعيل المطابقة الذكية."); return; }
      if (planRank() < 2) { st.textContent = T("Upgrade to Professional to use AI Match.", "رقِّ باقتك إلى «احترافية» لتفعيل المطابقة الذكية."); return; }
      if (DEMO) { demoMatch(jd, st, grid); return; }
      fetch("/api/hire", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "match", role: jd, candidates: CANDS.map(function (c) { return { id: c.id, role: c.role, field: c.field, city: c.city, experience: c.experience, education: c.education, nationalityType: c.nationalityType, skills: c.skills }; }) }) })
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          if (res.s === 503) { st.innerHTML = T("AI isn't enabled yet.", "الذكاء غير مفعّل بعد."); return; }
          var d = res.d;
          // A failed request (bad status or ok:false) is NOT the same as "no matches" —
          // conflating them used to hide real AI/API errors behind a misleading message.
          if (res.s >= 400 || !d || !d.ok) {
            console.error("AI Match request failed", res.s, d && d.error, d && d.raw);
            st.textContent = T("AI Match failed — please try again in a moment.", "تعذّر تشغيل المطابقة الذكية — حاول مرة أخرى بعد قليل.");
            return;
          }
          if (!d.ranked || !d.ranked.length) {
            console.warn("AI Match returned no ranked candidates", d.raw);
            st.textContent = T("No strong matches. Try rephrasing the role.", "لا مطابقات قوية. جرّب تصيغ الوصف بشكل آخر.");
            return;
          }
          var byId = {}; CANDS.forEach(function (c) { byId[c.id] = c; });
          var items = d.ranked.map(function (m) { var c = byId[m.id]; return c ? { c: c, m: m } : null; }).filter(Boolean);
          st.textContent = "✨ " + items.length + " " + T("matched candidates (best first)", "مرشّح مطابق (الأفضل أولاً)");
          grid.innerHTML = items.map(function (x) { return card(x.c, { match: x.m }); }).join("");
          bindCard(grid);
        })
        .catch(function (e) { console.error("AI Match network error", e); st.textContent = T("Network error. Try again.", "خطأ في الاتصال. حاول مجدداً."); });
    });

    // ---- Job Postings: publish + AI screen each posting against the pool ----
    var titleEl = document.getElementById("empjob-title"), cityEl = document.getElementById("empjob-city");
    if (window.BP && BP.initCombobox && titleEl && cityEl) {
      BP.initCombobox(titleEl, function () { return BP.jobTitleOptions(isAr ? "ar" : "en"); });
      BP.initCombobox(cityEl, function () { return BP.cityOptions(isAr ? "ar" : "en"); });
    }
    var aiWriteBtn = document.getElementById("empjob-ai-write");
    if (aiWriteBtn) {
      aiWriteBtn.addEventListener("click", function () {
        var title = titleEl ? titleEl.value.trim() : "";
        if (!title) { alert(T("Enter a job title first.", "اكتب المسمى الوظيفي أولاً.")); return; }
        var descEl = document.getElementById("empjob-desc");
        var fieldEl = document.getElementById("empjob-field");
        var label = aiWriteBtn.textContent;
        aiWriteBtn.disabled = true; aiWriteBtn.textContent = "✨ " + T("Writing…", "جارٍ الكتابة…");
        fetch("/api/hire", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ task: "jobdesc", title: title, field: fieldEl ? fieldEl.value : "", city: cityEl ? cityEl.value.trim() : "" }),
        }).then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
          .then(function (res) {
            aiWriteBtn.disabled = false; aiWriteBtn.textContent = label;
            if (res.s === 503) { alert(T("AI isn't enabled yet.", "الذكاء غير مفعّل بعد.")); return; }
            if (!res.d || !res.d.ok || !res.d.result) { alert(T("Couldn't generate. Try again.", "تعذّر التوليد. حاول مجدداً.")); return; }
            descEl.value = res.d.result;
          })
          .catch(function () {
            aiWriteBtn.disabled = false; aiWriteBtn.textContent = label;
            alert(T("Network error. Try again.", "خطأ في الاتصال. حاول مجدداً."));
          });
      });
    }
    var POSTINGS = [];
    function loadPostings() {
      var list = document.getElementById("empjob-list");
      if (!CODE || DEMO) { list.innerHTML = '<p class="emp-note">' + T("Subscribe (or use a demo/real code) to post jobs.", "اشترك (أو استخدم رمزاً تجريبياً/حقيقياً) لنشر الوظائف.") + "</p>"; return; }
      list.innerHTML = '<p class="emp-note">' + T("Loading…", "جارٍ التحميل…") + "</p>";
      fetch("/api/candidates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "list-postings", code: CODE }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          POSTINGS = (d && d.ok && d.postings) || [];
          renderPostings();
          autoScreenPostings();
        })
        .catch(function () { list.innerHTML = '<p class="emp-note">' + T("Couldn't load your job postings.", "تعذّر تحميل وظائفك المنشورة.") + "</p>"; });
    }
    // Live matching: screen every posting automatically when the dashboard
    // opens (staggered so the AI endpoint isn't hammered), instead of waiting
    // for the employer to click each posting's screen button. The candidate
    // pool loads in parallel, so poll briefly until it's there.
    var AUTO_SCREENED = false;
    function autoScreenPostings() {
      if (AUTO_SCREENED || !POSTINGS.length || !UNLOCKED || planRank() < 2) return;
      var tries = 0;
      (function waitCands() {
        if (!CANDS.length) { if (++tries > 20) return; return setTimeout(waitCands, 1500); }
        AUTO_SCREENED = true;
        POSTINGS.forEach(function (p, i) { setTimeout(function () { screenPosting(i); }, i * 1500); });
      })();
    }
    function renderPostings() {
      var list = document.getElementById("empjob-list");
      if (!POSTINGS.length) { list.innerHTML = '<p class="emp-note">' + T("No job postings yet — publish your first one from the form below.", "لا يوجد وظائف منشورة بعد — انشر أول وظيفة من النموذج بالأسفل.") + "</p>"; return; }
      list.innerHTML = POSTINGS.map(function (p, i) {
        return '<div class="empd-match-box empjob-card" data-i="' + i + '">' +
          '<div class="empd-flow" style="justify-content:space-between"><h3 style="margin:0">' + esc(p.title) + (p.city ? ' <span class="emp-tag">📍 ' + esc(p.city) + "</span>" : "") + '</h3>' +
          '<span class="emp-tag">' + esc(p.status || "") + "</span></div>" +
          (p.description ? '<p class="emp-note">' + nl2br(p.description).slice(0, 400) + "</p>" : "") +
          '<button class="btn btn-primary btn-sm empjob-screen" data-i="' + i + '">🤖 ' + T("Screen candidates with AI", "افحص المرشّحين بالذكاء") + "</button>" +
          '<p class="emp-note" id="empjob-status-' + i + '"></p>' +
          '<div class="emp-grid" id="empjob-grid-' + i + '"></div>' +
          "</div>";
      }).join("");
      list.querySelectorAll(".empjob-screen").forEach(function (b) {
        b.addEventListener("click", function () { screenPosting(Number(b.getAttribute("data-i"))); });
      });
    }
    function screenPosting(i) {
      var p = POSTINGS[i];
      if (!p) return;
      var st = document.getElementById("empjob-status-" + i), grid = document.getElementById("empjob-grid-" + i);
      if (!UNLOCKED || planRank() < 2) { st.textContent = T("Upgrade to Professional to use AI screening.", "رقِّ باقتك إلى «احترافية» لتفعيل الفحص الذكي."); return; }
      if (!CANDS.length) { st.textContent = T("Loading candidates… try again in a moment.", "يتم تحميل المرشّحين… حاول بعد لحظات."); load(); return; }
      var role = [p.title, p.field, p.city].filter(Boolean).join(" — ") + "\n" + (p.description || "");
      st.textContent = "✨ " + T("AI is screening your best-fit candidates…", "الذكاء يفحص أنسب المرشّحين…"); grid.innerHTML = "";
      var pool = p.field ? CANDS.filter(function (c) { return c.field === p.field; }) : CANDS;
      if (!pool.length) pool = CANDS;
      fetch("/api/hire", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "match", postingId: p.id, role: role, candidates: pool.map(function (c) { return { id: c.id, role: c.role, field: c.field, city: c.city, experience: c.experience, education: c.education, nationalityType: c.nationalityType, skills: c.skills }; }) }) })
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          var d = res.d;
          if (res.s >= 400 || !d || !d.ok) { st.textContent = T("Screening failed — please try again in a moment.", "تعذّر الفحص — حاول مرة أخرى بعد قليل."); return; }
          if (!d.ranked || !d.ranked.length) { st.textContent = T("No strong matches for this posting yet.", "لا يوجد مطابقات قوية لهذه الوظيفة حالياً."); return; }
          var byId = {}; pool.forEach(function (c) { byId[c.id] = c; });
          var items = d.ranked.map(function (m) { var c = byId[m.id]; return c ? { c: c, m: m } : null; }).filter(Boolean);
          st.textContent = "✨ " + items.length + " " + T("matched candidates (best first)", "مرشّح مطابق (الأفضل أولاً)");
          grid.innerHTML = items.map(function (x) { return card(x.c, { match: x.m }); }).join("");
          bindCard(grid);
        })
        .catch(function () { st.textContent = T("Network error. Try again.", "خطأ في الاتصال. حاول مجدداً."); });
    }
    var publishBtn = document.getElementById("empjob-publish");
    if (publishBtn) {
      publishBtn.addEventListener("click", function () {
        var pstatus = document.getElementById("empjob-status");
        var title = (titleEl.value || "").trim();
        var city = (cityEl.value || "").trim();
        var field = (document.getElementById("empjob-field").value || "").trim();
        var description = (document.getElementById("empjob-desc").value || "").trim();
        if (!title || !description) { pstatus.textContent = T("Enter a job title and description.", "أدخل المسمى الوظيفي والوصف."); return; }
        if (!CODE || DEMO) { pstatus.textContent = T("Subscribe with a real access code to publish jobs.", "اشترك برمز حقيقي لنشر الوظائف."); return; }
        publishBtn.disabled = true;
        fetch("/api/candidates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create-posting", code: CODE, title: title, city: city, field: field, description: description }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            publishBtn.disabled = false;
            if (!d || !d.ok) { pstatus.textContent = T("Couldn't publish — try again.", "تعذّر النشر — حاول مجدداً."); return; }
            pstatus.textContent = "✅ " + T("Job posting published.", "تم نشر الوظيفة.");
            titleEl.value = ""; cityEl.value = ""; document.getElementById("empjob-field").value = ""; document.getElementById("empjob-desc").value = "";
            loadPostings();
          })
          .catch(function () { publishBtn.disabled = false; pstatus.textContent = T("Network error. Try again.", "خطأ في الاتصال. حاول مجدداً."); });
      });
    }

    // ---- Per-candidate AI + modal ----
    var modal = document.getElementById("empd-modal");
    var TITLES = { summary: T("AI assessment", "تقييم ذكي"), interview: T("Interview questions", "أسئلة مقابلة"), outreach: T("Outreach message", "رسالة تواصل") };
    function openModal(title, html) { document.getElementById("empd-modal-title").textContent = title; document.getElementById("empd-modal-body").innerHTML = html; modal.hidden = false; }
    function closeModal() { modal.hidden = true; }
    document.getElementById("empd-modal-x").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    function aiAction(task, id) {
      var c = findC(id); if (!c) return;
      openModal(TITLES[task] || "AI", '<p class="empd-empty">✨ ' + T("Thinking…", "جارٍ التفكير…") + "</p>");
      if (!UNLOCKED) { document.getElementById("empd-modal-body").innerHTML = "<p>" + T("Subscribe to unlock AI tools (assessment, interview questions, outreach).", "اشترك لفتح أدوات الذكاء (تقييم، أسئلة مقابلة، رسائل تواصل).") + "</p>"; return; }
      if ((task === "summary" && planRank() < 2) || ((task === "interview" || task === "outreach") && planRank() < 3)) { document.getElementById("empd-modal-body").innerHTML = "<p>" + T("This tool needs a higher plan.", "هذه الأداة تحتاج باقة أعلى (احترافية/مؤسسية).") + "</p>"; return; }
      if (DEMO) { demoAIAction(task, c); return; }
      fetch("/api/hire", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: task, candidate: c, role: lastJD }) })
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          if (res.s === 503) { document.getElementById("empd-modal-body").innerHTML = "<p>" + T("AI isn't enabled yet.", "الذكاء غير مفعّل بعد.") + "</p>"; return; }
          var d = res.d;
          if (!d || !d.ok || !d.result) { document.getElementById("empd-modal-body").innerHTML = "<p>" + T("Couldn't generate. Try again.", "تعذّر التوليد. حاول مجدداً.") + "</p>"; return; }
          var html = "<div class='empd-ai-out'>" + nl2br(d.result) + "</div>";
          if (task === "outreach" && c.phone) { var wa = c.phone.replace(/[^\d]/g, ""); html += '<a class="btn btn-wa" style="margin-top:12px" target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + encodeURIComponent(d.result) + '">' + T("Send on WhatsApp", "أرسل عبر واتساب") + "</a>"; }
          document.getElementById("empd-modal-body").innerHTML = html;
        })
        .catch(function () { document.getElementById("empd-modal-body").innerHTML = "<p>" + T("Network error.", "خطأ في الاتصال.") + "</p>"; });
    }
  });
})();

/* ---------- Dedicated candidate profile page (/candidate-profile) ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var app = document.getElementById("cp-app");
    if (!app) return;
    var isAr = (document.documentElement.lang || "en").toLowerCase().indexOf("ar") === 0;
    function T(en, ar) { return isAr ? ar : en; }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function cvDownloadUrl(url) {
      var m = /docs\.google\.com\/document\/d\/([^/]+)/.exec(url || "");
      return m ? ("https://docs.google.com/document/d/" + m[1] + "/export?format=pdf") : url;
    }
    function mdToHtml(md) {
      var lines = String(md || "").replace(/\r/g, "").split("\n");
      var html = "", inList = false;
      function closeList() { if (inList) { html += "</ul>"; inList = false; } }
      function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
      lines.forEach(function (line) {
        var t = line.trim();
        if (!t) { closeList(); return; }
        var h = /^(#{1,3})\s+(.*)/.exec(t);
        if (h) { closeList(); html += "<h" + (h[1].length + 2) + ">" + inline(h[2]) + "</h" + (h[1].length + 2) + ">"; return; }
        var li = /^[-*]\s+(.*)/.exec(t);
        if (li) { if (!inList) { html += "<ul>"; inList = true; } html += "<li>" + inline(li[1]) + "</li>"; return; }
        closeList();
        html += "<p>" + inline(t) + "</p>";
      });
      closeList();
      return html;
    }
    function readLS(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
    function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

    var params = new URLSearchParams(location.search);
    var id = params.get("id");
    var CODE = params.get("code") || (function () { try { return localStorage.getItem("bp_emp_code") || ""; } catch (e) { return ""; } })();
    var status = document.getElementById("cp-status");
    if (!id) { status.textContent = T("No candidate specified.", "لم يتم تحديد مرشّح."); return; }

    var STAGES = [
      ["new", T("New", "مرشّح جديد")], ["screening", T("Screening", "الفرز")], ["interview", T("Interview", "المقابلة")],
      ["offer", T("Offer", "العرض الوظيفي")], ["hired", T("Hired", "تم التوظيف")],
    ];
    var REJECTED = ["rejected", T("Rejected", "مرفوض")];

    fetch("/api/candidates?id=" + encodeURIComponent(id) + (CODE ? "&code=" + encodeURIComponent(CODE) : ""))
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) {
        if (res.s === 404) { app.innerHTML = "<p class='emp-note' style='text-align:center;padding:60px 0'>" + T("Candidate not found.", "المرشّح غير موجود.") + "</p>"; return; }
        if (!res.d || !res.d.ok) { app.innerHTML = "<p class='emp-note' style='text-align:center;padding:60px 0'>" + T("Couldn't load this profile. Try again.", "تعذّر تحميل الملف. حاول مجدداً.") + "</p>"; return; }
        render(res.d.candidate, res.d.unlocked);
      })
      .catch(function () { app.innerHTML = "<p class='emp-note' style='text-align:center;padding:60px 0'>" + T("Network error.", "خطأ في الاتصال.") + "</p>"; });

    function badge(label) { return label ? '<span class="cp-badge">' + esc(label) + "</span>" : ""; }

    function render(c, unlocked) {
      var pipe = readLS("bp_pipeline", {});
      var short = readLS("bp_shortlist", []);
      var inShort = short.some(function (x) { return x.id === c.id; });

      var badges = [
        c.field, [c.city, c.country].filter(Boolean).join(", "), c.nationalityType,
        c.experience ? (c.experience + (isAr ? " سنة خبرة" : "y experience")) : "", c.education, c.availability, c.saudization,
      ].filter(Boolean).map(badge).join("");

      var skillsHtml = "";
      if (c.skills) {
        skillsHtml = '<div class="cp-section"><h3>' + T("Skills", "المهارات") + '</h3><div class="cp-skills">' +
          c.skills.split(/[,،]/).map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) { return '<span class="cp-skill-tag">' + esc(s) + "</span>"; }).join("") +
          "</div></div>";
      }

      var contactHtml = "";
      if (unlocked && (c.phone || c.email)) {
        contactHtml = '<div class="cp-section"><h3>' + T("Contact", "التواصل") + '</h3><div class="cp-contact-row">' +
          (c.phone ? '<a class="btn btn-ghost btn-sm" href="tel:' + esc(c.phone) + '">📞 ' + esc(c.phone) + "</a>" : "") +
          (c.email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(c.email) + '">✉️ ' + esc(c.email) + "</a>" : "") +
          "</div></div>";
      }

      var cvHtml = "";
      if (unlocked && c.cvText) {
        // السيرة تُعرض كبطاقات مرتبة حسب الأقسام (تواصل/ملخص/مهارات/خبرات/
        // تعليم/شهادات/لغات) بدل عمود نصي طويل — الأقسام الطويلة تأخذ عرض
        // الصفحة كاملاً والقصيرة تتراص جنباً إلى جنب.
        var sections = [];
        var cur = null;
        c.cvText.split("\n").forEach(function (line) {
          var m = line.match(/^##\s+(.+)/);
          if (m) { cur = { title: m[1].trim(), body: [] }; sections.push(cur); }
          else if (cur) cur.body.push(line);
          else { cur = { title: "", body: [line] }; sections.push(cur); }
        });
        var WIDE = /خبر|Experience|Work|ملخص|Summary|نبذة/i;
        var CHIPY = /مهار|Skills|لغات|Languages|شهاد|Certific/i;
        var ICONS = [[/تواصل|Contact/i, "📞"], [/ملخص|Summary|نبذة/i, "📋"], [/شخصية|Personal/i, "🪪"], [/مهار|Skills/i, "🛠️"], [/خبر|Experience|Work|Highlights/i, "💼"], [/تعليم|Education/i, "🎓"], [/شهاد|Certific/i, "🏅"], [/لغات|Languages/i, "🌐"]];
        function secIcon(t) { for (var i = 0; i < ICONS.length; i++) if (ICONS[i][0].test(t)) return ICONS[i][1]; return "📄"; }
        var cards = sections.filter(function (sec) { return sec.body.join("").trim(); }).map(function (sec) {
          var bodyTxt = sec.body.join("\n").trim();
          var inner;
          if (CHIPY.test(sec.title)) {
            var items = sec.body.map(function (l) { return l.replace(/^[-•\d.\s]+/, "").trim(); }).filter(Boolean);
            inner = '<div class="cp-skills">' + items.map(function (it) { return '<span class="cp-skill-tag">' + esc(it) + "</span>"; }).join("") + "</div>";
          } else {
            inner = '<div class="cp-cv-text">' + mdToHtml(bodyTxt) + "</div>";
          }
          var wide = WIDE.test(sec.title) || bodyTxt.length > 600;
          return '<div class="cp-section" style="margin:0' + (wide ? ";grid-column:1/-1" : "") + '"><h3>' + secIcon(sec.title) + " " + esc(sec.title || T("Details", "تفاصيل")) + "</h3>" + inner + "</div>";
        }).join("");
        cvHtml = '<div class="cp-section" style="background:none;border:none;box-shadow:none;padding:0"><h3 style="margin-bottom:12px">' + T("Full CV", "السيرة الذاتية الكاملة") + '</h3>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;align-items:start">' + cards + "</div></div>";
      }
      var downloadHtml = "";
      if (unlocked && c.cv) {
        downloadHtml = '<a class="btn btn-primary btn-sm" href="' + esc(cvDownloadUrl(c.cv)) + '" target="_blank" rel="noopener" download>⬇️ ' +
          (c.cvKind === "ats" ? T("Download CV (ATS-formatted)", "تحميل السيرة الذاتية (منسّقة ATS)") : T("Download CV (original)", "تحميل السيرة الذاتية (الأصلية)")) + "</a>";
      }
      var lockedNote = !unlocked ? '<p class="emp-note" style="margin-top:10px">🔒 ' + T("Subscribe to view contact details and the full CV.", "اشترك لعرض بيانات التواصل والسيرة الذاتية كاملة.") + "</p>" : "";

      var stageLin = STAGES.map(function (s) { return '<button data-stage="' + s[0] + '" class="empd-stage-btn' + (pipe[c.id] === s[0] ? " on" : "") + '">' + esc(s[1]) + "</button>"; }).join("");
      var stageRej = '<button data-stage="' + REJECTED[0] + '" class="empd-stage-btn empd-stage-reject' + (pipe[c.id] === REJECTED[0] ? " on" : "") + '">✕ ' + esc(REJECTED[1]) + "</button>";

      app.innerHTML =
        '<div class="cp-header">' +
          '<h1 class="cp-name">' + esc(c.name || "—") + (c.nameAlt ? ' <span class="cp-name-alt">(' + esc(c.nameAlt) + ")</span>" : "") + "</h1>" +
          (c.role ? '<p class="cp-role">' + esc(c.role) + "</p>" : "") +
          '<div class="cp-badges">' + badges + "</div>" +
          lockedNote +
          '<div class="cp-actions"><button class="empd-save' + (inShort ? " on" : "") + '" id="cp-save">' + (inShort ? "★ " + T("Saved", "محفوظ") : "☆ " + T("Save to shortlist", "أضف للمفضّلة")) + "</button>" + downloadHtml + "</div>" +
          '<div class="empd-stages">' + stageLin + stageRej + "</div>" +
        "</div>" +
        skillsHtml + contactHtml + cvHtml;

      var saveBtn = document.getElementById("cp-save");
      saveBtn.addEventListener("click", function () {
        var list = readLS("bp_shortlist", []);
        var has = list.some(function (x) { return x.id === c.id; });
        if (has) list = list.filter(function (x) { return x.id !== c.id; }); else list.push(c);
        writeLS("bp_shortlist", list);
        saveBtn.classList.toggle("on", !has);
        saveBtn.innerHTML = has ? "☆ " + T("Save to shortlist", "أضف للمفضّلة") : "★ " + T("Saved", "محفوظ");
      });

      app.querySelectorAll(".empd-stage-btn").forEach(function (b) {
        b.addEventListener("click", function () {
          var st = b.getAttribute("data-stage");
          var pipeNow = readLS("bp_pipeline", {});
          if (pipeNow[c.id] === st) delete pipeNow[c.id]; else {
            pipeNow[c.id] = st;
            var listNow = readLS("bp_shortlist", []);
            if (!listNow.some(function (x) { return x.id === c.id; })) { listNow.push(c); writeLS("bp_shortlist", listNow); }
          }
          writeLS("bp_pipeline", pipeNow);
          app.querySelectorAll(".empd-stage-btn").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-stage") === pipeNow[c.id]); });
          if (pipeNow[c.id]) {
            fetch("/api/candidates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update-stage", code: CODE, id: c.id, stage: pipeNow[c.id] }) }).catch(function () {});
          }
        });
      });
    }
  });
})();

/* ---------- Auto-fill forms from the logged-in client profile ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var sess = null, users = {};
    try { sess = JSON.parse(localStorage.getItem("bp_session") || "null"); } catch (e) {}
    if (!sess || !sess.email) return;
    try { users = JSON.parse(localStorage.getItem("bp_users") || "{}"); } catch (e) {}
    var u = users[sess.email] || {};
    var company = {};
    try { company = JSON.parse(localStorage.getItem("bp_company") || "{}"); } catch (e) {}
    var profile = {
      name: sess.name || u.name || "",
      email: sess.email || "",
      phone: u.phone || "",
      company: company.name || "",
      cr: company.cr || "",
      city: company.city || ""
    };
    // Map profile keys → the field ids used across the booking / checkout /
    // workspace-request / employer-join forms.
    var map = {
      name: ["bk-name", "co-name", "wr-contact"],
      email: ["bk-email", "co-email", "wr-email", "ej-email"],
      phone: ["bk-phone", "co-phone", "wr-phone", "ej-phone"],
      company: ["ej-company"],
      cr: ["ej-cr"],
      city: ["wr-district"]
    };
    var filled = false;
    Object.keys(map).forEach(function (k) {
      if (!profile[k]) return;
      map[k].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && !el.value) { el.value = profile[k]; filled = true; }
      });
    });
    // Small hint so the client knows their data was prefilled from their account.
    if (filled) {
      var form = document.querySelector("#booking-form, #checkout-form, #ws-req, #emp-join");
      if (form && !document.getElementById("bp-prefill-note")) {
        var n = document.createElement("p");
        n.id = "bp-prefill-note";
        n.className = "emp-note";
        n.style.cssText = "margin:0 0 12px;color:var(--navy)";
        n.textContent = (document.documentElement.lang === "en")
          ? "✓ Prefilled from your account — edit if needed."
          : "✓ عُبّئت من حسابك — عدّلها إذا تبغى.";
        form.insertBefore(n, form.firstChild);
      }
    }
  });
})();

/* Saudi Guide sticky jump-nav: highlight the section in view. */
(function () {
  var nav = document.querySelector(".guide-nav");
  if (!nav) return;
  var links = Array.prototype.slice.call(nav.querySelectorAll("a[data-guide-link]"));
  if (!links.length) return;
  var byId = {};
  var sections = links.map(function (a) {
    var id = a.getAttribute("href").slice(1);
    byId[id] = a;
    return document.getElementById(id);
  }).filter(Boolean);
  if (!("IntersectionObserver" in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (l) { l.classList.remove("active"); });
      var a = byId[e.target.id];
      if (a) {
        a.classList.add("active");
        // keep the active pill in view on the horizontal bar
        a.scrollIntoView({ inline: "center", block: "nearest" });
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
  sections.forEach(function (s) { io.observe(s); });
})();

/* ---------- Live candidate-pool counter ---------- */
// Fills every [data-pool-count] element with the real, current size of the
// candidate pool. The API pages Notion under a time budget and hands back a
// cursor, so the number climbs live until the true total instead of showing
// a stale marketing figure.
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var els = document.querySelectorAll("[data-pool-count]");
    if (!els.length) return;
    var isAr = (document.documentElement.lang || "en").toLowerCase().indexOf("ar") === 0;
    var total = 0;
    function render(done) {
      var txt = total.toLocaleString("en-US") + " " + (isAr ? "مرشّح" : "candidates") + (done ? "" : "…");
      Array.prototype.forEach.call(els, function (el) { el.textContent = txt; });
    }
    function step(cursor) {
      fetch("/api/candidates?count=1" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok) return;
          total += d.total || 0;
          render(!d.nextCursor);
          if (d.nextCursor) step(d.nextCursor);
        }).catch(function () {});
    }
    step(null);
  });
})();


/* ---------- Suppliers control panel (owner only) ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var gate = document.getElementById("sa-gate");
    var app = document.getElementById("sa-app");
    if (!gate || !app) return;
    var T = function (en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; };
    function e4(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    // The owner key lives in sessionStorage only: it dies with the tab and is
    // never written into the page or localStorage.
    function key() { try { return sessionStorage.getItem("bp_sup_key") || ""; } catch (e) { return ""; } }
    function setKey(k) { try { k ? sessionStorage.setItem("bp_sup_key", k) : sessionStorage.removeItem("bp_sup_key"); } catch (e) {} }

    var data = { suppliers: [], orders: [] };
    var LIVE = ["أُرسل للمورّد", "قبله المورّد", "قيد التنفيذ"];

    function post(body, then) {
      fetch("/api/suppliers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.assign({ key: key() }, body)) })
        .then(function (r) { return r.json(); }).then(then).catch(function () { then({ ok: false, error: "network" }); });
    }

    function load(onFail) {
      fetch("/api/suppliers?action=admin&key=" + encodeURIComponent(key()), { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok) { setKey(""); gate.hidden = false; app.hidden = true; if (onFail) onFail(d && d.error); return; }
          data.suppliers = d.suppliers || []; data.orders = d.orders || [];
          gate.hidden = true; app.hidden = false;
          render();
        })
        .catch(function () { if (onFail) onFail("network"); });
    }

    function render() {
      var sup = data.suppliers, ord = data.orders;
      var set = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
      set("sa-n-sup", sup.length);
      set("sa-n-new", sup.filter(function (s) { return s.status === "جديد"; }).length);
      set("sa-n-quote", ord.filter(function (o) { return o.status === "عرض مُقدَّم"; }).length);
      set("sa-n-live", ord.filter(function (o) { return LIVE.indexOf(o.status) !== -1; }).length);
      set("sa-n-inv", ord.filter(function (o) { return o.supplierInvoiceStatus === "مرفوعة"; }).length);

      // category filter + supplier picker
      var cats = {};
      sup.forEach(function (s) { (s.categories || []).forEach(function (c) { cats[c] = 1; }); });
      var cf = document.getElementById("sa-cat-filter");
      if (cf && cf.options.length <= 1) {
        Object.keys(cats).sort().forEach(function (c) { var o = document.createElement("option"); o.value = c; o.textContent = c; cf.appendChild(o); });
      }
      renderPicker();

      var name = function (id) { var s = sup.filter(function (x) { return x.id === id; })[0]; return s ? s.name : "—"; };
      var ob = document.getElementById("sa-orders");
      if (ob) {
        ob.innerHTML = !ord.length ? '<p class="dash-empty">' + T("Nothing yet.", "لا يوجد بعد.") + "</p>" : ord.map(function (o) {
          var bits = [];
          if (o.quote != null) bits.push(T("Quoted", "العرض") + ": " + o.quote + " ﷼" + (o.leadTime ? " · " + o.leadTime : ""));
          if (o.amount != null) bits.push(T("Order value", "قيمة الأمر") + ": " + o.amount + " ﷼");
          if (o.commission != null) bits.push(T("Commission", "العمولة") + ": " + o.commission + " ﷼ (" + (o.commissionStatus || "—") + ")");
          var btns = "";
          if (o.status === "عرض مُقدَّم") btns += '<button class="btn btn-primary btn-sm sa-act" data-act="award" data-id="' + e4(o.id) + '">' + T("Award", "ترسية") + "</button> ";
          if (o.status === "تم التسليم") btns += '<button class="btn btn-primary btn-sm sa-act" data-act="approve-order" data-id="' + e4(o.id) + '">' + T("Approve delivery", "اعتماد التسليم") + "</button> ";
          if (o.supplierInvoiceStatus === "مرفوعة") btns += '<button class="btn btn-ghost btn-sm sa-act" data-act="inv-paid" data-id="' + e4(o.id) + '">' + T("Mark invoice paid", "إثبات سداد الفاتورة") + "</button> ";
          btns += '<button class="btn btn-ghost btn-sm sa-act" data-act="commission" data-id="' + e4(o.id) + '">' + T("Issue commission invoice", "أصدر فاتورة العمولة") + "</button> ";
          // Both directions, as accounting documents rather than Notion rows:
          // the purchase order is what we owe the supplier, the commission
          // invoice is what they owe us.
          if (o.amount != null) btns += '<button class="btn btn-ghost btn-sm sa-act" data-act="daftra-po" data-id="' + e4(o.id) + '">' + T("Purchase order in Daftra", "أمر شراء في الدفترة") + "</button> ";
          if (o.commission != null) btns += '<button class="btn btn-ghost btn-sm sa-act" data-act="daftra-commission" data-id="' + e4(o.id) + '">' + T("Commission invoice in Daftra", "فاتورة العمولة في الدفترة") + "</button>";
          return '<div class="dash-card" style="margin-bottom:10px">' +
            '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
              "<div><strong>" + e4(o.service || o.ref) + "</strong>" +
              '<br><span class="text-soft" style="font-size:.82rem">' + e4([o.ref, name(o.supplierId), o.client, o.city, o.due].filter(Boolean).join(" · ")) + "</span>" +
              (bits.length ? '<br><span class="text-soft" style="font-size:.82rem">' + e4(bits.join(" · ")) + "</span>" : "") + "</div>" +
              '<div style="text-align:end"><span class="pkg-tag">' + e4(o.status || "—") + "</span>" +
              '<br><span class="text-soft" style="font-size:.78rem">' + e4(T("Supplier invoice", "فاتورة المورّد") + ": " + (o.supplierInvoiceStatus || "—")) + "</span>" +
              (o.url ? '<br><a class="mini" href="' + e4(o.url) + '" target="_blank" rel="noopener">Notion ↗</a>' : "") + "</div>" +
            "</div><div style=\"margin-top:10px\">" + btns + "</div></div>";
        }).join("");
      }

      var sb = document.getElementById("sa-suppliers");
      if (sb) {
        sb.innerHTML = !sup.length ? '<p class="dash-empty">' + T("No suppliers yet.", "لا يوجد موردون بعد.") + "</p>" : sup.map(function (s) {
          var acts = "";
          if (s.status !== "معتمد") acts += '<button class="btn btn-primary btn-sm sa-act" data-act="approve" data-id="' + e4(s.id) + '">' + T("Approve", "اعتماد") + "</button> ";
          if (s.status === "معتمد") acts += '<button class="btn btn-ghost btn-sm sa-act" data-act="suspend" data-id="' + e4(s.id) + '">' + T("Suspend", "إيقاف") + "</button> ";
          return '<div class="dash-card" style="margin-bottom:10px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
            "<div><strong>" + e4(s.name) + "</strong>" +
            '<br><span class="text-soft" style="font-size:.82rem">' + e4([s.code, s.person, s.phone, s.email, s.city].filter(Boolean).join(" · ")) + "</span>" +
            '<br><span class="text-soft" style="font-size:.82rem">' + e4((s.categories || []).join("، ")) + "</span></div>" +
            '<div style="text-align:end"><span class="pkg-tag">' + e4(s.status || "—") + "</span><div style=\"margin-top:8px\">" + acts +
            (s.url ? '<a class="mini" href="' + e4(s.url) + '" target="_blank" rel="noopener">Notion ↗</a>' : "") + "</div></div></div>";
        }).join("");
      }
    }

    function renderPicker() {
      var box = document.getElementById("sa-sup-picker");
      if (!box) return;
      var cf = document.getElementById("sa-cat-filter");
      var filter = cf ? cf.value : "";
      var list = data.suppliers.filter(function (s) {
        return s.status === "معتمد" && (!filter || (s.categories || []).indexOf(filter) !== -1);
      });
      box.innerHTML = !list.length
        ? '<p class="text-soft" style="margin:0">' + T("No approved suppliers in this category yet.", "لا يوجد موردون معتمدون في هذا التصنيف بعد.") + "</p>"
        : list.map(function (s) {
            return '<label class="sa-pick"><input type="checkbox" value="' + e4(s.id) + '"> <span>' + e4(s.name) + '</span> <span class="text-soft" style="font-size:.78rem">' + e4((s.categories || []).join("، ")) + "</span></label>";
          }).join("");
    }
    var cfEl = document.getElementById("sa-cat-filter");
    if (cfEl) cfEl.addEventListener("change", renderPicker);

    var errEl = document.getElementById("sa-error");
    var keyForm = document.getElementById("sa-key-form");
    if (keyForm) keyForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (errEl) errEl.hidden = true;
      setKey((document.getElementById("sa-key").value || "").trim());
      load(function (err) {
        if (!errEl) return;
        errEl.textContent = err === "not_configured"
          ? T("Set PANEL_KEY (or LEADS_KEY) in Vercel first.", "اضبط PANEL_KEY أو LEADS_KEY في Vercel أولاً.")
          : T("Wrong key.", "المفتاح غير صحيح.");
        errEl.hidden = false;
      });
    });
    var rf = document.getElementById("sa-refresh");
    if (rf) rf.addEventListener("click", function () { load(); });
    if (key()) load();

    // RFQ broadcast
    var rfq = document.getElementById("sa-rfq-form");
    if (rfq) rfq.addEventListener("submit", function (e) {
      e.preventDefault();
      var picked = [].slice.call(document.querySelectorAll("#sa-sup-picker input:checked")).map(function (i) { return i.value; });
      var service = (document.getElementById("sa-service").value || "").trim();
      var box = document.getElementById("sa-rfq-sent");
      if (!service || !picked.length) {
        if (box) { box.textContent = T("Pick at least one supplier and name the service.", "اختر مورّداً واحداً على الأقل وحدّد الخدمة."); box.hidden = false; }
        return;
      }
      var btn = rfq.querySelector("button[type=submit]"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = T("Sending…", "جارٍ الإرسال…");
      post({
        type: "rfq", supplierIds: picked, service: service,
        client: (document.getElementById("sa-client").value || "").trim(),
        clientRef: (document.getElementById("sa-clientref").value || "").trim(),
        city: (document.getElementById("sa-city").value || "").trim(),
        due: document.getElementById("sa-due").value,
        details: (document.getElementById("sa-details").value || "").trim(),
      }, function (d) {
        btn.disabled = false; btn.textContent = lbl;
        if (box) {
          box.textContent = d && d.ok
            ? "✅ " + T("Sent to", "أُرسل إلى") + " " + d.sent + " " + T("suppliers", "مورّدين") + " — " + d.ref
            : T("Could not send — try again.", "تعذّر الإرسال — حاول مرة أخرى.");
          box.hidden = false;
        }
        if (d && d.ok) { rfq.reset(); load(); }
      });
    });

    // Row actions
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".sa-act");
      if (!b) return;
      var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
      b.disabled = true;
      var done = function (d) { b.disabled = false; if (d && d.ok) load(); else alert(T("Action failed.", "تعذّر تنفيذ الإجراء.")); };
      if (act === "approve") post({ type: "approve", supplierId: id, status: "معتمد" }, done);
      else if (act === "suspend") post({ type: "approve", supplierId: id, status: "موقوف" }, done);
      else if (act === "approve-order") post({ type: "order-admin", orderId: id, status: "معتمد" }, done);
      else if (act === "inv-paid") post({ type: "order-admin", orderId: id, supplierInvoiceStatus: "مدفوعة" }, done);
      else if (act === "award") {
        var v = prompt(T("Awarded value (SAR) — leave empty to use the quoted price:", "القيمة المعتمدة (ريال) — اتركها فارغة لاعتماد سعر العرض:"));
        if (v === null) { b.disabled = false; return; }
        post({ type: "award", orderId: id, amount: v === "" ? undefined : v }, done);
      } else if (act === "commission") {
        var c = prompt(T("Commission amount to invoice this supplier (SAR):", "مبلغ العمولة المراد فوترته على المورّد (ريال):"));
        if (c === null || c === "") { b.disabled = false; return; }
        post({ type: "invoice", orderId: id, amount: c }, done);
      } else if (act === "daftra-po" || act === "daftra-commission") {
        var isPo = act === "daftra-po";
        var a = prompt(isPo
          ? T("Purchase order value (SAR) — leave empty to use the order value:", "قيمة أمر الشراء (ريال) — اتركها فارغة لاستخدام قيمة أمر العمل:")
          : T("Commission amount (SAR) — leave empty to use the recorded commission:", "مبلغ العمولة (ريال) — اتركه فارغاً لاستخدام العمولة المسجّلة:"));
        if (a === null) { b.disabled = false; return; }
        post({ type: act, orderId: id, amount: a === "" ? undefined : a }, function (d) {
          b.disabled = false;
          if (d && d.ok) {
            alert((isPo ? T("Purchase order ", "صدر أمر الشراء ") : T("Commission invoice ", "صدرت فاتورة العمولة ")) + d.number +
              " — " + d.total + " ﷼" + (d.emailed ? T(" · sent to the supplier", " · وصلت للمورّد") : ""));
            load();
          } else {
            // The reason matters here: a missing tax rate or an unknown
            // supplier is fixed in Daftra, not by retrying.
            alert(T("Couldn't issue it: ", "تعذّر الإصدار: ") + ((d && d.error) || "?") + ((d && d.detail) ? " — " + d.detail : ""));
          }
        });
      } else b.disabled = false;
    });
  });
})();
