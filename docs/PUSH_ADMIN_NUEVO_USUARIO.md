# Avisos push al admin cuando entra un usuario free

Guía para principiantes. Objetivo: cuando alguien nuevo entra a Gestia con plan
**Inicial (free)**, a **ti** (system admin) te suena una notificación en el teléfono
o laptop **aunque Gestia esté cerrada**.

---

## 1. Qué se construyó

| Pieza | Dónde |
|--------|--------|
| Tabla de dispositivos | `push_subscriptions` (migración `20261108_push_subscriptions_admin_alerts.sql`) |
| Botón para activar | **Admin → Planes** → tarjeta **Avisos push (admin)** |
| Service worker push | `public/push-handler.js` (importado por la PWA) |
| Envío del aviso | Edge Function `notify-admin-new-user` |
| Disparo | Al crear la suscripción free en el login (`Login.jsx`) |

---

## 2. Qué tienes que configurar tú (una sola vez)

### A) Clave pública en el frontend

En tu `.env` local (ya se puede añadir) y en **Netlify → Environment variables**:

```bash
VITE_VAPID_PUBLIC_KEY=BIXvYVNJmiUZCgM1vSwdA-lFXg-5P1OVIGombob_uuBLWkz7PXxPdemcBABZGsRpSXYEuZk442mGkjozwIKlODU
```

Luego **vuelve a desplegar** Netlify (las `VITE_*` solo entran en el build).

### B) Claves privadas en Supabase (Edge Function Secrets)

1. Entra a [Supabase Dashboard](https://supabase.com/dashboard) → proyecto **PymeManager**.
2. **Project Settings → Edge Functions → Secrets** (o Edge Functions → Secrets).
3. Abre el archivo local `vapid-private.local` y crea **este secreto** (recomendado):

| Nombre | Valor |
|--------|--------|
| `VAPID_JWK_JSON` | la línea completa que empieza por `{"publicKey":...` (sin el prefijo `VAPID_JWK_JSON=`) |

Si ya tenías `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` mal pegados (con comillas o espacios),
**bórralos** y usa solo `VAPID_JWK_JSON`.

> La **privada nunca** va en `.env` del frontend ni en Git.

### C) Desplegar la Edge Function

Si aún no está desplegada:

```bash
npx supabase functions deploy notify-admin-new-user --project-ref obsxmmwrzsaahjmlhtxd
```

### D) Aplicar la migración

Debe existir la tabla `push_subscriptions`. Si el agente no la aplicó por MCP:

```bash
npx supabase db push
```

o ejecuta el SQL de `supabase/migrations/20261108_push_subscriptions_admin_alerts.sql`
en el SQL Editor.

---

## 3. Cómo activarlo en tu dispositivo

1. Despliega / abre Gestia en **producción** o `npm run build && npm run preview`
   (el push **no funciona** en `npm run dev`: ahí no hay service worker).
2. Entra con tu cuenta **system admin**.
3. Ve a **Sistema → Admin Planes**.
4. En la tarjeta **Avisos push (admin)** pulsa **Activar en este dispositivo**.
5. El navegador pregunta *¿Permitir notificaciones?* → **Permitir**.
6. Pulsa **Enviar prueba**. Debe aparecer una notificación del sistema.

Repite el paso 4–5 en el **teléfono** (PWA instalada o Chrome) si también quieres
avisos ahí.

---

## 4. Cómo comprobar el caso real

1. Con otra cuenta / ventana privada, crea un usuario nuevo y confirma el correo.
2. Inicia sesión (ahí se crea la suscripción free).
3. En tu admin debería sonar: *Nuevo usuario free: correo@…*

Si no suena:
- ¿Activaste push en al menos un dispositivo admin?
- ¿Secretos VAPID puestos en Supabase?
- ¿Netlify tiene `VITE_VAPID_PUBLIC_KEY` y se redesplegó?
- Revisa logs de la función: Dashboard → Edge Functions → `notify-admin-new-user` → Logs.

---

## 5. Limitaciones (normales)

- **iPhone:** suele requerir Gestia **instalada** en la pantalla de inicio (Safari).
- Si borras datos del navegador o revocas el permiso, hay que **Activar** otra vez.
- Un mismo alta free solo avisa **una vez** (`subscriptions.admin_new_user_notified_at`).
