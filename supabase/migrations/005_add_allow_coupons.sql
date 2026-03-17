-- Adiciona suporte a cupons opcionais por produto
alter table public.products
  add column if not exists allow_coupons boolean not null default false;
