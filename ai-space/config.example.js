/* BP AI Command Space — runtime endpoints.
 *
 * Copy to config.js and fill in the real n8n webhook paths before deploying.
 * config.js is NOT committed: this repository is public and the webhook paths
 * are unauthenticated secret URLs. The deployed Vercel project carries the
 * real file; git carries only this example.
 */
window.BP_SPACE_CONFIG = {
  // n8n instance base, no trailing slash.
  n8n: 'https://YOUR-INSTANCE.app.n8n.cloud',

  // GET -> { ok, generated_at, agents, tasks, deals, kpis, campaigns, integrations }
  dataPath: '/webhook/REPLACE-space-data-path',

  // POST { message, target_agent, source } -> { reply }
  chatPath: '/webhook/REPLACE-chat-path',

  // POST form { command_type, target_type, target_id, ... } -> 302
  actionPath: '/webhook/REPLACE-control-action-path',

  // POST { text } -> audio/mpeg  (ElevenLabs behind n8n; the API key stays in
  // the n8n credential and never reaches the browser).
  // Leave empty or omit to keep using the browser's built-in voice.
  voicePath: '',

  // Browser aborts a chat request after this many ms.
  chatTimeoutMs: 150000,

  // Dashboard auto-refresh interval in ms (0 disables).
  refreshMs: 45000
};
