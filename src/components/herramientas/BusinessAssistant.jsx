/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, History, Loader2, MessageCircle, Plus, RefreshCw, Send, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { getDashboardStats, getAgingReport } from '@/services/finanzas'
import { askBusinessQuestion } from '@/services/aiTools'
import {
  clearLocalChatState,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  readLocalChatState,
  titleFromMessages,
  updateConversation,
  welcomeMessage,
  writeLocalChatState,
} from '@/services/aiConversations'
import { agingOverdue } from '@/utils/aging'
import { ExampleChips } from '@/components/herramientas/ExampleChips'
import { cn } from '@/lib/utils'

const SOURCE_LABELS = {
  finanzas: 'Finanzas',
  almacen: 'Almacén',
  cxc: 'Por cobrar',
  cxp: 'Por pagar',
  bitacora: 'Auditoría',
  inventario: 'Inventario',
  reportes: 'Reportes',
}

const FRIENDLY_ASK_ERROR =
  'No pude responder ahora. Espera un momento y pulsa Reintentar.'

function roundMoney(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 100) / 100
}

function hasRealExchange(messages) {
  return (messages || []).some((m) => m.role === 'user')
}

function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function BusinessAssistant({ onQuotaChange }) {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { businessCurrencies, formatCurrency } = useCurrency()
  const userId = session?.user?.id
  const queryClient = useQueryClient()
  const listRef = useRef(null)
  const saveTimer = useRef(null)
  const hydrated = useRef(false)
  const conversationIdRef = useRef(null)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([welcomeMessage()])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const setActiveConversationId = useCallback((id) => {
    conversationIdRef.current = id
    setConversationId(id)
  }, [])

  const baseCurrency = useMemo(
    () => businessCurrencies?.find((c) => c.is_default)?.code || businessCurrencies?.[0]?.code || 'USD',
    [businessCurrencies]
  )

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats', userId, businessId],
    queryFn: () => getDashboardStats(userId, businessId),
    enabled: !!userId,
    staleTime: 60_000,
  })

  const agingQuery = useQuery({
    queryKey: ['aging', 'receivable', businessId || userId],
    queryFn: () => getAgingReport('receivable'),
    enabled: !!userId,
    staleTime: 60_000,
  })

  const historyQuery = useQuery({
    queryKey: ['ai-conversations', businessId],
    queryFn: () => listConversations(businessId),
    enabled: !!businessId && !!userId,
    staleTime: 15_000,
  })

  const cashBase = roundMoney(statsQuery.data?.balance?.[baseCurrency] ?? 0)
  const cashUsd = roundMoney(statsQuery.data?.balance?.USD ?? cashBase)
  const overdueUsd = useMemo(() => {
    for (const row of agingQuery.data || []) {
      if (String(row.currency).toUpperCase() === 'USD') return roundMoney(agingOverdue(row))
    }
    const first = agingQuery.data?.[0]
    return first ? roundMoney(agingOverdue(first)) : 0
  }, [agingQuery.data])

  const examples = useMemo(() => ([
    {
      id: 'ex-cash',
      label: cashBase > 0
        ? `¿Cuánto tengo en caja (${formatCurrency(cashBase, baseCurrency)})?`
        : '¿Cuánto tengo en caja ahora?',
      question: '¿Cuánto tengo en caja por moneda ahora?',
    },
    {
      id: 'ex-month',
      label: '¿Cuánto gasté este mes?',
      question: '¿Cuánto gasté e ingresé este mes por moneda?',
    },
    {
      id: 'ex-stock',
      label: '¿Qué productos tienen stock bajo?',
      question: '¿Qué productos tienen stock bajo o agotado?',
    },
    {
      id: 'ex-cxc',
      label: overdueUsd > 0
        ? `¿Cuánto me deben vencido (${formatCurrency(overdueUsd, 'USD')})?`
        : '¿Cuánto me deben (CxC)?',
      question: '¿Cuánto me deben en total y cuánto está vencido?',
    },
    {
      id: 'ex-logs',
      label: '¿Qué pasó hoy en Auditoría?',
      question: 'Resume la actividad reciente del registro de auditoría',
    },
    {
      id: 'ex-afford',
      label: `¿Me alcanzan ${roundMoney(Math.max(50, Math.min(400, cashUsd * 0.1 || 200)))} USD?`,
      question: `¿Me alcanzan ${roundMoney(Math.max(50, Math.min(400, cashUsd * 0.1 || 200)))} USD para un pago con mi caja actual?`,
    },
  ]), [cashBase, cashUsd, baseCurrency, formatCurrency, overdueUsd])

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  const persistLocal = useCallback((id, msgs) => {
    if (!businessId) return
    writeLocalChatState(businessId, {
      conversationId: id,
      messages: msgs,
    })
  }, [businessId])

  const persistRemote = useCallback(async (msgs) => {
    if (!businessId || !userId || !hasRealExchange(msgs)) return conversationIdRef.current
    setSaving(true)
    try {
      const title = titleFromMessages(msgs)
      const id = conversationIdRef.current
      if (id) {
        await updateConversation(id, businessId, { title, messages: msgs })
        queryClient.invalidateQueries({ queryKey: ['ai-conversations', businessId] })
        persistLocal(id, msgs)
        return id
      }
      const created = await createConversation({
        businessId,
        userId,
        title,
        messages: msgs,
      })
      setActiveConversationId(created.id)
      persistLocal(created.id, msgs)
      queryClient.invalidateQueries({ queryKey: ['ai-conversations', businessId] })
      return created.id
    } catch (err) {
      console.warn('No se pudo guardar en BD (queda en este dispositivo):', err?.message)
      return conversationIdRef.current
    } finally {
      setSaving(false)
    }
  }, [businessId, userId, persistLocal, queryClient, setActiveConversationId])

  const schedulePersist = useCallback((msgs) => {
    persistLocal(conversationIdRef.current, msgs)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      persistRemote(msgs)
    }, 600)
  }, [persistLocal, persistRemote])

  // Restaurar al montar / cambiar de negocio
  useEffect(() => {
    hydrated.current = false
    if (!businessId || !userId) return

    const local = readLocalChatState(businessId)
    if (local?.messages?.length) {
      setActiveConversationId(local.conversationId || null)
      setMessages(local.messages)
      hydrated.current = true
      return
    }

    setActiveConversationId(null)
    setMessages([welcomeMessage()])
    hydrated.current = true
  }, [businessId, userId, setActiveConversationId])

  // Guardar al desmontar (cambio de tab/ruta)
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (!businessId || !hydrated.current) return
      const local = readLocalChatState(businessId)
      if (local?.messages && hasRealExchange(local.messages)) {
        if (local.conversationId) conversationIdRef.current = local.conversationId
        persistRemote(local.messages)
      }
    }
  }, [businessId, persistRemote])

  const startNewChat = () => {
    setActiveConversationId(null)
    const welcome = [welcomeMessage()]
    setMessages(welcome)
    persistLocal(null, welcome)
    setHistoryOpen(false)
  }

  const openConversation = async (id) => {
    if (!businessId || !id) return
    try {
      const row = await getConversation(id, businessId)
      if (!row) {
        toast.error('Conversación no encontrada')
        return
      }
      const msgs = Array.isArray(row.messages) && row.messages.length
        ? row.messages
        : [welcomeMessage()]
      setActiveConversationId(row.id)
      setMessages(msgs)
      persistLocal(row.id, msgs)
      setHistoryOpen(false)
      scrollToEnd()
    } catch (err) {
      toast.error('No se pudo abrir', { description: err?.message })
    }
  }

  const confirmRemoveConversation = async () => {
    const id = deleteTarget?.id
    if (!businessId || !id) return
    setDeleting(true)
    try {
      await deleteConversation(id, businessId)
      if (conversationIdRef.current === id) {
        clearLocalChatState(businessId)
        startNewChat()
      }
      queryClient.invalidateQueries({ queryKey: ['ai-conversations', businessId] })
      toast.success('Conversación borrada')
      setDeleteTarget(null)
    } catch (err) {
      toast.error('No se pudo borrar', { description: err?.message })
    } finally {
      setDeleting(false)
    }
  }

  const runAsk = async (question, baseMessages) => {
    setLoading(true)
    schedulePersist(baseMessages)
    scrollToEnd()
    try {
      const data = await askBusinessQuestion({ question, businessId, userId })
      const assistantMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data?.answer || 'No obtuve respuesta.',
        sources: data?.sources || [],
        nextStep: data?.next_step || null,
      }
      const withAnswer = [...baseMessages, assistantMsg]
      setMessages(withAnswer)
      await persistRemote(withAnswer)
      onQuotaChange?.()
    } catch (err) {
      const raw = String(err?.message || '').trim()
      const looksTechnical = /openrouter|modelo free|:free|provider|rate limit|models' array/i.test(raw)
      const reason = (!raw || looksTechnical) ? FRIENDLY_ASK_ERROR : raw
      toast.error('No se pudo consultar', { description: reason })
      const withErr = [
        ...baseMessages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: reason,
          error: true,
          retryQuestion: question,
        },
      ]
      setMessages(withErr)
      schedulePersist(withErr)
    } finally {
      setLoading(false)
      scrollToEnd()
    }
  }

  const send = async (rawQuestion) => {
    const question = String(rawQuestion || '').trim()
    if (!question || loading) return

    const userMsg = { id: crypto.randomUUID(), role: 'user', text: question }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    await runAsk(question, nextMessages)
  }

  /** Reenvía la pregunta fallida sin volver a escribirla. */
  const retryFailed = async (errorMsg) => {
    if (loading) return
    const question = String(errorMsg?.retryQuestion || '').trim()
    if (!question) return

    // Quita el error (y deja el mensaje del usuario que ya estaba)
    let base = messages.filter((m) => m.id !== errorMsg.id)
    // Si por algún motivo no quedó el user msg, lo reinsertamos
    const last = base[base.length - 1]
    if (!last || last.role !== 'user' || last.text !== question) {
      base = [...base, { id: crypto.randomUUID(), role: 'user', text: question }]
    }
    setMessages(base)
    await runAsk(question, base)
  }

  const history = historyQuery.data || []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4 shrink-0" />
                Asistente del negocio
              </CardTitle>
              <CardDescription>
                Pregunta en español sobre finanzas, almacén, CxC/CxP, auditoría y reportes.
                Las conversaciones se guardan (este dispositivo + tu cuenta).
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={startNewChat} disabled={loading}>
                <Plus className="mr-1 h-4 w-4" />
                Nueva
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setHistoryOpen((v) => !v)}
                disabled={loading}
              >
                <History className="mr-1 h-4 w-4" />
                Historial
              </Button>
            </div>
          </div>
          {saving && (
            <p className="text-[11px] text-muted-foreground">Guardando…</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {historyOpen && (
            <div className="rounded-lg border bg-muted/20 p-2 space-y-1 max-h-48 overflow-y-auto">
              {historyQuery.isLoading && (
                <p className="text-xs text-muted-foreground px-2 py-1">Cargando historial…</p>
              )}
              {!historyQuery.isLoading && history.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1">
                  Aún no hay conversaciones guardadas. Las que hagas aquí aparecerán en la lista.
                </p>
              )}
              {history.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-background',
                    conversationId === c.id && 'bg-background border'
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => openConversation(c.id)}
                  >
                    <span className="block truncate font-medium">{c.title}</span>
                    <span className="block text-[11px] text-muted-foreground">{formatWhen(c.updated_at)}</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive"
                    aria-label="Borrar conversación"
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!hasRealExchange(messages) && (
            <ExampleChips
              label="Preguntas de ejemplo"
              examples={examples}
              disabled={loading}
              onSelect={(ex) => send(ex.question)}
            />
          )}

          <div
            ref={listRef}
            className="flex max-h-[min(52vh,420px)] min-h-[220px] flex-col gap-3 overflow-y-auto rounded-lg border bg-muted/20 p-3"
          >
            {messages.map((m, idx) => {
              const retryQ = m.retryQuestion
                || (m.error
                  ? [...messages.slice(0, idx)].reverse().find((x) => x.role === 'user')?.text
                  : null)
              const isAssistant = m.role !== 'user'
              return (
              <div
                key={m.id}
                className={cn(
                  'flex max-w-[95%] gap-2',
                  isAssistant ? 'mr-auto' : 'ml-auto flex-row-reverse'
                )}
              >
                {isAssistant && (
                  <div
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                      m.error
                        ? 'border-destructive/40 bg-destructive/10 text-destructive'
                        : 'border-primary/25 bg-primary/10 text-primary'
                    )}
                    aria-hidden="true"
                  >
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={cn(
                    'rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : m.error
                        ? 'border border-destructive/40 bg-background text-foreground'
                        : 'border bg-background text-foreground'
                  )}
                >
                  {m.text}
                  {m.sources?.length > 0 && (
                    <p className="mt-2 text-[11px] opacity-70">
                      Fuentes: {m.sources.map((s) => SOURCE_LABELS[s] || s).join(' · ')}
                    </p>
                  )}
                  {m.nextStep && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Siguiente paso: {m.nextStep}</p>
                  )}
                  {m.error && retryQ && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-8"
                      disabled={loading}
                      onClick={() => retryFailed({ ...m, retryQuestion: retryQ })}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Reintentar
                    </Button>
                  )}
                </div>
              </div>
              )
            })}
            {loading && (
              <div className="mr-auto flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary" aria-hidden="true">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl border bg-background px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Consultando tus datos…
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border-2 border-primary/40 bg-background p-3 shadow-sm ring-1 ring-primary/10 space-y-2">
            <label htmlFor="assistant-input" className="text-sm font-medium text-foreground">
              Escribe tu pregunta
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Textarea
                id="assistant-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ej: ¿Qué productos están bajos de stock?"
                rows={4}
                disabled={loading}
                className="min-h-[112px] flex-1 border-primary/30 bg-muted/20 text-base focus-visible:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
              />
              <Button
                type="button"
                className="h-12 shrink-0 sm:w-auto"
                disabled={loading || !input.trim()}
                onClick={() => send(input)}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Preguntar
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Cada pregunta gasta 1 consulta del cupo Ultra de este negocio. Puedes borrar conversaciones desde Historial.
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null) }}
        title="Eliminar conversación"
        description={`¿Seguro que quieres eliminar “${deleteTarget?.title || 'esta conversación'}”? No se puede deshacer.`}
        confirmText="Eliminar"
        tone="destructive"
        loading={deleting}
        onConfirm={confirmRemoveConversation}
      />
    </div>
  )
}
