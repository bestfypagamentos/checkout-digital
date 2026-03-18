import { useState, useEffect } from 'react'
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react'
import BestfyIcon from '../components/BestfyIcon'
import DashboardLayout from '../components/DashboardLayout'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

// Estado de validação: 'idle' | 'loading' | 'success' | 'error'

export default function IntegrationsPage() {
  const { user } = useAuth()
  const [apiKey, setApiKey] = useState('')
  const [savedKey, setSavedKey] = useState(null)   // chave já salva no banco
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState('idle')      // estado da validação
  const [companyName, setCompanyName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loadingPage, setLoadingPage] = useState(true)

  // ─── Carrega chave já salva ────────────────────────────────────────────────
  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('bestfy_api_key')
        .eq('id', user.id)
        .single()

      if (data?.bestfy_api_key) {
        setSavedKey(data.bestfy_api_key)
        setApiKey(data.bestfy_api_key)
        setStatus('success')
      }
      setLoadingPage(false)
    }
    loadProfile()
  }, [user.id])

  // ─── Valida e salva ───────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault()
    const trimmedKey = apiKey.trim()
    if (!trimmedKey) return

    setStatus('loading')
    setErrorMsg('')
    setCompanyName('')

    // 1. Valida via Edge Function (evita CORS e esconde a key do DevTools)
    let company = null
    try {
      // JWT desativado no painel do Supabase — invoke envia a anon key automaticamente
      const { data, error: fnError } = await supabase.functions.invoke('validate-bestfy', {
        body: { apiKey: trimmedKey },
      })

      if (fnError) {
        setStatus('error')
        setErrorMsg('Erro ao conectar com o servidor. Tente novamente.')
        return
      }

      if (!data?.valid) {
        setStatus('error')
        setErrorMsg('Chave inválida. Verifique se copiou corretamente da sua dashboard Bestfy.')
        return
      }

      company = data.company
    } catch {
      setStatus('error')
      setErrorMsg('Erro de conexão. Verifique sua internet e tente novamente.')
      return
    }

    // 2. Salva no Supabase (upsert no profile)
    const fantasyName = company?.fantasy_name || company?.name || company?.tradeName || 'Empresa'

    const { error: dbError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        bestfy_api_key: trimmedKey,
        updated_at: new Date().toISOString(),
      })

    if (dbError) {
      setStatus('error')
      setErrorMsg('Erro ao salvar no banco. Tente novamente.')
      return
    }

    setSavedKey(trimmedKey)
    setCompanyName(fantasyName)
    setStatus('success')
  }

  // ─── Remove integração ────────────────────────────────────────────────────
  const handleRemove = async () => {
    await supabase
      .from('profiles')
      .update({ bestfy_api_key: null, bestfy_company_name: null })
      .eq('id', user.id)

    setApiKey('')
    setSavedKey(null)
    setCompanyName('')
    setStatus('idle')
  }

  const maskedKey = savedKey
    ? savedKey.slice(0, 6) + '••••••••••••••••' + savedKey.slice(-4)
    : ''

  const hasChanged = apiKey.trim() !== (savedKey ?? '')

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-th-text">Integrações</h1>
        <p className="text-zinc-500 text-sm mt-1">Conecte seu gateway de pagamentos.</p>
      </div>

      {loadingPage ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">

          {/* ── Card Bestfy ── */}
          <div className="th-card bg-th-surface border border-th-line rounded-2xl overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-th-line">
              <div className="flex items-center gap-3">
                <BestfyIcon size={40} />
                <div>
                  <p className="font-medium text-th-text text-sm">Bestfy</p>
                  <p className="text-xs text-zinc-500">Gateway de pagamentos via PIX</p>
                </div>
              </div>

              {/* Badge de status */}
              {status === 'success' && savedKey ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 bg-th-raised border border-zinc-300 dark:border-zinc-800 px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  Não conectado
                </span>
              )}
            </div>

            {/* Feedback de sucesso — empresa conectada */}
            {status === 'success' && savedKey && companyName && (
              <div className="mx-6 mt-5 flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-300">Conexão com Bestfy estabelecida</p>
                  <p className="text-xs text-emerald-400/70 mt-0.5">{companyName}</p>
                </div>
              </div>
            )}

            {/* Feedback de erro */}
            {status === 'error' && (
              <div className="mx-6 mt-5 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{errorMsg}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div>
                <label className="label flex items-center gap-1.5">
                  API Key
                  <ShieldCheck className="w-3.5 h-3.5 text-th-text-4" />
                </label>
                <p className="text-xs text-th-text-4 mb-2">
                  Encontre sua chave em <span className="text-zinc-500">Dashboard Bestfy → Configurações → API</span>
                </p>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => {
                      setApiKey(e.target.value)
                      if (status !== 'idle') setStatus('idle')
                    }}
                    placeholder={savedKey ? maskedKey : 'bfy_live_••••••••••••••••'}
                    className="input-field pr-12 font-mono text-sm"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-th-text-2 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={status === 'loading' || !apiKey.trim() || !hasChanged}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    'Validar e salvar'
                  )}
                </button>

                {savedKey && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="px-4 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    Remover
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Nota de segurança */}
          <p className="text-xs text-th-text-4 px-1">
            A API Key é armazenada de forma segura e usada apenas para processar pagamentos dos seus checkouts.
          </p>

        </div>
      )}
    </DashboardLayout>
  )
}
