-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 020 — Leitura pública para páginas de checkout
--
-- Problema: RLS bloqueava usuários anônimos de ler produtos, ofertas e
--           configurações de checkout, retornando PGRST116 (0 rows).
-- Solução: adicionar policies de SELECT para role anon nas tabelas
--          consultadas pela CheckoutPage.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── products ──────────────────────────────────────────────────────────────────
CREATE POLICY "public read products"
  ON public.products FOR SELECT
  TO anon
  USING (true);

-- ── product_offers ────────────────────────────────────────────────────────────
CREATE POLICY "public read product_offers"
  ON public.product_offers FOR SELECT
  TO anon
  USING (true);

-- ── product_checkouts ─────────────────────────────────────────────────────────
CREATE POLICY "public read product_checkouts"
  ON public.product_checkouts FOR SELECT
  TO anon
  USING (true);

-- ── product_order_bumps ───────────────────────────────────────────────────────
CREATE POLICY "public read product_order_bumps"
  ON public.product_order_bumps FOR SELECT
  TO anon
  USING (true);
