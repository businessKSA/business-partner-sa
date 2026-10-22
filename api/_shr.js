// SHR-HR — بوابة العزل. كل وصول لجداول shr_* يمرّ من هنا وحدها.
//
// الخادم يتحدث إلى القاعدة بمفتاح خدمة يتجاوز RLS، فالعزل الحقيقي هو هذا
// الملف: tenant_id يُشتق من الجلسة لا من الطلب، ويُلصق بكل قراءة، ويُفرض
// على كل كتابة. من يمرّر tenant_id آخر في الجسم أو الاستعلام يُرفض بصوت عالٍ.
// ما لا يُفهم يرمي: مرشّح مجهول يعني استعلاماً بلا شرط، أي بيانات مستأجر آخر.
import { sb } from "./_db.js";

const TABLE = /^shr_[a-z_]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ROLES = ["tenant_owner", "operator", "client_admin", "client_viewer", "worker", "agency"];

// من يرى كل شيء في المستأجر، ومن يُحصر بمعرّفه.
const STAFF = new Set(["tenant_owner", "operator"]);

export function ctxFrom(user) {
  if (!user || !UUID.test(String(user.tenant_id || ""))) throw new Error("shr: no tenant in session");
  if (!ROLES.includes(user.role)) throw new Error("shr: unknown role");
  return { tenantId: user.tenant_id, role: user.role, staff: STAFF.has(user.role), user };
}

function split(path) {
  const [table, qs = ""] = String(path).split("?");
  if (!TABLE.test(table)) throw new Error("shr: not an shr_ table: " + table);
  return { table, qs };
}

function assertNoTenantOverride(qs, body) {
  if (/(^|&)tenant_id=/.test(qs)) throw new Error("shr: tenant_id in query is forbidden");
  const rows = body == null ? [] : Array.isArray(body) ? body : [body];
  for (const r of rows) {
    if ("tenant_id" in r && r.tenant_id !== undefined) throw new Error("shr: tenant_id in body is forbidden");
  }
}

// scoped(ctx, send?) — send قابل للحقن للاختبار؛ الافتراضي sb.
export function scoped(ctx, send = sb) {
  if (!ctx || !UUID.test(ctx.tenantId || "")) throw new Error("shr: scoped() needs ctx from ctxFrom()");
  const t = ctx.tenantId;
  return {
    ctx,
    get(path) {
      const { table, qs } = split(path);
      assertNoTenantOverride(qs, null);
      return send(`${table}?tenant_id=eq.${t}${qs ? "&" + qs : ""}`);
    },
    post(path, body, opts = {}) {
      const { table, qs } = split(path);
      assertNoTenantOverride(qs, body);
      const stamp = (r) => ({ ...r, tenant_id: t });
      return send(`${table}${qs ? "?" + qs : ""}`, { ...opts, method: "POST", body: Array.isArray(body) ? body.map(stamp) : stamp(body) });
    },
    patch(path, body) {
      const { table, qs } = split(path);
      assertNoTenantOverride(qs, body);
      if (!qs) throw new Error("shr: PATCH without a filter is forbidden");
      return send(`${table}?tenant_id=eq.${t}&${qs}`, { method: "PATCH", body });
    },
    // الحذف أرشفة: لا DELETE على جداول shr_.
    del() { throw new Error("shr: delete is archive-only"); },
  };
}
