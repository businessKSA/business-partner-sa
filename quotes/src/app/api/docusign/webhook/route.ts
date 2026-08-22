import { NextResponse } from 'next/server';
import { verifyConnectSignature, parseEvent, applyEnvelopeStatus, type ConnectEvent } from '@/lib/docusign/webhook';

export const dynamic = 'force-dynamic';

/** DocuSign Connect — يستقبل sent / delivered / completed / declined / voided */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('x-docusign-signature-1');
  if (!verifyConnectSignature(raw, sig)) {
    return NextResponse.json({ error: 'توقيع غير صالح' }, { status: 401 });
  }

  let payload: ConnectEvent;
  try {
    payload = JSON.parse(raw) as ConnectEvent;
  } catch {
    return NextResponse.json({ error: 'حمولة غير صالحة' }, { status: 400 });
  }

  const { envelopeId, status } = parseEvent(payload);
  if (!envelopeId || !status) {
    return NextResponse.json({ error: 'حدث بلا معرّف ظرف أو حالة' }, { status: 400 });
  }

  try {
    const r = await applyEnvelopeStatus(envelopeId, status, payload);
    return NextResponse.json(r, { status: r.ok ? 200 : 404 });
  } catch (e) {
    // نرد 200 حتى لا تعيد DocuSign الإرسال بلا نهاية على خطأ داخلي
    console.error('DocuSign webhook error:', e);
    return NextResponse.json({ ok: false, message: 'خطأ داخلي سُجّل' }, { status: 200 });
  }
}
