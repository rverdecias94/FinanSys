import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/ui/button'

export default function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }
    const userId = data?.user?.id || null
    if (userId) {
      await supabase.from('profiles').insert({ id: userId, role: 'employee' })
    }
    setLoading(false)
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <form className="w-full max-w-sm space-y-4" onSubmit={handleSignup}>
        <h1 className="text-xl font-semibold">Crear cuenta</h1>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div className="space-y-2">
          <label className="text-sm">Correo</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
            required
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Registrando...' : 'Registrarse'}
        </Button>
        <div className="text-sm">
          ¿Ya tienes cuenta? <Link to="/login" className="text-primary">Inicia sesión</Link>
        </div>
      </form>
    </div>
  )
}
