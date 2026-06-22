import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Lock } from 'lucide-react'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { getPeriodLock, setPeriodLock } from '@/services/finanzas'
import { notify, getSupabaseErrorMessage } from '@/services/notifications'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// S5 (Q17): cierre de período. Bloquea crear/editar/eliminar movimientos con fecha
// <= la fecha de cierre (los cobros/pagos siguen permitidos). Reabrir queda en la Bitácora.
export function PeriodLockSection({ isOwner }) {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const userId = session?.user?.id
  const qc = useQueryClient()
  const [date, setDate] = useState(null)

  const lockQuery = useQuery({
    queryKey: ['period-lock', businessId || userId],
    queryFn: () => getPeriodLock(userId, businessId),
    enabled: !!userId
  })
  const closedThrough = lockQuery.data?.closed_through || null

  const mutation = useMutation({
    mutationFn: (through) => setPeriodLock(through, userId),
    onSuccess: (_d, through) => {
      qc.invalidateQueries({ queryKey: ['period-lock'] })
      notify.success(through ? 'Período cerrado' : 'Período reabierto')
      setDate(null)
    },
    onError: (e) => notify.error(getSupabaseErrorMessage(e))
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Cierre de período
        </CardTitle>
        <CardDescription>
          Bloquea fechas pasadas: no podrás crear ni editar movimientos con fecha igual o anterior a la de cierre.
          Los cobros y pagos sobre cuentas antiguas siguen permitidos. Reabrir queda registrado en la Bitácora.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          {closedThrough ? (
            <>Período cerrado hasta <span className="font-semibold">{format(new Date(closedThrough), 'PP', { locale: es })}</span>.</>
          ) : (
            'No hay período cerrado. Todas las fechas están abiertas.'
          )}
        </div>

        {isOwner ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">Cerrar hasta (inclusive)</label>
              <Calendar value={date} onChange={setDate} placeholder="Selecciona una fecha" />
            </div>
            <div className="flex gap-2">
              <Button
                className="w-full sm:w-auto"
                onClick={() => date && mutation.mutate(date)}
                loading={mutation.isPending}
                disabled={!date}
              >
                Cerrar período
              </Button>
              {closedThrough && (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => mutation.mutate(null)}
                  loading={mutation.isPending}
                >
                  Reabrir todo
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Solo el propietario puede cerrar o reabrir períodos.</p>
        )}
      </CardContent>
    </Card>
  )
}
