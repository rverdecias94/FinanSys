import { Building2 } from 'lucide-react'
import { NegocioSettingsPanel } from '@/components/config/NegocioSettingsPanel'
import { CuentaPageShell } from '@/pages/cuenta/CuentaPageShell'

export default function NegocioPage() {
  return (
    <CuentaPageShell title="Negocio" icon={Building2}>
      <NegocioSettingsPanel />
    </CuentaPageShell>
  )
}
