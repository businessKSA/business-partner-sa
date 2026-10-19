// حفظ جلسة واتساب بين إعادات التشغيل — وفصلُ Chromium عن القرص الشبكي.
//
// ⚠️ هذا الملف هو أهم فرق تشغيلي بين هذا الجسر والأول، وسببه واحد:
//
// `LocalAuth` في whatsapp-web.js لا يحفظ «مفاتيح جلسة» في ملفات JSON كما
// يفعل `useMultiFileAuthState` في Baileys — بل يجعل **مجلد ملف تعريف
// Chromium نفسه** هو الجلسة (`puppeteer.userDataDir`). وملف تعريف Chromium
// قاعدتا بيانات: LevelDB وSQLite، بإغلاقٍ على مستوى الملف.
//
// والقرص الدائم على Azure Container Apps هو **Azure Files عبر SMB**.
// وLevelDB/SQLite على SMB معطوبةُ الإغلاق بطبيعتها: تُفتح ثم تفشل
// بـ"IO error: lock" أو تفسد بصمت. هذا ليس احتمالاً بعيداً — هو السبب
// الأشهر لفشل whatsapp-web.js في الحاويات على أقراص شبكية.
//
// فالحل: **Chromium يعمل على قرص الحاوية المحلي**، ونُسخةٌ مُنتقاة من
// الملف تُلقَط إلى `/data` كل بضع دقائق وعند الإيقاف. تُستعاد عند الإقلاع
// فلا يُطلب مسح رمز جديد.
//
// وتُحفظ النسخة السابقة (`snapshot.prev`) دائماً: اللقط ليس متّسقاً مع
// لحظة كتابة LevelDB، فإن خرجت نسخةٌ معطوبة أمكن للمالك الرجوع خطوةً
// واحدة بدل مسح رمز من جديد.
//
// وضع مباشر (بلا مرآة) متاح بضبط `WA_PROFILE_LOCAL_DIR=0` — يُستعمل
// للتشغيل على ماك المالك حيث القرص محلي أصلاً.

import { mkdir, rm, rename, stat, readdir } from 'node:fs/promises';
import { cp } from 'node:fs/promises';
import path from 'node:path';
import { logger } from './log.mjs';

const log = logger('profile');

/**
 * ما يُلقَط من ملف التعريف. مسارات نسبية داخل `<dataPath>/session`.
 *
 * المقصود: كل ما يحمل اعتماد واتساب، ولا شيء من المخابئ.
 *   IndexedDB    — مفاتيح واتساب والهوية. بلا هذا يُطلب رمز جديد.
 *   Local Storage — رموز الجلسة وتفضيلات الصفحة.
 *   Preferences / Local State — يقلّلان ضجيج «أول تشغيل» في Chromium.
 * ويُستبعَد صراحةً: `Cache`, `Code Cache`, `GPUCache`, `Service Worker/ScriptCache`
 * — مئات الميغابايت بلا قيمة، وكتابتها على SMB كل دقائق إهدار.
 */
export const SNAPSHOT_PATHS = Object.freeze([
  'Default/IndexedDB',
  'Default/Local Storage',
  'Default/Preferences',
  'Local State',
]);

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function isNonEmptyDir(p) {
  try {
    const names = await readdir(p);
    return names.length > 0;
  } catch {
    return false;
  }
}

/**
 * يقرّر مكان ملف التعريف ويُعيد:
 *   { dataPath, persistDir, mirrored }
 * `dataPath` هو ما يُعطى لـ`LocalAuth`.
 */
export function resolveProfileDirs(opts) {
  const persistDir = String((opts && opts.persistDir) || '').trim();
  const localRaw = String((opts && opts.localDir) || '').trim();
  const mirrored = localRaw !== '' && localRaw !== '0';
  return {
    persistDir,
    dataPath: mirrored ? localRaw : persistDir,
    mirrored,
  };
}

/**
 * يستعيد آخر لقطة سليمة من `/data` إلى القرص المحلي، إن لم تكن هناك جلسة
 * محلية قائمة. يُنادى **قبل** إقلاع Chromium ولا شيء آخر.
 * يعيد 'local' | 'snapshot' | 'snapshot.prev' | 'none'.
 */
export async function restoreProfile(dirs) {
  if (!dirs.mirrored) {
    await mkdir(path.join(dirs.dataPath, 'session'), { recursive: true });
    return 'local';
  }

  const localSession = path.join(dirs.dataPath, 'session');
  await mkdir(localSession, { recursive: true });

  // جلسة محلية قائمة (إعادة تشغيل العملية بلا إعادة إنشاء الحاوية) تُقدَّم.
  if (await isNonEmptyDir(path.join(localSession, 'Default', 'IndexedDB'))) {
    log.info('ملف تعريف محلي قائم — لا استعادة');
    return 'local';
  }

  for (const candidate of ['snapshot', 'snapshot.prev']) {
    const src = path.join(dirs.persistDir, candidate, 'session');
    if (!(await isNonEmptyDir(path.join(src, 'Default', 'IndexedDB')))) continue;
    let copied = 0;
    for (const rel of SNAPSHOT_PATHS) {
      const from = path.join(src, rel);
      if (!(await exists(from))) continue;
      const to = path.join(localSession, rel);
      await mkdir(path.dirname(to), { recursive: true });
      await cp(from, to, { recursive: true, force: true });
      copied += 1;
    }
    log.info('الجلسة استُعيدت من اللقطة', { from: candidate, entries: copied });
    return candidate;
  }

  log.warn('لا لقطة على القرص الدائم — سيُطلب رمز QR لأول مرة');
  return 'none';
}

/**
 * يلقط ملف التعريف إلى `/data` بتدوير: tmp ← current ← prev.
 * آمنٌ للنداء مراراً؛ يتجاهل نفسه إن كان نداءٌ سابق لم ينتهِ.
 */
export class ProfileSnapshotter {
  constructor(dirs) {
    this.dirs = dirs;
    this.busy = false;
    this.count = 0;
  }

  async take(reason) {
    if (!this.dirs.mirrored) return false;
    if (this.busy) {
      log.debug('لقطة جارية — تُتجاهَل هذه', { reason });
      return false;
    }
    this.busy = true;
    const started = Date.now();
    const tmp = path.join(this.dirs.persistDir, 'snapshot.tmp');
    const cur = path.join(this.dirs.persistDir, 'snapshot');
    const prev = path.join(this.dirs.persistDir, 'snapshot.prev');
    const localSession = path.join(this.dirs.dataPath, 'session');
    try {
      // لا تلقط ملفَ تعريفٍ بلا اعتماد: تدهس لقطةً سليمة بفراغ.
      if (!(await isNonEmptyDir(path.join(localSession, 'Default', 'IndexedDB')))) {
        log.debug('لا اعتماد محلي بعد — لا لقطة', { reason });
        return false;
      }

      await rm(tmp, { recursive: true, force: true });
      let entries = 0;
      for (const rel of SNAPSHOT_PATHS) {
        const from = path.join(localSession, rel);
        if (!(await exists(from))) continue;
        const to = path.join(tmp, 'session', rel);
        await mkdir(path.dirname(to), { recursive: true });
        await cp(from, to, { recursive: true, force: true });
        entries += 1;
      }
      if (!entries) {
        await rm(tmp, { recursive: true, force: true });
        return false;
      }

      await rm(prev, { recursive: true, force: true });
      if (await exists(cur)) await rename(cur, prev);
      await rename(tmp, cur);
      this.count += 1;
      log.info('لقطة الجلسة حُفظت', { reason, entries, ms: Date.now() - started, n: this.count });
      return true;
    } catch (err) {
      log.warn('تعذّرت لقطة الجلسة', { reason, error: String((err && err.message) || err) });
      // لقطةٌ فاشلة لا تُسقط الجسر: الجلسة الحيّة في الذاكرة وعلى القرص المحلي.
      await rm(tmp, { recursive: true, force: true }).catch(function () {});
      return false;
    } finally {
      this.busy = false;
    }
  }
}
