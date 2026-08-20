# «المستشار» — Advisor chatbot (Vercel Serverless Function)

On-site AI chat widget that answers visitors' questions about Saudi government
procedures and BP services, then gently suggests a relevant Business Partner
service. Backend: `api/chat.js`, a Vercel serverless function that proxies to the
Claude Messages API.

## Files
- `chat.js` — the serverless function (`POST /api/chat`). Zero npm dependencies
  (uses the global `fetch`; Node 18+ on Vercel).
- `knowledge.json` — the system prompt's knowledge base, **pulled from Notion
  page `38dd108dee5c81fb80eeef9960017aab`** (BP services reference: government
  entities + the seven-part service template) and baked at build time. Government
  facts come only from this file — the model is instructed not to invent them.

## Required environment variables (set in Vercel → Project → Settings → Environment Variables)
| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | — | Claude API key. Without it the widget shows a WhatsApp fallback. |
| `MODEL` | optional | `claude-opus-4-8` | Set to `claude-haiku-4-5` for lower cost/latency on a high-traffic site. |
| `WHATSAPP_URL` | optional | `https://wa.me/966507034157` | The agent WhatsApp link the advisor points to. |
| `MOYASAR_PUBLISHABLE_KEY` | optional | — | `pk_live_…` / `pk_test_…`. Shows the card form on checkout and on step 3 of a quote. Public by design — it ships in page source. |
| `MOYASAR_SECRET_KEY` | optional | — | `sk_live_…` / `sk_test_…`. Verifies a payment server-side and triggers the tax invoice. Must be the same environment as the publishable key. |
| `MOYASAR_METHODS` | optional | `creditcard` | Comma list of wallets the form offers: `creditcard`, `applepay`, `stcpay`. Unknown names are dropped; an empty result falls back to `creditcard`. Only turn a wallet on after it is enabled on the Moyasar side — Apple Pay also needs the domain registered and `/.well-known/apple-developer-merchantid-domain-association` served. |
| `MOYASAR_APPLE_PAY_LABEL` | optional | `Business Partner` | The payee name shown in the Apple Pay sheet. |
| `MOYASAR_APPLE_PAY_VALIDATE_URL` | optional | Moyasar's `/v1/applepay/initiate` | Merchant-validation endpoint; override only if Moyasar changes it. |
| `MOYASAR_WEBHOOK_SECRET` | optional | — | Any long random string, pasted identically into Moyasar's webhook settings. Without it `/api/pay` refuses webhooks (503) rather than trusting them. |
| `WHATSAPP_TOKEN` | optional | — | Meta WhatsApp Cloud API access token. Without it the client's WhatsApp leg of every order notification is skipped (portal + e-mail still fire) and the panel says so. |
| `WHATSAPP_PHONE_ID` | optional | — | The Cloud API Phone Number ID that sends those notifications. |
| `WHATSAPP_TEMPLATE_NAME` | optional | — | An approved template used as a fallback when the client is outside Meta's 24-hour session window; the template's body takes one text parameter. |
| `WHATSAPP_TEMPLATE_LANG` | optional | `ar` | Language code of that template. |

## Cost note
The system prompt is large (~38k tokens of official knowledge). Prompt caching is
enabled on it (`cache_control: ephemeral`), so repeated requests read it at ~0.1×.
Each visitor message is one Messages API call (`max_tokens: 1024`, no thinking).
On `claude-opus-4-8` that's a few cents per exchange after cache; switch `MODEL`
to `claude-haiku-4-5` to cut it substantially.

## Refreshing the knowledge base
`knowledge.json` is a static snapshot of the Notion page. To refresh it, re-pull
the page via the Notion MCP and re-serialize its text into `api/knowledge.json`
(a single JSON string). It is intentionally committed so Vercel needs no Notion
access at build time.
