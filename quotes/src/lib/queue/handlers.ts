/**
 * منفّذو المهام — دوال خالصة يستدعيها أي سائق طابور.
 * فصلها عن السائق يعني أن تغيير المزوّد لا يمس منطق التنفيذ.
 */
import { prisma } from '../db';
import type { JobKind, JobPayloads } from './types';
import { JOB } from './types';

type Handler<K extends JobKind> = (p: JobPayloads[K]) => Promise<unknown>;

export const handlers: { [K in JobKind]: Handler<K> } = {
  [JOB.DOCUMENT_PDF]: async ({ documentId }) => {
    const { buildAndArchivePdf } = await import('../send');
    const { key } = await buildAndArchivePdf(documentId);
    return { key };
  },

  [JOB.DOCUMENT_DOCX]: async ({ documentId }) => {
    const { buildAndArchiveDocx } = await import('../docx');
    const { key } = await buildAndArchiveDocx(documentId);
    return { key };
  },

  [JOB.DOCUMENT_EMAIL]: async ({ documentId, includeArabic, actor }) => {
    const { sendDocumentEmail } = await import('../send');
    return sendDocumentEmail({ documentId, includeArabic, attachPdf: true, actor });
  },

  [JOB.SIGNED_COPY_FETCH]: async ({ envelopeDbId }) => {
    const { downloadSignedDocuments } = await import('../docusign/service');
    return downloadSignedDocuments(envelopeDbId);
  },
};

/** ينفّذ مهمة مسجّلة ويحدّث سجلها. يُستدعى من كل سائق. */
export async function runJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { ok: false, error: 'مهمة غير موجودة' };
  if (job.status === 'DONE') return { ok: true };

  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
  });

  try {
    const handler = handlers[job.kind as JobKind] as Handler<JobKind> | undefined;
    if (!handler) throw new Error(`لا يوجد منفّذ للمهمة: ${job.kind}`);
    const result = await handler(JSON.parse(job.payload) as JobPayloads[JobKind]);
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'DONE',
        finishedAt: new Date(),
        result: JSON.stringify(result ?? null).slice(0, 4000),
        error: null,
      },
    });
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FAILED', finishedAt: new Date(), error: error.slice(0, 2000) },
    });
    return { ok: false, error };
  }
}
