/**
 * سائق Inngest — طابور مُدار يعمل داخل دوال Vercel بلا خادم دائم.
 * كل ما يفعله: يستقبل حدثاً يحمل معرّف المهمة، ثم يستدعي runJob.
 * منطق التنفيذ نفسه في handlers.ts ولا يعرف شيئاً عن Inngest.
 */
import { Inngest } from 'inngest';
import { runJob } from './handlers';

export const inngest = new Inngest({
  id: 'bp-quotes',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export const runJobFn = inngest.createFunction(
  {
    id: 'run-job',
    // سقف التزامن يحمي قاعدة البيانات والمزوّدات الخارجية من الانفجار
    concurrency: { limit: Number(process.env.QUEUE_CONCURRENCY || 20) },
    retries: 3,
  },
  { event: 'bp/job.run' },
  async ({ event, step }) => {
    const jobId = String(event.data.jobId);
    const result = await step.run('execute', () => runJob(jobId));
    // الفشل يُرفع ليتولى Inngest إعادة المحاولة بتباعد متزايد
    if (!result.ok) throw new Error(result.error || 'فشل تنفيذ المهمة');
    return result;
  },
);

export const functions = [runJobFn];
