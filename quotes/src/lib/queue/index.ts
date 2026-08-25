/**
 * طبقة تجريد الطابور — يُبدَّل المزوّد من متغير بيئة واحد.
 *   inline  : التنفيذ داخل الطلب. للتطوير المحلي والاختبار فقط.
 *   inngest : طابور مُدار يعمل على Vercel بلا خادم دائم، مع إعادة محاولة.
 * كل مهمة تُسجَّل في جدول Job أولاً، فتبقى حالتها مرئية وقابلة لإعادة التشغيل
 * مهما كان المزوّد.
 */
import { prisma } from '../db';
import { runJob } from './handlers';
import type { EnqueueOptions, JobKind, JobPayloads, QueueDriver } from './types';

export * from './types';
export { runJob, handlers } from './handlers';

async function record<K extends JobKind>(kind: K, payload: JobPayloads[K], opts?: EnqueueOptions) {
  if (opts?.dedupeKey) {
    const existing = await prisma.job.findUnique({ where: { dedupeKey: opts.dedupeKey } });
    // مهمة قائمة أو منجزة بنفس المفتاح لا تُكرَّر؛ الفاشلة تُعاد المحاولة عليها
    if (existing && existing.status !== 'FAILED') return { job: existing, isNew: false };
    if (existing) {
      const reset = await prisma.job.update({
        where: { id: existing.id },
        data: { status: 'QUEUED', error: null, payload: JSON.stringify(payload) },
      });
      return { job: reset, isNew: true };
    }
  }
  const job = await prisma.job.create({
    data: {
      kind,
      payload: JSON.stringify(payload),
      entityType: opts?.entityType ?? null,
      entityId: opts?.entityId ?? null,
      dedupeKey: opts?.dedupeKey ?? null,
    },
  });
  return { job, isNew: true };
}

const inlineDriver: QueueDriver = {
  name: 'inline',
  async enqueue(kind, payload, opts) {
    const { job, isNew } = await record(kind, payload, opts);
    if (isNew) await runJob(job.id);
    return { jobId: job.id, ranInline: true };
  },
};

const inngestDriver: QueueDriver = {
  name: 'inngest',
  async enqueue(kind, payload, opts) {
    const { job, isNew } = await record(kind, payload, opts);
    if (isNew) {
      const { inngest } = await import('./inngest');
      await inngest.send({ name: 'bp/job.run', data: { jobId: job.id, kind } });
    }
    return { jobId: job.id, ranInline: false };
  },
};

let cached: QueueDriver | null = null;

export function queue(): QueueDriver {
  if (cached) return cached;
  cached = (process.env.QUEUE_DRIVER || 'inline').toLowerCase() === 'inngest'
    ? inngestDriver
    : inlineDriver;
  return cached;
}

/** يعيد تشغيل مهمة فاشلة من لوحة التحكم. */
export async function retryJob(jobId: string) {
  await prisma.job.update({ where: { id: jobId }, data: { status: 'QUEUED', error: null } });
  const driver = queue();
  if (driver.name === 'inline') return runJob(jobId);
  const { inngest } = await import('./inngest');
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  await inngest.send({ name: 'bp/job.run', data: { jobId, kind: job.kind } });
  return { ok: true };
}
