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
  /**
   * رابط تنزيل موقّع ينتهي بعد مدة. على S3 يوقّعه المزوّد فيصل العميل
   * الملف مباشرة بلا مرور على خادمنا؛ محلياً يعود لمسار الـAPI المحمي.
   */
  signedUrl(key: string, ttlSeconds?: number): Promise<string>;
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
  async signedUrl(key) {
    return `/api/files/${encodeURIComponent(key)}`;
  },
};

/**
 * سائق S3 — التخزين المعتمد في الإنتاج.
 * على Vercel القرص مؤقت ولا يُشارَك بين النسخ، فلا بديل عنه.
 * يعمل مع S3 وأي خدمة متوافقة معه (Cloudflare R2 مثلاً) عبر S3_ENDPOINT.
 */
function s3Driver(): StorageDriver {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET غير معرّف — لا يمكن تفعيل تخزين S3');

  // الاستيراد كسول حتى لا تُحمَّل الحزمة في البيئات التي تستخدم التخزين المحلي
  type S3Mod = typeof import('@aws-sdk/client-s3');
  let mod: S3Mod | null = null;
  let client: InstanceType<S3Mod['S3Client']> | null = null;

  async function s3() {
    if (!client) {
      mod = await import('@aws-sdk/client-s3');
      client = new mod.S3Client({
        region: process.env.S3_REGION || 'me-south-1',
        ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
        ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
              },
            }
          : {}),
      });
    }
    return { mod: mod!, client: client! };
  }

  const clean = (key: string) => key.replace(/^\/+/, '');

  return {
    name: 's3',
    // S3 لا يعرف المجلدات — المفتاح نفسه يحمل المسار
    async ensureDir() {},

    async put(key, data, mime) {
      const { mod: m, client: c } = await s3();
      await c.send(
        new m.PutObjectCommand({
          Bucket: bucket,
          Key: clean(key),
          Body: typeof data === 'string' ? Buffer.from(data) : data,
          ContentType: mime || 'application/octet-stream',
          // تشفير المستندات في التخزين — بيانات شخصية يحكمها نظام حماية البيانات
          ServerSideEncryption: 'AES256',
        }),
      );
      return key;
    },

    async get(key) {
      const { mod: m, client: c } = await s3();
      const res = await c.send(new m.GetObjectCommand({ Bucket: bucket, Key: clean(key) }));
      const body = res.Body as { transformToByteArray(): Promise<Uint8Array> } | undefined;
      if (!body) throw new Error(`ملف غير موجود: ${key}`);
      return Buffer.from(await body.transformToByteArray());
    },

    async exists(key) {
      const { mod: m, client: c } = await s3();
      try {
        await c.send(new m.HeadObjectCommand({ Bucket: bucket, Key: clean(key) }));
        return true;
      } catch {
        return false;
      }
    },

    async list(dir) {
      const { mod: m, client: c } = await s3();
      const prefix = `${clean(dir).replace(/\/+$/, '')}/`;
      const res = await c.send(
        new m.ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: '/' }),
      );
      return (res.Contents ?? [])
        .map((o) => (o.Key ?? '').slice(prefix.length))
        .filter(Boolean);
    },

    async remove(key) {
      const { mod: m, client: c } = await s3();
      await c.send(new m.DeleteObjectCommand({ Bucket: bucket, Key: clean(key) }));
    },

    urlFor(key) {
      // يمر على الـAPI ليُفحص التصريح ثم يُعاد التوجيه إلى رابط موقّع
      return `/api/files/${encodeURIComponent(key)}`;
    },

    async signedUrl(key, ttlSeconds) {
      const { mod: m, client: c } = await s3();
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const ttl = ttlSeconds ?? Number(process.env.S3_SIGNED_URL_TTL || 900);
      return getSignedUrl(c, new m.GetObjectCommand({ Bucket: bucket, Key: clean(key) }), {
        expiresIn: ttl,
      });
    },
  };
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
