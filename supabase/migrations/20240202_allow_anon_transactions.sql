-- Permitir a usuarios anónimos (o sin sesión) insertar transacciones
-- Esto es útil si la aplicación permite probarse sin login
create policy transactions_insert_anon on public.transactions
for insert
to anon
with check (true);

-- Permitir a usuarios anónimos leer transacciones donde user_id es null
create policy transactions_read_anon on public.transactions
for select
to anon
using (user_id is null);

-- Actualizar la política de insert para usuarios autenticados para ser más permisiva en caso de errores de sesión
-- Opcional: permitir que inserten incluso si user_id es null (aunque lo ideal es que sea su id)
-- Por ahora mantenemos la estricta para autenticados, pero añadimos la de anon.
