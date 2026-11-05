import { supabase } from '@/config/supabase'
import { getEffectiveUserId } from '@/services/team'

const TYPE_CODE = {
  executive: 'EJE',
  finance_mgmt: 'IFG',
  warehouse: 'ALM',
  kardex: 'KDX',
  inventory_areas: 'INV',
  audit: 'AUD',
  global: 'GLO',
}

export function reportTypeCode(type) {
  return TYPE_CODE[type] || 'REP'
}

export function companySlugFromProfile(company) {
  const raw = company?.tradeName || company?.legalName || company?.nit || 'EMP'
  const slug = String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
  return (slug || 'EMP').slice(0, 8)
}

/** SHA-256 hex del JSON canónico del documento (orden de claves estable vía JSON.stringify del objeto ya construido). */
export async function hashReportDocument(document) {
  const payload = JSON.stringify(document ?? {})
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(payload)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Fallback no criptográfico solo para entornos de test sin subtle (no usar en producción).
  let h = 0
  for (let i = 0; i < payload.length; i++) h = (Math.imul(31, h) + payload.charCodeAt(i)) | 0
  return `fallback_${(h >>> 0).toString(16)}`
}

export async function allocateReportPublicId(reportType, company, year = new Date().getFullYear()) {
  const { data, error } = await supabase.rpc('allocate_report_public_id', {
    p_type: reportTypeCode(reportType),
    p_slug: companySlugFromProfile(company),
    p_year: year,
  })
  if (error) throw error
  return data
}

/**
 * Emite (o guarda borrador) un ReportDocument como instancia inmutable al pasar a issued.
 * @param {'draft'|'issued'} status
 */
export async function saveReportInstance({
  document,
  status = 'issued',
  company = null,
  templateCode = null,
  userId,
  businessId,
  replacesId = null,
} = {}) {
  if (!document?.type || !document?.title) throw new Error('document.type y document.title son obligatorios')
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const contentHash = await hashReportDocument(document)
  const year = document.period?.to
    ? new Date(document.period.to).getFullYear()
    : new Date().getFullYear()

  let publicId = document.id
  if (!publicId) {
    publicId = await allocateReportPublicId(document.type, company, year)
  }

  const stamped = {
    ...document,
    id: publicId,
    schemaVersion: document.schemaVersion || 1,
  }
  const finalHash = await hashReportDocument(stamped)

  const row = {
    user_id: effectiveUserId,
    public_id: publicId,
    report_type: document.type,
    title: document.title,
    status,
    version: document.version || '1.0',
    replaces_id: replacesId,
    period_from: document.period?.from || null,
    period_to: document.period?.to || null,
    cutoff_at: document.period?.cutoffAt || null,
    timezone: document.period?.timezone || null,
    template_code: templateCode || document.type,
    criteria: document.criteria || {},
    filters: document.filters || {},
    document: stamped,
    content_hash: finalHash,
    issued_at: status === 'issued' ? new Date().toISOString() : null,
    issued_by: status === 'issued' ? userId : null,
    created_by: userId || null,
  }

  const { data, error } = await supabase
    .from('report_instances')
    .insert(row)
    .select('id, public_id, status, content_hash, issued_at, document')
    .single()
  if (error) throw error
  return data
}

export async function listReportInstances({
  userId,
  businessId,
  reportType = null,
  status = null,
  page = 1,
  pageSize = 20,
} = {}) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  let q = supabase
    .from('report_instances')
    .select('id, public_id, report_type, title, status, version, cutoff_at, content_hash, issued_at, created_at', { count: 'exact' })
    .eq('user_id', effectiveUserId)
    .order('created_at', { ascending: false })
  if (reportType) q = q.eq('report_type', reportType)
  if (status) q = q.eq('status', status)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, count, error } = await q.range(from, to)
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

export async function getReportInstanceByPublicId(publicId, { userId, businessId } = {}) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const { data, error } = await supabase
    .from('report_instances')
    .select('*')
    .eq('user_id', effectiveUserId)
    .eq('public_id', publicId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function registerReportExport({
  instanceId,
  format,
  contentHash,
  userId,
  businessId,
} = {}) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const stamp = new Date()
  const exportCode = `EXP-${stamp.toISOString().slice(0, 10).replace(/-/g, '')}-${String(stamp.getTime()).slice(-5)}`
  const { data, error } = await supabase
    .from('report_exports')
    .insert({
      user_id: effectiveUserId,
      instance_id: instanceId,
      format,
      export_code: exportCode,
      content_hash: contentHash,
      generated_by: userId || null,
    })
    .select('id, export_code, format, content_hash, generated_at')
    .single()
  if (error) throw error
  return data
}

export async function voidReportInstance(instanceId, reason, { userId, businessId } = {}) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const { data, error } = await supabase
    .from('report_instances')
    .update({ status: 'void', void_reason: reason || 'Anulado' })
    .eq('user_id', effectiveUserId)
    .eq('id', instanceId)
    .eq('status', 'issued')
    .select('id, public_id, status')
    .maybeSingle()
  if (error) throw error
  return data
}
