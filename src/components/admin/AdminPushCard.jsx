import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  disableAdminPush,
  enableAdminPush,
  getCurrentPushSubscription,
  getVapidPublicKey,
  isPushSupported,
  listMyPushSubscriptions,
  sendAdminPushTest,
} from '@/services/pushNotifications'
import { getSupabaseErrorMessage } from '@/services/notifications'

export function AdminPushCard() {
  const qc = useQueryClient()
  const [browserSub, setBrowserSub] = useState(null)
  const [checkingBrowser, setCheckingBrowser] = useState(true)

  const supported = isPushSupported()
  const hasVapid = Boolean(getVapidPublicKey())

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-push-subscriptions'],
    queryFn: listMyPushSubscriptions,
  })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const sub = await getCurrentPushSubscription()
        if (alive) setBrowserSub(sub)
      } finally {
        if (alive) setCheckingBrowser(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [rows.length])

  const enableMutation = useMutation({
    mutationFn: enableAdminPush,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-push-subscriptions'] })
      toast.success('Avisos activados en este dispositivo', {
        description: 'Te llegarán aunque Gestia esté cerrada.',
      })
    },
    onError: (e) => toast.error('No se pudo activar', { description: getSupabaseErrorMessage(e) }),
  })

  const disableMutation = useMutation({
    mutationFn: disableAdminPush,
    onSuccess: () => {
      setBrowserSub(null)
      qc.invalidateQueries({ queryKey: ['admin-push-subscriptions'] })
      toast.success('Avisos desactivados en este dispositivo')
    },
    onError: (e) => toast.error('No se pudo desactivar', { description: getSupabaseErrorMessage(e) }),
  })

  const testMutation = useMutation({
    mutationFn: sendAdminPushTest,
    onSuccess: (data) => {
      toast.success('Aviso de prueba enviado', {
        description: data?.sent != null ? `Dispositivos: ${data.sent}` : undefined,
      })
    },
    onError: (e) => toast.error('Falló la prueba', { description: getSupabaseErrorMessage(e) }),
  })

  const activeHere = Boolean(browserSub)
  const busy = enableMutation.isPending || disableMutation.isPending || testMutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" aria-hidden="true" />
          Avisos push (admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Activa los avisos en <span className="font-medium text-foreground">este</span> teléfono o
          laptop. Cuando un usuario nuevo entre con plan Inicial (free), te llegará una notificación
          aunque Gestia esté cerrada.
        </p>

        {!supported && (
          <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
            Este navegador no soporta Web Push. Prueba Chrome/Edge en Windows o Android, o Safari con
            la PWA instalada en iPhone.
          </p>
        )}

        {supported && !hasVapid && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-foreground">
            Falta la clave pública <code className="font-mono">VITE_VAPID_PUBLIC_KEY</code> en el
            entorno. Sigue la guía en <code className="font-mono">docs/PUSH_ADMIN_NUEVO_USUARIO.md</code>.
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {!activeHere ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!supported || !hasVapid || busy || checkingBrowser}
              onClick={() => enableMutation.mutate()}
            >
              {enableMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Bell className="mr-2 h-4 w-4" />
              )}
              Activar en este dispositivo
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={busy}
              onClick={() => disableMutation.mutate()}
            >
              {disableMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BellOff className="mr-2 h-4 w-4" />
              )}
              Desactivar aquí
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={!supported || !hasVapid || busy || rows.length === 0}
            onClick={() => testMutation.mutate()}
          >
            {testMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BellRing className="mr-2 h-4 w-4" />
            )}
            Enviar prueba
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Estado aquí:{' '}
          {checkingBrowser || isLoading
            ? 'comprobando…'
            : activeHere
              ? 'activado en este navegador'
              : 'no activado en este navegador'}
          {rows.length > 0 ? ` · ${rows.length} dispositivo(s) guardado(s)` : null}
        </p>

        <p className="text-xs text-muted-foreground">
          Nota: el service worker (necesario para push) solo corre en producción, preview o PWA
          instalada — no en <code className="font-mono">npm run dev</code>.
        </p>
      </CardContent>
    </Card>
  )
}
