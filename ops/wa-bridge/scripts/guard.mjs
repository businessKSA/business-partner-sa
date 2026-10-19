// حارس ثابت (`npm run check`): الإرسال في ملف واحد `outbox.mjs` وبسطر واحد،
// وأي دالة تعليم قراءة أو حضور أو تفاعل ممنوعة في كل الملفات بلا استثناء.
//
// في Baileys: `sendMessage` لا يعلّم القراءة، لكن `readMessages` و`sendReceipt`
// و`sendPresenceUpdate` و`chatModify` تفعل أو تُظهر «متصل» أو تغيّر حالة
// المحادثة على جوال المالك. تبقى كلها ممنوعة.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const SRC = new URL('../src/', import.meta.url);
const SEND_FILE = 'outbox.mjs';
const SEND_NEEDLE = 'sendMessage';

const FORBIDDEN = [
  'readMessages',       // تعليم مقروء
  'sendReceipt',        // إيصال قراءة
  'sendReceipts',
  'sendPresenceUpdate', // يُظهر «متصل» أو «يكتب»
  'chatModify',         // أرشفة/تثبيت/تعليم غير مقروء على جوال المالك
  'updateMediaMessage',
  'sendWAMessage',
  'relayMessage',
  'groupParticipantsUpdate',
  'react:',             // تفاعل — يظهر للطرف الآخر
];

const files = (await readdir(SRC)).filter((n) => n.endsWith('.mjs'));
let bad = 0;
let sendLines = 0;
for (const name of files) {
  const lines = (await readFile(new URL(name, SRC), 'utf8')).split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    if (line.includes(SEND_NEEDLE)) {
      if (name === SEND_FILE) sendLines += 1;
      else {
        console.error(`✗ ${name}:${i + 1} يحتوي «${SEND_NEEDLE}» — الإرسال في ${SEND_FILE} وحده`);
        bad += 1;
      }
    }
    for (const needle of FORBIDDEN) {
      if (line.includes(needle)) {
        console.error(`✗ ${name}:${i + 1} يحتوي «${needle}» — يعلّم قراءة أو يُظهر حضوراً`);
        bad += 1;
      }
    }
  }
}
if (sendLines > 1) {
  console.error(`✗ ${SEND_FILE}: ${sendLines} أسطر إرسال — المسموح سطر واحد`);
  bad += 1;
}
if (bad) {
  console.error(`الحارس أسقط الفحص: ${bad} مخالفة.`);
  process.exit(1);
}
console.log(`✓ الحارس: ${files.length} ملفات — الإرسال في ${SEND_FILE} وحده (${sendLines} سطر)، ولا تعليم قراءة.`);
