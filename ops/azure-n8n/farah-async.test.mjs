// The three Code nodes of the async wrapper, run with n8n's globals stubbed.
import test from "node:test";
import assert from "node:assert/strict";
import { CODE_MAKE_JOB, CODE_STORE, CODE_LOOKUP, buildWorkflow, NAME } from "./farah-async.mjs";

const run = (src, { sd, input, nodes = {} }) => {
  const $input = { first: () => ({ json: input }) };
  const $ = (n) => ({ first: () => ({ json: nodes[n] }) });
  return new Function("$getWorkflowStaticData", "$input", "$", src)(() => sd, $input, $);
};

test("make job: stores pending, returns payload, prunes old jobs", () => {
  const sd = { jobs: { old: { t: 1, status: "done" } } };
  const out = run(CODE_MAKE_JOB, { sd, input: { body: { message: "hi", target_agent: "badr-intake" } } })[0].json;
  assert.match(out.job_id, /^j[a-z0-9]+$/);
  assert.equal(sd.jobs[out.job_id].status, "pending");
  assert.equal(sd.jobs.old, undefined);
  assert.deepEqual(out.payload, { message: "hi", target_agent: "badr-intake", source: "command_space" });
});

test("store: reply -> done; empty/error -> error", () => {
  const sd = { jobs: {} };
  run(CODE_STORE, { sd, input: { reply: "VOICE: تمام" }, nodes: { "Make Job": { job_id: "a1" } } });
  assert.deepEqual([sd.jobs.a1.status, sd.jobs.a1.reply], ["done", "VOICE: تمام"]);
  run(CODE_STORE, { sd, input: { error: { message: "boom" } }, nodes: { "Make Job": { job_id: "a2" } } });
  assert.equal(sd.jobs.a2.status, "error");
  run(CODE_STORE, { sd, input: {}, nodes: { "Make Job": { job_id: "a3" } } });
  assert.equal(sd.jobs.a3.status, "error");
});

test("lookup: unknown = pending, done returns reply, bad id rejected", () => {
  const sd = { jobs: { x: { status: "done", reply: "R" }, y: { status: "error", error: "E" } } };
  const look = (job) => run(CODE_LOOKUP, { sd, input: { query: { job } } })[0].json;
  assert.deepEqual(look("x"), { status: "done", reply: "R" });
  assert.deepEqual(look("y"), { status: "error", error: "E" });
  assert.deepEqual(look("nope"), { status: "pending" });
  assert.equal(look("../x").status, "error");
});

test("workflow: inactive-by-construction shape, both hooks header-auth, no secret literals", () => {
  const wf = buildWorkflow({ farahWebhookUrl: "https://n8n.example/webhook/P", pathIn: "a", pathResult: "b" });
  assert.equal(wf.name, NAME);
  assert.equal(wf.active, undefined);
  const hooks = wf.nodes.filter((n) => n.type === "n8n-nodes-base.webhook");
  assert.equal(hooks.length, 2);
  for (const h of hooks) assert.equal(h.parameters.authentication, "headerAuth");
  for (const k of Object.keys(wf.connections)) assert.ok(wf.nodes.some((n) => n.name === k));
  assert.ok(!JSON.stringify(wf).includes("X-BP-Farah-Key"));
});
