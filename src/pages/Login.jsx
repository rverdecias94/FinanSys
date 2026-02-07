import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/config/supabase'
import { Button } from '@/components/ui/button'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <form className="w-full max-w-sm space-y-4" onSubmit={handleLogin}>
        <h1 className="text-xl font-semibold">Iniciar sesión</h1>
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
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
        <div className="text-sm">
          ¿No tienes cuenta? <Link to="/signup" className="text-primary">Regístrate</Link>
        </div>
      </form>
    </div>
  )
}
