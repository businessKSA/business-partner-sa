# «المستشار» — Advisor chatbot (Vercel Serverless Function)

> **Adding a file to `api/`?** Vercel turns every non-underscore `.js`/`.mjs`
> file in this directory into a serverless function, and the plan caps a
> deployment at **12**. This directory sits at exactly 12 — a thirteenth file
> fails the whole deployment with `exceeded_serverless_functions_per_deployment`,
> after the build has already reported success. Shared code belongs in an
> `_underscore.js` module (excluded from the count); tests belong in `tests/`.

On-site AI chat widget that answers visitors' questions about Saudi government
procedures and BP services, then gently suggests a relevant Business Partner
service. Backend: `api/chat.js`, a Vercel serverless function that proxies to the
**Azure OpenAI** — the platform's only intelligence provider (`api/_azure.js`).

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
| `AZURE_OPENAI_ENDPOINT` | ✅ | — | `https://<resource>.openai.azure.com`. Without it the widget falls back to the n8n agent, then WhatsApp. |
| `AZURE_OPENAI_KEY` | ✅ | — | The Azure OpenAI resource key. |
| `AZURE_OPENAI_DEPLOYMENT` | ✅ | — | The **deployment** name, not the model name. |
| `AZURE_OPENAI_ENDPOINT_2` / `_KEY_2` / `_DEPLOYMENT_2` | recommended | — | Second Azure region. Failover on 429/408/5xx keeps the agents up without a second vendor; a 4xx stops instead, since a wrong deployment name fails identically everywhere. |
| `AZURE_OPENAI_VISION_DEPLOYMENT` | optional | chat deployment | Only if images use a different deployment. |
| `MODEL` | optional | `claude-opus-4-8` | Set to `claude-haiku-4-5` for lower cost/latency on a high-traffic site. |
| `WHATSAPP_URL` | optional | `https://wa.me/966507034157` | The agent WhatsApp link the advisor points to. |
| `MOYASAR_PUBLISHABLE_KEY` | optional | — | `pk_live_…` / `pk_test_…`. Shows the card form on checkout and on step 3 of a quote. Public by design — it ships in page source. |
| `MOYASAR_SECRET_KEY` | optional | — | `sk_live_…` / `sk_test_…`. Verifies a payment server-side and triggers the tax invoice. Must be the same environment as the publishable key. |
| `MOYASAR_METHODS` | optional | `creditcard` | Comma list of wallets the form offers: `creditcard`, `applepay`, `samsungpay`, `googlepay`, `stcpay`. Unknown names are dropped; an empty result falls back to `creditcard`. Only turn a wallet on after it is enabled on the Moyasar side — Apple Pay also needs the domain registered and `/.well-known/apple-developer-merchantid-domain-association` served. `samsungpay` is dropped without `MOYASAR_SAMSUNG_SERVICE_ID`, `googlepay` without `MOYASAR_GOOGLE_MERCHANT_ID`; the checkout further hides any wallet whose own SDK says the visitor's device is not ready. |
| `MOYASAR_APPLE_PAY_LABEL` | optional | `Business Partner` | The payee name shown in the Apple Pay sheet. |
| `MOYASAR_APPLE_PAY_VALIDATE_URL` | optional | Moyasar's `/v1/applepay/initiate` | Merchant-validation endpoint; override only if Moyasar changes it. |
| `MOYASAR_SAMSUNG_SERVICE_ID` | optional | — | Web Service ID from Samsung's Service Management (domain = the exact checkout hostname). Required for `samsungpay` to be offered. `MOYASAR_SAMSUNG_ENV=stage` for a staging wallet; `MOYASAR_SAMSUNG_PAY_LABEL` sets the payee name. |
| `MOYASAR_GOOGLE_MERCHANT_ID` | optional | — | Google merchant ID from the Google Pay & Wallet Console (public, printed in Google's sheet). Required for `googlepay` to be offered. `MOYASAR_GOOGLE_ENV=test` draws a test button that moves no money (default `PRODUCTION`, which Google must approve first); `MOYASAR_GOOGLE_PAY_LABEL` sets the payee name. |
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
