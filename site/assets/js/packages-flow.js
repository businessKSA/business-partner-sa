(function () {
  "use strict";
  function t(en, ar) { return (window.BP && BP.lang === "ar") ? ar : en; }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function set(id, v) { var el = document.getElementById(id); if (el) el.value = v || ""; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pkgStore() { try { return JSON.parse(localStorage.getItem("bp_package_orders") || "[]"); } catch (e) { return []; } }
  function savePkgStore(items) { try { localStorage.setItem("bp_package_orders", JSON.stringify(items)); } catch (e) {} }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".pkg-order");
    if (!btn) return;
    set("po-package-id", btn.getAttribute("data-id"));
    set("po-package-name-en", btn.getAttribute("data-name-en"));
    set("po-package-name-ar", btn.getAttribute("data-name-ar"));
    set("po-package-amount", btn.getAttribute("data-amount"));
    set("po-package-price", btn.getAttribute("data-price"));
    set("po-package-label", (BP.lang === "ar" ? btn.getAttribute("data-name-ar") : btn.getAttribute("data-name-en")) + " — " + (btn.getAttribute("data-price") || ""));
    var box = document.getElementById("package-order");
    if (box) box.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("package-order-form");
    if (form && window.BP && BP.cart) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var id = val("po-package-id");
        if (!id) { alert(t("Choose a package first.", "اختر الباقة أولاً.")); return; }
        var terms = document.getElementById("po-terms");
        if (!terms || !terms.checked) { alert(t("Accept the terms and conditions first.", "وافق على الشروط والأحكام أولاً.")); return; }
        var selectedAddons = [].slice.call(document.querySelectorAll(".package-addons input:checked")).map(function (x) {
          return { key: x.value, nameEn: x.getAttribute("data-name-en"), nameAr: x.getAttribute("data-name-ar"), price: x.getAttribute("data-price") };
        });
        var item = {
          id: id,
          nameEn: val("po-package-name-en"),
          nameAr: val("po-package-name-ar"),
          amount: Number(val("po-package-amount") || 0) || null,
          price: val("po-package-price") || t("Custom quote", "عرض مخصص"),
          kind: "package",
          qty: 1,
          packageDetails: {
            entityType: val("po-entity"),
            employees: Number(val("po-employees") || 0),
            branches: Number(val("po-branches") || 0),
            addons: selectedAddons,
            termsAccepted: true,
          },
        };
        var cart = BP.cart.read().filter(function (x) { return x.id !== item.id; });
        cart.push(item);
        BP.cart.write(cart);
        try {
          localStorage.setItem("bp_pending_package", JSON.stringify(item));
          fetch("/api/package-order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: location.pathname, package: item, status: "draft_checkout" }) }).catch(function () {});
        } catch (err) {}
        var ok = document.getElementById("package-order-success");
        if (ok) { ok.hidden = false; ok.textContent = t("Package added. Redirecting to checkout...", "تمت إضافة الباقة. جاري الانتقال للدفع..."); }
        setTimeout(function () { location.href = BP.lang === "ar" ? "/ar/checkout" : "/checkout"; }, 450);
      });
    }

    var checkout = document.getElementById("checkout-form");
    if (checkout) {
      checkout.addEventListener("submit", function () {
        var pending = null;
        try { pending = JSON.parse(localStorage.getItem("bp_pending_package") || "null"); } catch (e) {}
        if (!pending) return;
        setTimeout(function () {
          var orders = [];
          try { orders = JSON.parse(localStorage.getItem("bp_orders") || "[]"); } catch (e) {}
          var latest = orders[0] || {};
          var rows = pkgStore();
          rows.unshift({ ref: latest.ref || "", status: latest.status || t("Under review", "قيد المراجعة"), at: new Date().toISOString(), package: pending });
          savePkgStore(rows.slice(0, 10));
          try {
            fetch("/api/package-order", {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ source: location.pathname, ref: latest.ref || "", package: pending, status: "checkout_submitted" }),
            }).catch(function () {});
          } catch (err) {}
          localStorage.removeItem("bp_pending_package");
        }, 900);
      }, true);
    }

    var pb = document.getElementById("pkg-box");
    if (pb) {
      setTimeout(function () {
        var row = pkgStore()[0];
        if (!row || !row.package) return;
        var pkg = row.package, pd = pkg.packageDetails || {};
        var name = BP.lang === "ar" ? (pkg.nameAr || pkg.nameEn) : (pkg.nameEn || pkg.nameAr);
        var entity = pd.entityType === "company" ? t("Company", "شركة") : (pd.entityType === "establishment" ? t("Establishment", "مؤسسة") : "-");
        var addons = (pd.addons || []).length ? pd.addons.map(function (a) { return esc(BP.lang === "ar" ? (a.nameAr || a.nameEn) : (a.nameEn || a.nameAr)) + " — " + esc(a.price || ""); }).join("<br>") : t("No add-ons selected.", "لا توجد إضافات مختارة.");
        var included = t("Qiwa, Absher Business / Muqeem by entity type, Zakat Tax and Customs Authority, Saudi Business Center, Mudad, GOSI, Balady, Salamah and Civil Defense, Chamber attestations, SPL/National Address, support tickets.", "قوى، أبشر أعمال / مقيم حسب نوع الكيان، هيئة الزكاة والضريبة والجمارك، المركز السعودي للأعمال، مدد، التأمينات الاجتماعية، بلدي، سلامة والدفاع المدني، الغرفة التجارية والتصاديق، سبل والعنوان الوطني، تذاكر دعم خدمات المنصات.");
        pb.innerHTML = '<div class="dash-card pkg-active"><span class="pkg-tag">' + esc(row.status || t("Active", "مفعّلة")) + '</span><h3>' + esc(name) + '</h3><p class="text-soft">' + t("Your consultant is setting up the services included in this package.", "مستشارك يجهّز الخدمات المشمولة في هذه الباقة.") + '</p><div class="pkg-portal-grid"><div><b>' + t("Entity type", "نوع الكيان") + '</b><span>' + esc(entity) + '</span></div><div><b>' + t("Employees", "عدد الموظفين") + '</b><span>' + esc(pd.employees || "-") + '</span></div><div><b>' + t("Branches", "عدد الفروع") + '</b><span>' + esc(pd.branches || "-") + '</span></div><div><b>' + t("Payment", "الدفع") + '</b><span>' + esc(row.status || t("Under review", "قيد المراجعة")) + '</span></div></div><div class="pkg-portal-block"><b>' + t("Included services", "الخدمات المشمولة") + '</b><p>' + esc(included) + '</p></div><div class="pkg-portal-block"><b>' + t("Add-ons", "الإضافات") + '</b><p>' + addons + '</p></div><div class="pkg-portal-actions"><a class="btn btn-primary" href="/account#panel-tickets">' + t("Open support ticket", "فتح تذكرة دعم") + '</a><a class="btn btn-ghost" href="' + (BP.lang === "ar" ? "/ar" : "") + '/packages">' + t("View package details", "تفاصيل الباقة") + '</a></div></div>';
      }, 500);
    }
  });
})();
