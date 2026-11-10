import { Navigate } from 'react-router-dom'
import { useBusiness } from '@/context/BusinessContext'

/** Compatibilidad: /configuracion → primera ruta de Cuenta. */
export default function ConfigRedirect() {
  const { isOwner } = useBusiness()
  return <Navigate to={isOwner ? '/cuenta/plan' : '/cuenta/negocio'} replace />
}
