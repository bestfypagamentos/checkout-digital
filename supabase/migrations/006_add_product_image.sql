-- Coluna para URL da imagem do produto
alter table public.products
  add column if not exists image_url text;

-- Bucket público para imagens de produtos
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Políticas de storage
create policy "Vendedor pode fazer upload de imagens"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Vendedor pode atualizar imagens"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Vendedor pode excluir imagens"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Imagens de produtos são públicas"
  on storage.objects for select
  using (bucket_id = 'product-images');
