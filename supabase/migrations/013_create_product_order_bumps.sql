create table if not exists public.product_order_bumps (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete cascade,
  bump_product_id uuid not null references public.products(id) on delete cascade,
  bump_offer_id   uuid          references public.product_offers(id) on delete set null,
  cta             text not null default 'Sim! Quero adicionar',
  title           text not null default '',
  description     text,
  apply_discount  boolean not null default false,
  original_price  numeric(10,2),
  position        int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists product_order_bumps_product_id_idx on public.product_order_bumps(product_id);

alter table public.product_order_bumps enable row level security;

-- Dono do produto gerencia os bumps
create policy "owner manages order bumps"
  on public.product_order_bumps for all
  using (
    exists (select 1 from public.products p where p.id = product_order_bumps.product_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.products p where p.id = product_order_bumps.product_id and p.user_id = auth.uid())
  );

-- Anon pode ler (checkout público precisa exibir os bumps)
create policy "public can read order bumps"
  on public.product_order_bumps for select
  using (true);
