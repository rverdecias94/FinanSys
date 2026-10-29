import { supabase } from '@/config/supabase'

const LS_PREFIX = 'gestia:ai-chat:'

function storageKey(businessId) {
  return `${LS_PREFIX}${businessId || 'unknown'}`
}

/** Caché local: conversación activa + lista ligera (sobrevive cambio de tab/ruta). */
export function readLocalChatState(businessId) {
  try {
    const raw = localStorage.getItem(storageKey(businessId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function writeLocalChatState(businessId, state) {
  try {
    localStorage.setItem(storageKey(businessId), JSON.stringify({
      ...state,
      savedAt: Date.now(),
    }))
  } catch {
    // quota / private mode
  }
}

export function clearLocalChatState(businessId) {
  try {
    localStorage.removeItem(storageKey(businessId))
  } catch {
    // ignore
  }
}

export async function listConversations(businessId) {
  if (!businessId) return []
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, title, updated_at, created_at')
    .eq('business_id', businessId)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data || []
}

export async function getConversation(id, businessId) {
  if (!id || !businessId) return null
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, title, messages, updated_at, created_at, user_id')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createConversation({ businessId, userId, title, messages }) {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      business_id: businessId,
      user_id: userId,
      title: (title || 'Nueva conversación').slice(0, 200),
      messages: Array.isArray(messages) ? messages : [],
    })
    .select('id, title, messages, updated_at, created_at')
    .single()
  if (error) throw error
  return data
}

export async function updateConversation(id, businessId, { title, messages }) {
  const patch = {}
  if (title != null) patch.title = String(title).slice(0, 200)
  if (messages != null) patch.messages = messages
  const { data, error } = await supabase
    .from('ai_conversations')
    .update(patch)
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id, title, messages, updated_at, created_at')
    .single()
  if (error) throw error
  return data
}

export async function deleteConversation(id, businessId) {
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)
  if (error) throw error
}

export function titleFromMessages(messages) {
  const firstUser = (messages || []).find((m) => m.role === 'user' && m.text)
  if (!firstUser) return 'Nueva conversación'
  const t = String(firstUser.text).replace(/\s+/g, ' ').trim()
  return (t.length > 60 ? `${t.slice(0, 57)}…` : t) || 'Nueva conversación'
}

export function welcomeMessage() {
  return {
    id: 'welcome',
    role: 'assistant',
    text: 'Pregúntame por tus saldos, gastos del mes, stock bajo, cuentas por cobrar o la auditoría. Respondo con los números de tu negocio.',
  }
}
