import {
  Type, Hash, List, Palette, Calendar, ToggleLeft, AlignLeft,
  Package, Banknote, Barcode, Hash as SerialIcon, User, MapPin, Image
} from 'lucide-react'

export function toLabelFromName(name) {
  const s = String(name || '').trim()
  if (!s) return ''
  const normalized = s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  return normalized.slice(0, 1).toUpperCase() + normalized.slice(1)
}

export function placeholderForType(type) {
  if (type === 'number' || type === 'quantity_uom') return 'Ingresa la cantidad'
  if (type === 'currency') return '0.00'
  if (type === 'select') return 'Selecciona una opción'
  if (type === 'date') return 'Selecciona una fecha'
  if (type === 'color') return 'Selecciona un color'
  if (type === 'textarea') return 'Escribe tu respuesta'
  if (type === 'barcode') return 'Código de barras'
  if (type === 'serial') return 'Número de serie'
  if (type === 'person_text') return 'Nombre de la persona'
  if (type === 'location_text') return 'Ubicación (oficina, sala…)'
  if (type === 'photo_url') return 'URL de la foto'
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
  { value: 'text', label: 'Texto corto', example: 'Nombre, marca, modelo…', Icon: Type },
  { value: 'number', label: 'Cantidad o número', example: '12 unidades, 3 litros…', Icon: Hash },
  { value: 'quantity_uom', label: 'Cantidad con unidad', example: '12 kg, 4 cajas…', Icon: Package },
  { value: 'currency', label: 'Dinero / coste', example: '1.250,00', Icon: Banknote },
  { value: 'select', label: 'Elegir de una lista', example: 'Nuevo / Usado / Dañado', Icon: List },
  { value: 'date', label: 'Fecha', example: 'Compra, vencimiento…', Icon: Calendar },
  { value: 'boolean', label: 'Sí o no', example: '¿Está operativo?', Icon: ToggleLeft },
  { value: 'textarea', label: 'Notas largas', example: 'Descripción, observaciones…', Icon: AlignLeft },
  { value: 'barcode', label: 'Código de barras', example: 'EAN / interno', Icon: Barcode },
  { value: 'serial', label: 'Número de serie', example: 'Equipo individual', Icon: SerialIcon },
  { value: 'person_text', label: 'Persona / custodio', example: 'Quién lo tiene', Icon: User },
  { value: 'location_text', label: 'Ubicación', example: 'Oficina, sala 2…', Icon: MapPin },
  { value: 'photo_url', label: 'Foto (URL)', example: 'Enlace a imagen', Icon: Image },
  { value: 'color', label: 'Color', example: 'Para identificar a simple vista', Icon: Palette }
]

export const DOMAIN_LABELS = {
  merchandise: 'Mercancía',
  supplies: 'Suministros',
  fixed_asset: 'Activos',
  tool: 'Herramientas',
  custom: 'Personalizado'
}

/** Etiquetas en español para claves semánticas internas (nunca mostrar la clave cruda). */
export const SEMANTIC_LABELS = {
  name: 'Nombre',
  quantity: 'Cantidad',
  location: 'Ubicación',
  min_qty: 'Mínimo',
  date_expiry: 'Vencimiento',
  uom: 'Unidad',
  serial: 'Serie',
  custodian: 'Custodio',
  status: 'Estado',
  date_acquired: 'Adquisición',
  currency: 'Coste'
}

export function semanticLabel(semantic) {
  if (!semantic) return ''
  return SEMANTIC_LABELS[semantic] || String(semantic).replace(/_/g, ' ')
}

export const ORIGIN_LABELS = {
  system: 'Sistema',
  template: 'Plantilla',
  custom: 'Propio'
}

/**
 * Plantillas profesionales GESTIA (Fase 1).
 * Cada campo: { name, type, required, options?, origin?, semantic? }
 */
export const GESTIA_TEMPLATES = [
  {
    id: 'merchandise_basic',
    domain_type: 'merchandise',
    title: 'Mercancía / existencias',
    description: 'Listas de insumos o mercancía (sin venta/costo). Si vas a vender con costo, mejor usa Almacén.',
    warehouseCta: true,
    fields: [
      { name: 'Nombre', type: 'text', required: true, origin: 'system', semantic: 'name' },
      { name: 'Cantidad', type: 'quantity_uom', required: true, origin: 'system', semantic: 'quantity' },
      { name: 'Ubicación', type: 'location_text', required: false, origin: 'template', semantic: 'location' },
      { name: 'Mínimo', type: 'number', required: false, origin: 'template', semantic: 'min_qty' },
      { name: 'Vence', type: 'date', required: false, origin: 'template', semantic: 'date_expiry' }
    ]
  },
  {
    id: 'supplies',
    domain_type: 'supplies',
    title: 'Suministros',
    description: 'Papel, detergente, consumibles del día a día.',
    fields: [
      { name: 'Nombre', type: 'text', required: true, origin: 'system', semantic: 'name' },
      { name: 'Cantidad', type: 'quantity_uom', required: true, origin: 'system', semantic: 'quantity' },
      { name: 'Unidad', type: 'select', required: false, origin: 'template', semantic: 'uom', options: ['unidades', 'kg', 'litros', 'paquetes'] },
      { name: 'Ubicación', type: 'location_text', required: false, origin: 'template', semantic: 'location' }
    ]
  },
  {
    id: 'assets_equipment',
    domain_type: 'fixed_asset',
    title: 'Activos y equipos',
    description: 'Aire, computadoras, mobiliario: custodio, estado y ubicación.',
    fields: [
      { name: 'Nombre', type: 'text', required: true, origin: 'system', semantic: 'name' },
      { name: 'Serie', type: 'serial', required: false, origin: 'template', semantic: 'serial' },
      { name: 'Ubicación', type: 'location_text', required: true, origin: 'system', semantic: 'location' },
      { name: 'Custodio', type: 'person_text', required: false, origin: 'template', semantic: 'custodian' },
      { name: 'Estado', type: 'select', required: true, origin: 'system', semantic: 'status', options: ['Operativo', 'En reparación', 'Asignado', 'Baja'] },
      { name: 'Fecha adquisición', type: 'date', required: false, origin: 'template', semantic: 'date_acquired' },
      { name: 'Coste', type: 'currency', required: false, origin: 'template', semantic: 'currency' },
      { name: 'Notas', type: 'textarea', required: false, origin: 'template' },
      { name: 'Foto', type: 'photo_url', required: false, origin: 'template' }
    ]
  },
  {
    id: 'tools',
    domain_type: 'tool',
    title: 'Herramientas',
    description: 'Taladros, cámaras y equipo controlable.',
    fields: [
      { name: 'Nombre', type: 'text', required: true, origin: 'system', semantic: 'name' },
      { name: 'Serie', type: 'serial', required: false, origin: 'template', semantic: 'serial' },
      { name: 'Custodio', type: 'person_text', required: false, origin: 'template', semantic: 'custodian' },
      { name: 'Estado', type: 'select', required: true, origin: 'system', semantic: 'status', options: ['Operativo', 'En reparación', 'Asignado', 'Baja'] },
      { name: 'Ubicación', type: 'location_text', required: false, origin: 'template', semantic: 'location' }
    ]
  },
  {
    id: 'custom_blank',
    domain_type: 'custom',
    title: 'Crear desde cero',
    description: 'Área vacía: tú defines todas las preguntas.',
    fields: []
  }
]

/** Compat: starters antiguos → redirigen al catálogo nuevo */
export const FORM_STARTERS = GESTIA_TEMPLATES.filter((t) => t.id !== 'custom_blank').map((t) => ({
  id: t.id,
  title: t.title,
  description: t.description,
  fields: t.fields
}))

export function getTemplateById(id) {
  return GESTIA_TEMPLATES.find((t) => t.id === id) || null
}

export function isStockLikeDomain(domainType) {
  return domainType === 'merchandise' || domainType === 'supplies'
}

export function isAssetLikeDomain(domainType) {
  return domainType === 'fixed_asset' || domainType === 'tool'
}

export function fieldIsLocked(field) {
  return field?.origin === 'system' || field?.origin === 'template'
}

/** Valida valores contra campos (cliente). */
export function validateSemanticValues(values, fields) {
  const missing = []
  const invalid = []
  for (const f of fields || []) {
    const v = values?.[f.name]
    const empty = v === undefined || v === null || v === ''
    if (f.required && empty) missing.push(f.name)
    if (!empty && (f.type === 'number' || f.type === 'quantity_uom' || f.type === 'currency')) {
      const n = Number(v)
      if (!Number.isFinite(n) || n < 0) invalid.push(f.name)
      if ((f.type === 'number' || f.type === 'quantity_uom') && f.required && n < 1 && f.semantic === 'quantity') {
        // cantidad requerida mínima 1 (alineado a validateValuesAgainstFields histórico)
        if (n < 1) invalid.push(f.name)
      }
    }
  }
  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid }
}
