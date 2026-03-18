-- Cada modelo de checkout tem suas próprias configurações visuais (cores, logo, timer)
ALTER TABLE public.product_checkouts
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';
