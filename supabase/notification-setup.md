# Configuración de Supabase para Notificaciones en Tiempo Real

## 1. Habilitar Realtime en tu tabla appointments_dynamic

En tu consola de Supabase, ejecuta:

```sql
-- Habilitar Realtime para la tabla appointments_dynamic
ALTER TABLE appointments_dynamic REPLICA IDENTITY FULL;

-- Crear tabla para logs de notificaciones (opcional pero recomendado)
CREATE TABLE notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID REFERENCES providers(uuid),
  appointment_id UUID REFERENCES appointments_dynamic(id),
  notification_type TEXT NOT NULL,
  status TEXT NOT NULL,
  response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Añadir columna para tokens de notificación a la tabla providers
ALTER TABLE providers 
ADD COLUMN IF NOT EXISTS notification_token TEXT;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_notification_logs_provider_id ON notification_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);
```

## 2. Configurar Webhook en Supabase

1. Ve a tu consola de Supabase → **Database** → **Webhooks**
2. Crea un nuevo webhook con:
   - **Name**: `appointment-notification`
   - **Table**: `appointments_dynamic`
   - **Events**: `INSERT`
   - **URL**: `https://[TU-PROYECTO].supabase.co/functions/v1/appointment-notification`
   - **Headers**: 
     ```json
     {
       "Authorization": "Bearer [TU-ANON-KEY]"
     }
     ```

## 3. Variables de entorno necesarias para la Edge Function

En tu consola de Supabase → **Settings** → **Edge Functions**, añade estas variables:

```
SUPABASE_URL=https://[TU-PROYECTO].supabase.co
SUPABASE_ANON_KEY=[TU-ANON-KEY]
FIREBASE_PROJECT_ID=[TU-PROJECT-ID-DE-FIREBASE]
FCM_ACCESS_TOKEN=[TU-ACCESS-TOKEN-DE-FIREBASE]
```

## 4. Configurar Firebase Cloud Messaging (FCM)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un proyecto o usa uno existente
3. Ve a **Project Settings** → **Cloud Messaging**
4. Copia el **Server Key** (clave del servidor)
5. Añádela como variable de entorno `FCM_SERVER_KEY`

## 5. Instalar y configurar el cliente de notificaciones

```bash
npm install firebase @supabase/supabase-js
```

## 6. Desplegar la Edge Function

```bash
# Instalar Supabase CLI si no lo tienes
npm install -g supabase

# Iniciar sesión
supabase login

# Enlazar con tu proyecto
supabase link --project-ref [TU-PROYECTO]

# Desplegar la función
supabase functions deploy appointment-notification
```