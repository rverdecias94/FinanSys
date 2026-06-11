import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { adminSetBusinessPlan } from '@/services/planRequests'
import { toast } from 'sonner'

export function AdminSetBusinessPlanCard({ onSuccess }) {
  const [businessId, setBusinessId] = useState('')
  const [planId, setPlanId] = useState('premium')
  const [months, setMonths] = useState('1')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () => adminSetBusinessPlan({
      targetBusinessId: businessId.trim(),
      targetPlanId: planId,
      months: planId === 'premium' ? Number(months) || 1 : null,
      adminNotes: notes
    }),
    onSuccess: () => {
      toast.success('Plan actualizado')
      onSuccess?.()
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajuste manual</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <Label>Business ID</Label>
          <Input value={businessId} onChange={(e) => setBusinessId(e.target.value)} placeholder="UUID del negocio" />
        </div>
        <div>
          <Label>Plan</Label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="free">Gratuito</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Meses</Label>
          <Input
            type="number"
            min={1}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            disabled={planId !== 'premium'}
          />
        </div>
        <div className="md:col-span-3">
          <Label>Nota</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="flex items-end">
          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !businessId.trim()}
          >
            Aplicar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

