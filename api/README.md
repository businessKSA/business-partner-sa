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
