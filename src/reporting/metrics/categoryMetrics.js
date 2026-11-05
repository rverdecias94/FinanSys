/**
 * E2 — Agregaciones por categoría, siempre dentro de una moneda.
 */
import { isCashFlowType, isTransferType, toNum } from './cashRules'

/**
 * @returns {Record<string, Array<{ category: string, amount: number }>>}
 *   mapa currency → categorías ordenadas desc por amount
 */
export function expensesByCategoryPerCurrency(transactions = [], { topN = null } = {}) {
  const byCur = {}
  for (const tx of transactions || []) {
    if (tx?.type !== 'expense' || isTransferType(tx.type)) continue
    const cur = tx.currency || 'USD'
    const cat = tx.category || 'Sin categoría'
    if (!byCur[cur]) byCur[cur] = {}
    byCur[cur][cat] = (byCur[cur][cat] || 0) + toNum(tx.amount)
  }
  const out = {}
  for (const [cur, cats] of Object.entries(byCur)) {
    let rows = Object.entries(cats)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    if (topN != null) rows = rows.slice(0, topN)
    out[cur] = rows
  }
  return out
}

export function incomeByCategoryPerCurrency(transactions = [], { topN = null } = {}) {
  const byCur = {}
  for (const tx of transactions || []) {
    if (tx?.type !== 'income' || isTransferType(tx.type)) continue
    const cur = tx.currency || 'USD'
    const cat = tx.category || 'Sin categoría'
    if (!byCur[cur]) byCur[cur] = {}
    byCur[cur][cat] = (byCur[cur][cat] || 0) + toNum(tx.amount)
  }
  const out = {}
  for (const [cur, cats] of Object.entries(byCur)) {
    let rows = Object.entries(cats)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    if (topN != null) rows = rows.slice(0, topN)
    out[cur] = rows
  }
  return out
}

/** Top N gastos por moneda como filas planas para tablas/export. */
export function topExpensesRowsPerCurrency(transactions = [], topN = 5) {
  const byCur = expensesByCategoryPerCurrency(transactions, { topN })
  const rows = []
  for (const currency of Object.keys(byCur).sort()) {
    for (const { category, amount } of byCur[currency]) {
      rows.push({ currency, category, amount })
    }
  }
  return rows
}

export function recordedTotalsIgnoreTransfers(transactions = []) {
  const income = {}
  const expense = {}
  for (const tx of transactions || []) {
    if (!isCashFlowType(tx?.type) || isTransferType(tx?.type)) continue
    const cur = tx.currency || 'USD'
    const bucket = tx.type === 'income' ? income : expense
    bucket[cur] = (bucket[cur] || 0) + toNum(tx.amount)
  }
  return { income, expense }
}
