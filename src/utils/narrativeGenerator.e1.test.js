/**
 * E1 — comportamiento esperado tras corrección de terminología e indicadores.
 * Suite independiente del baseline histórico.
 */
import { describe, it, expect } from 'vitest'
import {
  generateFinanceReport,
  generateWarehouseReport,
  generateGlobalReport,
} from './narrativeGenerator'
import {
  dateFilter,
  multiCurrencyTransactions,
  crossCurrencyExpenses,
  mixedUomMovements,
  incompleteCostMovements,
} from './narrativeGenerator.fixtures'

const FORBIDDEN_FINANCE = /margen neto|base de efectivo|resultado operativo|utilidad|rentabilidad/i
const FORBIDDEN_WH = /índice de rotación|rotación superior/i

function flattenReport(report) {
  return JSON.stringify(report)
}

describe('E1 / comportamiento esperado', () => {
  describe('finanzas — terminología descriptiva', () => {
    it('declara base de registros operacionales y disclaimer metodológico', () => {
      const report = generateFinanceReport(multiCurrencyTransactions, dateFilter)
      const base = report.metadata.find((m) => m.label === 'Base de preparación')
      expect(base?.value).toMatch(/registros operacionales/i)
      expect(base?.value).not.toMatch(/base de efectivo/i)

      const disclaimer = report.sections.find((s) => /Nota metodológica|Metodología|Disclaimer/i.test(s.title))
      expect(disclaimer).toBeTruthy()
      expect(disclaimer.content || (disclaimer.items || []).join(' ')).toMatch(
        /no constituye (un )?estado financiero|partida doble/i
      )
    })

    it('usa «Flujo neto registrado» y «Relación flujo neto/entradas registradas»', () => {
      const report = generateFinanceReport(multiCurrencyTransactions, dateFilter)
      const flat = flattenReport(report)
      expect(flat).toMatch(/Flujo neto registrado/i)
      expect(flat).toMatch(/Relación flujo neto\/entradas registradas/i)
      expect(flat).not.toMatch(FORBIDDEN_FINANCE)

      const summary = report.sections.find((s) => /Resumen de [Ii]ngresos y [Gg]astos/.test(s.title))
      expect(summary.rows.some((r) => r[0] === 'Flujo neto registrado')).toBe(true)
      expect(summary.rows.some((r) => /Resultado neto/i.test(r[0]))).toBe(false)

      const kpi = report.sections.find((s) => /Indicadores del período/i.test(s.title))
      expect(kpi.rows.some((r) => /Relación flujo neto\/entradas registradas/i.test(r[0]))).toBe(true)
      expect(kpi.rows.some((r) => /Margen neto/i.test(r[0]))).toBe(false)
    })

    it('mantiene shape público title/metadata/sections', () => {
      const report = generateFinanceReport(multiCurrencyTransactions, dateFilter)
      expect(report).toEqual(
        expect.objectContaining({
          title: expect.any(String),
          metadata: expect.any(Array),
          sections: expect.any(Array),
        })
      )
      expect(report.sections.every((s) => typeof s.title === 'string')).toBe(true)
    })

    it('totales por moneda USD y CUP sin mezclar importes', () => {
      const report = generateFinanceReport(multiCurrencyTransactions, dateFilter)
      const summary = report.sections.find((s) => /Resumen de [Ii]ngresos y [Gg]astos/.test(s.title))
      expect(summary.headers).toEqual(
        expect.arrayContaining([expect.stringMatching(/USD/), expect.stringMatching(/CUP/)])
      )
      // Ingresos: USD 1000+500+300=1800; CUP 20000
      expect(summary.rows[0][1]).toMatch(/1[.,]?800/)
      expect(summary.rows[0][2]).toMatch(/20[.,]?000/)
    })

    it('hallazgos cubren cada moneda con actividad (USD y CUP)', () => {
      const report = generateFinanceReport(multiCurrencyTransactions, dateFilter)
      const findings = report.sections.find((s) => /Hallazgos/i.test(s.title))
      const text = (findings?.items || []).join(' ')
      expect(text).toMatch(/USD/)
      expect(text).toMatch(/CUP/)
      expect(text).not.toMatch(FORBIDDEN_FINANCE)
      expect(flattenReport(report)).not.toMatch(/Ticket promedio/i)
      expect(flattenReport(report)).toMatch(/Importe promedio por transacción registrada/i)
    })

    it('Top gastos se presenta por moneda (no ranking global cruzado)', () => {
      const report = generateFinanceReport(crossCurrencyExpenses, dateFilter)
      const table = report.sections.find((s) => /[Gg]astos [Pp]rincipales/.test(s.title))
      expect(table).toBeTruthy()
      const headers = table.headers.join(' ')
      const hasCurrencyColumn = /Moneda/i.test(headers)
      const sectionNotesCurrency = /por moneda/i.test(table.notes || '')
      const multipleTables = report.sections.filter((s) => /[Gg]astos [Pp]rincipales/.test(s.title)).length > 1
      expect(hasCurrencyColumn || sectionNotesCurrency || multipleTables).toBe(true)

      if (hasCurrencyColumn) {
        const usdRows = table.rows.filter((r) => r.includes('USD') || /USD/.test(r.join(' ')))
        const cupRows = table.rows.filter((r) => r.includes('CUP') || /CUP/.test(r.join(' ')))
        expect(usdRows.length).toBeGreaterThan(0)
        expect(cupRows.length).toBeGreaterThan(0)
      }
      expect(table.headers.join(' ')).toMatch(/Fecha|ID/i)
    })

    it('no presenta la base como efectivo cobrado; aclara que no equivale a caja cobrada', () => {
      const report = generateFinanceReport(multiCurrencyTransactions, dateFilter)
      const base = report.metadata.find((m) => m.label === 'Base de preparación')
      expect(base?.value).toMatch(/registros operacionales/i)
      expect(base?.value).not.toMatch(/base de efectivo/i)
      // Debe negar equivalencia con caja cobrada (pendientes siguen en los totales registrados).
      expect(base?.value + flattenReport(report)).toMatch(/no equivale a caja cobrada/i)
    })
  })

  describe('almacén — UDM y rotación', () => {
    it('no suma cantidades de UDM distintas como «unidades totales» ni usa índice de rotación', () => {
      const report = generateWarehouseReport(mixedUomMovements, dateFilter)
      const summary = report.sections.find((s) => /Resumen Operativo/.test(s.title))
      expect(summary.content).not.toMatch(FORBIDDEN_WH)
      expect(summary.content).not.toMatch(/\d+\s+unidades/)
      expect(summary.content).toMatch(/movimientos|productos|SKU|ítems/i)
      // Debe mencionar conteo de movimientos / productos, no 130 unidades agregadas
      expect(summary.content).not.toMatch(/\b130\b/)
    })

    it('tabla Top productos conserva entradas/salidas por producto', () => {
      const report = generateWarehouseReport(mixedUomMovements, dateFilter)
      const table = report.sections.find((s) => s.type === 'table')
      expect(table.headers).toEqual(
        expect.arrayContaining(['Producto', 'Entradas', 'Salidas'])
      )
      expect(table.rows.some((r) => r[0] === 'Café 500g')).toBe(true)
    })

    it('histórico sin unit_cost no inventa cifras de valoración', () => {
      const report = generateWarehouseReport(incompleteCostMovements, dateFilter)
      const flat = flattenReport(report)
      // Puede mencionar que NO calcula valoración; no debe inventar montos monetarios.
      expect(flat).not.toMatch(/USD\s*\d|CUP\s*\d|\$\d/)
      expect(flat).not.toMatch(/coste unitario|valor final|COGS/i)
    })
  })

  describe('global — compatibilidad', () => {
    it('generateGlobalReport legacy mantiene I/II/III; buildReport global es síntesis', async () => {
      const report = generateGlobalReport(
        {
          transactions: multiCurrencyTransactions,
          movements: mixedUomMovements,
          inventorySummary: [{ id: '1', name: 'Central', itemsCount: 2 }],
        },
        dateFilter
      )
      const headers = report.sections.filter((s) => s.type === 'header_section').map((s) => s.title)
      expect(headers).toEqual([
        'I. MÓDULO FINANCIERO',
        'II. MÓDULO DE ALMACÉN',
        'III. INVENTARIO',
      ])
      expect(flattenReport(report)).not.toMatch(FORBIDDEN_FINANCE)
      expect(flattenReport(report)).not.toMatch(FORBIDDEN_WH)

      const { buildReport } = await import('@/reporting/templates')
      const modern = buildReport('global', {
        transactions: multiCurrencyTransactions,
        movements: mixedUomMovements,
        inventorySummary: [{ id: '1', name: 'Central', itemsCount: 2 }],
        dateFilter,
      })
      expect(modern.sections.some((s) => /consolidado|síntesis/i.test(s.title))).toBe(true)
      expect(JSON.stringify(modern)).not.toMatch(/I\. MÓDULO FINANCIERO/)
    })
  })
})
