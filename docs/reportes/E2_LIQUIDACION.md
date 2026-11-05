# E2 — Reglas de liquidación (recorded vs settled)

Contrato del motor en `src/reporting/metrics/`. Sin migraciones. `paid_amount` es **caché** (= SUM de `account_payments` cuando hay ledger); no es una segunda fuente de caja.

## Clasificación de una transacción

| Estado / situación | Significado | ¿Cuenta en flujo registrado? | ¿Cuenta en flujo liquidado? |
|---|---|---|---|
| Cualquier fila `income`/`expense` en el período (`date`) | Operación **registrada** | Sí (`amount` completo) | Solo la parte efectivamente liquidada (ver abajo) |
| `status = pending`, `paid_amount = 0` | Pendiente total | Sí | No |
| `status = partial` | Parcialmente liquidada | Sí (`amount`) | Abonos en `account_payments` con `paid_at` en el período |
| `status = paid` con filas en `account_payments` | Liquidada vía crédito/abonos | Sí | Solo abonos con `paid_at` en el período |
| `status = paid`, `paid_amount = amount`, **sin** filas en ledger | Alta **al contado** (S2: no pasa por RPC) | Sí | Sí, por `transactions.date` = monto completo |
| `type = transfer` | No es ingreso/gasto | No | No |
| Método «Transferencia Bancaria» | Solo método de pago | — | No cambia la regla; el movimiento sigue siendo income/expense |

## Anti doble conteo

1. En base **settled** nunca se suma `transactions.amount` **y** `account_payments.amount` de la misma liquidación.
2. Si la cuenta tiene al menos un abono en ledger → la caja del período sale **solo** de `account_payments.paid_at`.
3. Si la cuenta está `paid` al contado **sin** ledger → cuenta una vez por `transactions.date`.
4. `paid_amount` no se usa como fuente de flujo settled (solo para saldo abierto CxC/CxP = `amount - paid_amount`).

## Fechas

| Base | Fecha que filtra el período |
|---|---|
| `recorded` | `transactions.date` |
| `settled` (abonos) | `account_payments.paid_at` |
| `settled` (contado sin ledger) | `transactions.date` |

Un cobro de una venta a crédito registrada en enero y cobrada en marzo aparece en **recorded** de enero y en **settled** de marzo.

## Monedas

Totales siempre por `currency` de la transacción (los abonos heredan esa moneda). Nunca sumar USD+CUP.

## UI

- «Flujo registrado» = comportamiento histórico de `buildCashFlow` / `getFilteredTotals`.
- «Flujo liquidado» = motor settled.
- No se sustituye silenciosamente el panel antiguo: ambas bases son visibles.
