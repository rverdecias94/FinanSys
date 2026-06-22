import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAgingReport } from '../services/finanzas'
import { supabase } from '@/config/supabase'

// Q10 — el servicio delega íntegramente en la RPC get_aging_report (la integridad y
// los permisos viven server-side). Aquí se verifica el contrato cliente↔RPC.

vi.mock('@/services/auditLogger', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

const mockState = vi.hoisted(() => ({ rpcResult: { data: [], error: null } }))

vi.mock('@/config/supabase', () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve(mockState.rpcResult)),
  },
}))

describe('getAgingReport (Q10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.rpcResult = { data: [], error: null }
  })

  it('llama a la RPC get_aging_report con la dirección dada', async () => {
    await getAgingReport('payable')
    expect(supabase.rpc).toHaveBeenCalledWith('get_aging_report', { p_direction: 'payable' })
  })

  it('por defecto consulta receivable', async () => {
    await getAgingReport()
    expect(supabase.rpc).toHaveBeenCalledWith('get_aging_report', { p_direction: 'receivable' })
  })

  it('devuelve las filas por moneda de la RPC', async () => {
    mockState.rpcResult = {
      data: [{ currency: 'USD', not_due: 300, d_1_30: 200, d_31_60: 0, d_61_90: 0, d_over_90: 0, total: 500, cnt: 2 }],
      error: null,
    }
    const rows = await getAgingReport('receivable')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ currency: 'USD', total: 500 })
  })

  it('propaga el error de la RPC (p. ej. permiso denegado)', async () => {
    mockState.rpcResult = { data: null, error: { message: 'denegado' } }
    await expect(getAgingReport('receivable')).rejects.toMatchObject({ message: 'denegado' })
  })

  it('devuelve [] cuando la RPC no trae filas', async () => {
    mockState.rpcResult = { data: null, error: null }
    expect(await getAgingReport('receivable')).toEqual([])
  })
})
