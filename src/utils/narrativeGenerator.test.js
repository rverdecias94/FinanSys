import { describe, it, expect } from 'vitest'
import { generateFinanceReport, generateInventoryReport, generateGlobalReport } from './narrativeGenerator'

// P2.5 — Un código de moneda no-ISO hacía que Intl.NumberFormat lanzara RangeError
// y rompía el reporte Word y la previsualización. `fmt` ahora hace try/catch y cae
// a un formato decimal + código de moneda.
describe('narrativeGenerator — P2.5 moneda no-ISO', () => {
  const dateFilter = { label: 'Periodo de prueba' }

  it('no lanza RangeError con un código de moneda inválido y usa el fallback decimal', () => {
    const txs = [
      { type: 'income', amount: 1500, currency: 'BITCOIN', category: 'Ventas', date: '2026-06-01' },
      { type: 'expense', amount: 500.5, currency: 'BITCOIN', category: 'Nómina', date: '2026-06-02' }
    ]

    let report
    expect(() => { report = generateFinanceReport(txs, dateFilter) }).not.toThrow()
    expect(report).toBeTruthy()

    const table = report.sections.find(s => s.type === 'table' && /Resumen de Ingresos y Gastos/.test(s.title))
    expect(table).toBeTruthy()
    // Fila "Ingresos totales": número formateado + código (fallback), no NaN ni crash.
    expect(table.rows[0][1]).toMatch(/\d.*BITCOIN/)
    expect(table.rows[0][1]).not.toMatch(/NaN/)
  })

  it('formatea con símbolo cuando el código ISO es válido (USD)', () => {
    const txs = [{ type: 'income', amount: 1000, currency: 'USD', category: 'Ventas', date: '2026-06-01' }]
    const report = generateFinanceReport(txs, dateFilter)
    const table = report.sections.find(s => s.type === 'table' && /Resumen de Ingresos y Gastos/.test(s.title))
    expect(table).toBeTruthy()
    expect(table.rows[0][1]).not.toMatch(/NaN/)
  })
})

// El desglose de inventario mostraba una columna "Icono Ref." (un emoji decorativo,
// sin valor analítico). Ahora muestra la PARTICIPACIÓN (% del total) por área y cierra
// con una fila Total al 100% — datos honestos derivados de los ítems reales.
describe('narrativeGenerator — generateInventoryReport (desglose por área)', () => {
  const dateFilter = { label: 'Junio 2026' }
  const summary = [
    { id: '1', name: 'Almacén Central', icon: '📦', itemsCount: 30 },
    { id: '2', name: 'Tienda', icon: '🏪', itemsCount: 10 },
    { id: '3', name: 'Bodega', icon: '🏭', itemsCount: 0 }
  ]

  it('el desglose usa Participación y ya no la columna del icono', () => {
    const report = generateInventoryReport(summary, dateFilter)
    const table = report.sections.find(s => s.type === 'table')
    expect(table.headers).toEqual(['Área', 'Ítems registrados', 'Participación'])
    expect(table.headers).not.toContain('Icono Ref.')
    // ninguna celda arrastra el emoji del icono
    const flat = table.rows.flat().join(' ')
    expect(flat).not.toMatch(/📦|🏪|🏭/)
  })

  it('calcula la participación por área (orden desc) y cierra con Total al 100%', () => {
    const report = generateInventoryReport(summary, dateFilter)
    const table = report.sections.find(s => s.type === 'table')
    expect(table.rows[0]).toEqual(['Almacén Central', '30', '75.0%'])
    expect(table.rows[1]).toEqual(['Tienda', '10', '25.0%'])
    expect(table.rows[2]).toEqual(['Bodega', '0', '0.0%'])
    const total = table.rows[table.rows.length - 1]
    expect(total).toEqual(['Total', '40', '100.0%'])
  })

  it('menciona en el resumen las áreas sin ítems', () => {
    const report = generateInventoryReport(summary, dateFilter)
    const intro = report.sections.find(s => /Estado del Inventario/.test(s.title))
    expect(intro.content).toMatch(/1 área no registró ítems/)
  })

  it('no se rompe con inventario vacío (Total 0, 0.0%)', () => {
    const report = generateInventoryReport([], dateFilter)
    const table = report.sections.find(s => s.type === 'table')
    expect(table.rows[table.rows.length - 1]).toEqual(['Total', '0', '0.0%'])
  })
})

describe('narrativeGenerator — generateGlobalReport (informe integrado)', () => {
  it('integra los tres módulos y el inventario integrado también usa Participación', () => {
    const report = generateGlobalReport({
      transactions: [{ type: 'income', amount: 100, currency: 'USD', category: 'Ventas', date: '2026-06-01' }],
      movements: [{ type: 'in', qty: 5, products: { name: 'Café' } }],
      inventorySummary: [{ id: '1', name: 'Central', icon: '📦', itemsCount: 4 }]
    }, { label: 'Junio 2026' })

    const headers = report.sections.filter(s => s.type === 'header_section').map(s => s.title)
    expect(headers).toEqual(['I. MÓDULO FINANCIERO', 'II. MÓDULO DE ALMACÉN', 'III. INVENTARIO'])

    const invTable = report.sections.find(s => s.type === 'table' && (s.headers || []).includes('Participación'))
    expect(invTable).toBeTruthy()
  })
})
