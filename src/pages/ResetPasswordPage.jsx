import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AuthLayout from '../components/AuthLayout'
import { passwordStrength, LIMITS } from '../lib/formSecurity'
import { supabase } from '../lib/supabaseClient'

// Barra de força da senha (reutilizável)
function PasswordStrengthMeter({ password }) {
  if (!password) return null
  const level  = passwordStrength(password)
  const labels = ['Fraca', 'Média', 'Boa', 'Forte']
  const colors  = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500']
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= level ? colors[level] : 'bg-white/10'}`}
          />
        ))}
      </div>
      <p className="text-xs text-zinc-400">Força: <span className="font-medium text-white">{labels[level]}</span></p>
    </div>
  )
}

export default function ResetPasswordPage() {
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [success,   setSuccess]   = useState(false)
  const [ready,     setReady]     = useState(false)

  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const params     = new URLSearchParams(window.location.search)
    const tokenHash  = params.get('token_hash')
    const type       = params.get('type')

    if (tokenHash && type === 'recovery') {
      // Verifica o token via SDK e estabelece a sessão de recovery
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        .then(({ error }) => {
          if (error) {
            console.error('[reset-password] verifyOtp error:', error.message)
          } else {
            setReady(true)
          }
        })
    } else {
      // Fallback: usuário já tem sessão ativa (ex: logado e mudando senha)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setReady(true)
      })
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password.length < LIMITS.password.min) {
      setError(`A senha deve ter pelo menos ${LIMITS.password.min} caracteres.`)
      return
    }
    if (password.length > LIMITS.password.max) {
      setError('Senha muito longa.')
      return
    }
    if (passwordStrength(password) < 1) {
      setError('Escolha uma senha mais forte.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error: updateError } = await updatePassword(password)
    setLoading(false)

    if (updateError) {
      if (updateError.code === 'same_password') {
        setError('A nova senha não pode ser igual à senha atual.')
      } else {
        setError('Não foi possível redefinir a senha. O link pode ter expirado.')
      }
      return
    }

    setSuccess(true)
    setTimeout(() => navigate('/dashboard'), 3000)
  }

  // ── Link expirado / inválido ──────────────────────────────────────────────
  if (!ready) {
    return (
      <AuthLayout
        title="Redefinição de senha"
        subtitle="Verificando seu link..."
        footerText="Precisa de um novo link?"
        footerLink="/login"
        footerLinkText="Voltar ao login"
      >
        <div className="flex flex-col items-center gap-4 py-4">
          <span className="w-8 h-8 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
          <p className="text-sm text-zinc-400 text-center">
            Aguardando confirmação do link de redefinição...
          </p>
          <p className="text-xs text-zinc-500 text-center">
            Se demorar muito, o link pode ter expirado.{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-emerald-400 hover:underline"
            >
              Solicitar novo link
            </button>
          </p>
        </div>
      </AuthLayout>
    )
  }

  // ── Senha alterada com sucesso ────────────────────────────────────────────
  if (success) {
    return (
      <AuthLayout
        title="Senha redefinida!"
        subtitle="Sua senha foi alterada com sucesso"
        footerText=""
        footerLink=""
        footerLinkText=""
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-zinc-400">
            Redirecionando para o painel em instantes...
          </p>
        </div>
      </AuthLayout>
    )
  }

  // ── Formulário de nova senha ──────────────────────────────────────────────
  return (
    <AuthLayout
      title="Criar nova senha"
      subtitle="Escolha uma senha forte para sua conta"
      footerText=""
      footerLink=""
      footerLinkText=""
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="password" className="label">Nova senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input-field"
            minLength={LIMITS.password.min}
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
            placeholder="••••••••"
            className="input-field"
            maxLength={LIMITS.password.max}
            autoComplete="new-password"
            required
          />
          {confirm && password !== confirm && (
            <p className="text-xs text-red-400 mt-1">As senhas não coincidem.</p>
          )}
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
              Salvando...
            </span>
          ) : 'Salvar nova senha'}
        </button>
      </form>
    </AuthLayout>
  )
}
