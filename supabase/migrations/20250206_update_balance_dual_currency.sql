-- Rename balance_total to balance_total_usd if it exists
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='configuracion_balance' and column_name='balance_total')
  THEN
      ALTER TABLE public.configuracion_balance RENAME COLUMN balance_total TO balance_total_usd;
  END IF;
END $$;

-- Add balance_total_cup if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='configuracion_balance' and column_name='balance_total_cup')
  THEN
      ALTER TABLE public.configuracion_balance ADD COLUMN balance_total_cup numeric(14,2) default 0;
  END IF;
END $$;

-- Update the trigger function to handle dual currency
create or replace function public.handle_transaction_balance_update()
returns trigger as $$
begin
  -- Handle INSERT
  if (TG_OP = 'INSERT') then
    insert into public.configuracion_balance (user_id, balance_total_usd, balance_total_cup, updated_at)
    values (
      NEW.user_id,
      case when NEW.currency = 'USD' then 
        (case when NEW.type = 'income' then NEW.amount else -NEW.amount end)
      else 0 end,
      case when NEW.currency = 'CUP' then 
        (case when NEW.type = 'income' then NEW.amount else -NEW.amount end)
      else 0 end,
      now()
    )
    on conflict (user_id) do update
    set 
      balance_total_usd = configuracion_balance.balance_total_usd + 
        case when NEW.currency = 'USD' then 
          (case when NEW.type = 'income' then NEW.amount else -NEW.amount end)
        else 0 end,
      balance_total_cup = configuracion_balance.balance_total_cup + 
        case when NEW.currency = 'CUP' then 
          (case when NEW.type = 'income' then NEW.amount else -NEW.amount end)
        else 0 end,
      updated_at = now();
  
  -- Handle DELETE
  elsif (TG_OP = 'DELETE') then
    update public.configuracion_balance
    set 
      balance_total_usd = balance_total_usd - 
        case when OLD.currency = 'USD' then 
          (case when OLD.type = 'income' then OLD.amount else -OLD.amount end)
        else 0 end,
      balance_total_cup = balance_total_cup - 
        case when OLD.currency = 'CUP' then 
          (case when OLD.type = 'income' then OLD.amount else -OLD.amount end)
        else 0 end,
      updated_at = now()
    where user_id = OLD.user_id;
    
  -- Handle UPDATE
  elsif (TG_OP = 'UPDATE') then
    update public.configuracion_balance
    set 
      balance_total_usd = balance_total_usd 
        - (case when OLD.currency = 'USD' then (case when OLD.type = 'income' then OLD.amount else -OLD.amount end) else 0 end)
        + (case when NEW.currency = 'USD' then (case when NEW.type = 'income' then NEW.amount else -NEW.amount end) else 0 end),
      balance_total_cup = balance_total_cup 
        - (case when OLD.currency = 'CUP' then (case when OLD.type = 'income' then OLD.amount else -OLD.amount end) else 0 end)
        + (case when NEW.currency = 'CUP' then (case when NEW.type = 'income' then NEW.amount else -NEW.amount end) else 0 end),
      updated_at = now()
    where user_id = NEW.user_id;
  end if;
  
  return null;
end;
$$ language plpgsql security definer;
