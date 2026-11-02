#!/usr/bin/env node
// نقل سير العمل من n8n السحابي إلى n8n على Azure عبر الـAPI العام.
//
//   node azure/n8n/migrate.mjs export  <dir>      # من السحابي إلى ملفات JSON (للقراءة فقط)
//   node azure/n8n/migrate.mjs import  <dir>      # إلى Azure، **كل شيء غير نشط**
//   node azure/n8n/migrate.mjs report  <dir>      # ما يحتاج يداً: اعتمادات، ويبهوكات
//
// المتغيّرات: SRC_URL, SRC_KEY (السحابي) — DST_URL, DST_KEY (Azure).
// المفاتيح من Settings → n8n API في كل نسخة، وتُمرَّر في البيئة لا في المحادثة.
//
// ما لا ينتقل ولا يمكن نقله: **قيم الاعتمادات** (n8n لا يصدّرها بنص صريح).
// تُنشأ يدوياً في Azure بالاسم والنوع نفسيهما، ثم يربطها `import` تلقائياً بالاسم.
import fs from "node:fs";
import path from "node:path";

const [, , cmd, dir = "./n8n-export"] = process.argv;
const need = (k) => process.env[k] || (console.error(`ينقص ${k}`), process.exit(1));

async function api(base, key, p, opt = {}) {
  const r = await fetch(`${base.replace(/\/$/, "")}/api/v1${p}`, {
    ...opt, headers: { "X-N8N-API-KEY": key, "content-type": "application/json", ...(opt.headers || {}) },
  });
  if (!r.ok) throw new Error(`${opt.method || "GET"} ${p} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}
async function all(base, key, p) {
  const out = []; let cursor;
  do { const j = await api(base, key, `${p}${p.includes("?") ? "&" : "?"}limit=100${cursor ? `&cursor=${cursor}` : ""}`);
    out.push(...j.data); cursor = j.nextCursor; } while (cursor);
  return out;
}

if (cmd === "export") {
  const [url, key] = [need("SRC_URL"), need("SRC_KEY")];
  fs.mkdirSync(dir, { recursive: true });
  const list = await all(url, key, "/workflows");
  const manifest = [];
  for (const w of list) {
    const full = await api(url, key, `/workflows/${w.id}`);
    fs.writeFileSync(path.join(dir, `${w.id}.json`), JSON.stringify(full, null, 2));
    manifest.push({ id: w.id, name: w.name, active: !!full.active });
  }
  fs.writeFileSync(path.join(dir, "_manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`صُدِّر ${manifest.length} سير (نشط: ${manifest.filter((m) => m.active).length}) إلى ${dir}`);
} else if (cmd === "report") {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "_manifest.json");
  const creds = new Map(); const hooks = [];
  for (const f of files) {
    const w = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const n of w.nodes || []) {
      for (const [type, c] of Object.entries(n.credentials || {})) creds.set(`${type}|${c.name}`, (creds.get(`${type}|${c.name}`) || 0) + 1);
      if (n.type?.includes("webhook") || n.type?.includes("Trigger")) if (n.type.includes("ebhook")) hooks.push(`${w.name} → /webhook/${n.parameters?.path}`);
    }
  }
  console.log("## اعتمادات يجب إنشاؤها في Azure بالاسم نفسه (النوع | الاسم | عدد الاستعمالات)");
  [...creds].sort().forEach(([k, n]) => console.log(`- ${k} | ${n}`));
  console.log(`\n## ويبهوكات ${hooks.length} — كل مستدعٍ خارجي يجب تحويله إلى النطاق الجديد`);
  hooks.forEach((h) => console.log("- " + h));
} else if (cmd === "import") {
  const [url, key] = [need("DST_URL"), need("DST_KEY")];
  const dstCreds = await all(url, key, "/credentials").catch(() => []);
  const byName = new Map(dstCreds.map((c) => [`${c.type}|${c.name}`, c.id]));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "_manifest.json");
  const missing = new Set(); let ok = 0;
  for (const f of files) {
    const w = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const n of w.nodes || []) for (const [type, c] of Object.entries(n.credentials || {})) {
      const id = byName.get(`${type}|${c.name}`);
      if (id) n.credentials[type] = { id, name: c.name }; else { missing.add(`${type}|${c.name}`); delete n.credentials[type]; }
    }
    // نُنشئ غير نشط دائماً: التفعيل قرار منفصل بعد الاختبار، وإلا استقبل النسختان الويبهوكات معاً.
    const body = { name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings || {} };
    try { await api(url, key, "/workflows", { method: "POST", body: JSON.stringify(body) }); ok++; }
    catch (e) { console.error("فشل:", w.name, e.message); }
  }
  console.log(`استُورد ${ok}/${files.length} غير نشط.`);
  if (missing.size) { console.log("\nاعتمادات ناقصة في Azure (أنشئها ثم أعد الاستيراد):"); [...missing].sort().forEach((m) => console.log("- " + m)); }
} else { console.error("الأوامر: export | import | report"); process.exit(1); }
