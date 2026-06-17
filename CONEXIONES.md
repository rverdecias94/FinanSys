# 🔌 Conexiones a Cuentas — GESTIA / Sistema Contable

Este es **el archivo donde defines dónde van las llaves de tus cuentas** (Supabase, GitHub, Netlify). Aquí solo se explica *qué es cada cosa y de dónde sacarla*. **Los secretos reales NO se escriben en este `.md`** (porque se sube a Git), sino en archivos `.env` que están protegidos por `.gitignore`.

## 📁 Resumen: qué archivo uso para cada cosa

| Archivo | ¿Se sube a Git? | Qué contiene | Quién lo usa |
|---|---|---|---|
| `.env.example` | ✅ Sí (plantilla) | Llaves públicas de ejemplo | Referencia |
| `.env` | ❌ No (secreto) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | La app en el navegador |
| `.env.tooling.example` | ✅ Sí (plantilla) | Secretos de admin de ejemplo | Referencia |
| `.env.tooling` | ❌ No (secreto) | Tokens de Supabase admin, GitHub, Netlify | **Yo (Claude)** para migraciones y despliegues |

> **Regla de oro de seguridad:** las variables `VITE_*` viajan al navegador del cliente y son públicas. La `service_role` de Supabase, contraseñas de BD y tokens de GitHub/Netlify **nunca** llevan `VITE_` y **nunca** van en `.env` — van en `.env.tooling`.

---

## 🚀 Paso a paso (hazlo una sola vez)

```bash
# 1. Frontend (esto ya lo tienes configurado, solo verifica)
cp .env.example .env

# 2. Tooling/migraciones (esto es lo nuevo que necesito)
cp .env.tooling.example .env.tooling
```

Luego abre cada archivo y pega los valores reales según las guías de abajo.

---

## 1) 🟢 Supabase

### A) Para la app (ya configurado en tu `.env`)
1. Entra a tu proyecto en https://supabase.com/dashboard
2. **Project Settings → API**
3. Copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Project API keys → `anon` `public`** → `VITE_SUPABASE_ANON_KEY`

### B) Para que yo aplique migraciones (`.env.tooling`)
| Variable | Dónde sacarla |
|---|---|
| `SUPABASE_PROJECT_REF` | Settings → General → **Reference ID** |
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens → *Generate new token* (empieza con `sbp_`) |
| `SUPABASE_DB_PASSWORD` | Settings → Database → **Database password** (si no la recuerdas, *Reset database password*) |
| `SUPABASE_DB_URL` | Settings → Database → **Connection string → URI** |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → **service_role** ⚠️ (omite RLS — máximo cuidado) |

> Con `PROJECT_REF` + `ACCESS_TOKEN` puedo usar el **Supabase CLI** para enlazar el proyecto y correr migraciones de forma controlada. La `service_role` solo la necesito para scripts puntuales; si prefieres no dármela, dímelo y trabajo solo con el CLI.

---

## 2) ⚫ GitHub
| Variable | Dónde sacarla |
|---|---|
| `GITHUB_REPO` | El `owner/repo`, ej. `roberto/sistema-contable` |
| `GITHUB_TOKEN` | https://github.com/settings/tokens → *Fine-grained token* con permiso **Contents: Read/Write** sobre el repo (o *classic* con scope `repo`) |

> Si el repo aún no existe en GitHub, dímelo y te guío para crearlo y subir el código.

---

## 3) 🔵 Netlify
| Variable | Dónde sacarla |
|---|---|
| `NETLIFY_SITE_ID` | Site configuration → General → Site details → **Site ID** (API ID) |
| `NETLIFY_AUTH_TOKEN` | https://app.netlify.com/user/applications → **Personal access tokens** → *New access token* |

> En Netlify, además, recuerda configurar las **mismas variables `VITE_*`** en *Site settings → Environment variables*, porque el build de producción las necesita (no se suben en el `.env`).

---

## ✅ Checklist
- [ ] `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- [ ] `.env.tooling` con los datos de Supabase admin
- [ ] `.env.tooling` con GitHub (`GITHUB_REPO`, `GITHUB_TOKEN`)
- [ ] `.env.tooling` con Netlify (`NETLIFY_SITE_ID`, `NETLIFY_AUTH_TOKEN`)
- [ ] Variables `VITE_*` también cargadas en el panel de Netlify
- [ ] Confirmé que `.env` y `.env.tooling` **NO** aparecen en `git status`

> Cuando termines de llenar `.env.tooling`, avísame y verifico la conexión a cada servicio antes de tocar nada.
