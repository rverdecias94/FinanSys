import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '@/context/ThemeContext'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { getBalanceConfig, updateBalanceConfig } from '@/services/finanzas'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { BalanceBaseSection } from '@/components/config/general/BalanceBaseSection'
import { AppearanceSection } from '@/components/config/general/AppearanceSection'
import { BusinessProfileSection } from '@/components/config/general/BusinessProfileSection'
import { RegionFormatsSection } from '@/components/config/general/RegionFormatsSection'

const STORAGE_KEY = 'configuracion.general.v1'

function safeJsonParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

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

  const effectiveId = businessId || session?.user?.id

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
    logoDataUrl: ''
  })

  const [logoUploading, setLogoUploading] = useState(false)

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
    if (!effectiveId) return
    const raw = localStorage.getItem(`${STORAGE_KEY}:${effectiveId}`)
    const saved = raw ? safeJsonParse(raw) : null
    if (!saved) return

    if (saved.valuationMethod) setValuationMethod(saved.valuationMethod)
    if (saved.fontSize) setFontSize(saved.fontSize)
    if (saved.dateFormat) setDateFormat(saved.dateFormat)
    if (saved.timeZone) setTimeZone(saved.timeZone)
    if (saved.numberFormat) setNumberFormat(saved.numberFormat)
    if (saved.company) setCompany((prev) => ({ ...prev, ...saved.company }))
  }, [effectiveId])

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
    const next = {
      valuationMethod,
      fontSize,
      dateFormat,
      timeZone,
      numberFormat,
      company
    }
    if (!effectiveId) return
    try {
      localStorage.setItem(`${STORAGE_KEY}:${effectiveId}`, JSON.stringify(next))
    } catch {
      null
    }
  }, [company, dateFormat, effectiveId, fontSize, numberFormat, timeZone, valuationMethod])

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
    if (!file) return
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
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('read_error'))
        reader.readAsDataURL(file)
      })
      setCompany((prev) => ({ ...prev, logoDataUrl: dataUrl }))
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
        onChangeValuationMethod={setValuationMethod}
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
        onCompany={(patch) => setCompany((p) => ({ ...p, ...patch }))}
        onLogoFile={onLogoFile}
        logoUploading={logoUploading}
      />

      <RegionFormatsSection
        isOwner={isOwner}
        dateFormat={dateFormat}
        onDateFormat={setDateFormat}
        timeZone={timeZone}
        onTimeZone={setTimeZone}
        timeZones={timeZones}
        numberFormat={numberFormat}
        onNumberFormat={setNumberFormat}
      />
    </div>
  )
}
