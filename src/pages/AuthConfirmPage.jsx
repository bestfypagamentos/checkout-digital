import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function AuthConfirmPage() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const type = params.get('type') // 'signup' | 'recovery' | etc.

    if (!tokenHash || !type) {
      setError('Link de confirmação inválido.')
      return
    }

    supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
      if (error) {
        setError('Link expirado ou inválido. Solicite um novo cadastro.')
      } else {
        navigate('/dashboard', { replace: true })
      }
    })
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-th-bg px-4">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-sm">{error}</p>
          <a href="/register" className="text-emerald-400 hover:underline text-sm">
            Criar nova conta
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-th-bg">
      <div className="flex flex-col items-center gap-4">
        <span className="w-8 h-8 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">Confirmando sua conta...</p>
      </div>
    </div>
  )
}
