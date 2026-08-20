/**
 * طبقة تجريد للتخزين — محلي الآن وS3 لاحقاً بدون تغيير أي كود مستدعٍ.
 * مجلد كل عميل: <root>/clients/<slug>-<id>/{quotes,contracts,attachments}
 */
import fs from 'node:fs/promises';
import path from 'node:path';

export type ClientFolder = 'quotes' | 'contracts' | 'attachments';

export const CLIENT_FOLDERS: ClientFolder[] = ['quotes', 'contracts', 'attachments'];

export const FOLDER_LABEL: Record<ClientFolder, { ar: string; en: string }> = {
  quotes: { ar: 'عروض الأسعار', en: 'Quotations' },
  contracts: { ar: 'العقود', en: 'Contracts' },
  attachments: { ar: 'المرفقات', en: 'Attachments' },
};

export interface StorageDriver {
  readonly name: string;
  ensureDir(dir: string): Promise<void>;
  put(key: string, data: Buffer | string, mime?: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  list(dir: string): Promise<string[]>;
  remove(key: string): Promise<void>;
  /** رابط للتنزيل — محلياً يمر عبر مسار API يتحقق من الصلاحية. */
  urlFor(key: string): string;
}

const ROOT = path.resolve(process.env.STORAGE_ROOT || './storage');

/** يمنع الخروج من جذر التخزين عبر مسارات مثل ../../etc/passwd */
function safeJoin(key: string): string {
  const target = path.resolve(ROOT, key.replace(/^\/+/, ''));
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    throw new Error(`مسار تخزين غير مسموح: ${key}`);
  }
  return target;
}

const localDriver: StorageDriver = {
  name: 'local',
  async ensureDir(dir) {
    await fs.mkdir(safeJoin(dir), { recursive: true });
  },
  async put(key, data) {
    const target = safeJoin(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data as Buffer);
    return key;
  },
  async get(key) {
    return fs.readFile(safeJoin(key));
  },
  async exists(key) {
    try {
      await fs.access(safeJoin(key));
      return true;
    } catch {
      return false;
    }
  },
  async list(dir) {
    try {
      return await fs.readdir(safeJoin(dir));
    } catch {
      return [];
    }
  },
  async remove(key) {
    await fs.rm(safeJoin(key), { force: true });
  },
  urlFor(key) {
    return `/api/files/${encodeURIComponent(key)}`;
  },
};

/**
 * سائق S3 — واجهة جاهزة. عند التفعيل ثبّت @aws-sdk/client-s3 واستبدل
 * الجسم فقط؛ لا يتغير أي كود مستدعٍ لأن التوقيع واحد.
 */
function s3Driver(): StorageDriver {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET غير معرّف — لا يمكن تفعيل تخزين S3');
  throw new Error(
    'تخزين S3 غير مفعّل بعد: ثبّت @aws-sdk/client-s3 ثم نفّذ الدوال في s3Driver().',
  );
}

let cached: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (cached) return cached;
  cached = process.env.STORAGE_DRIVER === 's3' ? s3Driver() : localDriver;
  return cached;
}

export function slugify(input: string): string {
  return (
    input
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'client'
  );
}

/** مجلد العميل: يُنشأ تلقائياً بثلاثة مجلدات فرعية عند إنشاء أي عميل. */
export function clientFolderPath(clientId: string, name: string): string {
  return `clients/${slugify(name)}-${clientId.slice(-6)}`;
}

export async function ensureClientFolders(base: string): Promise<void> {
  const s = storage();
  for (const f of CLIENT_FOLDERS) await s.ensureDir(`${base}/${f}`);
}

export function fileKey(base: string, folder: ClientFolder, name: string): string {
  return `${base}/${folder}/${name.replace(/[\\/]+/g, '_')}`;
}
