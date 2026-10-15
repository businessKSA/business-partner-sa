import type { APIRoute } from 'astro';

// فحص سلامة صور معرض القصر: يتحقق من أن كل معرّف صورة Unsplash يعطي صورة فعلية.
// مقيّد بمعرّفات Unsplash فقط (ليس وسيطًا مفتوحًا).
const ID_RE = /^[A-Za-z0-9_-]{8,16}$/;

export const GET: APIRoute = async ({ url }) => {
  const ids = (url.searchParams.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 25);

  const results = await Promise.all(
    ids.map(async (id) => {
      if (!ID_RE.test(id)) return { id, ok: false, error: 'bad id' };
      try {
        const res = await fetch(`https://unsplash.com/photos/${id}/download?w=100`, {
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        });
        const type = res.headers.get('content-type') || '';
        return { id, ok: res.ok && type.startsWith('image/'), status: res.status, type };
      } catch (e) {
        return { id, ok: false, error: String(e) };
      }
    })
  );

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { 'content-type': 'application/json' },
  });
};
