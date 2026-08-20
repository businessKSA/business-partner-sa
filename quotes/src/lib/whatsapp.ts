/**
 * واتساب: الوضع الحالي رابط wa.me بنص جاهز.
 * الكود مهيّأ للاستبدال بواجهة WhatsApp Business API عند توفرها —
 * نفس التوقيع، يتغير الجسم فقط.
 */
import { loadTemplate, render } from './templates';
import { stripEmoji } from './content-guard';

export interface WhatsAppMessage {
  phone: string;
  text: string;
  /** رابط wa.me الجاهز للفتح */
  href: string;
}

interface MsgTpl {
  whatsapp: Record<string, { ar: string; en: string }>;
}

export function buildWhatsAppMessage(
  kind: 'quote' | 'contract',
  lang: 'ar' | 'en',
  phone: string,
  vars: Record<string, string | number>,
): WhatsAppMessage {
  const tpl = loadTemplate<MsgTpl>('messages.json');
  const raw = tpl.whatsapp[kind]?.[lang] ?? '';
  const text = stripEmoji(render(raw, vars));
  return {
    phone,
    text,
    href: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
  };
}

/** جاهز للتفعيل: WhatsApp Business API (Cloud API). */
export async function sendViaBusinessApi(phone: string, text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (process.env.WHATSAPP_MODE !== 'api' || !token || !phoneId) {
    return { ok: false, error: 'WhatsApp Business API غير مفعّلة — الوضع الحالي رابط wa.me' };
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { preview_url: true, body: text },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message: string } };
  if (!res.ok) return { ok: false, error: body.error?.message || `HTTP ${res.status}` };
  return { ok: true, id: body.messages?.[0]?.id };
}
