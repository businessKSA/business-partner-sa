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
})();

/* ---------- Cart (localStorage) ---------- */
(function () {
  "use strict";
  var KEY = "bp_cart";
  var VAT = 0.15;

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
    return {
      id: btn.getAttribute("data-id"),
      nameEn: btn.getAttribute("data-name-en") || "",
      nameAr: btn.getAttribute("data-name-ar") || "",
      amount: a ? Number(a) : null,
      price: btn.getAttribute("data-price") || "",
      kind: btn.getAttribute("data-kind") || "service",
      qty: 1,
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
        var priceTxt = i.amount ? BP.money(i.amount) : (i.price || BP.t("Quoted on review", "يُسعّر عند المراجعة"));
        return '<div class="cart-item">' +
          '<div class="ci-main"><strong>' + esc(name(i)) + '</strong><span class="ci-kind">' + kindLabel(i.kind) + '</span></div>' +
          '<div class="ci-qty"><button type="button" class="ci-dec" data-i="' + idx + '">−</button><span>' + (i.qty || 1) + '</span><button type="button" class="ci-inc" data-i="' + idx + '">+</button></div>' +
          '<div class="ci-price">' + esc(priceTxt) + '</div>' +
          '<button type="button" class="ci-del" data-i="' + idx + '" aria-label="remove">✕</button>' +
          '</div>';
      }).join("");
    }
    renderTotals("cart-subtotal", "cart-vat", "cart-total");
  }

  function kindLabel(k) {
    var m = { service: ["Service", "خدمة"], package: ["Package", "باقة"], agent: ["AI agent", "وكيل ذكي"], employee: ["AI employee", "موظف ذكي"], misa: ["Investor track", "مسار مستثمر"] };
    var p = m[k] || m.service;
    return BP.t(p[0], p[1]);
  }

  function renderTotals(subId, vatId, totId) {
    var sub = subtotal(), vat = sub * VAT, tot = sub + vat;
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
      var priceTxt = i.amount ? BP.money(i.amount * (i.qty || 1)) : (i.price || BP.t("Quoted", "تُسعّر"));
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
  ];

  var SA_CITIES = [
    "Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar", "Dhahran", "Taif", "Buraidah",
    "Tabuk", "Hail", "Hafr Al-Batin", "Jubail", "Yanbu", "Abha", "Khamis Mushait", "Najran",
    "Jazan", "Al Ahsa", "Qatif", "Sakaka", "Arar", "Al Bahah", "Al Kharj", "Unaizah", "Rabigh",
  ];
  var SA_CITIES_AR = [
    "الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "الظهران", "الطائف", "بريدة",
    "تبوك", "حائل", "حفر الباطن", "الجبيل", "ينبع", "أبها", "خميس مشيط", "نجران",
    "جازان", "الأحساء", "القطيف", "سكاكا", "عرعر", "الباحة", "الخرج", "عنيزة", "رابغ",
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
    function filtered() {
      var q = input.value.trim().toLowerCase();
      var all = getOptions();
      if (!q) return all.slice(0, 8);
      return all.filter(function (o) { return o.toLowerCase().indexOf(q) !== -1; }).slice(0, 8);
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
        if (!jobs.length) { status.textContent = BP.t("No employer-posted jobs right now — check back soon.", "لا توجد وظائف من أصحاب العمل حالياً — تابع لاحقاً."); return; }
        status.hidden = true;
        grid.innerHTML = jobs.map(function (j) {
          var tag = [j.company, j.city].filter(Boolean).join(" · ") || (j.field || "");
          return '<article class="card ats-job-card"><span class="emp-tag">' + esc2(tag) + '</span><h3>' + esc2(j.title) + '</h3><p>' + esc2(j.description || "") + '</p>' +
            '<div class="talent-actions"><a class="btn btn-primary btn-sm ats-apply-link" href="#seeker-form" data-job-id="' + esc2(j.id) + '" data-job-title="' + esc2(j.title) + '">' + BP.t("Apply", "تقديم") + "</a></div></article>";
        }).join("");
      })
      .catch(function () { status.textContent = BP.t("Couldn't load employer jobs.", "تعذّر تحميل وظائف أصحاب العمل."); });
  }
  function esc2(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  document.addEventListener("DOMContentLoaded", function () {
    loadClientJobs();
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
        var hasCv = cvEl && cvEl.files && cvEl.files.length;
        var waTxt = encodeURIComponent("تقديم مرشّح " + (ref || "") + "\nالاسم: " + name + "\nالجوال: " + phone + (hasCv ? "\n(أرفق السيرة الذاتية هنا)" : ""));
        box.hidden = false;
        box.innerHTML = "✅ <strong>" + BP.t("You're in the candidate pool", "تم إضافتك لقاعدة المرشّحين") + (ref ? " — " + ref : "") + "</strong><br>" +
          BP.t("We'll reach out when a suitable role opens.", "سنتواصل معك عند توفّر فرصة مناسبة.") +
          (hasCv ? "<br>" + BP.t("Send your CV file to us on WhatsApp to attach it to your profile:", "أرسل ملف سيرتك عبر واتساب لإرفاقه بملفك:") +
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
    // Name + email come from the signed-in account, not free typing, so the
    // order is always traceable to a real registration.
    var session = checkoutSession();
    if (session) {
      var nameEl = document.getElementById("co-name"), emailEl = document.getElementById("co-email");
      if (nameEl) { nameEl.value = session.name || ""; nameEl.readOnly = true; }
      if (emailEl) { emailEl.value = session.email || ""; emailEl.readOnly = true; }
    }
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
      var receipt = document.getElementById("co-receipt");
      var receiptFile = receipt && receipt.files && receipt.files.length ? receipt.files[0] : null;
      var isPdf = receiptFile && (receiptFile.type === "application/pdf" || /\.pdf$/i.test(receiptFile.name || ""));
      if (!receiptFile) { alert(BP.t("A bank transfer receipt (PDF) is required to submit your order.", "إيصال التحويل البنكي (PDF) إلزامي لإرسال الطلب.")); return; }
      if (!isPdf) { alert(BP.t("The receipt must be a PDF file matching your order total.", "يجب أن يكون الإيصال ملف PDF ويطابق إجمالي طلبك.")); return; }
      var ref = "BP-" + Date.now().toString().slice(-6);
      var docs = document.getElementById("co-docs");
      var files = [];
      [docs, receipt].forEach(function (inp) { if (inp && inp.files) for (var i = 0; i < inp.files.length; i++) files.push(inp.files[i].name); });
      var total = cart.reduce(function (s, i) { return s + (i.amount ? i.amount * (i.qty || 1) : 0); }, 0) || 0;
      var order = {
        ref: ref, name: name, phone: phone, email: email,
        items: cart.map(function (i) { return { name: BP.cartName(i), qty: i.qty || 1, price: i.amount ? i.amount * (i.qty || 1) : null, priceLabel: i.price }; }),
        files: files, receipt: receiptFile.name,
        at: new Date().toISOString().slice(0, 10), status: BP.t("Under review", "قيد المراجعة"),
      };
      try {
        var orders = JSON.parse(localStorage.getItem("bp_orders") || "[]");
        orders.unshift(order);
        localStorage.setItem("bp_orders", JSON.stringify(orders));
      } catch (err) {}
      // Register the order with the team + CRM (best-effort; never blocks the client) and
      // upload the receipt PDF so the n8n verification agent can check it matches the total.
      var employeeSlugs = cart.filter(function (i) { return i.kind === "employee" && (i.id || "").indexOf("employee-") === 0; })
        .map(function (i) { return i.id.slice("employee-".length); });
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
              total: total,
              agents: employeeSlugs,
              compliance: boughtCompliance,
              employerPlan: employerPlanKey, employerBilling: employerBilling,
              company: companyProfile.name || "",
              receiptName: receiptFile.name, receiptBase64: receiptBase64 || ""
            })
          }).catch(function () {});
        } catch (e) {}
      }
      var reader = new FileReader();
      reader.onload = function () { sendOrder(String(reader.result || "").split(",").pop()); };
      reader.onerror = function () { sendOrder(""); };
      reader.readAsDataURL(receiptFile);
      // Build WhatsApp notification
      var lines = ["*طلب جديد / New order* " + ref, "الاسم: " + name, "الجوال: " + phone];
      order.items.forEach(function (it) { lines.push("• " + it.name + " ×" + it.qty + (it.price ? " — " + it.price + " ﷼" : "")); });
      var waUrl = "https://wa.me/966507034157?text=" + encodeURIComponent(lines.join("\n"));
      // Clear cart
      var boughtEmployee = employeeSlugs.length > 0;
      BP.cart.write([]);
      var box = document.getElementById("checkout-success");
      box.hidden = false;
      box.innerHTML = "✅ <strong>" + BP.t("Order received", "تم استلام طلبك") + " — " + ref + "</strong><br>" +
        BP.t("Your receipt is being verified against your order total. We'll confirm on WhatsApp.", "يجري التحقق من إيصالك مقابل إجمالي طلبك. سنؤكد لك عبر واتساب.") +
        (boughtCompliance ? "<br>" + BP.t("Once confirmed, we'll email you an activation code for the Compliance Agent portal.", "بعد التأكيد سنرسل لك بريداً فيه رمز الدخول لبوابة وكيل الامتثال.") +
          '<br><a class="btn btn-primary" style="margin-top:12px" href="https://businesspartner.sa/ar/portal" target="_blank" rel="noopener">' + BP.t("Open the Compliance Agent portal", "افتح بوابة وكيل الامتثال") + "</a>" : "") +
        (employerPlanKey ? "<br>" + BP.t("Once confirmed, we'll email you an access code for the employer dashboard.", "بعد التأكيد سنرسل لك بريداً فيه رمز الوصول للوحة التوظيف.") +
          '<br><a class="btn btn-primary" style="margin-top:12px" href="/employer-dashboard">' + BP.t("Open the employer dashboard", "افتح لوحة التوظيف") + "</a>" : "") +
        (boughtEmployee ? "<br>" + BP.t("Once we confirm your payment, use this order number as your activation code in the smart employees portal.", "بمجرد ما نتأكد من الدفع، استخدم رقم الطلب هذا كـ كود تفعيل في بوابة الموظفين الأذكياء.") +
          '<br><a class="btn btn-primary" style="margin-top:12px" href="/portal">' + BP.t("Open the smart employees portal", "افتح بوابة الموظفين الأذكياء") + "</a>" : "") +
        '<br><a class="btn btn-wa" style="margin-top:12px" href="' + waUrl + '" target="_blank" rel="noopener">' + BP.t("Notify us on WhatsApp", "أشعرنا عبر واتساب") + "</a> " +
        '<a class="btn btn-ghost" style="margin-top:12px" href="/account">' + BP.t("View in my account", "عرض في حسابي") + "</a>";
      box.scrollIntoView({ behavior: "smooth", block: "center" });
      form.querySelector("button[type=submit]").disabled = true;
      BP.renderCheckout();
    });
  });
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

    function render() {
      var s = session();
      if (s) {
        auth.hidden = true; dash.hidden = false;
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
      var orders = ordersData();
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

    if (loginF) loginF.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("lg-email").value.trim().toLowerCase();
      var pass = document.getElementById("lg-pass").value;
      var u = users()[email];
      if (!u || u.pass !== pass) { alert(BP.t("No matching account. Try registering.", "لا يوجد حساب مطابق. جرّب إنشاء حساب جديد.")); return; }
      try { localStorage.setItem("bp_session", JSON.stringify({ email: email, name: u.name })); } catch (er) {}
      render();
    });

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
          if (otpF) otpF.hidden = true;
          pending = null;
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
    if (out) out.addEventListener("click", function () { try { localStorage.removeItem("bp_session"); } catch (e) {} render(); });

    render();
    document.addEventListener("bp:langchange", function () { if (session()) render(); });
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

  function priceText(it) {
    if (it.ptype === "onrequest") return t("On request", "حسب الطلب");
    if (it.ptype === "monthly") return money(it.amount) + t(" / mo", " / شهرياً");
    if (it.ptype === "from") return t("From ", "من ") + money(it.amount);
    if (it.ptype === "percandidate") return money(it.amount) + t(" / candidate", " / لكل مرشّح");
    return money(it.amount);
  }

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
      row.innerHTML = '<span class="calc2-check">' + '</span><span class="calc2-iname">' + esc(nm(it)) + "</span>" +
        '<span class="calc2-iprice">' + esc(priceText(it)) + "</span>";
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

  function toggle(it, row) {
    if (selected[it.id]) { delete selected[it.id]; row.classList.remove("on"); }
    else { selected[it.id] = it; row.classList.add("on"); }
    render();
  }

  function render() {
    var wrap = document.getElementById("calc2-selected");
    var empty = document.getElementById("calc2-empty");
    var ids = Object.keys(selected);
    var once = 0, monthly = 0, hasReq = false;
    ids.forEach(function (id) {
      var it = selected[id];
      if (it.ptype === "onrequest") hasReq = true;
      else if (it.ptype === "monthly") monthly += it.amount || 0;
      else once += it.amount || 0;
    });
    if (!ids.length) {
      wrap.innerHTML = '<p class="calc2-empty" id="calc2-empty">' + t("No services selected yet. Tap a service to add it.", "لم تختر أي خدمة بعد. اضغط على أي خدمة لإضافتها.") + "</p>";
    } else {
      wrap.innerHTML = ids.map(function (id) {
        var it = selected[id];
        return '<div class="calc2-sel"><span>' + esc(nm(it)) + "</span><span class=\"calc2-selp\">" + esc(priceText(it)) +
          '</span><button type="button" class="calc2-rm" data-id="' + id + '" aria-label="remove">✕</button></div>';
      }).join("");
    }
    document.getElementById("calc2-once").textContent = money(once);
    document.getElementById("calc2-monthly").textContent = money(monthly);
    var vat = (once + monthly) * VAT;
    document.getElementById("calc2-vat").textContent = (once + monthly) ? money(vat) : "—";
    document.getElementById("calc2-warn").hidden = !hasReq;
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

  // "Request official quote" → push selected into the cart, go to checkout
  var quote = document.getElementById("calc2-quote");
  if (quote) quote.addEventListener("click", function (e) {
    var ids = Object.keys(selected);
    if (!ids.length || !window.BP || !BP.cart) return; // let default nav happen
    e.preventDefault();
    var cart = BP.cart.read();
    ids.forEach(function (id) {
      var it = selected[id];
      if (cart.some(function (c) { return c.id === it.id; })) return;
      cart.push({ id: it.id, nameEn: it.nameEn, nameAr: it.nameAr, amount: it.ptype === "onrequest" || it.ptype === "from" ? (it.ptype === "from" ? it.amount : null) : it.amount, price: priceText(it), kind: "service", qty: 1 });
    });
    BP.cart.write(cart);
    location.href = quote.getAttribute("href");
  });

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  render();
})();

/* المستشار — advisor chatbot client */
(function () {
  "use strict";
  var fab = document.getElementById("advisor-fab");
  var panel = document.getElementById("advisor-panel");
  if (!fab || !panel) return;
  var closeBtn = document.getElementById("advisor-close");
  var msgs = document.getElementById("advisor-msgs");
  var form = document.getElementById("advisor-form");
  var input = document.getElementById("advisor-input");
  var sendBtn = form.querySelector("button");
  var history = []; // {role, content}
  var busy = false;

  function open() { panel.hidden = false; fab.classList.add("hide"); setTimeout(function () { input.focus(); }, 50); }
  function close() { panel.hidden = true; fab.classList.remove("hide"); }
  fab.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  function addMsg(text, who) {
    var el = document.createElement("div");
    el.className = "advisor-msg " + who;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    addMsg(text, "me");
    history.push({ role: "user", content: text });
    busy = true; sendBtn.disabled = true;
    var typing = addMsg("يكتب…", "bot typing");

    fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        typing.remove();
        var reply = (data && data.reply) || "تعذّر الرد الآن. تواصل معنا على واتساب وبنساعدك فوراً.";
        addMsg(reply, "bot");
        history.push({ role: "assistant", content: reply });
      })
      .catch(function () {
        typing.remove();
        addMsg("المستشار يعمل على النسخة المنشورة من الموقع. تواصل معنا على واتساب وبنساعدك فوراً.", "bot");
      })
      .finally(function () { busy = false; sendBtn.disabled = false; input.focus(); });
  });
})();

/* ---------- Grouped nav dropdowns (Business Partner 3.0) ---------- */
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    var drop = e.target.closest(".nav-drop");
    var groups = document.querySelectorAll(".nav-group");
    if (drop) {
      var g = drop.closest(".nav-group");
      groups.forEach(function (x) { if (x !== g) x.classList.remove("open"); });
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

  function wire(formId, boxId, build, validate, waText) {
    var form = document.getElementById(formId);
    if (!form) return;
    var dateEl = form.querySelector('input[type="date"]');
    if (dateEl) {
      var n = new Date();
      dateEl.min = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
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
              "supplier": BP.t("Supplier registration", "تسجيل مورّد"),
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
        var box = document.getElementById(boxId);
        box.hidden = false;
        box.innerHTML = "✅ <strong>" + BP.t("Request received", "تم استلام طلبك") + " — " + ref + "</strong><br>" +
          (emailSent ? BP.t("A confirmation was sent to your email.", "أرسلنا التأكيد إلى بريدك.")
                     : BP.t("You can also notify us on WhatsApp.", "تقدر كذلك تشعرنا عبر واتساب.")) +
          ' <a class="btn btn-ghost" style="margin-top:12px" target="_blank" rel="noopener" href="https://wa.me/966507034157?text=' +
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
      function (d, ref) { return "طلب فعالية " + ref + "\nالشركة: " + d.company + "\nالنوع: " + d.eventType + "\nالتاريخ: " + d.date + "\nالأفراد: " + d.count; });

    wire("supplier-form", "supplier-success",
      function () {
        return { type: "supplier", company: val("sp-company"), person: val("sp-person"), phone: val("sp-phone"),
          email: val("sp-email"), city: val("sp-city"), cr: val("sp-cr"), category: selText("sp-cat"), notes: val("sp-notes") };
      },
      function (d) {
        if (!d.company || !d.person || !d.phone || !d.email)
          return BP.t("Please fill all required fields.", "الرجاء تعبئة كل الحقول المطلوبة.");
        return null;
      },
      function (d, ref) { return "تسجيل مورّد " + ref + "\nالشركة: " + d.company + "\nالتصنيف: " + d.category; });

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
      function (d, ref) { return "طلب سياحة أعمال " + ref + "\nالشركة: " + d.company + "\nالدولة: " + d.country + "\nعدد الوفد: " + d.count; });

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
  try { var c = (BP.cart && BP.cart.read()) || []; total = c.reduce(function (s, i) { return s + (i.amount ? i.amount * (i.qty || 1) : 0); }, 0) * 1.15; } catch (e2) {}

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
        } catch (e3) {}
      };
      document.head.appendChild(s);
    }).catch(function () {});
  }

  // back from 3-D Secure: ?id=<payment_id> → verify server-side
  var params = new URLSearchParams(location.search);
  var payId = params.get("id");
  if (payId) {
    fetch("/api/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: payId }) })
      .then(function (r) { return r.json(); })
      .then(function (v) {
        var ok = v && v.ok;
        var el = document.getElementById("checkout-success");
        if (el) {
          el.hidden = false;
          el.textContent = ok
            ? BP.t("Payment received ✓ — our team will start right away.", "تم استلام الدفعة ✓ — فريقنا يبدأ التنفيذ فوراً.")
            : BP.t("Payment not completed — you can retry or use bank transfer.", "لم تكتمل الدفعة — يمكنك المحاولة مجدداً أو استخدام التحويل البنكي.");
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (ok && BP.cart) BP.cart.write([]);
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
    return '<div class="emp-card">' +
      '<div class="emp-card-top"><strong>' + esc(c.name || "—") + "</strong>" + (c.field ? '<span class="emp-tag">' + esc(c.field) + "</span>" : "") + "</div>" +
      (c.role ? '<div class="emp-role">' + esc(c.role) + "</div>" : "") +
      (c.skills ? '<div class="emp-skills">' + esc(c.skills) + "</div>" : "") +
      '<div class="emp-meta">' + meta.join(" · ") + "</div>" +
      contact + "</div>";
  }

  function load() {
    var q = (document.getElementById("emp-q") || {}).value || "";
    var field = (document.getElementById("emp-field") || {}).value || "";
    var city = (document.getElementById("emp-city") || {}).value || "";
    var nat = (document.getElementById("emp-nat") || {}).value || "";
    var code = (document.getElementById("emp-code") || {}).value || "";
    status.textContent = T("Loading candidates…", "جارٍ تحميل المرشّحين…");
    grid.innerHTML = "";
    var qs = new URLSearchParams({ q: q, field: field, city: city, nat: nat, code: code }).toString();
    fetch("/api/candidates?" + qs).then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) {
        if (res.s === 503) { status.innerHTML = T("The candidate pool isn't connected yet — ", "لم تُربط قاعدة المرشّحين بعد — ") + '<a href="https://wa.me/966507034157">' + T("contact us to subscribe.", "تواصل معنا للاشتراك.") + "</a>"; return; }
        var d = res.d;
        if (!d || !d.ok || !d.candidates) { status.textContent = T("Couldn't load candidates. Try again.", "تعذّر تحميل المرشّحين. حاول مجدداً."); return; }
        if (!d.candidates.length) { status.textContent = T("No candidates match these filters.", "لا يوجد مرشّحون مطابقون لهذه الفلاتر."); return; }
        status.textContent = (d.unlocked ? T("Showing full profiles — ", "عرض الملفات الكاملة — ") : T("Showing anonymized profiles — subscribe to unlock contacts. ", "عرض ملفات مموّهة — اشترك لفتح بيانات التواصل. ")) + d.total + " " + T("candidates", "مرشّح");
        // populate filter selects (fields/cities) from results once
        var fs = document.getElementById("emp-field");
        if (fs && fs.options.length <= 1) {
          var fields = {}; d.candidates.forEach(function (c) { if (c.field) fields[c.field] = 1; });
          Object.keys(fields).forEach(function (f) { var o = document.createElement("option"); o.value = f; o.textContent = f; fs.appendChild(o); });
        }
        grid.innerHTML = d.candidates.map(card).join("");
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
      function done(ref) {
        btn.disabled = false; btn.textContent = lbl;
        var box = document.getElementById("tf-result");
        var waMsg = encodeURIComponent(T("New Task Force request", "مهمة Task Force جديدة") + " " + (ref || "") + "\n" + T("Company", "الشركة") + ": " + company + "\n" + T("Mobile", "الجوال") + ": " + phone);
        box.hidden = false;
        box.innerHTML = "✅ <strong>" + T("Task received", "تم استلام مهمتك") + (ref ? " — " + ref : "") + "</strong><br>" +
          T("Our team is reviewing the scope and will come back with the right execution track.", "فريقنا يراجع النطاق وسيعود إليك بمسار التنفيذ المناسب.") +
          '<a class="btn btn-wa btn-lg" style="margin-top:14px" target="_blank" rel="noopener" href="https://wa.me/' + WA + '?text=' + waMsg + '">' + T("Follow up on WhatsApp", "تابع عبر واتساب") + "</a>";
        box.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) { done(res.d && res.d.ref); })
        .catch(function () { done(null); });
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

    document.querySelectorAll(".deal-ticket-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var original = btn.textContent;
        btn.textContent = T("Awaiting their approval…", "بانتظار موافقتهم ⏳");
        btn.setAttribute("disabled", "true");
        setTimeout(function () { btn.textContent = original; btn.removeAttribute("disabled"); }, 2600);
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
    function setUnlocked(on) { UNLOCKED = on; var ub = document.getElementById("empd-unlock"); if (ub) ub.hidden = on; }
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
      fetch("/api/candidates?code=" + encodeURIComponent(code)).then(function (r) { return r.json(); })
        .then(function (d) { cb(!!(d && d.unlocked), d); }).catch(function () { cb(false, null); });
    }
    function enter(code, data) {
      CODE = code; DEMO = !!(data && data.demo) || isDemoCode(code); writeLS("bp_emp_code", code);
      PLAN = (data && data.plan) || "";
      setUnlocked(true);
      if (data && data.candidates) { CANDS = data.candidates; fillFilters(); renderBrowse(); } else load();
      renderCounts();
      var planTxt = PLAN ? (" — " + T("plan", "الباقة") + ": " + PLAN) : "";
      gateMsg.textContent = DEMO ? T("Demo mode — sample data.", "وضع تجربة — بيانات عيّنة.") : (T("Unlocked — contacts enabled.", "تم الفتح — بيانات التواصل مفعّلة.") + planTxt);
    }
    document.getElementById("empd-enter").addEventListener("click", function () {
      var code = (codeInput.value || "").trim(); if (!code) return;
      gateMsg.textContent = T("Checking…", "جارٍ التحقق…");
      validate(code, function (ok, data) { if (ok) enter(code, data); else gateMsg.textContent = T("Invalid or inactive code. Contact us to activate.", "رمز غير صحيح أو غير مفعّل. تواصل معنا للتفعيل."); });
    });
    codeInput.addEventListener("keydown", function (e) { if (e.key === "Enter") document.getElementById("empd-enter").click(); });
    var demoBtn = document.getElementById("empd-demo");
    if (demoBtn) demoBtn.addEventListener("click", function () { enter("BP-DEMO", { unlocked: true, demo: true, candidates: DEMO_CANDS }); });
    document.getElementById("empd-logout").addEventListener("click", function () { try { localStorage.removeItem("bp_emp_code"); } catch (e) {} location.reload(); });
    // Never silently auto-resume a demo session from a past visit — the demo
    // must always be an explicit, one-time click so a stale localStorage
    // value can't make a real subscriber's dashboard look empty/fake forever.
    var saved = readLS("bp_emp_code", "");
    if (typeof saved === "string" && saved && !isDemoCode(saved)) { validate(saved, function (ok, data) { if (ok) enter(saved, data); else { CODE = ""; setUnlocked(false); load(); renderCounts(); } }); }
    else { if (isDemoCode(saved)) writeLS("bp_emp_code", ""); CODE = ""; setUnlocked(false); load(); renderCounts(); }

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

    function fillFilters() {
      if (fillFilters.done) return; fillFilters.done = true;
      var fEl = document.getElementById("empd-field"), cEl = document.getElementById("empd-city");
      var fields = {}, cities = {};
      CANDS.forEach(function (c) { if (c.field) fields[c.field] = 1; if (c.city) cities[c.city] = 1; });
      Object.keys(fields).forEach(function (f) { var o = document.createElement("option"); o.value = f; o.textContent = f; fEl.appendChild(o); });
      Object.keys(cities).forEach(function (c) { var o = document.createElement("option"); o.value = c; o.textContent = c; cEl.appendChild(o); });
    }
    function load() {
      var status = document.getElementById("empd-status"); status.textContent = T("Loading candidates…", "جارٍ تحميل المرشّحين…");
      if (DEMO) { CANDS = DEMO_CANDS.slice(); status.textContent = CANDS.length + " " + T("candidates (demo)", "مرشّح (تجربة)"); renderBrowse(); return; }
      var qs = new URLSearchParams({ code: CODE });
      var q = document.getElementById("empd-q").value.trim(), f = document.getElementById("empd-field").value, ci = document.getElementById("empd-city").value, n = document.getElementById("empd-nat").value;
      if (q) qs.set("q", q); if (f) qs.set("field", f); if (ci) qs.set("city", ci); if (n) qs.set("nat", n);
      fetch("/api/candidates?" + qs).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.ok) { status.textContent = apiErr(d); return; }
        CANDS = d.candidates || []; if (!CANDS.length) { status.textContent = T("No candidates match.", "لا توجد نتائج مطابقة."); return; } fillFilters(); renderBrowse(); if (!UNLOCKED) status.textContent = CANDS.length + " " + T("candidates · subscribe to reveal contacts", "مرشّح · اشترك لكشف بيانات التواصل");
      }).catch(function () { status.textContent = T("Network error — please retry.", "خطأ في الاتصال — أعد المحاولة."); });
    }
    document.getElementById("empd-load").addEventListener("click", load);
    document.getElementById("empd-q").addEventListener("keydown", function (e) { if (e.key === "Enter") load(); });

    function contacts(c) {
      var out = [];
      if (c.name) {
        var nm = "<strong>" + esc(c.name) + "</strong>";
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
    function card(c, opts) {
      opts = opts || {};
      var meta = [c.experience ? (isAr ? c.experience + " سنة خبرة" : c.experience + "y exp") : "", c.education, c.nationalityType].filter(Boolean).join(" · ");
      var badge = opts.match ? '<div class="empd-score"><span class="empd-score-n">' + Math.round(opts.match.score) + '%</span> ' + esc(opts.match.reason || "") + "</div>" : "";
      return '<div class="emp-card" data-id="' + esc(c.id) + '">' + badge + '<div class="emp-card-top"><strong>' + esc(c.role || c.field || "—") + '</strong>' + (c.field ? '<span class="emp-tag">' + esc(c.field) + "</span>" : "") + "</div>" +
        (c.city ? '<div class="emp-role">📍 ' + esc(c.city) + "</div>" : "") +
        (c.skills ? '<div class="emp-skills">' + esc(c.skills) + "</div>" : "") +
        (meta ? '<div class="emp-meta">' + esc(meta) + "</div>" : "") +
        contacts(c) +
        '<div class="empd-actions"><button class="empd-save' + (inShort(c.id) ? " on" : "") + '" data-id="' + esc(c.id) + '">' + (inShort(c.id) ? "★ " + T("Saved", "محفوظ") : "☆ " + T("Shortlist", "حفظ")) + "</button>" +
        (opts.removeShort ? '<button class="empd-rm" data-id="' + esc(c.id) + '">' + T("Remove", "إزالة") + "</button>" : "") + "</div>" +
        aiBtns(c.id) + stageBtns(c.id) + "</div>";
    }
    function bindCard(scope) {
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
        })
        .catch(function () { list.innerHTML = '<p class="emp-note">' + T("Couldn't load your job postings.", "تعذّر تحميل وظائفك المنشورة.") + "</p>"; });
    }
    function renderPostings() {
      var list = document.getElementById("empjob-list");
      if (!POSTINGS.length) { list.innerHTML = '<p class="emp-note">' + T("No job postings yet — publish your first one above.", "لا يوجد وظائف منشورة بعد — انشر أول وظيفة أعلاه.") + "</p>"; return; }
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
      fetch("/api/hire", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "match", role: role, candidates: pool.map(function (c) { return { id: c.id, role: c.role, field: c.field, city: c.city, experience: c.experience, education: c.education, nationalityType: c.nationalityType, skills: c.skills }; }) }) })
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
