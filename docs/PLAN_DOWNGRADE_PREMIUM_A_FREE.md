# Plan de Downgrade de Premium a Gratis

## Objetivo

Definir la forma correcta de bajar un negocio de Premium a Gratis cuando ya tiene muchos datos: varias monedas, muchas areas de inventario, socios de equipo, auditoria, exportaciones y uso por encima de los limites del plan gratuito.

El downgrade no debe sentirse como un castigo ni como una perdida confusa. Debe ser un asistente claro, paso a paso, donde el propietario entiende que cambia, elige que conservar activo y confirma antes de aplicar restricciones.

## Estado Actual

Actualmente el proyecto ya tiene parte de la logica en:

- `src/context/SubscriptionContext.jsx`
  - Permite `updatePlan('free')`.
  - Bloquea `updatePlan('premium')` para que Premium requiera aprobacion manual.

- `src/components/config/PlansPanel.jsx`
  - Muestra planes.
  - Permite solicitar Premium.
  - Tiene una confirmacion simple para cambiar a Gratis.

- `supabase/migrations/plan_limits_enforcement_and_downgrade.sql`
  - Cuando el plan cambia a `free`, ejecuta `apply_subscription_policies`.
  - Marca como bloqueadas las areas sobre el limite.
  - Revoca socios activos.
  - Deja una sola moneda activa.

Problema actual:

- La moneda que queda activa se decide automaticamente.
- Las areas que quedan editables se deciden automaticamente por antiguedad.
- El usuario no ve un resumen completo del impacto.
- No hay un asistente por secciones.
- Hay textos con codificacion rota como `ConfiguraciÃ³n`, `Ãrea`, `lÃ­mite`.

## Principio de Producto

El sistema no debe borrar datos por bajar a Gratis.

Debe hacer esto:

- Conservar todos los datos existentes.
- Mantener visibles los datos historicos siempre que los permisos lo permitan.
- Bloquear edicion/creacion donde el plan gratuito no lo permita.
- Pedir al usuario que elija los recursos que seguiran activos.
- Aplicar cambios solo despues de una confirmacion final.

## Limites del Plan Gratis

Usar siempre los limites de `plans.limits`, no valores hardcodeados.

Limites actuales esperados:

- `monthly_transactions`: 40
- `products`: 40
- `areas`: 5
- `partners`: 0

Features actuales esperadas:

- `reports_export`: false
- `audit_logs`: false
- `custom_branding`: false
- `watermark`: true

## Experiencia de Usuario Recomendada

Crear un asistente de downgrade dentro de `PlansPanel`.

Nombre sugerido del componente:

```txt
src/components/config/DowngradeToFreeDialog.jsx
```

El boton `Cambiar a Gratuito` no debe ejecutar `updatePlan('free')` directamente. Debe abrir el asistente.

## Flujo Propuesto

### Paso 1: Resumen del Cambio

Mostrar una pantalla clara:

Titulo:

```txt
Cambiar a Plan Gratuito
```

Mensaje:

```txt
Tu informacion no se eliminara. Algunas funciones quedaran limitadas y tendras que elegir que recursos seguiran activos en el plan gratuito.
```

Resumen por secciones:

- Monedas: se conservara 1 moneda activa.
- Equipo: los socios perderan acceso al negocio.
- Inventario: solo 5 areas quedaran editables.
- Finanzas: tendras 40 transacciones nuevas por mes.
- Almacen: solo 40 productos podran mantenerse dentro del limite de creacion/uso.
- Reportes: se desactivara la exportacion PDF/Excel.
- Auditoria: se perdera el acceso a los logs de auditoria.
- Marca: volvera la marca de agua si aplica.

Boton:

```txt
Continuar
```

### Paso 2: Elegir Moneda Principal

Si el negocio tiene mas de una moneda activa en `business_currencies`, el usuario debe escoger cual continua activa y principal.

Datos necesarios:

- `business_currencies.id`
- `business_currencies.currency_code`
- `business_currencies.is_default`
- datos relacionados de `currencies`

Reglas:

- Debe seleccionar exactamente una moneda.
- Esa moneda quedara:
  - `is_active = true`
  - `is_default = true`
- Todas las demas quedaran:
  - `is_active = false`
  - `is_default = false`

Texto recomendado:

```txt
El Plan Gratuito permite una sola moneda activa. Elige la moneda que seguira como principal para tus balances y nuevas operaciones.
```

Notas importantes:

- No borrar monedas.
- No modificar transacciones antiguas.
- Las transacciones historicas en otras monedas deben seguir existiendo.
- La UI debe avisar que nuevas operaciones usaran la moneda seleccionada.

### Paso 3: Gestionar Equipo

Si existen socios activos o pendientes en `team_members`, mostrar lista.

Reglas:

- Plan Gratis permite `partners = 0`.
- Todos los socios activos deben pasar a `revoked`.
- Los pendientes tambien deben cancelarse o revocarse, segun se decida.

Recomendacion:

- Usar `status = 'revoked'` para activos y pendientes.
- No borrar filas de `team_members`.
- Mantener historial para auditoria.

Texto recomendado:

```txt
Los usuarios de tu equipo dejaran de tener acceso a este negocio. Sus cuentas no se eliminaran, pero ya no podran entrar ni modificar informacion de tu empresa.
```

Mostrar columnas:

- Email
- Rol
- Estado actual
- Resultado: `Acceso revocado`

No hace falta que el usuario elija nada aqui. Solo debe entender el impacto.

### Paso 4: Elegir Areas Editables

Si el negocio tiene mas areas que el limite gratuito, el usuario debe escoger cuales quedaran activas/editables.

Tabla:

```txt
inventory_areas
```

Campo existente:

```txt
plan_locked
```

Reglas:

- Si el limite Free es 5, el usuario debe elegir hasta 5 areas.
- Las areas elegidas quedaran:
  - `plan_locked = false`
- Las demas quedaran:
  - `plan_locked = true`

Texto recomendado:

```txt
El Plan Gratuito permite editar hasta 5 areas de inventario. Elige las areas que seguiran disponibles para crear y editar formularios. Las demas quedaran en solo lectura.
```

Comportamiento de areas bloqueadas:

- Se pueden ver.
- Se pueden abrir.
- No se puede editar configuracion del formulario.
- No se pueden agregar campos.
- No se deben crear nuevos items si la regla de negocio decide bloqueo total por area.

Decision recomendada:

- Las areas bloqueadas deben quedar en solo lectura completa.
- Sus datos historicos se pueden consultar.
- No se deben permitir nuevos registros dentro de areas bloqueadas.

Esto requiere revisar `FormRunner`, porque actualmente el bloqueo visual esta mas claro en `FormBuilder` que en el registro de items.

### Paso 5: Revisar Limites de Finanzas

El downgrade no debe borrar transacciones.

Reglas:

- Las transacciones historicas se conservan.
- El limite `monthly_transactions = 40` debe aplicar a nuevas transacciones del mes.
- Si el usuario ya tiene mas de 40 transacciones este mes:
  - No se borran.
  - No podra crear mas transacciones hasta el mes siguiente o hasta volver a Premium.

Texto recomendado:

```txt
Tus transacciones existentes se conservaran. Si ya superaste el limite mensual gratuito, no podras crear nuevas transacciones hasta el proximo mes o hasta volver a Premium.
```

Mostrar:

- Transacciones creadas este mes.
- Limite Free.
- Estado:
  - `Dentro del limite`
  - `Limite superado`

### Paso 6: Revisar Limites de Almacen / Productos

Reglas:

- No borrar productos.
- Si hay mas de 40 productos, el sistema debe impedir crear nuevos productos.
- Decidir si los productos por encima del limite quedan editables o solo lectura.

Decision recomendada:

- Mantener productos existentes visibles.
- Permitir editar productos existentes si no afecta el modelo de limite.
- Bloquear creacion de productos nuevos cuando el conteo es mayor o igual al limite.

Texto recomendado:

```txt
Tus productos existentes se conservaran. Si ya tienes mas productos que el limite gratuito, no podras crear productos nuevos hasta reducir el total o volver a Premium.
```

### Paso 7: Reportes, Exportacion y Auditoria

Reportes:

- El usuario puede seguir viendo reportes basicos.
- Se desactiva exportacion PDF/Excel si `reports_export = false`.

Auditoria:

- Se desactiva acceso a `Logs`.
- Los logs existentes no deben borrarse.
- Solo dejan de estar visibles para el negocio en Free.

Texto recomendado:

```txt
Perderas acceso a la auditoria mientras estes en el Plan Gratuito. Los registros existentes se conservaran y volveran a estar disponibles si reactivas Premium.
```

### Paso 8: Confirmacion Final

Mostrar resumen final antes de ejecutar.

Ejemplo:

```txt
Resumen antes de cambiar a Gratuito

Moneda activa:
USD

Areas editables:
Ventas, Compras, Almacen, Equipos, Insumos

Areas en solo lectura:
Vehiculos, Herramientas, Clientes

Socios:
3 usuarios perderan acceso

Funciones desactivadas:
Exportacion, auditoria, multiples monedas, equipo
```

Confirmacion:

```txt
Entiendo los cambios y quiero cambiar a Plan Gratuito
```

Usar checkbox obligatorio antes de habilitar el boton final.

Boton final:

```txt
Cambiar a Gratuito
```

## Cambios Tecnicos Recomendados

### 1. Crear RPC para Preview del Downgrade

Nombre:

```sql
public.get_downgrade_preview(target_business_id uuid)
```

O mejor, sin parametro para evitar spoofing:

```sql
public.get_my_downgrade_preview()
```

Debe devolver:

```json
{
  "current_plan": "premium",
  "free_limits": {
    "monthly_transactions": 40,
    "products": 40,
    "areas": 5,
    "partners": 0
  },
  "usage": {
    "monthly_transactions": 83,
    "products": 120,
    "areas": 9,
    "partners": 3,
    "active_currencies": 4
  },
  "features_lost": [
    "reports_export",
    "audit_logs",
    "custom_branding"
  ]
}
```

### 2. Crear RPC para Aplicar Downgrade con Elecciones

Nombre:

```sql
public.apply_downgrade_to_free(
  keep_currency_id bigint,
  keep_area_ids bigint[]
)
```

Responsabilidades:

- Validar que `auth.uid()` sea propietario del negocio.
- Validar que el negocio este en Premium.
- Leer limite de areas desde `plans.limits`.
- Validar que `array_length(keep_area_ids) <= limit`.
- Validar que todas las areas pertenecen al negocio.
- Validar que la moneda pertenece al negocio y esta activa.
- Actualizar `subscriptions.plan_id = 'free'`.
- Actualizar monedas segun `keep_currency_id`.
- Actualizar `inventory_areas.plan_locked` segun `keep_area_ids`.
- Revocar socios.
- Registrar auditoria.

Importante:

- Esta RPC debe reemplazar el downgrade directo con `updatePlan('free')`.
- El trigger actual `apply_subscription_policies` debe ajustarse para no sobreescribir las elecciones del usuario.

### 3. Ajustar `apply_subscription_policies`

Actualmente:

- Conserva areas por `created_at ASC`.
- Conserva moneda por default/antiguedad.

Problema:

- Si el usuario eligio moneda y areas, esta funcion podria ignorar su eleccion.

Soluciones posibles:

#### Opcion A: Mover toda la logica a `apply_downgrade_to_free`

Recomendada.

- El trigger queda solo como fallback.
- El downgrade desde UI llama la RPC especializada.
- La RPC setea un flag interno:

```sql
set_config('app.manual_downgrade_choices', '1', true)
```

- El trigger evita aplicar seleccion automatica si el flag esta activo.

#### Opcion B: Crear una tabla temporal/persistente de elecciones

Mas compleja.

Tabla:

```txt
downgrade_choices
```

No recomendada por ahora.

### 4. Crear Servicio Frontend

Archivo:

```txt
src/services/downgrade.js
```

Funciones:

```js
export async function getDowngradePreview()
export async function applyDowngradeToFree({ keepCurrencyId, keepAreaIds })
```

### 5. Crear Componente UI

Archivo:

```txt
src/components/config/DowngradeToFreeDialog.jsx
```

Props:

```js
{
  open,
  onOpenChange,
  onSuccess
}
```

Debe usar:

- `useCurrency()` para monedas activas.
- `getInventoryAreas()` para areas.
- `useSubscription()` para limites.
- RPC preview para conteos confiables.

### 6. Actualizar `PlansPanel`

Cambiar:

```js
updatePlan('free')
```

Por:

```js
setDowngradeOpen(true)
```

Y dentro del dialog:

```js
applyDowngradeToFree({ keepCurrencyId, keepAreaIds })
```

Despues de aplicar:

- Refrescar suscripcion.
- Refrescar monedas.
- Invalidar queries de inventario.
- Mostrar toast claro.

## Correccion de Codificacion

Hay muchos textos con mojibake:

- `ConfiguraciÃ³n`
- `Ãrea`
- `lÃ­mite`
- `acciÃ³n`
- `eliminaciÃ³n`

Manera correcta:

1. Confirmar que todos los archivos fuente se guardan como UTF-8.
2. Corregir textos visibles en componentes tocados por este flujo.
3. Evitar mezclar cambios masivos de codificacion con cambios logicos grandes.
4. Hacer una pasada por secciones:
   - Configuracion
   - Planes
   - Inventario
   - Monedas
   - Notificaciones
   - Migraciones SQL

Para el downgrade, corregir como minimo:

- `PlansPanel.jsx`
- `CurrenciesPanel.jsx`
- `InventarioMejorado.jsx`
- `SubscriptionContext.jsx`
- `notifications.jsx`
- migraciones nuevas relacionadas al downgrade

Recomendacion practica:

- En UI React usar acentos normales si el editor guarda UTF-8.
- En SQL, tambien usar UTF-8, pero revisar que Supabase no reciba texto ya corrupto.
- Si hay dudas, usar mensajes ASCII en SQL y mensajes con acentos solo en frontend.

## Manejo de Limites por Seccion

### Finanzas

Limite:

- `monthly_transactions`

Comportamiento:

- No borrar historico.
- Bloquear nuevas transacciones si supera limite.
- Mostrar contador mensual en Finanzas.

### Almacen

Limite:

- `products`

Comportamiento:

- No borrar productos.
- Bloquear creacion si supera limite.
- Permitir ver productos existentes.

### Inventario

Limite:

- `areas`

Comportamiento:

- Usuario elige areas editables.
- Areas no elegidas quedan bloqueadas.
- No permitir nuevos items en areas bloqueadas.

### Equipo

Limite:

- `partners`

Comportamiento:

- Revocar acceso a todos los socios.
- No borrar historial de miembros.
- Ocultar tabs Equipo/Roles en Free.

### Monedas

Limite:

- 1 moneda activa en Free.

Comportamiento:

- Usuario elige moneda principal.
- Desactivar las demas.
- No modificar historico.

### Reportes

Feature:

- `reports_export`

Comportamiento:

- Ver reportes basicos.
- Bloquear PDF/Excel.

### Auditoria

Feature:

- `audit_logs`

Comportamiento:

- Ocultar acceso a logs.
- Conservar logs.
- Restaurar acceso al volver a Premium.

## Orden de Implementacion Recomendado

1. Corregir codificacion en archivos del flujo de planes/downgrade.
2. Crear RPC `get_my_downgrade_preview`.
3. Crear RPC `apply_downgrade_to_free`.
4. Ajustar trigger `apply_subscription_policies` para no ignorar elecciones manuales.
5. Crear `src/services/downgrade.js`.
6. Crear `DowngradeToFreeDialog.jsx`.
7. Reemplazar confirmacion simple en `PlansPanel`.
8. Asegurar que areas bloqueadas sean solo lectura completa.
9. Agregar mensajes de limite por seccion.
10. Ejecutar build.
11. Probar casos manuales.

## QA Manual

### Caso 1: Premium con 1 moneda y 3 areas

Resultado:

- Downgrade permite confirmar rapido.
- No hay selector obligatorio de moneda si solo hay una.
- No hay selector obligatorio de areas si esta dentro del limite.

### Caso 2: Premium con 4 monedas

Resultado:

- Debe elegir una moneda.
- Solo esa moneda queda activa y principal.
- Las demas quedan inactivas.

### Caso 3: Premium con 9 areas

Resultado:

- Debe elegir hasta 5 areas.
- Las 5 quedan editables.
- Las otras 4 quedan solo lectura.

### Caso 4: Premium con socios

Resultado:

- Lista socios afectados.
- Al confirmar, todos pierden acceso.
- El owner conserva acceso.

### Caso 5: Premium con 100 transacciones este mes

Resultado:

- No se borran transacciones.
- Se bloquea crear nuevas transacciones por limite mensual.
- El mensaje explica que el limite se libera el proximo mes.

### Caso 6: Premium con auditoria

Resultado:

- Logs existentes no se borran.
- Ruta de logs queda bloqueada/oculta en Free.
- Al volver a Premium se pueden consultar de nuevo.

## Decision Recomendada

La manera correcta de proceder es no hacer un downgrade instantaneo.

Debe hacerse con un asistente de preparacion:

1. Mostrar impacto.
2. Elegir moneda principal.
3. Informar perdida de acceso del equipo.
4. Elegir areas editables.
5. Mostrar limites por seccion.
6. Confirmar con resumen final.
7. Ejecutar una RPC transaccional que aplique todo en base de datos.

Esto protege los datos, evita sorpresas y mantiene la logica sensible fuera del navegador.
