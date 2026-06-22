import { describe, it, expect } from 'vitest'
import {
  AGING_BUCKETS, OVERDUE_KEYS, agingOverdue, agingHasData,
  agingTotalsByCurrency, agingToExportRows,
} from './aging'

// Q10 — utilidades puras de antigüedad de saldos. La clasificación por días vive en
// la RPC SQL (verificada en prod); aquí se cubre la capa de presentación/export.

describe('utils/aging (Q10)', () => {
  const row = { currency: 'USD', not_due: 300, d_1_30: 100, d_31_60: 50, d_61_90: 25, d_over_90: 10, total: 485, cnt: 5 }

  it('AGING_BUCKETS cubre los 5 tramos en orden de severidad', () => {
    expect(AGING_BUCKETS.map((b) => b.key)).toEqual(['not_due', 'd_1_30', 'd_31_60', 'd_61_90', 'd_over_90'])
    expect(OVERDUE_KEYS).toEqual(['d_1_30', 'd_31_60', 'd_61_90', 'd_over_90'])
  })

  it('agingOverdue suma solo los tramos vencidos (excluye "por vencer")', () => {
    expect(agingOverdue(row)).toBe(185) // 100 + 50 + 25 + 10
  })

  it('agingOverdue es 0 sin fila o sin saldo vencido', () => {
    expect(agingOverdue(null)).toBe(0)
    expect(agingOverdue({ not_due: 500, d_1_30: 0, d_31_60: 0, d_61_90: 0, d_over_90: 0 })).toBe(0)
  })

  it('agingHasData detecta filas con total > 0', () => {
    expect(agingHasData([])).toBe(false)
    expect(agingHasData(null)).toBe(false)
    expect(agingHasData([{ currency: 'USD', total: 0 }])).toBe(false)
    expect(agingHasData([{ currency: 'USD', total: 5 }])).toBe(true)
  })

  it('agingTotalsByCurrency mapea moneda -> total', () => {
    expect(agingTotalsByCurrency([row, { currency: 'CUP', total: 9000 }])).toEqual({ USD: 485, CUP: 9000 })
  })

  it('agingToExportRows aplana con etiquetas y añade el vencido total', () => {
    expect(agingToExportRows([row])[0]).toEqual({
      Moneda: 'USD', 'Por vencer': 300, '1-30 días': 100, '31-60 días': 50,
      '61-90 días': 25, 'Más de 90 días': 10, 'Vencido total': 185, Total: 485,
    })
  })

  it('maneja los numeric de Postgres que llegan como string', () => {
    const r = { currency: 'CUP', not_due: '5000.00', d_1_30: '0', d_31_60: '0', d_61_90: '0', d_over_90: '0', total: '5000.00' }
    expect(agingOverdue(r)).toBe(0)
    expect(agingHasData([r])).toBe(true)
    expect(agingToExportRows([r])[0]['Por vencer']).toBe(5000)
  })
})
