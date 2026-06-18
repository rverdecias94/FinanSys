-- P1.11 — Límites de plan (monedas / socios) aplicados SERVER-SIDE (defensa en profundidad).
-- Aplicada a producción vía MCP el 2026-06-18 (Sesión 6) con aprobación de Roberto.
--
-- Contexto verificado en BD:
--   * business_currencies: la RLS `business_currencies_write` solo exigía `config.edit` +
--     `user_id = get_current_business_id()` (sin gate de plan) → un usuario FREE podía insertar
--     varias monedas por API directa; el tope de 1 vivía solo en CurrencyContext.jsx:72.
--   * team_members: la RLS `team_members_manage` ya exige `is_premium(owner_id)` (FREE=0 cubierto),
--     pero el tope PREMIUM=5 no se aplicaba → un premium podía meter socios ilimitados por API.
--   * is_premium() NO mira current_period_end; get_effective_plan_id() (abajo) sí lo honra (coherente con P1.10).
--   * Ninguna función server-side inserta en estas tablas (única vía INSERT = cliente); aceptar
--     invitación es UPDATE (no dispara el trigger BEFORE INSERT de socios).
--
-- Errores con SQLSTATE 53400 (configuration_limit_exceeded) → mapeado a mensaje amigable en
-- notifications.jsx (getSupabaseErrorMessage). Idempotente.
--
-- ROLLBACK:
--   drop trigger if exists trg_enforce_currency_limit on public.business_currencies;
--   drop trigger if exists trg_enforce_partner_limit on public.team_members;
--   drop function if exists public.enforce_currency_limit();
--   drop function if exists public.enforce_partner_limit();
--   drop function if exists public.get_effective_plan_id(uuid);
--   update public.plans set limits = limits - 'currencies' where id in ('free','premium');

-- 0) Límite de monedas como dato configurable en plans (coherente con areas/products/partners).
update public.plans set limits = limits || jsonb_build_object('currencies', 1)  where id = 'free';
update public.plans set limits = limits || jsonb_build_object('currencies', -1) where id = 'premium';

-- 1) Plan efectivo honrando expiración (premium vencido => free). is_premium() NO mira current_period_end.
create or replace function public.get_effective_plan_id(target_user uuid)
returns text language plpgsql stable security definer
set search_path = public, pg_temp set row_security = off
as $$
declare v_plan text; v_status text; v_end timestamptz;
begin
  select plan_id, status, current_period_end into v_plan, v_status, v_end
  from public.subscriptions where user_id = target_user limit 1;
  if v_plan is null then return 'free'; end if;
  if v_plan = 'premium' and v_status = 'active' and v_end is not null and v_end <= now() then
    return 'free';
  end if;
  return v_plan;
end; $$;
revoke all on function public.get_effective_plan_id(uuid) from public, anon, authenticated;

-- 2) Límite de MONEDAS activas por plan (BEFORE INSERT OR UPDATE).
create or replace function public.enforce_currency_limit()
returns trigger language plpgsql security definer
set search_path = public, pg_temp set row_security = off
as $$
declare v_plan text; v_limit int; v_count int;
begin
  if NEW.is_active is distinct from true then return NEW; end if;        -- inactiva no consume cupo
  if TG_OP = 'UPDATE' and OLD.is_active is true then return NEW; end if;  -- ya estaba activa
  v_plan := public.get_effective_plan_id(NEW.user_id);
  select coalesce((limits->>'currencies')::int, case when id='free' then 1 else -1 end)
    into v_limit from public.plans where id = v_plan;
  if v_limit is null then v_limit := case when v_plan='free' then 1 else -1 end; end if;
  if v_limit < 0 then return NEW; end if;  -- ilimitado
  select count(*) into v_count from public.business_currencies
   where user_id = NEW.user_id and is_active = true and currency_code <> NEW.currency_code;
  if v_count >= v_limit then
    raise exception 'Tu plan permite hasta % moneda(s) activa(s). Actualiza a Premium para usar más.', v_limit
      using errcode = 'configuration_limit_exceeded';
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_enforce_currency_limit on public.business_currencies;
create trigger trg_enforce_currency_limit before insert or update on public.business_currencies
for each row execute function public.enforce_currency_limit();

-- 3) Límite de SOCIOS por plan (BEFORE INSERT). free=0 ya lo cubre la RLS is_premium; cierra el premium=5.
create or replace function public.enforce_partner_limit()
returns trigger language plpgsql security definer
set search_path = public, pg_temp set row_security = off
as $$
declare v_plan text; v_limit int; v_count int;
begin
  v_plan := public.get_effective_plan_id(NEW.owner_id);
  select coalesce((limits->>'partners')::int, 0) into v_limit from public.plans where id = v_plan;
  if v_limit is null then v_limit := 0; end if;
  if v_limit < 0 then return NEW; end if;  -- ilimitado
  select count(*) into v_count from public.team_members where owner_id = NEW.owner_id;
  if v_count >= v_limit then
    raise exception 'Tu plan permite hasta % socio(s). Actualiza a Premium para añadir más.', v_limit
      using errcode = 'configuration_limit_exceeded';
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_enforce_partner_limit on public.team_members;
create trigger trg_enforce_partner_limit before insert on public.team_members
for each row execute function public.enforce_partner_limit();
