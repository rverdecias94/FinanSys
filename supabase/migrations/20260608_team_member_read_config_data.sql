-- Permitir que miembros activos del equipo lean monedas y balances del negocio
-- sin requerir config.view (necesario para Editor en Finanzas)

DROP POLICY IF EXISTS business_currencies_read ON public.business_currencies;
CREATE POLICY business_currencies_read ON public.business_currencies
FOR SELECT
USING (
  public.has_permission_secure(user_id, 'config.view')
  OR public.is_member_of_team(user_id)
);

DROP POLICY IF EXISTS business_balances_read ON public.business_balances;
CREATE POLICY business_balances_read ON public.business_balances
FOR SELECT
USING (
  public.has_permission_secure(user_id, 'config.view')
  OR public.is_member_of_team(user_id)
);

DROP POLICY IF EXISTS configuracion_balance_read ON public.configuracion_balance;
CREATE POLICY configuracion_balance_read ON public.configuracion_balance
FOR SELECT
USING (
  public.has_permission_secure(user_id, 'config.view')
  OR public.is_member_of_team(user_id)
);
