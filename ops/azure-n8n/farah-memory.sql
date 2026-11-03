-- Farah persistent memory (schema `farah` inside the n8n PostgreSQL database on bp-n8n-pg).
-- Run as the server admin; the app role `farah_app` is created separately with a password supplied at run time:
--   SELECT format('CREATE ROLE farah_app LOGIN PASSWORD %L', :'pw') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='farah_app') \gexec
CREATE SCHEMA IF NOT EXISTS farah;
CREATE TABLE IF NOT EXISTS farah.messages(
  id bigserial PRIMARY KEY, ts timestamptz NOT NULL DEFAULT now(),
  direction text NOT NULL CHECK (direction IN ('in','out')),
  source text NOT NULL DEFAULT 'conversation',
  wa_id text, ref_wa_id text, body text NOT NULL, meta jsonb NOT NULL DEFAULT '{}');
CREATE INDEX IF NOT EXISTS messages_ts_idx ON farah.messages(ts DESC);
CREATE INDEX IF NOT EXISTS messages_wa_idx ON farah.messages(wa_id);
CREATE TABLE IF NOT EXISTS farah.pending(
  id bigserial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL, title text NOT NULL, detail text,
  source text, source_ref text, msg_id bigint, digest_no smallint,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','rejected','snoozed','done')),
  decided_at timestamptz, decision_note text);
CREATE UNIQUE INDEX IF NOT EXISTS pending_open_uq ON farah.pending(source, source_ref) WHERE status='open';
CREATE TABLE IF NOT EXISTS farah.memories(
  id bigserial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL, subject text NOT NULL, content text NOT NULL, source text,
  active boolean NOT NULL DEFAULT true,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(subject,'')||' '||content)) STORED);
CREATE INDEX IF NOT EXISTS memories_tsv_idx ON farah.memories USING gin(tsv);
CREATE TABLE IF NOT EXISTS farah.daily_summaries(day date PRIMARY KEY, summary text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT CONNECT ON DATABASE n8n TO farah_app;
GRANT USAGE ON SCHEMA farah TO farah_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA farah TO farah_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA farah TO farah_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA farah GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO farah_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA farah GRANT USAGE, SELECT ON SEQUENCES TO farah_app;
