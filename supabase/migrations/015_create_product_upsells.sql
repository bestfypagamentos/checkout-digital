-- Tabela para armazenar configurações do Gerador de Upsell/Downsell
CREATE TABLE IF NOT EXISTS product_upsells (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      uuid REFERENCES auth.users NOT NULL,
  product_id     uuid REFERENCES products    NOT NULL,
  offer_id       uuid REFERENCES product_offers,
  type           text NOT NULL DEFAULT 'upsell'
                   CHECK (type IN ('upsell', 'downsell')),
  accept_action  text NOT NULL DEFAULT 'redirect_members'
                   CHECK (accept_action IN ('redirect_members', 'offer_another')),
  accept_url     text,
  reject_action  text NOT NULL DEFAULT 'redirect_members'
                   CHECK (reject_action IN ('redirect_members', 'offer_another')),
  reject_url     text,
  accept_text    text NOT NULL DEFAULT 'Sim! Eu quero essa oferta especial!',
  reject_text    text NOT NULL DEFAULT 'Não, obrigado. Não quero essa oferta.',
  accept_color   text NOT NULL DEFAULT '#10b981',
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE product_upsells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller manages own upsells"
  ON product_upsells FOR ALL TO authenticated
  USING  (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());
