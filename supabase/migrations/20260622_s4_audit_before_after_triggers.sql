-- 20260622_s4_audit_before_after_triggers.sql
-- S4 (Q16) — Auditoría con "antes y después" a nivel de base de datos.
--
-- PROBLEMA: audit_logs solo guardaba quién/cuándo/acción (details = metadatos), NO
-- el valor viejo vs nuevo. Además el logger era cliente, solo-Premium y best-effort.
--
-- SOLUCIÓN: triggers de BD sobre transactions/contacts/products que capturan
-- old_value/new_value (fila completa) + actor (auth.uid) + negocio (user_id) + acción.
-- Confiable: server-side, para TODOS los usuarios (no solo Premium). A prueba de
-- fallos: el cuerpo va envuelto en EXCEPTION -> un fallo de auditoría NUNCA aborta la
-- operación de negocio (igual de tolerante que el logger cliente, pero fiable).
--
-- Privacidad: old/new de transactions contiene montos. La UI muestra los valores solo
-- a quien tenga finanzas.view; al resto, solo los NOMBRES de campos cambiados. El
-- user_id (UUID) se excluye del payload (coherente con la limpieza previa P2.2).
-- audit_logs sigue siendo append-only (RLS bloquea UPDATE/DELETE) y legible con logs.view.
--
-- Dedup: se eliminan los logAction cliente de create/update/delete de esas 3 tablas
-- (los triggers son ahora la fuente). El logger cliente se mantiene para acciones de
-- app no ligadas a fila (equipo, config, monedas, login, export, movimientos).
--
-- Idempotente (CREATE OR REPLACE / DROP TRIGGER IF EXISTS / ADD COLUMN IF NOT EXISTS).
-- Reversible: ver ROLLBACK al final.

alter table public.audit_logs
  add column if not exists old_value jsonb,
  add column if not exists new_value jsonb;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_actor uuid;
  v_business uuid;
  v_action text;
  v_resource text;
  v_old jsonb;
  v_new jsonb;
  v_email text;
  v_area text;
begin
  begin  -- la auditoría NUNCA debe romper la operación de negocio
    v_actor := auth.uid();

    if (tg_op = 'INSERT') then
      v_action := 'Crear';
      v_new := to_jsonb(new) - 'user_id';
      v_business := new.user_id;
    elsif (tg_op = 'UPDATE') then
      v_action := 'Actualizar';
      v_old := to_jsonb(old) - 'user_id';
      v_new := to_jsonb(new) - 'user_id';
      v_business := new.user_id;
    else
      v_action := 'Eliminar';
      v_old := to_jsonb(old) - 'user_id';
      v_business := old.user_id;
    end if;

    if tg_table_name = 'transactions' then
      v_area := 'Finanzas';
      v_resource := trim('Transacción: ' || coalesce(v_new->>'description', v_old->>'description', ''));
    elsif tg_table_name = 'contacts' then
      v_area := 'Finanzas';
      v_resource := trim('Contacto: ' || coalesce(v_new->>'name', v_old->>'name', ''));
    elsif tg_table_name = 'products' then
      v_area := 'Almacén';
      v_resource := trim('Producto: ' || coalesce(v_new->>'name', v_old->>'name', ''));
    else
      v_area := 'General';
      v_resource := tg_table_name;
    end if;

    select email into v_email from auth.users where id = v_actor;

    insert into public.audit_logs
      (business_id, actor_id, user_id, user_email, action, resource, area, old_value, new_value, details)
    values
      (v_business, v_actor, v_actor, v_email, v_action, v_resource, v_area, v_old, v_new, '{}'::jsonb);
  exception when others then
    null;  -- swallow: nunca abortar la operación de negocio por un fallo de auditoría
  end;
  return null;  -- AFTER trigger
end;
$$;

drop trigger if exists trg_audit_transactions on public.transactions;
create trigger trg_audit_transactions
  after insert or update or delete on public.transactions
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_contacts on public.contacts;
create trigger trg_audit_contacts
  after insert or update or delete on public.contacts
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_products on public.products;
create trigger trg_audit_products
  after insert or update or delete on public.products
  for each row execute function public.audit_row_change();

-- ============================================================================
-- ROLLBACK (manual):
--   drop trigger if exists trg_audit_transactions on public.transactions;
--   drop trigger if exists trg_audit_contacts on public.contacts;
--   drop trigger if exists trg_audit_products on public.products;
--   drop function if exists public.audit_row_change();
--   alter table public.audit_logs drop column if exists old_value, drop column if exists new_value;
--   (y restaurar los logAction cliente en finanzas.js/contacts.js/almacen.js)
-- ============================================================================
