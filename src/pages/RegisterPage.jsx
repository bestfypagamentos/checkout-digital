import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AuthLayout from '../components/AuthLayout'
import {
  validateName,
  validateEmail,
  validatePassword,
  passwordStrength,
  STRENGTH_LABELS,
  STRENGTH_COLORS,
  STRENGTH_TEXT,
  isHoneypotFilled,
  isTooFast,
  LIMITS,
} from '../lib/formSecurity'

// ── Indicador visual de força da senha ───────────────────────────────────────
function PasswordStrengthMeter({ password }) {
  if (!password) return null
  const level = passwordStrength(password)
  if (level < 0) return null

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= level ? STRENGTH_COLORS[level] : 'bg-zinc-700'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${STRENGTH_TEXT[level]}`}>
        Senha {STRENGTH_LABELS[level]}
      </p>
    </div>
  )
}

export default function RegisterPage() {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [honeypot, setHoneypot] = useState('')  // campo isca para bots
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(false)
  const [loading,  setLoading]  = useState(false)

  const mountedAt = useRef(Date.now())
  const { signUp } = useAuth()
  const navigate   = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // 1. Honeypot — bot preencheu o campo oculto
    if (isHoneypotFilled(honeypot)) return

    // 2. Envio ultra-rápido — padrão de bot
    if (isTooFast(mountedAt.current, 1200)) return

    // 3. Validação de nome
    const nameErr = validateName(name)
    if (nameErr) { setError(nameErr); return }

    // 4. Validação de e-mail
    const emailErr = validateEmail(email)
    if (emailErr) { setError(emailErr); return }

    // 5. Validação de senha
    const passErr = validatePassword(password)
    if (passErr) { setError(passErr); return }

    // 6. Confirmação de senha
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)

    const { data, error: authError } = await signUp({
      email:    email.trim().toLowerCase(),
      password,
      name:     name.trim(),
    })

    if (authError) {
      // Supabase retorna "User already registered" — mensagem genérica para evitar user enumeration
      setError(
        authError.message.toLowerCase().includes('already')
          ? 'Não foi possível criar a conta. Verifique os dados e tente novamente.'
          : 'Erro ao criar conta. Tente novamente mais tarde.'
      )
      setLoading(false)
      return
    }

    if (data?.session) {
      navigate('/dashboard')
    } else {
      setSuccess(true)
    }

    setLoading(false)
  }

  if (success) {
    return (
      <AuthLayout title="Verifique seu e-mail" subtitle="Quase lá!">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-th-text-3 text-sm">
            Enviamos um link de confirmação para{' '}
            <span className="text-th-text font-medium">{email}</span>.
            Acesse seu e-mail para ativar sua conta.
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Comece gratuitamente hoje"
      footerText="Já tem uma conta?"
      footerLink="/login"
      footerLinkText="Fazer login"
    >
      <form onSubmit={handleSubmit} className="space-y-5" autoComplete="on" noValidate>

        {/* Honeypot — invisível para humanos, bots preenchem automaticamente */}
        <div
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
        >
          <label htmlFor="hp_phone">Telefone</label>
          <input
            id="hp_phone"
            type="text"
            name="phone"
            value={honeypot}
            onChange={e => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="name" className="label">Nome completo</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Seu nome"
            className="input-field"
            maxLength={LIMITS.name.max}
            autoComplete="name"
            required
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
            placeholder={`Mínimo ${LIMITS.password.min} caracteres`}
            className="input-field"
            maxLength={LIMITS.password.max}
            autoComplete="new-password"
            required
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <div>
          <label htmlFor="confirm" className="label">Confirmar senha</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Repita a senha"
            className="input-field"
            maxLength={LIMITS.password.max}
            autoComplete="new-password"
            required
          />
          {confirm && password && confirm !== password && (
            <p className="text-xs text-red-400 mt-1.5">As senhas não coincidem.</p>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3" role="alert">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          aria-busy={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Criando conta...
            </span>
          ) : 'Criar conta'}
        </button>
      </form>
    </AuthLayout>
  )
}
