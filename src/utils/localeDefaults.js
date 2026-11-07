/**
 * Preferencias regionales del dispositivo (navegador / SO).
 * No inventar Havana ni otros defaults de negocio: la fuente de verdad
 * es Intl del cliente.
 */

export function getClientTimeZone() {
  try {
    const tz = Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone
    if (tz && typeof tz === 'string') return tz
  } catch {
    /* ignore */
  }
  return 'UTC'
}

/**
 * Formato de fecha alineado a las opciones de la UI.
 * @returns {'DD/MM/AAAA'|'MM/DD/AAAA'|'AAAA-MM-DD'}
 */
export function getClientDateFormat() {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(2024, 0, 15))
    const order = parts
      .filter((p) => p.type === 'year' || p.type === 'month' || p.type === 'day')
      .map((p) => p.type)
    if (order[0] === 'year') return 'AAAA-MM-DD'
    if (order[0] === 'month') return 'MM/DD/AAAA'
    return 'DD/MM/AAAA'
  } catch {
    return 'DD/MM/AAAA'
  }
}

/** Locale BCP-47 del navegador (p. ej. en-US, es-ES). */
export function getClientLocale() {
  try {
    return Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.locale || navigator?.language || 'es-ES'
  } catch {
    return navigator?.language || 'es-ES'
  }
}

/**
 * Formato numérico entre las opciones de la UI (punto vs coma decimal).
 * @returns {'en-US'|'es-ES'}
 */
export function getClientNumberFormat() {
  try {
    const sample = new Intl.NumberFormat(undefined, {
      style: 'decimal',
      minimumFractionDigits: 2,
    }).format(1000)
    // en-US → "1,000.00"; es-ES → "1.000,00"
    if (sample.includes(',') && sample.indexOf(',') < sample.indexOf('.')) return 'en-US'
    if (sample.includes('.') && sample.indexOf('.') < sample.indexOf(',')) return 'es-ES'
    // Sin ambos separadores: mirar el decimal
    if (/,/.test(sample) && !/\./.test(sample)) return 'es-ES'
    return 'en-US'
  } catch {
    return 'es-ES'
  }
}

export function getClientRegionDefaults() {
  return {
    dateFormat: getClientDateFormat(),
    timeZone: getClientTimeZone(),
    numberFormat: getClientNumberFormat(),
  }
}
