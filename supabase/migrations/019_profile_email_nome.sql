-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 019 — Perfil: email e nome preenchidos automaticamente no cadastro
--
-- Problema: handle_new_user só inseria o id, deixando email e nome como NULL.
-- Solução: atualizar a função para copiar email e full_name do auth.users.
-- ══════════════════════════════════════════════════════════════════════════════

-- Garante que as colunas existam (seguro re-executar)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS nome  text;

-- Atualiza o trigger para popular email e nome no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        nome  = EXCLUDED.nome;
  RETURN new;
END;
$$;
