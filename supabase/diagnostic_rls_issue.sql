-- Script SQL para verificar y diagnosticar el problema de RLS
-- Este script puede ayudarte a entender qué está causando el error

-- Verificar políticas actuales en team_members
SELECT polname, polcmd, polqual, polwithcheck 
FROM pg_policy 
WHERE polrelid = 'public.team_members'::regclass;

-- Verificar estructura de la tabla
\d public.team_members

-- Verificar si hay triggers que puedan estar causando el problema
SELECT tgname, tgfoid::regprocedure 
FROM pg_trigger 
WHERE tgrelid = 'public.team_members'::regclass;

-- Probar una inserción simple (esto fallará si hay problemas de RLS)
-- INSERT INTO public.team_members (owner_id, member_email, role, status) 
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test@example.com', 'editor', 'pending');

-- Verificar permisos del rol actual
SELECT current_user, session_user;

-- Verificar si hay funciones que accedan a auth.users
SELECT proname, prosrc 
FROM pg_proc 
WHERE prosrc LIKE '%auth.users%' AND proname NOT LIKE 'pg_%';