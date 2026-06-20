import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '@/context/ThemeContext'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { getBalanceConfig, updateBalanceConfig } from '@/services/finanzas'
import { getBusinessSettings, upsertBusinessSettings, uploadCompanyLogo } from '@/services/businessSettings'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BalanceBaseSection } from '@/components/config/general/BalanceBaseSection'
import { AppearanceSection } from '@/components/config/general/AppearanceSection'
import { BusinessProfileSection } from '@/components/config/general/BusinessProfileSection'
import { RegionFormatsSection } from '@/components/config/general/RegionFormatsSection'
import { Button } from '@/components/ui/button'

function toDecimalInput(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return String(n)
}

export function GeneralSettingsPanel() {
  const { session } = useSession()
  const { businessId, isOwner } = useBusiness()
  const { theme, setTheme } = useTheme()
  const { businessCurrencies, setMainCurrency, toggleCurrency } = useCurrency()
  const queryClient = useQueryClient()

  const effectiveId = businessId || session?.user?.id

  const settingsQuery = useQuery({
    queryKey: ['configuracion', 'general-settings', effectiveId],
    queryFn: () => getBusinessSettings(session?.user?.id, businessId),
    enabled: !!session?.user?.id && !!effectiveId,
    staleTime: 10_000
  })

  const balanceQuery = useQuery({
    queryKey: ['configuracion', 'balances', effectiveId],
    queryFn: () => getBalanceConfig(session?.user?.id, businessId),
    enabled: !!session?.user?.id && !!effectiveId,
    staleTime: 10_000
  })

  const balances = useMemo(() => {
    const rows = Array.isArray(balanceQuery.data) ? balanceQuery.data : []
    const map = {}
    for (const r of rows) {
      map[r.currency_code] = r
    }
    return map
  }, [balanceQuery.data])

  const defaultCurrency = useMemo(() => {
    return businessCurrencies.find((c) => c.is_default)?.code || 'USD'
  }, [businessCurrencies])

  const [mainCurrency, setMainCurrencyLocal] = useState(defaultCurrency)
  const [valuationMethod, setValuationMethod] = useState('fifo')

  const [fontSize, setFontSize] = useState('normal')
  const [dateFormat, setDateFormat] = useState('DD/MM/AAAA')
  const [timeZone, setTimeZone] = useState('America/Havana')
  const [numberFormat, setNumberFormat] = useState('es-ES')

  const [company, setCompany] = useState({
    tradeName: '',
    legalName: '',
    taxId: '',
    phone: '',
    email: '',
    logoUrl: ''
  })

  const [logoUploading, setLogoUploading] = useState(false)
  const [hasEdits, setHasEdits] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState(null)

  const [initialBalances, setInitialBalances] = useState(() => ({
    CUP: '',
    USD: '',
    EUR: '',
    MXN: ''
  }))

  useEffect(() => {
    setMainCurrencyLocal(defaultCurrency)
  }, [defaultCurrency])

  useEffect(() => {
    try {
      const savedFontSize = localStorage.getItem('app-font-size')
      if (savedFontSize) {
        setFontSize(savedFontSize)
      }
    } catch {
      null
    }
  }, [])

  useEffect(() => {
    if (!settingsQuery.data || hasEdits) return
    const s = settingsQuery.data

    if (s.valuation_method) setValuationMethod(s.valuation_method)
    if (s.company) setCompany((prev) => ({ ...prev, ...s.company }))
    if (s.region?.dateFormat) setDateFormat(s.region.dateFormat)
    if (s.region?.timeZone) setTimeZone(s.region.timeZone)
    if (s.region?.numberFormat) setNumberFormat(s.region.numberFormat)

    setSavedSnapshot({
      valuationMethod: s.valuation_method || 'fifo',
      company: s.company || {},
      region: s.region || {}
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
      null
    }
  }, [fontSize])

  useEffect(() => {
    const next = { ...initialBalances }
    for (const code of ['CUP', 'USD', 'EUR', 'MXN']) {
      if (balances[code]?.initial_balance !== undefined) {
        next[code] = toDecimalInput(balances[code].initial_balance)
      }
    }
    setInitialBalances(next)
  }, [balances])

  const timeZones = useMemo(() => {
    const fallback = ['America/Havana', 'America/Mexico_City', 'America/New_York', 'Europe/Madrid', 'UTC']
    const supported = typeof Intl?.supportedValuesOf === 'function'
    if (!supported) return fallback
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      return fallback
    }
  }, [])

  const settingsPayload = useMemo(() => {
    return {
      valuationMethod,
      company,
      region: {
        dateFormat,
        timeZone,
        numberFormat
      }
    }
  }, [company, dateFormat, numberFormat, timeZone, valuationMethod])

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return false
    const a = JSON.stringify(savedSnapshot)
    const b = JSON.stringify(settingsPayload)
    return a !== b
  }, [savedSnapshot, settingsPayload])

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('no_session')
      return await upsertBusinessSettings(session.user.id, businessId, {
        company: settingsPayload.company,
        region: settingsPayload.region,
        valuationMethod: settingsPayload.valuationMethod
      })
    },
    onSuccess: (data) => {
      setSavedSnapshot({
        valuationMethod: data?.valuation_method || settingsPayload.valuationMethod,
        company: data?.company || settingsPayload.company,
        region: data?.region || settingsPayload.region
      })
      setHasEdits(false)
      queryClient.setQueryData(['configuracion', 'general-settings', effectiveId], data || null)
      toast.success('Configuración general guardada')
    },
    onError: () => {
      toast.error('No se pudo guardar la configuración general')
    }
  })

  const canSave = useMemo(() => {
    if (!isOwner) return false
    if (saveSettingsMutation.isPending) return false
    if (settingsQuery.isLoading) return false
    if (!savedSnapshot) return true
    return isDirty
  }, [isDirty, isOwner, saveSettingsMutation.isPending, savedSnapshot, settingsQuery.isLoading])

  const handleSaveBaseCurrency = async () => {
    if (!isOwner) return
    try {
      const isActive = businessCurrencies.some((c) => c.code === mainCurrency)
      if (!isActive) {
        await toggleCurrency(mainCurrency, true)
      }
      await setMainCurrency(mainCurrency)
      toast.success('Moneda principal actualizada')
    } catch {
      toast.error('No se pudo actualizar la moneda principal')
    }
  }

  const handleUpdateBalances = async () => {
    if (!session?.user?.id || !isOwner) return

    const payload = ['CUP', 'USD', 'EUR', 'MXN']
      .map((code) => {
        const raw = initialBalances[code]
        const n = Number(raw)
        if (!Number.isFinite(n)) return null
        return { currency_code: code, initial_balance: n }
      })
      .filter(Boolean)

    if (payload.length === 0) {
      toast.error('Ingresa al menos un saldo inicial válido')
      return
    }

    try {
      await updateBalanceConfig(session.user.id, businessId, payload)
      await balanceQuery.refetch()
      toast.success('Balance inicial actualizado')
    } catch {
      toast.error('Error al actualizar el balance')
    }
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

  const themeLabel = theme === 'dark' ? 'Modo Oscuro (Obsidian)' : theme === 'light' ? 'Modo Claro' : 'Sistema'

  return (
    <div className="space-y-6">
      <BalanceBaseSection
        isOwner={isOwner}
        mainCurrency={mainCurrency}
        onChangeMainCurrency={setMainCurrencyLocal}
        valuationMethod={valuationMethod}
        onChangeValuationMethod={(v) => {
          setHasEdits(true)
          setValuationMethod(v)
        }}
        initialBalances={initialBalances}
        onChangeInitialBalance={(code, value) => setInitialBalances((prev) => ({ ...prev, [code]: value }))}
        currentBalances={{
          CUP: toDecimalInput(balances.CUP?.current_balance ?? 0),
          USD: toDecimalInput(balances.USD?.current_balance ?? 0),
          EUR: toDecimalInput(balances.EUR?.current_balance ?? 0),
          MXN: toDecimalInput(balances.MXN?.current_balance ?? 0)
        }}
        onSaveBaseCurrency={handleSaveBaseCurrency}
        onUpdateBalances={handleUpdateBalances}
        isRefreshing={balanceQuery.isFetching}
      />

      <AppearanceSection
        isOwner={isOwner}
        themeLabel={themeLabel}
        themeValue={theme}
        onTheme={setTheme}
        fontSize={fontSize}
        onFontSize={setFontSize}
      />

      <BusinessProfileSection
        isOwner={isOwner}
        company={company}
        onCompany={(patch) => {
          setHasEdits(true)
          setCompany((p) => ({ ...p, ...patch }))
        }}
        onLogoFile={onLogoFile}
        logoUploading={logoUploading}
      />

      <RegionFormatsSection
        isOwner={isOwner}
        dateFormat={dateFormat}
        onDateFormat={(v) => {
          setHasEdits(true)
          setDateFormat(v)
        }}
        timeZone={timeZone}
        onTimeZone={(v) => {
          setHasEdits(true)
          setTimeZone(v)
        }}
        timeZones={timeZones}
        numberFormat={numberFormat}
        onNumberFormat={(v) => {
          setHasEdits(true)
          setNumberFormat(v)
        }}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {settingsQuery.isLoading
            ? 'Cargando configuración guardada…'
            : saveSettingsMutation.isPending
              ? 'Guardando…'
              : !savedSnapshot
                ? ''
                : isDirty
                  ? 'Hay cambios sin guardar.'
                  : 'Todo está guardado.'}
        </div>
        <Button onClick={() => saveSettingsMutation.mutate()} loading={saveSettingsMutation.isPending} disabled={!canSave}>
          Guardar Perfil y Formatos
        </Button>
      </div>
    </div>
  )
}
