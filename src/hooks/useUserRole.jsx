import { useEffect, useState } from 'react'
import { supabase } from '@/config/supabase'

export function useUserRole(userId) {
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(!!userId)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) {
      setRole(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setError(error)
          setRole(null)
        } else {
          setRole(data?.role || null)
        }
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userId])

  return { role, loading, error }
}
