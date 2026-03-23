import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase JS v2 (PKCE) traz ?code= na URL após confirmação de e-mail.
    // exchangeCodeForSession troca o code por uma sessão válida.
    supabase.auth.exchangeCodeForSession(window.location.href).finally(() => {
      navigate('/dashboard', { replace: true })
    })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-th-bg">
      <div className="flex flex-col items-center gap-4">
        <span className="w-8 h-8 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">Verificando sua conta...</p>
      </div>
    </div>
  )
}
