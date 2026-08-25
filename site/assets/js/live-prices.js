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

  function money(n) {
    try {
      return new Intl.NumberFormat("en-US").format(n);
    } catch (e) {
      return String(n);
    }
  }

  // نفس صياغة المولّد، حتى لا يختلف شكل السعر بين ما بُني وما وصل حيّاً.
  function label(row) {
    var n = money(row.unitPrice);
    var unit = AR ? (row.unitAr || "") : (row.unitEn || "");
    unit = String(unit).trim();
    if (!unit || unit === "خدمة" || unit === "service") {
      return AR ? n + " " + RIYAL : n + " SAR";
    }
    return AR ? n + " " + RIYAL + " / " + unit : n + " SAR / " + unit;
  }

  function apply(byCode) {
    document.querySelectorAll("[data-bp-price]").forEach(function (el) {
      var row = byCode[el.getAttribute("data-bp-price")];
      if (!row || row.openPrice || !(row.unitPrice > 0)) return;
      // بطاقة الباقة تحمل وحدتها في عنصر مستقل، فيُبدَّل الرقم وحده.
      if (el.hasAttribute("data-bp-keep-unit")) {
        var num = el.querySelector(".emp-price-m");
        if (num && num.firstChild) num.firstChild.nodeValue = money(row.unitPrice) + " ";
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
