/**
 * الأسعار الحيّة — تُقرأ من لوحة التحكم عند فتح الصفحة.
 *
 * الصفحات ثابتة تُبنى عند النشر، فتعديل سعر في اللوحة كان لا يظهر حتى إعادة
 * البناء. هذا الملف يجعله يظهر فور الفتح: يقرأ الكتالوج الحيّ مرة واحدة،
 * ويصحّح كل عنصر يحمل كوده. وما بُني عند النشر يبقى ظاهراً حتى تصل القراءة،
 * فلا يرى الزائر خانة فارغة ولا وميضاً.
 *
 * يفشل صامتاً: تعذُّر القراءة يعني بقاء سعر البناء — وهو صحيح إلى أن يُعدَّل.
 */
(function () {
  "use strict";

  var nodes = document.querySelectorAll("[data-bp-price], [data-bp-code]");
  if (!nodes.length) return;

  var AR = (document.documentElement.getAttribute("lang") || "ar").indexOf("ar") === 0;
  var RIYAL = "﷼";
  var UNIT_AR = { "شهر": "شهرياً", "سنة": "سنوياً", "شهري": "شهرياً" };

  // بطاقة الباقة تطبع أرقاماً عربية والخدمة أرقاماً لاتينية — يُتَّبع كلٌّ في موضعه
  // حتى لا يقلب التحديث شكل الرقم على الزائر.
  function money(n, locale) {
    try {
      return new Intl.NumberFormat(locale || "en-US").format(n);
    } catch (e) {
      return String(n);
    }
  }

  // نفس صياغة المولّد، حتى لا يختلف شكل السعر بين ما بُني وما وصل حيّاً.
  function label(row) {
    var n = money(row.unitPrice);
    var unit = AR ? (row.unitAr || "") : (row.unitEn || "");
    unit = String(unit).trim();
    if (AR) unit = UNIT_AR[unit] || unit;
    if (!unit || unit === "خدمة" || unit === "service") {
      return AR ? n + " " + RIYAL : n + " SAR";
    }
    return AR ? n + " " + RIYAL + " / " + unit : n + " SAR / " + unit;
  }

  // قراءة الرقم المبني من العنصر مهما كانت أرقامه عربية أو لاتينية.
  function digits(el) {
    if (!el || !el.firstChild) return 0;
    var t = String(el.firstChild.nodeValue || "").replace(/[\u066C,\u060C\s]/g, "");
    var out = "";
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i);
      if (c >= 48 && c <= 57) out += t[i];
      else if (c >= 0x0660 && c <= 0x0669) out += String(c - 0x0660);
      else if (c >= 0x06f0 && c <= 0x06f9) out += String(c - 0x06f0);
    }
    return out ? parseInt(out, 10) : 0;
  }

  // زر «أضف إلى السلة» في بطاقة الباقة يحمل الرقمين، فيُحدَّثان معاً.
  function setBtn(card, monthly, yearly) {
    var btn = card.parentElement && card.parentElement.querySelector(".emp-plan-btn");
    if (!btn) return;
    btn.setAttribute("data-amount", String(monthly));
    btn.setAttribute("data-amount-monthly", String(monthly));
    btn.setAttribute("data-amount-yearly", String(yearly));
  }

  function apply(byCode) {
    document.querySelectorAll("[data-bp-price]").forEach(function (el) {
      var row = byCode[el.getAttribute("data-bp-price")];
      if (!row || row.openPrice || !(row.unitPrice > 0)) return;
      // بطاقة الباقة تحمل وحدتها في عنصر مستقل، فيُبدَّل الرقم وحده.
      //
      // ولها رقم سنوي مخفي خلف زر التبديل. نسبة الخصم السنوي محسوبة عند البناء
      // ولا تصلنا من اللوحة، فتُشتق من الرقمين المبنيين وتُطبَّق على الجديد —
      // وإلا بقي السنوي على السعر القديم بينما تغيّر الشهري.
      if (el.hasAttribute("data-bp-keep-unit")) {
        var loc = AR ? "ar-SA" : "en-US";
        var m = el.querySelector(".emp-price-m");
        var y = el.querySelector(".emp-price-y");
        var builtM = digits(m);
        var builtY = digits(y);
        if (m && m.firstChild) m.firstChild.nodeValue = money(row.unitPrice, loc) + " ";
        if (y && y.firstChild && builtM > 0 && builtY > 0) {
          var yearly = Math.round((row.unitPrice * builtY) / builtM);
          y.firstChild.nodeValue = money(yearly, loc) + " ";
          setBtn(el, row.unitPrice, yearly);
        }
        return;
      }
      var next = label(row);
      if (el.textContent.trim() !== next) el.textContent = next;
    });

    document.querySelectorAll("[data-bp-code]").forEach(function (el) {
      var row = byCode[el.getAttribute("data-bp-code")];
      if (!row || row.openPrice || !(row.unitPrice > 0)) return;
      el.setAttribute("data-amount", String(row.unitPrice));
      el.setAttribute("data-price", label(row));
    });
  }

  fetch("/api/live-catalog", { headers: { accept: "application/json" } })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      var byCode = {};
      (data.services || []).forEach(function (row) {
        byCode[String(row.code).toUpperCase()] = row;
      });
      apply(byCode);
    })
    .catch(function () {
      /* يبقى سعر البناء ظاهراً — لا رسالة خطأ للزائر. */
    });
})();
