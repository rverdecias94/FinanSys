-- Fix: allow team members with status 'accepted' or 'active' to view business_settings

drop policy if exists "Owner and Team can view business_settings" on public.business_settings;
create policy "Owner and Team can view business_settings"
on public.business_settings
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.team_members tm
    where tm.member_id = auth.uid()
      and tm.owner_id = business_settings.user_id
      and tm.status in ('active', 'accepted')
  )
);

notify pgrst, 'reload schema';
