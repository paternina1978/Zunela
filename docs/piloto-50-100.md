# Piloto 50–100 — Supabase cloud + Railway

Tras §2b / §6b (Docker local) y slice `018`.  
Stack: **Supabase** (Auth + Postgres + RLS) y **Railway** (Next.js PWA).

## 1. Supabase (proyecto Zunela) — ya avanzado

- **Ref:** `lseadxgeffktdnqgknhd`
- **URL:** `https://lseadxgeffktdnqgknhd.supabase.co`
- **Org:** NexIA · schema `principal` (producción)

1. ~~SQL `001`–`018`~~ **Hecho**
2. Email Auth habilitado; Confirm email off *o* flujo `/auth/callback`
3. **URL Configuration** (después del primer deploy Railway): Site URL + Redirect = dominio Railway
4. Key cliente: publishable `sb_publishable_…` (nunca `service_role` / `sb_secret_…` en la app)

## 2. Railway — crear el proyecto (paso a paso)

Railway **no crea solo** el proyecto: lo creas tú en el dashboard (o con CLI).  
Hoy el código está en `C:\AppsIsaac\Zunela` y **aún no es un repo git remoto**; Railway necesita GitHub/GitLab **o** un deploy desde CLI.

### 2.1 Subir el código a GitHub (recomendado)

1. Crea un repo vacío en GitHub (privado), p. ej. `Zunela`.
2. En PowerShell, desde la raíz del proyecto:

```powershell
cd C:\AppsIsaac\Zunela
git init
git add .
git commit -m "Piloto ZUNELA: PWA + Supabase 001-018"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/Zunela.git
git push -u origin main
```

(No subas `.env.local`; ya está ignorado.)

### 2.2 Crear el proyecto en Railway

1. Entra a [https://railway.app](https://railway.app) e inicia sesión (GitHub).
2. **New Project** (o **Create a New Project**).
3. Elige **Deploy from GitHub repo**.
4. Autoriza Railway si pide acceso a repos.
5. Selecciona el repo **Zunela** (el que acabas de pushear).
6. Si pregunta servicio: **Add service** → ese mismo repo.

Todavía **no** habrá URL pública hasta configurar root + variables y desplegar.

### 2.3 Root Directory = `zunela-web`

1. Abre el **servicio** (la caja del deploy).
2. **Settings** → **Root Directory** → escribe exactamente: `zunela-web`
3. Guarda. Así usa `package.json`, `railway.toml` y `nixpacks.toml` de esa carpeta.

### 2.4 Variables de entorno

En el mismo servicio → **Variables** → **Add variable** (o Raw Editor) y pega:

```env
NEXT_PUBLIC_ZUNELA_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://lseadxgeffktdnqgknhd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_wAgYL-cVGSj0wr3aNBEf7Q_r7-jQAv9
```

(Si rotas la key en Supabase, actualiza solo la tercera.)

### 2.5 Generar dominio y desplegar

1. **Settings** → **Networking** → **Generate Domain** (queda algo como `xxx.up.railway.app`).
2. Copia esa URL.
3. Si el deploy no arrancó solo: pestaña **Deployments** → **Redeploy**.
4. Espera a que el build diga **Success** (`npm ci` + `npm run build` + `npm run start`).

### 2.6 Cerrar el círculo en Supabase

Authentication → URL Configuration:

- **Site URL:** `https://TU-DOMINIO.up.railway.app`
- **Redirect URLs:**  
  `https://TU-DOMINIO.up.railway.app/**`  
  `https://TU-DOMINIO.up.railway.app/auth/callback`

### 2.7 Probar

1. Abre la URL Railway.
2. Crear primera cuenta → perfil → intereses → **Soy el primer administrador**.
3. Segunda cuenta: match / chat.
4. Copia remota / borrado en cuenta no-admin.

## 3. Si no quieres GitHub todavía (CLI)

1. Instala CLI: `npm i -g @railway/cli`
2. `railway login`
3. `cd C:\AppsIsaac\Zunela\zunela-web`
4. `railway init` → crea proyecto/servicio
5. `railway variables set NEXT_PUBLIC_ZUNELA_BACKEND=supabase NEXT_PUBLIC_SUPABASE_URL=https://lseadxgeffktdnqgknhd.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...`
6. `railway up`  
   Luego genera el dominio en el dashboard (§2.5).

## 4. Criterios antes de ampliar a 50+

- [x] SQL `001`–`018` en cloud Zunela
- [x] Repo en GitHub (`paternina1978/Zunela`)
- [x] Railway online: `https://zunela-production.up.railway.app` (Dockerfile)
- [x] Auth redirects con `https://` (Site URL + `/auth/callback`)
- [x] Primer admin cloud (bootstrap) + flujo multi-cuenta listo
- [x] IA apagada / fail-closed (APIs y stubs)
- [ ] Recorrer runbook §2b en producción con 2 cuentas reales
- [ ] Google OAuth (pausado: requiere tarjeta en Google Cloud)

## 5. Fuera de alcance

Pagos, Premium cobrado, agentes OpenAI, Circles Fase 3.
