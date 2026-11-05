import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn()
  }
}))

vi.mock('@/services/auditLogger', () => ({
  logAction: vi.fn(async () => {})
}))

vi.mock('@/services/team', () => ({
  getEffectiveUserId: (id) => id
}))

vi.mock('@/services/notifyWrap', () => ({
  withCrud: async (_meta, fn) => fn()
}))

import { supabase } from '@/config/supabase'
import { createArea, applyInventoryTemplate, adjustInventoryItemQty, recordAssetEvent } from '@/services/dynamicInventory'

describe('dynamicInventory plantillas y qty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createArea envía domain_type y template_id y aplica plantilla', async () => {
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 10, name: 'Activos', domain_type: 'fixed_asset', template_id: 'assets_equipment' },
        error: null
      })
    }
    supabase.from.mockImplementation((table) => {
      if (table === 'inventory_areas') return insertChain
      if (table === 'inventory_area_prefixes') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      return insertChain
    })
    supabase.rpc.mockResolvedValue({ data: { inserted: 9 }, error: null })

    const area = await createArea({
      name: 'Activos',
      icon: 'Monitor',
      prefix: 'AST',
      domain_type: 'fixed_asset',
      template_id: 'assets_equipment'
    }, 'user-1')

    expect(area.id).toBe(10)
    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      domain_type: 'fixed_asset',
      template_id: 'assets_equipment'
    }))
    expect(supabase.rpc).toHaveBeenCalledWith('apply_inventory_template', {
      p_area_id: 10,
      p_template_id: 'assets_equipment'
    })
  })

  it('applyInventoryTemplate llama RPC', async () => {
    supabase.rpc.mockResolvedValue({ data: { ok: true }, error: null })
    await applyInventoryTemplate(3, 'supplies')
    expect(supabase.rpc).toHaveBeenCalledWith('apply_inventory_template', {
      p_area_id: 3,
      p_template_id: 'supplies'
    })
  })

  it('adjustInventoryItemQty llama RPC con delta y motivo', async () => {
    supabase.rpc.mockResolvedValue({ data: { qty: 8 }, error: null })
    await adjustInventoryItemQty(5, -2, 'Rotura')
    expect(supabase.rpc).toHaveBeenCalledWith('adjust_inventory_item_qty', {
      p_item_id: 5,
      p_qty_delta: -2,
      p_reason: 'Rotura'
    })
  })

  it('recordAssetEvent llama RPC de ciclo de vida', async () => {
    supabase.rpc.mockResolvedValue({ data: { event_id: 1 }, error: null })
    await recordAssetEvent({
      itemId: 9,
      eventType: 'assign',
      toCustodian: 'Ana',
      toLocation: 'Oficina'
    })
    expect(supabase.rpc).toHaveBeenCalledWith('record_inventory_asset_event', expect.objectContaining({
      p_item_id: 9,
      p_event_type: 'assign',
      p_to_custodian: 'Ana',
      p_to_location: 'Oficina',
      p_require_owner_for_dispose: true
    }))
  })
})
