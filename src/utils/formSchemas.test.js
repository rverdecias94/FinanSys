import { describe, it, expect } from 'vitest'
import { validateForm, productSchema, movementSchema, contactSchema, areaSchema, roleSchema, emailSchema } from './formSchemas'

describe('validateForm + esquemas', () => {
  describe('productSchema', () => {
    const valid = { name: 'Caja', category: 'General', unit_price: '10.50', currency: 'USD', stock: '5', min_stock: '2' }

    it('acepta un producto válido', () => {
      expect(validateForm(productSchema, valid).success).toBe(true)
    })

    it('rechaza nombre vacío', () => {
      const r = validateForm(productSchema, { ...valid, name: '   ' })
      expect(r.success).toBe(false)
      expect(r.errors.name).toBeTruthy()
    })

    it('rechaza precio no numérico o negativo', () => {
      expect(validateForm(productSchema, { ...valid, unit_price: 'abc' }).errors.unit_price).toBeTruthy()
      expect(validateForm(productSchema, { ...valid, unit_price: '-5' }).errors.unit_price).toBeTruthy()
    })

    it('rechaza stock no entero', () => {
      expect(validateForm(productSchema, { ...valid, stock: '2.5' }).errors.stock).toBeTruthy()
      expect(validateForm(productSchema, { ...valid, stock: '' }).errors.stock).toBeTruthy()
    })
  })

  describe('movementSchema', () => {
    it('acepta un movimiento válido', () => {
      expect(validateForm(movementSchema, { product_id: 'p1', type: 'in', qty: '3' }).success).toBe(true)
    })
    it('rechaza cantidad 0 o vacía y producto sin elegir', () => {
      expect(validateForm(movementSchema, { product_id: 'p1', type: 'in', qty: '0' }).errors.qty).toBeTruthy()
      expect(validateForm(movementSchema, { product_id: '', type: 'in', qty: '1' }).errors.product_id).toBeTruthy()
    })
  })

  describe('contactSchema', () => {
    const valid = { name: 'ACME', kind: 'cliente', phone: '', email: '', notes: '' }
    it('acepta contacto mínimo válido', () => {
      expect(validateForm(contactSchema, valid).success).toBe(true)
    })
    it('rechaza email con formato inválido', () => {
      expect(validateForm(contactSchema, { ...valid, email: 'no-es-email' }).errors.email).toBeTruthy()
    })
    it('acepta email y teléfono válidos', () => {
      expect(validateForm(contactSchema, { ...valid, email: 'a@b.com', phone: '+1 555 1234' }).success).toBe(true)
    })
  })

  describe('areaSchema', () => {
    const valid = { name: 'Almacén B', icon: 'Home', slug: '', prefix: '' }
    it('acepta área mínima válida', () => {
      expect(validateForm(areaSchema, valid).success).toBe(true)
    })
    it('rechaza nombre vacío e icono sin elegir', () => {
      expect(validateForm(areaSchema, { ...valid, name: '  ' }).errors.name).toBeTruthy()
      expect(validateForm(areaSchema, { ...valid, icon: '' }).errors.icon).toBeTruthy()
    })
    it('valida formato de slug y prefijo', () => {
      expect(validateForm(areaSchema, { ...valid, slug: 'Con Mayús' }).errors.slug).toBeTruthy()
      expect(validateForm(areaSchema, { ...valid, prefix: 'AB' }).errors.prefix).toBeTruthy()
      expect(validateForm(areaSchema, { ...valid, slug: 'cocina-1', prefix: 'ADM' }).success).toBe(true)
    })
  })

  describe('roleSchema', () => {
    it('acepta rol válido y rechaza nombre vacío', () => {
      expect(validateForm(roleSchema, { name: 'Contador', description: '' }).success).toBe(true)
      expect(validateForm(roleSchema, { name: '', description: '' }).errors.name).toBeTruthy()
    })
  })

  describe('emailSchema', () => {
    it('acepta email válido', () => {
      expect(validateForm(emailSchema, { email: 'user@dominio.com' }).success).toBe(true)
    })
    it('rechaza email vacío o con formato inválido', () => {
      expect(validateForm(emailSchema, { email: '' }).errors.email).toBeTruthy()
      expect(validateForm(emailSchema, { email: 'no-es-email' }).errors.email).toBeTruthy()
    })
  })
})
