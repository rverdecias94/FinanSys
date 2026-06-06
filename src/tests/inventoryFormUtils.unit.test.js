import { describe, it, expect } from 'vitest'
import { arrayMove, optionsToCsv, parseOptionsCsv, placeholderForType, toLabelFromName } from '@/utils/inventoryFormUtils'

describe('inventoryFormUtils', () => {
  it('toLabelFromName normaliza guiones y underscores', () => {
    expect(toLabelFromName('tipo_de-detergente')).toBe('Tipo de detergente')
  })

  it('placeholderForType devuelve placeholders genéricos', () => {
    expect(placeholderForType('number')).toBe('Ingresa el valor numérico')
    expect(placeholderForType('select')).toBe('Selecciona una opción')
    expect(placeholderForType('text')).toBe('Escribe tu respuesta')
  })

  it('parseOptionsCsv divide por comas, hace trim y elimina vacíos/duplicados', () => {
    expect(parseOptionsCsv('  Op1, op2, , OP1 , op3  ')).toEqual(['Op1', 'op2', 'op3'])
  })

  it('optionsToCsv convierte array a CSV legible', () => {
    expect(optionsToCsv(['a', 'b', 'c'])).toBe('a, b, c')
  })

  it('arrayMove mueve elementos dentro de la lista', () => {
    expect(arrayMove(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(arrayMove(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })
})

