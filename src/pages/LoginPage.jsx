import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AuthLayout from '../components/AuthLayout'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await signIn({ email, password })

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'E-mail ou senha inválidos.'
        : error.message
      )
      setLoading(false)
      return
    }

    navigate('/dashboard')
  }

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Acesse sua conta para continuar"
      footerText="Ainda não tem conta?"
      footerLink="/register"
      footerLinkText="Criar conta"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="label">E-mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="input-field"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="label">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input-field"
            required
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Entrando...
            </span>
          ) : 'Entrar'}
        </button>
      </form>
    </AuthLayout>
  )
}
