-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 021 — Corrige leitura pública do checkout para usuários autenticados
--
-- Problema: migration 020 criou policies com TO anon, que não se aplicam ao
--           role authenticated. Após signInAnonymously(), o Supabase client
--           passa para o role authenticated e as leituras públicas do checkout
--           falham com PGRST116 (0 rows).
-- Solução: recriar as policies sem restrição de role (aplica para todos).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── products ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public read products" ON public.products;
CREATE POLICY "public read products"
  ON public.products FOR SELECT
  USING (true);

-- ── product_offers ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public read product_offers" ON public.product_offers;
CREATE POLICY "public read product_offers"
  ON public.product_offers FOR SELECT
  USING (true);

-- ── product_checkouts ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public read product_checkouts" ON public.product_checkouts;
CREATE POLICY "public read product_checkouts"
  ON public.product_checkouts FOR SELECT
  USING (true);

-- ── product_order_bumps ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public read product_order_bumps" ON public.product_order_bumps;
CREATE POLICY "public read product_order_bumps"
  ON public.product_order_bumps FOR SELECT
  USING (true);

-- ── profiles (nome do vendedor exibido no checkout) ───────────────────────────
DROP POLICY IF EXISTS "public read profiles checkout" ON public.profiles;
CREATE POLICY "public read profiles checkout"
  ON public.profiles FOR SELECT
  USING (true);
