import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Copy, CheckCheck, Loader2, AlertCircle, PartyPopper, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const SUPABASE_URL       = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY
const FUNCTIONS_BASE_URL = `${SUPABASE_URL}/functions/v1`

// ── Formata moeda ─────────────────────────────────────────────────────────────
function brl(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── Countdown timer com base em uma data de expiração ────────────────────────
function useExpiryCountdown(expiresAt) {
  const [secondsLeft, setSecondsLeft] = useState(null)

  useEffect(() => {
    if (!expiresAt) return

    const calc = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000))
      setSecondsLeft(diff)
      return diff
    }

    calc()
    const t = setInterval(() => {
      if (calc() === 0) clearInterval(t)
    }, 1000)
    return () => clearInterval(t)
  }, [expiresAt])

  if (secondsLeft === null) return null
  const m = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const s = String(secondsLeft % 60).padStart(2, '0')
  return { display: `${m}:${s}`, expired: secondsLeft === 0, secondsLeft }
}

// ── QR Code via API pública ───────────────────────────────────────────────────
function QRCodeImage({ text, size = 200 }) {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    if (!text) return
    // Usa a API do QR Server (gratuita, sem chave)
    const encoded = encodeURIComponent(text)
    setSrc(`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=16`)
  }, [text, size])

  if (!src) return (
    <div className="w-[200px] h-[200px] bg-zinc-100 rounded-xl flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
    </div>
  )

  return (
    <img
      src={src}
      alt="QR Code PIX"
      width={size}
      height={size}
      className="rounded-xl border border-zinc-200 shadow-sm"
    />
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PixRecuperacaoPage() {
  const { saleId }    = useParams()
  const [state, setState] = useState('loading')  // loading | ready | paid | error | refreshing
  const [data, setData]   = useState(null)
  const [copied, setCopied]     = useState(false)
  const [errMsg, setErrMsg]     = useState('')
  const channelRef    = useRef(null)
  const hasRefreshed  = useRef(false)
  const countdown     = useExpiryCountdown(data?.pixExpiresAt)

  // ── Carrega dados do PIX via Edge Function ────────────────────────────────
  const loadSale = useCallback(async (isRefresh = false) => {
    if (isRefresh) setState('refreshing')

    try {
      const res = await fetch(
        `${FUNCTIONS_BASE_URL}/recover-pix?sale_id=${saleId}`,
        { headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' } }
      )
      const body = await res.json()

      if (!res.ok) {
        setErrMsg(body.error ?? 'Erro ao carregar o pedido.')
        setState('error')
        return
      }

      if (body.status === 'paid') {
        setState('paid')
        return
      }

      if (body.status === 'failed' || body.status === 'refunded') {
        setErrMsg('Este pedido foi cancelado ou expirou.')
        setState('error')
        return
      }

      setData(body)
      setState('ready')
    } catch {
      setErrMsg('Não foi possível conectar ao servidor.')
      setState('error')
    }
  }, [saleId])

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadSale()
  }, [loadSale])

  // ── Escuta confirmação de pagamento em tempo real (Supabase Realtime) ────
  useEffect(() => {
    if (!saleId) return

    channelRef.current = supabase
      .channel(`sale-recovery-${saleId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'sales',
        filter: `id=eq.${saleId}`,
      }, (payload) => {
        if (payload.new?.status === 'paid') {
          setState('paid')
        }
      })
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [saleId])

  // ── Quando o countdown chega a zero, recarrega para renovar o PIX ────────
  // Guard hasRefreshed evita loop infinito caso pixExpiresAt ainda esteja no passado
  useEffect(() => {
    if (countdown?.expired && state === 'ready' && !hasRefreshed.current) {
      hasRefreshed.current = true
      loadSale(true)
    }
  }, [countdown?.expired, state, loadSale])

  // ── Copia código PIX ──────────────────────────────────────────────────────
  const copyPix = async () => {
    if (!data?.qrCodeText) return
    await navigator.clipboard.writeText(data.qrCodeText)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER STATES
  // ────────────────────────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Carregando seu pedido...</p>
        </div>
      </div>
    )
  }

  if (state === 'paid') {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <PartyPopper className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Pagamento confirmado!</h1>
          <p className="text-zinc-500 text-sm leading-relaxed">
            Seu PIX foi processado com sucesso. Você receberá uma confirmação por e-mail em breve.
          </p>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 mb-2">Pedido não encontrado</h1>
          <p className="text-zinc-500 text-sm leading-relaxed">{errMsg}</p>
        </div>
      </div>
    )
  }

  // ── State: ready | refreshing ─────────────────────────────────────────────
  const isRefreshing = state === 'refreshing'
  const firstName    = data?.customerName?.split(' ')[0] ?? 'Cliente'
  const pixExpired   = countdown?.expired ?? false

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-start py-12 px-4">

      {/* Logo */}
      <img
        src="/bestfy-logo.svg"
        alt="Bestfy"
        className="h-9 w-auto mb-8 object-contain"
      />

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center">
          {/* Ícone PIX animado */}
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg width="40" height="40" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.09 18.88C18.4 18.88 18.7 18.75 18.92 18.52L21.28 16.13C21.37 16.04 21.49 15.99 21.62 15.99C21.75 15.99 21.87 16.04 21.96 16.13L24.33 18.52C24.55 18.75 24.85 18.88 25.16 18.88H25.65L22.98 21.59C22.76 21.81 22.46 21.93 22.14 21.93C21.82 21.93 21.52 21.81 21.3 21.59L18.61 18.88H18.09ZM25.16 25.12C24.85 25.12 24.55 24.99 24.33 24.76L21.96 22.37C21.87 22.28 21.75 22.23 21.62 22.23C21.49 22.23 21.37 22.28 21.28 22.37L18.92 24.76C18.7 24.99 18.4 25.12 18.09 25.12H17.59L20.27 27.84C20.73 28.3 21.36 28.56 22.02 28.56C22.68 28.56 23.31 28.3 23.77 27.84L26.44 25.12H25.16ZM15.33 20.65L16.97 19.01H18.09C18.52 19.01 18.93 19.18 19.23 19.49L21.3 21.59C21.41 21.7 21.54 21.79 21.68 21.84C21.82 21.9 21.97 21.93 22.12 21.93C22.27 21.93 22.42 21.9 22.56 21.84C22.7 21.79 22.83 21.7 22.94 21.59L25.01 19.49C25.31 19.18 25.72 19.01 26.15 19.01H27.27L28.91 20.65C29.37 21.11 29.63 21.74 29.63 22.4C29.63 23.06 29.37 23.69 28.91 24.15L27.27 25.79H26.15C25.72 25.79 25.31 25.62 25.01 25.31L22.94 23.21C22.72 22.99 22.42 22.87 22.12 22.87C21.82 22.87 21.52 22.99 21.3 23.21L19.23 25.31C18.93 25.62 18.52 25.79 18.09 25.79H16.97L15.33 24.15C14.87 23.69 14.61 23.06 14.61 22.4C14.61 21.74 14.87 21.11 15.33 20.65Z" fill="#1FAD7B"/>
            </svg>
          </div>

          <h1 className="text-xl font-bold text-zinc-900 mb-1">
            Quase lá! Seu pedido está reservado.
          </h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Olá <strong className="text-zinc-700">{firstName}</strong>, notamos que você não finalizou o pagamento.
            Para garantir sua reserva, disponibilizamos o acesso rápido ao seu código Pix abaixo.
          </p>
        </div>

        <div className="h-px bg-zinc-100 mx-6" />

        {/* Valor */}
        <div className="px-8 py-5 text-center">
          <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">Valor a pagar</p>
          <p className="text-4xl font-black text-zinc-900 tracking-tight">{brl(data?.amount)}</p>
        </div>

        {/* Countdown de urgência */}
        {countdown && !pixExpired && (
          <div className={`mx-6 mb-4 rounded-xl px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold
            ${countdown.secondsLeft < 5 * 60
              ? 'bg-red-50 text-red-700 border border-red-100'
              : 'bg-amber-50 text-amber-700 border border-amber-100'
            }`}>
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            PIX expira em <span className="font-mono font-black">{countdown.display}</span>
          </div>
        )}

        {/* PIX renovando */}
        {isRefreshing && (
          <div className="mx-6 mb-4 rounded-xl px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-100">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Gerando novo código PIX...
          </div>
        )}

        {/* QR Code */}
        <div className="flex flex-col items-center px-8 pb-6 gap-4">
          {isRefreshing ? (
            <div className="w-[200px] h-[200px] bg-zinc-100 rounded-xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
            </div>
          ) : (
            <QRCodeImage text={data?.qrCodeText} size={200} />
          )}

          {/* Copia e Cola */}
          <div className="w-full">
            <p className="text-xs text-zinc-400 text-center mb-2 font-medium">
              Ou copie o código abaixo (PIX Copia e Cola)
            </p>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex items-center gap-2">
              <p className="text-xs text-zinc-600 font-mono flex-1 break-all leading-relaxed line-clamp-2 select-all">
                {data?.qrCodeText ?? '—'}
              </p>
              <button
                onClick={copyPix}
                disabled={isRefreshing || !data?.qrCodeText}
                className="flex-shrink-0 w-9 h-9 rounded-lg bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 active:scale-95 transition-all disabled:opacity-40"
              >
                {copied
                  ? <CheckCheck className="w-4 h-4 text-green-500" />
                  : <Copy className="w-4 h-4 text-zinc-500" />
                }
              </button>
            </div>
            {copied && (
              <p className="text-xs text-green-600 text-center mt-1.5 font-medium">
                Código copiado!
              </p>
            )}
          </div>
        </div>

        {/* Divisor seção pedido */}
        <div className="h-2 bg-zinc-50 border-t border-b border-zinc-100" />

        {/* Resumo do pedido */}
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Seu pedido</p>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Qtde.</p>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {data?.productImage ? (
                <img
                  src={data.productImage}
                  alt={data.productName}
                  className="w-12 h-12 rounded-lg object-cover border border-zinc-100 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">📦</span>
                </div>
              )}
              <p className="text-sm font-semibold text-zinc-800">{data?.productName}</p>
            </div>
            <p className="text-sm font-semibold text-zinc-700 flex-shrink-0 ml-4">× 1</p>
          </div>

          <div className="h-px bg-zinc-100 mb-3" />
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-zinc-400">Subtotal</p>
            <p className="text-sm text-zinc-400">{brl(data?.amount)}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-zinc-900">Total</p>
            <p className="text-sm font-bold text-zinc-900">{brl(data?.amount)}</p>
          </div>
        </div>

        {/* Aviso */}
        <div className="px-8 pb-8">
          <p className="text-xs text-zinc-400 text-center leading-relaxed">
            O PIX pode demorar alguns minutos até ser processado após o pagamento.
            Caso você já tenha pago, desconsidere esta página.
          </p>
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-zinc-400 mt-6 text-center">
        Processado com segurança pela{' '}
        <a href="https://seguro.bestfybr.com.br" className="text-emerald-600 hover:underline">
          Bestfy
        </a>
      </p>
    </div>
  )
}
