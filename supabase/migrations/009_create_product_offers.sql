-- Garantia no produto (dias)
alter table public.products
  add column if not exists guarantee_days integer default null;

-- Tabela de ofertas do produto
create table if not exists public.product_offers (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  name           text not null,
  price          numeric(10,2) not null check (price > 0),
  type           text not null default 'one_time' check (type in ('one_time', 'recurring')),
  interval_type  text check (interval_type in ('day', 'week', 'month', 'year')),
  interval_count integer check (interval_count > 0),
  is_main        boolean not null default false,
  position       integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists product_offers_product_id_idx on public.product_offers(product_id);

alter table public.product_offers enable row level security;

-- Dono do produto gerencia suas ofertas
create policy "owner manages offers"
  on public.product_offers for all
  using (
    exists (select 1 from public.products p where p.id = product_offers.product_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.products p where p.id = product_offers.product_id and p.user_id = auth.uid())
  );

-- Anon pode ler ofertas (necessário para o checkout)
create policy "public can read offers"
  on public.product_offers for select
  using (true);

-- Referência da oferta usada na venda
alter table public.sales
  add column if not exists offer_id uuid references public.product_offers(id) on delete set null;
