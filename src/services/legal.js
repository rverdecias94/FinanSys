import { supabase } from '@/config/supabase'
import { LEGAL } from '@/config/legal'

// Versión vigente de los documentos legales (definida en src/config/legal.js).
export const CURRENT_LEGAL_VERSION = LEGAL.version

/**
 * ¿El usuario ya aceptó la versión VIGENTE de los Términos y la Privacidad?
 * Consulta la tabla `legal_acceptances` (RLS: cada quien ve lo suyo), por lo que
 * el resultado es a nivel de cuenta e independiente del dispositivo.
 * Lanza si la consulta falla, para que el gate distinga "no aceptado" de "error".
 */
export async function hasAcceptedCurrentLegal(userId) {
  if (!userId) return false
  const { data, error } = await supabase
    .from('legal_acceptances')
    .select('id')
    .eq('user_id', userId)
    .eq('version', LEGAL.version)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return !!data
}

/**
 * Registra la aceptación de la versión vigente. El RPC sella la fecha y el correo
 * en el servidor (el cliente no puede falsearlos) y es idempotente por (cuenta, versión).
 */
export async function recordLegalAcceptance(context = 'login_gate') {
  const { data, error } = await supabase.rpc('record_legal_acceptance', {
    p_version: LEGAL.version,
    p_context: context,
  })
  if (error) throw error
  return data
}
