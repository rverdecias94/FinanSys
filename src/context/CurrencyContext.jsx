import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/config/supabase'
import { useSession } from '@/hooks/useSession'
import { toast } from 'sonner'

const CurrencyContext = createContext()

export function CurrencyProvider({ children }) {
  const { session } = useSession()
  const [availableCurrencies, setAvailableCurrencies] = useState([])
  const [businessCurrencies, setBusinessCurrencies] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchCurrencies = async () => {
    try {
      // Fetch all available currencies
      const { data: allCurrencies, error: allError } = await supabase
        .from('currencies')
        .select('*')
        .order('code')

      if (allError) throw allError
      setAvailableCurrencies(allCurrencies || [])

      if (session?.user?.id) {
        // Fetch business specific currencies
        const { data: myCurrencies, error: myError } = await supabase
          .from('business_currencies')
          .select('*, currency:currencies(*)')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .order('is_default', { ascending: false }) // Default first

        if (myError) throw myError

        // If no currencies configured (new user), set defaults (USD, CUP)
        if (!myCurrencies || myCurrencies.length === 0) {
          // We could auto-initialize here, but let's just return empty for now
          // or maybe initialize with USD/CUP if migration didn't run for new users?
          // For now, assume migration handled existing users. New users might need logic.
          setBusinessCurrencies([])
        } else {
          setBusinessCurrencies(myCurrencies.map(c => ({
            ...c.currency,
            is_default: c.is_default,
            business_currency_id: c.id
          })))
        }
      }
    } catch (error) {
      console.error('Error fetching currencies:', error)
      toast.error('Error al cargar configuración de monedas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCurrencies()
  }, [session])

  const toggleCurrency = async (currencyCode, isActive) => {
    if (!session?.user?.id) return

    try {
      if (isActive) {
        // Add currency
        const { error } = await supabase
          .from('business_currencies')
          .upsert({
            user_id: session.user.id,
            currency_code: currencyCode,
            is_active: true
          }, { onConflict: 'user_id, currency_code' })

        if (error) throw error
        toast.success(`Moneda ${currencyCode} activada`)
      } else {
        // Deactivate (remove)
        // Check if it's the default one
        const currency = businessCurrencies.find(c => c.code === currencyCode)
        if (currency?.is_default) {
          toast.error('No puedes desactivar la moneda principal')
          return
        }

        const { error } = await supabase
          .from('business_currencies')
          .delete()
          .eq('user_id', session.user.id)
          .eq('currency_code', currencyCode)

        if (error) throw error
        toast.success(`Moneda ${currencyCode} desactivada`)
      }
      await fetchCurrencies()
    } catch (error) {
      console.error('Error toggling currency:', error)
      toast.error('Error al actualizar moneda')
    }
  }

  const setMainCurrency = async (currencyCode) => {
    if (!session?.user?.id) return

    try {
      // Set all to false first (or update specifically)
      // Supabase doesn't support update all easily in one go without a function or multiple calls
      // We can use a transaction or just update the new default

      // Update new default
      const { error } = await supabase
        .from('business_currencies')
        .update({ is_default: true })
        .eq('user_id', session.user.id)
        .eq('currency_code', currencyCode)

      if (error) throw error

      // Update others to false
      await supabase
        .from('business_currencies')
        .update({ is_default: false })
        .eq('user_id', session.user.id)
        .neq('currency_code', currencyCode)

      toast.success(`Moneda principal actualizada a ${currencyCode}`)
      await fetchCurrencies()
    } catch (error) {
      console.error('Error setting main currency:', error)
      toast.error('Error al cambiar moneda principal')
    }
  }

  const formatCurrency = (amount, currencyCode) => {
    const currency = availableCurrencies.find(c => c.code === currencyCode) || { symbol: '$' }
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  return (
    <CurrencyContext.Provider value={{
      availableCurrencies,
      businessCurrencies,
      loading,
      toggleCurrency,
      setMainCurrency,
      formatCurrency,
      refreshCurrencies: fetchCurrencies
    }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => useContext(CurrencyContext)
