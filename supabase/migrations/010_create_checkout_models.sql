-- Modelos de checkout por produto
create table if not exists public.checkout_models (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  name        text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Ofertas vinculadas a cada modelo de checkout
create table if not exists public.checkout_model_offers (
  checkout_model_id uuid not null references public.checkout_models(id) on delete cascade,
  offer_id          uuid not null references public.product_offers(id) on delete cascade,
  primary key (checkout_model_id, offer_id)
);

create index if not exists checkout_models_product_id_idx on public.checkout_models(product_id);

alter table public.checkout_models enable row level security;
alter table public.checkout_model_offers enable row level security;

-- Dono do produto gerencia seus modelos
create policy "owner manages checkout models"
  on public.checkout_models for all
  using (
    exists (select 1 from public.products p where p.id = checkout_models.product_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.products p where p.id = checkout_models.product_id and p.user_id = auth.uid())
  );

-- Anon pode ler modelos (checkout público precisa saber qual é o padrão)
create policy "public can read checkout models"
  on public.checkout_models for select
  using (true);

-- Dono gerencia as ofertas vinculadas
create policy "owner manages checkout model offers"
  on public.checkout_model_offers for all
  using (
    exists (
      select 1 from public.checkout_models cm
      join public.products p on p.id = cm.product_id
      where cm.id = checkout_model_offers.checkout_model_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.checkout_models cm
      join public.products p on p.id = cm.product_id
      where cm.id = checkout_model_offers.checkout_model_id and p.user_id = auth.uid()
    )
  );

-- Anon pode ler as ofertas vinculadas
create policy "public can read checkout model offers"
  on public.checkout_model_offers for select
  using (true);
