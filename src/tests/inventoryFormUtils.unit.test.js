import { describe, it, expect } from 'vitest'
import {
  arrayMove,
  optionsToCsv,
  parseOptionsCsv,
  placeholderForType,
  toLabelFromName,
  GESTIA_TEMPLATES,
  getTemplateById,
  fieldIsLocked,
  isStockLikeDomain,
  isAssetLikeDomain,
  validateSemanticValues,
  semanticLabel
} from '@/utils/inventoryFormUtils'

describe('inventoryFormUtils', () => {
  it('toLabelFromName normaliza guiones y underscores', () => {
    expect(toLabelFromName('tipo_de-detergente')).toBe('Tipo de detergente')
  })

  it('placeholderForType devuelve placeholders por tipo', () => {
    expect(placeholderForType('number')).toBe('Ingresa la cantidad')
    expect(placeholderForType('quantity_uom')).toBe('Ingresa la cantidad')
    expect(placeholderForType('select')).toBe('Selecciona una opción')
    expect(placeholderForType('serial')).toBe('Número de serie')
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

  it('GESTIA_TEMPLATES cubre los dominios del plan', () => {
    const ids = GESTIA_TEMPLATES.map((t) => t.id)
    expect(ids).toEqual(expect.arrayContaining([
      'merchandise_basic',
      'supplies',
      'assets_equipment',
      'tools',
      'custom_blank'
    ]))
    const assets = getTemplateById('assets_equipment')
    expect(assets.domain_type).toBe('fixed_asset')
    expect(assets.fields.some((f) => f.semantic === 'status')).toBe(true)
    expect(assets.fields.every((f) => f.origin === 'system' || f.origin === 'template')).toBe(true)
  })

  it('fieldIsLocked protege system/template', () => {
    expect(fieldIsLocked({ origin: 'system' })).toBe(true)
    expect(fieldIsLocked({ origin: 'template' })).toBe(true)
    expect(fieldIsLocked({ origin: 'custom' })).toBe(false)
  })

  it('helpers de dominio', () => {
    expect(isStockLikeDomain('merchandise')).toBe(true)
    expect(isStockLikeDomain('supplies')).toBe(true)
    expect(isAssetLikeDomain('fixed_asset')).toBe(true)
    expect(isAssetLikeDomain('tool')).toBe(true)
    expect(isAssetLikeDomain('custom')).toBe(false)
  })

  it('validateSemanticValues exige requeridos y números válidos', () => {
    const fields = [
      { name: 'Nombre', required: true, type: 'text' },
      { name: 'Cantidad', required: true, type: 'quantity_uom', semantic: 'quantity' }
    ]
    expect(validateSemanticValues({}, fields).ok).toBe(false)
    expect(validateSemanticValues({ Nombre: 'X', Cantidad: 0 }, fields).ok).toBe(false)
    expect(validateSemanticValues({ Nombre: 'X', Cantidad: 2 }, fields).ok).toBe(true)
  })

  it('semanticLabel traduce claves internas al español', () => {
    expect(semanticLabel('currency')).toBe('Coste')
    expect(semanticLabel('date_acquired')).toBe('Adquisición')
    expect(semanticLabel('custodian')).toBe('Custodio')
    expect(semanticLabel('status')).toBe('Estado')
  })
})
