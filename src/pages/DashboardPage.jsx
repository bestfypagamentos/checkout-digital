import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, ShoppingBag, Users, Percent,
  Plus, X, Loader2, AlertCircle, CheckCircle2,
  ExternalLink, Copy, Check, Package,
} from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import OnboardingGrid from '../components/OnboardingGrid'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

function formatBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function maskCurrencyInput(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (!digits) return ''
  const cents = parseInt(digits, 10)
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Stats
  const [stats, setStats]               = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Produtos recentes
  const [products, setProducts]         = useState([])
  const [copiedId, setCopiedId]         = useState(null)

  // Onboarding
  const [hasApiKey, setHasApiKey]       = useState(false)

  // Modal Bestfy
  const [showBestfy, setShowBestfy]     = useState(false)
  const [apiKeyInput, setApiKeyInput]   = useState('')
  const [bestfyState, setBestfyState]   = useState('idle') // idle|validating|valid|invalid|saving
  const [bestfyCompany, setBestfyCompany] = useState('')

  // Modal Add Product
  const [showProduct, setShowProduct]   = useState(false)
  const [productForm, setProductForm]   = useState({ name: '', price: '', delivery_url: '', allow_coupons: false })
  const [productErrors, setProductErrors] = useState({})
  const [savingProduct, setSavingProduct] = useState(false)

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    || user?.email?.split('@')[0]
    || 'usuário'

  // ── Fetch inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      fetchStats()
      fetchProducts()
      checkBestfyKey()
    }
  }, [user])

  async function fetchStats() {
    setStatsLoading(true)
    const { start, end } = todayRange()

    const [
      { data: paidToday },
      { count: ordersToday },
      { data: allCustomers },
      { count: totalSales },
      { count: paidTotal },
    ] = await Promise.all([
      // Receita hoje
      supabase.from('sales').select('amount')
        .eq('seller_id', user.id).eq('status', 'paid')
        .gte('created_at', start).lte('created_at', end),

      // Pedidos hoje
      supabase.from('sales').select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id)
        .gte('created_at', start).lte('created_at', end),

      // Clientes únicos (paid)
      supabase.from('sales').select('customer_email')
        .eq('seller_id', user.id).eq('status', 'paid'),

      // Total de vendas geradas
      supabase.from('sales').select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id),

      // Total pago (para conversão)
      supabase.from('sales').select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id).eq('status', 'paid'),
    ])

    const revenueToday = (paidToday || []).reduce((s, r) => s + Number(r.amount), 0)
    const uniqueCustomers = new Set((allCustomers || []).map(r => r.customer_email)).size
    const conversion = totalSales > 0 ? ((paidTotal / totalSales) * 100).toFixed(1) : '0.0'

    setStats({
      revenue:    revenueToday,
      orders:     ordersToday || 0,
      customers:  uniqueCustomers,
      conversion: conversion,
    })
    setStatsLoading(false)
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, price, delivery_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6)
    setProducts(data || [])
  }

  async function checkBestfyKey() {
    const { data } = await supabase
      .from('profiles')
      .select('bestfy_api_key, bestfy_company_name')
      .eq('id', user.id)
      .single()

    if (!data?.bestfy_api_key) {
      setShowBestfy(true)
    } else {
      setHasApiKey(true)
    }
    if (data?.bestfy_company_name) {
      setBestfyCompany(data.bestfy_company_name)
    }
  }

  // ── Bestfy: validar e salvar ─────────────────────────────────────────────
  async function handleValidateBestfy() {
    if (!apiKeyInput.trim()) return
    setBestfyState('validating')

    const { data, error } = await supabase.functions.invoke('validate-bestfy', {
      body: { apiKey: apiKeyInput.trim() },
    })

    if (error || !data?.valid) {
      setBestfyState('invalid')
      return
    }

    const company = data.company?.fantasyName || data.company?.name || ''
    setBestfyCompany(company)
    setBestfyState('valid')
  }

  async function handleSaveBestfy() {
    if (bestfyState !== 'valid') return
    setBestfyState('saving')

    const { error } = await supabase
      .from('profiles')
      .update({
        bestfy_api_key:      apiKeyInput.trim(),
        bestfy_company_name: bestfyCompany,
      })
      .eq('id', user.id)

    if (error) { setBestfyState('valid'); return }
    setHasApiKey(true)
    setShowBestfy(false)
    setBestfyState('idle')
  }

  // ── Produto: salvar ──────────────────────────────────────────────────────
  function validateProduct() {
    const e = {}
    if (!productForm.name.trim()) e.name = 'Nome obrigatório.'
    if (!productForm.price)       e.price = 'Preço obrigatório.'
    return e
  }

  async function handleSaveProduct(ev) {
    ev.preventDefault()
    const errs = validateProduct()
    if (Object.keys(errs).length) { setProductErrors(errs); return }
    setProductErrors({})
    setSavingProduct(true)

    // Converte "1.250,00" → 1250.00
    const rawDigits = productForm.price.replace(/\D/g, '')
    const priceDecimal = rawDigits ? parseInt(rawDigits, 10) / 100 : 0

    const { error } = await supabase.from('products').insert({
      user_id:       user.id,
      name:          productForm.name.trim(),
      price:         priceDecimal,
      delivery_url:  productForm.delivery_url.trim() || null,
      allow_coupons: productForm.allow_coupons,
    })

    setSavingProduct(false)
    if (!error) {
      setShowProduct(false)
      setProductForm({ name: '', price: '', delivery_url: '', allow_coupons: false })
      fetchProducts()
      fetchStats()
    }
  }

  // ── Copiar link do produto ───────────────────────────────────────────────
  function copyLink(productId) {
    const url = `${window.location.origin}/checkout/${productId}`
    navigator.clipboard.writeText(url)
    setCopiedId(productId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Stat cards config ────────────────────────────────────────────────────
  const statCards = [
    {
      label: 'Vendas hoje',
      value: statsLoading ? '—' : formatBRL(stats?.revenue),
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Pedidos',
      value: statsLoading ? '—' : String(stats?.orders),
      icon: ShoppingBag,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
    },
    {
      label: 'Clientes',
      value: statsLoading ? '—' : String(stats?.customers),
      icon: Users,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Conversão',
      value: statsLoading ? '—' : `${stats?.conversion}%`,
      icon: Percent,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
  ]

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>

      {/* ── Header ── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
            Olá, {firstName}
          </h1>
          <p className="text-zinc-500 mt-0.5 text-sm">
            Resumo do seu negócio hoje — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={() => setShowProduct(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo produto
        </button>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-200"
          >
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-4`}>
              <Icon className={`w-5 h-5 ${color}`} strokeWidth={1.75} />
            </div>
            <p className="text-2xl font-bold text-zinc-100 tracking-tight leading-none mb-1.5">
              {value}
            </p>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Onboarding Grid ── */}
      <div className="mb-8">
        <OnboardingGrid
          hasApiKey={hasApiKey}
          hasProducts={products.length > 0}
          firstProductId={products[0]?.id ?? null}
          onConnectBestfy={() => setShowBestfy(true)}
          onAddProduct={() => setShowProduct(true)}
        />
      </div>

      {/* ── Produtos recentes (só quando existem) ── */}
      {products.length > 0 && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
              Produtos Recentes
            </h2>
            <button
              onClick={() => navigate('/products')}
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              Ver todos <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-zinc-800">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-800/40 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{p.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{formatBRL(p.price)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => copyLink(p.id)}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    {copiedId === p.id
                      ? <><Check className="w-3 h-3 text-emerald-400" /> Copiado</>
                      : <><Copy className="w-3 h-3" /> Link</>
                    }
                  </button>
                  <button
                    onClick={() => navigate(`/checkout/${p.id}`)}
                    className="text-xs text-zinc-500 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            <div className="px-5 py-3">
              <button
                onClick={() => setShowProduct(true)}
                className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar produto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          Modal: Integração Bestfy
      ════════════════════════════════════════════════ */}
      {showBestfy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/60 rounded-2xl w-full max-w-md shadow-2xl shadow-black/40">

            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-zinc-800/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-emerald-900/40">
                  B
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">Conectar Bestfy</p>
                  <p className="text-xs text-zinc-500">Gateway de pagamentos PIX</p>
                </div>
              </div>
              <button
                onClick={() => setShowBestfy(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-7 py-6">
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                Para começar a receber pagamentos, insira sua chave de API da Bestfy.
                Você a encontra em{' '}
                <span className="text-zinc-200 font-medium">Configurações → API</span>{' '}
                no painel Bestfy.
              </p>

              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Chave de API (X-API-KEY)
              </label>
              <input
                type="text"
                value={apiKeyInput}
                onChange={e => { setApiKeyInput(e.target.value); setBestfyState('idle') }}
                placeholder="bfy_live_..."
                className="w-full bg-zinc-950/80 border border-zinc-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition mb-4 font-mono"
              />

              {bestfyState === 'invalid' && (
                <div className="flex items-center gap-2.5 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Chave inválida. Verifique se copiou corretamente.
                </div>
              )}
              {bestfyState === 'valid' && (
                <div className="flex items-center gap-2.5 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Conexão estabelecida{bestfyCompany ? ` · ${bestfyCompany}` : ''}
                </div>
              )}

              {bestfyState !== 'valid' ? (
                <button
                  onClick={handleValidateBestfy}
                  disabled={!apiKeyInput.trim() || bestfyState === 'validating'}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  {bestfyState === 'validating'
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Validando...</>
                    : 'Validar Chave'
                  }
                </button>
              ) : (
                <button
                  onClick={handleSaveBestfy}
                  disabled={bestfyState === 'saving'}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  {bestfyState === 'saving'
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                    : <><CheckCircle2 className="w-4 h-4" /> Salvar e Ativar</>
                  }
                </button>
              )}

              <button
                onClick={() => setShowBestfy(false)}
                className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400 mt-4 py-1 transition-colors"
              >
                Fazer isso depois
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          Modal: Adicionar Produto
      ════════════════════════════════════════════════ */}
      {showProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/60 rounded-2xl w-full max-w-md shadow-2xl shadow-black/40">

            <div className="flex items-center justify-between px-7 py-5 border-b border-zinc-800/60">
              <p className="text-sm font-semibold text-zinc-100">Novo Produto</p>
              <button
                onClick={() => { setShowProduct(false); setProductErrors({}) }}
                className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="px-7 py-6 space-y-5">

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Nome do produto
                </label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Curso de Tráfego Pago"
                  className={`w-full bg-zinc-950/80 border ${productErrors.name ? 'border-red-500' : 'border-zinc-700'} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition`}
                />
                {productErrors.name && <p className="text-xs text-red-400 mt-1.5">{productErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Preço (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={productForm.price}
                    onChange={e => setProductForm(f => ({ ...f, price: maskCurrencyInput(e.target.value) }))}
                    placeholder="0,00"
                    className={`w-full bg-zinc-950/80 border ${productErrors.price ? 'border-red-500' : 'border-zinc-700'} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition`}
                  />
                </div>
                {productErrors.price && <p className="text-xs text-red-400 mt-1.5">{productErrors.price}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  URL de entrega <span className="text-zinc-600 normal-case font-normal">(opcional)</span>
                </label>
                <input
                  type="url"
                  value={productForm.delivery_url}
                  onChange={e => setProductForm(f => ({ ...f, delivery_url: e.target.value }))}
                  placeholder="https://membros.seusite.com/area"
                  className="w-full bg-zinc-950/80 border border-zinc-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition"
                />
                <p className="text-xs text-zinc-600 mt-1.5">Enviado ao cliente após o pagamento ser confirmado.</p>
              </div>

              {/* Toggle: cupom de desconto */}
              <div className="flex items-center justify-between bg-zinc-950/40 border border-zinc-800 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-200">Habilitar cupom de desconto</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Exibe campo de cupom no checkout deste produto.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProductForm(f => ({ ...f, allow_coupons: !f.allow_coupons }))}
                  className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ml-4 ${
                    productForm.allow_coupons ? 'bg-emerald-600' : 'bg-zinc-700'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    productForm.allow_coupons ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="pt-1 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowProduct(false); setProductErrors({}) }}
                  className="flex-1 text-sm font-semibold text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 py-3 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
                >
                  {savingProduct
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                    : 'Criar produto'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </DashboardLayout>
  )
}
