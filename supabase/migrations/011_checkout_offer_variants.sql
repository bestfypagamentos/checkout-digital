-- Tabela de junção: uma oferta pode pertencer a múltiplos checkouts
CREATE TABLE IF NOT EXISTS checkout_offer_variants (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  checkout_id uuid NOT NULL REFERENCES product_checkouts(id) ON DELETE CASCADE,
  offer_id    uuid NOT NULL REFERENCES product_offers(id)    ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(checkout_id, offer_id)
);

-- Migra dados existentes (checkout_id armazenado em product_offers → junction table)
INSERT INTO checkout_offer_variants (checkout_id, offer_id)
SELECT checkout_id, id
FROM   product_offers
WHERE  checkout_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Remove coluna legada
ALTER TABLE product_offers DROP COLUMN IF EXISTS checkout_id;
