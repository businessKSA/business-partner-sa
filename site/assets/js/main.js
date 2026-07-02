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
    var buyBtn = e.target.closest(".buy-now");
    if (addBtn) {
      add(itemFromBtn(addBtn));
      toast(BP.t("Added to cart ✓", "أُضيفت إلى السلة ✓"));
    } else if (buyBtn) {
      add(itemFromBtn(buyBtn));
      location.href = "/checkout";
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
    var m = { service: ["Service", "خدمة"], package: ["Package", "باقة"], agent: ["AI agent", "وكيل ذكي"], misa: ["Investor track", "مسار مستثمر"] };
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

/* ---------- Careers CV form (client-side demo) ---------- */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("cv-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("c-name").value.trim();
      var phone = document.getElementById("c-phone").value.trim();
      var cv = document.getElementById("c-cv");
      if (!name || !phone) { alert(BP.t("Please enter your name and mobile.", "الرجاء إدخال الاسم ورقم الجوال.")); return; }
      if (!cv.files || !cv.files.length) { alert(BP.t("Please attach your CV file.", "الرجاء إرفاق ملف السيرة الذاتية.")); return; }
      // Store a lightweight record locally (real upload → n8n/Notion coming soon)
      try {
        var apps = JSON.parse(localStorage.getItem("bp_cv") || "[]");
        apps.push({ name: name, phone: phone, file: cv.files[0].name, at: new Date().toISOString().slice(0, 10) });
        localStorage.setItem("bp_cv", JSON.stringify(apps));
      } catch (err) {}
      form.querySelector(".form-success").hidden = false;
      form.querySelector("button[type=submit]").disabled = true;
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
      // Build WhatsApp notification
      var lines = ["*طلب جديد / New order* " + ref, "الاسم: " + name, "الجوال: " + phone];
      order.items.forEach(function (it) { lines.push("• " + it.name + " ×" + it.qty + (it.price ? " — " + it.price + " ﷼" : "")); });
      if (!receipt || !receipt.files.length) lines.push(BP.t("(Receipt to be sent)", "(سيُرسل الإيصال)"));
      var waUrl = "https://wa.me/966507034157?text=" + encodeURIComponent(lines.join("\n"));
      // Clear cart
      BP.cart.write([]);
      var box = document.getElementById("checkout-success");
      box.hidden = false;
      box.innerHTML = "✅ <strong>" + BP.t("Order received", "تم استلام طلبك") + " — " + ref + "</strong><br>" +
        BP.t("Transfer the amount to the bank account, then send the receipt. We'll confirm on WhatsApp.", "حوّل المبلغ على الحساب البنكي ثم أرسل الإيصال. سنؤكد لك عبر واتساب.") +
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
        document.getElementById("dash-hello").textContent = BP.t("Welcome, ", "مرحباً، ") + (s.name || s.email);
        document.getElementById("dash-email").textContent = s.email;
        renderOrders();
      } else { auth.hidden = false; dash.hidden = true; }
    }

    function renderOrders() {
      var orders = [];
      try { orders = JSON.parse(localStorage.getItem("bp_orders") || "[]"); } catch (e) {}
      var ow = document.getElementById("dash-orders");
      var uw = document.getElementById("dash-uploads");
      if (!orders.length) return;
      ow.innerHTML = orders.map(function (o) {
        return '<div class="ord"><div><strong>' + o.ref + '</strong><span class="text-soft"> · ' + o.at + '</span><div class="text-soft">' +
          o.items.map(function (i) { return i.name + " ×" + i.qty; }).join(", ") + '</div></div><span class="ord-status">' + o.status + '</span></div>';
      }).join("");
      var files = orders.reduce(function (a, o) { return a.concat(o.files || [], o.receipt ? [o.receipt] : []); }, []);
      if (files.length) uw.innerHTML = files.map(function (f) { return '<div class="upl">📎 ' + f + '</div>'; }).join("");
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
