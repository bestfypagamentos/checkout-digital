-- Tabela de produtos
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text,
  price         numeric(10, 2) not null check (price > 0),
  delivery_url  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Atualiza updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();

-- Row Level Security: cada user só vê/edita os próprios produtos
alter table public.products enable row level security;

create policy "select own products"
  on public.products for select
  using (auth.uid() = user_id);

create policy "insert own products"
  on public.products for insert
  with check (auth.uid() = user_id);

create policy "update own products"
  on public.products for update
  using (auth.uid() = user_id);

create policy "delete own products"
  on public.products for delete
  using (auth.uid() = user_id);

-- Habilita Realtime para a tabela
alter publication supabase_realtime add table public.products;
