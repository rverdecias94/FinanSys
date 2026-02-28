-- Drop the old audit table if it exists
DROP TABLE IF EXISTS public.balance_audit_log;

-- Redefine the RPC to remove dependency on balance_audit_log
CREATE OR REPLACE FUNCTION public.update_balance_config_secure(
  p_new_initial_usd numeric,
  p_new_initial_cup numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_old_initial_usd numeric;
  v_old_initial_cup numeric;
  v_current_usd numeric;
  v_current_cup numeric;
  v_delta_usd numeric;
  v_delta_cup numeric;
  v_result json;
BEGIN
  v_user_id := auth.uid();
  
  -- Get current values
  SELECT initial_balance_usd, initial_balance_cup, balance_total_usd, balance_total_cup
  INTO v_old_initial_usd, v_old_initial_cup, v_current_usd, v_current_cup
  FROM configuracion_balance
  WHERE user_id = v_user_id;

  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO configuracion_balance (
      user_id, 
      initial_balance_usd, initial_balance_cup, 
      balance_total_usd, balance_total_cup
    )
    VALUES (
      v_user_id, 
      p_new_initial_usd, p_new_initial_cup, 
      p_new_initial_usd, p_new_initial_cup
    )
    RETURNING json_build_object(
      'initial_usd', initial_balance_usd, 
      'initial_cup', initial_balance_cup, 
      'total_usd', balance_total_usd, 
      'total_cup', balance_total_cup
    )
    INTO v_result;
    
    -- No audit log here inside RPC anymore, handled by application layer or separate trigger if needed
    
    RETURN v_result;
  END IF;

  -- Calculate deltas
  v_delta_usd := p_new_initial_usd - COALESCE(v_old_initial_usd, 0);
  v_delta_cup := p_new_initial_cup - COALESCE(v_old_initial_cup, 0);

  -- Update
  UPDATE configuracion_balance
  SET 
    initial_balance_usd = p_new_initial_usd,
    initial_balance_cup = p_new_initial_cup,
    balance_total_usd = balance_total_usd + v_delta_usd,
    balance_total_cup = balance_total_cup + v_delta_cup,
    updated_at = now()
  WHERE user_id = v_user_id
  RETURNING json_build_object(
    'initial_usd', initial_balance_usd, 
    'initial_cup', initial_balance_cup, 
    'total_usd', balance_total_usd, 
    'total_cup', balance_total_cup
  )
  INTO v_result;

  RETURN v_result;
END;
$$;
