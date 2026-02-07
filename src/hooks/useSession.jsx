import { useEffect, useState } from 'react'
import { supabase } from '@/config/supabase'

export function useSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
        setLoading(false)
      }
    })
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}
