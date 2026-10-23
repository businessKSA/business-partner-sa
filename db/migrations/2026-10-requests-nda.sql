-- ============================================================================
-- Business Partner — اتفاقية عدم الإفصاح على الطلب (requests.nda)
-- مسوّدة غير مطبَّقة (2026-10-23) — يطبّقها المالك يدوياً؛ لا أحد يطبّقها على قاعدة حقيقية آليّاً.
-- Idempotent: add column if not exists.
--
-- nda jsonb: {number, status: 'SENT'|'SIGNED', html, build{template_version, company, party, lang,
--             clientRegNo, clientAddress, clientCountry, signatory, service}, template_version,
--             created_at, sent_at, signed_at, signature{name,email,ip,ua,at,doc_sha256,template_version,image,mode}}
-- تُحفظ الورقة كاملة كما طُبعت بقالبها المجمَّد (build.template_version + لقطة الشركة يومها)،
-- ولا تُعاد بناؤها بـ«أحدث قالب»؛ وبصمة SHA-256 للبايتات المخزَّنة في التوقيع.
-- بلا هذا العمود يعمل كل شيء كما كان؛ فقط «إصدار اتفاقية عدم إفصاح» يردّ nda_unavailable.
-- ============================================================================

begin;

alter table requests add column if not exists nda jsonb;
comment on column requests.nda is 'اتفاقية عدم الإفصاح المتبادلة (اختيارية): الورقة المطبوعة بقالبها المجمَّد وتوقيع العميل.';

commit;
