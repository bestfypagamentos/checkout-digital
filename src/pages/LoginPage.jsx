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
  // view: 'login' | 'forgot' | 'sent'
  const [view,     setView]     = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [lockSecs, setLockSecs] = useState(0)

  const mountedAt = useRef(Date.now())
  const timerRef  = useRef(null)
  const { signIn, resetPasswordForEmail } = useAuth()
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

  // ── Esqueceu a senha ─────────────────────────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault()
    setError(null)
    const emailErr = validateEmail(email)
    if (emailErr) { setError(emailErr); return }
    setLoading(true)
    await resetPasswordForEmail(email.trim().toLowerCase())
    // Sempre mostra "enviado" — não revela se o e-mail existe no sistema
    setLoading(false)
    setView('sent')
  }

  const isDisabled = loading || lockSecs > 0

  // ── View: e-mail enviado ──────────────────────────────────────────────────
  if (view === 'sent') {
    return (
      <AuthLayout
        title="Verifique seu e-mail"
        subtitle="Enviamos as instruções para redefinir sua senha"
        footerText="Lembrou a senha?"
        footerLink="/login"
        footerLinkText="Voltar ao login"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Se <span className="text-white font-medium">{email}</span> estiver cadastrado,
            você receberá um e-mail com o link de redefinição em instantes.
          </p>
          <p className="text-xs text-zinc-500">Não recebeu? Verifique a pasta de spam.</p>
          <button
            onClick={() => { setView('login'); setError(null) }}
            className="btn-primary mt-2"
          >
            Voltar ao login
          </button>
        </div>
      </AuthLayout>
    )
  }

  // ── View: esqueceu a senha ────────────────────────────────────────────────
  if (view === 'forgot') {
    return (
      <AuthLayout
        title="Redefinir senha"
        subtitle="Informe seu e-mail para receber o link de redefinição"
        footerText="Lembrou a senha?"
        footerLink="/login"
        footerLinkText="Voltar ao login"
      >
        <form onSubmit={handleForgot} className="space-y-5" noValidate>
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

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3" role="alert">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary" aria-busy={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enviando...
              </span>
            ) : 'Enviar link de redefinição'}
          </button>

          <button
            type="button"
            onClick={() => { setView('login'); setError(null) }}
            className="w-full text-sm text-zinc-400 hover:text-white transition-colors"
          >
            ← Voltar ao login
          </button>
        </form>
      </AuthLayout>
    )
  }

  // ── View: login (padrão) ──────────────────────────────────────────────────
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
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="label mb-0">Senha</label>
            <button
              type="button"
              onClick={() => { setView('forgot'); setError(null) }}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Esqueceu a senha?
            </button>
          </div>
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
