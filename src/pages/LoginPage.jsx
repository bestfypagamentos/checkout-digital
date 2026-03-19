import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AuthLayout from '../components/AuthLayout'
import {
  validateEmail,
  isHoneypotFilled,
  isTooFast,
  loginLimiter,
  LIMITS,
} from '../lib/formSecurity'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [honeypot, setHoneypot] = useState('')  // campo isca para bots
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [lockSecs, setLockSecs] = useState(0)

  const mountedAt = useRef(Date.now())
  const timerRef  = useRef(null)
  const { signIn } = useAuth()
  const navigate   = useNavigate()

  // Contagem regressiva durante bloqueio
  useEffect(() => {
    if (lockSecs <= 0) return
    timerRef.current = setInterval(() => {
      setLockSecs(s => {
        if (s <= 1) { clearInterval(timerRef.current); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [lockSecs])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // 1. Honeypot — bot preencheu o campo oculto
    if (isHoneypotFilled(honeypot)) return

    // 2. Rate limiter — muitas tentativas falhas
    if (loginLimiter.isLocked) {
      setLockSecs(loginLimiter.remainingSeconds)
      setError(`Muitas tentativas. Aguarde ${loginLimiter.remainingSeconds} segundos.`)
      return
    }

    // 3. Envio ultra-rápido — padrão de bot
    if (isTooFast(mountedAt.current, 1200)) return

    // 4. Validação de inputs
    const emailErr = validateEmail(email)
    if (emailErr) { setError(emailErr); return }

    if (!password) { setError('Informe a senha.'); return }
    if (password.length > LIMITS.password.max) { setError('Senha inválida.'); return }

    setLoading(true)

    const { error: authError } = await signIn({
      email:    email.trim().toLowerCase(),
      password,
    })

    if (authError) {
      loginLimiter.recordFailure()

      if (loginLimiter.isLocked) {
        const secs = loginLimiter.remainingSeconds
        setLockSecs(secs)
        setError(`Muitas tentativas incorretas. Aguarde ${secs} segundos.`)
      } else {
        // Mensagem genérica — não revela se o e-mail existe
        setError('E-mail ou senha inválidos.')
      }

      setLoading(false)
      return
    }

    loginLimiter.reset()
    navigate('/dashboard')
  }

  const isDisabled = loading || lockSecs > 0

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Acesse sua conta para continuar"
      footerText="Ainda não tem conta?"
      footerLink="/register"
      footerLinkText="Criar conta"
    >
      <form onSubmit={handleSubmit} className="space-y-5" autoComplete="on" noValidate>

        {/* Honeypot — invisível para humanos, bots preenchem automaticamente */}
        <div
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
        >
          <label htmlFor="hp_website">Website</label>
          <input
            id="hp_website"
            type="text"
            name="website"
            value={honeypot}
            onChange={e => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="email" className="label">E-mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="input-field"
            maxLength={LIMITS.email.max}
            autoComplete="email"
            inputMode="email"
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
            maxLength={LIMITS.password.max}
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3" role="alert">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {lockSecs > 0 && !error && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3" role="status">
            <p className="text-sm text-yellow-400">Aguarde <strong>{lockSecs}s</strong> antes de tentar novamente.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isDisabled}
          className="btn-primary"
          aria-busy={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Entrando...
            </span>
          ) : lockSecs > 0 ? `Aguarde ${lockSecs}s` : 'Entrar'}
        </button>
      </form>
    </AuthLayout>
  )
}
