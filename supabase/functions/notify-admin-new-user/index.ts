import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-push-hook-secret',
}

type Body = {
  test?: boolean
  user_id?: string | null
  email?: string | null
  plan_id?: string | null
  source?: string | null
  // Database webhook / trigger payload
  type?: string
  table?: string
  record?: {
    user_id?: string
    plan_id?: string
    admin_new_user_notified_at?: string | null
  } | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function cleanSecret(value: string | undefined | null): string {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '')
}

function b64UrlToBytes(input: string): Uint8Array {
  const cleaned = cleanSecret(input)
  const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4)
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64Url(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function vapidKeysFromBase64(publicKey: string, privateKey: string) {
  const pub = b64UrlToBytes(publicKey)
  const priv = b64UrlToBytes(privateKey)
  if (pub.length !== 65 || pub[0] !== 4) {
    throw new Error(
      `VAPID_PUBLIC_KEY inválida (bytes=${pub.length}, first=${pub[0] ?? 'n/a'}). Revisa el secreto en Dashboard (sin comillas).`,
    )
  }
  if (priv.length !== 32) {
    throw new Error(
      `VAPID_PRIVATE_KEY inválida (bytes=${priv.length}, se esperaban 32). Revisa el secreto en Dashboard.`,
    )
  }
  const x = bytesToB64Url(pub.slice(1, 33))
  const y = bytesToB64Url(pub.slice(33, 65))
  const d = bytesToB64Url(priv)

  return await webpush.importVapidKeys({
    publicKey: { kty: 'EC', crv: 'P-256', x, y, ext: true, key_ops: ['verify'] },
    privateKey: { kty: 'EC', crv: 'P-256', x, y, d, ext: true, key_ops: ['sign'] },
  })
}

async function loadVapidKeys() {
  const jwkText = String(Deno.env.get('VAPID_JWK_JSON') || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^['"]/, '')
    .replace(/['"]$/, '')
  if (jwkText) {
    try {
      return await webpush.importVapidKeys(JSON.parse(jwkText))
    } catch (err) {
      throw new Error(
        `VAPID_JWK_JSON inválido: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
  const publicKey = cleanSecret(Deno.env.get('VAPID_PUBLIC_KEY'))
  const privateKey = cleanSecret(Deno.env.get('VAPID_PRIVATE_KEY'))
  if (!publicKey || !privateKey) {
    throw new Error('Faltan secretos VAPID (VAPID_JWK_JSON o VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY).')
  }
  return await vapidKeysFromBase64(publicKey, privateKey)
}

function hookSecretOk(req: Request): boolean {
  const expected = cleanSecret(Deno.env.get('PUSH_HOOK_SECRET'))
  if (!expected) return false
  const got = cleanSecret(req.headers.get('x-push-hook-secret'))
  return Boolean(got) && got === expected
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Supabase env incompleto en la Edge Function' }, 500)
    }

    const authHeader = req.headers.get('Authorization') || ''
    const fromHook = hookSecretOk(req)
    const adminClient = createClient(supabaseUrl, serviceKey)
    const body = (await req.json().catch(() => ({}))) as Body

    let user: { id: string; email?: string | null } | null = null
    if (!fromHook) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const {
        data: { user: authUser },
        error: userError,
      } = await userClient.auth.getUser()
      if (userError || !authUser) {
        return json({ error: 'No autenticado' }, 401)
      }
      user = authUser

      if (body.test === true) {
        const { data: isAdmin, error: adminErr } = await userClient.rpc('is_system_admin')
        if (adminErr) return json({ error: adminErr.message }, 400)
        if (!isAdmin) return json({ error: 'Solo system admin puede enviar pruebas' }, 403)
      }
    }

    const isTest = body.test === true && !fromHook

    // Payload de trigger/webhook: { type, table, record }
    if (body.record?.user_id && !body.user_id) {
      body.user_id = body.record.user_id
      body.plan_id = body.record.plan_id || body.plan_id
      body.source = body.source || 'db_webhook'
    }

    let targetUserId = body.user_id || user?.id || ''
    let targetEmail = body.email || user?.email || ''
    let planId = body.plan_id || 'free'

    if (!targetUserId) {
      return json({ error: 'Falta user_id' }, 400)
    }

    if (!isTest) {
      if (!fromHook && user) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        })
        const { data: callerIsAdmin } = await userClient.rpc('is_system_admin')
        if (!callerIsAdmin && targetUserId !== user.id) {
          return json({ error: 'No autorizado' }, 403)
        }
        if (!callerIsAdmin) {
          targetUserId = user.id
          targetEmail = user.email || targetEmail
        }
      }

      const { data: sub, error: subErr } = await adminClient
        .from('subscriptions')
        .select('user_id, plan_id, admin_new_user_notified_at, created_at')
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (subErr) return json({ error: subErr.message }, 400)
      if (!sub) return json({ error: 'Suscripción no encontrada', skipped: true }, 200)
      if (sub.plan_id !== 'free') {
        return json({ skipped: true, reason: 'not_free' }, 200)
      }
      planId = 'free'
      if (sub.admin_new_user_notified_at) {
        return json({ skipped: true, reason: 'already_notified' }, 200)
      }

      const { data: marked, error: markErr } = await adminClient
        .from('subscriptions')
        .update({ admin_new_user_notified_at: new Date().toISOString() })
        .eq('user_id', targetUserId)
        .is('admin_new_user_notified_at', null)
        .select('user_id')
      if (markErr) return json({ error: markErr.message }, 400)
      if (!marked?.length) {
        return json({ skipped: true, reason: 'already_notified' }, 200)
      }

      if (!targetEmail) {
        const { data: authUser } = await adminClient.auth.admin.getUserById(targetUserId)
        targetEmail = authUser?.user?.email || ''
      }
    }

    const { data: admins, error: adminsErr } = await adminClient
      .from('system_admins')
      .select('user_id')
    if (adminsErr) return json({ error: adminsErr.message }, 400)

    const adminIds = (admins || []).map((a) => a.user_id).filter(Boolean)
    if (adminIds.length === 0) {
      return json({ sent: 0, reason: 'no_admins' }, 200)
    }

    const { data: subs, error: pushErr } = await adminClient
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id')
      .in('user_id', adminIds)

    if (pushErr) return json({ error: pushErr.message }, 400)
    if (!subs?.length) {
      return json({ sent: 0, reason: 'no_push_subscriptions' }, 200)
    }

    const vapidKeys = await loadVapidKeys()
    const appServer = await webpush.ApplicationServer.new({
      contactInformation: Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@gestia.app',
      vapidKeys,
    })

    const title = isTest ? 'Gestia · prueba' : 'Gestia · nuevo usuario'
    const bodyText = isTest
      ? 'Si ves esto, los avisos push del admin funcionan.'
      : `Nuevo usuario free: ${targetEmail || targetUserId}`

    const payload = JSON.stringify({
      title,
      body: bodyText,
      url: '/admin/planes',
      tag: isTest ? 'gestia-admin-test' : 'gestia-admin-new-user',
      data: {
        user_id: targetUserId,
        email: targetEmail,
        plan_id: planId,
        test: isTest,
      },
    })

    let sent = 0
    const failures: Array<{ id: string; error: string }> = []

    for (const row of subs) {
      try {
        const subscriber = appServer.subscribe({
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        })
        await subscriber.pushTextMessage(payload, {
          ttl: 60 * 60 * 12,
          urgency: webpush.Urgency.High,
        })
        sent += 1
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        failures.push({ id: row.id, error: message })
        const gone =
          (err instanceof webpush.PushMessageError && err.isGone()) ||
          /410|gone|unsubscribed/i.test(message)
        if (gone) {
          await adminClient.from('push_subscriptions').delete().eq('id', row.id)
        }
      }
    }

    return json({
      ok: true,
      test: isTest,
      sent,
      devices: subs.length,
      source: fromHook ? 'hook' : body.source || 'client',
      failures: failures.length ? failures : undefined,
      email: targetEmail || null,
    })
  } catch (err) {
    console.error('notify-admin-new-user error', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
