-- ============================================================================
-- P0.8 — Fijar search_path en las funciones SECURITY DEFINER restantes
-- ============================================================================
-- Sesión 3 (2026-06-17). Aplicada en producción vía MCP apply_migration.
-- Versión registrada en el remoto: 20260617222444 (p0_8_pin_search_path_remaining_funcs)
--
-- Contexto: el advisor de seguridad reportaba `function_search_path_mutable`
-- en 9 funciones SECURITY DEFINER + 1 trigger (SECURITY INVOKER) sin
-- `SET search_path`. Mismo fix que P0.4 (is_premium) de la Sesión 2.
-- No cambia la lógica de ninguna función; sólo fija el search_path para
-- evitar secuestro por resolución de nombres. Idempotente.
--
-- Verificación: pg_proc.proconfig -> {search_path=public, pg_temp} en las 10;
-- get_advisors(security): function_search_path_mutable pasó de 10 a 0.
--
-- Rollback (no recomendado): ALTER FUNCTION ... RESET search_path; por función.
-- ============================================================================

ALTER FUNCTION public.handle_transaction_balance_update()            SET search_path = public, pg_temp;
ALTER FUNCTION public.create_inventory_item(uuid, bigint, jsonb)     SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_inventory_sku(uuid, bigint)           SET search_path = public, pg_temp;
ALTER FUNCTION public.update_balance_config_secure(numeric, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_usage(uuid, text)                    SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_invitation_token(uuid)                SET search_path = public, pg_temp;
ALTER FUNCTION public.accept_invitation_by_email(text)               SET search_path = public, pg_temp;
ALTER FUNCTION public.get_effective_business_id(uuid)                SET search_path = public, pg_temp;
ALTER FUNCTION public.accept_invitation_secure(text, uuid)           SET search_path = public, pg_temp;
ALTER FUNCTION public.touch_business_settings_updated_at()           SET search_path = public, pg_temp;
