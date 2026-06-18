import { supabase } from '@/config/supabase'
import { withCrud } from '@/services/notifyWrap'
import { logAction } from '@/services/auditLogger'

/**
 * Función auxiliar para obtener el ID de usuario correcto para operaciones
 * Si el usuario es miembro de un equipo, usa el owner_id
 * Si el usuario es owner, usa su propio ID
 * 
 * @param {string} userId - ID del usuario actual (session.user.id)
 * @param {string} businessId - ID del negocio (del BusinessContext)
 * @returns {string} - ID efectivo para operaciones
 */
export function getEffectiveUserId(userId, businessId) {
  // Si businessId es diferente de userId, significa que es miembro de equipo
  // En ese caso, usamos businessId (que es el owner_id)
  // Si son iguales, es owner y usamos su propio ID
  return businessId || userId
}

/**
 * Función auxiliar para validar acceso a recursos
 * Verifica que el usuario tenga permisos para acceder a un recurso específico
 * 
 * @param {string} resourceType - Tipo de recurso ('product', 'transaction', etc.)
 * @param {string} resourceId - ID del recurso
 * @param {string} userId - ID del usuario actual
 * @param {string} businessId - ID del negocio
 * @returns {Promise<boolean>} - true si tiene acceso, false si no
 */
export async function validateResourceAccess(resourceType, resourceId, userId, businessId) {
  try {
    const effectiveUserId = getEffectiveUserId(userId, businessId)

    let query = supabase
      .from(resourceType + 's') // products, transactions, etc.
      .select('id')
      .eq('id', resourceId)
      .eq('user_id', effectiveUserId)
      .single()

    const { data, error } = await query

    if (error || !data) {
      return false
    }

    return true
  } catch (error) {
    return false
  }
}

/**
 * Fetch all available permissions from the system
 */
export async function getPermissions() {
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .order('module', { ascending: true })
    .order('code', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Fetch roles available for the current user (System roles + Own custom roles)
 */
export async function getRoles() {
  const { data, error } = await supabase
    .from('roles')
    .select(`
      *,
      role_permissions (
        permission_id,
        permissions (code, module, description)
      )
    `)
    .order('is_system', { ascending: false }) // System roles first
    .order('name', { ascending: true })

  if (error) throw error

  const filtered = (data || []).filter((role) => String(role.name || '').toLowerCase() !== 'visualizador')

  return filtered.map(role => ({
    ...role,
    permissions: role.role_permissions.map(rp => rp.permissions?.code).filter(Boolean)
  }))
}

/**
 * Create a new custom role with assigned permissions
 */
export async function createRole({ name, description, permissionIds, owner_id }) {
  if (!owner_id) throw new Error('Owner ID is required for custom roles')
  if (String(name || '').trim().toLowerCase() === 'visualizador') {
    throw new Error('El rol "Visualizador" no está permitido.')
  }

  return await withCrud({ action: 'create', table: 'roles' }, async () => {
    // 1. Create Role
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .insert({
        name,
        description,
        owner_id,
        is_system: false
      })
      .select()
      .single()

    if (roleError) throw roleError

    // 2. Assign Permissions
    if (permissionIds && permissionIds.length > 0) {
      const permissionRows = permissionIds.map(pid => ({
        role_id: role.id,
        permission_id: pid
      }))

      const { error: permError } = await supabase
        .from('role_permissions')
        .insert(permissionRows)

      if (permError) {
        // Rollback role creation if possible (manual delete as Supabase JS doesn't support transactions easily)
        await supabase.from('roles').delete().eq('id', role.id)
        throw permError
      }
    }

    await logAction({
      action: 'Crear Rol',
      resource: `Rol: ${role.name}`,
      details: { permission_count: permissionIds?.length },
      area: 'Configuración'
    })

    return role
  })
}

/**
 * Update an existing custom role
 */
export async function updateRole(roleId, { name, description, permissionIds }) {
  if (String(name || '').trim().toLowerCase() === 'visualizador') {
    throw new Error('El rol "Visualizador" no está permitido.')
  }
  return await withCrud({ action: 'update', table: 'roles' }, async () => {
    // 1. Update Role Details
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .update({ name, description, updated_at: new Date() })
      .eq('id', roleId)
      .eq('is_system', false) // Security check
      .select()
      .single()

    if (roleError) throw roleError

    // 2. Update Permissions (Delete all and re-insert)
    // Delete existing
    const { error: delError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)

    if (delError) throw delError

    // Insert new
    if (permissionIds && permissionIds.length > 0) {
      const permissionRows = permissionIds.map(pid => ({
        role_id: roleId,
        permission_id: pid
      }))

      const { error: insError } = await supabase
        .from('role_permissions')
        .insert(permissionRows)

      if (insError) throw insError
    }

    await logAction({
      action: 'Actualizar Rol',
      resource: `Rol: ${role.name}`,
      details: { permission_count: permissionIds?.length },
      area: 'Configuración'
    })

    return role
  })
}

/**
 * Delete a custom role
 */
export async function deleteRole(roleId, roleName) {
  return await withCrud({ action: 'delete', table: 'roles' }, async () => {
    // Check if role is assigned to any member first? 
    // Foreign key constraints might handle this or fail safely.
    // Ideally we should check team_members.role_id

    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId)
      .eq('is_system', false) // Security check

    if (error) throw error

    await logAction({
      action: 'Eliminar Rol',
      resource: `Rol: ${roleName || roleId}`,
      details: null,
      area: 'Configuración'
    })

    return true
  })
}

/**
 * Check if an email is available for invitation
 */
export async function checkEmailAvailability(email) {
  const { data, error } = await supabase.rpc('check_email_availability', { email_input: email })
  if (error) throw error
  return data // true/false
}

/**
 * Accept pending invitations for an email
 * This is called after user registration to link them to teams.
 * Returns the business context if successful, null otherwise.
 */
export async function acceptPendingInvitations(email) {
  try {
    // Get current user ID with retry logic
    let user = null
    let retries = 3

    while (retries > 0 && !user) {
      const { data } = await supabase.auth.getUser()
      user = data?.user

      if (!user && retries > 1) {
        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      retries--
    }

    if (!user) {
      return null
    }

    const { data: accepted, error } = await supabase.rpc('accept_invitation_for_current_user', {
      email_input: email
    })

    if (error) {
      return null
    }

    if (accepted) {
      // Get the business context after successful acceptance
      const context = await getBusinessContext(user.id)

      if (context) {
        await logAction({
          action: 'Aceptar Invitación Automática',
          resource: `Miembro: ${email}`,
          // Sin UUIDs: nombre del rol en lugar de business_id/role_id.
          details: {
            rol: context.roleName || null,
            permissions: context.permissions
          },
          area: 'Sistema'
        })
      }

      return context
    }

    return null
  } catch {
    return null
  }
}

/**
 * Get the business context for a user
 * Returns { businessId, isOwner, roleId, permissions }
 */
export async function getBusinessContext(userId) {
  if (!userId) {
    return null
  }

  try {
    const { data: context, error } = await supabase.rpc('get_user_business_context', {
      user_uuid: userId
    })

    if (error) {
      return null
    }

    if (context?.roleId && !context.isOwner) {
      const { data: role } = await supabase
        .from('roles')
        .select('name')
        .eq('id', context.roleId)
        .maybeSingle()
      return { ...context, roleName: role?.name || null }
    }

    return context
  } catch {
    return null
  }
}

/**
 * Invite a new member to the team
 */
export async function inviteMember({ email, role_id, owner_id, role_name }) {
  // 1. Validate Email Availability
  const isAvailable = await checkEmailAvailability(email)
  if (!isAvailable) {
    throw new Error('El correo electrónico no está disponible para ser invitado. Puede que ya sea dueño de un negocio o miembro de otro equipo.')
  }

  // 2. Create/Reactivate Invitation
  // P1.15: `upsert` sobre la UNIQUE(owner_id, member_email). Si existe una fila
  // `revoked` (p.ej. tras un downgrade), la reactiva como `pending` en vez de
  // chocar con la restricción única (un INSERT ciego fallaba al reinvitar).
  return await withCrud({ action: 'invite', table: 'team_members' }, async () => {
    const { data, error } = await supabase
      .from('team_members')
      .upsert({
        owner_id,
        member_email: email,
        role_id, // New RBAC column
        member_id: null,
        status: 'pending',
        updated_at: new Date()
      }, { onConflict: 'owner_id,member_email' })
      .select(`
        *,
        roles (name)
      `)
      .single()

    if (error) {
      throw error
    }

    await logAction({
      action: 'Invitar Miembro',
      resource: `Miembro: ${email}`,
      // Guardar el nombre del rol, no el UUID, para que el log sea legible.
      details: { rol: role_name || data?.roles?.name || null },
      area: 'Equipo'
    })

    return data
  })
}

/**
 * Get all team members for a specific owner
 */
export async function getTeamMembers(owner_id) {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      *,
      roles (id, name, is_system, description)
    `)
    .eq('owner_id', owner_id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Update a member's role
 */
export async function updateMemberRole(memberId, newRoleId, meta = {}) {
  const { memberEmail, newRoleName } = meta
  return await withCrud({ action: 'update', table: 'team_members' }, async () => {
    const { data, error } = await supabase
      .from('team_members')
      .update({ role_id: newRoleId })
      .eq('id', memberId)
      .select()
      .single()

    if (error) throw error

    await logAction({
      action: 'Actualizar Rol Miembro',
      // Log legible: correo del miembro y nombre del rol, no UUIDs.
      resource: `Miembro: ${memberEmail || data?.member_email || memberId}`,
      details: { nuevo_rol: newRoleName || null },
      area: 'Equipo'
    })

    return data
  })
}

/**
 * Remove a member from the team
 */
export async function removeMember(memberId, memberEmail) {
  return await withCrud({ action: 'delete', table: 'team_members' }, async () => {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)

    if (error) throw error

    await logAction({
      action: 'Eliminar Miembro',
      // Mostrar el correo del miembro en el log, nunca su UUID.
      resource: `Miembro: ${memberEmail || memberId}`,
      details: null,
      area: 'Equipo'
    })

    return true
  })
}

/**
 * Get current user's consolidated permissions
 * Returns array of permission codes (e.g. ['finanzas.view', 'dashboard.view'])
 * CRITICAL FIX: Only return permissions for team members, not default owner access
 */
export async function getUserPermissions(userId) {
  if (!userId) return []

  try {
    const context = await getBusinessContext(userId)
    return context?.permissions || []
  } catch {
    return []
  }
}
