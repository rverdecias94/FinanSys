/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getBusinessSettings, patchBusinessFxSettings } from '@/services/businessSettings'
import { getExchangeRates, upsertExchangeRate } from '@/services/exchangeRates'
import { fetchInformalFxSuggestions } from '@/services/informalFxRates'
import {
  normalizeFxSettings,
  shouldShowDailyFxModal,
  todayLocalIso,
} from '@/utils/dailyFxReminder'
import { INFORMAL_FX_SOURCE_LABEL } from '@/utils/informalFxRates'
import { ArrowLeftRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Modal post-splash: intenta sugerir la tasa del día (elTOQUE TRMI) y exige
 * confirmación explícita del usuario antes de guardar. Si la consulta falla,
 * pide la tasa a mano (con la misma confirmación).
 */
export function DailyFxRateModal() {
  const { session } = useSession()
  const { businessId, isOwner } = useBusiness()
  const { businessCurrencies } = useCurrency()
  const online = useOnlineStatus()
  const queryClient = useQueryClient()
  const userId = session?.user?.id
  const today = todayLocalIso()

  const defaultCode = useMemo(
    () => businessCurrencies.find((c) => c.is_default)?.code,
    [businessCurrencies]
  )
  const ratedCurrencies = useMemo(
    () => businessCurrencies.filter((c) => c.code !== defaultCode),
    [businessCurrencies, defaultCode]
  )

  const settingsQuery = useQuery({
    queryKey: ['configuracion', 'general-settings', businessId || userId],
    queryFn: () => getBusinessSettings(userId, businessId),
    enabled: !!userId && !!businessId && isOwner && online,
    staleTime: 30_000,
  })

  const ratesQuery = useQuery({
    queryKey: ['exchangeRates', userId, businessId],
    queryFn: () => getExchangeRates(userId, businessId),
    enabled: !!userId && !!businessId && isOwner && online && ratedCurrencies.length > 0,
    staleTime: 15_000,
  })

  const fx = normalizeFxSettings(settingsQuery.data?.fx)
  const rates = ratesQuery.data || {}

  const open = shouldShowDailyFxModal({
    reminderEnabled: fx.daily_fx_reminder,
    lastPromptDate: fx.last_fx_prompt_date,
    ratedCurrencyCodes: ratedCurrencies.map((c) => c.code),
    ratesMap: rates,
    today,
    isOwner,
    online,
  }) && !settingsQuery.isLoading && !ratesQuery.isLoading

  const [drafts, setDrafts] = useState({})
  const [confirmed, setConfirmed] = useState(false)
  const [suggestStatus, setSuggestStatus] = useState('idle') // idle | loading | suggested | manual
  const [suggestMeta, setSuggestMeta] = useState(null)
  const [suggestError, setSuggestError] = useState(null)

  useEffect(() => {
    if (!open) {
      setSuggestStatus('idle')
      setSuggestMeta(null)
      setSuggestError(null)
      setConfirmed(false)
      return
    }

    const seed = {}
    for (const c of ratedCurrencies) {
      seed[c.code] = rates[c.code]?.units_per_base != null ? String(rates[c.code].units_per_base) : ''
    }
    setDrafts(seed)
    setConfirmed(false)
    setSuggestStatus('loading')
    setSuggestMeta(null)
    setSuggestError(null)

    let cancelled = false
    ;(async () => {
      const result = await fetchInformalFxSuggestions({
        baseCode: defaultCode,
        currencyCodes: ratedCurrencies.map((c) => c.code),
      })
      if (cancelled) return

      if (!result.ok) {
        setSuggestStatus('manual')
        setSuggestError(result.error)
        return
      }

      setDrafts((prev) => {
        const next = { ...prev }
        for (const [code, value] of Object.entries(result.suggestions || {})) {
          next[code] = String(value)
        }
        return next
      })
      setSuggestMeta({
        attribution: result.attribution || INFORMAL_FX_SOURCE_LABEL,
        sourceUrl: result.sourceUrl,
        asOf: result.asOf,
        missing: result.missing || [],
        cached: result.cached,
      })
      setSuggestStatus('suggested')
      if ((result.missing || []).length > 0) {
        setSuggestError(
          `Sin referencia automática para: ${result.missing.join(', ')}. Completa esas a mano.`
        )
      } else {
        setSuggestError(null)
      }
    })()

    return () => {
      cancelled = true
    }
    // Solo al abrir / cambiar monedas activas — no re-fetch por cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCode, ratedCurrencies.map((c) => c.code).join(',')])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!confirmed) {
        throw new Error('Confirma que estas cifras son el precio real que usas hoy')
      }
      for (const c of ratedCurrencies) {
        const n = Number(drafts[c.code])
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(`Indica una tasa válida para ${c.code}`)
        }
        await upsertExchangeRate(
          { currency_code: c.code, units_per_base: n, effective_date: today },
          userId,
          businessId
        )
      }
      await patchBusinessFxSettings(userId, businessId, {
        last_fx_prompt_date: null,
        daily_fx_reminder: true,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchangeRates'] })
      queryClient.invalidateQueries({ queryKey: ['exchangeRatesHistory'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'general-settings'] })
      toast.success('Tasa del día guardada')
    },
    onError: (err) => {
      toast.error(err?.message || 'No se pudo guardar la tasa')
    },
  })

  const laterMutation = useMutation({
    mutationFn: () =>
      patchBusinessFxSettings(userId, businessId, { last_fx_prompt_date: today }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'general-settings'] })
      toast.message('Puedes actualizar la tasa cuando quieras en Configuración → Monedas')
    },
  })

  const allValid = ratedCurrencies.every((c) => {
    const n = Number(drafts[c.code])
    return Number.isFinite(n) && n > 0
  })

  if (!userId || !businessId) return null

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-[calc(100vw-1.5rem)] sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideClose
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <ArrowLeftRight className="h-5 w-5 shrink-0 text-primary" />
            ¿A cuánto está el dólar hoy?
          </DialogTitle>
          <DialogDescription className="text-left">
            Registra la tasa de hoy ({today}) respecto a {defaultCode || 'tu moneda principal'}.
            Gestia intenta sugerirla desde el mercado informal; tú confirmas el precio real.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {suggestStatus === 'loading' && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              Consultando tasa informal (elTOQUE)…
            </div>
          )}

          {suggestStatus === 'suggested' && suggestMeta && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">Sugerencia automática</p>
              <p className="mt-0.5 text-muted-foreground">
                Fuente: {suggestMeta.attribution}
                {suggestMeta.asOf ? ` · ref. ${suggestMeta.asOf}` : ''}
                {suggestMeta.cached ? ' · caché' : ''}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Es una referencia del mercado informal, no una tasa oficial. Revísala y confirma
                antes de guardar.
              </p>
            </div>
          )}

          {suggestStatus === 'manual' && (
            <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
              <p className="font-medium">No pudimos obtener la tasa automática</p>
              <p className="mt-0.5 text-muted-foreground">
                {suggestError || 'Introdúcela a mano y confirma que es el precio que usas hoy.'}
              </p>
            </div>
          )}

          {suggestStatus === 'suggested' && suggestError && (
            <p className="text-xs text-warning">{suggestError}</p>
          )}

          {ratedCurrencies.map((c) => (
            <div key={c.code} className="grid gap-1.5">
              <Label htmlFor={`daily-fx-${c.code}`} className="text-sm">
                1 {defaultCode} = ¿cuántos {c.code}?
              </Label>
              <Input
                id={`daily-fx-${c.code}`}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                className="h-11"
                placeholder="Ej. 800"
                value={drafts[c.code] ?? ''}
                disabled={suggestStatus === 'loading'}
                onChange={(e) => {
                  setDrafts((d) => ({ ...d, [c.code]: e.target.value }))
                  setConfirmed(false)
                }}
                aria-label={`Tasa ${c.code} de hoy`}
              />
            </div>
          ))}

          <label
            htmlFor="daily-fx-confirm"
            className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-3"
          >
            <Checkbox
              id="daily-fx-confirm"
              checked={confirmed}
              disabled={suggestStatus === 'loading' || !allValid}
              onCheckedChange={(v) => setConfirmed(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">
              Confirmo que estas cifras son el precio real que uso hoy en mi negocio
              {suggestStatus === 'suggested' ? ' (aunque coincidan con la sugerencia)' : ''}.
            </span>
          </label>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="h-11 w-full"
            disabled={!allValid || !confirmed || saveMutation.isPending || suggestStatus === 'loading'}
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Guardar tasa de hoy
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full"
            disabled={laterMutation.isPending || saveMutation.isPending}
            onClick={() => laterMutation.mutate()}
          >
            Más tarde
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
