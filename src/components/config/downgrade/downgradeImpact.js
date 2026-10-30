import { clampNonNegativeInt } from '@/components/config/downgrade/downgradeUtils'
import { isPaidPlanId, planLabel } from '@/lib/plans'

/** ¿Puede iniciar el asistente hacia Plan Inicial? */
export function canDowngradeToFree(planId) {
  return isPaidPlanId(planId)
}

export const FEATURE_LOSS_LABELS = {
  reports_export: 'Exportación avanzada de reportes (Excel/Word)',
  audit_logs: 'Auditoría de actividad',
  custom_branding: 'Marca personalizada en reportes',
  ai_tools: 'Copiloto IA, OCR y Radar de caja',
  watermark: null, // free lo activa; no es pérdida
}

/**
 * Construye la lista de impactos al bajar a Inicial.
 * No borra datos: solo describe restricciones / pérdidas de capacidad.
 */
export function buildDowngradeImpact({
  usage = {},
  freeLimits = {},
  featuresLost = [],
  activeCurrenciesCount = 0,
  areasCount = 0,
} = {}) {
  const currenciesLimit = clampNonNegativeInt(freeLimits.currencies, 1) || 1
  const areasLimit = clampNonNegativeInt(freeLimits.areas, 1)
  const txLimit = clampNonNegativeInt(freeLimits.monthly_transactions, 150)
  const productsLimit = clampNonNegativeInt(freeLimits.products, 50)
  const partnersLimit = clampNonNegativeInt(freeLimits.partners, 0)

  const activeCurrencies = clampNonNegativeInt(usage.active_currencies, activeCurrenciesCount)
  const areas = clampNonNegativeInt(usage.areas, areasCount)
  const partners = clampNonNegativeInt(usage.partners, 0)
  const products = clampNonNegativeInt(usage.products, 0)
  const monthlyTx = clampNonNegativeInt(usage.monthly_transactions, 0)

  const items = []

  // Monedas
  if (activeCurrencies > currenciesLimit) {
    items.push({
      id: 'currencies',
      title: 'Monedas',
      severity: 'restrict',
      detail: `Tienes ${activeCurrencies} monedas activas. En Inicial solo queda 1 activa; el resto se desactiva (no se borran datos históricos).`,
    })
  } else {
    items.push({
      id: 'currencies',
      title: 'Monedas',
      severity: 'ok',
      detail: `Conservarás tu moneda activa (límite Inicial: ${currenciesLimit}).`,
    })
  }

  // Equipo
  if (partners > partnersLimit) {
    items.push({
      id: 'partners',
      title: 'Equipo',
      severity: 'loss',
      detail: `${partners} miembro${partners === 1 ? '' : 's'} de equipo perderán acceso al negocio. Inicial no permite miembros adicionales.`,
    })
  } else {
    items.push({
      id: 'partners',
      title: 'Equipo',
      severity: 'ok',
      detail: 'No hay miembros adicionales afectados.',
    })
  }

  // Áreas
  if (areas > areasLimit) {
    items.push({
      id: 'areas',
      title: 'Áreas de inventario',
      severity: 'restrict',
      detail: `Tienes ${areas} áreas. Solo ${areasLimit} quedará${areasLimit === 1 ? '' : 'n'} editable${areasLimit === 1 ? '' : 's'}; las demás pasan a solo lectura (no se eliminan).`,
    })
  } else {
    items.push({
      id: 'areas',
      title: 'Áreas de inventario',
      severity: 'ok',
      detail: `Tus ${areas} área${areas === 1 ? '' : 's'} caben en el límite de Inicial (${areasLimit}).`,
    })
  }

  // Productos (no se borran; no podrás crear más si ya estás sobre el tope)
  if (products > productsLimit) {
    items.push({
      id: 'products',
      title: 'Productos',
      severity: 'restrict',
      detail: `Tienes ${products} productos (tope Inicial: ${productsLimit}). No se borran, pero no podrás crear nuevos hasta bajar de ${productsLimit}.`,
    })
  } else {
    items.push({
      id: 'products',
      title: 'Productos',
      severity: 'ok',
      detail: `Uso actual ${products} / ${productsLimit} permitidos en Inicial.`,
    })
  }

  // Transacciones del mes
  if (monthlyTx >= txLimit) {
    items.push({
      id: 'monthly_transactions',
      title: 'Transacciones del mes',
      severity: 'restrict',
      detail: `Ya llevas ${monthlyTx} este mes (tope Inicial: ${txLimit}). No podrás registrar nuevas hasta el próximo periodo o mejorar el plan.`,
    })
  } else {
    items.push({
      id: 'monthly_transactions',
      title: 'Transacciones del mes',
      severity: 'ok',
      detail: `Uso actual ${monthlyTx} / ${txLimit} en Inicial.`,
    })
  }

  // Funciones
  const lostLabels = (featuresLost || [])
    .map((k) => FEATURE_LOSS_LABELS[k] ?? (k === 'ai_tools' ? FEATURE_LOSS_LABELS.ai_tools : null))
    .filter(Boolean)

  // Siempre mencionar IA si viene de un plan de pago (aunque el RPC no lo liste)
  const hasAiLoss = lostLabels.some((l) => /Copiloto|OCR|Radar/i.test(l))
    || (featuresLost || []).includes('ai_tools')

  if (lostLabels.length || hasAiLoss) {
    const unique = [...new Set(lostLabels.length ? lostLabels : [FEATURE_LOSS_LABELS.ai_tools])]
    items.push({
      id: 'features',
      title: 'Funciones que pierdes',
      severity: 'loss',
      detail: unique.join(' · '),
      badges: unique,
    })
  } else {
    items.push({
      id: 'features',
      title: 'Funciones',
      severity: 'ok',
      detail: 'Sin funciones premium adicionales detectadas a desactivar.',
    })
  }

  return {
    currentPlanLabel: null,
    items,
    hasBlockingLosses: items.some((i) => i.severity === 'loss' || i.severity === 'restrict'),
    lossesCount: items.filter((i) => i.severity === 'loss' || i.severity === 'restrict').length,
  }
}

export function downgradePlanBadgeLabel(planId) {
  return planLabel(planId)
}
