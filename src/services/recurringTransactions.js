import { supabase } from '@/config/supabase'
import { withCrud } from '@/services/notifyWrap'
import { getEffectiveUserId } from '@/services/team'

export const FREQUENCY_LABELS = {
  weekly: 'Cada semana',
  biweekly: 'Cada 2 semanas',
  monthly: 'Cada mes',
  yearly: 'Cada año',
}

export async function listRecurringTransactions({ userId, businessId } = {}) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('*, contact:contacts(id, name)')
    .eq('user_id', effectiveUserId)
    .order('is_active', { ascending: false })
    .order('next_run', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createRecurringTransaction(payload, userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const dbPayload = {
    user_id: effectiveUserId,
    type: payload.type,
    amount: Number(payload.amount),
    currency: payload.currency,
    category: payload.category,
    description: payload.description,
    payment_method: payload.payment_method || null,
    contact_id: payload.contact_id || null,
    status: payload.status || 'paid',
    frequency: payload.frequency,
    next_run: payload.next_run,
    end_date: payload.end_date || null,
    notes: payload.notes || null,
    is_active: payload.is_active !== false,
  }

  return await withCrud({ action: 'create', table: 'recurring_transactions' }, async () => {
    const { data, error } = await supabase
      .from('recurring_transactions')
      .insert(dbPayload)
      .select()
      .single()
    if (error) throw error
    return data
  })
}

export async function updateRecurringTransaction(id, payload, userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const dbPayload = {
    type: payload.type,
    amount: Number(payload.amount),
    currency: payload.currency,
    category: payload.category,
    description: payload.description,
    payment_method: payload.payment_method || null,
    contact_id: payload.contact_id || null,
    status: payload.status || 'paid',
    frequency: payload.frequency,
    next_run: payload.next_run,
    end_date: payload.end_date || null,
    notes: payload.notes || null,
    is_active: payload.is_active !== false,
    updated_at: new Date().toISOString(),
  }

  return await withCrud({ action: 'update', table: 'recurring_transactions' }, async () => {
    const { data, error } = await supabase
      .from('recurring_transactions')
      .update(dbPayload)
      .eq('id', id)
      .eq('user_id', effectiveUserId)
      .select()
      .single()
    if (error) throw error
    return data
  })
}

export async function setRecurringActive(id, isActive, userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  const { data, error } = await supabase
    .from('recurring_transactions')
    .update({ is_active: Boolean(isActive), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', effectiveUserId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRecurringTransaction(id, userId, businessId) {
  const effectiveUserId = getEffectiveUserId(userId, businessId)
  return await withCrud({ action: 'delete', table: 'recurring_transactions' }, async () => {
    const { error } = await supabase
      .from('recurring_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', effectiveUserId)
    if (error) throw error
    return true
  })
}

/** Materializa vencidos del negocio. Seguro llamar al abrir Finanzas. */
export async function generateDueRecurring() {
  const { data, error } = await supabase.rpc('generate_due_recurring_transactions')
  if (error) throw error
  return data || { created: 0, skipped: 0, limit_hit: false }
}

export async function runRecurringNow(id) {
  const { data, error } = await supabase.rpc('run_recurring_now', { p_id: id })
  if (error) throw error
  return data
}
