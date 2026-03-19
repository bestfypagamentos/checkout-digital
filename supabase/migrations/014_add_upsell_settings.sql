-- Adiciona coluna upsell_settings à tabela products
-- Armazena configurações de Upsell/Downsell e e-mail de confirmação

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS upsell_settings jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN products.upsell_settings IS
  'Configurações de upsell/downsell: redirecionamento pós-compra e e-mail de confirmação';
