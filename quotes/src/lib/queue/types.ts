/**
 * أنواع المهام الخلفية. كل عملية ثقيلة تمر من هنا بدل أن تُنفَّذ داخل الطلب،
 * فيرجع الطلب في أجزاء من الثانية ويتوسّع التنفيذ بمعزل عن الواجهة.
 */
export const JOB = {
  DOCUMENT_PDF: 'document.pdf',
  DOCUMENT_DOCX: 'document.docx',
  DOCUMENT_EMAIL: 'document.email',
  SIGNED_COPY_FETCH: 'docusign.signed-copy',
  // تُضاف مع مرحلتيهما: file.extract (استخراج النصوص) و message.send (الوكيل)
} as const;

export type JobKind = (typeof JOB)[keyof typeof JOB];

export interface JobPayloads {
  'document.pdf': { documentId: string; notify?: boolean };
  'document.docx': { documentId: string };
  'document.email': { documentId: string; includeArabic: boolean; actor: string };
  'docusign.signed-copy': { envelopeDbId: string };
}

export interface EnqueueOptions {
  /** يمنع تكرار نفس المهمة إن أُرسلت مرتين. */
  dedupeKey?: string;
  entityType?: string;
  entityId?: string;
}

export interface QueueDriver {
  readonly name: string;
  enqueue<K extends JobKind>(
    kind: K,
    payload: JobPayloads[K],
    opts?: EnqueueOptions,
  ): Promise<{ jobId: string; ranInline: boolean }>;
}
