import {
  generateFinanceReport,
} from '@/utils/narrativeGenerator'
import { buildRecordedCashFlow } from '@/reporting/metrics/cashMetrics'
import {
  createReportDocument,
  fromLegacyNarrative,
  REPORT_TYPES,
  DEFAULT_DISCLAIMER,
} from '@/reporting/documentModel'

/**
 * Informe financiero de gestión — base de registros operacionales.
 * Reutiliza generateFinanceReport (E1) y lo envuelve en ReportDocument.
 */
export function buildFinanceMgmtDocument({
  transactions = [],
  dateFilter = null,
  comparison = null,
  company = null,
  generatedBy = null,
} = {}) {
  const legacy = generateFinanceReport(transactions, dateFilter, comparison)
  const recorded = buildRecordedCashFlow(transactions)
  const kpis = recorded.map((r) => ({
    code: `recorded_net_${r.currency}`,
    label: `Flujo neto registrado (${r.currency})`,
    value: r.net,
    unit: 'money',
    currency: r.currency,
    sourceRefs: [],
  }))

  const warnings = []
  const hasPending = (transactions || []).some(
    (t) => t.status === 'pending' || t.status === 'partial'
  )
  if (hasPending) {
    warnings.push(
      'El período incluye cuentas pendientes o parciales: el flujo registrado no equivale a caja cobrada. Usa el panel «Liquidado» para abonos.'
    )
  }

  return fromLegacyNarrative(legacy, {
    type: REPORT_TYPES.FINANCE_MGMT,
    disclaimer: DEFAULT_DISCLAIMER,
    company,
    period: {
      from: dateFilter?.startDate ?? null,
      to: dateFilter?.endDate ?? null,
      label: dateFilter?.label ?? null,
    },
    generatedBy,
    criteria: { cashBasis: 'recorded', valuation: 'none', currencyMode: 'native' },
    filters: { modules: ['finanzas'] },
    kpis,
    warnings,
  })
}

export function buildFinanceMgmtDocumentFromScratch(args) {
  // Alias explícito: hoy delega en narrative; E3+ puede sustituir sin romper callers.
  return buildFinanceMgmtDocument(args)
}

// Re-export create for tests that assert shape
export { createReportDocument }
