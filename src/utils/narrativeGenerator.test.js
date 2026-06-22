import { describe, it, expect } from 'vitest'
import { generateFinanceReport } from './narrativeGenerator'

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
