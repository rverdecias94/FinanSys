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
import {
  normalizeFxSettings,
  shouldShowDailyFxModal,
  todayLocalIso,
} from '@/utils/dailyFxReminder'
import {
  FX_ANCHOR,
  fxCupDisplayFromRates,
  fxCupLabel,
  fxCupNeedsBaseCupRate,
  fxCupPromptCurrencies,
  fxCupStorageCodesForCheck,
  fxCupStoredFromDisplay,
} from '@/utils/fxPrompt'
import { ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Modal de tasa del día.
 * UI Cuba: cada moneda habilitada (salvo CUP) → «1 X = ¿cuántos CUP?».
 * La moneda principal solo afecta cómo se guarda en BD (units_per_base), no el texto.
 */
export function DailyFxRateModal({
  requiredGate = null,
  onRequiredSatisfied,
  onRequiredAbandoned,
}) {
  const { session } = useSession()
  const { businessId, isOwner } = useBusiness()
  const { businessCurrencies } = useCurrency()
  const online = useOnlineStatus()
  const queryClient = useQueryClient()
  const userId = session?.user?.id
  const today = todayLocalIso()
  const required = Boolean(requiredGate)

  const defaultCode = useMemo(
    () => businessCurrencies.find((c) => c.is_default)?.code,
    [businessCurrencies],
  )
  const activeCodes = useMemo(
    () => businessCurrencies.map((c) => c.code).filter(Boolean),
    [businessCurrencies],
  )

  const promptCodes = useMemo(
    () => fxCupPromptCurrencies(defaultCode, activeCodes),
    [defaultCode, activeCodes],
  )

  // Para guardar cruces (p. ej. MLC con base USD) hace falta primero la tasa de la base vs CUP.
  const orderedPromptCodes = useMemo(() => {
    if (!defaultCode) return promptCodes
    const base = String(defaultCode).toUpperCase()
    if (base === FX_ANCHOR) return promptCodes
    return [...promptCodes].sort((a, b) => {
      if (a === base) return -1
      if (b === base) return 1
      return 0
    })
  }, [promptCodes, defaultCode])

  const storageCodes = useMemo(
    () => fxCupStorageCodesForCheck(orderedPromptCodes, defaultCode),
    [orderedPromptCodes, defaultCode],
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
    enabled: !!userId && !!businessId && isOwner && online && orderedPromptCodes.length > 0,
    staleTime: 15_000,
  })

  const fx = normalizeFxSettings(settingsQuery.data?.fx)
  const rates = ratesQuery.data || {}

  const softOpen =
    !required &&
    shouldShowDailyFxModal({
      reminderEnabled: fx.daily_fx_reminder,
      lastPromptDate: fx.last_fx_prompt_date,
      ratedCurrencyCodes: storageCodes,
      ratesMap: rates,
      today,
      isOwner,
      online,
    }) &&
    !settingsQuery.isLoading &&
    !ratesQuery.isLoading

  const open =
    (required || softOpen) &&
    !!userId &&
    !!businessId &&
    isOwner &&
    orderedPromptCodes.length > 0

  const [drafts, setDrafts] = useState({})
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (!open) {
      setConfirmed(false)
      return
    }
    const seed = {}
    for (const code of orderedPromptCodes) {
      seed[code] = fxCupDisplayFromRates(code, defaultCode, rates)
    }
    setDrafts(seed)
    setConfirmed(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, required, defaultCode, orderedPromptCodes.join(',')])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!confirmed) {
        throw new Error('Confirma que estas cifras son el precio real que usas hoy')
      }
      const liveRates = { ...rates }
      for (const code of orderedPromptCodes) {
        if (fxCupNeedsBaseCupRate(code, defaultCode, liveRates) && code !== String(defaultCode).toUpperCase()) {
          throw new Error(`Primero indica 1 ${defaultCode} = ¿cuántos CUP?`)
        }
        const row = fxCupStoredFromDisplay(code, defaultCode, drafts[code], liveRates)
        if (!row) throw new Error(`Indica una tasa válida para ${code}`)
        await upsertExchangeRate(
          { currency_code: row.currency_code, units_per_base: row.units_per_base, effective_date: today },
          userId,
          businessId,
        )
        liveRates[row.currency_code] = {
          units_per_base: row.units_per_base,
          effective_date: today,
        }
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
      if (required) onRequiredSatisfied?.()
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
      toast.message('Puedes actualizar la tasa cuando quieras en Cuenta → Monedas')
    },
  })

  const allValid = orderedPromptCodes.every((code) => {
    const live = { ...rates }
    const base = String(defaultCode || '').toUpperCase()
    if (base && base !== FX_ANCHOR && drafts[base]) {
      const baseRow = fxCupStoredFromDisplay(base, defaultCode, drafts[base], live)
      if (baseRow) live[baseRow.currency_code] = { units_per_base: baseRow.units_per_base }
    }
    return fxCupStoredFromDisplay(code, defaultCode, drafts[code], live) != null
  })

  if (!userId || !businessId) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && required) onRequiredAbandoned?.()
      }}
    >
      <DialogContent
        className="max-w-[calc(100vw-1.5rem)] sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideClose
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <ArrowLeftRight className="h-5 w-5 shrink-0 text-primary" />
            {required ? 'Necesitamos la tasa de hoy' : '¿A cuánto está el CUP hoy?'}
          </DialogTitle>
          <DialogDescription className="text-left">
            {required
              ? requiredGate?.reason ||
                'Esta operación depende de la tasa actualizada. Introdúcela para continuar.'
              : `Indica cuántos CUP vale cada moneda activa de tu negocio (fecha ${today}). La moneda principal no cambia esta pregunta.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {required && (
            <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
              Obligatorio para cuadrar bien esta operación. No se puede postergar.
            </div>
          )}

          {orderedPromptCodes.map((code) => (
            <div key={code} className="grid gap-1.5">
              <Label htmlFor={`daily-fx-${code}`} className="text-sm">
                {fxCupLabel(code)}
              </Label>
              <Input
                id={`daily-fx-${code}`}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                className="h-11"
                placeholder="Ej. 320"
                value={drafts[code] ?? ''}
                onChange={(e) => {
                  setDrafts((d) => ({ ...d, [code]: e.target.value }))
                  setConfirmed(false)
                }}
                aria-label={fxCupLabel(code)}
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
              disabled={!allValid}
              onCheckedChange={(v) => setConfirmed(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">
              Confirmo que estas cifras son el precio real que uso hoy en mi negocio.
            </span>
          </label>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="h-11 w-full"
            disabled={!allValid || !confirmed || saveMutation.isPending}
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Guardar tasa de hoy
          </Button>
          {!required && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full"
              disabled={laterMutation.isPending || saveMutation.isPending}
              onClick={() => laterMutation.mutate()}
            >
              Más tarde
            </Button>
          )}
          {required && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full"
              disabled={saveMutation.isPending}
              onClick={() => onRequiredAbandoned?.()}
            >
              Cancelar operación
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
