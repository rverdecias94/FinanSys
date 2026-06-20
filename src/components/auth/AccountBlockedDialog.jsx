import { useState } from 'react'
import { AlertTriangle, ArrowDownCircle, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/config/supabase'
import { useSubscription } from '@/context/SubscriptionContext'
import { DowngradeToFreeDialog } from '@/components/config/DowngradeToFreeDialog'

// Overlay bloqueante (no descartable) para cuentas vencidas/suspendidas.
// mode: 'owner' (premium vencido tras gracia) | 'member' | 'account' (suspendida).
// Respeta tokens de color y es mobile-first (botones apilados en móvil).
export function AccountBlockedDialog({ mode, accountStatus }) {
  const { refreshSubscription } = useSubscription()
  const [downgradeOpen, setDowngradeOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const copy = {
    owner: {
      title: 'Tu plan Premium ha vencido',
      desc: 'No registramos el pago a tiempo y el periodo de gracia terminó. Para continuar con Premium, contacta al administrador y regulariza el pago. También puedes pasar al Plan Gratis y seguir usando las funciones básicas (algunos datos quedarán limitados).'
    },
    member: {
      title: 'Acceso suspendido',
      desc: 'El plan del negocio venció. Pide al propietario o al administrador que regularice el pago para restaurar el acceso del equipo.'
    },
    account: {
      title: accountStatus === 'deleted' ? 'Cuenta eliminada' : 'Cuenta suspendida',
      desc: 'Un administrador suspendió el acceso a esta cuenta. Contáctalo para más información.'
    }
  }[mode] || { title: 'Acceso no disponible', desc: 'Contacta al administrador.' }

  return (
    <>
      {!downgradeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{copy.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{copy.desc}</p>

            <div className="mt-6 flex flex-col gap-2">
              {mode === 'owner' && (
                <Button onClick={() => setDowngradeOpen(true)}>
                  <ArrowDownCircle className="mr-2 h-4 w-4" />
                  Cambiar a Plan Gratis
                </Button>
              )}
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      )}

      {mode === 'owner' && downgradeOpen && (
        <DowngradeToFreeDialog
          open={downgradeOpen}
          onOpenChange={setDowngradeOpen}
          onSuccess={async () => {
            setDowngradeOpen(false)
            await refreshSubscription()
          }}
        />
      )}
    </>
  )
}
