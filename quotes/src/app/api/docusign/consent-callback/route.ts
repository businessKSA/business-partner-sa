import { NextResponse } from 'next/server';

/** نقطة رجوع منح الموافقة لمرة واحدة (consent) من DocuSign. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const err = url.searchParams.get('error');
  const body = err
    ? `تعذّر منح الموافقة: ${err}`
    : 'تم منح الموافقة بنجاح. يمكنك الآن استخدام JWT Grant من النظام.';
  return new NextResponse(
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
     <title>موافقة DocuSign</title><link rel="stylesheet" href="/fonts/tajawal.css">
     <style>body{font-family:'Tajawal',sans-serif;padding:60px;text-align:center;color:#1F2430}
     a{color:#0B1B5A}</style></head>
     <body><h1 style="color:#0B1B5A">${body}</h1><p><a href="/admin">العودة للوحة التحكم</a></p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: err ? 400 : 200 },
  );
}
