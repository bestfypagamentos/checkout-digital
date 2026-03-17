-- Tabela de perfis (extende auth.users)
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  bestfy_api_key       text,
  bestfy_company_name  text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Trigger updated_at (reutiliza a função criada na migration anterior)
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Cria profile automaticamente ao registrar um novo usuário
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security: cada user só acessa o próprio profile
alter table public.profiles enable row level security;

create policy "select own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id);
