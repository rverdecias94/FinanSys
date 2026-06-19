
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Opciones de auth explícitas (P4.4). Coinciden con los valores por defecto de
// supabase-js v2, pero se dejan escritas para documentar la intención y blindar
// el comportamiento ante futuros cambios de la librería:
// - persistSession: mantiene la sesión entre recargas (localStorage).
// - autoRefreshToken: renueva el JWT antes de expirar (sesión sin cortes).
// - detectSessionInUrl: lee el token del hash de la URL → necesario para el
//   flujo de recuperación de contraseña (ResetPassword lee #access_token).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
