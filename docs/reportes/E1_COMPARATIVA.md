# E1 — Comparativa de informes (antes → después)

Alcance: textos e indicadores del generador narrativo (`narrativeGenerator.js`). Sin cambios de semántica de totales (sigue sumando transacciones registradas de cualquier `status`).

## Finanzas

| Elemento | Antes (pre-E1) | Después (E1) |
|---|---|---|
| Base de preparación | «Movimientos de caja registrados (base de efectivo)» | «Registros operacionales (movimientos registrados; no equivale a caja cobrada)» |
| Nota metodológica | Ausente | Sección «0. Nota metodológica» (no es estado financiero / partida doble) |
| Resumen narrativo | «resultado neto» + «margen neto» | «flujo neto registrado» + «relación flujo neto/entradas registradas» |
| Tabla resumen | Ingresos / Gastos / **Resultado neto** | Entradas registradas / Salidas registradas / **Flujo neto registrado** |
| KPI principal | Margen neto % | Relación flujo neto/entradas registradas % |
| Cobertura | Razón de cobertura de gastos | Razón entradas/salidas registradas |
| Top gastos | Ranking global por `Number(amount)` (mezcla monedas) | Hasta 5 por moneda + columna Moneda |
| Conclusiones | Solo `currencies[0]` | Una conclusión de flujo por cada moneda con actividad |
| Términos evitados | margen, resultado operativo, utilidad, rentabilidad, base de efectivo | — |

### Ejemplo (USD 1 800 entradas / 150 salidas)

**Antes:** «…arrojando un resultado neto positivo … con un margen neto del 91.7%»  
**Después:** «…con un flujo neto registrado positivo … y una relación flujo neto/entradas registradas del 91.7%»

## Almacén

| Elemento | Antes | Después |
|---|---|---|
| Resumen | «X unidades» sumando qty de todos los productos + «índice de rotación (salidas/entradas)» | Conteo de movimientos y productos; aviso de no agregar UDM distintas; sin índice de rotación |
| Conclusiones | Acumulación/reducción de «unidades» + rotación | Actividad registrada + producto con mayor actividad (entradas/salidas propias) |
| Tabla Top 10 | Sin nota de UDM | Nota: no sumar/comparar UDM distintas entre filas |

### Ejemplo (Café paquete + Aceite litro + Tornillos unidad)

**Antes:** «…entradas de abastecimiento (130 unidades) … índice de rotación …»  
**Después:** «…5 movimientos … sobre 3 productos. Las cantidades se detallan por producto; no se agregan unidades de medida distintas…»

## Inventario / Global

Sin cambio de estructura: global sigue componiendo I / II / III. Hereda la terminología corregida de finanzas y almacén.

## Shape público (compatibilidad)

Se conserva `{ title, metadata, sections[] }` con tipos `paragraph` (content), `table`, `list`, `header_section`.  
Campo añadido compatible: sección metodológica al inicio; `notes` en tablas de gastos/almacén.
