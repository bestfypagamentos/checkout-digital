import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Loader2, ShieldCheck, Copy, CheckCheck,
  AlertCircle, PartyPopper, Lock, Minus, Plus, Clock, Tag,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// ── Máscaras ──────────────────────────────────────────────────────────────────
function maskCPF(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
function maskPhone(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

// ── Checkout settings defaults ────────────────────────────────────────────────
const CS_DEFAULTS = {
  logo_url:         '',
  logo_position:    'left',
  timer_seconds:    600,
  timer_bg_color:   '#EAB308',
  timer_text_color: '#713F12',
  button_color:     '#16A34A',
}

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(initial = 10 * 60) {
  const [left, setLeft] = useState(initial)
  useEffect(() => {
    if (left <= 0) return
    const t = setInterval(() => setLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [left])
  const m = String(Math.floor(left / 60)).padStart(2, '0')
  const s = String(left % 60).padStart(2, '0')
  return `${m}:${s}`
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CheckoutPage() {
  const { productId }                   = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cs, setCs]                     = useState(CS_DEFAULTS)
  const countdown                       = useCountdown(cs.timer_seconds)

  const [pageState, setPageState]         = useState('loading')
  const [product, setProduct]             = useState(null)
  const [sellerName, setSellerName]       = useState('')
  const [form, setForm]                   = useState({ name: '', email: '', cpf: '', phone: '' })
  const [errors, setErrors]               = useState({})
  const [quantity, setQuantity]           = useState(1)
  const [coupon, setCoupon]               = useState('')
  const [paymentResult, setPaymentResult] = useState(null)
  const [saleId, setSaleId]               = useState(null)
  const [confirmedName, setConfirmedName] = useState('')
  const [deliveryUrl, setDeliveryUrl]     = useState('')
  const [copied, setCopied]               = useState(false)
  const [errorMsg, setErrorMsg]           = useState('')
  const channelRef                        = useRef(null)

  // ── Init + Auto-restore ───────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: prod, error: prodErr } = await supabase
        .from('products')
        .select('id, name, description, price, delivery_url, user_id, allow_coupons, image_url, checkout_settings')
        .eq('id', productId)
        .single()

      if (prodErr || !prod) {
        setPageState('error')
        setErrorMsg('Produto não encontrado ou indisponível.')
        return
      }

      setProduct(prod)
      setDeliveryUrl(prod.delivery_url || '')
      if (prod.checkout_settings && Object.keys(prod.checkout_settings).length > 0) {
        setCs({ ...CS_DEFAULTS, ...prod.checkout_settings })
      }

      // Busca nome do vendedor
      const { data: profile } = await supabase
        .from('profiles')
        .select('bestfy_company_name')
        .eq('id', prod.user_id)
        .single()
      setSellerName(profile?.bestfy_company_name || '')

      // Auto-restore via ?sale=
      const urlSaleId = searchParams.get('sale')
      if (urlSaleId) {
        const { data: sale, error: saleErr } = await supabase
          .from('sales')
          .select('id, status, customer_name, customer_email, qr_code_url, qr_code_text')
          .eq('id', urlSaleId)
          .eq('product_id', productId)
          .single()

        if (!saleErr && sale) {
          setForm(f => ({ ...f, name: sale.customer_name || '', email: sale.customer_email || '' }))
          setConfirmedName(sale.customer_name || '')
          setSaleId(sale.id)
          if (sale.status === 'paid')    { setPageState('confirmed'); return }
          if (sale.status === 'pending') {
            setPaymentResult({ qrCode: sale.qr_code_url, qrCodeText: sale.qr_code_text })
            setPageState('pix'); return
          }
        }
        setSearchParams({}, { replace: true })
      }

      setPageState('ready')
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!saleId) return
    channelRef.current = supabase
      .channel(`sale-${saleId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sales', filter: `id=eq.${saleId}`,
      }, ({ new: row }) => { if (row.status === 'paid') setPageState('confirmed') })
      .subscribe()
    return () => { if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null } }
  }, [saleId])

  // ── Validação + Submit ────────────────────────────────────────────────────
  function validate() {
    const e = {}
    if (!form.name.trim())  e.name  = 'Nome obrigatório.'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'E-mail inválido.'
    if (form.cpf.replace(/\D/g, '').length !== 11)  e.cpf   = 'CPF inválido.'
    if (form.phone.replace(/\D/g, '').length !== 11) e.phone = 'Telefone inválido (DDD + 9 dígitos).'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setPageState('paying')
    setErrorMsg('')

    const { data, error } = await supabase.functions.invoke('create-transaction', {
      body: {
        productId,
        quantity,
        customerName:  form.name,
        customerEmail: form.email,
        customerCpf:   form.cpf,
        customerPhone: form.phone.replace(/\D/g, ''),
      },
    })

    if (error || data?.error || !data?.qrCodeText) {
      setPageState('ready')
      setErrorMsg(
        data?.error === 'Configuração de pagamento do vendedor não encontrada.'
          ? 'Este checkout ainda não está disponível para pagamentos.'
          : 'Não foi possível gerar o pagamento. Tente novamente.'
      )
      return
    }

    setSearchParams({ sale: data.saleId }, { replace: true })
    setPaymentResult(data)
    setSaleId(data.saleId)
    setConfirmedName(form.name)
    setPageState('pix')
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(paymentResult.qrCodeText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const total = product ? product.price * quantity : 0
  const fmt   = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // ── Loading ───────────────────────────────────────────────────────────────
  if (pageState === 'loading') return (
    <Shell>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-[#16A34A] animate-spin" />
      </div>
    </Shell>
  )

  if (pageState === 'error') return (
    <Shell>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-zinc-700 font-medium">{errorMsg}</p>
      </div>
    </Shell>
  )

  // ── PIX Gerado ────────────────────────────────────────────────────────────
  if (pageState === 'pix') return (
    <Shell sellerName={sellerName} cs={cs}>
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-4">
          <CheckCheck className="w-8 h-8 text-[#16A34A]" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-1">PIX gerado com sucesso!</h2>
        <p className="text-sm text-zinc-500 mb-6">Escaneie o QR Code ou copie o código abaixo.</p>

        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-6">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-semibold text-amber-700">Aguardando pagamento...</span>
        </div>

        {paymentResult?.qrCode && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 inline-flex mb-6 shadow-md">
            <img src={paymentResult.qrCode} alt="QR Code PIX" className="w-52 h-52"
              onError={e => { e.currentTarget.style.display = 'none' }} />
          </div>
        )}

        <Card className="mb-3 text-left">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">PIX Copia e Cola</p>
          <p className="text-xs text-zinc-600 font-mono break-all leading-relaxed select-all">{paymentResult?.qrCodeText}</p>
        </Card>

        <button onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 font-bold py-4 rounded-xl text-sm bg-[#16A34A] hover:bg-green-500 text-white mb-4 shadow-md shadow-green-200 transition-colors">
          {copied ? <><CheckCheck className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar código PIX</>}
        </button>

        <Card className="text-left space-y-3">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Como pagar</p>
          {['Abra o app do seu banco.', 'Escolha Pagar com Pix.', 'Aponte a câmera ou cole o código.', 'Confirme o pagamento.']
            .map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-green-100 text-[#16A34A] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-zinc-600">{s}</p>
              </div>
            ))}
        </Card>

        <Footer sellerName={sellerName} />
      </div>
    </Shell>
  )

  // ── Confirmado ────────────────────────────────────────────────────────────
  if (pageState === 'confirmed') return (
    <Shell sellerName={sellerName} cs={cs}>
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" />
          <div className="relative w-24 h-24 rounded-full bg-green-50 border-2 border-green-400 flex items-center justify-center shadow-lg shadow-green-100">
            <svg className="w-12 h-12 text-[#16A34A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <h2 className="text-3xl font-bold text-zinc-900">Pagamento Confirmado!</h2>
          <PartyPopper className="w-7 h-7 text-yellow-500" />
        </div>
        <p className="text-zinc-500 mb-8">
          Obrigado, <span className="text-zinc-800 font-semibold">{confirmedName?.split(' ')[0] || 'cliente'}</span>. Seu acesso foi liberado.
        </p>

        {deliveryUrl && (
          <a href={deliveryUrl} target="_blank" rel="noopener noreferrer"
            className="block w-full bg-[#16A34A] hover:bg-green-500 text-white font-bold py-4 rounded-xl transition-all text-base shadow-lg shadow-green-200 mb-4">
            Acessar meu Produto →
          </a>
        )}

        <Card>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Status</p>
          </div>
          <p className="text-sm text-[#16A34A] font-bold mt-1">Aprovado via PIX</p>
        </Card>

        <Footer sellerName={sellerName} />
      </div>
    </Shell>
  )

  // ── Formulário principal ──────────────────────────────────────────────────
  return (
    <Shell sellerName={sellerName} cs={cs}>
      <div className="max-w-lg mx-auto px-4 pb-10">

        {/* ── Banner Countdown ── */}
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-center gap-2 mb-5 shadow-sm"
          style={{ backgroundColor: cs.timer_bg_color }}
        >
          <Clock className="w-4 h-4 shrink-0" style={{ color: cs.timer_text_color }} />
          <p className="text-sm font-semibold" style={{ color: cs.timer_text_color }}>
            Essa oferta acabará em <span className="font-black">{countdown}</span>
          </p>
        </div>

        {/* ── Produto ── */}
        <Card className="mb-4">
          <div className="flex items-center gap-4">
            {/* Thumbnail */}
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-green-50 to-green-100 border border-green-100 flex items-center justify-center shrink-0 shadow-sm">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg className="w-9 h-9 text-[#16A34A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
            </div>

            {/* Info + Quantidade */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-zinc-900 text-base leading-tight">{product.name}</p>
              {product.description && (
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{product.description}</p>
              )}
              <p className="text-lg font-black mt-1" style={{ color: cs.button_color }}>{fmt(product.price)}</p>
            </div>

            {/* Qty */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-500 hover:border-[#16A34A] hover:text-[#16A34A] transition-colors">
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-7 text-center text-sm font-bold text-zinc-800">
                {String(quantity).padStart(2, '0')}
              </span>
              <button type="button" onClick={() => setQuantity(q => q + 1)}
                className="w-7 h-7 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-500 hover:border-[#16A34A] hover:text-[#16A34A] transition-colors">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </Card>

        {/* ── Cupom de desconto (apenas se habilitado no produto) ── */}
        {product.allow_coupons && (
          <Card className="mb-4">
            <p className="text-xs font-semibold text-zinc-500 mb-2">Cupom de desconto</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <input
                  type="text"
                  value={coupon}
                  onChange={e => setCoupon(e.target.value.toUpperCase())}
                  placeholder="Código do cupom"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm text-zinc-700 placeholder-zinc-300 focus:border-[#16A34A] focus:ring-2 focus:ring-green-500/10 outline-none transition"
                />
              </div>
              <button type="button"
                className="text-sm font-semibold text-[#16A34A] hover:text-green-700 px-3 transition-colors whitespace-nowrap">
                Adicionar
              </button>
            </div>
          </Card>
        )}

        {/* ── Totais ── */}
        <Card className="mb-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Subtotal</span>
              <span className="text-zinc-700 font-medium">{fmt(total)}</span>
            </div>
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3">
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-zinc-900 text-base">Total</span>
              <span className="text-2xl font-black" style={{ color: cs.button_color }}>{fmt(total)}</span>
            </div>
            <p className="text-xs text-zinc-400 text-right mt-0.5">Pagamento exclusivo via PIX</p>
          </div>
        </Card>

        {/* ── Formulário de contato ── */}
        <form onSubmit={handleSubmit}>
          <div className="mb-1">
            <h2 className="text-xl font-bold text-zinc-900 mb-4">Contato</h2>
            <div className="space-y-3">

              <Field error={errors.email}>
                <input type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Email"
                  className={input(errors.email)} />
              </Field>

              <Field error={errors.name}>
                <input type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nome completo"
                  className={input(errors.name)} />
              </Field>

              <Field error={errors.phone}>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                    <span className="text-base">🇧🇷</span>
                    <span className="text-zinc-300 text-sm">|</span>
                  </div>
                  <input type="text" inputMode="numeric" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))}
                    placeholder="Celular"
                    className={`${input(errors.phone)} pl-14`} />
                </div>
              </Field>

              <Field error={errors.cpf}>
                <input type="text" inputMode="numeric" value={form.cpf}
                  onChange={e => setForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))}
                  placeholder="CPF"
                  className={input(errors.cpf)} />
              </Field>

            </div>
          </div>

          {/* ── Pagamento ── */}
          <div className="mt-6 mb-4">
            <h2 className="text-xl font-bold text-zinc-900 mb-1">Pagamento</h2>
            <p className="text-xs text-zinc-400 mb-4">Todos os pagamentos são seguros e criptografados</p>

            {/* PIX — único método */}
            <div
              className="border-2 rounded-xl px-4 py-3.5 flex items-center gap-3"
              style={{ borderColor: cs.button_color, backgroundColor: `${cs.button_color}18` }}
            >
              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: cs.button_color }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cs.button_color }} />
              </div>
              <span className="font-semibold text-zinc-800 text-sm">PIX</span>
              <span
                className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ color: cs.button_color, backgroundColor: `${cs.button_color}28` }}
              >
                Aprovação imediata
              </span>
            </div>
          </div>

          {/* Erro global */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{errorMsg}</p>
            </div>
          )}

          {/* Botão */}
          <button type="submit" disabled={pageState === 'paying'}
            className="w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors text-base shadow-lg"
            style={{ backgroundColor: cs.button_color, boxShadow: `0 10px 20px -5px ${cs.button_color}50` }}>
            {pageState === 'paying'
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando PIX...</>
              : <><Lock className="w-4 h-4" /> Finalizar compra · {fmt(total)}</>
            }
          </button>

        </form>

        <Footer sellerName={sellerName} />
      </div>
    </Shell>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Shell({ children, sellerName, cs }) {
  const btn = cs?.button_color || '#16A34A'
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className={`max-w-lg mx-auto px-4 h-14 flex items-center ${cs?.logo_position === 'center' ? 'justify-center relative' : 'justify-between'}`}>
          <div className="flex items-center gap-2">
            {cs?.logo_url ? (
              <img
                src={cs.logo_url}
                alt={sellerName}
                className="h-8 max-w-[140px] object-contain"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: btn }}>
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                {sellerName && <span className="text-sm font-bold text-zinc-800">{sellerName}</span>}
              </>
            )}
          </div>
          {cs?.logo_position !== 'center' && (
            <div className="flex items-center gap-1.5 text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Ambiente seguro</span>
            </div>
          )}
        </div>
      </header>

      <div className="pt-5">{children}</div>
    </div>
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function Field({ children, error }) {
  return (
    <div>
      {children}
      {error && <p className="text-xs text-red-500 mt-1 pl-1">{error}</p>}
    </div>
  )
}

function input(hasError) {
  return `w-full bg-white border ${hasError ? 'border-red-300 focus:border-red-400 focus:ring-red-400/15' : 'border-gray-200 focus:border-[#16A34A] focus:ring-green-500/10'} rounded-xl px-4 py-3 text-sm text-zinc-800 placeholder-zinc-400 focus:ring-2 outline-none transition shadow-sm`
}

function Footer({ sellerName }) {
  return (
    <div className="mt-8 pb-8 text-center space-y-2">
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-sm font-black text-zinc-800 tracking-tight">b</span>
        <span className="text-sm font-bold text-zinc-700">Bestfy</span>
      </div>
      {sellerName && (
        <p className="text-xs text-zinc-400 leading-relaxed">
          A plataforma está processando este pagamento para o vendedor{' '}
          <span className="font-medium text-zinc-600">{sellerName}</span>
        </p>
      )}
      <div className="flex items-center justify-center gap-3 text-xs text-zinc-400">
        <a href="#" className="underline hover:text-zinc-600 transition-colors">Política de Privacidade</a>
        <span>·</span>
        <a href="#" className="underline hover:text-zinc-600 transition-colors">Termos de Serviço</a>
      </div>
      <p className="text-xs text-zinc-400">
        Ao continuar, você concorda com os{' '}
        <a href="#" className="underline hover:text-zinc-600 transition-colors">Termos de Compra</a>
      </p>
    </div>
  )
}
