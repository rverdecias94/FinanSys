import { Crown } from 'lucide-react'
import { PlansPanel } from '@/components/config/PlansPanel'
import { CuentaPageShell } from '@/pages/cuenta/CuentaPageShell'

export default function PlanPage() {
  return (
    <CuentaPageShell title="Mi plan" icon={Crown}>
      <PlansPanel />
    </CuentaPageShell>
  )
}
