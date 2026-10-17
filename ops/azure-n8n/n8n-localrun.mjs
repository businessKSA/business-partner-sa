// Minimal local executor for the n8n workflows built in this folder (test tool, 2026-10-17).
// Why: the public n8n API cannot execute a workflow, and activating test copies on the shared Azure instance needs the owner's
// approval. This runs the REAL deployed workflow JSON against a LOCAL Postgres (never the production one) and stubbed models.
// Supported nodes: executeWorkflowTrigger, code (all items), postgres executeQuery(+Tool), if, set, httpRequest (model stub),
// executeWorkflow (recursive), noOp. Anything else throws, so a test can never silently skip a node.
import pg from "pg";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

export function makeRunner({ pgConfig, loadWorkflow, model, now = () => new Date() }) {
  const pool = new pg.Pool(pgConfig);
  const staticData = new Map(); // workflowId -> object
  const log = [];

  // ---- expressions
  const evalExpr = (src, scope) => {
    const fn = new Function("scope", `with (scope) { return (${src}); }`);
    return fn(scope);
  };
  const resolve = (value, scope) => {
    if (typeof value !== "string" || !value.startsWith("=")) return value;
    const body = value.slice(1);
    const m = body.match(/^\s*\{\{([\s\S]*)\}\}\s*$/);
    if (m && !/\}\}[\s\S]*\{\{/.test(m[1])) return evalExpr(m[1], scope);
    return body.replace(/\{\{([\s\S]*?)\}\}/g, (_, e) => { const v = evalExpr(e, scope); return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); });
  };
  const resolveDeep = (v, scope) => {
    if (Array.isArray(v)) return v.map((x) => resolveDeep(x, scope));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveDeep(x, scope)]));
    return resolve(v, scope);
  };

  async function runWorkflow(wfId, items, depth = 0) {
    if (depth > 4) throw new Error("sub-workflow depth");
    const wf = await loadWorkflow(wfId);
    const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
    const outputs = {}; // nodeName -> items (last run)
    const branches = {}; // nodeName -> [items per output index]
    const sd = staticData.get(wfId) || (wf.staticData && typeof wf.staticData === "object" ? JSON.parse(JSON.stringify(wf.staticData)) : {}); staticData.set(wfId, sd);
    const start = wf.nodes.find((n) => /executeWorkflowTrigger$/.test(n.type));
    if (!start) throw new Error("no executeWorkflowTrigger in " + wf.name);
    const finals = [];
    const queue = [{ node: start, items: items.map((j) => ({ json: j })) }];
    let steps = 0;
    while (queue.length) {
      if (++steps > 400) throw new Error("too many steps in " + wf.name);
      const { node, items: inItems } = queue.shift();
      if (node.disabled) continue;
      const nodeOut = await execNode(node, inItems);
      outputs[node.name] = nodeOut.main ? nodeOut.main.flat() : [];
      branches[node.name] = nodeOut.main || [];
      const conns = (wf.connections[node.name] || {}).main || [];
      let any = false;
      (nodeOut.main || []).forEach((its, idx) => {
        for (const t of (conns[idx] || [])) { any = true; if (its.length || nodeOut.forward) queue.push({ node: byName[t.node], items: its }); }
      });
      if (!any) finals.push(...(nodeOut.main || []).flat());
    }
    return { items: finals.map((i) => i.json), outputs, branches, wf };

    function scopeFor(node, inItems, idx) {
      const $ = (name) => {
        const its = outputs[name];
        if (!its) { const e = new Error(`Node '${name}' hasn't run`); throw e; }
        return { first: () => its[0], last: () => its[its.length - 1], all: () => its, item: its[idx] || its[0] };
      };
      return {
        $json: (inItems[idx] || { json: {} }).json, $, $now: { toISO: () => now().toISOString(), setZone: () => ({ toFormat: () => "" }) }, $input: { all: () => inItems, first: () => inItems[0], item: inItems[idx] },
        $getWorkflowStaticData: () => sd, $fromAI: (_k, _d, _t, def) => def,
        JSON, Date, Math, String, Number, Array, Object, Boolean, RegExp, Set, Map, parseInt, parseFloat, isNaN, encodeURIComponent, console,
      };
    }

    async function execNode(node, inItems) {
      const t = node.type.split(".").pop();
      const p = node.parameters || {};
      const fail = (e) => { throw new Error(`[${wf.name}] node "${node.name}": ${e.message}`); };
      try {
        if (t === "executeWorkflowTrigger") return { main: [inItems] };
        if (t === "noOp") return { main: [inItems] };
        if (t === "code") {
          const sc = scopeFor(node, inItems, 0);
          const fn = new AsyncFunction("$input", "$", "$getWorkflowStaticData", "$json", "$now", "console", "JSON", "Date", p.jsCode);
          const res = await fn(sc.$input, sc.$, sc.$getWorkflowStaticData, sc.$json, sc.$now, console, JSON, Date);
          const arr = Array.isArray(res) ? res : res ? [res] : [];
          return { main: [arr.map((r) => ({ json: r.json ?? r }))] };
        }
        if (t === "set") {
          const outs = inItems.map((it, idx) => {
            const sc = scopeFor(node, inItems, idx); const o = p.includeOtherFields ? { ...it.json } : {};
            for (const a of p.assignments.assignments) o[a.name] = resolve(a.value, sc);
            return { json: o };
          });
          return { main: [outs] };
        }
        if (t === "if") {
          const yes = [], no = [];
          inItems.forEach((it, idx) => {
            const sc = scopeFor(node, inItems, idx); const c = p.conditions.conditions[0];
            const left = resolve(c.leftValue, sc); const op = c.operator;
            let ok;
            if (op.type === "boolean") ok = op.operation === "true" ? (left === true || left === "true") : (left === false || left === "false");
            else if (op.operation === "equals") ok = String(left) === String(c.rightValue);
            else if (op.operation === "notEmpty") ok = left != null && String(left) !== "";
            else throw new Error("if op " + op.operation);
            (ok ? yes : no).push(it);
          });
          return { main: [yes, no], forward: false };
        }
        if (t === "postgres" || t === "postgresTool") {
          const outs = [];
          const list = inItems.length ? inItems : [{ json: {} }];
          for (let idx = 0; idx < list.length; idx++) {
            const sc = scopeFor(node, list, idx);
            const params = p.options?.queryReplacement ? resolve(p.options.queryReplacement, sc) : [];
            try {
              const r = await pool.query(p.query, Array.isArray(params) ? params : []);
              log.push({ node: node.name, rows: r.rowCount });
              outs.push(...(r.rows || []).map((row) => ({ json: row })));
            } catch (e) {
              if (node.onError === "continueRegularOutput") { outs.push({ json: { error: e.message } }); log.push({ node: node.name, error: e.message }); }
              else throw e;
            }
          }
          if (!outs.length && node.alwaysOutputData) outs.push({ json: {} });
          return { main: [outs] };
        }
        if (t === "httpRequest") {
          if (!/openai\.azure\.com/.test(p.url)) throw new Error("only the model endpoint is stubbed; got " + p.url);
          const outs = [];
          for (let idx = 0; idx < inItems.length; idx++) {
            const sc = scopeFor(node, inItems, idx); const body = JSON.parse(resolve(p.jsonBody, sc));
            const content = await model(body, node.name);
            outs.push({ json: { choices: [{ message: { content } }], usage: { total_tokens: 0 } } });
          }
          return { main: [outs] };
        }
        if (t === "executeWorkflow") {
          const id = p.workflowId?.value || p.workflowId;
          const outs = [];
          for (let idx = 0; idx < inItems.length; idx++) {
            let payload = inItems[idx].json;
            if (p.workflowInputs?.value) { const sc = scopeFor(node, inItems, idx); payload = resolveDeep(p.workflowInputs.value, sc); }
            const r = await runWorkflow(id, [payload], depth + 1);
            outs.push(...r.items.map((j) => ({ json: j })));
          }
          if (p.options?.waitForSubWorkflow === false) return { main: [inItems] };
          return { main: [outs] };
        }
        throw new Error("unsupported node type " + node.type);
      } catch (e) { fail(e); }
    }
  }
  return { runWorkflow, pool, log, staticData, close: () => pool.end() };
}
