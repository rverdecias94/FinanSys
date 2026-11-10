import { supabase } from '@/config/supabase'

// Etiqueta + clases (tokens) por estado de cuenta. Verde=activa, rojo=suspendida,
// neutro=eliminada (lógica). Se usa en los listados de equipo y negocios.
export const ACCOUNT_STATE = {
  active: { label: 'Activa', cls: 'bg-success/10 text-success' },
  suspended: { label: 'Suspendida', cls: 'bg-destructive/10 text-destructive' },
  deleted: { label: 'Eliminada', cls: 'bg-muted text-muted-foreground' }
}

// Subcuentas de equipo (admin global). businessId=null → todas.
export async function listTeamMembers({
  businessId = null,
  search = '',
  status = 'all',
  page = 1,
  pageSize = 10
}) {
  const { data, error } = await supabase.rpc('admin_list_team_members', {
    p_business_id: businessId || null,
    p_search: search?.trim() || null,
    p_status: status === 'all' ? null : status,
    p_page: page,
    p_page_size: pageSize
  })
  if (error) throw error
  return { rows: data?.rows || [], total: Number(data?.total || 0) }
}

// Suspender / reactivar (estado de cuenta). status: active | suspended | deleted.
export async function setAccountStatus({ targetUserId, status, reason = null }) {
  const { data, error } = await supabase.rpc('admin_set_account_status', {
    p_target_user_id: targetUserId,
    p_status: status,
    p_reason: reason || null
  })
  if (error) throw error
  return data
}

// Previsualización del impacto de un borrado permanente (conteos por tabla).
export async function previewUserDeletion(targetUserId) {
  const { data, error } = await supabase.rpc('admin_preview_user_deletion', { p_target_user_id: targetUserId })
  if (error) throw error
  return data
}

// BORRADO PERMANENTE real (auth.users + todos sus datos). Irreversible.
export async function deleteUser(targetUserId) {
  const { data, error } = await supabase.rpc('admin_delete_user', { p_target_user_id: targetUserId })
  if (error) throw error
  return data
}
