-- Mínimo privilegio para el rol anónimo (público).
--
-- Contexto: el rol `anon` (con el que se conecta cualquier visitante sin sesión, y cuya
-- clave viaja pública en el bundle JS) conservaba INSERT/UPDATE/DELETE/TRUNCATE/… en las
-- 31 tablas de negocio. Hoy NO es explotable porque RLS lo bloquea en todas, pero es la
-- única barrera: si una tabla perdiera su RLS (ya hubo scripts de disable_rls/grant_all en
-- cuarentena), cualquiera en Internet podría escribir datos financieros sin login.
--
-- Esta migración deja a `anon` SOLO con SELECT (lectura de catálogos pre-login: monedas,
-- planes, categorías). Es sustractiva y reversible con un GRANT. Verificado antes de
-- aplicar: ningún flujo pre-login (Signup/ForgotPassword/ResetPassword) escribe directo
-- como anon (usan Auth); las RPCs pre-login son SECURITY DEFINER; y el rol `authenticated`
-- conserva su escritura en 34 tablas (los flujos con sesión no se ven afectados).
--
-- Aplicada al remoto vía MCP el 2026-07-04 (migración `revoke_anon_write_privileges`).

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM anon;

-- Tablas futuras (creadas por el rol postgres en las migraciones):
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon;

-- Equivalente para objetos de supabase_admin, tolerante a que el rol de migración
-- no tenga privilegio (no crítico: en 'public' las tablas de la app las crea postgres).
DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Default de supabase_admin no alterado (no critico): %', SQLERRM;
END $$;
