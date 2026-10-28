import { Type, Hash, List, Palette, Calendar, ToggleLeft, AlignLeft } from 'lucide-react'

export function toLabelFromName(name) {
  const s = String(name || '').trim()
  if (!s) return ''
  const normalized = s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  return normalized.slice(0, 1).toUpperCase() + normalized.slice(1)
}

export function placeholderForType(type) {
  if (type === 'number') return 'Ingresa el valor numérico'
  if (type === 'select') return 'Selecciona una opción'
  if (type === 'date') return 'Selecciona una fecha'
  if (type === 'color') return 'Selecciona un color'
  if (type === 'textarea') return 'Escribe tu respuesta'
  return 'Escribe tu respuesta'
}

export function parseOptionsCsv(text) {
  const raw = String(text || '')
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean)
  const seen = new Set()
  const out = []
  for (const p of parts) {
    const key = p.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

export function optionsToCsv(options) {
  if (!Array.isArray(options)) return ''
  return options.map(o => String(o).trim()).filter(Boolean).join(', ')
}

export function arrayMove(list, fromIndex, toIndex) {
  const arr = [...list]
  if (fromIndex < 0 || fromIndex >= arr.length) return arr
  if (toIndex < 0 || toIndex >= arr.length) return arr
  const [item] = arr.splice(fromIndex, 1)
  arr.splice(toIndex, 0, item)
  return arr
}

/** Guías de “qué tipo de pregunta” en lenguaje de negocio (no de formularios). */
export const FIELD_TYPE_GUIDES = [
  {
    value: 'text',
    label: 'Texto corto',
    example: 'Nombre, marca, modelo…',
    Icon: Type
  },
  {
    value: 'number',
    label: 'Cantidad o número',
    example: '12 unidades, 3 litros…',
    Icon: Hash
  },
  {
    value: 'select',
    label: 'Elegir de una lista',
    example: 'Nuevo / Usado / Dañado',
    Icon: List
  },
  {
    value: 'date',
    label: 'Fecha',
    example: 'Compra, vencimiento…',
    Icon: Calendar
  },
  {
    value: 'boolean',
    label: 'Sí o no',
    example: '¿Está operativo?',
    Icon: ToggleLeft
  },
  {
    value: 'textarea',
    label: 'Notas largas',
    example: 'Descripción, observaciones…',
    Icon: AlignLeft
  },
  {
    value: 'color',
    label: 'Color',
    example: 'Para identificar a simple vista',
    Icon: Palette
  }
]

/**
 * Plantillas listas para un negocio no técnico.
 * Cada campo: { name, type, required, options? }
 */
export const FORM_STARTERS = [
  {
    id: 'esencial',
    title: 'Lo esencial',
    description: 'Nombre y cantidad. Ideal para empezar ya.',
    fields: [
      { name: 'Nombre', type: 'text', required: true },
      { name: 'Cantidad', type: 'number', required: true }
    ]
  },
  {
    id: 'cocina',
    title: 'Cocina / insumos',
    description: 'Nombre, cantidad y unidad (kg, litros…).',
    fields: [
      { name: 'Nombre', type: 'text', required: true },
      { name: 'Cantidad', type: 'number', required: true },
      { name: 'Unidad', type: 'select', required: false, options: ['unidades', 'kg', 'litros', 'paquetes'] }
    ]
  },
  {
    id: 'equipos',
    title: 'Equipos / herramientas',
    description: 'Nombre, marca y si está operativo.',
    fields: [
      { name: 'Nombre', type: 'text', required: true },
      { name: 'Marca', type: 'text', required: false },
      { name: 'Estado', type: 'select', required: true, options: ['Operativo', 'En reparación', 'Fuera de servicio'] },
      { name: 'Notas', type: 'textarea', required: false }
    ]
  },
  {
    id: 'stock',
    title: 'Productos en stock',
    description: 'Nombre, cantidad, ubicación y vencimiento.',
    fields: [
      { name: 'Nombre', type: 'text', required: true },
      { name: 'Cantidad', type: 'number', required: true },
      { name: 'Ubicación', type: 'text', required: false },
      { name: 'Vence', type: 'date', required: false }
    ]
  }
]
