// عنوان n8n الواحد لكل مستدعٍ في api/ — يتبدّل بمتغيّر بيئة واحد عند تحويل الويبهوك
// من n8n Cloud إلى n8n على Azure (docs/azure-n8n-handoff-2026-10-12.md §9).
// الافتراضي يبقى Cloud حتى تُفعَّل سير الويبهوك على Azure، ثم يُضبط BP_N8N_BASE في
// بيئة النشر ويُعاد البناء، بلا تعديل في أي ملف.
export const N8N_CLOUD = "https://businesspartnerai.app.n8n.cloud";
export const N8N_AZURE = "https://bp-n8n.delightfulhill-a9ef6e21.swedencentral.azurecontainerapps.io";
export const N8N_BASE = String(process.env.BP_N8N_BASE || N8N_CLOUD).replace(/\/+$/, "");
export const n8nHook = (path) => `${N8N_BASE}/webhook/${String(path).replace(/^\/+/, "")}`;
