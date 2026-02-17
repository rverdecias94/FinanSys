-- Solución temporal para el problema de RLS en team_members
-- Este script puede ser ejecutado directamente en el dashboard de Supabase

-- Paso 1: Eliminar la política problemática
DROP POLICY IF EXISTS "Members can view teams they belong to" ON public.team_members;

-- Paso 2: Crear una política simplificada que evita acceder a auth.users
CREATE POLICY "Members can view teams they belong to" 
ON public.team_members FOR SELECT 
USING (auth.uid() = member_id);

-- Paso 3: Asegurar que la política de owner esté correctamente configurada
DROP POLICY IF EXISTS "Owners can manage their team" ON public.team_members;

CREATE POLICY "Owners can manage their team" 
ON public.team_members FOR ALL 
USING (auth.uid() = owner_id);