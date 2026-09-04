// Business Development as a Service — client workspace. REAL client data, no demo numbers.
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
  const NAV_EN = { overview: 'Overview', matches: 'Matching companies', accounts: 'Target accounts', leads: 'Leads', pipeline: 'Opportunities & pipeline', meetings: 'Meetings', campaigns: 'Campaigns & outreach', suppliers: 'Suppliers & requests', revenue: 'Revenue & collection', commissions: 'Commissions', tasks: 'Tasks & SLA', documents: 'Documents', reports: 'Reports' };

  const money = (v) => new Intl.NumberFormat('en-US').format(Math.round(v)) + L(' SAR', ' ريال');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const OPEN = ['قيد المراجعة', 'بانتظار الدفع', 'بانتظار التسعير'];
  const ACTIVE = ['مؤكد - قيد التنفيذ'];
  const DONE = ['مكتمل'];

  const state = { orders: [], overview: null, tasks: [], documents: [], bd: null, loaded: false, error: false, period: 'month' };

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
  const startCta = () => `<a class="dash-btn primary" href="${lang === 'en' ? '/business-development' : '/ar/business-development'}#leadForm" style="text-decoration:none">${L('Tell us who to target', 'أخبرنا بمن نستهدف')}</a>`;
  const pkgCta = () => `<a class="dash-btn primary" href="${lang === 'en' ? '/business-development' : '/ar/business-development'}#pricing" style="text-decoration:none">${L('View BD as a Service packages', 'استعرض باقات تطوير الأعمال كخدمة')}</a>`;

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

  // A subscription is what makes this workspace fill up. Detect it
  // from the client's own orders — matching on what they actually bought (the
  // note items and the recorded subscription terms), not on the CRM opportunity
  // title, which is generic and never names the package.
  // The service was renamed to Business Development as a Service in 2026-08.
  // Orders placed before the rename carry the old name and must keep working,
  // so both names match; the internal "revos-" product codes never changed.
  const PLAN_NAME = /revenue\s*os|revos|bd\s*as\s*a\s*service|bdaas|business development as a service|تطوير الأعمال كخدمة/i;
  function isRevos(o) {
    if (!o) return false;
    const hay = [o.title, o.ref, o.items, (o.subscriptions || []).map((s) => s.name).join(' ')].join(' ');
    return PLAN_NAME.test(hay);
  }
  // Four states. A client who paid an hour ago is "being activated", not "not
  // subscribed" — that reads as if the payment was lost. And every registered
  // client gets 30 days of the service without buying it, so "no order" is a
  // trial, not a locked door.
  //
  // The trial dates come from the server (state.bd), anchored to the
  // organization's registration date. Never recompute them here: a browser that
  // decides its own eligibility grants itself a fresh fortnight on every
  // storage clear.
  function revosPlan() {
    const mine = state.orders.filter(isRevos);
    const live = mine.find((o) => ACTIVE.includes(o.status) || DONE.includes(o.status));
    if (live) return { state: 'active', order: live };
    const pending = mine.find((o) => o.status !== 'ملغي');
    if (pending) return { state: 'pending', order: pending };
    const bd = state.bd;
    if (bd && bd.state === 'trial') return { state: 'trial', order: null, days: bd.days, endsAt: bd.endsAt };
    if (bd && bd.state === 'expired') return { state: 'expired', order: null };
    // The server can declare the workspace open with no order behind it: the
    // open-access policy, or the owner (api/_trial.js openFor). Before this
    // branch existed that answer fell through to 'none', so the owner saw
    // "not subscribed yet" and seven sections tagged "with plan" — on a
    // workspace the server had just said was theirs.
    if (bd && bd.state === 'subscribed') return { state: 'open', order: null, open: !!bd.open };
    return { state: 'none', order: null };
  }
  // Is the workspace open to them right now — by subscription, trial or policy?
  function planOpen() {
    const st = revosPlan().state;
    return st === 'active' || st === 'trial' || st === 'open';
  }
  // The terms they accepted at checkout, shown back to them.
  function planTerms(o) {
    const s = (o && o.subscriptions && o.subscriptions[0]) || null;
    if (!s) return '';
    return s.commissionPercent
      ? L(`renews at ${s.renewsAt} SAR/month · ${s.commissionPercent}% success fee on collected revenue`,
          `يتجدد بـ ${s.renewsAt} ﷼ شهرياً · عمولة نجاح ${s.commissionPercent}% على الإيراد المحصّل`)
      : L(`renews at ${s.renewsAt} SAR/month · no commission`, `يتجدد بـ ${s.renewsAt} ﷼ شهرياً · بدون عمولة`);
  }

  const views = {
    overview() {
      const plan = revosPlan();
      const o = orderSummary();
      const bar = (color, head, sub, cta) =>
        `<div class="dash-card" style="padding:16px 18px;border-inline-start:4px solid ${color}"><b>${head}</b><br><small style="color:#6B7280">${sub}</small>${cta ? `<div style="margin-top:10px">${cta}</div>` : ''}</div>`;
      const dayWord = (n) => (lang === 'en' ? (n === 1 ? 'day' : 'days') : (n === 1 ? 'يوم' : n === 2 ? 'يومان' : n <= 10 ? 'أيام' : 'يومًا'));
      const banner =
        plan.state === 'active'
          ? bar('#168A5B', L('BD as a Service is active', 'اشتراك تطوير الأعمال كخدمة مفعّل'),
              [esc(plan.order.items || plan.order.title || ''), planTerms(plan.order),
               L('your pipeline fills as the team runs it', 'يمتلئ الـPipeline مع تشغيل الفريق لباقتك')].filter(Boolean).join(' · '))
          : plan.state === 'pending'
          ? bar('#0B1B5A', L('Your subscription was received — being activated', 'استلمنا اشتراكك — قيد التفعيل'),
              [`<b dir="ltr">${esc(plan.order.ref)}</b>`, esc(plan.order.items || ''), planTerms(plan.order),
               L('we are verifying your transfer; the workspace opens as soon as it is confirmed.', 'نتحقق من تحويلك الآن، وتُفتح مساحتك فور التأكيد.')].filter(Boolean).join(' · '))
          : plan.state === 'trial'
          ? bar('#168A5B',
              L(`Free trial — ${plan.days} ${dayWord(plan.days)} left`, `تجربة مجانية — باقٍ ${plan.days} ${dayWord(plan.days)}`),
              L('The workspace is open to you at no cost. Subscribe before it ends to keep it and to have our team run the pipeline for you.',
                'المساحة مفتوحة لك بلا مقابل. اشترك قبل انتهائها للاحتفاظ بها وليشغّل فريقنا الـPipeline نيابةً عنك.'),
              pkgCta())
          : plan.state === 'expired'
          ? bar('#B7791F', L('Your free trial has ended', 'انتهت تجربتك المجانية'),
              L('Subscribe to reopen the workspace and put the team on your pipeline.',
                'اشترك لإعادة فتح المساحة ووضع الفريق على الـPipeline الخاص بك.'),
              pkgCta())
          : plan.state === 'open'
          ? bar('#168A5B', L('This workspace is open to you', 'المساحة مفتوحة لك'),
              L('Every section is available. Fill in your business-development profile and the matching companies appear under "Matching companies".',
                'كل الأقسام متاحة لك. عبّئ ملف تطوير الأعمال وتظهر الشركات المطابقة تحت «الشركات المطابقة».'),
              `<a class="dash-btn primary" href="${lang === 'en' ? '/account' : '/ar/account'}?view=bdprofile" style="text-decoration:none">${L('Open my profile', 'افتح ملفي')}</a>`)
          : bar('#B7791F', L('This workspace is ready — BD as a Service is not subscribed yet', 'مساحتك جاهزة — اشتراك تطوير الأعمال كخدمة غير مفعّل بعد'),
              L('Opportunities, meetings and commissions appear here once a package is running.', 'الفرص والاجتماعات والعمولات تظهر هنا بمجرد تشغيل باقتك.'),
              pkgCta());

      // These are BD-as-a-Service numbers — opportunities generated FOR the client.
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
      // During the trial the honest message is not "buy a package" — the client
      // already has the service. It is "tell us your market and we start".
      const onTrial = revosPlan().state === 'trial';
      return `${head(L('Opportunities & pipeline', 'الفرص والـPipeline'), L('Opportunities Business Partner generates for you — never your own orders with us.', 'الفرص التي يبنيها لك Business Partner — وليست طلباتك لدينا.'))}
      ${onTrial
        ? emptyState(L('Your trial is open — tell us who to target', 'تجربتك مفتوحة — أخبرنا بمن نستهدف'),
            L('Send us your sector, target market and average deal size, and we start building the target list during the trial. Every account we target, qualify and take to a meeting appears here with its value, stage and next action.',
              'أرسل لنا قطاعك والسوق المستهدف ومتوسط قيمة الصفقة، ونبدأ ببناء قائمة الاستهداف خلال التجربة. وكل حساب نستهدفه ونؤهله ونصل به إلى اجتماع يظهر هنا بقيمته ومرحلته والإجراء التالي.'),
            startCta())
        : emptyState(L('No opportunities generated yet', 'لا توجد فرص مولّدة بعد'),
            L('Once a BD as a Service package is running, every account we target, qualify and take to a meeting shows up here with its value, stage and next action. Your own service orders with Business Partner live in the client portal.',
              'بمجرد تشغيل باقة تطوير الأعمال كخدمة، يظهر هنا كل حساب نستهدفه ونؤهله ونصل به إلى اجتماع، بقيمته ومرحلته والإجراء التالي. أما طلبات خدماتك لدى Business Partner فمكانها منصّة العملاء.'),
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
    // Matching companies: the client's profile against the companies database.
    // Fetched on first open, not at load — it is a Notion query and most visits
    // never reach this tab. Rows carry no contact details; each phone/e-mail is
    // revealed one company at a time and logged server-side.
    matches() {
      const m = state.matches;
      const profileLink = `${lang === 'en' ? '/account' : '/ar/account'}?view=bdprofile`;
      if (!m || m.loading) {
        if (!m) loadMatches();
        return head(L('Matching companies', 'الشركات المطابقة'), L('Companies in our database that fit what you sell and who you target.', 'شركات في قاعدتنا تناسب ما تبيعه ومن تستهدفه.')) +
          `<div class="dash-card" style="text-align:center;padding:60px">${L('Finding matches…', 'جارٍ البحث عن المطابقات…')}</div>`;
      }
      if (m.error === 'not_open') {
        return head(L('Matching companies', 'الشركات المطابقة'), '') + emptyState(L('Matching opens with your workspace', 'المطابقة تُفتح مع مساحتك'), L('Subscribe, or use your free days, and the matching companies appear here.', 'اشترك أو استخدم أيامك المجانية وتظهر الشركات المطابقة هنا.'), pkgCta());
      }
      if (m.error) {
        return head(L('Matching companies', 'الشركات المطابقة'), '') + emptyState(L('Could not load matches', 'تعذّر تحميل المطابقات'), L('Try again in a moment.', 'أعد المحاولة بعد قليل.'), `<button class="dash-btn" onclick="window.bpReloadMatches()">${L('Retry', 'إعادة المحاولة')}</button>`);
      }
      if (!m.ready) {
        return head(L('Matching companies', 'الشركات المطابقة'), '') + emptyState(L('Tell us who you target first', 'أخبرنا من تستهدف أولاً'), L('Pick at least one sector in your business-development profile and the matching companies appear here.', 'اختر قطاعاً واحداً على الأقل في ملف تطوير الأعمال وتظهر الشركات المطابقة هنا.'), `<a class="dash-btn primary" href="${profileLink}" style="text-decoration:none">${L('Open my profile', 'افتح ملفي')}</a>`);
      }
      const crit = [m.sectors.join('، '), m.cities.length ? m.cities.join('، ') : ''].filter(Boolean).join(' · ');
      const rows = m.companies.map((c) => {
        const site = c.website ? `<a href="${esc(c.website)}" target="_blank" rel="noopener">${esc(c.website.replace(/^https?:\/\//, ''))}</a>` : '—';
        const contact = c.phone || c.email
          ? [c.phone ? `<span dir="ltr">${esc(c.phone)}</span>` : '', c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''].filter(Boolean).join('<br>')
          : (c.hasPhone || c.hasEmail)
            ? `<button class="dash-btn" data-reveal="${esc(c.id)}">${L('Show contact', 'أظهر التواصل')}</button>`
            : '—';
        return [`<b>${esc(c.name)}</b>${c.description ? `<br><small style="color:#6B7280">${esc(c.description.slice(0, 140))}</small>` : ''}`, esc(c.why || c.sector), esc(c.city || '—'), site, contact];
      });
      return head(L('Matching companies', 'الشركات المطابقة'), L('Matched on: ', 'مطابقة على: ') + esc(crit), `<a class="dash-btn" href="${profileLink}" style="text-decoration:none">${L('Edit targets', 'عدّل الاستهداف')}</a>`) +
        (rows.length
          ? `<article class="dash-card">${table([L('Company', 'الشركة'), L('Why', 'السبب'), L('City', 'المدينة'), L('Website', 'الموقع'), L('Contact', 'التواصل')], rows)}</article>` +
            (m.has_more ? `<div style="text-align:center;margin-top:12px"><button class="dash-btn" onclick="window.bpMoreMatches()">${L('Load more', 'تحميل المزيد')}</button></div>` : '') +
            `<p style="color:#6B7280;font-size:12.5px;margin:12px 4px 0">${L('Contacts are shown one company at a time and each request is logged. Use them for legitimate B2B outreach under the Saudi PDPL.', 'بيانات التواصل تُعرض شركةً شركة وكل طلب يُسجَّل. استخدمها للتواصل التجاري المشروع وفق نظام حماية البيانات.')}</p>`
          : emptyState(L('No companies match yet', 'لا شركات مطابقة بعد'), L('Widen your sectors or cities in the profile — the database grows every week.', 'وسّع القطاعات أو المدن في ملفك — القاعدة تنمو كل أسبوع.'), `<a class="dash-btn primary" href="${profileLink}" style="text-decoration:none">${L('Edit targets', 'عدّل الاستهداف')}</a>`));
    },
  };
  function opsPost(body) {
    return fetch('/api/requests', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => r.json().catch(() => ({})));
  }
  function loadMatches(cursor) {
    const prev = cursor && state.matches ? state.matches : null;
    state.matches = { loading: true };
    if (!cursor) render();
    opsPost({ action: 'ops-bd-matches', cursor: cursor || '' }).then((o) => {
      if (!o || !o.ok) { state.matches = { error: (o && o.error) || 'failed' }; return render(); }
      const companies = prev ? prev.companies.concat(o.companies || []) : (o.companies || []);
      state.matches = { ready: !!o.ready, companies, sectors: o.sectors || [], cities: o.cities || [], has_more: !!o.has_more, next_cursor: o.next_cursor || '' };
      render();
    }).catch(() => { state.matches = { error: 'network' }; render(); });
  }
  window.bpReloadMatches = () => loadMatches();
  window.bpMoreMatches = () => { const m = state.matches; if (m && m.next_cursor) loadMatches(m.next_cursor); };
  // One reveal per click; the row is updated in place once the server answers.
  content.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-reveal]');
    if (!btn) return;
    const id = btn.getAttribute('data-reveal');
    btn.disabled = true; btn.textContent = L('…', '…');
    opsPost({ action: 'ops-bd-reveal', id }).then((o) => {
      const m = state.matches;
      if (!o || !o.ok || !m || !m.companies) { btn.disabled = false; btn.textContent = L('Show contact', 'أظهر التواصل'); return; }
      const i = m.companies.findIndex((c) => c.id === id);
      if (i >= 0) m.companies[i] = { ...m.companies[i], phone: o.company.phone, email: o.company.email };
      render();
    });
  });
  // Sections that activate with a running BD-as-a-Service package — honest empty
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

  // Seven of the twelve sections only fill up once the service is actually
  // running for this client. Left unmarked they read as broken pages, so the
  // sidebar says so rather than letting them discover seven identical blanks.
  //
  // Called from render(), not at load: whether the service is running depends on
  // the orders and the trial, and neither has arrived yet when this file
  // executes. Tagging every section "with plan" to a client whose free trial is
  // live would be telling them they lack something they have.
  function markSections() {
    const open = planOpen();
    Object.keys(soon).forEach((k) => {
      const btn = nav.querySelector('button[data-view="' + k + '"]');
      if (!btn) return;
      btn.style.opacity = open ? "" : "0.62";
      btn.title = open ? "" : L("Activates with a BD as a Service subscription", "تُفعَّل مع اشتراك تطوير الأعمال كخدمة");
      const existing = btn.querySelector("small[data-plan-tag]");
      if (open) { if (existing) existing.remove(); return; }
      if (existing) return;
      const tag = document.createElement("small");
      tag.setAttribute("data-plan-tag", "1");
      tag.textContent = L("with plan", "مع الباقة");
      tag.style.cssText = "margin-inline-start:auto;font-size:10px;font-weight:800;background:#EEF1F8;color:#0B1B5A;padding:1px 7px;border-radius:20px";
      btn.appendChild(tag);
    });
  }

  const TITLES_AR = { overview: 'نظرة عامة', matches: 'الشركات المطابقة', accounts: 'الحسابات المستهدفة', leads: 'العملاء المحتملون', pipeline: 'الفرص والـPipeline', meetings: 'الاجتماعات', campaigns: 'الحملات والتواصل', suppliers: 'الموردون والطلبات', revenue: 'الإيرادات والتحصيل', commissions: 'العمولات', tasks: 'المهام وSLA', documents: 'المستندات', reports: 'التقارير' };
  const titles = new Proxy({}, { get: (_, k) => (lang === 'en' ? (NAV_EN[k] || '') : (TITLES_AR[k] || '')) });
  let current = 'overview';
  function render() {
    if (!state.loaded && !state.error) { content.innerHTML = `<div class="dash-card" style="text-align:center;padding:60px">${L('Loading your data…', 'جارٍ تحميل بياناتك…')}</div>`; return; }
    if (state.error) { content.innerHTML = emptyState(L('Could not load your data', 'تعذّر تحميل البيانات'), L('Sign in from the client portal, then come back to the dashboard.', 'سجّل الدخول من منصّة العملاء ثم عد إلى اللوحة.'), `<a class="dash-btn primary" href="${lang === 'en' ? '/account' : '/ar/account'}?redirect=revenue" style="text-decoration:none">${L('Sign in', 'تسجيل الدخول')}</a>`); return; }
    content.innerHTML = (views[current] || views.overview)();
    if (title) title.textContent = titles[current] || '';
    markSections();
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
    if (crumb) crumb.textContent = 'Business Partner / BD as a Service';
  })();

  render();
  const jf = (u) => fetch(u, { credentials: 'same-origin' }).then((r) => r.json()).catch(() => null);
  Promise.all([
    jf('/api/requests?action=my-orders'),
    jf('/api/requests?action=my-overview'),
    jf('/api/requests?action=my-ops&what=tasks'),
    jf('/api/requests?action=my-ops&what=documents'),
  ]).then(([ord, ov, tk, dc]) => {
    if (ord && ord.ok) { state.orders = ord.orders || []; state.bd = ord.bd || null; }
    else if (ord && ord.error === 'unauthorized') { location.href = '/ar/account?redirect=revenue'; return; }
    if (ov && ov.ok) state.overview = ov;
    if (tk && tk.ok) state.tasks = tk.items || [];
    if (dc && dc.ok) state.documents = dc.items || [];
    state.loaded = true;
    render();
  }).catch(() => { state.error = true; render(); });
})();
