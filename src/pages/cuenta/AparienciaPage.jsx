import { Palette } from 'lucide-react'
import { AparienciaSettingsPanel } from '@/components/config/AparienciaSettingsPanel'
import { CuentaPageShell } from '@/pages/cuenta/CuentaPageShell'

export default function AparienciaPage() {
  return (
    <CuentaPageShell title="Apariencia" icon={Palette}>
      <AparienciaSettingsPanel />
    </CuentaPageShell>
  )
}
