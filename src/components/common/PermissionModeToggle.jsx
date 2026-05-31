import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Shield, Eye } from 'lucide-react'
import { usePermissionMode } from '@/context/PermissionModeContext'
import { usePermissions } from '@/context/PermissionContext'
import { Badge } from '@/components/ui/badge'

export function PermissionModeToggle({ compact = false }) {
  const { permissionModeEnabled, togglePermissionMode, showPermissionToggle } = usePermissionMode()
  const { isOwner, loading } = usePermissions()

  if (!showPermissionToggle || loading) {
    return null
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Switch
          id="permission-mode-compact"
          checked={permissionModeEnabled}
          onCheckedChange={togglePermissionMode}
          size="sm"
        />
        <Label htmlFor="permission-mode-compact" className="text-xs font-medium">
          Permisos
        </Label>
        {permissionModeEnabled && isOwner && (
          <Badge variant="outline" size="sm" className="ml-1">
            Owner
          </Badge>
        )}
      </div>
    )
  }

  return (
    <div className="p-3 border-t border-border">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="permission-mode" className="text-sm font-medium">
              Modo Permisos
            </Label>
          </div>
          <Switch
            id="permission-mode"
            checked={permissionModeEnabled}
            onCheckedChange={togglePermissionMode}
          />
        </div>
        
        {permissionModeEnabled && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye className="w-3 h-3" />
            <span>Los permisos están activos</span>
            {isOwner && (
              <Badge variant="outline" size="sm" className="ml-auto">
                Propietario
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}