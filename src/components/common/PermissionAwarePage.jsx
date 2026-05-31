import { usePermissionMode } from '@/context/PermissionModeContext'

/**
 * Componente wrapper que renderiza la página adecuada según el modo de permisos
 * @param {Object} props
 * @param {React.Component} props.OriginalPage - Componente de página original
 * @param {React.Component} props.EnhancedPage - Componente de página con permisos
 * @param {string} props.module - Nombre del módulo para logging
 */
export function PermissionAwarePage({ OriginalPage, EnhancedPage, module = 'unknown' }) {
  const { permissionModeEnabled } = usePermissionMode()

  if (permissionModeEnabled && EnhancedPage) {
    return <EnhancedPage />
  }

  return <OriginalPage />
}