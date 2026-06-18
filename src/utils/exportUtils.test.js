import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { sanitizeCellValue } from './exportUtils'

describe('sanitizeCellValue — inyección de fórmulas en Excel (P2.1)', () => {
  it('escapa valores de texto que empiezan con un carácter de fórmula', () => {
    expect(sanitizeCellValue('=1+1')).toBe("'=1+1")
    expect(sanitizeCellValue('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)")
    expect(sanitizeCellValue('@SUM(1)')).toBe("'@SUM(1)")
    expect(sanitizeCellValue('+CMD')).toBe("'+CMD")
    expect(sanitizeCellValue('-cmd|calc')).toBe("'-cmd|calc")
  })

  it('no altera texto normal, vacíos, números ni importes negativos en string', () => {
    expect(sanitizeCellValue('Pago de luz')).toBe('Pago de luz')
    expect(sanitizeCellValue('')).toBe('')
    expect(sanitizeCellValue(25)).toBe(25)
    expect(sanitizeCellValue(null)).toBe(null)
    expect(sanitizeCellValue(undefined)).toBe(undefined)
    // importes negativos legítimos como string: se conservan (no se rompe el número)
    expect(sanitizeCellValue('-25.50')).toBe('-25.50')
    expect(sanitizeCellValue('+33')).toBe('+33')
  })

  it('el valor escapado llega a la celda como texto, no como fórmula', () => {
    const ws = XLSX.utils.json_to_sheet([
      { Descripcion: sanitizeCellValue('=HYPERLINK("http://evil")') }
    ])
    expect(ws.A2.v).toBe('\'=HYPERLINK("http://evil")')
    expect(ws.A2.t).toBe('s') // 's' = string; nunca debe ser una fórmula
    expect(ws.A2.f).toBeUndefined()
  })
})
