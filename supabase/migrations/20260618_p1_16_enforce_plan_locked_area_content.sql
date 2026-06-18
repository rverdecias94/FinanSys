-- P1.16 — Congelar el CONTENIDO de un área bloqueada por plan (plan_locked).
-- Aplicada a producción vía MCP el 2026-06-18 (Sesión 6b) con aprobación de Roberto,
-- tras reproducir la fuga en vivo (downgrade real del owner → REST UPDATE 200 / INSERT 201
-- sobre ítems de un área bloqueada).
--
-- Contexto: el downgrade Premium→Free NO borra las áreas excedentes; las marca
-- plan_locked=true. El único guard previo (`enforce_inventory_area_update_if_locked`,
-- BEFORE UPDATE en inventory_areas) cubría SOLO la fila del área. Las RLS de
-- inventory_items / inventory_area_fields / inventory_area_prefixes solo miran permisos,
-- así que un usuario free podía seguir creando/editando ítems y campos dentro de sus
-- áreas premium bloqueadas por API (uso desmedido de funciones premium).
--
-- Fix: triggers BEFORE INSERT/UPDATE en las 3 tablas hijas que bloquean la escritura
-- cuando el área (origen o destino) está bloqueada, respetando app.bypass_plan_lock
-- (que usan apply_downgrade_to_free / apply_subscription_policies). Lectura y DELETE
-- quedan permitidos (no se pierde data; se puede limpiar/eliminar el área).
-- Error con SQLSTATE 53400 (configuration_limit_exceeded) → mensaje amigable en cliente.
--
-- ROLLBACK:
--   drop trigger if exists trg_lock_items    on public.inventory_items;
--   drop trigger if exists trg_lock_fields   on public.inventory_area_fields;
--   drop trigger if exists trg_lock_prefixes on public.inventory_area_prefixes;
--   drop function if exists public.enforce_locked_area_write();

create or replace function public.enforce_locked_area_write()
returns trigger language plpgsql security definer
set search_path = public, pg_temp set row_security = off
as $$
declare v_locked boolean;
begin
  if current_setting('app.bypass_plan_lock', true) = '1' then
    return NEW;
  end if;
  select bool_or(a.plan_locked) into v_locked
  from public.inventory_areas a
  where a.id = NEW.area_id or (TG_OP = 'UPDATE' and a.id = OLD.area_id);
  if v_locked is true then
    raise exception 'Área bloqueada por tu plan. Actualiza a Premium para editar su contenido.'
      using errcode = 'configuration_limit_exceeded';
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_lock_items    on public.inventory_items;
drop trigger if exists trg_lock_fields   on public.inventory_area_fields;
drop trigger if exists trg_lock_prefixes on public.inventory_area_prefixes;

create trigger trg_lock_items    before insert or update on public.inventory_items
  for each row execute function public.enforce_locked_area_write();
create trigger trg_lock_fields   before insert or update on public.inventory_area_fields
  for each row execute function public.enforce_locked_area_write();
create trigger trg_lock_prefixes before insert or update on public.inventory_area_prefixes
  for each row execute function public.enforce_locked_area_write();
