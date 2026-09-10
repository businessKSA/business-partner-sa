#!/usr/bin/env node
// Validate the mail domains of a lead list before sending to it.
//
//   node mx-check.mjs domains.txt
//
// Input: a file of domains separated by commas or newlines.
// Output: mx-results.json next to the input, plus a summary on stdout.
//
// nxdomain / no_mx / invalid_syntax are guaranteed bounces — feed them into the
// DEAD_DOMAINS list in "BP — Sales DB Hygiene" and in the sender's guard node.
// a_only means the domain has no MX but does have an A record: mail may still be
// accepted via the RFC 5321 fallback, so those are risky rather than dead.

import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";

const input = process.argv[2] ?? "domains.txt";
if (!fs.existsSync(input)) {
  console.error(`no such file: ${input}`);
  process.exit(1);
}

const domains = [...new Set(
  fs.readFileSync(input, "utf8").split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
)];

dns.setServers(["8.8.8.8", "1.1.1.1"]);

async function check(d) {
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) {
    return { domain: d, status: "invalid_syntax" };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const mx = await dns.resolveMx(d);
      return mx && mx.length
        ? { domain: d, status: "ok", mx: mx.length }
        : { domain: d, status: "no_mx" };
    } catch (e) {
      if (e.code === "ENOTFOUND" || e.code === "NXDOMAIN") return { domain: d, status: "nxdomain" };
      if (e.code === "ENODATA") {
        try {
          await dns.resolve4(d);
          return { domain: d, status: "a_only" };
        } catch { return { domain: d, status: "no_mx" }; }
      }
      if (attempt === 1) return { domain: d, status: "error:" + e.code };
      await new Promise(r => setTimeout(r, 400));
    }
  }
}

const out = [];
const CONCURRENCY = 40;
let cursor = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (cursor < domains.length) out.push(await check(domains[cursor++]));
}));

const byStatus = {};
for (const r of out) (byStatus[r.status] ||= []).push(r.domain);

const outFile = path.join(path.dirname(path.resolve(input)), "mx-results.json");
fs.writeFileSync(outFile, JSON.stringify(out));

console.log(`checked ${out.length} domains -> ${outFile}\n`);
for (const [status, list] of Object.entries(byStatus).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${status}: ${list.length}`);
}

console.log("\n--- UNDELIVERABLE (add to DEAD_DOMAINS) ---");
const dead = ["nxdomain", "no_mx", "invalid_syntax"].flatMap(s => byStatus[s] ?? []).sort();
console.log(JSON.stringify(dead));

if (byStatus.a_only) {
  console.log("\n--- A-ONLY (no MX, risky) ---");
  console.log(byStatus.a_only.sort().join(", "));
}
for (const status of Object.keys(byStatus).filter(s => s.startsWith("error:"))) {
  console.log(`\n--- ${status} (broken nameservers, treat as risky) ---`);
  console.log(byStatus[status].sort().join(", "));
}
