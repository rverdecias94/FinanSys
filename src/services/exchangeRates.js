import { supabase } from '@/config/supabase'
import { withCrud } from '@/services/notifyWrap'
import { getEffectiveUserId } from '@/services/team'
import { logAction } from '@/services/auditLogger'

// Tipos de cambio (Fase 5). Modelo `units_per_base`: cuántas unidades de la
// moneda equivalen a 1 unidad de la moneda base (la principal del negocio).
// Ej. base USD, CUP=420 → "1 USD = 420 CUP". Conversión a base: monto / units_per_base.

// Última tasa por moneda: { CUP: { units_per_base, effective_date }, ... }
export async function getExchangeRates(userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)

  const { data, error } = await supabase
    .from('exchange_rates')
    .select('currency_code, units_per_base, effective_date')
    .eq('user_id', effectiveUserId)
    .order('effective_date', { ascending: false })

  if (error) throw error

  const map = {}
  for (const r of data || []) {
    // como viene ordenado por fecha desc, la primera de cada moneda es la vigente
    if (!map[r.currency_code]) {
      map[r.currency_code] = { units_per_base: Number(r.units_per_base), effective_date: r.effective_date }
    }
  }
  return map
}

export async function upsertExchangeRate({ currency_code, units_per_base, effective_date }, userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  // Fecha de vigencia: la elegida (permite registrar la tasa de un día pasado) o hoy.
  const day = effective_date || new Date().toISOString().slice(0, 10)

  return await withCrud({ action: 'update', table: 'exchange_rates' }, async () => {
    const { data, error } = await supabase
      .from('exchange_rates')
      .upsert({
        user_id: effectiveUserId,
        currency_code,
        units_per_base: Number(units_per_base),
        effective_date: day,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id, currency_code, effective_date' })
      .select()
      .single()

    if (error) throw error

    await logAction({
      action: 'Actualizar',
      resource: `Tipo de cambio: ${currency_code}`,
      details: { currency_code, units_per_base: Number(units_per_base) },
      area: 'Configuración'
    })

    return data
  })
}

// Convierte un monto de `currency` a la moneda base.
// base → tal cual; otra moneda → monto / units_per_base. Sin tasa → null.
export function convertToBase(amount, currency, baseCode, ratesMap) {
  const a = Number(amount) || 0
  if (!currency || currency === baseCode) return a
  const rate = ratesMap?.[currency]?.units_per_base
  if (!rate || rate <= 0) return null
  return a / rate
}

// Consolida { CUR: monto } a la moneda base.
// Devuelve { total, missing: [monedas sin tasa] }.
export function consolidatePerCurrency(perCurrency, baseCode, ratesMap) {
  let total = 0
  const missing = []
  for (const [cur, amt] of Object.entries(perCurrency || {})) {
    if (!Number(amt)) continue
    const v = convertToBase(amt, cur, baseCode, ratesMap)
    if (v === null) { missing.push(cur); continue }
    total += v
  }
  return { total, missing }
}

// Tasa vigente de una moneda para una fecha dada (la última con effective_date <= fecha).
// Se usa para "sellar" cada transacción con la tasa de su día. Devuelve número o null.
export async function getRateForDate(currencyCode, date, userId, businessId) {
  if (!currencyCode) return null
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const day = (date ? new Date(date) : new Date()).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('exchange_rates')
    .select('units_per_base')
    .eq('user_id', effectiveUserId)
    .eq('currency_code', currencyCode)
    .lte('effective_date', day)
    .order('effective_date', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) return null
  return Number(data[0].units_per_base)
}

// Historial completo de una moneda (asc), para la gráfica de evolución.
export async function getExchangeRateHistory(currencyCode, userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)

  const { data, error } = await supabase
    .from('exchange_rates')
    .select('units_per_base, effective_date')
    .eq('user_id', effectiveUserId)
    .eq('currency_code', currencyCode)
    .order('effective_date', { ascending: true })

  if (error) throw error
  return (data || []).map((r) => ({ date: r.effective_date, rate: Number(r.units_per_base) }))
}

// Historial de TODAS las monedas en una sola consulta, agrupado:
// { CUP: [{date, rate}, ...], ... } (asc por fecha). Para las gráficas del panel.
export async function getAllExchangeRateHistory(userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)

  const { data, error } = await supabase
    .from('exchange_rates')
    .select('currency_code, units_per_base, effective_date')
    .eq('user_id', effectiveUserId)
    .order('effective_date', { ascending: true })

  if (error) throw error
  const byCurrency = {}
  for (const r of data || []) {
    if (!byCurrency[r.currency_code]) byCurrency[r.currency_code] = []
    byCurrency[r.currency_code].push({ date: r.effective_date, rate: Number(r.units_per_base) })
  }
  return byCurrency
}
