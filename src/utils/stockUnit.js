/** Unidad de trabajo del producto (stock, costo y precio = misma cosa). */

export const STOCK_UNITS = [
  { value: 'unit', label: 'Unidad / pieza', short: 'unidad' },
  { value: 'box', label: 'Caja', short: 'caja' },
]

export function normalizeStockUnit(value) {
  return value === 'box' ? 'box' : 'unit'
}

export function stockUnitShort(value) {
  return normalizeStockUnit(value) === 'box' ? 'caja' : 'unidad'
}

export function stockUnitPlural(value) {
  return normalizeStockUnit(value) === 'box' ? 'cajas' : 'unidades'
}

export function stockUnitLabel(value) {
  return normalizeStockUnit(value) === 'box' ? 'caja' : 'unidad / pieza'
}

/** Precio/costo por unidad suelta cuando el producto se cuenta por caja. */
export function perPieceFromBox(amount, unitsPerBox) {
  const a = Number(amount)
  const n = Number(unitsPerBox)
  if (!Number.isFinite(a) || !Number.isFinite(n) || n <= 0) return null
  return Math.round((a / n) * 100) / 100
}

export function normalizeUnitsPerBox(stockUnit, raw) {
  if (normalizeStockUnit(stockUnit) !== 'box') return null
  if (raw === '' || raw == null) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}
