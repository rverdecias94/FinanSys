-- Phase 1 Part 2: Email Validation Logic

create or replace function public.check_email_availability(email_input text)
returns boolean
language plpgsql
security definer
as $$
declare
  target_user_id uuid;
  is_owner boolean;
  is_member boolean;
begin
  -- 1. Get User ID if exists
  select id into target_user_id from auth.users where email = email_input limit 1;
  
  -- If user doesn't exist, email is available for invitation (as a new user)
  if target_user_id is null then
    return true;
  end if;

  -- 2. Check if user is an Owner (has critical business data)
  -- We assume an owner has entries in business_balances or products created by them as owner
  -- Or simpler: Check if they are owner in any team_members (but they might not have team members yet)
  -- Better check: Check if they have initiated business configuration (business_balances)
  select exists(
    select 1 from public.business_balances where user_id = target_user_id
  ) into is_owner;

  if is_owner then
    return false; -- Cannot invite an existing business owner as a member
  end if;

  -- 3. Check if user is already a member of ANY team (even if pending)
  select exists(
    select 1 from public.team_members where member_email = email_input
  ) into is_member;

  if is_member then
    return false; -- User is already part of another team
  end if;

  return true;
end;
$$;
