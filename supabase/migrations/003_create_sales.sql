-- Tabela de vendas
create table if not exists public.sales (
  id                      uuid primary key default gen_random_uuid(),
  product_id              uuid not null references public.products(id) on delete set null,
  seller_id               uuid not null references auth.users(id) on delete cascade,
  bestfy_transaction_id   text,
  status                  text not null default 'pending'
                            check (status in ('pending', 'paid', 'failed', 'refunded')),
  amount                  numeric(10, 2) not null,
  customer_name           text not null,
  customer_email          text not null,
  customer_cpf            text not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Trigger updated_at
create trigger sales_updated_at
  before update on public.sales
  for each row execute procedure public.set_updated_at();

-- Índices úteis
create index sales_seller_id_idx on public.sales(seller_id);
create index sales_bestfy_transaction_id_idx on public.sales(bestfy_transaction_id);
create index sales_status_idx on public.sales(status);

-- RLS: vendedor só vê suas próprias vendas
alter table public.sales enable row level security;

create policy "select own sales"
  on public.sales for select
  using (auth.uid() = seller_id);

-- INSERT feito via service_role (Edge Function) — sem policy de insert para usuários
