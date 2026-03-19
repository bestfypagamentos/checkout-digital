-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 016 — Upsell Hardening
--
-- 1. Chave de idempotência em sales (previne cobranças duplicadas)
-- 2. Sessões de upsell de curta duração (token seguro em vez de UUIDs reais)
-- 3. Log de auditoria de upsell com RLS
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Idempotência em sales ─────────────────────────────────────────────────
-- A coluna recebe um token gerado pelo cliente antes do submit.
-- O UNIQUE garante que um segundo request com a mesma chave retorne a venda existente.
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS sales_idempotency_key_idx
  ON sales (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── 2. Sessões de upsell (token de curta duração) ────────────────────────────
-- Fluxo: pagamento confirmado → backend emite token (30 min) → widget usa token
-- O HTML do vendedor nunca vê o upsell_id real do banco.
CREATE TABLE IF NOT EXISTS upsell_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  upsell_id   uuid        NOT NULL REFERENCES product_upsells(id) ON DELETE CASCADE,
  sale_id     uuid        NOT NULL REFERENCES sales(id)           ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  used_at     timestamptz,          -- preenchido na primeira (e única) utilização
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS upsell_sessions_token_idx   ON upsell_sessions (token);
CREATE INDEX IF NOT EXISTS upsell_sessions_sale_id_idx ON upsell_sessions (sale_id);

ALTER TABLE upsell_sessions ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy de SELECT/INSERT para authenticated ou anon.
-- Apenas service role (edge functions) pode ler/escrever — RLS bloqueia tudo o mais.

-- ── 3. Log de auditoria de upsell ───────────────────────────────────────────
-- Registra events: session_created | accepted | rejected | expired
-- ip_hash = SHA-256 do IP do visitante (LGPD: não armazenamos o IP puro)
CREATE TABLE IF NOT EXISTS upsell_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid        NOT NULL REFERENCES auth.users,
  upsell_id   uuid        NOT NULL REFERENCES product_upsells(id),
  sale_id     uuid        REFERENCES sales(id),
  event       text        NOT NULL CHECK (event IN ('session_created', 'accepted', 'rejected', 'expired')),
  ip_hash     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE upsell_logs ENABLE ROW LEVEL SECURITY;

-- Vendedor lê apenas seus próprios logs
CREATE POLICY "seller reads own upsell logs"
  ON upsell_logs FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

-- INSERT exclusivo de service role (edge functions) — nenhuma policy de write para anon/auth
