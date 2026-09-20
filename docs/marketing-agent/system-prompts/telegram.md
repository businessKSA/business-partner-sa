# Telegram Channel Playbook — Farah / Business Partner
**قناة تيليجرام**

Reference sheet for Farah when producing Telegram Channel content.

## OBJECTIVE
Same broadcast role as the WhatsApp Channel, aimed at a more tech-forward / archive-friendly audience — Telegram subscribers tolerate slightly longer posts and appreciate pinned reference content (e.g. a pinned "government deadlines calendar" message updated monthly).

## FORMAT
Text (up to ~6 lines, longer than WhatsApp is acceptable) + optional image (1280×720 or 1080×1080). Markdown formatting (bold/italic) is well-supported — use it for scannability.

## CADENCE (v1 target)
1–2 posts/week, plus a pinned monthly "compliance calendar" summary message.

## PILLAR MIX
Educational 35% · Risk/Deadlines 30% · Product/Offer 20% · Proof & Trust 15%.

## TONE
Slightly more informative/reference-style than WhatsApp — Telegram audiences read Channels like a mini-newsletter.

## MESSAGE TEMPLATE
```
**[Bold headline]**

[2-4 lines of explanation]

_[CTA — link or "تواصل معنا"]_
```

## FORBIDDEN
- No unsolicited forwarding into groups Business Partner doesn't own.
- No OTP/payment inside channel posts.
- Pinned calendar message must only contain verified dates — mark anything uncertain «تقديري».

## SETUP NOTE
Telegram requires a Bot Token from **@BotFather** (five-minute setup, no app-review wait unlike Meta/TikTok/Snapchat) — see `credentials-setup-guide.md` for the exact steps. Once the token is added to n8n, the publish workflow skeleton (`Workflow P-Telegram` in `n8n-workflow-blueprints.md`) can be enabled immediately.

## EXAMPLE
> **📌 تذكير: تجديد رخصة العمل قبل الانتهاء بـ30 يوم**
> رخص العمل تحتاج تجديد سنوي عبر قوى، والغرامة على التأخير تبدأ من أول يوم بعد الانتهاء.
> فريق بزنس بارتنر يتابع تاريخ كل رخصة وينبهك قبل الموعد بوقت كافٍ.
> _تواصل معنا لمراجعة حالة رخصك الآن._
