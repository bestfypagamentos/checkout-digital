-- Configurações de customização do checkout por produto
alter table public.products
  add column if not exists checkout_settings jsonb not null default '{}';
