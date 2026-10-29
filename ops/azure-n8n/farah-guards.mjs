// Pure guard functions for Farah's inbox/reply workflows on Azure n8n.
// Each function is SELF-CONTAINED (no outer references) because build-farah-inbox.mjs injects
// its source text (fn.toString()) into n8n Code nodes; the same functions are unit-tested in
// farah-guards.test.mjs. Never put secrets here.

// ---- 1) classify a website chat payload coming from api/requests.js -> hot / cold + alert text
export function classifyChat(body) {
  const b = body && typeof body === "object" ? body : {};
  const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, n);
  const rawSid = clean(b.sid, 80).replace(/^WEB-/i, "").replace(/[^A-Za-z0-9_-]/g, "");
  const name = clean(b.name, 120);
  const phone = clean(b.phone, 40).replace(/[^\d+]/g, "");
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean(b.email, 160)) ? clean(b.email, 160).toLowerCase() : "";
  const msgs = (Array.isArray(b.messages) ? b.messages : []).map((m) => ({
    role: m && m.role === "user" ? "user" : "bot",
    content: clean(m && (m.content != null ? m.content : m.text), 1200),
  })).filter((m) => m.content);
  const users = msgs.filter((m) => m.role === "user");
  const lastUser = (users[users.length - 1] || {}).content || "";
  const wants = users.slice(-3).map((m) => m.content).join(" ← ").slice(0, 400);
  const joined = users.map((m) => m.content).join("\n");
  const reasons = [];
  if (phone) reasons.push("ترك رقم جوال");
  if (email) reasons.push("ترك بريداً");
  if (b.hot === true || String(b.hot) === "true") reasons.push("وُسمت ساخنة من الموقع");
  if (/(أبغى|أبي|ابغى|ابي|أريد|اريد|أحتاج|احتاج|ودي)[^\n]{0,40}(خدمة|عرض|تأسيس|رخصة|سجل|استقدام|تأشيرة|عقد|فاتورة|حساب|شركة|موظف)|عرض\s*سعر|كم\s*(السعر|تكلفة|يكلف|التكلفة)|اشتر|ابدأ|ابدا|سجلوني|تواصلوا|كلموني|اتصل|\b(quote|price|buy|sign up|contact me|call me)\b/i.test(joined)) reasons.push("نية شراء/طلب عرض");
  if (/(شكوى|غاضب|زعلان|سيء|مو راضي|غير راضي|نصب|احتيال|استرداد|ارجاع|إرجاع|مشكلة|تأخر|متأخر|complain|refund|angry|scam)/i.test(joined)) reasons.push("شكوى أو غضب");
  const hot = reasons.length > 0;
  const wa_id = rawSid ? "WEB-" + rawSid : "";
  const who = name || "زائر بلا اسم";
  const lines = [
    `🔔 ${hot ? "عميل جديد من الموقع" : "محادثة من الموقع"}`,
    `الاسم: ${who}`,
    `الجوال: ${phone || "لم يترك رقماً"}`,
  ];
  if (email) lines.push(`البريد: ${email}`);
  lines.push(`يريد: ${wants || lastUser || "—"}`.slice(0, 520));
  if (reasons.length) lines.push(`السبب: ${reasons.join("، ")}`);
  lines.push(phone || email ? "← تواصل الآن" : "← لا وسيلة تواصل؛ ردّ من «الوارد» في /ops");
  return {
    valid: !!wa_id && users.length > 0,
    wa_id, name, phone, email, hot, reasons,
    last_user: lastUser.slice(0, 1500),
    title: `${who}${phone ? " · " + phone : ""} — ${(wants || lastUser).slice(0, 80)}`.slice(0, 200),
    detail: lines.join("\n"),
    alert: lines.join("\n"),
  };
}

// ---- 2) guard for «Reply To Client (Safe)»
// input:  { action, who, channel, text, baher_order, approved_by_baher, wa_window_confirmed }
// cands:  rows from farah.messages grouped by wa_id: { wa_id, name, phone, email, last_ts, last_wa_in }
// now:    epoch ms
export function replyGuard(input, cands, now) {
  const j = input || {};
  const action = String(j.action || "send");
  const who = String(j.who || "").trim();
  const channel = String(j.channel || "").toLowerCase();
  const text = String(j.text || "").trim();
  const order = String(j.baher_order || "").trim();
  const approved = String(j.approved_by_baher || "").toLowerCase() === "true";
  const windowOk = String(j.wa_window_confirmed || "").toLowerCase() === "true";
  const rows = (Array.isArray(cands) ? cands : []).filter((c) => c && c.wa_id);
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const reasons = [];
  let target = null;

  // narrow: an exact id / full phone / full email match beats fuzzy name matches
  const w = who.toLowerCase();
  const exact = rows.filter((c) => c.wa_id.toLowerCase() === w || (c.email && c.email.toLowerCase() === w) || (digits(who).length >= 9 && digits(c.phone).endsWith(digits(who).slice(-9))));
  const pool = exact.length ? exact : rows;
  const slim = (c) => ({ id: c.wa_id, name: c.name || "", phone: c.phone || "", email: c.email || "", last: c.last_ts || "" });

  if (action === "lookup") {
    return { ok: true, sent: false, blocked: false, count: pool.length, candidates: pool.slice(0, 6).map(slim),
      next_step: pool.length === 1 ? "مرشّح واحد: تأكدي من الاسم مع باهر ثم أرسلي action=send." : pool.length ? "أكثر من مرشّح: اعرضيهم مرقّمين على باهر واسأليه أيهم، ولا ترسلي قبل أن يحدّد." : "لا مرشّح معروف: اسأليه عن الاسم أو الجوال." };
  }

  if (!who) reasons.push("لم يُحدَّد الطرف");
  if (/[,;؛،\n]/.test(who)) reasons.push("طرف واحد فقط في كل استدعاء");
  if (order.length < 3) reasons.push("لا يوجد أمر صريح من باهر (baher_order) — لا ردّ بلا أمره في محادثته");
  if (!["whatsapp", "email"].includes(channel)) reasons.push("قناة غير مدعومة (whatsapp أو email)");
  if (!text) reasons.push("نص الرد فارغ");
  if (text.length > 1500) reasons.push("النص أطول من 1500 حرف");
  if (who && !/[,;؛،\n]/.test(who)) {
    if (pool.length === 0) reasons.push("الطرف غير معروف في سجل المحادثات — اسألي باهر عن الاسم أو الجوال");
    else if (pool.length > 1) reasons.push("أكثر من مرشّح (" + pool.slice(0, 4).map((c) => c.name || c.phone || c.wa_id).join("، ") + ") — اسألي باهر أيهم قبل الإرسال");
    else target = pool[0];
  }
  if (target) {
    if (channel === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target.email || "")) reasons.push("هذه المحادثة بلا بريد صالح");
    if (channel === "whatsapp") {
      const d = digits(target.phone);
      if (d.length < 9 || d.length > 15) reasons.push("هذه المحادثة بلا رقم جوال صالح");
      const lastIn = target.last_wa_in ? Date.parse(target.last_wa_in) : 0;
      if (!windowOk && !(lastIn && now - lastIn < 24 * 3600 * 1000)) reasons.push("لا ردّ من العميل على واتساب خلال 24 ساعة (الخطأ 131047) — استعملي البريد أو قالباً معتمداً، أو أكّدي أن العميل راسل باهر مؤخراً (wa_window_confirmed=true)");
    }
  }
  if (!approved) {
    const sensitive = /(\d[\d,.،]*\s*(ريال|ر\.س|SAR|﷼|دولار|USD|\$))|السعر\s*(النهائي|هو)|خصم|تخفيض|نضمن|أضمن|ضمان|نتعهد|نلتزم|عرض\s*سعر|\bprice\b|\bdiscount\b|\bguarantee/i.test(text);
    if (sensitive) reasons.push("فيه سعر أو خصم أو ضمان أو التزام — يحتاج موافقة باهر الصريحة على النص نفسه (approved_by_baher=true)");
    if (/(وزارة|قوى|مقيم|زاتكا|الزكاة|التأمينات|GOSI|أبشر|مدد)/.test(text) && /(سنقدّم|سنقدم|نلتزم|نتعهد|نضمن|مضمون)/.test(text)) reasons.push("التزام حكومي — يحتاج موافقة باهر الصريحة");
  }
  const blocked = reasons.length > 0;
  return {
    ok: !blocked, blocked, sent: false,
    reasons: reasons.join(" | "),
    target: target ? slim(target) : null,
    id: target ? target.wa_id : "",
    channel, text,
    confirm_commitment: approved,
    next_step: blocked ? "لم يُرسل شيء. أخبري باهر بالسبب، وسجّلي بنداً بـ Create Pending إن لزم موافقته، ثم أعيدي الاستدعاء بعد جوابه الصريح." : "",
  };
}

// ---- 3) the day digest for non-hot conversations
export function buildDigest(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && r.wa_id);
  if (!list.length) return { has: false, text: "" };
  const cold = list.filter((r) => !r.hot);
  const hot = list.filter((r) => r.hot);
  const lines = [`🗒️ ملخص محادثات الموقع (آخر 24 ساعة): ${list.length} محادثة — ${hot.length} ساخنة سبق تنبيهك بها، ${cold.length} للعلم.`];
  cold.slice(0, 12).forEach((r, i) => lines.push(`${i + 1}. ${r.name || "زائر"}${r.phone ? " · " + r.phone : ""} — ${String(r.last_body || "").replace(/\s+/g, " ").slice(0, 90)}`));
  if (cold.length > 12) lines.push(`… و${cold.length - 12} أخرى في «الوارد» في /ops.`);
  return { has: cold.length > 0, text: lines.join("\n").slice(0, 3500) };
}
