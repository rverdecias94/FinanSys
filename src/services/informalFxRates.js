import { supabase } from '@/config/supabase'
import {
  INFORMAL_FX_SOURCE_LABEL,
  INFORMAL_FX_SOURCE_URL,
  normalizeCupPerForeign,
  suggestUnitsPerBaseForCurrencies,
} from '@/utils/informalFxRates'

/**
 * Consulta la Edge Function que hace de proxy a la API oficial de elTOQUE (TRMI).
 * Si falla (sin clave, red, cuota…), el caller debe pedir la tasa a mano.
 *
 * @returns {Promise<{
 *   ok: true,
 *   cupPerForeign: Record<string, number>,
 *   source: string,
 *   sourceUrl: string,
 *   attribution: string,
 *   fetchedAt: string,
 *   asOf: string|null,
 *   cached: boolean,
 * } | {
 *   ok: false,
 *   error: string,
 * }>}
 */
export async function fetchInformalFxRates() {
  try {
    const { data, error } = await supabase.functions.invoke('informal-fx-rates', {
      body: {},
    })

    if (error) {
      return {
        ok: false,
        error: friendlyInvokeError(error),
      }
    }

    if (data?.ok === false || data?.error) {
      return {
        ok: false,
        error: String(data.error || 'No se pudieron obtener las tasas del mercado informal'),
      }
    }

    const cupPerForeign = normalizeCupPerForeign(data?.cupPerForeign || data?.tasas || {})
    if (!Object.keys(cupPerForeign).length) {
      return {
        ok: false,
        error: 'La fuente no devolvió tasas utilizables. Introdúcelas a mano.',
      }
    }

    return {
      ok: true,
      cupPerForeign,
      source: data?.source || 'elTOQUE',
      sourceUrl: data?.sourceUrl || INFORMAL_FX_SOURCE_URL,
      attribution: data?.attribution || INFORMAL_FX_SOURCE_LABEL,
      fetchedAt: data?.fetchedAt || new Date().toISOString(),
      asOf: data?.asOf || null,
      cached: Boolean(data?.cached),
    }
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'No se pudieron obtener las tasas del mercado informal',
    }
  }
}

/**
 * Obtiene sugerencias ya convertidas al modelo units_per_base del negocio.
 */
export async function fetchInformalFxSuggestions({ baseCode, currencyCodes }) {
  const result = await fetchInformalFxRates()
  if (!result.ok) return result

  const { suggestions, missing } = suggestUnitsPerBaseForCurrencies({
    baseCode,
    currencyCodes,
    cupPerForeign: result.cupPerForeign,
  })

  if (!Object.keys(suggestions).length) {
    return {
      ok: false,
      error:
        missing.length > 0
          ? `No hay referencia informal para: ${missing.join(', ')}. Introdúcelas a mano.`
          : 'No se pudieron calcular sugerencias para tus monedas.',
    }
  }

  return {
    ok: true,
    ...result,
    suggestions,
    missing,
  }
}

function friendlyInvokeError(error) {
  const msg = String(error?.message || error || '').trim()
  const lower = msg.toLowerCase()
  if (lower.includes('failed to send') || lower.includes('network') || lower.includes('fetch')) {
    return 'Sin conexión con el servidor de tasas. Introdúcelas a mano.'
  }
  if (lower.includes('non-2xx') || lower.includes('404')) {
    return 'El servicio de tasas no está disponible aún. Introdúcelas a mano.'
  }
  return msg || 'No se pudieron obtener las tasas del mercado informal'
}
