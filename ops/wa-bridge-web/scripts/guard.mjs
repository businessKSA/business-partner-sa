// حارس ثابت يعمل في `npm run check`: يمنع عودة الإرسال أو تعليم القراءة
// إلى هذا المجلد بالخطأ.
//
// سببه أن whatsapp-web.js — بخلاف Baileys — *تملك* دوال إرسال وتعليم قراءة
// جاهزة على كائن العميل نفسه، فسطر واحد يكفي لكسر قاعدة المالك. الحارس
// يقرأ النصّ لا النوايا: أي ذكر لهذه الأسماء يُسقط الفحص.
//
// المصدر الذي فُحص (whatsapp-web.js 1.34.7):
//   `window.WWebJS.sendSeen` هو **الطريق الوحيد** لتعليم القراءة، ويُستدعى من
//   `Client.sendSeen()` و`Client.sendMessage()` (الخيار `sendSeen` افتراضه true).
//   ولا يستدعيه `initialize()` ولا `getChat()` ولا `getContact()` ولا
//   `getQuotedMessage()` ولا أي معالج أحداث. فمنعُ هذه الأسماء يكفي.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const SRC = new URL('../src/', import.meta.url);

/** أسماء ممنوعة: كلها تُرسل أو تُعلّم قراءة أو تُظهر «متصل». */
const FORBIDDEN = [
  'sendSeen',          // تعليم المحادثة مقروءة
  'sendMessage',       // إرسال (ويعلّم القراءة ضمناً بافتراضه)
  'markAvailable',     // يُظهر «متصل»
  'sendPresenceAvailable',
  'markChatUnread',    // يغيّر حالة المحادثة على جوال المالك
  'markPlayed',        // تعليم البصمة الصوتية مسموعة
  '.reply(',           // رد على رسالة
  '.react(',           // تفاعل — يظهر للطرف الآخر
  'sendStateTyping',
  'markComposing',
];

const files = (await readdir(SRC)).filter((n) => n.endsWith('.mjs'));
let bad = 0;
for (const name of files) {
  const text = await readFile(new URL(name, SRC), 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    // أسطر التعليق مستثناة: هذا الملف وغيره يشرح الأسماء الممنوعة بالاسم.
    const line = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    for (const needle of FORBIDDEN) {
      if (line.includes(needle)) {
        console.error(`✗ ${path.basename(name)}:${i + 1} يحتوي «${needle}» — قارئ فقط، لا إرسال ولا تعليم قراءة`);
        bad += 1;
      }
    }
  }
}
if (bad) {
  console.error(`الحارس أسقط الفحص: ${bad} مخالفة.`);
  process.exit(1);
}
console.log(`✓ الحارس: ${files.length} ملفاً بلا إرسال ولا تعليم قراءة.`);
