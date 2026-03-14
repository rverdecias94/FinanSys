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
  return businessId || userId;
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
    const effectiveUserId = getEffectiveUserId(userId, businessId);

    let query = supabase
      .from(resourceType + 's') // products, transactions, etc.
      .select('id')
      .eq('id', resourceId)
      .eq('user_id', effectiveUserId)
      .single();

    const { data, error } = await query;

    if (error || !data) {
      console.warn(`Access denied: User ${userId} trying to access ${resourceType} ${resourceId}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating resource access:', error);
    return false;
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

  // Transform data to include permissions array
  return data.map(role => ({
    ...role,
    permissions: role.role_permissions.map(rp => rp.permissions?.code).filter(Boolean)
  }))
}

/**
 * Create a new custom role with assigned permissions
 */
export async function createRole({ name, description, permissionIds, owner_id }) {
  if (!owner_id) throw new Error('Owner ID is required for custom roles')

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
export async function deleteRole(roleId) {
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
      resource: `Rol ID: ${roleId}`,
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
    console.log('Iniciando aceptación de invitaciones para:', email)

    // Get current user ID with retry logic
    let user = null
    let retries = 3

    while (retries > 0 && !user) {
      const { data } = await supabase.auth.getUser()
      user = data?.user

      console.log(`Intento ${4 - retries} de autenticación:`, user?.id)

      if (!user && retries > 1) {
        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      retries--
    }

    if (!user) {
      console.error('No se pudo obtener el usuario autenticado')
      return null
    }

    console.log('Usuario autenticado:', user.id)

    // Use the new RPC function that takes user_id as parameter
    const { data: accepted, error } = await supabase.rpc('accept_invitation_by_email_with_user', {
      email_input: email,
      user_uuid: user.id
    })

    console.log('Resultado de accept_invitation_by_email:', { accepted, error })

    if (error) {
      console.error('Error accepting invitation:', error)
      return null
    }

    if (accepted) {
      console.log('Invitación aceptada exitosamente, obteniendo contexto de negocio...')

      // Get the business context after successful acceptance
      const context = await getBusinessContext(user.id)

      console.log('Contexto de negocio obtenido:', context)

      if (context) {
        await logAction({
          action: 'Aceptar Invitación Automática',
          resource: `Email: ${email}`,
          details: {
            business_id: context.businessId,
            role_id: context.roleId,
            permissions: context.permissions
          },
          area: 'Sistema'
        })
      }

      return context
    }

    console.log('No se encontraron invitaciones pendientes')
    return null
  } catch (error) {
    console.error('Exception accepting invitation:', error)
    return null
  }
}

/**
 * Get the business context for a user
 * Returns { businessId, isOwner, roleId, permissions }
 */
export async function getBusinessContext(userId) {
  if (!userId) {
    console.log('getBusinessContext: userId es null')
    return null
  }

  try {
    console.log('Obteniendo contexto de negocio para userId:', userId)

    const { data: context, error } = await supabase.rpc('get_user_business_context', {
      user_uuid: userId
    })

    console.log('Resultado de get_user_business_context:', { context, error })

    if (error) {
      console.error('Error getting business context:', error)
      return null
    }

    return context
  } catch (error) {
    console.error('Exception getting business context:', error)
    return null
  }
}

/**
 * Invite a new member to the team
 */
export async function inviteMember({ email, role_id, owner_id }) {
  console.log('Inviting member:', { email, role_id, owner_id })

  // 1. Validate Email Availability
  try {
    const isAvailable = await checkEmailAvailability(email)
    console.log('Email availability check:', isAvailable)

    if (!isAvailable) {
      throw new Error('El correo electrónico no está disponible para ser invitado. Puede que ya sea dueño de un negocio o miembro de otro equipo.')
    }
  } catch (err) {
    console.error('Error checking email availability:', err)
    throw err
  }

  // 2. Create Invitation
  return await withCrud({ action: 'invite', table: 'team_members' }, async () => {
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        owner_id,
        member_email: email,
        role_id, // New RBAC column
        status: 'pending'
      })
      .select(`
        *,
        roles (name)
      `)
      .single()

    if (error) {
      console.error('Error creating invitation:', error)
      throw error
    }

    await logAction({
      action: 'Invitar Miembro',
      resource: `Email: ${email}`,
      details: { role_id },
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
export async function updateMemberRole(memberId, newRoleId) {
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
      resource: `Miembro ID: ${memberId}`,
      details: { new_role_id: newRoleId },
      area: 'Equipo'
    })

    return data
  })
}

/**
 * Remove a member from the team
 */
export async function removeMember(memberId) {
  return await withCrud({ action: 'delete', table: 'team_members' }, async () => {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)

    if (error) throw error

    await logAction({
      action: 'Eliminar Miembro',
      resource: `Miembro ID: ${memberId}`,
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
  } catch (error) {
    console.error('Error getting user permissions:', error)
    return []
  }
}