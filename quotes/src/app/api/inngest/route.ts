import { serve } from 'inngest/next';
import { inngest, functions } from '@/lib/queue/inngest';

/** نقطة استقبال Inngest — تُسجَّل تلقائياً عند النشر على Vercel. */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
