-- Tabela de cupons de desconto
create table if not exists public.coupons (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products(id) on delete cascade,
  code             text not null,
  discount_percent integer not null check (discount_percent >= 1 and discount_percent <= 100),
  starts_at        timestamptz,
  expires_at       timestamptz,
  apply_to_bumps   boolean not null default false,
  created_at       timestamptz not null default now(),
  constraint coupons_unique_code unique (product_id, code)
);

create index coupons_product_id_idx on public.coupons(product_id);

alter table public.coupons enable row level security;

-- Dono do produto gerencia seus cupons
create policy "owner manages coupons"
  on public.coupons for all
  using (
    exists (select 1 from public.products p where p.id = coupons.product_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.products p where p.id = coupons.product_id and p.user_id = auth.uid())
  );

-- Anon pode ler cupons para validar no checkout (o código é a senha)
create policy "public can read coupons"
  on public.coupons for select
  using (true);

-- Adiciona referência ao cupom usado na venda
alter table public.sales
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null;
