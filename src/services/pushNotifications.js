import { supabase } from '@/config/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function getVapidPublicKey() {
  return String(VAPID_PUBLIC_KEY || '').trim()
}

async function getReadyRegistration() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Este navegador no soporta service workers.')
  }
  const reg = await navigator.serviceWorker.ready
  if (!reg?.pushManager) {
    throw new Error('Push no disponible. Abre Gestia en la versión instalada o en producción/preview.')
  }
  return reg
}

export async function getCurrentPushSubscription() {
  if (!isPushSupported()) return null
  try {
    const reg = await getReadyRegistration()
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

/**
 * Pide permiso, crea la suscripción Web Push y la guarda en BD (solo system admin).
 */
export async function enableAdminPush() {
  if (!isPushSupported()) {
    throw new Error('Tu navegador no soporta notificaciones push.')
  }
  const vapidKey = getVapidPublicKey()
  if (!vapidKey) {
    throw new Error('Falta VITE_VAPID_PUBLIC_KEY. Revisa .env y Netlify (ver docs/PUSH_ADMIN_NUEVO_USUARIO.md).')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Permiso denegado. Activa las notificaciones en la configuración del navegador.')
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user?.id) throw new Error('Debes iniciar sesión.')

  const reg = await getReadyRegistration()
  let subscription = await reg.pushManager.getSubscription()
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  const json = subscription.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    throw new Error('La suscripción del navegador no trajo las claves esperadas.')
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,endpoint' },
  )
  if (error) throw error

  return { endpoint }
}

export async function disableAdminPush() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return

  const subscription = await getCurrentPushSubscription()
  const endpoint = subscription?.endpoint

  if (subscription) {
    try {
      await subscription.unsubscribe()
    } catch {
      // ignore
    }
  }

  if (endpoint) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)
  } else {
    await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  }
}

export async function listMyPushSubscriptions() {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, user_agent, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Aviso de prueba al dispositivo del admin actual.
 */
export async function sendAdminPushTest() {
  const { data, error } = await supabase.functions.invoke('notify-admin-new-user', {
    body: { test: true },
  })
  if (data?.error) throw new Error(data.error)
  if (error) {
    // supabase-js a menudo solo dice "non-2xx"; si el body trae detalle, úsalo.
    const detail = typeof data === 'object' && data ? data.error || data.message : null
    throw new Error(detail || error.message || 'Falló la Edge Function')
  }
  return data
}

/**
 * Dispara el aviso a los admins cuando un dueño nuevo recibe plan free.
 * Fire-and-forget: no debe bloquear el login.
 */
export async function notifyAdminsNewFreeUser({ userId, email } = {}) {
  try {
    const { data, error } = await supabase.functions.invoke('notify-admin-new-user', {
      body: {
        user_id: userId || null,
        email: email || null,
        plan_id: 'free',
      },
    })
    if (error) {
      console.warn('[push] notify-admin-new-user:', error.message || error)
      return null
    }
    return data
  } catch (err) {
    console.warn('[push] notify-admin-new-user failed:', err)
    return null
  }
}
