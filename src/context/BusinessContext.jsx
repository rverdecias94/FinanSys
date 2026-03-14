import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/config/supabase'
import { useSession } from '@/hooks/useSession'
import { getBusinessContext } from '@/services/team'

const BusinessContext = createContext({})

export function BusinessProvider({ children }) {
  const { session } = useSession()
  const [businessContext, setBusinessContext] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function resolveBusinessContext() {
      if (!session?.user?.id) {
        setBusinessContext(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        console.log('Resolviendo contexto de negocio para userId:', session.user.id)
        const context = await getBusinessContext(session.user.id)
        console.log('Contexto obtenido:', context)

        if (context) {
          setBusinessContext(context)
        } else {
          // Si no hay contexto, el usuario es nuevo y no tiene negocio ni equipo
          console.log('No hay contexto, asumiendo usuario nuevo')
          setBusinessContext({
            businessId: session.user.id,
            isOwner: true, // Usuario nuevo es owner de su propio negocio
            roleId: null,
            permissions: ['*']
          })
        }
      } catch (error) {
        console.error('Error resolving business context:', error)
        // Fallback seguro: asumir que es un nuevo usuario creando su negocio
        setBusinessContext({
          businessId: session.user.id,
          isOwner: true,
          roleId: null,
          permissions: ['*']
        })
      } finally {
        setLoading(false)
      }
    }

    resolveBusinessContext()
  }, [session])

  const value = {
    businessId: businessContext?.businessId || session?.user?.id,
    isOwner: businessContext?.isOwner ?? true, // Por defecto asumir owner para usuarios nuevos
    roleId: businessContext?.roleId || null,
    permissions: businessContext?.permissions || ['*'], // Por defecto permisos completos para owners
    loading
  }

  console.log('BusinessContext value:', value)

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  )
}

export const useBusiness = () => useContext(BusinessContext)
