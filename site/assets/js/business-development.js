// Business Development as a Service (/business-development) — page behaviour.
//
// The subscribe buttons are the site's own .add-cart (main.js owns that path and
// now reads the subscription data-* attributes), so this file no longer carries
// a second cart implementation of its own. What is left is genuinely local to
// the page: the track buttons and the diagnostic-session form.
(() => {
  // Track buttons preselect the matching option in the form instead of dropping
  // everyone on the same generic contact block.
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-track]');
    if (!t) return;
    const sel = document.getElementById('rl-track');
    if (sel) {
      const want = t.getAttribute('data-track');
      for (const o of sel.options) if (o.text.trim() === want) { sel.value = o.value; break; }
      sel.dispatchEvent(new Event('change'));
    }
    const form = document.getElementById('rl-form');
    if (form) { e.preventDefault(); form.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });

  // Lead form → a real order in the CRM plus team and owner email.
  const form = document.getElementById('rl-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const sent = document.getElementById('sent');
    const err = document.getElementById('sentErr');
    const submit = document.getElementById('rl-submit');
    if (sent) sent.hidden = true;
    if (err) err.hidden = true;
    const lang = document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'ar';
    const L = (en, ar) => (lang === 'en' ? en : ar);
    if (submit) { submit.disabled = true; submit.textContent = L('Sending…', 'جارٍ الإرسال…'); }
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
          sent.textContent = L(
            '✅ We have your request — reference ' + (out.ref || '') + '. The business development team will be in touch within one working day.',
            '✅ استلمنا طلبك — رقم المرجع: ' + (out.ref || '') + '. سيتواصل معك فريق تطوير الأعمال خلال يوم عمل.');
          sent.hidden = false;
        }
        form.querySelectorAll('input,textarea').forEach((el) => { el.value = ''; });
      } else if (err) { err.hidden = false; }
    }).catch(() => { if (err) err.hidden = false; })
      .finally(() => { if (submit) { submit.disabled = false; submit.textContent = L('Request a diagnostic session', 'اطلب جلسة تشخيص'); } });
  });
})();
