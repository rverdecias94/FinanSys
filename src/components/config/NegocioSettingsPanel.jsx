import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { getBusinessSettings, upsertBusinessSettings, uploadCompanyLogo } from '@/services/businessSettings'
import { BusinessProfileSection } from '@/components/config/general/BusinessProfileSection'
import { PeriodLockSection } from '@/components/config/general/PeriodLockSection'
import { Button } from '@/components/ui/button'
import { companySchema, validateForm } from '@/utils/formSchemas'
import { getClientDateFormat, getClientTimeZone } from '@/utils/localeDefaults'

/**
 * Perfil de empresa + cierre de período (ruta /cuenta/negocio).
 */
export function NegocioSettingsPanel() {
  const { session } = useSession()
  const { businessId, isOwner } = useBusiness()
  const queryClient = useQueryClient()
  const effectiveId = businessId || session?.user?.id

  const settingsQuery = useQuery({
    queryKey: ['configuracion', 'general-settings', effectiveId],
    queryFn: () => getBusinessSettings(session?.user?.id, businessId),
    enabled: !!session?.user?.id && !!effectiveId,
    staleTime: 10_000,
  })

  const [company, setCompany] = useState({
    tradeName: '',
    legalName: '',
    taxId: '',
    phone: '',
    email: '',
    logoUrl: '',
  })
  const [companyErrors, setCompanyErrors] = useState({})
  const [logoUploading, setLogoUploading] = useState(false)
  const [hasEdits, setHasEdits] = useState(false)
  const [savedCompany, setSavedCompany] = useState(null)

  useEffect(() => {
    if (!settingsQuery.data || hasEdits) return
    const s = settingsQuery.data
    if (s.company) setCompany((prev) => ({ ...prev, ...s.company }))
    setSavedCompany(s.company || {})
  }, [hasEdits, settingsQuery.data])

  const isDirty = useMemo(() => {
    if (!savedCompany) return false
    return JSON.stringify(savedCompany) !== JSON.stringify(company)
  }, [company, savedCompany])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('no_session')
      const s = settingsQuery.data
      const clientDateFormat = getClientDateFormat()
      const clientTimeZone = getClientTimeZone()
      return await upsertBusinessSettings(session.user.id, businessId, {
        company,
        region: s?.region || {
          dateFormat: clientDateFormat,
          timeZone: clientTimeZone,
          numberFormat: 'es-ES',
        },
        valuationMethod: s?.valuation_method || 'fifo',
        fx: s?.fx,
        period: s?.period,
      })
    },
    onSuccess: (data) => {
      setSavedCompany(data?.company || company)
      setHasEdits(false)
      setCompanyErrors({})
      queryClient.setQueryData(['configuracion', 'general-settings', effectiveId], data || null)
      toast.success('Datos del negocio guardados')
    },
    onError: () => {
      toast.error('No se pudo guardar el perfil del negocio')
    },
  })

  const canSave = isOwner && !saveMutation.isPending && !settingsQuery.isLoading && (savedCompany ? isDirty : true)

  const handleSave = () => {
    const validation = validateForm(companySchema, {
      tradeName: company.tradeName || '',
      legalName: company.legalName || '',
      taxId: company.taxId || '',
      phone: company.phone || '',
      email: company.email || '',
    })
    if (!validation.success) {
      setCompanyErrors(validation.errors)
      toast.error('Revisa los datos del negocio', { description: 'Hay campos con formato inválido.' })
      return
    }
    setCompanyErrors({})
    saveMutation.mutate()
  }

  const onLogoFile = async (file) => {
    if (!file || !session?.user?.id) return
    const allowed = ['image/png', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      toast.error('Formato no permitido', { description: 'Solo PNG o SVG (máx. 2MB).' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Archivo demasiado grande', { description: 'Máximo 2MB.' })
      return
    }
    setLogoUploading(true)
    try {
      const logoUrl = await uploadCompanyLogo(session.user.id, businessId, file)
      setHasEdits(true)
      setCompany((prev) => ({ ...prev, logoUrl }))
      toast.success('Logo cargado')
    } catch {
      toast.error('No se pudo cargar el logo')
    } finally {
      setLogoUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <BusinessProfileSection
        isOwner={isOwner}
        company={company}
        errors={companyErrors}
        onCompany={(patch) => {
          setHasEdits(true)
          const key = Object.keys(patch)[0]
          if (key && companyErrors[key]) {
            setCompanyErrors((prev) => {
              const next = { ...prev }
              delete next[key]
              return next
            })
          }
          setCompany((p) => ({ ...p, ...patch }))
        }}
        onLogoFile={onLogoFile}
        logoUploading={logoUploading}
      />

      <PeriodLockSection isOwner={isOwner} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {settingsQuery.isLoading
            ? 'Cargando…'
            : saveMutation.isPending
              ? 'Guardando…'
              : !savedCompany
                ? ''
                : isDirty
                  ? 'Hay cambios sin guardar.'
                  : 'Todo está guardado.'}
        </div>
        <Button onClick={handleSave} loading={saveMutation.isPending} disabled={!canSave}>
          Guardar negocio
        </Button>
      </div>
    </div>
  )
}
