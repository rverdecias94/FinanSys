import { describe, it, expect } from 'vitest'
import {
  createReportDocument,
  fromLegacyNarrative,
  toLegacyReportShape,
  isReportDocument,
  REPORT_TYPES,
  DEFAULT_DISCLAIMER,
} from './documentModel'
import { buildReport } from './templates'
import { multiCurrencyTransactions, mixedUomMovements, dateFilter } from '@/utils/narrativeGenerator.fixtures'

describe('documentModel', () => {
  it('createReportDocument exige type y title', () => {
    expect(() => createReportDocument({ title: 'X' })).toThrow(/type/)
    expect(() => createReportDocument({ type: 'executive' })).toThrow(/title/)
  })

  it('fromLegacy + toLegacy preserva title/sections y añade criterio', () => {
    const legacy = {
      title: 'Prueba',
      metadata: [{ label: 'Período', value: 'Enero' }],
      sections: [{ title: '1. Cuerpo', content: 'Hola' }],
    }
    const doc = fromLegacyNarrative(legacy, {
      type: REPORT_TYPES.FINANCE_MGMT,
      criteria: { cashBasis: 'recorded' },
      warnings: ['Aviso de prueba'],
    })
    expect(isReportDocument(doc)).toBe(true)
    expect(doc.id).toBeNull()
    expect(doc.disclaimer).toMatch(/partida doble/i)

    const shape = toLegacyReportShape(doc)
    expect(shape.title).toBe('Prueba')
    expect(shape.sections.some((s) => /Nota metodológica|Disclaimer|metodol/i.test(s.title) || s.content === DEFAULT_DISCLAIMER || s.title === '0. Nota metodológica')).toBe(true)
    expect(shape.sections.some((s) => s.title === 'Advertencias de datos')).toBe(true)
    expect(shape.metadata.some((m) => m.label === 'Criterio de flujo')).toBe(true)
  })

  it('toLegacyReportShape acepta legacy puro sin type', () => {
    const shape = toLegacyReportShape({
      title: 'Legacy',
      metadata: [],
      sections: [{ title: 'A', content: 'b' }],
    })
    expect(shape.title).toBe('Legacy')
    expect(shape.sections).toHaveLength(1)
  })
})

describe('templates E3', () => {
  it('buildReport finanzas → shape Preview con flujo neto registrado', () => {
    const report = buildReport('finanzas', {
      transactions: multiCurrencyTransactions,
      dateFilter,
    })
    expect(report.title).toMatch(/financiero|finanzas|Resumen financiero/i)
    expect(JSON.stringify(report)).toMatch(/Flujo neto registrado/i)
    expect(JSON.stringify(report)).not.toMatch(/margen neto/i)
  })

  it('buildReport executive incluye KPIs y disclaimer', () => {
    const report = buildReport('executive', {
      transactions: multiCurrencyTransactions,
      movements: mixedUomMovements,
      inventorySummary: [{ id: '1', name: 'Central', itemsCount: 3 }],
      dateFilter,
      openReceivableCount: 2,
      openPayableCount: 1,
    })
    expect(report.title).toMatch(/ejecutivo/i)
    expect(report.sections.some((s) => /Indicadores clave/i.test(s.title))).toBe(true)
    expect(JSON.stringify(report)).toMatch(/partida doble|registros operacionales/i)
    expect(JSON.stringify(report)).toMatch(/Por cobrar abiertas/i)
  })

  it('buildReport global mantiene cabeceras I/II/III', () => {
    const report = buildReport('global', {
      transactions: multiCurrencyTransactions,
      movements: mixedUomMovements,
      inventorySummary: [{ id: '1', name: 'Central', itemsCount: 2 }],
      dateFilter,
    })
    const headers = report.sections.filter((s) => s.type === 'header_section').map((s) => s.title)
    expect(headers).toEqual([
      'I. MÓDULO FINANCIERO',
      'II. MÓDULO DE ALMACÉN',
      'III. INVENTARIO',
    ])
  })

  it('buildReport asLegacy:false existencias/kardex devuelven Document', () => {
    const stock = buildReport('almacen', {
      movements: mixedUomMovements.map((m, i) => ({
        ...m,
        id: i + 1,
        product_id: i + 1,
        unit_cost: 2,
        moved_at: '2026-01-10T00:00:00.000Z',
        products: { name: m.products.name, sku: `S${i}`, currency: 'USD' },
      })),
      dateFilter: { ...dateFilter, startDate: '2026-01-01', endDate: '2026-01-31' },
    }, { asLegacy: false })
    expect(isReportDocument(stock)).toBe(true)
    expect(stock.type).toBe(REPORT_TYPES.WAREHOUSE)
    expect(JSON.stringify(stock)).toMatch(/Existencias|unit_cost|N\/D/i)

    const kardex = buildReport('kardex', {
      movements: [
        {
          id: 1,
          product_id: 1,
          type: 'in',
          qty: 5,
          unit_cost: 3,
          moved_at: '2026-01-05',
          products: { name: 'Café', sku: 'CAF', currency: 'USD' },
        },
      ],
      dateFilter,
    }, { asLegacy: false })
    expect(kardex.type).toBe(REPORT_TYPES.KARDEX)
    expect(kardex.sections.some((s) => /Kardex/i.test(s.title))).toBe(true)
  })
})
