import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { getBillingConfig, setBillingConfig } from '@/services/adminBusinesses'

// Configuración global de facturación (admin): días de aviso previo al vencimiento
// y días de gracia (prórroga) que se conceden a las cuentas Premium con pago
// atrasado antes del bloqueo. Antes solo existía en backend.
export function BillingConfigCard() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin-billing-config'], queryFn: getBillingConfig })

  const [lead, setLead] = useState('')
  const [grace, setGrace] = useState('')

  useEffect(() => {
    if (!data) return
    setLead(String(data.reminder_lead_days ?? 7))
    setGrace(String(data.grace_days ?? 3))
  }, [data])

  const mutation = useMutation({
    mutationFn: () => setBillingConfig({ reminderLeadDays: lead, graceDays: grace }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-billing-config'] })
      toast.success('Configuración de facturación actualizada')
    },
    onError: (e) => toast.error('No se pudo guardar la configuración', { description: e?.message })
  })

  const dirty = data && (String(data.reminder_lead_days) !== lead || String(data.grace_days) !== grace)
  const valid = Number(lead) >= 0 && Number(lead) <= 90 && Number(grace) >= 0 && Number(grace) <= 90

  return (
    <Card>
      <CardHeader>
        <CardTitle>Días de aviso y gracia</CardTitle>
      </CardHeader>
      <CardContent className="grid items-end gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="lead-days">Aviso previo (días)</Label>
          <Input id="lead-days" type="number" min={0} max={90} value={lead}
            disabled={isLoading} onChange={(e) => setLead(e.target.value)} />
          <p className="text-xs text-muted-foreground">Banner de aviso antes del vencimiento.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="grace-days">Gracia / prórroga (días)</Label>
          <Input id="grace-days" type="number" min={0} max={90} value={grace}
            disabled={isLoading} onChange={(e) => setGrace(e.target.value)} />
          <p className="text-xs text-muted-foreground">Tras vencer, antes del bloqueo total.</p>
        </div>
        <div>
          <Button className="w-full" onClick={() => mutation.mutate()} loading={mutation.isPending}
            disabled={isLoading || !dirty || !valid}>
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
