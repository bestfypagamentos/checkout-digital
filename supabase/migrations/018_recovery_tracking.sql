-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 018 — Recovery Tracking
--
-- Registra o momento em que o cliente clicou no link de recuperação de PIX.
-- Permite medir o funil: email enviado → link clicado → venda paga.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS recovery_clicked_at timestamptz;

-- Índice para queries de relatório (filtra vendas com clique registrado)
CREATE INDEX IF NOT EXISTS sales_recovery_clicked_idx
  ON sales (recovery_clicked_at)
  WHERE recovery_clicked_at IS NOT NULL;
