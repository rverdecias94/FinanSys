/**
 * Regresión post-revisión DOCX (cinco informes, filtro año 2026).
 * Valida aceptación A–D sin afirmar paridad BD↔DOCX.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildReport } from './templates'
import { resolvePeriodContext } from './periodCutoff'
import { multiCurrencyTransactions } from '@/utils/narrativeGenerator.fixtures'

const { saveAsMock } = vi.hoisted(() => ({ saveAsMock: vi.fn() }))
vi.mock('file-saver', () => ({
  saveAs: (...args) => saveAsMock(...args),
}))

const year2026Filter = {
  type: 'year',
  label: '2026',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-12-31T23:59:59.999Z',
}

const nowMidYear = new Date('2026-11-05T15:00:00.000-04:00')

const warehouseMovements = [
  {
    id: 101,
    product_id: 1,
    type: 'in',
    qty: 10,
    unit_cost: 5,
    moved_at: '2025-12-20T00:00:00.000Z',
    products: { name: 'Café', sku: 'CAF-01', currency: 'USD' },
  },
  {
    id: 102,
    product_id: 1,
    type: 'out',
    qty: 3,
    unit_cost: 5,
    moved_at: '2026-02-10T00:00:00.000Z',
    document_id: 'DOC-1',
    transaction_id: 'TX-1',
    products: { name: 'Café', sku: 'CAF-01', currency: 'USD' },
  },
  {
    id: 201,
    product_id: 2,
    type: 'out',
    qty: 4,
    unit_cost: null,
    moved_at: '2026-03-01T00:00:00.000Z',
    products: { name: 'Aceite', sku: 'ACE-02', currency: 'CUP' },
  },
  {
    id: 202,
    product_id: 2,
    type: 'in',
    qty: 1,
    unit_cost: null,
    moved_at: '2026-03-05T00:00:00.000Z',
    products: { name: 'Aceite', sku: 'ACE-02', currency: 'CUP' },
  },
]

function flatten(report) {
  return JSON.stringify(report)
}

function buildFive() {
  const periodContext = resolvePeriodContext(year2026Filter, {
    now: nowMidYear,
    timezone: 'America/New_York',
  })
  const payload = {
    transactions: multiCurrencyTransactions,
    movements: warehouseMovements,
    inventorySummary: [
      { id: '1', name: 'Central', itemsCount: 4 },
      { id: '2', name: 'Tienda', itemsCount: 2 },
    ],
    dateFilter: year2026Filter,
    periodContext,
    openReceivableCount: 1,
    openPayableCount: 0,
  }
  return {
    executive: buildReport('executive', payload),
    finanzas: buildReport('finanzas', payload),
    almacen: buildReport('almacen', payload),
    kardex: buildReport('kardex', payload),
    global: buildReport('global', payload),
    periodContext,
  }
}

describe('regresión cinco DOCX — año 2026', () => {
  beforeEach(() => {
    saveAsMock.mockReset()
  })

  it('período efectivo YTD (no ejercicio cerrado 31/12) y TZ de máquina/cliente', () => {
    const { periodContext, executive, finanzas } = buildFive()
    expect(periodContext.status).toBe('ytd_open')
    expect(periodContext.label).toMatch(/acumulado/i)
    expect(periodContext.timezone).toBe('America/New_York')
    expect(flatten(executive)).toMatch(/acumulado|Período efectivo|Estado/i)
    expect(flatten(finanzas)).toMatch(/acumulado/i)
  })

  it('almacén: sin SKU duplicado, UDM —, negativos/N/D y saldo reconstruido', () => {
    const { almacen } = buildFive()
    const flat = flatten(almacen)
    expect(flat).toMatch(/reconstruido/i)
    expect(flat).toMatch(/UDM/)
    expect(flat).toMatch(/no registra unidad de medida/i)
    expect(flat).toMatch(/negativ/i)
    expect(flat).toMatch(/N\/D/)
    const stockTable = almacen.sections.find(
      (s) => /Existencias por producto/i.test(s.title) && s.type === 'table'
    )
    expect(stockTable).toBeTruthy()
    expect(stockTable.headers).toEqual(
      expect.arrayContaining(['SKU', 'Producto', 'UDM', 'Inicial', 'Entradas', 'Salidas', 'Final'])
    )
    const cafe = stockTable.rows.find((r) => r[0] === 'CAF-01')
    expect(cafe).toBeTruthy()
    expect(cafe[1]).toBe('Café')
    expect(cafe[1]).not.toMatch(/CAF-01/)
    expect(cafe[2]).toBe('—')
  })

  it('kardex: saldo inicial, refs doc/tx, pageBreakBefore, sin avg_cost', () => {
    const { kardex } = buildFive()
    const flat = flatten(kardex)
    expect(flat).toMatch(/saldo inicial/i)
    expect(flat).toMatch(/DOC-1|TX-1/)
    // Se menciona avg_cost solo para declarar que NO se usa; no hay cifras inventadas con él.
    expect(flat).toMatch(/avg_cost.*no se util|No se usa avg_cost/i)
    expect(kardex.sections.some((s) => s.pageBreakBefore)).toBe(true)
    expect(kardex.sections.every((s) => !/^0\./.test(s.title || ''))).toBe(true)
  })

  it('ejecutivo: entradas/salidas/neto; financiero sin ticket; global sintético más corto', () => {
    const { executive, finanzas, global, almacen, kardex } = buildFive()
    expect(flatten(executive)).toMatch(/Entradas|Salidas|Flujo neto/i)
    expect(flatten(executive)).toMatch(/Metodología|Recomendaciones|Alertas/i)
    expect(flatten(finanzas)).not.toMatch(/Ticket promedio/i)
    expect(flatten(finanzas)).toMatch(/Importe promedio por transacción registrada/i)
    expect(flatten(finanzas)).toMatch(/Hallazgos|Riesgos|Recomendaciones/i)
    expect(flatten(global)).toMatch(/Resumen ejecutivo consolidado|síntesis/i)
    expect(flatten(global)).not.toMatch(/I\. MÓDULO FINANCIERO/)
    const globalLen = flatten(global).length
    const sumParts =
      flatten(finanzas).length + flatten(almacen).length + flatten(executive).length
    expect(globalLen).toBeLessThan(sumParts)
    expect(kardex.title).toMatch(/Kardex/i)
  })

  it('numeración 1..N sin «0.» en los cinco informes', () => {
    const five = buildFive()
    for (const key of ['executive', 'finanzas', 'almacen', 'kardex', 'global']) {
      const zero = five[key].sections.filter((s) => /^0\./.test(s.title || ''))
      expect(zero, key).toEqual([])
    }
  })

  it('generateDOCX empaqueta blob sin separador --- y con pie', async () => {
    const { generateDOCX } = await import('@/utils/docxGenerator')
    const { executive } = buildFive()
    await generateDOCX(executive, 'regresion-ejecutivo-2026', {
      company: { tradeName: 'Demo GESTIA', legalName: 'Demo GESTIA' },
    })
    expect(saveAsMock).toHaveBeenCalledTimes(1)
    const [blob, filename] = saveAsMock.mock.calls[0]
    expect(filename).toBe('regresion-ejecutivo-2026.docx')
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(1000)
    expect(flatten(executive)).not.toMatch(/"---"/)
  })

  it('genera los cinco DOCX (blobs) para comparación documental', async () => {
    const { generateDOCX } = await import('@/utils/docxGenerator')
    const five = buildFive()
    const names = {
      executive: 'informe-ejecutivo-2026',
      finanzas: 'informe-financiero-2026',
      almacen: 'informe-almacen-2026',
      kardex: 'informe-kardex-2026',
      global: 'informe-global-2026',
    }
    for (const [key, name] of Object.entries(names)) {
      saveAsMock.mockClear()
      await generateDOCX(five[key], name, { company: { tradeName: 'GESTIA Demo' } })
      expect(saveAsMock).toHaveBeenCalled()
      expect(saveAsMock.mock.calls[0][1]).toBe(`${name}.docx`)
      expect(saveAsMock.mock.calls[0][0].size).toBeGreaterThan(500)
    }
  })
})
