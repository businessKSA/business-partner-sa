/* Business Partner — سلوك صفحات «مركز المعرفة» على الموقع الجديد.
 *
 * صفحات النشرة والمجلة كانت تعتمد على main.js (الموقع القديم) في ثلاثة أشياء
 * فقط: نموذج الاشتراك في النشرة، وبوابة تحميل المجلة، وعرض الأخبار الحيّة من
 * Notion. نُقلت الثلاثة هنا بلا تغيير في العقد مع الخادم (نفس المسارات ونفس
 * الحقول) — ولا تعتمد على BP ولا على أي شيء من main.js، فالصفحة تحمّل هذا
 * الملف وحده.
 *
 * أي تغيير في منطقها يُكرَّر في main.js ما دامت صفحات قديمة تستعمله.
 */
(function () {
  "use strict";
  var LANG = document.documentElement.lang || "ar";
  var T = function (en, ar) { return LANG === "ar" ? ar : en; };
  function esc3(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- النشرة: form[data-nl] → /api/newsletter ---------- */
  document.addEventListener("submit", function (e) {
    var form = e.target.closest ? e.target.closest("form[data-nl]") : null;
    if (!form) return;
    e.preventDefault();
    var emailEl = form.querySelector("[data-nl-email]");
    var msg = form.parentNode.querySelector("[data-nl-msg]");
    var email = (emailEl && emailEl.value || "").trim();
    function show(txt) { if (msg) { msg.hidden = false; msg.textContent = txt; } }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { show(T("Please enter a valid email.", "الرجاء إدخال بريد صحيح.")); return; }
    var btn = form.querySelector('button[type="submit"]'), lbl = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = T("Sending…", "جارٍ الإرسال…"); }
    fetch("/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email, source: location.pathname }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        if (btn) { btn.disabled = false; btn.textContent = lbl; }
        if (d && d.ok) { show("✅ " + T("You're subscribed! Check your inbox soon.", "تم اشتراكك! ستصلك النشرة قريباً.")); if (emailEl) emailEl.value = ""; }
        else show(T("Something went wrong. Please try again.", "حدث خطأ. حاول مرة أخرى."));
      })
      .catch(function () { if (btn) { btn.disabled = false; btn.textContent = lbl; } show(T("Network error. Please try again.", "خطأ في الاتصال. حاول مرة أخرى.")); });
  });

  /* ---------- الأخبار الحيّة: [data-live-news] ← /api/newsletter?feed=news ---------- */
  function newsCard(it) {
    var raw = String(it.text || "").replace(/\r/g, "");
    var lines = raw.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    var sourceLine = null, content = [];
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
  function liveNews() {
    var boxes = document.querySelectorAll("[data-live-news]");
    Array.prototype.forEach.call(boxes, function (box) {
      // المصدر عربي فقط؛ عرضه خاماً في صفحة إنجليزية يبدو معطوباً.
      if (LANG !== "ar") {
        var arHref = location.pathname === "/" ? "/ar/" : "/ar" + location.pathname.replace(/^\/(en|fr|zh)(?=\/)/, "");
        box.innerHTML = '<p class="text-soft">This live feed is currently Arabic-only. <a href="' + arHref + '">View the Arabic page</a></p>';
        return;
      }
      var limit = box.getAttribute("data-live-news") || "6";
      box.innerHTML = '<p class="text-soft">جارٍ تحميل آخر الأخبار…</p>';
      fetch("/api/newsletter?feed=news&limit=" + encodeURIComponent(limit))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok || !d.items || !d.items.length) { box.innerHTML = '<p class="text-soft">لا توجد أخبار لعرضها حالياً.</p>'; return; }
          box.innerHTML = d.items.map(newsCard).join("");
          if (box.getAttribute("data-auto-print")) setTimeout(function () { window.print(); }, 400);
        })
        .catch(function () { box.innerHTML = '<p class="text-soft">تعذّر تحميل آخر الأخبار. حاول مرة أخرى بعد قليل.</p>'; });
    });
  }

  /* ---------- بوابة المجلة: #mag-form → /api/requests (type: magazine) ---------- */
  function magazine() {
    var form = document.getElementById("mag-form");
    if (!form) return;
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = val("mag-name"), phone = val("mag-phone"), email = val("mag-email");
      if (!name || !phone || !email) { alert(T("Please fill all fields.", "الرجاء تعبئة كل الحقول.")); return; }
      var btn = form.querySelector("button[type=submit]"), lbl = btn.textContent;
      btn.disabled = true; btn.textContent = T("Sending…", "جارٍ الإرسال…");
      fetch("/api/requests", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "magazine", name: name, phone: phone, email: email }),
      }).then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          btn.textContent = lbl;
          var box = document.getElementById("mag-success");
          if (res.d && res.d.ok) {
            box.hidden = false;
            box.innerHTML = "✅ " + T("Opening your printable issue — also emailed to you.", "جارٍ فتح عددك القابل للطباعة — أرسلناه لبريدك أيضاً.");
            window.open(res.d.printUrl || "/magazine/print", "_blank");
          } else { btn.disabled = false; alert(T("Couldn't send. Try again.", "تعذّر الإرسال. حاول مرة أخرى.")); }
        })
        .catch(function () { btn.disabled = false; btn.textContent = lbl; alert(T("Network error. Try again.", "خطأ في الاتصال. حاول مرة أخرى.")); });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { liveNews(); magazine(); });
  else { liveNews(); magazine(); }
})();
