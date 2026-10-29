import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
// Solo :free. Primero el router free de OpenRouter; luego modelos concretos.
const TEXT_MODEL = Deno.env.get('OPENROUTER_TEXT_MODEL') || 'openrouter/free'
const TEXT_MODEL_FALLBACKS = (
  Deno.env.get('OPENROUTER_TEXT_FALLBACKS') ||
  [
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'nvidia/nemotron-3.5-lightning:free',
    'liquid/lfm-2.5-2.6b:free',
    'thinkingmachines/inkling:free',
    'recursive/flint-v1.0:free',
  ].join(',')
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const SPANISH_RULE =
  'IDIOMA OBLIGATORIO: responde SIEMPRE en español (de LatAm). Nunca uses inglés en la respuesta al usuario.'

const FINANCE_CATEGORIES = [
  'Ventas', 'Servicios', 'Otros Ingresos',
  'Alquiler', 'Servicios Públicos', 'Transporte', 'Alimentación',
  'Tecnología', 'Marketing', 'Nómina', 'Impuestos',
  'Mantenimiento', 'Suministros', 'Seguros', 'Otros Gastos',
]

type AiAction = 'extract_document' | 'parse_calc' | 'ask_business'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function extractJson(text: string): unknown {
  const trimmed = (text || '').trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1))
    }
    const aStart = trimmed.indexOf('[')
    const aEnd = trimmed.lastIndexOf(']')
    if (aStart >= 0 && aEnd > aStart) {
      return JSON.parse(trimmed.slice(aStart, aEnd + 1))
    }
    throw new Error('La IA no devolvió JSON válido')
  }
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function agingOverdue(row: Record<string, unknown> | null | undefined) {
  if (!row) return 0
  return num(row.d_1_30) + num(row.d_31_60) + num(row.d_61_90) + num(row.d_over_90)
}

function friendlyOpenRouterError(status: number, payload: Record<string, unknown>) {
  const err = (payload?.error || {}) as Record<string, unknown>
  const raw = String(err?.message || payload?.message || '').trim()
  const lower = raw.toLowerCase()

  if (status === 429 || lower.includes('rate limit')) {
    return 'El asistente está saturado ahora. Espera 1–2 minutos y reintenta; no es el cupo Ultra de GESTIA.'
  }
  if (status === 402 || lower.includes('credit') || lower.includes('insufficient')) {
    return 'El servicio de IA no tiene capacidad disponible ahora. Reintenta más tarde o contacta soporte.'
  }
  if (
    status === 502 ||
    status === 503 ||
    lower.includes('provider') ||
    lower.includes('overloaded') ||
    lower.includes('no available')
  ) {
    return 'El asistente no respondió. Reintenta en unos segundos.'
  }
  if (!raw || raw === 'Provider returned error' || lower.includes('openrouter') || lower.includes('modelo free')) {
    return 'El asistente no está disponible en este momento. Reintenta; si se repite, espera un minuto.'
  }
  return raw
}

async function openRouterOnce(
  apiKey: string,
  messages: unknown[],
  model: string,
  models?: string[],
) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': Deno.env.get('OPENROUTER_SITE_URL') || 'https://gestia.app',
      'X-Title': 'GESTIA Herramientas Ultra',
    },
    body: JSON.stringify({
      model,
      ...(models && models.length > 1 ? { models } : {}),
      temperature: 0.1,
      messages,
    }),
  })
  const payload = await res.json().catch(() => ({})) as Record<string, unknown>
  return { res, payload }
}

/** Llama a OpenRouter: primero lista `models`, si falla prueba uno a uno. */
async function callOpenRouter(messages: unknown[], model: string) {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY no configurada en la Edge Function')
  }

  const queue = [model, ...TEXT_MODEL_FALLBACKS.filter((m) => m !== model)]
  const unique = [...new Set(queue)]
  // OpenRouter: el campo `models` admite como máximo 3 entradas.
  const batchModels = unique.slice(0, 3)

  // 1) Intento con router/lista corta (OpenRouter hace fallback interno ≤3)
  let lastErr = 'Todos los modelos free fallaron a la vez.'
  {
    const { res, payload } = await openRouterOnce(apiKey, messages, batchModels[0], batchModels)
    if (res.ok) {
      const choices = payload?.choices as Array<{ message?: { content?: string } }> | undefined
      const content = choices?.[0]?.message?.content
      if (content) {
        return {
          text: String(content),
          modelUsed: String(payload?.model || batchModels[0]),
        }
      }
      lastErr = 'Respuesta vacía del modelo.'
    } else {
      lastErr = friendlyOpenRouterError(res.status, payload)
    }
  }

  // 2) Reintento secuencial uno a uno (incluye los que no entraron en el batch)
  for (const m of unique) {
    try {
      const { res, payload } = await openRouterOnce(apiKey, messages, m)
      if (!res.ok) {
        lastErr = friendlyOpenRouterError(res.status, payload)
        continue
      }
      const choices = payload?.choices as Array<{ message?: { content?: string } }> | undefined
      const content = choices?.[0]?.message?.content
      if (!content) {
        lastErr = 'Respuesta vacía del modelo.'
        continue
      }
      return {
        text: String(content),
        modelUsed: String(payload?.model || m),
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : lastErr
    }
  }

  throw new Error(
    `${lastErr} Si se repite, espera 1–2 minutos; no es el cupo Ultra de GESTIA.`,
  )
}

async function resolveOwnerId(supabase: SupabaseClient, userId: string, businessId: string | null) {
  if (businessId) return businessId
  const { data, error } = await supabase.rpc('get_user_business_context', { user_uuid: userId })
  if (error) throw error
  const ctx = typeof data === 'string' ? JSON.parse(data) : data
  return ctx?.businessId || userId
}

async function canPerm(supabase: SupabaseClient, ownerId: string, code: string) {
  const { data, error } = await supabase.rpc('has_permission_secure', {
    target_owner_id: ownerId,
    perm_code: code,
  })
  if (error) return false
  return data === true
}

async function buildBusinessSnapshot(supabase: SupabaseClient, ownerId: string) {
  const sources: string[] = []
  const snapshot: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    owner_id: ownerId,
  }

  const [
    canFinanzas,
    canWarehouse,
    canInventory,
    canLogs,
    canReports,
  ] = await Promise.all([
    canPerm(supabase, ownerId, 'finanzas.view'),
    canPerm(supabase, ownerId, 'warehouse.view'),
    canPerm(supabase, ownerId, 'inventory.view'),
    canPerm(supabase, ownerId, 'logs.view'),
    canPerm(supabase, ownerId, 'reports.view'),
  ])

  snapshot.permissions = {
    finanzas: canFinanzas,
    warehouse: canWarehouse,
    inventory: canInventory,
    logs: canLogs,
    reports: canReports,
  }

  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10)

  if (canFinanzas) {
    sources.push('finanzas')
    const { data: balances } = await supabase
      .from('business_balances')
      .select('currency_code, current_balance')
      .eq('user_id', ownerId)

    const balanceMap: Record<string, number> = {}
    for (const b of balances || []) {
      balanceMap[String(b.currency_code).toUpperCase()] = num(b.current_balance)
    }
    snapshot.balances = balanceMap

    const { data: monthTx } = await supabase
      .from('transactions')
      .select('amount, type, currency, category')
      .eq('user_id', ownerId)
      .gte('date', startMonth)
      .lt('date', endMonth)

    const income: Record<string, number> = {}
    const expense: Record<string, number> = {}
    const catIncome: Record<string, number> = {}
    const catExpense: Record<string, number> = {}
    for (const t of monthTx || []) {
      const cur = String(t.currency || 'USD').toUpperCase()
      const amt = num(t.amount)
      const cat = t.category || 'Sin categoría'
      if (t.type === 'income') {
        income[cur] = (income[cur] || 0) + amt
        catIncome[cat] = (catIncome[cat] || 0) + amt
      } else if (t.type === 'expense') {
        expense[cur] = (expense[cur] || 0) + amt
        catExpense[cat] = (catExpense[cat] || 0) + amt
      }
    }
    snapshot.month = {
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      income_by_currency: income,
      expense_by_currency: expense,
      top_income_categories: Object.entries(catIncome)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, total]) => ({ name, total })),
      top_expense_categories: Object.entries(catExpense)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, total]) => ({ name, total })),
    }

    const { data: agingRecv } = await supabase.rpc('get_aging_report', { p_direction: 'receivable' })
    const { data: agingPay } = await supabase.rpc('get_aging_report', { p_direction: 'payable' })
    snapshot.accounts_receivable = (agingRecv || []).map((r: Record<string, unknown>) => ({
      currency: r.currency,
      total: num(r.total),
      overdue: agingOverdue(r),
      not_due: num(r.not_due),
    }))
    snapshot.accounts_payable = (agingPay || []).map((r: Record<string, unknown>) => ({
      currency: r.currency,
      total: num(r.total),
      overdue: agingOverdue(r),
      not_due: num(r.not_due),
    }))
    sources.push('cxc', 'cxp')
  }

  if (canWarehouse) {
    // Columnas estables de products (sin costo promedio: el schema cache a veces falla).
    const { data: products, error: productsErr } = await supabase
      .from('products')
      .select('name, stock, min_stock, category, unit_price')
      .eq('user_id', ownerId)
      .limit(500)

    if (productsErr) {
      snapshot.warehouse = { error: 'No se pudo leer almacén', detail: productsErr.message }
    } else {
      sources.push('almacen')
      const list = products || []
      const lowStock = list
        .filter((p) => num(p.stock) <= num(p.min_stock || 5))
        .sort((a, b) => num(a.stock) - num(b.stock))
        .slice(0, 15)
        .map((p) => ({
          name: p.name,
          stock: num(p.stock),
          min_stock: num(p.min_stock || 5),
          category: p.category,
        }))

      const topByStock = [...list]
        .sort((a, b) => num(b.stock) - num(a.stock))
        .slice(0, 10)
        .map((p) => ({ name: p.name, stock: num(p.stock), category: p.category }))

      let inventoryValue = 0
      for (const p of list) {
        inventoryValue += num(p.stock) * num(p.unit_price || 0)
      }

      snapshot.warehouse = {
        total_products: list.length,
        low_stock_count: list.filter((p) => num(p.stock) <= num(p.min_stock || 5)).length,
        approx_inventory_value: Math.round(inventoryValue * 100) / 100,
        low_stock: lowStock,
        top_by_stock: topByStock,
      }
    }
  }

  if (canInventory) {
    sources.push('inventario')
    const { data: areas, error: areasErr } = await supabase
      .from('inventory_areas')
      .select('id, name')
      .eq('user_id', ownerId)
      .limit(50)

    if (!areasErr && areas) {
      snapshot.inventory_areas = {
        count: areas.length,
        names: areas.slice(0, 20).map((a) => a.name),
      }
    } else {
      // Tabla puede tener otro nombre en installs viejos; no fallar el chat
      snapshot.inventory_areas = { note: 'Áreas de inventario no disponibles en este snapshot' }
    }
  }

  if (canLogs) {
    sources.push('bitacora')
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('action, resource, area, user_email, created_at')
      .eq('business_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(12)

    snapshot.recent_audit = (logs || []).map((l) => ({
      action: l.action,
      resource: l.resource,
      area: l.area,
      user: l.user_email,
      at: l.created_at,
    }))
  }

  if (canReports || canFinanzas) {
    sources.push('reportes')
    snapshot.report_hint = {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      note: 'Usa month.income_by_currency / expense_by_currency y balances para hablar de reportes del periodo actual.',
    }
  }

  return { snapshot, sources: [...new Set(sources)] }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'No autenticado' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) return jsonResponse({ error: 'Sesión inválida' }, 401)

    const body = await req.json()
    const action = body?.action as AiAction
    const businessId = body?.businessId || null

    if (action !== 'extract_document' && action !== 'parse_calc' && action !== 'ask_business') {
      return jsonResponse({ error: 'Acción no soportada' }, 400)
    }

    if (action === 'extract_document') {
      const text = String(body?.text || '').trim()
      if (!text) {
        return jsonResponse({
          error: 'Falta el texto del comprobante. Usa la foto (OCR) o pega el texto.',
        }, 400)
      }
      if (text.length > 40000) {
        return jsonResponse({ error: 'Texto demasiado largo (máx. ~40.000 caracteres)' }, 400)
      }

      const pages = Math.max(1, Math.min(20, Number(body?.pageCount) || Math.ceil(text.length / 2500) || 1))

      const { data: quota, error: quotaError } = await supabase.rpc('consume_ai_quota', {
        p_kind: 'doc_pages',
        p_units: pages,
        p_business_id: businessId,
      })
      if (quotaError) {
        return jsonResponse({ error: quotaError.message || 'Cupo insuficiente' }, 403)
      }

      const system = `Eres un extractor contable para PYMES hispanohablantes (LatAm/Cuba).
${SPANISH_RULE}
Responde SOLO con un JSON válido (sin markdown) con esta forma:
{"rows":[{"date":"YYYY-MM-DD|null","amount":number|null,"currency":"USD|CUP|EUR|MXN|null","type":"income"|"expense"|null,"category":string|null,"description":string,"contact_name":string|null,"product_name":string|null,"unit_price":number|null,"quantity":number|null}]}
Reglas:
- Todos los textos (description, contact_name, product_name) en español.
- category debe ser una de: ${FINANCE_CATEGORIES.join(', ')} o null.
- Si hay varias líneas, crea varias filas.
- No inventes montos si no aparecen; usa null.
- El texto puede venir de OCR con errores; interpreta con sentido común pero no inventes cifras.`

      const ai = await callOpenRouter(
        [
          { role: 'system', content: system },
          { role: 'user', content: `Extrae las operaciones de este texto de comprobante/factura:\n\n${text}` },
        ],
        TEXT_MODEL,
      )

      const parsed = extractJson(ai.text) as { rows?: unknown[] }
      const rows = Array.isArray(parsed?.rows) ? parsed.rows : Array.isArray(parsed) ? parsed : []

      return jsonResponse({ rows, quota, pages, model: ai.modelUsed })
    }

    if (action === 'ask_business') {
      const question = String(body?.question || '').trim()
      if (!question) return jsonResponse({ error: 'Pregunta vacía' }, 400)
      if (question.length > 2000) return jsonResponse({ error: 'Pregunta demasiado larga' }, 400)

      // Comprobar cupo sin consumir aún (si falla el modelo free, no cobramos la consulta)
      const { data: usagePreview, error: usageErr } = await supabase.rpc('get_ai_usage', {
        p_business_id: businessId,
      })
      if (usageErr) {
        return jsonResponse({ error: usageErr.message || 'No se pudo leer el cupo' }, 403)
      }
      const used = Number(usagePreview?.calc_queries_used || 0)
      const limit = Number(usagePreview?.calc_queries_limit || 0)
      if (!usagePreview?.ai_tools) {
        return jsonResponse({ error: 'Las herramientas de IA requieren el plan Ultra' }, 403)
      }
      if (limit > 0 && used >= limit) {
        return jsonResponse({ error: 'Cupo de consultas del asistente agotado este mes' }, 403)
      }

      const ownerId = await resolveOwnerId(supabase, userData.user.id, businessId)
      // Preferir snapshot del cliente (más fiable); fallback a lectura server-side.
      let snapshot: Record<string, unknown>
      let sources: string[]
      const clientSnap = body?.snapshot
      const clientSources = body?.sources
      if (clientSnap && typeof clientSnap === 'object') {
        snapshot = clientSnap as Record<string, unknown>
        sources = Array.isArray(clientSources) ? clientSources.map(String) : []
      } else {
        try {
          const built = await buildBusinessSnapshot(supabase, ownerId)
          snapshot = built.snapshot
          sources = built.sources
        } catch (snapErr) {
          snapshot = {
            generated_at: new Date().toISOString(),
            owner_id: ownerId,
            error: snapErr instanceof Error ? snapErr.message : 'No se pudo armar el snapshot',
          }
          sources = []
        }
      }

      const system = `Eres el asistente de negocio de GESTIA para PYMES (tono cercano, sin jerga técnica).
${SPANISH_RULE}
Respondes SOLO con JSON válido (sin markdown):
{"answer":"texto en español con saltos de línea si hace falta","sources":["finanzas"|"almacen"|"cxc"|"cxp"|"bitacora"|"inventario"|"reportes"],"next_step":"sugerencia corta o null"}

Reglas DURAS:
1. Usa ÚNICAMENTE los números y hechos del SNAPSHOT. Nunca inventes saldos, stock, fechas ni montos.
2. Si el dato no está en el snapshot o el permiso es false, di que no tienes ese dato y sugiere dónde mirarlo en la app (Finanzas, Almacén, Por cobrar, Bitácora, Reportes).
3. Formatea montos con moneda (ej. 2.075 USD). Sé concreto y breve (máx. ~180 palabras).
4. Para preguntas de escenarios (¿me alcanza?, convertir FX, margen, cobro %), calcula solo con cifras del snapshot + lo que diga el usuario; si falta tasa/dato, dilo.
5. No ofrezcas crear/editar transacciones ni borrar datos; solo consultas.
6. sources debe listar solo dominios que realmente usaste del snapshot.
7. Los campos answer y next_step SIEMPRE en español.`

      let ai: { text: string; modelUsed: string }
      try {
        ai = await callOpenRouter(
          [
            { role: 'system', content: system },
            {
              role: 'user',
              content: `SNAPSHOT del negocio (JSON):\n${JSON.stringify(snapshot)}\n\nPregunta del usuario:\n${question}`,
            },
          ],
          TEXT_MODEL,
        )
      } catch (orErr) {
        const msg = orErr instanceof Error ? orErr.message : 'El modelo free no respondió'
        return jsonResponse({
          error: msg || 'El modelo free no respondió. Espera un minuto y pulsa Reintentar.',
        }, 502)
      }

      // Solo consumir cupo si el modelo respondió
      const { data: quota, error: quotaError } = await supabase.rpc('consume_ai_quota', {
        p_kind: 'calc_queries',
        p_units: 1,
        p_business_id: businessId,
      })
      if (quotaError) {
        // Respuesta útil pero no se pudo descontar: devolvemos igual con aviso
        console.error('consume_ai_quota falló tras respuesta IA:', quotaError.message)
      }

      let answer = ''
      let usedSources: string[] = sources
      let nextStep: string | null = null
      try {
        const parsed = extractJson(ai.text) as {
          answer?: string
          sources?: string[]
          next_step?: string | null
        }
        answer = String(parsed?.answer || '').trim()
        if (Array.isArray(parsed?.sources) && parsed.sources.length) {
          usedSources = parsed.sources.map(String)
        }
        nextStep = parsed?.next_step ? String(parsed.next_step) : null
      } catch {
        answer = String(ai.text || '').trim().slice(0, 2500)
      }

      if (!answer) {
        answer = 'No pude armar una respuesta con los datos disponibles. Prueba otra pregunta o revisa Finanzas / Almacén.'
      }

      return jsonResponse({
        answer,
        sources: usedSources,
        next_step: nextStep,
        snapshot_meta: {
          domains: sources,
          generated_at: snapshot.generated_at,
        },
        quota: quota || usagePreview,
        model: ai.modelUsed,
      })
    }

    // parse_calc (legado): se mantiene por compatibilidad
    const { data: quota, error: quotaError } = await supabase.rpc('consume_ai_quota', {
      p_kind: 'calc_queries',
      p_units: 1,
      p_business_id: businessId,
    })
    if (quotaError) {
      return jsonResponse({ error: quotaError.message || 'Cupo insuficiente' }, 403)
    }

    const question = String(body?.question || '').trim()
    if (!question) return jsonResponse({ error: 'Pregunta vacía' }, 400)

    const context = body?.context || {}
    const system = `Eres un parser de calculadora financiera para GESTIA (NO eres un chat libre).
${SPANISH_RULE}
Responde SOLO JSON válido (sin markdown).

Si la pregunta ENCaja en un modo, responde:
{"mode":"affordability"|"fx"|"margin"|"collection","params":{...},"confidence":0.0-1.0}

Modos permitidos (únicos):
- affordability: ¿me alcanza para pagar X? params {expenses:[{label,amount,currency}]}
- fx: convertir dinero. params {amount, fromCurrency, toCurrency}
- margin: margen/ganancia de venta. params {cost, sellPrice, quantity, currency}
- collection: escenario de cobro de CxC vencida. params {percent, currency}

Si NO encaja, responde:
{"mode":"unsupported","reason":"frase corta en español","suggestion":"usa el Asistente de Herramientas para preguntas de inventario, bitácora o reportes"}

Reglas: reason/suggestion/labels siempre en español. No inventes modos.`

    const ai = await callOpenRouter(
      [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Contexto del negocio: ${JSON.stringify(context)}\nPregunta del usuario: ${question}`,
        },
      ],
      TEXT_MODEL,
    )

    const parsed = extractJson(ai.text) as Record<string, unknown>
    const mode = String(parsed?.mode || '')
    const confidence = Number(parsed?.confidence)
    if (
      mode !== 'unsupported' &&
      Number.isFinite(confidence) &&
      confidence < 0.45
    ) {
      return jsonResponse({
        parsed: {
          mode: 'unsupported',
          reason: 'No estoy seguro de cómo mapear esa pregunta.',
          suggestion: 'Usa el Asistente para preguntas libres sobre tu negocio.',
        },
        quota,
        model: ai.modelUsed,
      })
    }

    return jsonResponse({ parsed, quota, model: ai.modelUsed })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    return jsonResponse({ error: message }, 500)
  }
})
