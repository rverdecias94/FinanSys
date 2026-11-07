import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  applyOptimisticItemCreate,
  applyOptimisticItemUpdate,
  applyOptimisticAreaUpdate,
  buildPendingInventoryItem,
  clearOptimisticItem,
  findInventoryItemInCache,
  inventoryValuesHaveBinary,
  removeInventoryItemFromCache,
  restoreAreaRow,
  serializeInventoryValues,
} from './optimisticInventory'

describe('optimisticInventory', () => {
  let qc

  beforeEach(() => {
    qc = new QueryClient()
  })

  it('serializeInventoryValues quita File/Blob y deja JSON limpio', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const out = serializeInventoryValues({
      Nombre: 'Silla',
      Foto: file,
      Fecha: new Date('2026-11-06T12:00:00.000Z'),
    })
    expect(out.Nombre).toBe('Silla')
    expect(out.Foto).toBeUndefined()
    expect(out.Fecha).toBe('2026-11-06T12:00:00.000Z')
    expect(inventoryValuesHaveBinary({ Foto: file })).toBe(true)
    expect(inventoryValuesHaveBinary({ Nombre: 'ok' })).toBe(false)
  })

  it('create optimista no duplica por client_uuid', () => {
    const key = ['inventoryItems', 7, 'rl-page', 1, 5]
    qc.setQueryData(key, { data: [], count: 0 })
    const row = buildPendingInventoryItem({
      areaId: 7,
      values: { Nombre: 'A' },
      clientUuid: 'u-1',
      businessId: 'b1',
    })
    applyOptimisticItemCreate(qc, 7, row)
    applyOptimisticItemCreate(qc, 7, row)
    const data = qc.getQueryData(key)
    expect(data.data).toHaveLength(1)
    expect(data.count).toBe(1)
    expect(data.data[0]._pending).toBe(true)
  })

  it('update / clear / remove funcionan sobre listado paginado', () => {
    const key = ['inventoryItems', 3, 'rl-page', 1, 5]
    qc.setQueryData(key, {
      data: [{ id: 9, values: { Nombre: 'Viejo' }, client_uuid: null }],
      count: 1,
    })
    applyOptimisticItemUpdate(qc, 3, 9, { Nombre: 'Nuevo' })
    expect(findInventoryItemInCache(qc, 3, 9).values.Nombre).toBe('Nuevo')
    expect(findInventoryItemInCache(qc, 3, 9)._pending).toBe(true)

    removeInventoryItemFromCache(qc, 3, 9)
    expect(findInventoryItemInCache(qc, 3, 9)).toBeNull()

    applyOptimisticItemCreate(qc, 3, buildPendingInventoryItem({
      areaId: 3,
      values: { Nombre: 'Temp' },
      clientUuid: 'tmp',
      businessId: 'b',
    }))
    clearOptimisticItem(qc, 3, 'tmp')
    expect(qc.getQueryData(key).data).toHaveLength(0)
  })

  it('area update optimista y restore', () => {
    const key = ['inventoryAreas', 'biz']
    qc.setQueryData(key, [{ id: 1, name: 'Antes', icon: 'Home' }])
    applyOptimisticAreaUpdate(qc, 1, { name: 'Después' })
    expect(qc.getQueryData(key)[0].name).toBe('Después')
    expect(qc.getQueryData(key)[0]._pending).toBe(true)
    restoreAreaRow(qc, 1, { id: 1, name: 'Antes', icon: 'Home' })
    expect(qc.getQueryData(key)[0].name).toBe('Antes')
    expect(qc.getQueryData(key)[0]._pending).toBe(false)
  })
})
