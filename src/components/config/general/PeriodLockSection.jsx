import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Lock } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { getPeriodLock, setPeriodLock } from '@/services/finanzas'
import { getBusinessSettings, patchBusinessPeriodSettings } from '@/services/businessSettings'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { parseDateOnlyLocal } from '@/utils/periodLock'
import {
  normalizePeriodLockSettings,
  nextAutoClosedThrough,
  targetClosedThroughForMonthly,
} from '@/utils/periodLockRules'

/**
 * Cierre de período: manual (fecha) o mensual automático (día N cierra el mes anterior).
 */
export function PeriodLockSection({ isOwner }) {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const userId = session?.user?.id
  const qc = useQueryClient()
  const [date, setDate] = useState(null)
  const [mode, setMode] = useState('manual')
  const [dayOfMonth, setDayOfMonth] = useState('25')

  const lockQuery = useQuery({
    queryKey: ['period-lock', businessId || userId],
    queryFn: () => getPeriodLock(userId, businessId),
    enabled: !!userId,
  })
  const closedThrough = lockQuery.data?.closed_through || null

  const settingsQuery = useQuery({
    queryKey: ['configuracion', 'general-settings', businessId || userId],
    queryFn: () => getBusinessSettings(userId, businessId),
    enabled: !!userId,
    staleTime: 10_000,
  })

  useEffect(() => {
    const s = normalizePeriodLockSettings(settingsQuery.data?.period)
    setMode(s.mode)
    setDayOfMonth(String(s.day_of_month))
  }, [settingsQuery.data])

  const lockMutation = useMutation({
    mutationFn: (through) => setPeriodLock(through, userId),
    onSuccess: (_d, through) => {
      qc.invalidateQueries({ queryKey: ['period-lock'] })
      notify.success(through ? 'Período cerrado' : 'Período reabierto')
      setDate(null)
    },
    onError: (e) => notify.error(getSupabaseErrorMessage(e)),
  })

  const rulesMutation = useMutation({
    mutationFn: async (next) => {
      const saved = await patchBusinessPeriodSettings(userId, businessId, next)
      const normalized = normalizePeriodLockSettings(saved?.period || next)
      if (normalized.mode === 'monthly') {
        const target = nextAutoClosedThrough({
          settings: normalized,
          currentClosedThrough: closedThrough,
        })
        if (target) await setPeriodLock(target, userId)
      }
      return normalized
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configuracion', 'general-settings'] })
      qc.invalidateQueries({ queryKey: ['period-lock'] })
      notify.success('Regla de cierre guardada')
    },
    onError: (e) => notify.error(getSupabaseErrorMessage(e)),
  })

  const previewTarget =
    mode === 'monthly' ? targetClosedThroughForMonthly(Number(dayOfMonth) || 25) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Cierre de período
        </CardTitle>
        <CardDescription>
          Bloquea fechas pasadas: movimientos de ese período quedan en solo lectura.
          Los cobros y pagos sobre cuentas antiguas siguen permitidos. Reabrir queda en Auditoría.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          {closedThrough ? (
            <>
              Período cerrado hasta{' '}
              <span className="font-semibold">
                {format(parseDateOnlyLocal(closedThrough) || new Date(), 'PP', { locale: es })}
              </span>
              .
            </>
          ) : (
            'No hay período cerrado. Todas las fechas están abiertas.'
          )}
        </div>

        {isOwner ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de cierre</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Histórico / manual</SelectItem>
                    <SelectItem value="monthly">Mensual automático</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {mode === 'monthly' && (
                <div className="space-y-1.5">
                  <Label>Día de cada mes</Label>
                  <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
                        <SelectItem key={d} value={d}>
                          Día {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {mode === 'monthly' && (
              <p className="text-xs text-muted-foreground">
                Cada día {dayOfMonth} se cierra el mes anterior completo
                {previewTarget
                  ? ` (ahora tocaría hasta ${format(parseDateOnlyLocal(previewTarget) || new Date(), 'PP', { locale: es })})`
                  : ''}
                . No reabre períodos solos.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  rulesMutation.mutate({
                    mode,
                    day_of_month: Number(dayOfMonth) || 25,
                  })
                }
                loading={rulesMutation.isPending}
              >
                Guardar regla
              </Button>
            </div>

            {mode === 'manual' && (
              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label>Cerrar hasta (inclusive)</Label>
                  <Calendar value={date} onChange={setDate} placeholder="Selecciona una fecha" />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => date && lockMutation.mutate(date)}
                    loading={lockMutation.isPending}
                    disabled={!date}
                  >
                    Cerrar período
                  </Button>
                  {closedThrough && (
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => lockMutation.mutate(null)}
                      loading={lockMutation.isPending}
                    >
                      Reabrir todo
                    </Button>
                  )}
                </div>
              </div>
            )}

            {mode === 'monthly' && closedThrough && (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => lockMutation.mutate(null)}
                loading={lockMutation.isPending}
              >
                Reabrir todo (excepción)
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Solo el propietario puede cerrar o reabrir períodos.</p>
        )}
      </CardContent>
    </Card>
  )
}
