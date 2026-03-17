-- Ajusta tabela sales para refletir os campos reais da resposta da Bestfy

-- Renomeia bestfy_transaction_id → bestfy_id
alter table public.sales
  rename column bestfy_transaction_id to bestfy_id;

-- Adiciona colunas novas
alter table public.sales
  add column if not exists qr_code_url    text,
  add column if not exists qr_code_text   text,
  add column if not exists customer_phone text;

-- Atualiza índice do bestfy_id (drop o antigo, cria novo com nome correto)
drop index if exists sales_bestfy_transaction_id_idx;
create index if not exists sales_bestfy_id_idx on public.sales(bestfy_id);
