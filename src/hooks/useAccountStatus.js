import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/config/supabase'
import { useSession } from '@/hooks/useSession'

// Estado de la cuenta del usuario actual: 'active' | 'suspended' | 'deleted'.
// Devuelve null cuando aún no se conoce (cargando/offline) → el gate NO debe
// bloquear ante un estado desconocido (fallar abierto).
export function useAccountStatus() {
  const { session } = useSession()
  const { data } = useQuery({
    queryKey: ['accountStatus', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_account_status')
      if (error) throw error
      return data || 'active'
    },
    enabled: !!session?.user,
    staleTime: 60 * 1000,
    retry: false
  })
  return data ?? null
}
