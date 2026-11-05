import { describe, it, expect } from 'vitest'
import {
  resolvePeriodContext,
  resolveEffectivePeriod,
  filterRowsByCutoff,
  buildSourceRefs,
  cutoffMetadata,
  getClientTimeZone,
} from './periodCutoff'
import { buildReport } from './templates'
import { REPORT_TYPES } from './documentModel'

describe('periodCutoff — período efectivo y timezone', () => {
  it('getClientTimeZone devuelve string no vacío', () => {
    expect(typeof getClientTimeZone()).toBe('string')
    expect(getClientTimeZone().length).toBeGreaterThan(0)
  })

  it('año pasado → closed con fin del rango', () => {
    const p = resolveEffectivePeriod(
      { startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-12-31T23:59:59.000Z', label: '2025' },
      { now: new Date('2026-11-05T15:00:00.000Z'), timezone: 'America/Havana' }
    )
    expect(p.status).toBe('closed')
    expect(p.label).toBe('2025')
    expect(p.effectiveTo).toMatch(/2025-12-31/)
    expect(p.warnings).toHaveLength(0)
  })

  it('año en curso → ytd_open acumulado a now', () => {
    const now = new Date('2026-11-05T15:00:00.000Z')
    const p = resolveEffectivePeriod(
      { startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T23:59:59.000Z', label: '2026' },
      { now, timezone: 'America/Havana' }
    )
    expect(p.status).toBe('ytd_open')
    expect(p.label).toMatch(/acumulado/i)
    expect(p.effectiveTo).toBe(now.toISOString())
    expect(p.cutoffAt).toBe(now.toISOString())
    expect(p.warnings.some((w) => /en curso|acumulado/i.test(w))).toBe(true)
  })

  it('inicio futuro → future_open', () => {
    const p = resolveEffectivePeriod(
      { startDate: '2027-01-01T00:00:00.000Z', endDate: '2027-12-31T23:59:59.000Z', label: '2027' },
      { now: new Date('2026-11-05T12:00:00.000Z'), timezone: 'UTC' }
    )
    expect(p.status).toBe('future_open')
    expect(p.warnings.some((w) => /no cerrado|futuros/i.test(w))).toBe(true)
  })

  it('resolvePeriodContext usa timezone del cliente por defecto', () => {
    const p = resolvePeriodContext(
      { startDate: '2026-01-01', endDate: '2026-01-31T23:59:59.000Z', label: 'Enero' },
      { now: new Date('2026-02-01T12:00:00.000Z') }
    )
    expect(p.cutoffAt).toBe('2026-01-31T23:59:59.000Z')
    expect(p.timezone).toBe(getClientTimeZone())
    expect(p.status).toBe('closed')
    expect(cutoffMetadata(p).some((m) => m.label === 'Fecha de corte')).toBe(true)
    expect(cutoffMetadata(p).some((m) => m.label === 'Estado del período')).toBe(true)
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

  it('finanzas adjunta sourceRefs y período efectivo en año en curso', () => {
    const doc = buildReport('finanzas', {
      dateFilter: {
        label: '2026',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.000Z',
      },
      transactions: [
        { id: 1, type: 'income', amount: 100, currency: 'USD', category: 'Ventas', date: '2026-01-05' },
      ],
      cutoffAt: undefined,
    }, { asLegacy: false })
    // buildReport usa now real; si estamos en 2026+ el status puede ser ytd_open
    expect(doc.period.label).toBeTruthy()
    const kpi = doc.kpis.find((k) => k.currency === 'USD')
    expect(kpi.sourceRefs).toEqual([{ table: 'transactions', id: '1' }])
    expect(doc.period.cutoffAt).toBeTruthy()
  })
})
