// أدوات الفريق — ما يستطيع الوكيل فعله حقاً، لا ما يدّعيه.
//
// المبدأ: **الحوكمة تُفرَض في الكود لا في البرومبت.** البرومبت رجاء، والكود
// حاجز. وقد رأينا في n8n وكيلاً «ناجحاً» لم يستدعِ أحداً، وآخر يعد بسعر من
// عنده. فكل ما يمسّ عميلاً أو مالاً يمرّ من هنا ويُفحص.

import { loadCatalog, normalizeText } from "../../api/_catalog.js";
import { sb, DB_ON } from "../../api/_db.js";

const q = (s) => encodeURIComponent(String(s == null ? "" : s));
const N8N_BASE = (process.env.BP_N8N_BASE || "").replace(/\/+$/, "");
const N8N_KEY = (process.env.BP_N8N_HOOK_KEY || "").trim();
const DRY = process.env.AGENTS_DRY_RUN === "1";

/* ——————————————— حاجز الالتزامات ———————————————
 * أي رقم ريال، أو وعد بعقد أو توقيع أو موعد ملزم، لا يخرج إلى عميل من وكيل.
 * يُسجَّل «بانتظار الموافقة» ويقف. هذا نصّ قاعدة المالك، وهو هنا شرطٌ لا نصيحة.
 *
 * الفحص نصّي متعمَّد البساطة: نموذج يقنع نفسه بأن جملته ليست التزاماً، وتعبير
 * نمطي لا يقتنع. والخطأ في جانب المنع يكلّف رسالةً تتأخر؛ وفي جانب السماح
 * يكلّف سعراً مخترعاً في يد عميل.
 */
const COMMIT_RE = /(\d[\d,]*\s*(ريال|ر\.س|﷼|sar)|السعر\s*(النهائي|هو)|نوقّع|التوقيع\s*غد|أضمن|ضمان\s*(القبول|الموافقة)|خصم\s*\d)/i;

export function commitmentIn(text) {
  const m = String(text || "").match(COMMIT_RE);
  return m ? m[0] : null;
}

// ——————————————————— التعريفات التي يراها النموذج ———————————————————

export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "catalog_search",
      description: "يبحث في كتالوج خدمات Business Partner الرسمي. المصدر الوحيد المسموح للأسعار وأسماء الخدمات وروابطها.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "ما يطلبه العميل بكلماته (عربي أو إنجليزي)" },
          limit: { type: "integer", description: "عدد النتائج، الافتراضي ٥" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "requests_list",
      description: "يقرأ طلبات العملاء من قاعدة Business Partner. يستعمل لجولة المتابعة ولمعرفة حالة عميل.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "NEW أو REVIEWING أو QUOTE_SENT … اتركه فارغاً لكل الحالات" },
          email: { type: "string", description: "بريد العميل للبحث عن طلباته وحده" },
          stale_hours: { type: "integer", description: "أعِد ما لم يُحدَّث منذ هذا العدد من الساعات" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_note",
      description: "يضيف ملاحظة أو حدثاً إلى سجلّ طلب عميل. كل عمل ملموس ينتهي بأثر مكتوب هنا.",
      parameters: {
        type: "object",
        properties: {
          ref: { type: "string", description: "مرجع الطلب مثل BP-R-XXXXXX" },
          event: { type: "string", description: "اسم الحدث، مثل followup.sent أو note.added" },
          note: { type: "string", description: "نص الملاحظة" },
        },
        required: ["ref", "event", "note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_message",
      description: "يرسل رسالة فعلية لعميل عبر واتساب أو بريد. يُرفض تلقائياً إذا احتوى النص التزاماً (سعر نهائي، عقد، ضمان) — عندها سجّله بـ pending_approval بدلاً منه.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["whatsapp", "email"] },
          to: { type: "string", description: "رقم دولي أو بريد" },
          text: { type: "string" },
          agent: { type: "string", description: "اسمك: mazen أو badr أو farah أو mohammed أو baher" },
        },
        required: ["channel", "to", "text", "agent"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pending_approval",
      description: "يسجّل أمراً يحتاج موافقة المالك ويقف عنده: سعر نهائي، عقد، دفع، إجراء حكومي، أو رسالة رُفضت لاحتوائها التزاماً.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          details: { type: "string", description: "ما المطلوب اعتماده بالضبط، وعلى أي طلب" },
          ref: { type: "string", description: "مرجع الطلب إن وُجد" },
        },
        required: ["title", "details"],
      },
    },
  },
];

// ——————————————————————— التنفيذ ———————————————————————

async function catalogSearch({ query, limit = 5 }) {
  const cat = await loadCatalog();
  const words = normalizeText(query).split(" ").filter((w) => w.length > 2);
  const scored = (cat.services || []).map((s) => ({
    s, score: words.reduce((n, w) => n + (s.search && s.search.includes(w) ? 1 : 0), 0),
  })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.min(limit, 10));

  if (!scored.length) return { found: 0, services: [], ملاحظة: "لا خدمة مطابقة — لا تخترع واحدة، أحِل العميل إلى /services" };
  return {
    found: scored.length,
    services: scored.map(({ s }) => ({
      code: s.code, nameAr: s.nameAr, price: s.price, priceLabel: s.priceLabel,
      govFeesSeparate: s.govFeesSeparate, requiresProposal: s.requiresProposal, url: s.url,
    })),
  };
}

async function requestsList({ status, email, stale_hours, limit = 20 }) {
  if (!DB_ON) return { error: "قاعدة البيانات غير مهيّأة (SUPABASE_URL/SUPABASE_SERVICE_KEY أو LOCAL_DB=1)" };
  const parts = ["select=ref,type,status,title,client_name,client_email,client_phone,company_name,created_at,updated_at"];
  if (status) parts.push(`status=eq.${q(status)}`);
  if (email) parts.push(`client_email=eq.${q(String(email).toLowerCase())}`);
  if (stale_hours) parts.push(`updated_at=lt.${q(new Date(Date.now() - stale_hours * 3600e3).toISOString())}`);
  parts.push(`order=updated_at.desc`, `limit=${Math.min(Number(limit) || 20, 100)}`);
  const rows = await sb(`requests?${parts.join("&")}`);
  return { count: (rows || []).length, requests: rows || [] };
}

async function requestNote({ ref, event, note }) {
  if (!DB_ON) return { error: "قاعدة البيانات غير مهيّأة" };
  const rows = await sb(`requests?ref=eq.${q(ref)}&select=id&limit=1`);
  if (!rows || !rows.length) return { error: `لا طلب بالمرجع ${ref}` };
  await sb("request_events", {
    method: "POST", prefer: "return=minimal",
    body: { request_id: rows[0].id, actor_kind: "ai", actor: "bp-agents", event: String(event).slice(0, 80), details: { note: String(note).slice(0, 2000) } },
  });
  await sb(`requests?id=eq.${rows[0].id}`, { method: "PATCH", prefer: "return=minimal", body: { updated_at: new Date().toISOString() } });
  return { ok: true, ref };
}

async function sendMessage({ channel, to, text, agent }) {
  // الحاجز قبل الشبكة: ما يُرفض لا يُرسل ولا يُحاوَل.
  const hit = commitmentIn(text);
  if (hit) {
    return {
      ok: false, blocked: true, matched: hit,
      ملاحظة: `الرسالة تحتوي التزاماً («${hit}») فلم تُرسل. استدعِ pending_approval بنصّها ليعتمدها المالك.`,
    };
  }
  if (DRY || !N8N_BASE || !N8N_KEY) {
    return { ok: true, simulated: true, channel, to, preview: String(text).slice(0, 200), ملاحظة: DRY ? "وضع التجربة" : "n8n غير مهيّأ (BP_N8N_BASE/BP_N8N_HOOK_KEY) — لم تُرسل فعلياً" };
  }
  const r = await fetch(`${N8N_BASE}/webhook/bp-agent-send`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-BP-Agent-Key": N8N_KEY },
    body: JSON.stringify({ channel, to, text, agent }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) return { ok: false, error: `n8n_http_${r.status}` };
  return { ok: true, channel, to };
}

async function pendingApproval({ title, details, ref }) {
  if (!DB_ON) return { error: "قاعدة البيانات غير مهيّأة" };
  const row = {
    title: String(title).slice(0, 200),
    details: { text: String(details).slice(0, 4000), ref: ref || null },
    assignee: "owner", source: "agent", status: "pending",
    human_action: true, urgency: "normal",
    created_at: new Date().toISOString(),
  };
  if (ref) {
    const rows = await sb(`requests?ref=eq.${q(ref)}&select=id&limit=1`);
    if (rows && rows.length) row.request_id = rows[0].id;
  }
  await sb("tasks", { method: "POST", prefer: "return=minimal", body: row });
  return { ok: true, ملاحظة: "سُجّل بانتظار موافقة المالك. لا تنفّذه ولا تعِد العميل به." };
}

const IMPL = {
  catalog_search: catalogSearch,
  requests_list: requestsList,
  request_note: requestNote,
  send_message: sendMessage,
  pending_approval: pendingApproval,
};

/* عطل أداة لا يُسقط الجولة: يعود نصاً للنموذج ليقرّر — يعيد المحاولة أو
   يبلّغ المنسّق. رمي الاستثناء هنا كان يفقد كل عمل الجولة قبله. */
export async function runTool(name, args) {
  const fn = IMPL[name];
  if (!fn) return { error: `أداة غير معروفة: ${name}` };
  try {
    return await fn(args || {});
  } catch (e) {
    return { error: String(e.message || e).slice(0, 300) };
  }
}
