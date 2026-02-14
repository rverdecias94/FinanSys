
-- Add initial_balance columns to configuracion_balance
DO $$
BEGIN
  IF NOT EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='configuracion_balance' and column_name='initial_balance_usd')
  THEN
      ALTER TABLE public.configuracion_balance ADD COLUMN initial_balance_usd numeric(14,2) default 0;
  END IF;

  IF NOT EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='configuracion_balance' and column_name='initial_balance_cup')
  THEN
      ALTER TABLE public.configuracion_balance ADD COLUMN initial_balance_cup numeric(14,2) default 0;
  END IF;
END $$;

-- Create balance_audit_log table
create table if not exists public.balance_audit_log (
  id bigserial primary key,
  user_id uuid references auth.users(id) not null,
  action_type text not null,
  previous_initial_usd numeric(14,2),
  new_initial_usd numeric(14,2),
  previous_initial_cup numeric(14,2),
  new_initial_cup numeric(14,2),
  changed_at timestamptz default now(),
  changed_by uuid references auth.users(id)
);

-- Enable RLS for audit log
alter table public.balance_audit_log enable row level security;

create policy "Users can view their own audit logs"
  on public.balance_audit_log for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their own audit logs"
  on public.balance_audit_log for insert
  to authenticated
  with check (user_id = auth.uid());

-- RPC to securely update balance config
create or replace function update_balance_config_secure(
  p_new_initial_usd numeric,
  p_new_initial_cup numeric
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_old_initial_usd numeric;
  v_old_initial_cup numeric;
  v_current_usd numeric;
  v_current_cup numeric;
  v_delta_usd numeric;
  v_delta_cup numeric;
  v_result json;
begin
  v_user_id := auth.uid();
  
  -- Get current values
  select initial_balance_usd, initial_balance_cup, balance_total_usd, balance_total_cup
  into v_old_initial_usd, v_old_initial_cup, v_current_usd, v_current_cup
  from configuracion_balance
  where user_id = v_user_id;

  -- If no record exists, create one
  if not found then
    insert into configuracion_balance (
      user_id, 
      initial_balance_usd, initial_balance_cup, 
      balance_total_usd, balance_total_cup
    )
    values (
      v_user_id, 
      p_new_initial_usd, p_new_initial_cup, 
      p_new_initial_usd, p_new_initial_cup
    )
    returning json_build_object(
      'initial_usd', initial_balance_usd, 
      'initial_cup', initial_balance_cup, 
      'total_usd', balance_total_usd, 
      'total_cup', balance_total_cup
    )
    into v_result;
    
    -- Log audit (creation)
    insert into balance_audit_log (
      user_id, action_type, 
      new_initial_usd, new_initial_cup, 
      changed_by
    )
    values (
      v_user_id, 'CREATE_INITIAL', 
      p_new_initial_usd, p_new_initial_cup, 
      auth.uid()
    );
    
    return v_result;
  end if;

  -- Calculate deltas
  v_delta_usd := p_new_initial_usd - coalesce(v_old_initial_usd, 0);
  v_delta_cup := p_new_initial_cup - coalesce(v_old_initial_cup, 0);

  -- Update
  update configuracion_balance
  set 
    initial_balance_usd = p_new_initial_usd,
    initial_balance_cup = p_new_initial_cup,
    balance_total_usd = balance_total_usd + v_delta_usd,
    balance_total_cup = balance_total_cup + v_delta_cup,
    updated_at = now()
  where user_id = v_user_id
  returning json_build_object(
    'initial_usd', initial_balance_usd, 
    'initial_cup', initial_balance_cup, 
    'total_usd', balance_total_usd, 
    'total_cup', balance_total_cup
  )
  into v_result;

  -- Log audit
  insert into balance_audit_log (
    user_id, action_type, 
    previous_initial_usd, new_initial_usd, 
    previous_initial_cup, new_initial_cup, 
    changed_by
  )
  values (
    v_user_id, 'UPDATE_INITIAL', 
    v_old_initial_usd, p_new_initial_usd, 
    v_old_initial_cup, p_new_initial_cup, 
    auth.uid()
  );

  return v_result;
end;
$$;
