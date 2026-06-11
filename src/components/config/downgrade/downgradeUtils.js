export function clampNonNegativeInt(v, fallback) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.trunc(n))
}

export function formatCurrencyLabel(c) {
  const code = c?.code || c?.currency_code || ''
  const name = c?.name || ''
  return name ? `${code} — ${name}` : code
}

