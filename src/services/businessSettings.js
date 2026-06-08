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
    .select('company, region, valuation_method, updated_at')
    .eq('user_id', effectiveUserId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...data,
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

export async function upsertBusinessSettings(userId, businessId, { company, region, valuationMethod }) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const cleanCompany = stripLogoDataUrl(company)

  const payload = {
    user_id: effectiveUserId,
    company: cleanCompany,
    region: region || {},
    valuation_method: valuationMethod || 'fifo',
    updated_at: new Date()
  }

  const { data, error } = await supabase
    .from('business_settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select('company, region, valuation_method, updated_at')
    .single()

  if (error) throw error

  logAction({
    action: 'Actualizar',
    resource: 'Configuración General',
    details: {
      company: { ...cleanCompany, logoUrl: cleanCompany.logoUrl ? '(url)' : undefined },
      region: payload.region,
      valuation_method: payload.valuation_method
    },
    area: 'Configuración'
  })

  return {
    ...data,
    company: stripLogoDataUrl(data.company)
  }
}
