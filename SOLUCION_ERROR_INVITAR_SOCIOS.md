# Solución al Error de Permisos al Invitar Socios

## Problema
Error: `permission denied for table users` (código 42501) al intentar invitar socios en la configuración.

## Causa
La política RLS `Members can view teams they belong to` en la tabla `team_members` intenta acceder directamente a `auth.users` sin los permisos adecuados.

## Solución Manual para Aplicar en Supabase

### Paso 1: Acceder al Dashboard de Supabase
1. Ve a [https://app.supabase.com](https://app.supabase.com)
2. Selecciona tu proyecto
3. Navega a **Authentication** → **Policies**

### Paso 2: Eliminar la Política Problemática
1. Busca la política: `"Members can view teams they belong to"`
2. Haz clic en los tres puntos → **Delete**
3. Confirma la eliminación

### Paso 3: Crear la Nueva Política
1. Haz clic en **Create Policy**
2. Usa estos datos:

**Name:** `Members can view teams they belong to (Fixed)`

**Target:** `team_members`

**Using Expression:**
```sql
auth.uid() = member_id
```

**Check Expression:** (déjalo vacío o usa el mismo que "Using")

**Operation:** `SELECT`

### Paso 4: Verificar la Política de Owner
Asegúrate de que también exista esta política para que los owners puedan gestionar su equipo:

**Name:** `Owners can manage their team`
**Target:** `team_members`
**Using Expression:** `auth.uid() = owner_id`
**Operation:** `ALL`

### Paso 5: Probar la Solución
1. Ve a tu aplicación
2. Navega a Configuración → Equipo y Socios
3. Intenta invitar un socio con una cuenta Premium
4. El error debería estar resuelto

## Alternativa: Script SQL Completo

Si puedes ejecutar SQL directamente en el **SQL Editor** de Supabase:

```sql
-- Eliminar políticas problemáticas
DROP POLICY IF EXISTS "Members can view teams they belong to" ON public.team_members;
DROP POLICY IF EXISTS "Owners can manage their team" ON public.team_members;

-- Crear políticas corregidas
CREATE POLICY "Members can view teams they belong to" 
ON public.team_members FOR SELECT 
USING (auth.uid() = member_id);

CREATE POLICY "Owners can manage their team" 
ON public.team_members FOR ALL 
USING (auth.uid() = owner_id);
```

## Notas Importantes

- **No modifiques** directamente las tablas del sistema `auth.users`
- **No desactives** RLS completamente (es una mala práctica de seguridad)
- **Siempre usa** `auth.uid()` o `auth.email()` en lugar de consultar tablas del sistema
- **Las políticas RLS** se aplican incluso a los administradores de la base de datos

## Si el Error Persiste

1. Verifica que el usuario tenga una cuenta **Premium activa**
2. Asegúrate de que el email del socio no esté ya registrado
3. Comprueba los logs de Supabase para más detalles del error
4. Considera usar una función con `SECURITY DEFINER` si necesitas acceso complejo

## Prevención de Futuros Errores Similares

- **Evita** consultas directas a `auth.users` en políticas RLS
- **Usa** las funciones proporcionadas por Supabase: `auth.uid()`, `auth.email()`, `auth.jwt()`
- **Prueba** todas las operaciones CRUD después de crear políticas RLS
- **Documenta** tus políticas RLS para futuras referencias