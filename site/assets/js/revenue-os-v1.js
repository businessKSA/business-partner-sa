(() => {
  // Mobile menu
  const menu = document.querySelector('.menu-btn');
  const links = document.querySelector('.nav-links');
  if (menu && links) menu.addEventListener('click', () => {
    const open = links.dataset.open === '1';
    links.dataset.open = open ? '0' : '1';
    Object.assign(links.style, open ? { display: 'none' } : { display: 'flex', position: 'absolute', top: '78px', right: '16px', left: '16px', flexDirection: 'column', background: '#fff', padding: '18px', border: '1px solid #E3E7EF', borderRadius: '18px', boxShadow: '0 20px 50px rgba(11,27,90,.12)' });
  });

  // Subscribe buttons → the site-wide cart (same bp_cart the checkout reads),
  // then straight to the Arabic cart page to complete the purchase.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-revos-cart]');
    if (!btn) return;
    e.preventDefault();
    let cart = [];
    try { cart = JSON.parse(localStorage.getItem('bp_cart')) || []; } catch (_) {}
    const id = btn.getAttribute('data-revos-cart');
    const renews = Number(btn.getAttribute('data-intro-amount')) || null;
    const item = {
      id,
      nameEn: btn.getAttribute('data-name-en') || id,
      nameAr: btn.getAttribute('data-name-ar') || id,
      amount: Number(btn.getAttribute('data-amount')) || null,
      price: '',
      kind: 'package',
      qty: 1,
      surchargeAmount: null,
      surchargeFreeCount: null,
      // These prices are published on a public marketing page, so the cart must
      // show them even to a signed-out visitor — the "hide prices" policy is
      // about the service catalogue, not about a package the page just quoted.
      pricePublic: 1,
      // A monthly subscription, not a one-off order. Everything downstream (cart
      // line, checkout, receipt, portal) reads these instead of guessing.
      billingPeriod: btn.getAttribute('data-billing') || 'monthly',
      renewsAt: renews,
      commissionPercent: Number(btn.getAttribute('data-commission')) || 0,
    };
    const ex = cart.find((x) => x.id === item.id);
    if (ex) ex.qty = (ex.qty || 1) + 1; else cart.push(item);
    try { localStorage.setItem('bp_cart', JSON.stringify(cart)); } catch (_) {}
    location.href = '/ar/cart';
  });

  // Track buttons preselect the matching option in the form instead of
  // dropping everyone on the same generic contact block.
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-track]");
    if (!t) return;
    const sel = document.getElementById("rl-track");
    if (sel) {
      const want = t.getAttribute("data-track");
      for (const o of sel.options) if (o.text.trim() === want) { sel.value = o.value; break; }
      sel.dispatchEvent(new Event("change"));
    }
    const form = document.getElementById("leadForm");
    if (form) { e.preventDefault(); form.scrollIntoView({ behavior: "smooth", block: "center" }); }
  });

  // Lead form → real order in the CRM + team/owner email (no more demo).
  const form = document.getElementById('leadForm');
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const sent = document.getElementById('sent');
    const err = document.getElementById('sentErr');
    const submit = document.getElementById('rl-submit');
    if (sent) sent.hidden = true;
    if (err) err.hidden = true;
    if (submit) { submit.disabled = true; submit.textContent = 'جارٍ الإرسال…'; }
    fetch('/api/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'revenue-lead',
        name: v('rl-name'),
        company: v('rl-company'),
        email: v('rl-email'),
        phone: v('rl-phone'),
        track: v('rl-track'),
        notes: v('rl-notes'),
      }),
    }).then((r) => r.json()).then((out) => {
      if (out && out.ok) {
        if (sent) {
          sent.textContent = '✅ استلمنا طلبك — رقم المرجع: ' + (out.ref || '') + '. سيتواصل معك فريق تطوير الأعمال خلال يوم عمل.';
          sent.hidden = false;
        }
        form.querySelectorAll('input,textarea').forEach((el) => { el.value = ''; });
      } else { if (err) err.hidden = false; }
    }).catch(() => { if (err) err.hidden = false; })
      .finally(() => { if (submit) { submit.disabled = false; submit.textContent = 'اطلب جلسة تشخيص'; } });
  });
})();
