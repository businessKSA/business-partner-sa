// تشغيل محلي للوحة الموحّدة بلا Azure: ملفات ثابتة + نفس وسيط /api/bp/* + n8n وهمي.
//   node ai-space/dev-server.mjs            # http://localhost:4280 ببيانات وهمية
// لا يلمس أي خدمة حقيقية ولا يقرأ أسراراً. (المايك يعمل على localhost.)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { handle } = require("./api/_lib/proxy.js");
const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4280);
const MOCK = PORT + 1;

const env = {
  ...process.env,
  BP_LOCAL_ALLOW_ANON: "1",
  BP_N8N_BASE: process.env.BP_N8N_BASE || `http://127.0.0.1:${MOCK}`,
  BP_PATH_DATA: process.env.BP_PATH_DATA || "/mock/data",
  BP_PATH_PULSE: process.env.BP_PATH_PULSE || "/mock/pulse",
  BP_PATH_HEALTH: process.env.BP_PATH_HEALTH || "/mock/health",
  BP_PATH_CHAT: process.env.BP_PATH_CHAT || "/mock/chat",
};

// n8n وهمي: يردّ بشكل الحمولات الحقيقية.
http.createServer((req, res) => {
  const j = (o) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    if (req.url === "/mock/data") return j({ generated_at: new Date().toISOString(), agents: [{ agent_id: "chief_of_staff", agent_name: "فرح", status: "active" }, { agent_id: "badr_sales", status: "active" }], tasks: [{ task_id: "T1", assigned_to_agent: "badr_sales", status: "queued", objective: "عرض تجريبي" }], deals: [], kpis: [], campaigns: [], integrations: [] });
    if (req.url === "/mock/pulse") return j({ at: new Date().toISOString(), totals: { active: 2, open: 1, in_progress: 1 }, agents: { badr_sales: { open: 1, in_progress: 1, latest_objective: "عرض تجريبي" } }, needs_owner: [{ task_id: "T9", objective: "اعتماد عرض", next_action: "راجع واعتمد", priority: "P1", created_by: "badr_sales" }] });
    if (req.url === "/mock/health") return j({ reply: "حيّة" });
    if (req.url === "/mock/chat") { let m = {}; try { m = JSON.parse(b); } catch {} return j({ reply: "VOICE: وصلني: " + String(m.message || "").slice(0, 40) + "\n[[DETAILS]]\n(رد وهمي محلي)", seen_target: m.target_agent }); }
    res.statusCode = 404; res.end("{}");
  });
}).listen(MOCK, "127.0.0.1");

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".md": "text/plain" };
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/bp/")) {
    let raw = ""; for await (const c of req) raw += c;
    const out = await handle({ op: u.pathname.slice(8), method: req.method, headers: req.headers, query: Object.fromEntries(u.searchParams), rawBody: raw }, env, fetch);
    res.writeHead(out.status, out.headers); return res.end(out.body);
  }
  let f = path.join(here, u.pathname === "/" ? "index.html" : u.pathname);
  if (!f.startsWith(here) || f.includes(`${path.sep}api${path.sep}`)) { res.statusCode = 404; return res.end(); }
  if (u.pathname === "/config.js" && !fs.existsSync(f)) f = path.join(here, "config.example.js");
  fs.readFile(f, (e, d) => { if (e) { res.statusCode = 404; return res.end("not found"); } res.setHeader("content-type", types[path.extname(f)] || "application/octet-stream"); res.end(d); });
}).listen(PORT, () => console.log(`BP AI Space (محلي، بيانات وهمية): http://localhost:${PORT}`));
