#!/usr/bin/env bash
# ينشئ خزنة الاعتمادات (مرة واحدة) ويضيف إليها ما توفّر من الأسرار في agents/.env
# الاعتمادات لا تدخل الحاوية أبدًا؛ تُحقن عند الخروج من الشبكة فقط.
source "$(dirname "$0")/_lib.sh"
cd "$AGENTS_DIR"

if [ -z "${VAULT_ID:-}" ]; then
  VAULT_ID="$(ant beta:vaults create --name "bp-team-vault" --transform id -r)"
  echo "أُنشئت الخزنة: $VAULT_ID"
  echo "أضف السطر التالي إلى agents/.env:"
  echo "VAULT_ID=$VAULT_ID"
fi

add_cred() { # add_cred <yaml on stdin>
  ant beta:vaults:credentials create --vault-id "$VAULT_ID" >/dev/null && echo "  ✓ $1"
}

# 1) مفتاح webhook الإرسال في n8n (متغير بيئة، يُستبدل فقط عند الطلبات إلى n8n)
if [ -n "${BP_N8N_HOOK_KEY:-}" ]; then
  add_cred "n8n hook key" <<YAML
display_name: n8n — BP agent send key
auth:
  type: environment_variable
  secret_name: BP_N8N_HOOK_KEY
  secret_value: "$BP_N8N_HOOK_KEY"
  networking: { type: limited, allowed_hosts: [businesspartnerai.app.n8n.cloud] }
  injection_location: { header: true }
YAML
fi

# 2) GitHub MCP (فتح Pull Requests) بتوكن دقيق الصلاحيات كـ bearer ثابت
if [ -n "${GITHUB_TOKEN:-}" ]; then
  add_cred "GitHub MCP" <<YAML
display_name: GitHub MCP — business-partner-sa
auth:
  type: static_bearer
  mcp_server_url: https://api.githubcopilot.com/mcp/
  token: "$GITHUB_TOKEN"
YAML
fi

# 3) Notion MCP (OAuth). احصل على access/refresh token من تدفق OAuth لخادم mcp.notion.com
#    ثم ضع القيم في agents/.env: NOTION_MCP_ACCESS_TOKEN, NOTION_MCP_REFRESH_TOKEN, NOTION_MCP_CLIENT_ID, NOTION_MCP_EXPIRES_AT
if [ -n "${NOTION_MCP_ACCESS_TOKEN:-}" ]; then
  add_cred "Notion MCP" <<YAML
display_name: Notion MCP — Business Partner OS
auth:
  type: mcp_oauth
  mcp_server_url: https://mcp.notion.com/mcp
  access_token: "$NOTION_MCP_ACCESS_TOKEN"
  expires_at: "${NOTION_MCP_EXPIRES_AT:-}"
  refresh:
    refresh_token: "${NOTION_MCP_REFRESH_TOKEN:-}"
    client_id: "${NOTION_MCP_CLIENT_ID:-}"
    token_endpoint: https://api.notion.com/v1/oauth/token
    token_endpoint_auth: { type: none }
YAML
fi

echo "تم. الاعتمادات في الخزنة $VAULT_ID (القيم لا تُعرض أبدًا بعد الحفظ)."
