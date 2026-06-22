# CLAUDE.md — Memoria del Proyecto: GESTIA (Sistema Contable)

> Este archivo es la **memoria viva del proyecto**. Lo leo automáticamente al iniciar cada sesión.
> Mantenerlo actualizado y **basado solo en hechos verificados en el código** (no suposiciones).
> Última verificación de los hechos de abajo: **2026-06-17** (leyendo el código real).

## 1. Qué es
- **Nombre interno:** GESTIA / "NexGest ERP / ContaSync" (en `README.md`). Título del navegador: "Gestia".
- **Propósito:** Plataforma web de **gestión financiera y contable para PYMES** con baja integración informática. Debe ser **intuitiva, fácil sin conocimientos técnicos y con aspecto premium**.
- **Cliente ideal:** pequeños negocios. Prioridad: simplicidad + percepción de calidad.
- **Hecho con:** React + TRAE (el autor es Roberto, no perfil técnico profundo).
- **Módulos:** Almacén, Finanzas, Inventario (dinámico), Reportes, Auditorías/Logs, Configuración, Planes (Free/Premium), Panel Admin.

## 2. Stack (verificado en `package.json`)
- **Frontend:** React 18.2 + **Vite 6** (NO Create React App pese a que `react-scripts` está listado).
- **UI:** Tailwind 3.4 + Radix UI (shadcn) + `lucide-react` + `sonner` (toasts) + `tailwindcss-animate`.
- **Datos/estado:** **@tanstack/react-query v5**, React Router v6, Context API.
- **Backend:** **Supabase** (`@supabase/supabase-js` v2) — Postgres + Auth + RLS + RPCs + Storage.
- **Gráficas:** **Recharts v3**. **Exportación:** `jspdf`+`jspdf-autotable`, `xlsx`, `docx`, `file-saver`.
- **Validación:** `zod` v4 + `react-hook-form`. **Fechas:** `date-fns` v2 + `moment` + flatpickr/react-datepicker (redundante).
- **Tests:** **Vitest 4** + Testing Library + jsdom.
- ⚠️ **`firebase` v12 está en dependencias** y existe `firebase-debug.log` — confirmar si se usa o es legado a eliminar.

## 3. Arquitectura (verificada)
- **Entrada:** `src/main.jsx` → `src/App.jsx`. ⚠️ `src/AppMejorado.jsx` existe pero **NO se usa** (candidato a código muerto).
- **Providers (de fuera hacia dentro):** `ThemeProvider` (main.jsx) › `QueryClientProvider` › `BusinessProvider` › `SubscriptionProvider` › `CurrencyProvider` › `PermissionProvider` (App.jsx).
- **React Query** centraliza toasts de error/éxito vía `mutation.meta` en `main.jsx` (buen patrón).
- **Patrón "Mejorado":** las páginas activas son las `*Mejorado.jsx`. Excepción: el router usa `Reportes.jsx` (no `ReportesMejorado.jsx`) → confirmar si `ReportesMejorado.jsx` es código muerto.

## 4. RBAC y rutas (verificado en `src/App.jsx` + `src/routes/ProtectedRoute.jsx`)
- `ProtectedRoute` recibe `requiredPermission` o `systemAdminOnly`. Si `isOwner` → acceso total. Si no, comprueba `hasPermission(code)`; si falla → redirige a `/`.
- **Códigos de permiso por ruta (deben existir en `PermissionContext` y en la BD):**
  - `/finanzas` → `finanzas.view`
  - `/almacen` → `warehouse.view`
  - `/inventario` → `inventory.view` (+ `inventory.create` para `/inventario/nuevo`)
  - `/reportes` → `reports.view`
  - `/configuracion` → `config.view`
  - `/logs` → `logs.view`
  - `/admin/planes` → `systemAdminOnly` (vía `isSystemAdmin` RPC)
- ⚠️ Mezcla de idiomas en los códigos (`finanzas.view` vs `warehouse.view`/`inventory.view`) — revisar consistencia.
- **Defensa en profundidad:** el control en cliente NO basta; **debe respaldarse con RLS en Supabase**. (Pendiente de confirmar por auditoría.)

### 4.1 INVARIANTE — Identidad de miembro de equipo (NO romper)
- **La resolución de identidad (owner vs miembro) ocurre en `src/context/BusinessContext.jsx`** vía RPC `get_user_business_context`. Un miembro **activo** resuelve `{ businessId: owner_id, isOwner: false }`; cualquier otro caso → `{ businessId: self, isOwner: true }`.
- **`acceptPendingInvitations(email)` DEBE llamarse en `BusinessContext.resolveBusinessContext` ANTES de `getBusinessContext`** (solo si `navigator.onLine`). Es lo que vincula la invitación pendiente (`team_members.status 'pending' → 'active'`, `member_id`) en **TODAS** las vías de entrada: login, **confirmación de email**, recarga y restauración de sesión.
  - ⚠️ Si esta llamada se quita (pasó en el commit `c30fd84`, dejándola solo en `Login.jsx`), un miembro que entra por confirmación de email/recarga se resuelve como **owner nuevo** → ve el asistente de titular (`OnboardingWizard`) y se le crea una **suscripción free propia** (`ensureOwnerSubscription` en `Login.jsx`), comportándose como cuenta nueva en vez de mostrar los datos del negocio titular.
  - Guard de regresión: `src/context/BusinessContext.test.jsx` verifica que `acceptPendingInvitations` se invoca al resolver y que un miembro expone `isOwner:false`.
- El **asistente de onboarding** (`useOnboardingStatus`) solo aplica a `isOwner === true`; los miembros nunca lo ven. Por tanto, si la identidad de miembro se resuelve mal, el síntoma visible es "el miembro ve el formulario de titular".
- Backend (verificado, correcto): `accept_invitation_for_current_user` y `get_user_business_context` son `SECURITY DEFINER`; el INSERT de invitación (`inviteMember`) pasa por RLS `team_members_manage` (`is_premium(owner_id) AND has_permission_secure(owner_id,'team.manage')`); `has_permission_secure` devuelve `TRUE` cuando `auth.uid() = target_owner_id` (el owner tiene todos los permisos). **No** crear miembros con el owner en plan free (RLS lo bloquea + el cliente avisa del límite).

## 5. Tema y semántica de color (verificado en `src/index.css` + `tailwind.config.js`)
- **Modo claro/oscuro** vía clase `.dark` (`darkMode: ["class"]`) y variables HSL en `:root` / `.dark`.
- Variables clave ya existen: `--success` (verde), `--destructive` (rojo), `--warning` (ámbar), `--chart-1..5`.
- **Regla de color del negocio:** **ingresos = verde (`--success`/`text-success`)**, **gastos = rojo (`--destructive`)**. Usar SIEMPRE estas variables (no hex hardcodeado) para que el modo oscuro funcione. Añadir icono/signo (+/−) además del color por accesibilidad (daltonismo).
- ⚠️ **Inconsistencia de fuente:** `tailwind.config.js` define `sans: Geist`, pero `index.css` define `--font-sans: Outfit`. Unificar.
- Tamaño de fuente con utilidades `html.font-compact|normal|accessible` (accesibilidad).

## 6. Supabase
- Cliente: `src/config/supabase.jsx` usa `import.meta.env.VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. ⚠️ No se pasan opciones de auth (`persistSession`, `autoRefreshToken`, `detectSessionInUrl`) — revisar.
- **~55 migraciones** en `supabase/migrations/`. ⚠️ Señales de alerta a auditar:
  - `supabase/disable_rls.sql` y `migrations/20260301_grant_all_public.sql` → posible **RLS deshabilitado / GRANT ALL a public** (riesgo de seguridad grave si está en prod).
  - Muchísimos `fix_*_rls*` y `fix_rls_recursion` → políticas RLS inestables/recursivas en el pasado.
  - Fechas inconsistentes (`20240201` … `20260207`) y archivos sin prefijo de fecha → orden de aplicación poco claro.

## 7. Estado de salud (verificado 2026-06-17)
- **Lint** (`npm run lint` = `eslint .`): ✅ sin errores.
- **Build** (`npm run build`): ✅ compila (~35s) **PERO** genera **un único bundle de 2.56 MB (758 KB gzip)** sin code-splitting → carga inicial lenta para clientes con conexión modesta. Falta `manualChunks` / `import()` dinámico.
- **Tests** (`npx vitest run`): **17/19 pasan**. ❌ Fallan **2 en `src/components/config/PlansPanel.test.jsx`**: `getByRole('button', {name:'Solicitar Premium'})` matchea **múltiples** elementos (selector ambiguo o UI duplicada). Resto verde.
- `caniuse-lite` desactualizado (warning menor): `npx update-browserslist-db@latest`.

## 8. Comandos
```bash
npm run dev       # Vite dev server (localhost) — SIEMPRE probar aquí antes de aprobar
npm run build     # build de producción
npm run preview   # previsualizar el build
npm run lint      # eslint .
npx vitest run    # tests una sola vez (NO usar --reporter=basic: vitest 4 no lo soporta)
```

## 9. Cómo trabajar en este proyecto (preferencias de Roberto)
1. **Nada por memoria.** Investigar/leer el código real y, cuando aplique, **buscar buenas prácticas en la web** y citarlas.
2. **Verificar de forma adversarial** ("council"): confirmar cada hallazgo en el código antes de afirmarlo.
3. **Probar en `localhost` SIEMPRE.** Si se añade un botón o acción, **probarlo** antes de marcarlo como terminado.
4. **Buscar la ruta más simple** al resultado deseado.
5. **UX para no técnicos** + **aspecto premium**: gráficas con animación, color con significado (gastos rojo / ingresos verde), respetar **modo claro/oscuro**.
6. Cuentas: **Supabase, GitHub, Netlify** (ver `CONEXIONES.md`). Secretos en `.env` / `.env.tooling` (gitignored), nunca en código.
7. Responder a Roberto en **español**.
8. **UI MOBILE-FIRST y PIXEL-PERFECT (regla dura).** Diseñar primero para móvil (~360–414 px) y luego escalar a desktop. En **toda** vista/cambio de UI hay que garantizar: nada **solapado**, nada **fuera de los límites de su contenedor** (sin overflow horizontal), todo **alineado**, y los campos de un mismo grupo con la **misma altura** (no unos más altos que otros). Usar grids/flex responsivos (apilar en móvil), respetar modo claro/oscuro y tokens de color. **Verificar SIEMPRE en localhost a ancho móvil y desktop** (Preview MCP `preview_resize`) antes de marcar ✅: el comportamiento esperado es ser experto UX/UI a nivel pixel-perfect.

## 10. Archivos guía del repo
- `CONEXIONES.md` — dónde poner las llaves de Supabase/GitHub/Netlify.
- `README.md`, `DESIGN.md`, `DOCUMENTACION_VISUAL.md`, `Especificacion_Almacen.md`, `INTEGRACION_PERMISOS.md`.
- `docs/PLAN_DE_TRABAJO.md` — **plan priorizado vigente** (auditoría council 2026-06-17: 1 crítico, 29 altos, 35 medios, 39 bajos). Empezar aquí.
- `docs/PLAN_*.md` (RBAC, arquitectura, downgrade, admin panel).
