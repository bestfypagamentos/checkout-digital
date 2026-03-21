-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 017 — PIX Nudge (Recuperação de Vendas Abandonadas)
--
-- 1. Coluna email_recuperacao_enviado em sales
-- 2. Índice parcial para a query do worker (performance)
-- 3. pg_cron: agenda o pix-nudge para rodar a cada minuto
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Flag de controle do e-mail de recuperação ──────────────────────────────
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS email_recuperacao_enviado boolean NOT NULL DEFAULT false;

-- ── 2. Índice parcial — acelera a query do worker (só pending + não enviado) ──
CREATE INDEX IF NOT EXISTS sales_pix_nudge_idx
  ON sales (created_at)
  WHERE status = 'pending' AND email_recuperacao_enviado = false;

-- ── 3. Habilita a extensão pg_cron (se ainda não estiver ativa) ───────────────
-- Executar UMA VEZ como superusuário no Supabase Dashboard → SQL Editor:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   GRANT USAGE ON SCHEMA cron TO postgres;
--
-- Após habilitar, execute o comando abaixo para agendar o worker:
--
-- SELECT cron.schedule(
--   'pix-nudge-every-minute',
--   '* * * * *',
--   $$
--     SELECT net.http_post(
--       url     := 'https://vtqipknneiebnklkvrcw.supabase.co/functions/v1/pix-nudge',
--       headers := jsonb_build_object(
--         'Content-Type',  'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
--       ),
--       body    := '{}'::jsonb
--     );
--   $$
-- );
--
-- NOTA: pg_cron + pg_net podem ser habilitados em:
-- Supabase Dashboard → Database → Extensions → procure "pg_cron" e "pg_net"
