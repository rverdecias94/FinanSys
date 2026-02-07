-- Create configuracion_balance table
create table if not exists public.configuracion_balance (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  balance_total numeric(14,2) default 0,
  updated_at timestamptz default now(),
  unique(user_id)
);

-- Enable RLS
alter table public.configuracion_balance enable row level security;

-- Create policies
create policy "Users can view their own balance config"
  on public.configuracion_balance for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their own balance config"
  on public.configuracion_balance for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own balance config"
  on public.configuracion_balance for update
  to authenticated
  using (user_id = auth.uid());

-- Function to handle balance updates
create or replace function public.handle_transaction_balance_update()
returns trigger as $$
begin
  -- Handle INSERT
  if (TG_OP = 'INSERT') then
    insert into public.configuracion_balance (user_id, balance_total, updated_at)
    values (
      NEW.user_id,
      case 
        when NEW.type = 'income' then NEW.amount
        else -NEW.amount
      end,
      now()
    )
    on conflict (user_id) do update
    set 
      balance_total = configuracion_balance.balance_total + case 
        when NEW.type = 'income' then NEW.amount
        else -NEW.amount
      end,
      updated_at = now();
  
  -- Handle DELETE
  elsif (TG_OP = 'DELETE') then
    update public.configuracion_balance
    set 
      balance_total = balance_total - case 
        when OLD.type = 'income' then OLD.amount
        else -OLD.amount
      end,
      updated_at = now()
    where user_id = OLD.user_id;
    
  -- Handle UPDATE
  elsif (TG_OP = 'UPDATE') then
    update public.configuracion_balance
    set 
      balance_total = balance_total 
        - case when OLD.type = 'income' then OLD.amount else -OLD.amount end
        + case when NEW.type = 'income' then NEW.amount else -NEW.amount end,
      updated_at = now()
    where user_id = NEW.user_id;
  end if;
  
  return null;
end;
$$ language plpgsql security definer;

-- Trigger
drop trigger if exists on_transaction_balance_update on public.transactions;
create trigger on_transaction_balance_update
  after insert or update or delete on public.transactions
  for each row execute function public.handle_transaction_balance_update();
