-- Deshabilitar RLS para permitir uso sin autenticación
-- Ejecutar en el Editor SQL de Supabase

-- Tabla: profiles
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Tabla: settings
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- Tabla: products
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- Tabla: transactions
ALTER TABLE transactions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- Tabla: movements
ALTER TABLE movements ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE movements DISABLE ROW LEVEL SECURITY;

-- Política de acceso público (por si acaso se reactiva RLS accidentalmente)
-- DROP POLICY IF EXISTS "Public access" ON transactions;
-- CREATE POLICY "Public access" ON transactions FOR ALL USING (true);
-- ... repetir para otras tablas si fuera necesario ...
