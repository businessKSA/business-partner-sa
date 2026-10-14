#!/usr/bin/env node
// نقل السير من n8n Cloud إلى n8n على Azure عبر الواجهة العامة (/api/v1).
//
//   N8N_SRC_URL=https://businesspartnerai.app.n8n.cloud N8N_SRC_KEY=... \
//     node ops/n8n-migrate.mjs export ./n8n-export
//   N8N_DST_URL=https://<fqdn> N8N_DST_KEY=... \
//     node ops/n8n-migrate.mjs import ./n8n-export [--activate]
//
// المفاتيح تُنشأ من n8n → Settings → n8n API، وتُمرَّر متغيّرات بيئة لا في سطر
// الأوامر ولا في المحادثة. الاعتمادات (OAuth والمفاتيح) لا تُصدَّر من الواجهة
// بحكم تصميمها: تُنشأ يدوياً في الوجهة بالأسماء نفسها ثم تُربط بالسير.
//
// الاستيراد يُنشئ السير **غير مفعّلة** ما لم يُمرَّر --activate، لأن تفعيلها قبل
// الاعتمادات يشغّل المؤقّتات بلا مصادقة، وتفعيلها وهي نشطة في Cloud يُكرّر
// الرسائل. الترتيب الآمن: الاستيراد ← الاعتمادات ← إطفاء Cloud ← التفعيل.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [cmd, dir = "./n8n-export", ...flags] = process.argv.slice(2);
const api = (base, key) => async (path, init = {}) => {
  const r = await fetch(`${base.replace(/\/+$/, "")}/api/v1${path}`, {
    ...init,
    headers: { "X-N8N-API-KEY": key, "content-type": "application/json", ...(init.headers || {}) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${init.method || "GET"} ${path} → ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : {};
};

// الحقول المسموحة عند الإنشاء؛ غيرها يرفضه n8n.
const clean = (w) => ({
  name: w.name,
  nodes: w.nodes,
  connections: w.connections,
  settings: Object.fromEntries(
    Object.entries(w.settings || {}).filter(([k]) =>
      ["executionOrder", "timezone", "saveDataErrorExecution", "saveDataSuccessExecution",
       "saveManualExecutions", "saveExecutionProgress", "executionTimeout", "errorWorkflow",
       "callerPolicy", "callerIds"].includes(k)),
  ),
});

if (cmd === "export") {
  const { N8N_SRC_URL, N8N_SRC_KEY } = process.env;
  if (!N8N_SRC_URL || !N8N_SRC_KEY) throw new Error("ينقص N8N_SRC_URL / N8N_SRC_KEY");
  const src = api(N8N_SRC_URL, N8N_SRC_KEY);
  await mkdir(dir, { recursive: true });
  let cursor = "", n = 0, active = [];
  do {
    const page = await src(`/workflows?limit=100${cursor ? `&cursor=${cursor}` : ""}`);
    for (const w of page.data) {
      const full = await src(`/workflows/${w.id}`);
      await writeFile(join(dir, `${w.id}.json`), JSON.stringify(full));
      if (full.active) active.push(w.id);
      n++;
    }
    cursor = page.nextCursor || "";
  } while (cursor);
  await writeFile(join(dir, "_active.json"), JSON.stringify(active));
  console.log(`صُدِّر ${n} سيراً، منها ${active.length} نشطاً → ${dir}`);
} else if (cmd === "import") {
  const { N8N_DST_URL, N8N_DST_KEY } = process.env;
  if (!N8N_DST_URL || !N8N_DST_KEY) throw new Error("ينقص N8N_DST_URL / N8N_DST_KEY");
  const dst = api(N8N_DST_URL, N8N_DST_KEY);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  const activeIds = new Set(JSON.parse(await readFile(join(dir, "_active.json"), "utf8").catch(() => "[]")));
  const idMap = {}; let ok = 0, fail = 0;
  for (const f of files) {
    const w = JSON.parse(await readFile(join(dir, f), "utf8"));
    try {
      const made = await dst("/workflows", { method: "POST", body: JSON.stringify(clean(w)) });
      idMap[w.id] = made.id; ok++;
    } catch (e) { fail++; console.error("فشل", w.name, "—", e.message); }
  }
  await writeFile(join(dir, "_idmap.json"), JSON.stringify(idMap, null, 2));
  // المرور الثاني: السير تشير إلى بعضها بمعرّفات (Execute Sub-workflow وerrorWorkflow)
  // وبعقد HTTP تنادي عنوان Cloud نفسه. بعد الاستيراد تتغيّر المعرّفات والعنوان،
  // فيُستبدل كل ذلك نصّاً ثم تُحدَّث السير. ما لم يُستبدل يبقى ينادي Cloud.
  const { N8N_SRC_URL } = process.env;
  const srcHost = N8N_SRC_URL ? new URL(N8N_SRC_URL).host : "";
  const dstHost = new URL(N8N_DST_URL).host;
  let patched = 0;
  for (const [oldId, newId] of Object.entries(idMap)) {
    const w = JSON.parse(await readFile(join(dir, `${oldId}.json`), "utf8"));
    let text = JSON.stringify(clean(w));
    for (const [o, n] of Object.entries(idMap)) text = text.split(o).join(n);
    if (srcHost) text = text.split(srcHost).join(dstHost);
    try { await dst(`/workflows/${newId}`, { method: "PUT", body: text }); patched++; }
    catch (e) { console.error("تعذّر تحديث المراجع في", w.name, "—", e.message); }
  }
  console.log(`حُدِّثت المراجع الداخلية في ${patched} سيراً.`);
  console.log(`استُورد ${ok}، فشل ${fail}. معرّفات السير تغيّرت — الخريطة في ${dir}/_idmap.json`);
  if (flags.includes("--activate")) {
    for (const [oldId, newId] of Object.entries(idMap)) {
      if (!activeIds.has(oldId)) continue;
      try { await dst(`/workflows/${newId}/activate`, { method: "POST" }); }
      catch (e) { console.error("تعذّر التفعيل", newId, e.message); }
    }
  }
} else {
  console.error("الاستعمال: export <dir> | import <dir> [--activate]");
  process.exit(1);
}
