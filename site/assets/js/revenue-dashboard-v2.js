// Revenue Command Center v2 — REAL client data, no demo numbers.
// Auth = the client-portal session (bp_session marker + the httpOnly server
// cookie the /account OTP login sets). Data = the client's own CRM orders
// (/api/requests?action=my-orders), operational overview (my-overview) and
// ops lists (my-ops). Sections with no data yet render honest empty states.
(() => {
  const content = document.getElementById('dashboardContent');
  const title = document.getElementById('viewTitle');
  const nav = document.getElementById('dashboardNav');
  const sidebar = document.getElementById('sidebar');
  if (!content || !nav) return;

  // ---- auth gate: client portal login required ----
  let session = null;
  try { session = JSON.parse(localStorage.getItem('bp_session') || 'null'); } catch (e) {}
  if (!session) { location.href = '/ar/account?redirect=revenue'; return; }

  // ---- language: the dashboard follows the site's bp_lang preference and
  // exposes the same AR/EN switch the rest of the site has ----
  let lang = 'ar';
  try { lang = localStorage.getItem('bp_lang') === 'en' ? 'en' : 'ar'; } catch (e) {}
  const L = (en, ar) => (lang === 'en' ? en : ar);
  (function () {
    const root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
    const btn = document.getElementById('langBtn');
    if (!btn) return;
    btn.textContent = lang === 'en' ? 'AR' : 'EN';
    btn.addEventListener('click', () => {
      lang = lang === 'en' ? 'ar' : 'en';
      try { localStorage.setItem('bp_lang', lang); } catch (e) {}
      location.reload();
    });
  })();
  const NAV_EN = { overview: 'Overview', accounts: 'Target accounts', leads: 'Leads', pipeline: 'Opportunities & pipeline', meetings: 'Meetings', campaigns: 'Campaigns & outreach', suppliers: 'Suppliers & requests', revenue: 'Revenue & collection', commissions: 'Commissions', tasks: 'Tasks & SLA', documents: 'Documents', reports: 'Reports' };

  const money = (v) => new Intl.NumberFormat('en-US').format(Math.round(v)) + L(' SAR', ' ريال');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const OPEN = ['قيد المراجعة', 'بانتظار الدفع', 'بانتظار التسعير'];
  const ACTIVE = ['مؤكد - قيد التنفيذ'];
  const DONE = ['مكتمل'];

  const state = { orders: [], overview: null, tasks: [], documents: [], loaded: false, error: false, period: 'month' };

  // Real identity in the top bar (was a hardcoded "BM").
  (function () {
    const av = document.querySelector('.user-avatar');
    if (!av) return;
    const src = (session.name || session.email || '').trim();
    const parts = src.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
    av.textContent = (parts[0] ? parts[0][0] : '') + (parts[1] ? parts[1][0] : '');
    av.title = session.email || '';
  })();

  // The period selector used to do nothing at all. It now filters what the
  // views count, so changing it visibly changes the numbers.
  (function () {
    const sel = document.getElementById('periodSelect');
    if (!sel) return;
    const map = ['month', 'quarter', 'year'];
    sel.addEventListener('change', () => { state.period = map[sel.selectedIndex] || 'month'; render(); });
  })();
  function inPeriod(o) {
    if (!o || !o.at) return true;
    const d = new Date(o.at);
    if (isNaN(d)) return true;
    const now = new Date();
    const days = state.period === 'year' ? 365 : state.period === 'quarter' ? 92 : 31;
    return (now - d) / 86400000 <= days;
  }

  const head = (h, p, actions = '') => `<div class="view-head"><div><h1>${h}</h1><p>${p}</p></div><div class="head-actions">${actions}</div></div>`;
  const kpi = (label, value, note = '', down = false) => `<div class="dash-kpi"><small>${label}</small><strong>${value}</strong>${note ? `<span class="delta${down ? ' down' : ''}">${note}</span>` : ''}</div>`;
  const table = (heads, rows) => `<div class="table-wrap"><table class="data-table"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const statusChip = (s) => {
    const cls = DONE.includes(s) ? 'ok' : ACTIVE.includes(s) ? 'active' : s === 'ملغي' ? 'off' : 'wait';
    const label = { 'قيد المراجعة': 'Under review', 'بانتظار الدفع': 'Awaiting payment', 'بانتظار التسعير': 'Awaiting pricing', 'مؤكد - قيد التنفيذ': 'Confirmed - in progress', 'مكتمل': 'Completed', 'ملغي': 'Cancelled' }[s];
    const shown = lang === 'en' && label ? label : s;
    return `<span class="status-chip ${cls}" style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${cls === 'ok' ? '#E3F1E9;color:#006C35' : cls === 'active' ? '#E8EDFB;color:#0B1B5A' : cls === 'off' ? '#F3F4F6;color:#6B7280' : '#FFF7E6;color:#92600A'}">${esc(shown || '—')}</span>`;
  };
  const emptyState = (t, p, cta) => `<div class="dash-card" style="text-align:center;padding:48px 24px"><div style="font-size:2rem;margin-bottom:10px">◇</div><h3 style="margin:0 0 6px">${t}</h3><p style="color:#6B7280;max-width:46em;margin:0 auto 16px">${p}</p>${cta || ''}</div>`;
  const pkgCta = () => `<a class="dash-btn primary" href="${lang === 'en' ? '/revenue-os' : '/ar/revenue-os'}#pricing" style="text-decoration:none">${L('View Revenue OS packages', 'استعرض باقات Revenue OS')}</a>`;

  function periodOrders() { return state.orders.filter(inPeriod); }
  // The client's own orders with us. Deliberately NOT called a pipeline: these
  // are services they bought from Business Partner, not opportunities we
  // generated for them, and showing them as "فرص" misrepresents both.
  function orderSummary() {
    const list = periodOrders();
    return {
      count: list.length,
      open: list.filter((o) => OPEN.includes(o.status)).length,
      wallet: (state.overview && state.overview.walletBalance) || 0,
    };
  }

  const ordersRows = (list) => list.map((o) => [
    `<b dir="ltr">${esc(o.ref)}</b>`, esc(o.title || '—'), statusChip(o.status),
    o.total ? money(o.total) : '—', esc(o.at || '—'),
  ]);

  // A Revenue OS subscription is what makes this workspace fill up. Detect it
  // from the client's own confirmed orders.
  function revosPlan() {
    const hit = state.orders.find((o) => /revenue\s*os/i.test((o.title || '') + ' ' + (o.ref || '')) && (ACTIVE.includes(o.status) || DONE.includes(o.status)));
    return hit || null;
  }

  const views = {
    overview() {
      const plan = revosPlan();
      const o = orderSummary();
      const banner = plan
        ? `<div class="dash-card" style="padding:16px 18px;border-inline-start:4px solid #168A5B"><b>${L('Revenue OS is active', 'اشتراك Revenue OS مفعّل')}</b><br><small style="color:#6B7280">${esc(plan.title || '')} · ${L('your pipeline fills as the team runs it', 'يمتلئ الـPipeline مع تشغيل الفريق لباقتك')}</small></div>`
        : `<div class="dash-card" style="padding:16px 18px;border-inline-start:4px solid #B7791F"><b>${L('This workspace is ready — Revenue OS is not subscribed yet', 'مساحتك جاهزة — اشتراك Revenue OS غير مفعّل بعد')}</b><br><small style="color:#6B7280">${L('Opportunities, meetings and commissions appear here once a package is running.', 'الفرص والاجتماعات والعمولات تظهر هنا بمجرد تشغيل باقتك.')}</small><div style="margin-top:10px">${pkgCta()}</div></div>`;

      // These are Revenue OS numbers — opportunities generated FOR the client.
      // They are not the client's own purchases from us; those live below.
      const note = L('starts when your package runs', 'تبدأ مع تشغيل باقتك');
      return `${head('Revenue Overview', L('Opportunities Business Partner generates for you — and where they stand.', 'الفرص التي يبنيها لك Business Partner — وأين وصلت.'), `<a class="dash-btn" href="${lang === 'en' ? '/account' : '/ar/account'}" style="text-decoration:none">${L('Client portal', 'منصّة العملاء')}</a>`)}
      ${banner}
      <div class="dash-kpis" style="margin-top:14px">
        ${kpi(L('Opportunities generated', 'فرص مولّدة لك'), '0', note)}
        ${kpi(L('Meetings booked', 'اجتماعات محجوزة'), '0', note)}
        ${kpi(L('Proposals out', 'عروض مقدَّمة'), '0', note)}
        ${kpi(L('Revenue collected from these deals', 'إيراد محصّل من هذه الصفقات'), money(0), note)}
      </div>
      <div class="dash-grid-2">
        <article class="dash-card"><div class="dash-card-head"><div><h3>${L('Pipeline stages', 'مراحل الـPipeline')}</h3><small>${L('opportunities we generate for you', 'الفرص التي نولّدها لك')}</small></div></div>
          <div class="funnel">
            ${[[L('Research', 'بحث'), 0], [L('Qualified', 'مؤهلة'), 0], [L('Meetings', 'اجتماعات'), 0], [L('Proposals', 'عروض'), 0], [L('Won', 'مكتسبة'), 0]].map(([label, n]) =>
              `<div class="funnel-row"><span>${label}</span><div class="progress"><i style="width:0%"></i></div><b>${n}</b></div>`).join('')}
          </div>
          <p style="color:#6B7280;padding:0 4px;margin:6px 0 0;font-size:13px">${L('Empty until your package is running — we show nothing we have not actually done.', 'فارغة حتى تشغيل باقتك — لا نعرض شيئًا لم ننفّذه فعلاً.')}</p>
        </article>
        <article class="dash-card"><div class="dash-card-head"><div><h3>${L('Your account with Business Partner', 'حسابك لدى Business Partner')}</h3><small>${L('your service orders and wallet — not part of the pipeline above', 'طلبات خدماتك ومحفظتك — ليست جزءًا من الـPipeline أعلاه')}</small></div></div>
          <div class="dash-kpis" style="padding:0">
            ${kpi(L('Service orders', 'طلبات خدمات'), String(o.count))}
            ${kpi(L('Open orders', 'طلبات مفتوحة'), String(o.open))}
            ${kpi(L('Wallet balance', 'رصيد المحفظة'), money(o.wallet))}
          </div>
          <div style="padding:10px 4px 0"><a class="dash-btn" href="${lang === 'en' ? '/account' : '/ar/account'}" style="text-decoration:none">${L('Open them in the client portal', 'افتحها في منصّة العملاء')}</a></div>
        </article>
      </div>`;
    },
    pipeline() {
      return `${head(L('Opportunities & pipeline', 'الفرص والـPipeline'), L('Opportunities Business Partner generates for you — never your own orders with us.', 'الفرص التي يبنيها لك Business Partner — وليست طلباتك لدينا.'))}
      ${emptyState(L('No opportunities generated yet', 'لا توجد فرص مولّدة بعد'),
        L('Once a Revenue OS package is running, every account we target, qualify and take to a meeting shows up here with its value, stage and next action. Your own service orders with Business Partner live in the client portal.',
          'بمجرد تشغيل باقة Revenue OS، يظهر هنا كل حساب نستهدفه ونؤهله ونصل به إلى اجتماع، بقيمته ومرحلته والإجراء التالي. أما طلبات خدماتك لدى Business Partner فمكانها منصّة العملاء.'),
        pkgCta())}`;
    },
    revenue() {
      const o = orderSummary();
      return `${head(L('Revenue & collection', 'الإيرادات والتحصيل'), L('Revenue collected from the deals we generate for you, and the commission due on it.', 'الإيراد المحصّل من الصفقات التي نولّدها لك، والعمولة المستحقة عليه.'))}
      <div class="dash-kpis">${kpi(L('Collected from generated deals', 'محصّل من الصفقات المولّدة'), money(0), L('starts when your package runs', 'تبدأ مع تشغيل باقتك'))}${kpi(L('Commission due', 'عمولة مستحقة'), money(0))}${kpi(L('Your wallet at Business Partner', 'رصيد محفظتك لدى Business Partner'), money(o.wallet))}</div>
      ${emptyState(L('No collections yet', 'لا توجد تحصيلات بعد'), L('Revenue is recorded here only when a deal we generated is actually collected — that is also what commission is calculated on.', 'يُسجَّل الإيراد هنا فقط عند تحصيل صفقة ولّدناها فعلاً — وهو نفسه ما تُحتسب عليه العمولة.'), pkgCta())}`;
    },
    tasks() {
      const t = state.tasks;
      return `${head(L('Tasks & SLA', 'المهام وSLA'), L('What is required from you and from our team — from the client operations center.', 'المهام المطلوبة منك ومن فريقنا — من مركز عمليات العميل.'))}
      ${t.length ? `<article class="dash-card">${table([L('Task', 'المهمة'), L('Status', 'الحالة'), L('Priority', 'الأولوية'), L('Due', 'الاستحقاق')], t.map((x) => [esc(x.title), statusChip(x.status === 'done' ? 'مكتمل' : 'قيد المراجعة'), esc(x.urgency || L('normal', 'عادي')), esc(String(x.due_at || '—').slice(0, 10))]))}</article>` : emptyState(L('No tasks right now', 'لا توجد مهام حالياً'), L('Tasks appear here when the operations team assigns them to you or to us under your package.', 'تظهر المهام هنا عندما يسندها فريق التشغيل إليك أو لفريقنا ضمن باقتك.'), '')}`;
    },
    documents() {
      const d = state.documents;
      return `${head(L('Documents', 'المستندات'), L('Your documents uploaded in the client operations center.', 'مستنداتك المرفوعة في مركز عمليات العميل.'))}
      ${d.length ? `<article class="dash-card">${table([L('Document', 'المستند'), L('Category', 'التصنيف'), L('Verification', 'حالة التحقق'), L('Date', 'التاريخ')], d.map((x) => [esc(x.title), esc(x.category || '—'), statusChip(x.verify_status === 'verified' ? 'مكتمل' : 'قيد المراجعة'), esc(String(x.created_at || '').slice(0, 10))]))}</article>` : emptyState(L('No documents yet', 'لا توجد مستندات بعد'), L('Upload your documents from the client portal and they show up here immediately.', 'ارفع مستنداتك من منصّة العملاء وتظهر هنا مباشرة.'), `<a class="dash-btn primary" href="${lang === 'en' ? '/account' : '/ar/account'}" style="text-decoration:none">${L('Open the client portal', 'فتح منصّة العملاء')}</a>`)}`;
    },
  };
  // Sections that activate with a running Revenue OS package — honest empty
  // states, no invented numbers.
  const soon = {
    accounts: [L('Target accounts', 'الحسابات المستهدفة'), L('Target company lists (ICP) are built and appear here once your package starts running.', 'قوائم الشركات المستهدفة (ICP) تُبنى وتظهر هنا مع بدء تشغيل باقتك.')],
    leads: [L('Leads', 'العملاء المحتملون'), L('Qualified leads appear here once your package campaigns are running.', 'العملاء المحتملون المؤهلون يظهرون هنا مع تشغيل حملات باقتك.')],
    meetings: [L('Meetings', 'الاجتماعات'), L('Your meetings with decision makers are logged here once delivery starts.', 'اجتماعاتك مع صناع القرار تُسجّل هنا مع بدء التشغيل.')],
    campaigns: [L('Campaigns & outreach', 'الحملات والتواصل'), L('Multi-channel outreach campaigns appear here once delivery starts.', 'حملات التواصل متعدد القنوات تظهر هنا مع بدء التشغيل.')],
    suppliers: [L('Suppliers & requests', 'الموردون والطلبات'), L('Qualified suppliers and RFQs appear here once the supplier track is running.', 'الموردون المؤهلون وطلبات RFQ تظهر هنا مع تشغيل مسار الموردين.')],
    commissions: [L('Commissions', 'العمولات'), L('Success and closing fees are calculated on collected revenue and shown here from the first deal.', 'عمولات النجاح والإغلاق تُحتسب على الإيراد المحصّل وتُعرض هنا مع أول صفقة.')],
    reports: [L('Reports', 'التقارير'), L('Your periodic reports are published here according to your package (monthly / weekly / executive dashboards).', 'تقاريرك الدورية تُنشر هنا حسب باقتك (شهري / أسبوعي / لوحات تنفيذية).')],
  };
  Object.keys(soon).forEach((k) => {
    views[k] = () => head(soon[k][0], L('Real data only — no demo numbers.', 'بيانات حقيقية فقط — لا أرقام تجريبية.')) + emptyState(soon[k][0], soon[k][1], pkgCta());
  });

  // Seven of the twelve sections only fill up once a Revenue OS package is
  // running. Left unmarked they read as broken pages, so label them in the
  // sidebar rather than letting the client discover seven identical blanks.
  (function () {
    Object.keys(soon).forEach((k) => {
      const btn = nav.querySelector('button[data-view="' + k + '"]');
      if (!btn) return;
      btn.style.opacity = "0.62";
      btn.title = L("Activates with a Revenue OS subscription", "تُفعَّل مع اشتراك Revenue OS");
      const tag = document.createElement("small");
      tag.textContent = L("with plan", "مع الباقة");
      tag.style.cssText = "margin-inline-start:auto;font-size:10px;font-weight:800;background:#EEF1F8;color:#0B1B5A;padding:1px 7px;border-radius:20px";
      btn.appendChild(tag);
    });
  })();

  const TITLES_AR = { overview: 'نظرة عامة', accounts: 'الحسابات المستهدفة', leads: 'العملاء المحتملون', pipeline: 'الفرص والـPipeline', meetings: 'الاجتماعات', campaigns: 'الحملات والتواصل', suppliers: 'الموردون والطلبات', revenue: 'الإيرادات والتحصيل', commissions: 'العمولات', tasks: 'المهام وSLA', documents: 'المستندات', reports: 'التقارير' };
  const titles = new Proxy({}, { get: (_, k) => (lang === 'en' ? (NAV_EN[k] || '') : (TITLES_AR[k] || '')) });
  let current = 'overview';
  function render() {
    if (!state.loaded && !state.error) { content.innerHTML = `<div class="dash-card" style="text-align:center;padding:60px">${L('Loading your data…', 'جارٍ تحميل بياناتك…')}</div>`; return; }
    if (state.error) { content.innerHTML = emptyState(L('Could not load your data', 'تعذّر تحميل البيانات'), L('Sign in from the client portal, then come back to the dashboard.', 'سجّل الدخول من منصّة العملاء ثم عد إلى اللوحة.'), `<a class="dash-btn primary" href="${lang === 'en' ? '/account' : '/ar/account'}?redirect=revenue" style="text-decoration:none">${L('Sign in', 'تسجيل الدخول')}</a>`); return; }
    content.innerHTML = (views[current] || views.overview)();
    if (title) title.textContent = titles[current] || '';
  }
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-view]');
    if (!btn) return;
    nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    current = btn.getAttribute('data-view');
    render();
    if (sidebar) sidebar.classList.remove('open');
  });
  const drawer = document.getElementById('drawerBtn');
  if (drawer && sidebar) drawer.addEventListener('click', () => sidebar.classList.toggle('open'));

  // Localize the shell that lives in the HTML (labels, period options).
  (function () {
    if (lang !== 'en') return;
    nav.querySelectorAll('button[data-view]').forEach((b) => {
      const key = b.getAttribute('data-view');
      const span = b.querySelector('span');
      if (span && NAV_EN[key]) span.textContent = NAV_EN[key];
    });
    const sel = document.getElementById('periodSelect');
    if (sel) ['This month', 'This quarter', 'This year'].forEach((t, i) => { if (sel.options[i]) sel.options[i].text = t; });
    const note = document.querySelector('.prototype-note + .prototype-note') || document.querySelector('.prototype-note');
    if (note) note.innerHTML = note.innerHTML.replace('بيانات حقيقية من حسابك', 'Real data from your account').replace('مرتبطة بمنصّة العملاء والسلة', 'connected to your client portal and cart').replace('فتح منصّة العملاء', 'Open the client portal');
    const crumb = document.querySelector('.crumb small');
    if (crumb) crumb.textContent = 'Business Partner / Client Workspace';
  })();

  render();
  const jf = (u) => fetch(u, { credentials: 'same-origin' }).then((r) => r.json()).catch(() => null);
  Promise.all([
    jf('/api/requests?action=my-orders'),
    jf('/api/requests?action=my-overview'),
    jf('/api/requests?action=my-ops&what=tasks'),
    jf('/api/requests?action=my-ops&what=documents'),
  ]).then(([ord, ov, tk, dc]) => {
    if (ord && ord.ok) state.orders = ord.orders || [];
    else if (ord && ord.error === 'unauthorized') { location.href = '/ar/account?redirect=revenue'; return; }
    if (ov && ov.ok) state.overview = ov;
    if (tk && tk.ok) state.tasks = tk.items || [];
    if (dc && dc.ok) state.documents = dc.items || [];
    state.loaded = true;
    render();
  }).catch(() => { state.error = true; render(); });
})();
