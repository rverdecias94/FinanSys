-- 20260617_p0_security_hardening.sql
-- P0 — Endurecimiento de seguridad (Sesión 2 del relay, 2026-06-17).
-- APLICADO A PRODUCCIÓN vía MCP (apply_migration "p0_security_hardening") y VERIFICADO.
-- Todo idempotente y reversible (rollback documentado al final).
-- Contexto: docs/PLAN_DE_TRABAJO.md (P0) y supabase/_PELIGROSO_NO_USAR/README.md.
-- Estado canónico de RLS: supabase/migrations/rbac_hardening_v2.sql.

-- ── P0.4 — Fijar search_path en is_premium ───────────────────────────────────
-- is_premium() es SECURITY DEFINER y se usa DENTRO de una política RLS
-- (team_members_manage). Sin search_path fijo era vulnerable a hijacking del
-- search_path. No cambia la lógica de la función.
ALTER FUNCTION public.is_premium(uuid) SET search_path = public, pg_temp;

-- ── P0.5 — Consistencia: añadir pg_temp a check_email_availability ────────────
-- Ya tenía search_path=public; se añade pg_temp por consistencia con el resto
-- de helpers endurecidas. Sigue devolviendo solo booleano.
ALTER FUNCTION public.check_email_availability(text) SET search_path = public, pg_temp;

-- ── P0.2 — Mínimo privilegio: quitar grants que saltan RLS / no usa PostgREST ─
-- TRUNCATE, TRIGGER y REFERENCES no los usa la API (PostgREST solo hace
-- SELECT/INSERT/UPDATE/DELETE) y TRUNCATE además IGNORA las políticas RLS.
-- Se revocan de authenticated Y anon (ambos los tenían por grant_all_public.sql,
-- ahora en cuarentena). service_role conserva acceso completo (rol backend).
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon;

-- ── plans — cerrar el único ERROR del advisor (rls_disabled_in_public) ────────
-- 'plans' es catálogo de planes (free/premium), SIN datos de usuario ni PII.
-- Se activa RLS con lectura pública (comportamiento idéntico al actual para
-- lecturas) y se bloquean escrituras del cliente (solo service_role/owner).
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plans_read_all ON public.plans;
CREATE POLICY plans_read_all ON public.plans FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (si hiciera falta revertir):
--   ALTER FUNCTION public.is_premium(uuid) RESET search_path;
--   ALTER FUNCTION public.check_email_availability(text) SET search_path = public;
--   GRANT TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public TO authenticated;
--   GRANT TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public TO anon;
--   DROP POLICY IF EXISTS plans_read_all ON public.plans;
--   ALTER TABLE public.plans DISABLE ROW LEVEL SECURITY;
