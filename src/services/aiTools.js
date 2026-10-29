import { supabase } from '@/config/supabase'

export async function getAiUsage(businessId) {
  const { data, error } = await supabase.rpc('get_ai_usage', {
    p_business_id: businessId || null,
  })
  if (error) throw error
  return data
}

/**
 * Extrae filas desde texto de comprobante (OpenRouter free = solo texto; sin visión).
 * pageCount: se usa para cupo (aprox. por longitud si no se pasa).
 */
export async function extractDocumentFromText({ text, pageCount, businessId }) {
  const trimmed = String(text || '').trim()
  if (!trimmed) throw new Error('Escribe o pega el texto del comprobante')

  const pages = Math.max(
    1,
    Math.min(20, Number(pageCount) || Math.ceil(trimmed.length / 2500) || 1)
  )

  const { data, error } = await supabase.functions.invoke('ai-tools', {
    body: {
      action: 'extract_document',
      businessId: businessId || null,
      text: trimmed,
      pageCount: pages,
    },
  })

  if (error) throw new Error(error.message || 'Error al llamar a la herramienta IA')
  if (data?.error) throw new Error(data.error)
  return data
}

/** Interpreta una pregunta en español hacia un modo/params de calculadora (legado). */
export async function parseCalculatorQuestion({ question, context, businessId }) {
  const { data, error } = await supabase.functions.invoke('ai-tools', {
    body: {
      action: 'parse_calc',
      businessId: businessId || null,
      question,
      context: context || {},
    },
  })

  if (error) throw new Error(error.message || 'Error al llamar a la herramienta IA')
  if (data?.error) throw new Error(data.error)
  return data
}

/** Pregunta al asistente de negocio (snapshot del cliente + respuesta grounded). */
export async function askBusinessQuestion({ question, businessId, userId }) {
  const trimmed = String(question || '').trim()
  if (!trimmed) throw new Error('Escribe una pregunta')

  let snapshotPayload = null
  try {
    const { buildClientBusinessSnapshot } = await import('@/services/businessSnapshot')
    snapshotPayload = await buildClientBusinessSnapshot({
      userId: userId || null,
      businessId: businessId || null,
    })
  } catch (err) {
    console.warn('Snapshot cliente incompleto:', err?.message)
  }

  const { data, error } = await supabase.functions.invoke('ai-tools', {
    body: {
      action: 'ask_business',
      businessId: businessId || null,
      question: trimmed,
      // Preferimos snapshot del cliente (evita fallos de schema en la Edge)
      snapshot: snapshotPayload?.snapshot || null,
      sources: snapshotPayload?.sources || null,
    },
  })

  const fromData =
    typeof data?.error === 'string'
      ? data.error
      : (data?.error?.message || null)

  if (fromData && String(fromData).trim()) {
    throw new Error(String(fromData).trim())
  }

  if (error) {
    let detail = ''
    try {
      const ctx = error.context
      if (ctx) {
        if (typeof ctx.json === 'function') {
          const body = await ctx.json()
          detail = typeof body?.error === 'string' ? body.error : (body?.error?.message || '')
        } else if (typeof ctx.text === 'function') {
          const raw = await ctx.text()
          try {
            const body = JSON.parse(raw)
            detail = typeof body?.error === 'string' ? body.error : ''
          } catch {
            detail = raw
          }
        }
      }
    } catch {
      // ignore
    }
    const fallback = (error.message || '').trim()
    const msg = (detail || fallback || '').trim()
    if (!msg || /non-2xx|failed to (send|fetch)/i.test(msg)) {
      throw new Error(
        'No pude responder ahora. Espera unos segundos y pulsa Reintentar (no consume tu cupo Ultra).'
      )
    }
    if (/openrouter|modelo free|:free|provider returned|models' array/i.test(msg)) {
      throw new Error(
        'El asistente no está disponible en este momento. Espera un minuto y pulsa Reintentar.'
      )
    }
    throw new Error(msg)
  }
  return data
}

/** Lee un .txt / .csv como texto plano. */
export function readPlainTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsText(file, 'UTF-8')
  })
}

/** OCR local (Tesseract.js) — sin visión de pago. Carga diferida del worker. */
export async function ocrImageToText(fileOrBlob, { onProgress } = {}) {
  if (!fileOrBlob) throw new Error('No hay imagen')
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa', 1, {
    logger: (m) => {
      if (typeof onProgress === 'function' && m?.status === 'recognizing text') {
        onProgress(Math.round((m.progress || 0) * 100))
      }
    },
  })
  try {
    const { data } = await worker.recognize(fileOrBlob)
    return String(data?.text || '').trim()
  } finally {
    await worker.terminate()
  }
}
