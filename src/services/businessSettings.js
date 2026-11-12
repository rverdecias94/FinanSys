import { supabase } from '@/config/supabase'
import { logAction } from '@/services/auditLogger'
import { getEffectiveUserId } from '@/services/team'

const LOGO_BUCKET = 'company-logos'

function stripLogoDataUrl(company) {
  if (!company || typeof company !== 'object') return {}
  const rest = { ...company }
  delete rest.logoDataUrl
  return rest
}

export async function getBusinessSettings(userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)

  const { data, error } = await supabase
    .from('business_settings')
    .select('company, region, valuation_method, fx, period, updated_at')
    .eq('user_id', effectiveUserId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...data,
    fx: data.fx && typeof data.fx === 'object' ? data.fx : {},
    period: data.period && typeof data.period === 'object' ? data.period : {},
    company: stripLogoDataUrl(data.company)
  }
}

export async function uploadCompanyLogo(userId, businessId, file) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const fileName = `${effectiveUserId}/logo.${ext}`

  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(fileName, file, { upsert: true, contentType: file.type })

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from(LOGO_BUCKET)
    .getPublicUrl(fileName)

  return `${publicUrl}?v=${Date.now()}`
}

export async function upsertBusinessSettings(userId, businessId, { company, region, valuationMethod, fx, period }) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const cleanCompany = stripLogoDataUrl(company)

  const payload = {
    user_id: effectiveUserId,
    company: cleanCompany,
    region: region || {},
    valuation_method: valuationMethod || 'fifo',
    updated_at: new Date()
  }
  if (fx !== undefined) {
    payload.fx = fx && typeof fx === 'object' ? fx : {}
  }
  if (period !== undefined) {
    payload.period = period && typeof period === 'object' ? period : {}
  }

  const { data, error } = await supabase
    .from('business_settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select('company, region, valuation_method, fx, period, updated_at')
    .single()

  if (error) throw error

  logAction({
    action: 'Actualizar',
    resource: 'Configuración General',
    details: {
      company: { ...cleanCompany, logoUrl: cleanCompany.logoUrl ? '(url)' : undefined },
      region: payload.region,
      valuation_method: payload.valuation_method,
      fx: payload.fx,
      period: payload.period,
    },
    area: 'Configuración'
  })

  return {
    ...data,
    fx: data.fx && typeof data.fx === 'object' ? data.fx : {},
    period: data.period && typeof data.period === 'object' ? data.period : {},
    company: stripLogoDataUrl(data.company)
  }
}

/** Actualiza solo el JSON fx (merge superficial) sin tocar company/region. */
export async function patchBusinessFxSettings(userId, businessId, fxPatch) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const current = await getBusinessSettings(userId, businessId)
  const nextFx = { ...(current?.fx || {}), ...(fxPatch || {}) }

  if (!current) {
    return upsertBusinessSettings(userId, businessId, {
      company: {},
      region: {},
      valuationMethod: 'fifo',
      fx: nextFx,
    })
  }

  const { data, error } = await supabase
    .from('business_settings')
    .update({ fx: nextFx, updated_at: new Date() })
    .eq('user_id', effectiveUserId)
    .select('company, region, valuation_method, fx, period, updated_at')
    .single()

  if (error) throw error

  logAction({
    action: 'Actualizar',
    resource: 'Preferencias FX',
    details: { fx: nextFx },
    area: 'Configuración',
  })

  return {
    ...data,
    fx: data.fx && typeof data.fx === 'object' ? data.fx : {},
    period: data.period && typeof data.period === 'object' ? data.period : {},
    company: stripLogoDataUrl(data.company),
  }
}

/** Actualiza solo el JSON period (reglas de cierre automático). */
export async function patchBusinessPeriodSettings(userId, businessId, periodPatch) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const current = await getBusinessSettings(userId, businessId)
  const nextPeriod = { ...(current?.period || {}), ...(periodPatch || {}) }

  if (!current) {
    return upsertBusinessSettings(userId, businessId, {
      company: {},
      region: {},
      valuationMethod: 'fifo',
      period: nextPeriod,
    })
  }

  const { data, error } = await supabase
    .from('business_settings')
    .update({ period: nextPeriod, updated_at: new Date() })
    .eq('user_id', effectiveUserId)
    .select('company, region, valuation_method, fx, period, updated_at')
    .single()

  if (error) throw error

  logAction({
    action: 'Actualizar',
    resource: 'Cierre de período',
    details: { period: nextPeriod },
    area: 'Configuración',
  })

  return {
    ...data,
    fx: data.fx && typeof data.fx === 'object' ? data.fx : {},
    period: data.period && typeof data.period === 'object' ? data.period : {},
    company: stripLogoDataUrl(data.company),
  }
}
