-- Permitir que los miembros de equipo vean las monedas del negocio del propietario
-- Mantiene INSERT/UPDATE/DELETE solo para el owner

-- Asegurar RLS habilitado
ALTER TABLE public.business_currencies ENABLE ROW LEVEL SECURITY;

-- Reemplazar la política de SELECT para incluir acceso del equipo
DROP POLICY IF EXISTS business_currencies_select_own ON public.business_currencies;
DROP POLICY IF EXISTS "Owner and Team access business_currencies" ON public.business_currencies;

CREATE POLICY "Owner and Team access business_currencies"
ON public.business_currencies
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE member_id = auth.uid()
      AND owner_id = business_currencies.user_id
      AND status = 'active'
  )
);

