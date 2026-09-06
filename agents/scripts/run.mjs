// يفتح جلسة مع باهر (المنسّق) ويرسل له رسالة، ويطبع رده مباشرة.
// الاستخدام: npm run run -- "تابع العميل فلان، رقمه 9665xxxxxxx، يبغى تأسيس شركة"
//            npm run run -- --site "افحص صفحة /contact، النموذج ما يرسل"
// --site يركّب مستودع الموقع في الجلسة حتى يستطيع محمد التعديل وفتح PR.
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const agentsDir = path.resolve(here, '..');
for (const f of ['.env', 'ids.env']) {
  const p = path.join(agentsDir, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const args = process.argv.slice(2);
const withSite = args.includes('--site');
const text = args.filter((a) => a !== '--site').join(' ').trim();
if (!text) {
  console.error('اكتب الرسالة: npm run run -- "..."');
  process.exit(1);
}
const { AGENT_BAHER, ENV_ID, MEMORY_STORE_ID, VAULT_ID, GITHUB_TOKEN, ANTHROPIC_WORKSPACE = 'default' } = process.env;
for (const [k, v] of Object.entries({ AGENT_BAHER, ENV_ID, MEMORY_STORE_ID })) {
  if (!v) { console.error(`ينقص ${k}: شغّل bash agents/scripts/apply.sh`); process.exit(1); }
}

const client = new Anthropic();

const resources = [
  {
    type: 'memory_store',
    memory_store_id: MEMORY_STORE_ID,
    access: 'read_write',
    instructions: 'ذاكرة الفريق. اقرأ README.md أولًا؛ سجّل القرارات والدروس المهمة فقط.',
  },
];
if (withSite) {
  if (!GITHUB_TOKEN) { console.error('--site يحتاج GITHUB_TOKEN في agents/.env'); process.exit(1); }
  resources.push({
    type: 'github_repository',
    url: 'https://github.com/businessKSA/business-partner-sa',
    mount_path: '/workspace/business-partner-sa',
    authorization_token: GITHUB_TOKEN,
    checkout: { type: 'branch', name: 'main' },
  });
}

const session = await client.beta.sessions.create({
  agent: AGENT_BAHER,
  environment_id: ENV_ID,
  title: text.slice(0, 80),
  resources,
  ...(VAULT_ID ? { vault_ids: [VAULT_ID] } : {}),
  budget: { type: 'limit', max_list_cost: { amount: '500', currency: 'USD' } }, // سقف 5 دولار للجلسة
});
console.log(`الجلسة: ${session.id}`);
console.log(`تابعها حيًا: https://platform.claude.com/workspaces/${ANTHROPIC_WORKSPACE}/sessions/${session.id}\n`);

// افتح البث أولًا ثم أرسل، حتى لا تفوتنا الأحداث الأولى
const stream = await client.beta.sessions.events.stream(session.id);
await client.beta.sessions.events.send(session.id, {
  events: [{ type: 'user.message', content: [{ type: 'text', text }] }],
});

for await (const event of stream) {
  switch (event.type) {
    case 'agent.message':
      for (const block of event.content) if (block.type === 'text') process.stdout.write(block.text);
      process.stdout.write('\n');
      break;
    case 'session.thread_created':
      console.log(`  ↳ كلّف: ${event.agent_name}`);
      break;
    case 'agent.thread_message_received':
      console.log(`  ↲ تقرير من ${event.from_agent_name}`);
      break;
    case 'session.error':
      console.error(`\n[خطأ] ${event.error?.message ?? JSON.stringify(event.error)}`);
      break;
    case 'session.status_idle':
      if (event.stop_reason?.type === 'budget_reached') console.log('\n(توقف عند سقف الميزانية)');
      console.log('\n--- انتهى ---');
      process.exit(0);
    case 'session.status_terminated':
      console.log('\n--- أُنهيت الجلسة ---');
      process.exit(0);
  }
}
