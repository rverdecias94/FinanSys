import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTheme } from '@/context/ThemeContext'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { getBusinessSettings, upsertBusinessSettings } from '@/services/businessSettings'
import { AppearanceSection } from '@/components/config/general/AppearanceSection'
import { RegionFormatsSection } from '@/components/config/general/RegionFormatsSection'
import { Button } from '@/components/ui/button'
import { getClientDateFormat, getClientTimeZone } from '@/utils/localeDefaults'

/**
 * Tema, tipografía y formatos de región (ruta /cuenta/apariencia).
 */
export function AparienciaSettingsPanel() {
  const { session } = useSession()
  const { businessId, isOwner } = useBusiness()
  const { theme, setTheme } = useTheme()
  const queryClient = useQueryClient()
  const effectiveId = businessId || session?.user?.id

  const settingsQuery = useQuery({
    queryKey: ['configuracion', 'general-settings', effectiveId],
    queryFn: () => getBusinessSettings(session?.user?.id, businessId),
    enabled: !!session?.user?.id && !!effectiveId,
    staleTime: 10_000,
  })

  const [fontSize, setFontSize] = useState('normal')
  const [dateFormat, setDateFormat] = useState(() => getClientDateFormat())
  const [timeZone, setTimeZone] = useState(() => getClientTimeZone())
  const [numberFormat, setNumberFormat] = useState('es-ES')
  const [hasEdits, setHasEdits] = useState(false)
  const [savedRegion, setSavedRegion] = useState(null)

  useEffect(() => {
    try {
      const savedFontSize = localStorage.getItem('app-font-size')
      if (savedFontSize) setFontSize(savedFontSize)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    setDateFormat(getClientDateFormat())
    setTimeZone(getClientTimeZone())
  }, [])

  useEffect(() => {
    if (!settingsQuery.data || hasEdits) return
    const s = settingsQuery.data
    const clientDateFormat = getClientDateFormat()
    const clientTimeZone = getClientTimeZone()
    setDateFormat(clientDateFormat)
    setTimeZone(clientTimeZone)
    if (s.region?.numberFormat) setNumberFormat(s.region.numberFormat)
    setSavedRegion({
      dateFormat: s.region?.dateFormat || clientDateFormat,
      timeZone: s.region?.timeZone || clientTimeZone,
      numberFormat: s.region?.numberFormat || 'es-ES',
    })
  }, [hasEdits, settingsQuery.data])

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('font-compact', 'font-normal', 'font-accessible')
    const cls = fontSize === 'compacta' ? 'font-compact' : fontSize === 'accesible' ? 'font-accessible' : 'font-normal'
    root.classList.add(cls)
    try {
      localStorage.setItem('app-font-size', fontSize)
    } catch {
      /* ignore */
    }
  }, [fontSize])

  const regionPayload = useMemo(
    () => ({ dateFormat, timeZone, numberFormat }),
    [dateFormat, numberFormat, timeZone],
  )

  const isDirty = useMemo(() => {
    if (!savedRegion) return false
    return JSON.stringify(savedRegion) !== JSON.stringify(regionPayload)
  }, [regionPayload, savedRegion])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('no_session')
      const s = settingsQuery.data
      return await upsertBusinessSettings(session.user.id, businessId, {
        company: s?.company || {},
        region: regionPayload,
        valuationMethod: s?.valuation_method || 'fifo',
        fx: s?.fx,
        period: s?.period,
      })
    },
    onSuccess: (data) => {
      setSavedRegion(data?.region || regionPayload)
      setHasEdits(false)
      queryClient.setQueryData(['configuracion', 'general-settings', effectiveId], data || null)
      toast.success('Apariencia y formatos guardados')
    },
    onError: () => {
      toast.error('No se pudo guardar la apariencia')
    },
  })

  const canSave = isOwner && !saveMutation.isPending && !settingsQuery.isLoading && (savedRegion ? isDirty : true)
  const themeLabel = theme === 'dark' ? 'Modo Oscuro (Obsidian)' : theme === 'light' ? 'Modo Claro' : 'Sistema'

  return (
    <div className="space-y-6">
      <AppearanceSection
        isOwner={isOwner}
        themeLabel={themeLabel}
        themeValue={theme}
        onTheme={setTheme}
        fontSize={fontSize}
        onFontSize={setFontSize}
      />

      <RegionFormatsSection
        isOwner={isOwner}
        dateFormat={dateFormat}
        timeZone={timeZone}
        numberFormat={numberFormat}
        onNumberFormat={(v) => {
          setHasEdits(true)
          setNumberFormat(v)
        }}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {settingsQuery.isLoading
            ? 'Cargando…'
            : saveMutation.isPending
              ? 'Guardando…'
              : !savedRegion
                ? ''
                : isDirty
                  ? 'Hay cambios sin guardar.'
                  : 'Todo está guardado.'}
        </div>
        <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!canSave}>
          Guardar formatos
        </Button>
      </div>
    </div>
  )
}
