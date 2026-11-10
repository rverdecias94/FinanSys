-- ============================================================================
-- P0-009 — Mínimo privilegio: quitar EXECUTE a anon/public en RPCs sensibles
-- ============================================================================
-- Varias SECURITY DEFINER quedaron con EXECUTE para PUBLIC/anon (default de
-- Postgres o CREATE sin REVOKE). Los gates internos mitigan, pero anon no debe
-- poder invocar mutaciones de almacén/finanzas.
-- No toca helpers de identidad usados en RLS (get_current_business_id, etc.).
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'register_sale',
        'register_stock_movement',
        'post_warehouse_document',
        'approve_warehouse_document',
        'reverse_warehouse_document',
        'create_warehouse_document',
        'create_count_adjustment',
        'create_and_post_quick_movement',
        'apply_stock_balance_delta',
        'reserve_stock',
        'suggest_issue_lot',
        'adjust_inventory_item_qty',
        'count_inventory_item',
        'record_inventory_asset_event',
        'apply_inventory_template',
        'run_recurring_now',
        'set_period_lock',
        'register_account_payment'
      )
  loop
    execute format('revoke all on function %s from public', r.sig);
    execute format('revoke all on function %s from anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;
