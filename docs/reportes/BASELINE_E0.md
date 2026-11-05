# Baseline E0 — registro de pruebas

Fecha: 2026-11-04 (rama `feat/reportes-e0-e1-terminologia`).

## Suite reportes (pre-E1)

Archivo: [baseline-vitest-reportes-e0.txt](./baseline-vitest-reportes-e0.txt)

```
5 files / 34 tests — todos passed
narrativeGenerator, financials, aging, exportUtils, ReportPreview
```

## Suite completo (fallos preexistentes)

Archivo: [baseline-vitest-full-e0.txt](./baseline-vitest-full-e0.txt)

```
48 files: 1 failed | 47 passed
216 tests: 1 failed | 215 passed
```

### Fallo preexistente (fuera de alcance E0/E1)

| Test | Error |
|---|---|
| `src/services/planRequests.test.js` → `requestPlanChange calls RPC with normalized payload` | El mock recibe `contact_name: ""` adicional; el test no lo espera. |

**No se corrige en E0/E1.** Queda registrado para no ocultarlo.

Nota: el fallo histórico de `PlansPanel.test.jsx` (botón «Solicitar Premium» ambiguo) **no apareció** en este baseline (suite verde para ese archivo en el working tree actual).

## Suites añadidas en E0

| Archivo | Rol |
|---|---|
| `narrativeGenerator.baseline.test.js` | Documenta defectos pre-E1; tras E1 queda en `describe.skip` |
| `narrativeGenerator.e1.test.js` | Contrato post-E1 |
| `narrativeGenerator.fixtures.js` | Fixtures USD/CUP, parciales, UDM mixtas |
