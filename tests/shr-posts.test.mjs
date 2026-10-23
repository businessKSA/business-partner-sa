// SHR-HR: إعلانات الوظائف (بوست توظيف) — الدورة داخل النظام فقط، على قاعدة JSON المحلية.
// عزل المستأجر، من يكتب لا يعتمد، حرس المحتوى، القناة غير المفعّلة، حجب المنشأة المقيّدة،
// الوظيفة المغلقة، الدورة بلا قفز، لا حذف، المقترح القاعدي بلا شبكة. Run: npm test
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shr-posts-"));
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_DIR = dir;
const { default: handler } = await import("../api/shr.js");
const { ctxFrom, scoped, tenantBySlug } = await import("../api/_shr.js");
const posts = await import("../api/_shr_posts.js");

const fail = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail.push(m); };
const throws = (f) => { try { f(); return false; } catch { return true; } };

async function call(method, payload, cookie = "") {
  const req = { method, body: method === "POST" ? payload : undefined, query: method === "GET" ? payload : {}, cookies: cookie ? { shr_session: cookie } : {} };
  let status = 200, body = null; const headers = {};
  const res = { setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, status: (c) => { status = c; return res; }, json: (o) => { body = o; return res; } };
  await handler(req, res);
  return { status, body, headers };
}
async function login(slug, email) {
  const r = await call("POST", { action: "session", slug, email });
  const m = /shr_session=([^;]*)/.exec(r.headers["set-cookie"] || "");
  return { r, cookie: m ? m[1] : "" };
}
const ops = await login("SHR", "ops@shr.invalid");
const owner = await login("SHR", "owner@shr.invalid");
const other = await login("OTHER", "ops@other.invalid");
const comp = await login("SHR", "compliance@shr.invalid");
const client = await login("SHR", "a-admin@client.invalid");
const agency = await login("SHR", "agency-a@shr.invalid");
const get = async (action, q, who = ops) => (await call("GET", { action, ...q }, who.cookie)).body;
const post = (action, b, who = ops) => call("POST", { action, ...b }, who.cookie);
const list = async (who = ops) => (await get("posts", {}, who)).posts;

const T = { A: await tenantBySlug("SHR"), B: await tenantBySlug("OTHER") };
const dbA = scoped(ctxFrom({ tenant_id: T.A.id, role: "tenant_owner" }));
const dbB = scoped(ctxFrom({ tenant_id: T.B.id, role: "tenant_owner" }));
const jobs = (await get("jobs")).jobs;                       // 0,1 مفتوحتان؛ 2 مغلقة
const ests = await dbA.get("shr_establishments?select=id,name_ar&order=created_at.asc");   // 0 unknown · 1 clear · 2 restricted · 3 suspected
const [jOpen, jOpen2, jClosed] = jobs;
const base = { job_id: jOpen.id, establishment_id: ests[1].id, title: "مطلوب فني تكييف", description: "نبحث عن فني تكييف للعمل في الرياض.", requirements: "• خبرة لا تقل عن 5 سنوات" };
const mk = async (b = {}, who = ops) => { const r = await post("post-create", { ...base, ...b }, who); return r.body && r.body.post ? r.body.post.id : null; };
const status = async (id, who = ops) => ((await list(who)).find((p) => p.id === id) || {}).status;

console.log("\n1. Isolation: the three new tables, straight through the gate");
for (const t of ["shr_job_posts", "shr_job_post_events"]) {
  const ra = await dbA.get(t), rb = await dbB.get(t);
  const idsA = new Set(ra.map((r) => r.id));
  ok(ra.length > 0 && rb.length > 0, `${t}: both tenants seeded (${ra.length}/${rb.length})`);
  ok(ra.every((r) => r.tenant_id === T.A.id) && rb.every((r) => r.tenant_id === T.B.id) && rb.every((r) => !idsA.has(r.id)), `${t}: own tenant_id, nothing crosses`);
}
ok((await dbA.get("shr_post_channels")).length === 2 && (await dbA.get("shr_post_channels")).every((c) => c.channel_enabled === false), "shr_post_channels: two non-private channels, both disabled");
ok(throws(() => dbA.get(`shr_job_posts?tenant_id=eq.${T.B.id}`)) && throws(() => dbA.post("shr_job_posts", { tenant_id: T.B.id })) && throws(() => dbA.del()), "gate refuses tenant override and delete on posts");
const seedA = await list(), seedB = await list(other);
ok(seedA.length === 4 && seedB.length === 1, `posts per tenant (${seedA.length}/${seedB.length})`);
ok(!seedA.some((p) => seedB.some((q) => q.id === p.id)) && !JSON.stringify(seedA).includes("لمستأجر آخر"), "no cross-tenant post in either list");
const fp = seedB[0].id;
for (const [action, b] of [["post-update", { title: "xx yy" }], ["post-submit", {}], ["post-approve", {}], ["post-publish", {}], ["post-close", {}]]) {
  ok((await post(action, { id: fp, ...b })).status === 404, `${action} on a foreign post -> 404`);
}
ok((await post("post-applicant-add", { post_id: fp, candidate_id: (await get("candidates")).candidates[0].id })).status === 404, "applicant on a foreign post -> 404");
ok((await post("post-create", { ...base, job_id: (await get("jobs", {}, other)).jobs[0].id })).status === 404, "post on a foreign job -> 404");
const estB = (await dbB.get("shr_establishments?select=id&limit=1"))[0].id;
ok((await post("post-create", { ...base, establishment_id: estB })).status === 404, "post on a foreign establishment -> 404");
ok((await post("post-create", { ...base, tenant_id: "x" })).status === 400 && (await get("posts", { tenant_id: "x" })).error === "tenant_id_forbidden", "tenant_id in body/query refused");

console.log("\n2. Seed: four posts in different states, one blocked by a restricted establishment");
const byStatus = Object.fromEntries(seedA.map((p) => [p.status, p]));
ok(["draft", "pending_approval", "approved", "published"].every((s) => byStatus[s]), "draft / pending_approval / approved / published all seeded");
ok(byStatus.approved.blocked && byStatus.approved.blocked.state === "restricted" && !byStatus.draft.blocked && !byStatus.published.blocked, "the approved post is shown blocked (restricted demo establishment)");
ok(byStatus.published.applicants === 4 && byStatus.draft.applicants === 0, `applicants counted per post (${byStatus.published.applicants})`);
ok(byStatus.published.salary_min === 2500 && seedA.filter((p) => p.salary_min !== null).length === 1, "only one seeded post carries a (demo) salary range, entered by a person");
const dump = JSON.stringify(seedA);
const cn = await dbA.get("shr_client_companies?select=id,name_ar");
ok(!/client_company_id|"client"/.test(dump) && !cn.some((c) => dump.includes(c.name_ar) || dump.includes(c.id)), "post DTO carries no client id or name");
ok(seedA.every((p) => p.channel === "shr_private" && p.demo === true), "every seeded post is shr_private and demo");
ok((await list()).filter((p) => p.status === "published").every((p) => p.approved_by_name && p.approved_by_name !== p.created_by_name), "published: approver differs from writer");

console.log("\n3. Lifecycle: draft -> pending_approval -> approved -> published -> closed, and nothing skips");
const id = await mk({ title: "مطلوب فني تكييف — الدورة الكاملة", headcount: 99 });
ok(!!id && (await status(id)) === "draft", "post-create makes a draft");
ok((await list()).find((p) => p.id === id).headcount === jOpen.headcount, "headcount comes from the job, not the request");
ok((await post("post-update", { id, description: "نص أدق للإعلان." })).status === 200, "post-update on a draft");
ok((await post("post-update", { id })).status === 400, "update with nothing to change -> 400");
for (const [a, to] of [["post-approve", "approved"], ["post-publish", "published"]]) {
  const r = await post(a, { id }, owner);
  ok(r.status === 409 && r.body.error === "bad_transition", `draft cannot ${a} (no jumping)`);
}
const sub = await post("post-submit", { id });
ok(sub.status === 200 && sub.body.post.status === "pending_approval", "post-submit");
ok((await post("post-update", { id, title: "تعديل متأخر" })).status === 409, "no editing once submitted (409 not_draft)");
ok((await post("post-submit", { id })).status === 409 && (await post("post-publish", { id }, owner)).status === 409, "pending cannot resubmit or publish");
const mc = await post("post-approve", { id });
ok(mc.status === 403 && mc.body.error === "maker_checker", "the writer cannot approve (maker-checker)");
ok((await status(id)) === "pending_approval", "...and the post stayed pending");
ok((await post("post-approve", { id }, owner)).status === 200 && (await status(id)) === "approved", "another staff user approves");
ok((await post("post-submit", { id })).status === 409 && (await post("post-update", { id, title: "xx yy" })).status === 409, "approved: no resubmit, no edit");
const pub = await post("post-publish", { id }, owner);
ok(pub.status === 200 && pub.body.post.status === "published" && pub.body.post.visibility === "shr_private_only", "post-publish -> published (shr_private only)");
const row = (await dbA.get(`shr_job_posts?id=eq.${id}`))[0];
ok(row.channel === "shr_private" && row.approved_by && row.approved_by !== row.created_by && row.published_by && row.published_at, "stored: private channel, approver != writer, publisher recorded");
const hist = (await list()).find((p) => p.id === id).history;
ok(hist.map((h) => h.to).join(",") === "draft,pending_approval,approved,published", "event log has every step in order: " + hist.map((h) => h.to).join(","));
const audits = (await dbA.get("shr_audit_log?select=action,entity_id")).filter((a) => a.entity_id === id).map((a) => a.action);
ok(["post.create", "post.update", "post.status.draft->pending_approval", "post.status.pending_approval->approved", "post.status.approved->published"].every((a) => audits.includes(a)), "audit log has create/update and every state change");
const cl = await post("post-close", { id, reason: "اكتمل التوظيف التجريبي" });
ok(cl.status === 200 && (await status(id)) === "closed", "post-close");
ok((await post("post-close", { id })).status === 200, "closing again is idempotent");
for (const a of ["post-submit", "post-approve", "post-publish", "post-update"]) ok((await post(a, { id, title: "xx yy" }, owner)).status === 409, `closed post: ${a} -> 409`);
ok((await dbA.get(`shr_job_post_events?post_id=eq.${id}`)).length === 5, "five events for the full life");
const idOf = (await post("post-close", { id: await mk() })).body.post.id;
ok((await status(idOf)) === "closed", "a draft can be closed (archived) too, never deleted");

console.log("\n4. Maker-checker both ways");
const idO = await mk({ title: "مطلوب سائق — اعتماد المالك" }, owner);
ok((await post("post-submit", { id: idO }, owner)).status === 200, "owner submits own post");
ok((await post("post-approve", { id: idO }, owner)).body.error === "maker_checker", "owner cannot approve own post");
ok((await post("post-approve", { id: idO }, ops)).status === 200, "operator approves the owner's post");
ok((await post("post-close", { id: idO }, ops)).status === 200, "tidy up");

console.log("\n5. Content guard in the server (400 with the reason): licence, compliance, guarantee, government outcome, invented salary, contact, client name");
const BAD = [
  ["licence_claim", "شركة مرخصة من الوزارة", {}], ["licence_claim", "نحن نعمل بترخيص رسمي", {}], ["licence_claim", "Licensed by the ministry", {}],
  ["compliance_claim", "نحن ملتزمون بالأنظمة", {}], ["compliance_claim", "إجراءات متوافقة مع نظام العمل ومعتمدون رسمياً", {}], ["compliance_claim", "fully compliant", {}],
  ["guarantee", "نضمن لك الوظيفة", {}], ["guarantee", "قبول مؤكد بدون رفض", {}], ["guarantee", "100% نجاح", {}],
  ["gov_outcome_promise", "نستخرج لك التأشيرة", {}], ["gov_outcome_promise", "إقامة جاهزة خلال أسبوع", {}], ["gov_outcome_promise", "نوفر لك الإقامة", {}],
  ["invented_salary", "الراتب ٥٠٠٠ ريال", {}], ["invented_salary", "راتب 4 آلاف", {}], ["invented_salary", "ثلاثة آلاف ريال شهرياً", {}],
  ["invented_salary", "الراتب 3000 ريال", { salary_min: 3500, salary_max: 4000 }],
  ["contact_info", "تواصل واتساب ٠٥٠١٢٣٤٥٦٧", {}], ["contact_info", "راسل hr@example.com", {}], ["contact_info", "زر www.example.sa", {}],
  ["client_name", `نعمل مع ${cn[0].name_ar}`, {}],
];
for (const [code, text, extra] of BAD) {
  const r = await post("post-create", { ...base, description: text, ...extra });
  const codes = ((r.body && r.body.reasons) || []).map((x) => x.code);
  ok(r.status === 400 && r.body.error === "content_rejected" && codes.includes(code) && r.body.reasons.every((x) => x.field && x.match), `create rejects ${code}: ${text}`);
}
ok((await post("post-create", { ...base, title: "نضمن لك وظيفة" })).body.reasons[0].field === "title", "the reason names the field (title)");
ok((await post("post-create", { ...base, requirements: "واتساب" })).status === 400 && (await post("post-create", { ...base, city: "info@x.com" })).status === 400, "requirements and city are guarded too");
const draftId = await mk();
for (const [code, text] of [["guarantee", "نضمن لك وظيفة"], ["licence_claim", "شركة مرخصة"], ["invented_salary", "الراتب 5000 ريال"]]) {
  const r = await post("post-update", { id: draftId, description: text });
  ok(r.status === 400 && r.body.reasons.some((x) => x.code === code), `update rejects ${code}`);
}
ok((await dbA.get(`shr_job_posts?id=eq.${draftId}`))[0].description === base.description, "a rejected update changed nothing");
ok((await post("post-create", { ...base, description: "رخصة قيادة سارية. خبرة لا تقل عن 5 سنوات خلال 3 أيام من الاعتماد." })).status === 200, "a driving-licence requirement and plain numbers are not false positives");
const sal = await post("post-create", { ...base, description: "الراتب 3000 - 4000 ريال", salary_min: 3000, salary_max: 4000 });
ok(sal.status === 200, "a salary written in the text is accepted only when it equals the human-entered range");
const salRow = (await dbA.get(`shr_job_posts?id=eq.${sal.body.post.id}`))[0];
ok(salRow.salary_entered_by === (await dbA.get("shr_users?email=eq.ops@shr.invalid"))[0].id, "salary_entered_by = the person who typed it");
ok((await post("post-create", { ...base, salary_min: 4000, salary_max: 3000 })).body.error === "bad_salary_range" && (await post("post-create", { ...base, salary_min: -1 })).body.error === "bad_salary" && (await post("post-create", { ...base, salary_max: "x" })).body.error === "bad_salary", "bad salary values refused");
ok((await post("post-create", { ...base, title: "" })).body.error === "title_required" && (await post("post-create", { ...base, language: "fr" })).body.error === "bad_language", "title and language validated");
// الحرس يعمل مجدداً عند الإرسال: مسودة مكتوبة بالتحايل على الخادم لا تمرّ.
const sneaky = (await dbA.post("shr_job_posts", { job_id: jOpen.id, establishment_id: ests[1].id, title: "مطلوب", description: "نضمن لك الإقامة", requirements: null, city: "الرياض", headcount: 1, language: "ar", salary_min: null, salary_max: null, salary_entered_by: null, status: "draft", channel: "shr_private", created_by: (await dbA.get("shr_users?email=eq.ops@shr.invalid"))[0].id, demo: true }))[0];
const sr = await post("post-submit", { id: sneaky.id });
ok(sr.status === 400 && sr.body.error === "content_rejected", "submit re-runs the guard on a draft that bypassed the server");

console.log("\n6. Channels: only shr_private; the others are disabled (409 channel_not_enabled)");
for (const ch of ["public_bp_jobs", "external"]) {
  const r = await post("post-create", { ...base, channel: ch });
  ok(r.status === 409 && r.body.error === "channel_not_enabled" && r.body.channel === ch, `create with ${ch} -> 409 channel_not_enabled`);
  ok((await post("post-update", { id: draftId, channel: ch })).body.error === "channel_not_enabled", `update to ${ch} -> 409`);
}
ok((await post("post-create", { ...base, channel: "tiktok" })).body.error === "bad_channel", "unknown channel -> 400");
ok((await post("post-create", { ...base, channel: "shr_private" })).status === 200, "shr_private accepted");
// حتى لو فُعّلت القناة في الإعداد فلا شيء يُنشر خارجياً في هذه المرحلة.
const chRow = (await dbA.get("shr_post_channels?channel=eq.external"))[0];
await dbA.patch(`shr_post_channels?id=eq.${chRow.id}`, { channel_enabled: true });
ok((await post("post-create", { ...base, channel: "external" })).body.error === "channel_not_implemented", "even an enabled channel is not implemented in this phase (409)");
await dbA.patch(`shr_post_channels?id=eq.${chRow.id}`, { channel_enabled: false });
const ext = (await dbA.post("shr_job_posts", { job_id: jOpen.id, establishment_id: ests[1].id, title: "مطلوب", description: null, requirements: null, city: null, headcount: 1, language: "ar", salary_min: null, salary_max: null, salary_entered_by: null, status: "approved", channel: "external", created_by: sneaky.id, approved_by: "a".repeat(8) + "-aaaa-4aaa-8aaa-" + "a".repeat(12), demo: true }))[0];
ok((await post("post-publish", { id: ext.id }, owner)).body.error === "channel_not_enabled", "publish of a row on a non-private channel is refused");

console.log("\n7. A restricted/suspected establishment blocks the publication request");
const bad1 = await mk({ establishment_id: ests[2].id });
ok(!!bad1, "a draft may be written against a restricted establishment (nothing is published)");
const s1 = await post("post-submit", { id: bad1 });
ok(s1.status === 409 && s1.body.error === "establishment_blocked" && s1.body.state === "restricted", "submit on a restricted establishment -> 409 establishment_blocked");
const bad2 = await mk({ establishment_id: ests[3].id });
ok((await post("post-submit", { id: bad2 })).body.state === "suspected", "suspected blocks too");
ok((await status(bad1)) === "draft", "blocked post stays draft");
const seededBlocked = byStatus.approved;
const pb = await post("post-publish", { id: seededBlocked.id }, owner);
ok(pb.status === 409 && pb.body.error === "establishment_blocked", "publishing the seeded approved-but-restricted post -> 409");
ok((await status(seededBlocked.id)) === "approved", "...and it stays approved");
const nb = await mk({ establishment_id: undefined });
ok((await post("post-submit", { id: nb })).body.error === "establishment_required", "no establishment: cannot be submitted (400)");
const warnId = await mk({ establishment_id: ests[0].id });
const ws = await post("post-submit", { id: warnId });
ok(ws.status === 200 && ws.body.post.warnings.includes("establishment_state_unknown"), "unknown establishment state: allowed with a warning (the tenant default)");
// تقييد المنشأة بعد الإرسال يحجب الاعتماد.
const midId = await mk({ establishment_id: ests[1].id });
await post("post-submit", { id: midId });
const ownerRow = (await dbA.get("shr_users?email=eq.owner@shr.invalid"))[0];
await dbA.post("shr_establishment_compliance", { establishment_id: ests[1].id, as_of: new Date().toISOString().slice(0, 10), restriction_state: "restricted", restriction_reason: "قيد تجريبي لاحق", entered_by: ownerRow.id, verified_by: null, verified_on: null, demo: true });
ok((await post("post-approve", { id: midId }, owner)).body.error === "establishment_blocked", "restricting the establishment after submit blocks the approval");
ok((await list()).find((p) => p.id === midId).blocked.state === "restricted", "and the list shows it blocked");
// نرفع القيد المتحقَّق منه بلقطة نظيفة يتحقق منها مستخدم آخر ليعود الوضع.
await dbA.post("shr_establishment_compliance", { establishment_id: ests[1].id, as_of: new Date(Date.now() + 86400000).toISOString().slice(0, 10), restriction_state: "clear", restriction_reason: null, entered_by: ownerRow.id, verified_by: (await dbA.get("shr_users?email=eq.ops@shr.invalid"))[0].id, verified_on: new Date().toISOString().slice(0, 10), demo: true });
ok((await post("post-approve", { id: midId }, owner)).status === 200, "a verified clear snapshot lifts it again");

console.log("\n8. A closed job cannot be advertised");
const cj = await post("post-create", { ...base, job_id: jClosed.id });
ok(cj.status === 409 && cj.body.error === "job_closed", "create on a closed job -> 409 job_closed");
ok((await post("post-suggest", { job_id: jClosed.id })).body.error === "job_closed", "suggest on a closed job -> 409");
const jid = (await post("job-create", { title: "وظيفة مؤقتة للاختبار", profession: "فني تكييف", headcount: 1 })).body.job.id;
const pj = await mk({ job_id: jid });
await post("post-submit", { id: pj });
await post("job-close", { id: jid });
ok((await post("post-approve", { id: pj }, owner)).body.error === "job_closed", "job closed after submit: approval -> 409 job_closed");
const jid2 = (await post("job-create", { title: "وظيفة مؤقتة ٢", profession: "سائق", headcount: 1 })).body.job.id;
const pj2 = await mk({ job_id: jid2 });
await post("post-submit", { id: pj2 }); await post("post-approve", { id: pj2 }, owner);
await post("job-close", { id: jid2 });
const pr = await post("post-publish", { id: pj2 }, owner);
ok(pr.status === 409 && pr.body.error === "job_closed" && (await status(pj2)) === "approved", "job closed after approval: publish -> 409 job_closed");
ok((await post("post-update", { id: draftId, job_id: jOpen2.id })).body.error === "job_not_editable", "a post cannot be moved to another job");

console.log("\n9. Applicants: operator adds an application for a candidate with active consent only");
const pubId = seedA.find((p) => p.status === "published").id;
const cands = (await get("candidates")).candidates;
const noRec = cands.find((c) => c.consent === "none"), wd = cands.find((c) => c.consent === "withdrawn");
const free = cands.find((c) => c.consent === "active" && c.profession === "حارس أمن");
const before = (await list()).find((p) => p.id === pubId).applicants;
const ad = await post("post-applicant-add", { post_id: pubId, candidate_id: free.id, note: "إدخال يدوي" });
ok(ad.status === 200 && ad.body.application.stage === "new", "applicant added for an active-consent candidate");
ok((await list()).find((p) => p.id === pubId).applicants === before + 1, "the post's applicant count went up by one");
const app = (await dbA.get(`shr_applications?candidate_id=eq.${free.id}`))[0];
ok(app.post_id === pubId && app.job_id === seedA.find((p) => p.id === pubId).job.id && app.stage === "new", "application row linked to the post and its job");
ok((await post("post-applicant-add", { post_id: pubId, candidate_id: free.id })).body.error === "duplicate_application", "duplicate -> 409");
ok((await post("post-applicant-add", { post_id: pubId, candidate_id: noRec.id })).body.error === "no_consent", "no consent record -> 409 no_consent");
ok((await post("post-applicant-add", { post_id: pubId, candidate_id: wd.id })).body.error === "no_consent", "withdrawn consent -> 409 no_consent");
ok((await dbA.get(`shr_applications?candidate_id=eq.${noRec.id}`)).length === 0 && (await dbA.get(`shr_applications?candidate_id=eq.${wd.id}`)).length === 0, "...and no application row was written for them");
ok((await post("post-applicant-add", { post_id: id, candidate_id: cands.find((c) => c.consent === "active" && c.profession === "سباك").id })).body.error === "post_not_published", "closed post accepts no applicants");
ok((await post("post-applicant-add", { post_id: seededBlocked.id, candidate_id: free.id })).body.error === "post_not_published", "unpublished post accepts none either");
ok((await post("post-applicant-add", { post_id: pubId, candidate_id: "x" })).status === 400, "bad candidate id -> 400");
// منشأة الإعلان المنشور قُيّدت لاحقاً: لا تُضاف طلبات.
const ps = (await dbA.get(`shr_job_posts?id=eq.${pubId}`))[0];
await dbA.post("shr_establishment_compliance", { establishment_id: ps.establishment_id, as_of: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), restriction_state: "suspected", restriction_reason: "اشتباه تجريبي لاحق", entered_by: ownerRow.id, verified_by: null, verified_on: null, demo: true });
ok((await post("post-applicant-add", { post_id: pubId, candidate_id: cands.find((c) => c.consent === "active" && c.profession === "سباك").id })).body.error === "establishment_blocked", "establishment restricted after publication: no new applicants (409)");

console.log("\n10. Roles: only tenant_owner / operator");
for (const [who, name] of [[comp, "compliance_officer"], [client, "client_admin"], [agency, "agency"]]) {
  const g = await call("GET", { action: "posts" }, who.cookie);
  const p = await post("post-create", base, who);
  ok(g.status === 403 && p.status === 403, `${name}: posts and post-create -> 403`);
  ok((await post("post-approve", { id: byStatus.pending_approval.id }, who)).status === 403 && (await post("post-suggest", { job_id: jOpen.id }, who)).status === 403, `${name}: approve and suggest -> 403`);
}
ok((await call("GET", { action: "posts" })).status === 401 && (await call("POST", { action: "post-create", ...base })).status === 401, "no session -> 401");
ok((await status(byStatus.pending_approval.id)) === "pending_approval", "the forbidden roles changed nothing");
ok((await call("POST", { action: "posts" }, ops.cookie)).status === 404 && (await call("GET", { action: "post-create" }, ops.cookie)).status === 404, "wrong HTTP method -> 404");

console.log("\n11. No delete");
for (const a of ["post-delete", "delete", "post-event-delete"]) ok((await post(a, { id })).status === 403 && (await post(a, { id })).body.error === "archive_only", `${a} -> 403 archive_only`);
ok(throws(() => dbA.del()) && (await dbA.get(`shr_job_posts?id=eq.${id}`)).length === 1, "the closed post is still there");
const SQL = fs.readFileSync(new URL("../db/shr-schema.sql", import.meta.url), "utf8");

console.log("\n12. The local suggestion: a rule-based template, no AI, no network, no salary");
const realFetch = globalThis.fetch; let netCalls = 0;
globalThis.fetch = () => { netCalls++; throw new Error("network is not allowed in post-suggest"); };
const countBefore = (await list()).length;
const sg = await post("post-suggest", { job_id: jOpen2.id });          // سائق، تفضيل جنسية، شرط residency
ok(sg.status === 200 && sg.body.source === "local_template" && sg.body.ai === false && netCalls === 0, "post-suggest answered from the local template, no network call");
const s = sg.body.suggestion;
ok(s.title.includes("سائق") && /الرياض/.test(s.title) && s.description.includes("2") && /خبرة لا تقل عن 3/.test(s.requirements) && /إقامة قابلة لنقل الخدمات/.test(s.requirements), "title and paragraphs filled from the job");
ok(!/\d{3,}|ريال|راتب|الأجر|باكستان|مصر/.test(JSON.stringify(sg.body.suggestion)), "no salary, no money, no nationality preference in the suggestion");
ok(posts.guardText({ title: s.title, description: s.description, requirements: s.requirements }, {}, cn.map((c) => c.name_ar)).length === 0, "the suggestion itself passes the content guard");
ok((await list()).length === countBefore, "suggest wrote nothing (it decides nothing)");
const hostile = (await post("job-create", { title: "وظيفة بمهارة مرفوضة", profession: "لحّام", headcount: 1, skills: ["لحام أرجون", "ضمان الجودة"] })).body.job.id;
const hs = await post("post-suggest", { job_id: hostile });
ok(/لحام أرجون/.test(hs.body.suggestion.requirements) && !/ضمان/.test(hs.body.suggestion.requirements) && hs.body.omitted.length === 1 && hs.body.omitted[0].codes.includes("guarantee"), "a free-text skill that fails the guard is dropped and reported");
ok((await post("post-suggest", { job_id: jOpen.id, language: "en" })).body.suggestion.title.includes("wanted") && (await post("post-suggest", { job_id: jOpen.id, language: "xx" })).status === 400, "English template; bad language refused");
ok((await post("post-suggest", { job_id: (await get("jobs", {}, other)).jobs[0].id })).status === 404, "suggest for a foreign job -> 404");
globalThis.fetch = realFetch;
const src = fs.readFileSync(new URL("../api/_shr_posts.js", import.meta.url), "utf8");
ok(!/\bfetch\s*\(|https?:\/\/|from "\.\/_db\.js"|\bsb\s*\(|node:https?|XMLHttpRequest|anthropic|openai/i.test(src), "the module has no network call, no AI client, and never touches sb() directly");

console.log("\n13. Schema: the second line of defence in Postgres");
ok(/create table if not exists shr_job_posts/.test(SQL) && /check \(approved_by is null or approved_by <> created_by\)/.test(SQL), "schema: approver != writer is a CHECK");
ok(/check \(status <> 'published' or channel = 'shr_private'\)/.test(SQL) && /channel in \('shr_private','public_bp_jobs','external'\)/.test(SQL), "schema: published only on shr_private; the other channels exist in the CHECK");
ok(/check \(\(salary_min is null and salary_max is null\) or salary_entered_by is not null\)/.test(SQL), "schema: a salary range needs the person who entered it");
ok(/shr_job_posts_guard/.test(SQL) && /illegal transition/.test(SQL) && /content is frozen after draft/.test(SQL), "schema: transition + frozen-content trigger");
ok(/'shr_job_posts','shr_job_post_events','shr_post_channels'\] loop\n    execute format\('alter table %I enable row level security'/.test(SQL), "schema: RLS on all three new tables");
ok(/'shr_job_posts','shr_post_channels'\] loop\n    execute format\('drop trigger if exists %I on %I', t \|\| '_no_delete'/.test(SQL) && /'shr_job_post_events'\] loop\n    execute format\('drop trigger if exists %I on %I', t \|\| '_append_only'/.test(SQL), "schema: no-delete on posts/channels, append-only on events");

console.log(fail.length ? `\n${fail.length} FAILED` : "\nall passed");
if (fail.length) process.exit(1);
