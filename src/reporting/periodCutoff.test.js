import { describe, it, expect } from 'vitest'
import {
  resolvePeriodContext,
  filterRowsByCutoff,
  buildSourceRefs,
  cutoffMetadata,
} from './periodCutoff'
import { buildReport } from './templates'
import { REPORT_TYPES } from './documentModel'

describe('periodCutoff E5', () => {
  it('resuelve cutoffAt desde endDate del filtro', () => {
    const p = resolvePeriodContext(
      { startDate: '2026-01-01', endDate: '2026-01-31T23:59:59.000Z', label: 'Enero' },
      { now: new Date('2026-02-01T12:00:00.000Z') }
    )
    expect(p.cutoffAt).toBe('2026-01-31T23:59:59.000Z')
    expect(p.timezone).toBe('America/Havana')
    expect(cutoffMetadata(p).some((m) => m.label === 'Fecha de corte')).toBe(true)
  })

  it('filterRowsByCutoff excluye fechas posteriores al corte', () => {
    const rows = [
      { id: 1, date: '2026-01-10' },
      { id: 2, date: '2026-02-01' },
    ]
    const filtered = filterRowsByCutoff(rows, (r) => r.date, '2026-01-31T23:59:59.000Z')
    expect(filtered.map((r) => r.id)).toEqual([1])
  })

  it('buildSourceRefs limita y etiqueta tabla', () => {
    const refs = buildSourceRefs([{ id: 9 }, { id: 10 }], { table: 'transactions', limit: 1 })
    expect(refs).toEqual([{ table: 'transactions', id: '9' }])
  })

  it('informe auditoría incluye corte y sourceRefs', () => {
    const doc = buildReport('audit', {
      dateFilter: { label: 'Enero', startDate: '2026-01-01', endDate: '2026-01-31T12:00:00.000Z' },
      auditLogs: [
        {
          id: 5,
          created_at: '2026-01-15T10:00:00.000Z',
          user_email: 'a@b.c',
          action: 'update',
          resource: 'transactions',
          area: 'Finanzas',
          old_value: { amount: 1 },
          new_value: { amount: 2 },
          ip_address: '1.1.1.1',
        },
      ],
    }, { asLegacy: false })
    expect(doc.type).toBe(REPORT_TYPES.AUDIT)
    expect(doc.period.cutoffAt).toMatch(/2026-01-31/)
    expect(doc.kpis[0].sourceRefs[0]).toEqual({ table: 'audit_logs', id: '5' })
    expect(doc.metadata.some((m) => /corte/i.test(m.label))).toBe(true)
  })

  it('finanzas adjunta sourceRefs de transacciones al KPI', () => {
    const doc = buildReport('finanzas', {
      dateFilter: { label: 'Enero', startDate: '2026-01-01', endDate: '2026-01-31' },
      transactions: [
        { id: 1, type: 'income', amount: 100, currency: 'USD', category: 'Ventas', date: '2026-01-05' },
      ],
    }, { asLegacy: false })
    const kpi = doc.kpis.find((k) => k.currency === 'USD')
    expect(kpi.sourceRefs).toEqual([{ table: 'transactions', id: '1' }])
    expect(doc.period.cutoffAt).toBeTruthy()
  })
})
