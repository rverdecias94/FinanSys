/**
 * BASELINE pre-E1 — documenta el comportamiento ACTUAL (incl. defectos conocidos).
 *
 * Tras aplicar E1 este describe queda en skip: los defectos quedan registrados aquí
 * como evidencia histórica; la verificación del contrato corregido vive en
 * narrativeGenerator.e1.test.js.
 *
 * No ocultar: si se reactivara este suite sobre código post-E1, DEBE fallar.
 */
import { describe, it, expect } from 'vitest'
import { generateFinanceReport, generateWarehouseReport } from './narrativeGenerator'
import {
  dateFilter,
  multiCurrencyTransactions,
  crossCurrencyExpenses,
  mixedUomMovements,
  incompleteCostMovements,
} from './narrativeGenerator.fixtures'

// E1 aplicado: el comportamiento defectuoso ya no existe. Mantener skip + asserts
// históricos para no perder el registro de lo que se corrigió.
// E1 cerrado: suite histórico en skip. Reactivar (false) solo para reproducir defectos pre-E1.
const E1_APPLIED = true

const suite = E1_APPLIED ? describe.skip : describe

suite('baseline / comportamiento actual (pre-E1)', () => {
  it('usa terminología «base de efectivo» y «margen neto» en finanzas', () => {
    const report = generateFinanceReport(multiCurrencyTransactions, dateFilter)
    const base = report.metadata.find((m) => m.label === 'Base de preparación')
    expect(base?.value).toMatch(/base de efectivo/i)

    const flat = JSON.stringify(report)
    expect(flat).toMatch(/margen neto/i)

    const kpiTable = report.sections.find((s) => /Indicadores del período/.test(s.title))
    expect(kpiTable.rows.some((r) => /Margen neto/i.test(r[0]))).toBe(true)

    const summary = report.sections.find((s) => /Resumen de Ingresos y Gastos/.test(s.title))
    expect(summary.rows.some((r) => r[0] === 'Resultado neto')).toBe(true)
  })

  it('conclusiones solo miran currencies[0] (ignora CUP si USD va primero)', () => {
    const report = generateFinanceReport(multiCurrencyTransactions, dateFilter)
    const conclusions = report.sections.find((s) => /Conclusiones/.test(s.title))
    const text = (conclusions?.items || []).join(' ')
    // Con el orden del Set de monedas, USD aparece primero; las conclusiones
    // no mencionan CUP aunque haya actividad material en CUP.
    expect(text).toMatch(/USD/)
    expect(text).not.toMatch(/CUP/)
  })

  it('Top gastos ordena por magnitud numérica cruzando monedas (CUP 500 > USD 10)', () => {
    const report = generateFinanceReport(crossCurrencyExpenses, dateFilter)
    const table = report.sections.find((s) => /Gastos Principales/.test(s.title))
    expect(table.rows[0][0]).toBe('Transporte') // 500 CUP “gana” a 10 USD
  })

  it('almacén suma cantidades heterogéneas como «unidades» y habla de índice de rotación', () => {
    const report = generateWarehouseReport(mixedUomMovements, dateFilter)
    const summary = report.sections.find((s) => /Resumen Operativo/.test(s.title))
    expect(summary.content).toMatch(/unidades/i)
    expect(summary.content).toMatch(/índice de rotación/i)
    // 10+20+100 entradas = 130 “unidades” mezclando paquete/litro/unidad
    expect(summary.content).toMatch(/130/)
  })

  it('no inventa valoración monetaria ante unit_cost ausente (pre-E4)', () => {
    const report = generateWarehouseReport(incompleteCostMovements, dateFilter)
    const flat = JSON.stringify(report)
    expect(flat).not.toMatch(/valor(?:ación|izado)|COGS|avg_cost|unit_cost/i)
  })
})

describe('baseline / registro de suite ajeno a reportes', () => {
  it('documenta que el fallo preexistente de planRequests no pertenece a E0/E1', () => {
    // Ver docs/reportes/baseline-vitest-full-e0.txt:
    // FAIL src/services/planRequests.test.js — contact_name inesperado en RPC.
    // Ese fallo NO se corrige en E0/E1 (fuera de alcance).
    expect(true).toBe(true)
  })
})
