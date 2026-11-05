/**
 * Fixtures compartidos para suites baseline (pre-E1) y E1 (esperado).
 * Escenarios: USD/CUP, pagos parciales/pendientes, gastos multi-moneda, UDM distintas.
 */

export const dateFilter = { label: 'Enero 2026' }

/** Transacciones multi-moneda con pendientes y parciales. */
export const multiCurrencyTransactions = [
  { type: 'income', amount: 1000, currency: 'USD', category: 'Ventas', status: 'paid', paid_amount: 1000, date: '2026-01-05', details: { payment_method: 'Efectivo' } },
  { type: 'income', amount: 500, currency: 'USD', category: 'Servicios', status: 'partial', paid_amount: 200, date: '2026-01-06', details: { payment_method: 'Transferencia Bancaria' } },
  { type: 'income', amount: 300, currency: 'USD', category: 'Ventas', status: 'pending', paid_amount: 0, date: '2026-01-07' },
  { type: 'expense', amount: 100, currency: 'USD', category: 'Alquiler', status: 'paid', paid_amount: 100, date: '2026-01-08', details: { payment_method: 'Efectivo' }, description: 'Local' },
  { type: 'expense', amount: 50, currency: 'USD', category: 'Servicios', status: 'paid', paid_amount: 50, date: '2026-01-09', details: { payment_method: 'Efectivo' }, description: 'Luz' },
  { type: 'income', amount: 20000, currency: 'CUP', category: 'Ventas', status: 'paid', paid_amount: 20000, date: '2026-01-10' },
  { type: 'expense', amount: 5000, currency: 'CUP', category: 'Nómina', status: 'paid', paid_amount: 5000, date: '2026-01-11', details: { payment_method: 'Efectivo' }, description: 'Sueldos' },
  { type: 'expense', amount: 800, currency: 'CUP', category: 'Insumos', status: 'pending', paid_amount: 0, date: '2026-01-12', details: { payment_method: 'Efectivo' }, description: 'Pedido abierto' },
]

/** Gastos donde un monto CUP numéricamente “gana” a un USD si se ordena sin separar monedas. */
export const crossCurrencyExpenses = [
  { type: 'expense', amount: 10, currency: 'USD', category: 'Software', status: 'paid', paid_amount: 10, date: '2026-01-01', details: { payment_method: 'Tarjeta' }, description: 'SaaS' },
  { type: 'expense', amount: 500, currency: 'CUP', category: 'Transporte', status: 'paid', paid_amount: 500, date: '2026-01-02', details: { payment_method: 'Efectivo' }, description: 'Taxi' },
  { type: 'income', amount: 100, currency: 'USD', category: 'Ventas', status: 'paid', paid_amount: 100, date: '2026-01-03' },
]

/** Movimientos de productos con unidades distintas (no sumables). */
export const mixedUomMovements = [
  { type: 'in', qty: 10, products: { name: 'Café 500g', unit: 'paquete' } },
  { type: 'out', qty: 3, products: { name: 'Café 500g', unit: 'paquete' } },
  { type: 'in', qty: 20, products: { name: 'Aceite', unit: 'litro' } },
  { type: 'out', qty: 5, products: { name: 'Aceite', unit: 'litro' } },
  { type: 'in', qty: 100, products: { name: 'Tornillos', unit: 'unidad' } },
]

/** Movimientos sin unit_cost (histórico incompleto para valoración). */
export const incompleteCostMovements = [
  { type: 'in', qty: 5, unit_cost: null, products: { name: 'Producto legacy', avg_cost: 0 } },
  { type: 'out', qty: 2, unit_cost: null, products: { name: 'Producto legacy', avg_cost: 0 } },
]
