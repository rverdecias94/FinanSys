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

