import { supabase } from '@/config/supabase'

function normalizeSearchTerm(term) {
  const t = (term || '').trim()
  return t.length ? t : null
}

function applyAuditLogFilters(query, { searchTerm, area, action, startDate, endDate } = {}) {
  const qSearch = normalizeSearchTerm(searchTerm)

  if (qSearch) {
    const escaped = qSearch.replaceAll('%', '').replaceAll('_', '').replaceAll(',', ' ')
    query = query.or(
      `action.ilike.%${escaped}%,resource.ilike.%${escaped}%,user_email.ilike.%${escaped}%`
    )
  }

  if (area && area !== 'all') {
    query = query.eq('area', area)
  }

  if (action && action !== 'all') {
    query = query.ilike('action', `%${action}%`)
  }

  if (startDate) {
    const iso = startDate instanceof Date ? startDate.toISOString() : startDate
    query = query.gte('created_at', iso)
  }

  if (endDate) {
    const iso = endDate instanceof Date ? endDate.toISOString() : endDate
    query = query.lte('created_at', iso)
  }

  return query
}

export async function listAuditLogs({
  businessId,
  page = 1,
  pageSize = 10,
  searchTerm,
  area,
  action,
  startDate,
  endDate
}) {
  let query = supabase
    .from('audit_logs')
    .select('id, action, resource, details, ip_address, created_at, user_email, area', { count: 'exact' })
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  query = applyAuditLogFilters(query, { searchTerm, area, action, startDate, endDate })

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, count, error } = await query.range(from, to)
  if (error) throw error

  return { data: data || [], count: Number(count || 0) }
}

export async function listAllAuditLogs({
  businessId,
  searchTerm,
  area,
  action,
  startDate,
  endDate,
  batchSize = 1000
}) {
  const all = []
  let page = 1
  let totalCount = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('audit_logs')
      .select('id, action, resource, details, ip_address, created_at, user_email, area', { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    query = applyAuditLogFilters(query, { searchTerm, area, action, startDate, endDate })

    const from = (page - 1) * batchSize
    const to = from + batchSize - 1
    const { data, count, error } = await query.range(from, to)
    if (error) throw error

    if (page === 1) totalCount = Number(count || 0)

    const rows = data || []
    all.push(...rows)

    if (rows.length < batchSize) {
      hasMore = false
      continue
    }
    if (totalCount && all.length >= totalCount) {
      hasMore = false
      continue
    }
    page += 1
  }

  return { data: all, count: totalCount || all.length }
}
