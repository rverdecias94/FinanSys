import { describe, it, expect, vi, beforeEach } from 'vitest'

// S1 — Soft-delete de contactos (Q3): borrar un contacto NO debe hacer DELETE
// físico (huérfana el historial), sino baja lógica is_active=false; y listContacts
// solo debe devolver activos.

vi.mock('@/services/auditLogger', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/services/team', () => ({ getEffectiveUserId: (u, b) => b || u }))
vi.mock('@/services/notifications', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
  getSupabaseErrorMessage: (e) => (e && e.message) || 'error'
}))

const mockState = vi.hoisted(() => ({ eqCalls: [], updatePayload: null, usedDelete: false }))

vi.mock('@/config/supabase', () => {
  const makeQuery = () => {
    const q = {
      select: vi.fn(() => q),
      eq: vi.fn((col, val) => { mockState.eqCalls.push([col, val]); return q }),
      order: vi.fn(() => q),
      ilike: vi.fn(() => q),
      or: vi.fn(() => q),
      range: vi.fn(() => q),
      update: vi.fn((payload) => { mockState.updatePayload = payload; return q }),
      delete: vi.fn(() => { mockState.usedDelete = true; return q }),
      single: vi.fn(() => Promise.resolve({
        data: { id: 7, name: 'Cliente X', kind: 'cliente', is_active: false }, error: null
      })),
      // listContacts hace `await q` (thenable) y espera { data, count, error }
      then: (resolve) => Promise.resolve(resolve({ data: [], count: 0, error: null }))
    }
    return q
  }
  return { supabase: { from: vi.fn(() => makeQuery()) } }
})

import { listContacts, deleteContact } from '@/services/contacts'

describe('contacts service — baja lógica (S1)', () => {
  beforeEach(() => {
    mockState.eqCalls = []
    mockState.updatePayload = null
    mockState.usedDelete = false
    vi.clearAllMocks()
  })

  it('deleteContact da de baja (is_active=false) y NO borra físicamente', async () => {
    const result = await deleteContact(7, 'u1', 'b1')
    expect(mockState.usedDelete).toBe(false)                       // jamás .delete()
    expect(mockState.updatePayload).toMatchObject({ is_active: false })
    expect(mockState.eqCalls).toContainEqual(['id', 7])            // sobre el contacto correcto
    expect(mockState.eqCalls).toContainEqual(['user_id', 'b1'])    // y del negocio efectivo
    expect(result).toMatchObject({ id: 7, is_active: false })
  })

  it('listContacts solo devuelve activos (filtra is_active=true)', async () => {
    await listContacts({ userId: 'u1', businessId: 'b1' })
    expect(mockState.eqCalls).toContainEqual(['is_active', true])
  })
})
