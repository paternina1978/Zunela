-- Alternativa manual al RPC bootstrap_first_admin().
-- 1) Registra la cuenta en la app (Auth).
-- 2) Copia el UUID de auth.users / profiles.
-- 3) Ejecuta en SQL Editor (service role / postgres):

-- UPDATE public.memberships
-- SET role = 'administrador', updated_at = now()
-- WHERE user_id = '<UUID_DEL_PRIMER_ADMIN>';

-- Preferido desde la app (Cuenta → «Soy el primer administrador»)
-- si aún no existe ningún administrador: select public.bootstrap_first_admin();
