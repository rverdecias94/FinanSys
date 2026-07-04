import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Building2, Check, Coins, Globe2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { supabase } from '@/config/supabase'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { useAccountStatus } from '@/hooks/useAccountStatus'
import { isSystemAdmin } from '@/services/planRequests'
import { getBusinessSettings, upsertBusinessSettings } from '@/services/businessSettings'
import { updateBalanceConfig } from '@/services/finanzas'
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus'

// Lista corta de zonas horarias frecuentes en LatAm + España (paso opcional).
const TIME_ZONES = [
  'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Santiago',
  'America/Argentina/Buenos_Aires', 'America/Caracas', 'America/Havana',
  'America/Santo_Domingo', 'Europe/Madrid', 'UTC'
]

const STEPS = [
  { n: 1, label: 'Negocio', icon: Building2 },
  { n: 2, label: 'Región', icon: Globe2 },
  { n: 3, label: 'Moneda', icon: Coins }
]

/**
 * Asistente OBLIGATORIO de configuración inicial para cuentas nuevas (owners).
 * Mínimo para finalizar: nombre comercial + moneda principal. El resto es
 * opcional. Única vía de escape: cerrar sesión. Cede la prioridad a AccountGate
 * (no se muestra si la cuenta está bloqueada/suspendida). No descartable: se usa
 * un overlay propio (como AccountBlockedDialog), no el Dialog de Radix.
 */
export function OnboardingWizard() {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { needsOnboarding } = useOnboardingStatus()
  const accountStatus = useAccountStatus()
  const { paymentState } = useSubscription()
  const {
    availableCurrencies, businessCurrencies,
    toggleCurrency, setMainCurrency, refreshCurrencies
  } = useCurrency()
  const queryClient = useQueryClient()

  const userId = session?.user?.id

  const { data: isAdmin } = useQuery({
    queryKey: ['isSystemAdmin'],
    queryFn: isSystemAdmin,
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
    retry: false
  })

  // Datos ya guardados (para prefijar campos en cuentas parcialmente configuradas).
  const { data: existing } = useQuery({
    queryKey: ['onboarding', 'business-settings', businessId],
    queryFn: () => getBusinessSettings(userId, businessId),
    enabled: !!userId && !!businessId,
    staleTime: 30 * 1000,
    retry: false
  })

  const [step, setStep] = useState(1)
  const [company, setCompany] = useState({ tradeName: '', legalName: '', taxId: '', phone: '', email: '' })
  const [region, setRegion] = useState({ dateFormat: 'DD/MM/AAAA', timeZone: 'America/Havana', numberFormat: 'es-ES' })
  const [currencyCode, setCurrencyCode] = useState('')
  const [initialBalance, setInitialBalance] = useState('')
  const [saving, setSaving] = useState(false)

  // Prefijar el perfil si ya hay datos parciales guardados.
  useEffect(() => {
    if (existing?.company) {
      setCompany({
        tradeName: existing.company.tradeName || '',
        legalName: existing.company.legalName || '',
        taxId: existing.company.taxId || '',
        phone: existing.company.phone || '',
        email: existing.company.email || ''
      })
    }
    if (existing?.region) {
      setRegion((r) => ({ ...r, ...existing.region }))
    }
  }, [existing])

  // Prefijar la moneda principal si ya existe una.
  useEffect(() => {
    const def = businessCurrencies.find((c) => c.is_default)?.code
    if (def) setCurrencyCode((prev) => prev || def)
  }, [businessCurrencies])

  const blocked = isAdmin
    || accountStatus === 'suspended'
    || accountStatus === 'deleted'
    || paymentState === 'blocked'

  if (!needsOnboarding || blocked) return null

  const updateCompany = (patch) => setCompany((c) => ({ ...c, ...patch }))
  const hasTradeName = !!company.tradeName.trim()
  const hasCurrency = !!currencyCode
  const canFinish = hasTradeName && hasCurrency

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleFinish = async () => {
    if (!canFinish || saving) return
    setSaving(true)
    try {
      await upsertBusinessSettings(userId, businessId, {
        company: { ...company },
        region: { ...region },
        valuationMethod: existing?.valuation_method || 'fifo'
      })

      // Activar (si hace falta) y marcar la moneda principal.
      const already = businessCurrencies.some((c) => c.code === currencyCode)
      if (!already) await toggleCurrency(currencyCode, true)
      await setMainCurrency(currencyCode)

      // Saldo inicial opcional.
      const bal = parseFloat(initialBalance)
      if (Number.isFinite(bal) && bal !== 0) {
        await updateBalanceConfig(userId, businessId, [{ currency_code: currencyCode, initial_balance: bal }])
      }

      await refreshCurrencies()
      queryClient.invalidateQueries({ queryKey: ['onboarding', 'business-settings', businessId] })
      toast.success('¡Listo! Tu negocio quedó configurado.')
    } catch (e) {
      toast.error('No se pudo guardar la configuración', { description: e?.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-card shadow-lg">
        {/* Cabecera */}
        <div className="border-b p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">Configura tu negocio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Necesitamos unos datos para que tus reportes y documentos salgan correctos. Solo toma un minuto.
          </p>

          {/* Indicador de pasos */}
          <div className="mt-4 flex items-center justify-between gap-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const active = step === s.n
              const done = step > s.n
              return (
                <div key={s.n} className="flex flex-1 items-center gap-2">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                      active ? 'bg-primary text-primary-foreground'
                        : done ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`hidden text-xs font-medium sm:inline ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Contenido del paso */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre comercial <span className="text-destructive">*</span></Label>
                <Input
                  value={company.tradeName}
                  onChange={(e) => updateCompany({ tradeName: e.target.value })}
                  placeholder="Mi Negocio S.A."
                  autoFocus
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Razón social</Label>
                  <Input value={company.legalName} onChange={(e) => updateCompany({ legalName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Identificación fiscal / NIT</Label>
                  <Input value={company.taxId} onChange={(e) => updateCompany({ taxId: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={company.phone} onChange={(e) => updateCompany({ phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Correo del negocio</Label>
                  <Input type="email" value={company.email} onChange={(e) => updateCompany({ email: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Solo el nombre comercial es obligatorio; el resto puedes completarlo luego en Configuración.</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Formato de fecha</Label>
                <Select value={region.dateFormat} onValueChange={(v) => setRegion((r) => ({ ...r, dateFormat: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD/MM/AAAA">DD/MM/AAAA</SelectItem>
                    <SelectItem value="AAAA-MM-DD">AAAA-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Zona horaria</Label>
                <Select value={region.timeZone} onValueChange={(v) => setRegion((r) => ({ ...r, timeZone: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {TIME_ZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Formato numérico</Label>
                <Select value={region.numberFormat} onValueChange={(v) => setRegion((r) => ({ ...r, numberFormat: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es-ES">$1.000,00</SelectItem>
                    <SelectItem value="en-US">$1,000.00</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Este paso es opcional. Puedes continuar con los valores por defecto.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Moneda principal <span className="text-destructive">*</span></Label>
                <Select value={currencyCode} onValueChange={setCurrencyCode}>
                  <SelectTrigger><SelectValue placeholder="Selecciona tu moneda" /></SelectTrigger>
                  <SelectContent>
                    {availableCurrencies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Saldo inicial (opcional)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">El dinero con el que arranca tu balance en esta moneda. Puedes dejarlo en 0.</p>
              </div>
            </div>
          )}
        </div>

        {/* Pie: navegación + escape */}
        <div className="flex flex-col gap-3 border-t p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>

          <div className="flex gap-2 sm:justify-end">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={saving}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Atrás
              </Button>
            )}
            {step < 3 && (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 && !hasTradeName}
                className="flex-1 sm:flex-none"
              >
                Siguiente
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleFinish} disabled={!canFinish} loading={saving} className="flex-1 sm:flex-none">
                {!saving && <Check className="mr-2 h-4 w-4" />}
                Finalizar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
