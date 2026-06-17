# ⛔ _PELIGROSO_NO_USAR — Scripts SQL en cuarentena

> Movidos aquí en la **Sesión 2 (P0 — Seguridad RLS, 2026-06-17)**.
> **NO ejecutar nunca** estos archivos contra la base de datos (ni dev ni producción).
> Se conservan solo como evidencia/historial. NO son migraciones válidas.

## Por qué son peligrosos

| Archivo | Qué hace | Riesgo |
|---|---|---|
| `disable_rls.sql` | `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` en `profiles, settings, products, transactions, movements` y quita `NOT NULL` de `user_id`. | **CRÍTICO**: desactiva por completo el aislamiento de datos. Cualquier usuario podría leer/escribir datos de cualquier negocio. |
| `20240202_allow_anon_transactions.sql` | Crea políticas que permiten al rol `anon` **insertar** transacciones (`with check (true)`) y **leer** filas con `user_id IS NULL`. | **ALTO**: expone escritura/lectura financiera a usuarios no autenticados. |
| `20260301_grant_all_public.sql` | `GRANT ALL ON ALL TABLES/SEQUENCES/ROUTINES IN SCHEMA public TO authenticated`. | **ALTO**: privilegios excesivos. Aunque RLS filtre filas, concede permisos de tabla muy por encima de lo mínimo necesario. |

## Estado canónico de RLS

El estado de seguridad **correcto y vigente** lo define:

```
supabase/migrations/rbac_hardening_v2.sql
```

Ese archivo:
- Habilita RLS (`ENABLE ROW LEVEL SECURITY`) en todas las tablas de negocio (transactions, products, movements, inventory_*, business_*, team_members, roles, subscriptions, audit_logs).
- Define el aislamiento por negocio mediante `public.get_current_business_id()` y el control por permiso mediante `public.has_permission_secure(owner_id, 'codigo.permiso')`.
- Hace `DROP POLICY IF EXISTS` de todas las políticas previas en bloque (sección 6) para evitar colisiones con scripts antiguos como los de esta carpeta.

> ⚠️ Pendiente de auditoría (P4.1): `rbac_hardening_v2.sql` **no tiene prefijo de fecha**, así que el orden de aplicación por el Supabase CLI no es determinista. Debe quedar como la **última** verdad aplicada sobre RLS. Confirmar con el MCP de Supabase que `pg_policies` y `pg_class.relrowsecurity` reflejan este estado.

## Si en el pasado se aplicó alguno de estos scripts a producción

`rbac_hardening_v2.sql` los **revierte** (re-habilita RLS y elimina las políticas anónimas/permisivas). La verificación en vivo (Sesión 1) mostró que el rol `anon` recibe 0 filas, indicio de que `disable_rls.sql` NO está activo para `anon`. La confirmación definitiva por tabla se hace con el MCP en la Sesión 2.
