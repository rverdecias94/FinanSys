import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, UploadCloud } from 'lucide-react'

export function BusinessProfileSection({ isOwner, company, onCompany, onLogoFile, logoUploading, errors = {} }) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (!isOwner || logoUploading) return
    const file = e.dataTransfer?.files?.[0]
    if (file) onLogoFile(file)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Perfil de la Empresa
        </CardTitle>
        <CardDescription>Datos que aparecen en tus reportes y documentos exportados.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre Comercial</Label>
            <Input value={company.tradeName} onChange={(e) => onCompany({ tradeName: e.target.value })} disabled={!isOwner} aria-invalid={!!errors.tradeName} />
            {errors.tradeName && <p className="text-xs text-destructive">{errors.tradeName}</p>}
          </div>
          <div className="space-y-2">
            <Label>Razón Social</Label>
            <Input value={company.legalName} onChange={(e) => onCompany({ legalName: e.target.value })} disabled={!isOwner} aria-invalid={!!errors.legalName} />
            {errors.legalName && <p className="text-xs text-destructive">{errors.legalName}</p>}
          </div>
          <div className="space-y-2">
            <Label>Identificación Fiscal / NIT</Label>
            <Input value={company.taxId} onChange={(e) => onCompany({ taxId: e.target.value })} disabled={!isOwner} aria-invalid={!!errors.taxId} />
            {errors.taxId && <p className="text-xs text-destructive">{errors.taxId}</p>}
          </div>
          <div className="space-y-2">
            <Label>Teléfono de Contacto</Label>
            <Input value={company.phone} onChange={(e) => onCompany({ phone: e.target.value })} disabled={!isOwner} aria-invalid={!!errors.phone} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div className="space-y-2">
            <Label>Correo Electrónico del Negocio</Label>
            <Input type="email" value={company.email} onChange={(e) => onCompany({ email: e.target.value })} disabled={!isOwner} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Subir Logo del Negocio (PNG/SVG, máx. 2MB)</Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label
              className={`flex-1 rounded-md border border-dashed p-4 cursor-pointer bg-muted/10 transition-colors ${isDragging ? 'bg-muted/30 border-primary/60' : 'hover:bg-muted/20'}`}
              onDragEnter={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (!isOwner || logoUploading) return
                setIsDragging(true)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (!isOwner || logoUploading) return
                setIsDragging(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragging(false)
              }}
              onDrop={handleDrop}
            >
              <div className="flex items-center gap-3">
                <UploadCloud className="h-5 w-5 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">Arrastra y suelta o haz clic para seleccionar</div>
                  <div className="text-xs text-muted-foreground">Se guarda en la cuenta del negocio.</div>
                </div>
              </div>
              <input
                type="file"
                accept="image/png,image/svg+xml"
                className="hidden"
                onChange={(e) => onLogoFile(e.target.files?.[0] || null)}
                disabled={!isOwner || logoUploading}
              />
            </label>
            <div className="w-full sm:w-[160px]">
              <div className="rounded-md border bg-card p-3 flex items-center justify-center h-[96px]">
                {company.logoUrl ? (
                  <img src={company.logoUrl} alt="Logo" className="max-h-[72px] max-w-[120px] object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">Sin logo</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {!isOwner && <p className="text-xs text-muted-foreground">Solo el propietario puede modificar el perfil.</p>}
      </CardContent>
    </Card>
  )
}
