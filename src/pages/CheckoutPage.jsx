import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Loader2, ShieldCheck, Copy, CheckCheck,
  AlertCircle, PartyPopper, Lock, Minus, Plus, Clock, Tag, X,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { SkeletonCheckoutProduct, SkeletonCheckoutTotals } from '../components/Skeleton'

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
  logo_url:          '',
  logo_position:     'left',
  header_bg_color:   '#FFFFFF',
  header_text_color: '#18181B',
  timer_seconds:     600,
  timer_bg_color:    '#EAB308',
  timer_text_color:  '#713F12',
  button_color:      '#16A34A',
  bump_color:        '#16A34A',
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
  // Chave de idempotência gerada uma vez por sessão de checkout.
  // Enviada via header X-Idempotency-Key para impedir cobranças duplicadas em cliques repetidos.
  const idempotencyKey = useRef(crypto.randomUUID())
  const [product, setProduct]             = useState(null)
  const [sellerName, setSellerName]       = useState('')
  const [form, setForm]                   = useState({ name: '', email: '', cpf: '', phone: '' })
  const [errors, setErrors]               = useState({})
  const [quantity, setQuantity]           = useState(1)
  const [coupon, setCoupon]               = useState('')
  const [couponApplied, setCouponApplied] = useState(null)
  const [couponError, setCouponError]     = useState('')
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  const [paymentResult, setPaymentResult] = useState(null)
  const [saleId, setSaleId]               = useState(null)
  const [confirmedName, setConfirmedName] = useState('')
  const [deliveryUrl, setDeliveryUrl]     = useState('')
  const [copied, setCopied]               = useState(false)
  const [errorMsg, setErrorMsg]           = useState('')
  const channelRef                        = useRef(null)
  const [productOffers, setProductOffers] = useState([])
  const [selectedOffer, setSelectedOffer] = useState(null)
  const [bumps, setBumps] = useState([])
  const [selectedBumpIds, setSelectedBumpIds] = useState(new Set())

  // ── Init + Auto-restore ───────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: prod, error: prodErr } = await supabase
        .from('products')
        .select('id, name, description, price, user_id, allow_coupons, image_url')
        .eq('id', productId)
        .single()

      if (prodErr || !prod) {
        setPageState('error')
        setErrorMsg('Produto não encontrado ou indisponível.')
        return
      }

      setProduct(prod)

      // Carrega oferta(s): se ?off= estiver na URL, busca apenas aquela
      const offerId = searchParams.get('off')
      let offersData
      if (offerId) {
        const { data } = await supabase
          .from('product_offers')
          .select('*')
          .eq('id', offerId)
          .eq('product_id', productId)
          .single()
        offersData = data ? [data] : []
      } else {
        const { data } = await supabase
          .from('product_offers')
          .select('*')
          .eq('product_id', productId)
          .order('is_main', { ascending: false })
          .order('created_at', { ascending: true })
        offersData = data || []
      }

      if (offersData.length > 0) {
        setProductOffers(offersData)
        setSelectedOffer(offersData[0])
      }

      // Carrega settings do checkout específico (via ?chk=) ou fallback para o padrão
      const checkoutId = searchParams.get('chk')
      if (checkoutId) {
        const { data: checkout } = await supabase
          .from('product_checkouts')
          .select('settings')
          .eq('id', checkoutId)
          .single()
        if (checkout?.settings && Object.keys(checkout.settings).length > 0) {
          setCs({ ...CS_DEFAULTS, ...checkout.settings })
        }
      } else {
        // Fallback: checkout padrão do produto
        const { data: defaultCheckout } = await supabase
          .from('product_checkouts')
          .select('settings')
          .eq('product_id', productId)
          .eq('is_default', true)
          .single()
        if (defaultCheckout?.settings && Object.keys(defaultCheckout.settings).length > 0) {
          setCs({ ...CS_DEFAULTS, ...defaultCheckout.settings })
        }
      }

      // Busca Order Bumps ativos
      const { data: bumpsData } = await supabase
        .from('product_order_bumps')
        .select(`
          id, cta, title, description, apply_discount, original_price, position,
          bump_product:products!bump_product_id(id, name, price, image_url),
          bump_offer:product_offers!bump_offer_id(id, name, price)
        `)
        .eq('product_id', productId)
        .order('position', { ascending: true })
      setBumps(bumpsData || [])

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

  // ── Busca URL de entrega apenas após pagamento confirmado (C-02 + C-03) ───
  // A delivery_url nunca é carregada no init — só é liberada via Edge Function
  // após verificar que sale.status === 'paid' no servidor.
  // A sessão anônima criada em handleSubmit garante o JWT para autenticação.
  useEffect(() => {
    if (pageState !== 'confirmed' || !saleId) return
    supabase.functions.invoke('get-delivery-url', { body: { saleId } })
      .then(({ data }) => { if (data?.deliveryUrl) setDeliveryUrl(data.deliveryUrl) })
      .catch(() => {/* URL de entrega não crítica — silencioso */})
  }, [pageState, saleId])

  // ── Aplicar cupom ─────────────────────────────────────────────────────────
  async function handleApplyCoupon() {
    if (!coupon.trim()) return
    setValidatingCoupon(true)
    setCouponError('')
    setCouponApplied(null)

    const { data, error } = await supabase
      .from('coupons')
      .select('id, code, discount_percent, starts_at, expires_at')
      .eq('product_id', productId)
      .eq('code', coupon.trim().toUpperCase())
      .single()

    if (error || !data) {
      setCouponError('Cupom inválido ou não encontrado.')
      setValidatingCoupon(false)
      return
    }

    const now = new Date()
    if (data.starts_at && new Date(data.starts_at) > now) {
      setCouponError('Este cupom ainda não está ativo.')
      setValidatingCoupon(false)
      return
    }
    if (data.expires_at && new Date(data.expires_at) < now) {
      setCouponError('Este cupom expirou.')
      setValidatingCoupon(false)
      return
    }

    setCouponApplied(data)
    setValidatingCoupon(false)
  }

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

    // C-03: Garante sessão anônima — o JWT resultante autentica a Edge Function.
    // Requer "Anonymous sign-ins" habilitado em Auth → Settings no Supabase Dashboard.
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) {
      const { error: anonError } = await supabase.auth.signInAnonymously()
      if (anonError) {
        console.error('[auth] signInAnonymously falhou:', anonError.message)
        setPageState('ready')
        setErrorMsg('Não foi possível iniciar a sessão. Verifique sua conexão e tente novamente.')
        return
      }
    }

    const { data, error: fnError } = await supabase.functions.invoke('create-transaction', {
      body: {
        productId,
        customerName:   form.name,
        customerEmail:  form.email,
        customerCpf:    form.cpf,
        customerPhone:  form.phone.replace(/\D/g, ''),
        couponCode:     couponApplied?.code || null,
        offerId:        selectedOffer?.id   || null,
        idempotencyKey: idempotencyKey.current,
      },
    })

    if (fnError || data?.error || !data?.qrCodeText) {
      setPageState('ready')
      setErrorMsg(
        data?.error === 'Gateway de pagamento não configurado.'
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

  function toggleBump(id) {
    setSelectedBumpIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(paymentResult.qrCodeText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const activePrice  = selectedOffer?.price ?? product?.price ?? 0
  const discount     = couponApplied && product ? activePrice * quantity * (couponApplied.discount_percent / 100) : 0
  const bumpsTotal   = bumps.filter(b => selectedBumpIds.has(b.id)).reduce((sum, b) => sum + getBumpPrice(b), 0)
  const total        = activePrice * quantity - discount + bumpsTotal
  const fmt          = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // ── Loading ───────────────────────────────────────────────────────────────
  if (pageState === 'loading') return (
    <Shell>
      <div className="max-w-lg mx-auto px-4 pb-10">
        {/* Timer skeleton */}
        <div className="h-11 rounded-xl bg-gray-200 animate-pulse mb-5" />
        {/* Card do produto skeleton */}
        <SkeletonCheckoutProduct />
        {/* Totais skeleton */}
        <SkeletonCheckoutTotals />
        {/* Título "Contato" skeleton */}
        <div className="h-7 w-24 rounded-lg bg-gray-200 animate-pulse mb-4 mt-2" />
        {/* Campos do formulário skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
        {/* Título "Pagamento" skeleton */}
        <div className="h-7 w-28 rounded-lg bg-gray-200 animate-pulse mt-6 mb-4" />
        {/* Opção PIX skeleton */}
        <div className="h-14 rounded-xl bg-gray-200 animate-pulse mb-4" />
        {/* Botão skeleton */}
        <div className="h-14 rounded-xl bg-gray-200 animate-pulse" />
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
      <div className="max-w-[600px] mx-auto px-4 py-8">
        {/* Card central */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm px-6 py-8 flex flex-col items-center text-center">

          {/* Ícone */}
          <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-4">
            <CheckCheck className="w-8 h-8 text-[#16A34A]" />
          </div>

          {/* Título */}
          <h2 className="text-2xl font-bold text-zinc-900 mb-1">PIX gerado com sucesso!</h2>
          <p className="text-sm text-zinc-500 mb-5">Escaneie o QR Code ou copie o código abaixo.</p>

          {/* Badge aguardando */}
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-semibold text-amber-700">Aguardando pagamento...</span>
          </div>

          {/* QR Code */}
          {paymentResult?.qrCode && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 inline-flex mb-6 shadow-md">
              <img src={paymentResult.qrCode} alt="QR Code PIX" className="w-52 h-52"
                onError={e => { e.currentTarget.style.display = 'none' }} />
            </div>
          )}

          {/* PIX Copia e Cola */}
          <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 text-left">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">PIX Copia e Cola</p>
            <p className="text-xs text-zinc-600 font-mono break-all leading-relaxed select-all">{paymentResult?.qrCodeText}</p>
          </div>

          {/* Botão copiar */}
          <button onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 font-bold py-4 rounded-xl text-sm bg-[#16A34A] hover:bg-green-500 text-white shadow-md shadow-green-200 transition-colors mb-6">
            {copied ? <><CheckCheck className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar código PIX</>}
          </button>

          {/* Como pagar */}
          <div className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-left space-y-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Como pagar</p>
            {['Abra o app do seu banco.', 'Escolha Pagar com Pix.', 'Aponte a câmera ou cole o código.', 'Confirme o pagamento.']
              .map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-[#16A34A] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-sm text-zinc-600">{s}</p>
                </div>
              ))}
          </div>

        </div>

        <Footer sellerName={sellerName} cs={cs} />
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

        <Footer sellerName={sellerName} cs={cs} />
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

        {/* ── Seletor de Oferta (apenas quando não há ?off= na URL e há múltiplas) ── */}
        {!searchParams.get('off') && productOffers.length > 1 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Escolha sua oferta</p>
            <div className="space-y-2">
              {productOffers.map(offer => {
                const isSelected = selectedOffer?.id === offer.id
                return (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => setSelectedOffer(offer)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-[var(--btn)] bg-white shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    style={isSelected ? { borderColor: cs.button_color } : {}}
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-800">{offer.name}</p>
                      {offer.type === 'recurring' && offer.interval_type && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          A cada {offer.interval_count}{' '}
                          {{ day: 'dia', week: 'semana', month: 'mês', year: 'ano' }[offer.interval_type]}
                          {offer.interval_count > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-base font-black" style={{ color: cs.button_color }}>
                        {Number(offer.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: cs.button_color }}>
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

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
              <p className="text-lg font-black mt-1" style={{ color: cs.button_color }}>{fmt(activePrice)}</p>
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
            {couponApplied ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                    <CheckCheck className="w-3.5 h-3.5" />
                    -{couponApplied.discount_percent}% aplicado
                  </span>
                  <span className="text-sm font-mono font-bold text-zinc-700">{couponApplied.code}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setCouponApplied(null); setCouponError('') }}
                  className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
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
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={validatingCoupon}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#16A34A] hover:text-green-700 disabled:opacity-50 px-3 transition-colors whitespace-nowrap"
                  >
                    {validatingCoupon
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : 'Adicionar'
                    }
                  </button>
                </div>
                {couponError && (
                  <p className="text-xs text-red-500 mt-1.5">{couponError}</p>
                )}
              </>
            )}
          </Card>
        )}

        {/* ── Totais ── */}
        <Card className="mb-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Subtotal</span>
              <span className="text-zinc-700 font-medium">{fmt(activePrice * quantity)}</span>
            </div>
            {couponApplied && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-600">Desconto ({couponApplied.discount_percent}%)</span>
                <span className="text-emerald-600 font-medium">-{fmt(discount)}</span>
              </div>
            )}
            {/* Bump line items — animados */}
            {bumps.map(b => (
              <div
                key={b.id}
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                  maxHeight: selectedBumpIds.has(b.id) ? '36px' : '0px',
                  opacity:   selectedBumpIds.has(b.id) ? 1 : 0,
                }}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500 truncate pr-2">{b.title}</span>
                  <span className="text-zinc-700 font-medium shrink-0">+{fmt(getBumpPrice(b))}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3">
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-zinc-900 text-base">Total</span>
              <span className="text-2xl font-black transition-all duration-300" style={{ color: cs.button_color }}>{fmt(total)}</span>
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

          {/* ── Order Bumps ── */}
          {bumps.length > 0 && (
            <div className="mt-5 mb-5 space-y-3">
              {bumps.map(bump => (
                <BumpCard
                  key={bump.id}
                  bump={bump}
                  selected={selectedBumpIds.has(bump.id)}
                  onToggle={() => toggleBump(bump.id)}
                  accentColor={cs.bump_color || cs.button_color}
                />
              ))}
            </div>
          )}

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

        <Footer sellerName={sellerName} cs={cs} />
      </div>
    </Shell>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getBumpPrice(bump) {
  return Number(bump.bump_offer?.price ?? bump.bump_product?.price ?? 0)
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Shell({ children, sellerName, cs }) {
  const btn = cs?.button_color || '#16A34A'
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header
        className="border-b border-gray-100 shadow-sm sticky top-0 z-10"
        style={{ backgroundColor: cs?.header_bg_color || '#FFFFFF' }}
      >
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
                {sellerName && (
                  <span className="text-sm font-bold" style={{ color: cs?.header_text_color || '#18181B' }}>
                    {sellerName}
                  </span>
                )}
              </>
            )}
          </div>
          {cs?.logo_position !== 'center' && (
            <div className="flex items-center gap-1.5" style={{ color: cs?.header_text_color || '#71717A', opacity: 0.65 }}>
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

function BumpCard({ bump, selected, onToggle, accentColor }) {
  const price = getBumpPrice(bump)
  const fmt   = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div
      onClick={onToggle}
      className="rounded-2xl overflow-hidden cursor-pointer select-none border-2 border-dashed transition-all duration-200"
      style={{ borderColor: accentColor }}
    >
      {/* ── Cabeçalho verde ── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: accentColor }}
      >
        <p className="text-sm font-bold text-white uppercase tracking-wide leading-tight">
          {bump.cta || 'Adicione também:'}
        </p>
        {/* Ícone de check no header */}
        <div className={`w-6 h-6 rounded-full border-2 border-white/60 flex items-center justify-center shrink-0 transition-all duration-200 ${selected ? 'bg-white/30' : 'bg-white/10'}`}>
          {selected && (
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      {/* ── Corpo cinza claro ── */}
      <div className="bg-gray-100 px-4 py-3 flex items-center gap-3">
        {/* Imagem */}
        {bump.bump_product?.image_url && (
          <img
            src={bump.bump_product.image_url}
            alt={bump.title}
            className="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0"
          />
        )}

        {/* Texto */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-zinc-900 text-sm leading-snug">{bump.title}</p>
          {bump.description && (
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{bump.description}</p>
          )}
        </div>

        {/* Preço */}
        <div className="shrink-0 text-right">
          <p className="text-base font-black" style={{ color: accentColor }}>{fmt(price)}</p>
          {bump.apply_discount && bump.original_price && (
            <p className="text-xs text-zinc-400 line-through">{fmt(bump.original_price)}</p>
          )}
        </div>
      </div>

      {/* ── Rodapé verde com checkbox ── */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: accentColor }}
      >
        {/* Checkbox nativo estilizado */}
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${selected ? 'bg-white border-white' : 'bg-transparent border-white/70'}`}>
          {selected && (
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth={3.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <p className="text-sm font-bold text-white">Adicionar Produto</p>
      </div>
    </div>
  )
}

const PAYMENT_ICONS = [
  { src: '/icons/card-visa.svg',       alt: 'Visa' },
  { src: '/icons/card-mastercard.svg', alt: 'Mastercard' },
  { src: '/icons/card-amex.svg',       alt: 'American Express' },
  { src: '/icons/card-elo.svg',        alt: 'Elo' },
  { src: '/icons/card-hiper.svg',      alt: 'Hipercard' },
  { src: '/icons/card-aura.svg',       alt: 'Aura' },
  { src: '/icons/card-diners.svg',     alt: 'Diners Club' },
  { src: '/icons/card-pix.svg',        alt: 'PIX' },
  { src: '/icons/card-billet.svg',     alt: 'Boleto' },
]

function PaymentIcons() {
  return (
    <div className="flex items-center justify-center flex-wrap gap-1.5 mt-3">
      {PAYMENT_ICONS.map(({ src, alt }) => (
        <img key={alt} src={src} alt={alt} className="h-[26px] w-auto" />
      ))}
    </div>
  )
}

function Footer({ sellerName, cs }) {
  const logoUrl = cs?.logo_url
  return (
    <div className="mt-8 pb-8 text-center space-y-2">
      {/* Logo do vendedor ou fallback Bestfy */}
      <div className="flex items-center justify-center gap-1.5">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={sellerName || 'Logo'}
            className="h-8 max-w-[140px] object-contain"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <>
            <span className="text-sm font-black text-zinc-800 tracking-tight">b</span>
            <span className="text-sm font-bold text-zinc-700">Bestfy</span>
          </>
        )}
      </div>
      {sellerName && (
        <p className="text-xs text-zinc-400 leading-relaxed">
          A plataforma está processando este pagamento para o vendedor{' '}
          <span className="font-medium text-zinc-600">{sellerName}</span>
        </p>
      )}
      {/* Ícones de meios de pagamento */}
      <PaymentIcons />
      <div className="flex items-center justify-center gap-3 text-xs text-zinc-400 mt-2">
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
