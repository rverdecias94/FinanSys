// Proxy de tasas informales Cuba.
// 1) elTOQUE TRMI si hay ELTOQUE_API_KEY (USD, EUR/ECU, MLC…).
// 2) Si no hay clave o falla → CambioCUP (público, sin clave; USD/CUP y MLC; sin EUR).
// Caché en memoria ~45 min para no golpear las fuentes.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ELTOQUE_URL = 'https://tasas.eltoque.com/v1/trmi'
const CAMBIOCUP_URL = 'https://www.cambiocup.com/api'
const CACHE_TTL_MS = 45 * 60 * 1000

type CacheEntry = {
  at: number
  payload: Record<string, unknown>
}

let memoryCache: CacheEntry | null = null

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function formatLocalWindow(now = new Date()) {
  const end = now
  const start = new Date(now.getTime() - 23 * 60 * 60 * 1000)
  const fmt = (d: Date) => {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    const h = String(d.getUTCHours()).padStart(2, '0')
    const min = String(d.getUTCMinutes()).padStart(2, '0')
    const s = String(d.getUTCSeconds()).padStart(2, '0')
    return `${y}-${m}-${day} ${h}:${min}:${s}`
  }
  return { date_from: fmt(start), date_to: fmt(end) }
}

function normalizeTasas(raw: Record<string, unknown> | null | undefined) {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw || {})) {
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) continue
    out[String(k).toUpperCase()] = n
  }
  if (out.ECU != null && out.EUR == null) out.EUR = out.ECU
  if (out.EUR != null && out.ECU == null) out.ECU = out.EUR
  return out
}

function asOfFromPayload(data: Record<string, unknown>) {
  const date = data?.date
  if (typeof date === 'string' && date.trim()) {
    const hour = Number(data.hour)
    const minutes = Number(data.minutes)
    const seconds = Number(data.seconds)
    const h = Number.isFinite(hour) ? String(hour).padStart(2, '0') : '00'
    const m = Number.isFinite(minutes) ? String(minutes).padStart(2, '0') : '00'
    const s = Number.isFinite(seconds) ? String(seconds).padStart(2, '0') : '00'
    return `${date}T${h}:${m}:${s}`
  }
  return null
}

function latestHistoryValue(rows: unknown): { value: number; updatedAt: string | null } | null {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const first = rows[0] as Record<string, unknown>
  const n = Number(first?.value)
  if (!Number.isFinite(n) || n <= 0) return null
  const updatedAt = typeof first.updated_at === 'string' ? first.updated_at : null
  return { value: n, updatedAt }
}

async function fetchElToque(apiKey: string) {
  const { date_from, date_to } = formatLocalWindow()
  const url = `${ELTOQUE_URL}?date_from=${encodeURIComponent(date_from)}&date_to=${encodeURIComponent(date_to)}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  })

  const text = await res.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    parsed = {}
  }

  if (!res.ok) {
    const msg =
      (typeof parsed?.message === 'string' && parsed.message) ||
      (typeof parsed?.error === 'string' && parsed.error) ||
      `elTOQUE respondió ${res.status}`
    const err = new Error(msg)
    ;(err as Error & { status?: number }).status = res.status
    throw err
  }

  const tasasRaw = (parsed.tasas || parsed.rates || parsed) as Record<string, unknown>
  const cupPerForeign = normalizeTasas(
    tasasRaw && typeof tasasRaw === 'object' && !Array.isArray(tasasRaw)
      ? (tasasRaw as Record<string, unknown>)
      : {}
  )

  if (!Object.keys(cupPerForeign).length) {
    throw new Error('elTOQUE no devolvió tasas en la respuesta')
  }

  return {
    ok: true,
    source: 'elTOQUE',
    sourceUrl: 'https://eltoque.com/tasas-de-cambio-cuba/mercado-informal',
    attribution: 'Tasa Representativa del Mercado Informal (TRMI) — elTOQUE',
    fetchedAt: new Date().toISOString(),
    asOf: asOfFromPayload(parsed),
    cupPerForeign,
    cached: false,
  }
}

/**
 * Fallback público sin API key.
 * CambioCUP / QvaPay: punto medio compra-venta P2P. Trae USD→CUP y MLC; no EUR.
 */
async function fetchCambioCup() {
  const res = await fetch(CAMBIOCUP_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`CambioCUP respondió ${res.status}`)
  }
  const data = (await res.json()) as Record<string, unknown>
  const cup = latestHistoryValue(data.cupHistory)
  const mlc = latestHistoryValue(data.mlcHistory)

  const cupPerForeign: Record<string, number> = {}
  if (cup) cupPerForeign.USD = Math.round(cup.value * 100) / 100
  // MLC en CambioCUP suele ser ratio vs USD (~1.4), no CUP/MLC.
  // Solo publicamos USD→CUP para no inventar conversión.

  if (!cupPerForeign.USD) {
    throw new Error('CambioCUP no devolvió una tasa USD/CUP usable')
  }

  return {
    ok: true,
    source: 'CambioCUP',
    sourceUrl: 'https://www.cambiocup.com/',
    attribution:
      'CambioCUP (mercado informal P2P / QvaPay) — referencia alternativa sin clave; no es elTOQUE',
    fetchedAt: new Date().toISOString(),
    asOf: cup?.updatedAt || mlc?.updatedAt || null,
    cupPerForeign,
    cached: false,
    note:
      'Fuente alternativa sin API key. Solo USD→CUP. Para EUR u otras, usa elTOQUE o introdúcelas a mano.',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const now = Date.now()
    if (memoryCache && now - memoryCache.at < CACHE_TTL_MS) {
      return jsonResponse({ ...memoryCache.payload, cached: true })
    }

    const apiKey = (Deno.env.get('ELTOQUE_API_KEY') || '').trim()
    let payload: Record<string, unknown> | null = null
    let eltoqueError: string | null = null

    if (apiKey) {
      try {
        payload = await fetchElToque(apiKey)
      } catch (err) {
        const status = (err as { status?: number })?.status
        const message = err instanceof Error ? err.message : String(err)
        console.error('elTOQUE falló, probando CambioCUP:', message)
        eltoqueError =
          status === 401 || status === 403
            ? 'clave elTOQUE inválida'
            : status === 429
              ? 'cuota elTOQUE'
              : message
      }
    }

    if (!payload) {
      try {
        payload = await fetchCambioCup()
        if (eltoqueError || !apiKey) {
          payload.fallbackReason = !apiKey
            ? 'Sin ELTOQUE_API_KEY; se usó CambioCUP'
            : `elTOQUE no disponible (${eltoqueError}); se usó CambioCUP`
        }
      } catch (fallbackErr) {
        const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
        console.error('CambioCUP también falló:', fbMsg)
        return jsonResponse(
          {
            ok: false,
            error: apiKey
              ? `No se pudo obtener tasa automática (${eltoqueError || 'elTOQUE'} / ${fbMsg}). Introdúcela a mano.`
              : `Sin clave elTOQUE y el respaldo público también falló (${fbMsg}). Introdúcela a mano.`,
          },
          200
        )
      }
    }

    memoryCache = { at: now, payload }
    return jsonResponse(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('informal-fx-rates error:', message)
    return jsonResponse(
      {
        ok: false,
        error: message || 'No se pudieron obtener las tasas del mercado informal',
      },
      200
    )
  }
})
