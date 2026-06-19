# PLAN — Trabajo offline + sincronización al reconectar (PWA)

> Objetivo: que GESTIA **abra y se pueda usar sin internet** y que los cambios hechos
> sin conexión **se guarden solos al reconectar**, con el **mínimo impacto** sobre lo
> que ya existe.
>
> Estado: **PLAN (sin código todavía)**. Pensado para ejecutarse **por sesiones**.
> Última verificación del código/BD real: **2026-06-19**.

---

## 0. Resumen ejecutivo

El trabajo se divide en **3 capas independientes y enviables por separado**:

| Capa | Qué resuelve | Impacto | Riesgo | ¿La puedo hacer yo solo? |
|------|--------------|---------|--------|--------------------------|
| **A — PWA** | Que la app **abra** sin internet (instalable, cacheada) | Bajo | Bajo | **Sí, ~95%.** Solo necesito de ti: nombre/color de la app y aprobar el icono. |
| **B — Caché de lectura** | Que el usuario **vea** sus datos ya cargados sin internet | Bajo-medio | Bajo | Sí, completa. |
| **C — Outbox / sync de escritura** | Que pueda **crear/editar** offline y **se sincronice** al reconectar | Medio | Medio | Sí, pero requiere decisiones tuyas y una migración de BD (ver §C). |

**Recomendación de orden:** A → B → C-finanzas → C-almacén. Cada capa aporta valor
aunque no se haga la siguiente.

---

## 1. Hallazgos del código real que condicionan el diseño

Verificado leyendo el repo y el esquema de Supabase (no por memoria):

1. **React Query v5 centralizado** en [`src/main.jsx`](../src/main.jsx) con `QueryCache`/`MutationCache`
   y toasts vía `mutation.meta`. `defaultOptions.queries = { retry: 1, refetchOnWindowFocus: false }`.
   → Base ideal para offline; React Query trae soporte nativo (`onlineManager`, mutaciones en pausa).

2. **Capa de servicios como único punto de acceso a datos**: `src/services/finanzas.js`,
   `almacen.js`, `dynamicInventory.js`, etc. → podemos interceptar en pocos sitios.

3. **Supabase auth ya persiste sesión** en localStorage (`persistSession: true`) en
   [`src/config/supabase.jsx`](../src/config/supabase.jsx). → El login sobrevive a estar offline. ✅

4. **⚠️ CLAVE — Las tablas de negocio usan IDs `bigint` autogenerados por el servidor**, NO UUID de cliente:
   - `transactions.id` → `bigint` (`nextval` de secuencia).
   - `products.id`, `movements.id`, `inventory_items.id` → `bigint identity BY DEFAULT`.
   - `user_id` se rellena server-side con `get_current_business_id()` (no se confía en el cliente).

   **Implicación:** la idea simplista de "genero un UUID en el cliente" **no aplica directamente**
   aquí. El registro creado offline tendrá un **id temporal solo local**; el id real lo asigna
   la BD al sincronizar. Esto está bien para inserciones **independientes** (finanzas), y es el
   punto difícil cuando un registro referencia a otro creado también offline (almacén, ver §C).

5. **⚠️ Los movimientos de almacén NO son un simple insert**: pasan por una **RPC atómica**
   `register_stock_movement` que actualiza stock y **devuelve `new_stock`**
   (ver [`almacen.js:173`](../src/services/almacen.js)). Offline no se puede conocer el stock
   resultante autoritativo → hay que calcularlo **optimistamente** y **reconciliar** al sincronizar.
   Además, un movimiento referencia `product_id` (FK) → si el producto se creó también offline,
   hay que **remapear** ese id. Por eso almacén va **después** y con alcance acotado.

6. **Adjuntos (imágenes) van a Supabase Storage** (bucket `transaction-images`,
   [`finanzas.js:8`](../src/services/finanzas.js)). Subir binarios offline = guardar el `File/Blob`
   en IndexedDB y subirlo al reconectar. Se trata como **mejora posterior**, no en el primer corte.

7. **Auditoría** (`logAction` → tabla `audit_logs`) y **límites de plan**
   (`recordUsage('monthly_transactions')`) se ejecutan dentro de los servicios. Offline hay que
   **diferirlos** (auditoría) y **decidir política** de límites (ver decisiones §6).

8. **`index.html` depende de 3 CDNs externos**: Google Fonts (Outfit + JetBrains Mono),
   Font Awesome 6 (cdnjs) y Material Icons. → Para offline real hay que **cachearlos o
   auto-alojarlos** (afecta a la Capa A).

9. **Despliegue en Netlify** con `public/_redirects` (fallback SPA). El service worker debe
   respetar ese fallback (`navigateFallback`). Hay `public/logo.png` y `logo_ico.png` como base de iconos.

---

## 2. Decisiones transversales (aplican a todas las capas)

- **Almacenamiento local:** **IndexedDB** (no localStorage, que tiene ~5 MB y es síncrono).
  Para la caché de React Query usaremos `idb-keyval`; para el outbox, un store propio en IndexedDB.
- **Detección de red:** `onlineManager` de React Query + eventos `online`/`offline` del navegador.
  Mostrar **un único banner global** de estado (online / offline / "sincronizando…").
- **`networkMode` por defecto (`'online'`)**: las mutaciones se **pausan solas** sin red y se
  **reanudan** al volver. No hay que reescribir la lógica de cada mutación, solo habilitar la
  persistencia de las pausadas.
- **No romper modo claro/oscuro ni mobile-first** en los nuevos elementos de UI (banner, badges).
- **Probar SIEMPRE en `npm run build` + `npm run preview`** (el service worker no corre en `dev`
  salvo que se active `devOptions`), con el "Offline" de Chrome DevTools, a ancho móvil y desktop.

---

## CAPA A — Convertir la app en PWA (que abra sin internet)

**Meta:** la app se cachea, es instalable ("Añadir a pantalla de inicio") y **abre sin conexión**.
No toca lógica de negocio.

> **Estado: A1 + A2 COMPLETADAS y verificadas en localhost (2026-06-19).** A3 (toast de
> "nueva versión") pendiente/opcional — con `registerType: 'autoUpdate'` la app ya se actualiza sola.
>
> **Lo hecho:**
> - `vite-plugin-pwa` configurado en `vite.config.js` (manifest "Gestia", `theme_color #1aa06a`,
>   `display standalone`, `navigateFallback`, Supabase excluido del SW vía `NetworkOnly`).
> - Iconos PWA generados desde `public/logo_ico.png` (`@vite-pwa/assets-generator`, config en
>   `pwa-assets.config.mjs`): 64/192/512/maskable-512 (fondo blanco + padding) + apple-touch-180 + favicon.ico.
> - `index.html`: eliminados los 3 CDNs externos (Google Fonts, Font Awesome, Material Icons —
>   estos 2 últimos sin uso en el código); añadidos `theme-color`, `apple-touch-icon` y metas iOS.
> - Fuentes **auto-alojadas** con `@fontsource/outfit` (300–700) y `@fontsource/jetbrains-mono` (400),
>   importadas en `src/main.jsx`.
>
> **Verificado (build + `npm run preview` :4173):** SW activo y controlando; 105 entradas en precache;
> `index.html`, fuentes e iconos servidos desde caché (offline-ready); Outfit carga sin CDN;
> sin errores de consola; móvil 375px sin desbordamiento horizontal; `npm run lint` limpio.
>
> **Nota:** el precache pesa ~3.5 MB porque incluye `export-vendor` (PDF/Excel, ~1.5 MB). Es un
> coste de instalación **único** (cuando hay conexión) y deja TODO offline. Si se quiere aligerar la
> primera instalación para conexiones muy malas, se puede excluir `export-vendor` del precache y
> cachearlo en runtime al primer uso. Decisión abierta.

### ¿Requiere muchos cambios? → No. La hago yo casi entera.
Lo que toco yo: `vite.config.js`, `index.html`, genero el `manifest` y los iconos.
Lo único que necesito de ti: **nombre/short_name**, **color de tema**, y **aprobar el icono**
(lo genero desde `public/logo.png`; si lo tienes en mayor resolución, mejor).

### Sesión A1 — PWA base
1. Instalar `vite-plugin-pwa` (compatible con Vite 6; usa Workbox por debajo).
2. Configurar el plugin en [`vite.config.js`](../vite.config.js):
   - `registerType: 'autoUpdate'`, `injectRegister: 'auto'`.
   - `manifest`: `name`, `short_name`, `theme_color`, `background_color`, `display: 'standalone'`,
     `start_url: '/'`, `icons` (192, 512, 512-maskable).
   - `workbox.navigateFallback: '/index.html'` (compatible con el `_redirects` de Netlify).
   - Precache del app-shell (JS/CSS/HTML del build) — automático con Workbox.
3. Generar iconos desde `public/logo.png` con `@vite-pwa/assets-generator`
   (192×192, 512×512, 512 maskable, `apple-touch-icon` 180×180).
4. Añadir meta tags a [`index.html`](../index.html): `theme-color`, `apple-mobile-web-app-capable`,
   `apple-touch-icon`.

### Sesión A2 — Recursos externos offline (los 3 CDNs)
- **Decisión** (ver §6): **auto-alojar** las fuentes (Outfit, JetBrains Mono) e iconos, **o**
  cachearlos en runtime con Workbox (`CacheFirst` para Google Fonts, etc.).
- Recomendado: **auto-alojar fuentes** (más fiable offline y más rápido) + revisar si Font Awesome
  y Material Icons se usan de verdad o se pueden quitar/reducir (ya hay `lucide-react`).
- Sin esto, la app abre offline pero **sin iconos/fuentes**.

### Sesión A3 — UX de actualización
- Toast "Hay una nueva versión, recargar" cuando el SW detecta update (patrón estándar de
  `vite-plugin-pwa` con `onNeedRefresh`). Evita que el usuario quede con una versión vieja cacheada.

### Criterios de aceptación Capa A
- [ ] `npm run build && npm run preview`, activar "Offline" en DevTools, recargar → **la app carga**.
- [ ] Aparece "Instalar app" en Chrome/Edge y se instala en móvil.
- [ ] Iconos y fuentes se ven offline (tras A2).
- [ ] Lighthouse PWA installable: ✅.
- [ ] Verificado a ancho móvil y desktop, claro y oscuro.

### Riesgos / mitigación
- **Caché obsoleta** → `autoUpdate` + toast de A3.
- **SW cacheando respuestas de Supabase por error** → excluir el dominio de Supabase del precache
  (solo cacheamos el app-shell; los datos los gestiona la Capa B vía React Query).

---

## CAPA B — Caché de lectura persistente (ver datos sin internet)

**Meta:** lo que el usuario ya cargó (finanzas, almacén, dashboard) **sigue visible offline** tras
recargar. No cambia la lógica de las queries, solo persiste la caché de React Query.

> **Estado: B1 + B2 IMPLEMENTADAS (2026-06-19).** Falta la verificación end-to-end con sesión
> iniciada (cargar datos → offline → recargar → datos visibles), que requiere credenciales.
>
> **Lo hecho:**
> - `src/offline/queryPersister.js`: persister sobre IndexedDB (`@tanstack/query-async-storage-persister`
>   + `idb-keyval`), `CACHE_BUSTER='gestia-rq-v1'`, `CACHE_MAX_AGE=7 días`.
> - `src/main.jsx`: `QueryClientProvider` → `PersistQueryClientProvider`; `gcTime=7 días`;
>   `shouldDehydrateQuery` solo persiste queries con éxito.
> - **Seguridad (dispositivo compartido):** 2º listener `onAuthStateChange` que limpia caché
>   (memoria + IndexedDB) al cerrar sesión y al entrar un usuario distinto. Cubre claves sin
>   user_id como `['isSystemAdmin']` (evita filtrar la UI de admin entre cuentas).
> - **B2:** `src/hooks/useOnlineStatus.js` (`useSyncExternalStore` sobre eventos online/offline) +
>   `src/components/common/OfflineBanner.jsx` (tokens `--warning`, modo oscuro, mobile-first),
>   montado en `SidebarLayout`.
>
> **Verificado:** build OK (PWA intacto), `npm run lint` limpio, login sin errores de consola
> (sin regresión por el cambio de provider), IndexedDB `keyval-store` creado por el persister,
> test unitario `OfflineBanner.test.jsx` (2/2). Suite completa: 36/38 (los 2 fallos son los
> pre-existentes de `PlansPanel.test.jsx`, ajenos a esta capa).
>
> **Pendiente:** prueba con sesión real (credenciales) — ver checklist de criterios de aceptación.

### Sesión B1 — Persistencia de la caché de React Query
1. Instalar `@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister`, `idb-keyval`.
2. En [`src/main.jsx`](../src/main.jsx): envolver con `PersistQueryClientProvider` usando
   `createAsyncStoragePersister` sobre IndexedDB (idb-keyval).
3. Configurar `gcTime` largo (p. ej. 7 días) para las queries que deben sobrevivir offline.
4. `buster` = versión del build (para invalidar caché en cada deploy).
5. **Aislamiento por usuario/negocio:** la `queryKey` ya incluye `userId`/`businessId`. Añadir
   un `dehydrateOptions`/filtro para **no persistir** datos sensibles de otro alcance y **limpiar
   la caché en logout** (evita fugas entre cuentas en un dispositivo compartido).

### Sesión B2 — Marcar datos "stale" offline + UX
- Banner sutil "Estás viendo datos guardados (sin conexión)" cuando se sirve de caché sin red.
- Revisar `enabled:` de las queries: que no se queden en *loading* infinito offline, sino que
  muestren la caché.

### Criterios de aceptación Capa B
- [ ] Cargar finanzas/almacén online → activar offline → recargar → **se ven los datos**.
- [ ] Tras logout, la caché del usuario anterior **no** es accesible.
- [ ] Nuevo deploy invalida la caché (sin datos corruptos por cambios de forma).

### Riesgos / mitigación
- **Fuga de datos entre cuentas** en dispositivo compartido → limpieza en logout + buster + filtro por scope.
- **Tamaño de caché** → `gcTime` acotado y persistir solo queries relevantes.

---

## CAPA C — Outbox / sincronización de escritura (lo que de verdad pides)

**Meta:** crear/editar offline → se ve al instante (optimista) → se **encola** → al reconectar
**se envía solo**, con notificación de éxito/fracaso.

> Esta es la capa con complejidad real. Por los hallazgos §1.4–§1.6 la partimos para que cada
> sesión sea pequeña y enviable. **Empezamos por finanzas** (caso fácil) y dejamos **almacén**
> (caso difícil) para el final.

### Fundamento técnico (cómo lo hará React Query, sin reinventar)
- Con `networkMode: 'online'` (el actual), una mutación lanzada sin red **queda "paused"**.
- `PersistQueryClientProvider` (Capa B) puede **persistir también las mutaciones pausadas**.
- Al volver la conexión / recargar, se llama `queryClient.resumePausedMutations()`.
- **Requisito de diseño:** para que una mutación se pueda reanudar **tras recargar**, su
  `mutationFn` debe poder reconstruirse desde **variables serializables** (no desde un closure con
  `userId`/`businessId`). Por eso registraremos `queryClient.setMutationDefaults(['transactions','create'], { mutationFn })`
  y las páginas pasarán **toda la info en `variables`** (hoy [`FinanzasMejorado.jsx:91`](../src/pages/FinanzasMejorado.jsx)
  ya mete `user_id` en el payload; hay que asegurar `businessId` también).

### Sesión C1 — Infraestructura común del outbox
1. `setMutationDefaults` por operación en un módulo nuevo `src/offline/mutationDefaults.js`,
   importado en `main.jsx`.
2. Conectar `resumePausedMutations()` al evento de reconexión (`onlineManager`).
3. **Idempotencia (migración de BD):** añadir columna `client_uuid uuid` **con índice UNIQUE**
   a `transactions` (y luego `products`, `movements`). El cliente genera el `client_uuid` al crear
   la operación; el insert lo incluye; reenviar la misma operación **no duplica**
   (`on conflict (client_uuid) do nothing`). Es una migración **aditiva y segura** (columna nullable).
4. **UI:** badge "Pendiente de sincronizar" en filas creadas offline + contador global en el banner.
5. **Mensajería:** adaptar los toasts de [`notifyWrap.js`](../src/services/notifyWrap.js) para que
   offline diga "Guardado. Se sincronizará al reconectar" en vez de "agregado satisfactoriamente".

### Sesión C2 — Finanzas offline (crear y editar transacciones) — **caso fácil**
- `createTransaction`/`updateTransaction` son **inserts/updates independientes** (sin FK entre sí,
  id asignado por el servidor al sincronizar) → encajan directo en el patrón.
- Update optimista de la caché `['transactions']` con un id temporal local (`tmp_<uuid>`); al
  sincronizar, invalidar para traer el id real.
- **Sin adjuntos** en este corte (los adjuntos son binarios → §C4). Si la transacción lleva imagen
  offline, o se bloquea esa parte o se difiere la subida.
- **Auditoría diferida:** `logAction` se ejecuta al sincronizar (con `created_at` = momento de
  sync; opcionalmente guardar la hora real del registro en `details`).

### Sesión C3 — Política de límites de plan offline
- Hoy `checkLimit`/`recordUsage('monthly_transactions')` es cliente. Offline no se puede validar
  de forma fiable. **Decisión** (§6): permitir optimista y reconciliar al sincronizar, o avisar.

### Sesión C4 (opcional) — Adjuntos offline
- Guardar `File/Blob` en IndexedDB; al sincronizar, subir a Storage y **parchear** `image_url`/`details`.

### Sesión C5 — Almacén offline — **caso difícil, alcance acotado**
- Movimientos vía RPC `register_stock_movement` que devuelve `new_stock`:
  - **Stock optimista local** al registrar offline; **reconciliar** con el `new_stock` real al
    sincronizar (puede haber diferencias por cambios concurrentes de otros usuarios).
  - **Idempotencia de la RPC:** crear variante que acepte `client_uuid` y sea idempotente (migración + RPC).
- **Acotar alcance (recomendado):** offline solo permitir movimientos sobre **productos ya
  sincronizados**; **no** crear productos nuevos offline en el primer corte (evita el remapeo de
  FK `product_id` de un producto sin id real). Crear productos offline sería una fase posterior.

### Criterios de aceptación Capa C (finanzas)
- [ ] Sin red: crear una transacción → se ve al instante con badge "Pendiente".
- [ ] Cerrar y reabrir la app sin red → la transacción pendiente **sigue ahí**.
- [ ] Volver la conexión → se sincroniza sola, el badge desaparece, toast de éxito.
- [ ] Reenvío/duplicado: forzar doble envío → **no se duplica** (idempotencia `client_uuid`).
- [ ] RLS sigue aplicando igual al sincronizar (probado con usuario sin permiso).

### Riesgos / mitigación
- **Duplicados al reintentar** → `client_uuid UNIQUE` (C1).
- **Conflictos / stock divergente** → estrategia "last-write" + reconciliación con valor del servidor; avisar si hay desfase grande.
- **Mutación no reanudable tras recargar** → `setMutationDefaults` + variables 100% serializables (C1).
- **Cola atascada** (una operación falla siempre) → política de reintentos con backoff y opción de "descartar" en la UI.

---

## 3. Mapa de archivos a tocar (resumen)

| Capa | Archivos / nuevos |
|------|-------------------|
| A | `vite.config.js`, `index.html`, `public/` (iconos), `package.json` |
| B | `src/main.jsx`, `package.json`, (logout: limpiar caché) |
| C | `src/main.jsx`, **nuevo** `src/offline/` (outbox, mutationDefaults, status), `src/services/notifyWrap.js`, `src/services/finanzas.js` y `almacen.js` (incluir `client_uuid`), páginas que lanzan mutaciones, **migración Supabase** (`client_uuid` + RPC idempotente) |

---

## 4. Estrategia de pruebas

- **Build + preview** (el SW no corre en dev por defecto): `npm run build && npm run preview`.
- **Offline** vía DevTools → Network → "Offline" (y "Slow 3G" para conexión mala real).
- Flujo manual por capa según los **criterios de aceptación** de arriba.
- Verificar **mobile (~360–414px) y desktop**, **claro y oscuro** (regla dura del proyecto).
- `npm run lint` y `npx vitest run` verdes antes de cerrar cada sesión.

---

## 5. Qué NO se hace (fuera de alcance)

- Base de datos local replicada tipo PowerSync/ElectricSQL (cambio arquitectónico mayor; solo si
  esto se queda corto en el futuro).
- Offline para reportes/exportación PDF-Excel, panel admin, gestión de equipo/planes.
- Resolución de conflictos avanzada (merge campo a campo); usamos last-write + reconciliación.

---

## 6. Decisiones

**Resueltas con Roberto (2026-06-19):**

3. ✅ **Alcance de la escritura offline (C):** **Solo Finanzas** en el primer corte. Almacén (C5)
   queda como fase posterior opcional.
4. ✅ **Adjuntos offline (C4):** **Diferir la imagen.** Offline se guarda la transacción sin imagen
   y/o la subida de la imagen se hace automáticamente al reconectar. No bloquea el primer corte.
5. ✅ **Límites de plan offline (C3):** **Permitir y reconciliar.** Offline se permite crear; el
   conteo (`recordUsage`) se aplica al sincronizar. Puede superar el límite temporalmente — aceptado.

**Pendientes (resolver antes de la Capa A):**

1. **PWA — identidad:** `name`, `short_name` y `theme_color` de la app instalada. ¿Uso `public/logo.png`
   como icono o tienes una versión en mayor resolución?
2. **Fuentes/iconos offline (A2):** ¿auto-alojar fuentes y revisar si Font Awesome/Material Icons
   se pueden eliminar (ya hay `lucide-react`)? (Recomendado: sí.)

---

## 7. Orden sugerido de sesiones

1. **A1** (PWA base) → 2. **A2** (recursos offline) → 3. **A3** (UX update)
4. **B1** (persistencia caché) → 5. **B2** (UX datos guardados)
6. **C1** (infra outbox + migración idempotencia) → 7. **C2** (finanzas offline) → 8. **C3** (límites)
9. *(opcional)* **C4** (adjuntos) → 10. *(opcional)* **C5** (almacén)
