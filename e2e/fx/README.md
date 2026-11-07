# E2E FX — dólar diario + margen de reposición

Pruebas fuertes con **playwright-cli** (skill del proyecto) y dataset canónico de refrescos.

## Requisitos

```bash
npm run dev
# una vez: instalar el navegador del CLI
npx @playwright/cli@latest install-browser chrome-for-testing
# en otra terminal, con cuenta de prueba (no prod del cliente):
npx @playwright/cli@latest open http://localhost:5173
# o: playwright-cli open http://localhost:5173
```

### Suite unitaria del dataset (obligatoria en cada PR FX)

```bash
npx vitest run src/utils/dailyFxReminder.test.js src/utils/replacementPricing.test.js src/tests/almacen.movement.test.js src/components/config/DailyFxRateModal.test.jsx src/components/almacen/ReplacementMarginPanel.test.jsx
```

Inicia sesión manualmente en la cuenta de prueba (Negocio o Élite con USD+CUP).

## Flujos

### 1) fx-reminder-on-off

1. Ir a Configuración → Monedas.
2. Con CUP activo, verificar switch «Pedírmelo cada día».
3. Apagar → debe verse el aviso de consecuencias.
4. Encender de nuevo.
5. Borrar/ausentar tasa de hoy → recargar app → modal «¿A cuánto está el dólar hoy?».
6. Guardar 800 → recargar → el modal no debe reaparecer.
7. «Más tarde» → no reaparece el mismo día.

### 2) fx-soda-margin (Negocio)

Dataset: costo unitario CUP 800, R0=800, precio 1000, margen 25%.

1. Crear producto «Refresco lata» moneda CUP, precio 1000.
2. Entrada 50 uds costo 800 (sella tasa del día; asegurar tasa CUP=800 ese día).
3. Registrar tasa CUP de hoy = 1000.
4. Almacén → banner «bajo el precio de reposición», sugerido 1250.
5. Aplicar → `unit_price` = 1250 → sale del banner.

### 3) fx-no-break-warehouse

Tras el flujo anterior: salida/venta no debe alterar `avg_cost` histórico de forma incorrecta; stock coherente.

### 4) fx-finance-stamp

Crear ingreso en CUP y verificar que la transacción sigue sellando `fx_units_per_base` (Finanzas intacto).

### 5) fx-plan-gating

- Inicial: ve riesgo, no aplica.
- Negocio: aplica 1 a 1; sin lote/escenario.
- Élite: selección múltiple + escenario de tasa.

## Vitest (automatizado en CI local)

```bash
npx vitest run src/utils/dailyFxReminder.test.js src/utils/replacementPricing.test.js src/tests/almacen.movement.test.js
```
