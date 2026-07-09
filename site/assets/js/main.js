/* Business Partner — site interactions (no framework) */
(function () {
  "use strict";

  // Mobile navigation toggle
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", nav.classList.contains("open"));
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

/* ---------- Careers: join candidate pool → /api/candidate (Notion) ---------- */
(function () {
  "use strict";
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("cv-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = val("c-name"), phone = val("c-phone");
      if (!name || !phone) { alert(BP.t("Please enter your name and mobile.", "الرجاء إدخال الاسم ورقم الجوال.")); return; }
      var consentEl = document.getElementById("c-consent");
      if (consentEl && !consentEl.checked) { alert(BP.t("Please tick the consent box to join the pool.", "الرجاء الموافقة على الانضمام لقاعدة المرشّحين.")); return; }
      var cvEl = document.getElementById("c-cv");
      var payload = {
        name: name, phone: phone, email: val("c-email"), field: val("c-field"),
        experience: val("c-exp"), city: val("c-city"), salary: val("c-salary"),
        linkedin: val("c-linkedin"), consent: consentEl ? consentEl.checked : false,
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

      fetch("/api/candidate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
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

/* ---------- Checkout submit ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("checkout-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var cart = BP.cart.read();
      if (!cart.length) { alert(BP.t("Your cart is empty.", "سلتك فارغة.")); location.href = "/services"; return; }
      var name = document.getElementById("co-name").value.trim();
      var phone = document.getElementById("co-phone").value.trim();
      var email = document.getElementById("co-email").value.trim();
      if (!name || !phone) { alert(BP.t("Please enter your name and mobile.", "الرجاء إدخال الاسم ورقم الجوال.")); return; }
      var receipt = document.getElementById("co-receipt");
      var ref = "BP-" + Date.now().toString().slice(-6);
      var docs = document.getElementById("co-docs");
      var files = [];
      [docs, receipt].forEach(function (inp) { if (inp && inp.files) for (var i = 0; i < inp.files.length; i++) files.push(inp.files[i].name); });
      var order = {
        ref: ref, name: name, phone: phone, email: email,
        items: cart.map(function (i) { return { name: BP.cartName(i), qty: i.qty || 1, price: i.amount ? i.amount * (i.qty || 1) : null, priceLabel: i.price }; }),
        files: files, receipt: receipt && receipt.files.length ? receipt.files[0].name : null,
        at: new Date().toISOString().slice(0, 10), status: BP.t("Under review", "قيد المراجعة"),
      };
      try {
        var orders = JSON.parse(localStorage.getItem("bp_orders") || "[]");
        orders.unshift(order);
        localStorage.setItem("bp_orders", JSON.stringify(orders));
      } catch (err) {}
      // Register the order with the team + CRM (best-effort; never blocks the client).
      var employeeSlugs = cart.filter(function (i) { return i.kind === "employee" && (i.id || "").indexOf("employee-") === 0; })
        .map(function (i) { return i.id.slice("employee-".length); });
      try {
        fetch("/api/requests", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "order", ref: ref, name: name, phone: phone, email: email,
            items: order.items.map(function (i) { return i.name + " ×" + (i.qty || 1); }),
            total: cart.reduce(function (s, i) { return s + (i.amount ? i.amount * (i.qty || 1) : 0); }, 0) || "",
            agents: employeeSlugs
          })
        }).catch(function () {});
      } catch (e) {}
      // Build WhatsApp notification
      var lines = ["*طلب جديد / New order* " + ref, "الاسم: " + name, "الجوال: " + phone];
      order.items.forEach(function (it) { lines.push("• " + it.name + " ×" + it.qty + (it.price ? " — " + it.price + " ﷼" : "")); });
      if (!receipt || !receipt.files.length) lines.push(BP.t("(Receipt to be sent)", "(سيُرسل الإيصال)"));
      var waUrl = "https://wa.me/966507034157?text=" + encodeURIComponent(lines.join("\n"));
      // Clear cart
      var boughtCompliance = cart.some(function (i) { return (i.id || "").indexOf("agent-Compliance") === 0; });
      var boughtEmployee = employeeSlugs.length > 0;
      BP.cart.write([]);
      var box = document.getElementById("checkout-success");
      box.hidden = false;
      box.innerHTML = "✅ <strong>" + BP.t("Order received", "تم استلام طلبك") + " — " + ref + "</strong><br>" +
        BP.t("Transfer the amount to the bank account, then send the receipt. We'll confirm on WhatsApp.", "حوّل المبلغ على الحساب البنكي ثم أرسل الإيصال. سنؤكد لك عبر واتساب.") +
        (boughtCompliance ? "<br>" + BP.t("Your compliance agent is ready — start it in the tools & calculators hub.", "وكيل الامتثال جاهز — ابدأ معه من مركز الأدوات والحاسبات.") +
          '<br><a class="btn btn-primary" style="margin-top:12px" href="/tools-and-calculators">' + BP.t("Open the compliance agent", "افتح وكيل الامتثال") + "</a>" : "") +
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
      return '<div class="ord"><div class="ord-main"><strong>' + esc2(o.ref) + '</strong>' +
        '<span class="text-soft"> · ' + esc2(o.at || "") + '</span>' +
        '<div class="text-soft ord-items">' + items + '</div></div>' +
        '<span class="ord-status ' + cls + '">' + esc2(o.status || BP.t("In review", "قيد المراجعة")) + '</span></div>';
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
    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var bill = btn.getAttribute("data-bill");
        BP_EMP_BILLING = bill;
        btns.forEach(function (b) { b.classList.toggle("active", b === btn); });
        document.querySelectorAll(".emp-price-m").forEach(function (el) { el.hidden = bill === "yearly"; });
        document.querySelectorAll(".emp-price-y").forEach(function (el) { el.hidden = bill === "monthly"; });
      });
    });
  });
})();

/* ---------- Employer subscription (/employer-join) → /api/employer ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("emp-join");
    if (!form) return;
    var T = function (en, ar) { return (window.BP && BP.t) ? BP.t(en, ar) : ar; };
    var WA = "966507034157";

    // Preselect plan from ?plan=
    try {
      var pre = new URLSearchParams(location.search).get("plan");
      if (pre) { var r = form.querySelector('input[name="emp-plan"][value="' + pre + '"]'); if (r) r.checked = true; }
    } catch (e) {}

    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
    function planInfo() {
      var sel = form.querySelector('input[name="emp-plan"]:checked');
      var key = sel ? sel.value : "";
      var list = window.BP_EMP_PLANS || [];
      for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
      return { key: key, name: key, price: null };
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var company = val("ej-company"), phone = val("ej-phone");
      if (!company) { alert(T("Please enter the company name.", "الرجاء إدخال اسم الشركة.")); return; }
      if (!/^(?:\+?966|0)?5\d{8}$/.test(phone.replace(/\s/g, ""))) { alert(T("Please enter a valid Saudi mobile (05XXXXXXXX).", "الرجاء إدخال جوال سعودي صحيح (05XXXXXXXX).")); return; }
      var plan = planInfo();
      var billing = BP_EMP_BILLING || "monthly";
      var payload = { company: company, cr: val("ej-cr"), contact: val("ej-contact"), phone: phone, email: val("ej-email"), notes: val("ej-notes"), plan: plan.key, billing: billing };

      var btn = document.getElementById("ej-submit"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = T("Sending…", "جارٍ الإرسال…");

      function done(ref) {
        btn.disabled = false; btn.textContent = lbl;
        var box = document.getElementById("ej-result");
        var bank = window.BP_BANK || {};
        var planPrice = billing === "yearly" ? plan.yearlyPrice : plan.price;
        var priceLabel = planPrice != null ? (planPrice + " " + T("SAR", "ريال") + " / " + (billing === "yearly" ? T("year", "سنة") : T("month", "شهر"))) : "";
        var waMsg = encodeURIComponent(
          T("New employer subscription", "طلب اشتراك صاحب عمل") + " " + (ref || "") +
          "\n" + T("Company", "الشركة") + ": " + company +
          "\n" + T("Plan", "الباقة") + ": " + (plan.name || plan.key) + (priceLabel ? " (" + priceLabel + ")" : "") +
          "\n" + T("Mobile", "الجوال") + ": " + phone
        );
        var bankRows = bank.iban ? (
          '<div class="join-next"><h3>' + T("Bank transfer", "التحويل البنكي") + '</h3>' +
          '<div class="bank-row"><span>' + T("Bank", "البنك") + '</span><span class="v">' + (bank.bank || "") + '</span></div>' +
          '<div class="bank-row"><span>' + T("Beneficiary", "المستفيد") + '</span><span class="v">' + (bank.beneficiary || "") + '</span></div>' +
          '<div class="bank-row"><span>IBAN</span><span class="v">' + bank.iban + '</span></div></div>'
        ) : "";
        box.hidden = false;
        box.innerHTML =
          "✅ <strong>" + T("Registration received", "تم استلام تسجيلك") + (ref ? " — " + ref : "") + "</strong><br>" +
          T("To activate your access, complete payment for the ", "لتفعيل وصولك، أكمل دفع باقة ") + "<strong>" + (plan.name || "") + "</strong>" + (priceLabel ? " (" + priceLabel + ") " : " ") +
          T("plan by bank transfer below, then send us the receipt on WhatsApp — we activate within working hours.", "عبر التحويل البنكي أدناه، ثم أرسل لنا الإيصال على واتساب — نفعّل خلال ساعات العمل.") +
          bankRows +
          '<a class="btn btn-wa btn-lg" style="margin-top:14px" target="_blank" rel="noopener" href="https://wa.me/' + WA + '?text=' + waMsg + '">' + T("Send details on WhatsApp", "أرسل التفاصيل عبر واتساب") + "</a>";
        box.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      fetch("/api/employer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) { done(res.d && res.d.ref); })
        .catch(function () { done(null); });
    });
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
    var DEMO_CODES = ["BP-DEMO", "DEMO", "BP-EMP-DEMO", "DEMO123"];
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
