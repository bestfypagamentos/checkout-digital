import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2, Plus, X, Package, ExternalLink, Loader2, Link2, CheckCheck, Search } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import Pagination from '../components/Pagination'
import { SkeletonProductRow } from '../components/Skeleton'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { cacheGet, cacheSet, cacheDel } from '../lib/cache'

const PAGE_SIZE  = 15
const EMPTY_FORM = { name: '', description: '', price: '', delivery_url: '', allow_coupons: false }

// Formata número para BRL enquanto digita: 1000 → "10,00"
function formatCurrency(raw) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const number = parseInt(digits, 10) / 100
  return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Converte "1.250,99" → 1250.99 para salvar no banco
function parseCurrency(formatted) {
  return parseFloat(formatted.replace(/\./g, '').replace(',', '.')) || 0
}

export default function ProductsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const CACHE_KEY = `products:${user.id}`

  // fetchProducts: por padrão aplica SWR (cache hit → sem skeleton)
  // silent=true é usado pelo re-fetch em background e pelo realtime
  const fetchProducts = useCallback(async ({ silent = false } = {}) => {
    const cached = cacheGet(CACHE_KEY)

    if (cached && !silent) {
      // Cache hit: exibe dados imediatamente sem skeleton
      setProducts(cached)
      setLoadingList(false)
      // Re-fetch silencioso em background para manter lista atualizada
      fetchProducts({ silent: true })
      return
    }

    // Cache miss ou chamada silenciosa: busca no Supabase
    if (!silent) setLoadingList(true)

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error) {
      cacheSet(CACHE_KEY, data)
      setProducts(data)
      if (!silent) setPage(1)
    }
    if (!silent) setLoadingList(false)
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchProducts()

    // Realtime: atualiza silenciosamente sem mostrar skeleton nem afetar paginação
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `user_id=eq.${user.id}` },
        () => {
          cacheDel(CACHE_KEY)
          fetchProducts({ silent: true })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchProducts, user.id])

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handlePriceInput = (e) => {
    const formatted = formatCurrency(e.target.value)
    setForm(f => ({ ...f, price: formatted }))
  }

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setError(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setForm(EMPTY_FORM)
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) return setError('Nome é obrigatório.')
    if (!form.price) return setError('Preço é obrigatório.')

    const price = parseCurrency(form.price)
    if (price <= 0) return setError('Preço deve ser maior que zero.')

    setLoadingSubmit(true)

    const payload = {
      name:          form.name.trim(),
      description:   form.description.trim(),
      price,
      delivery_url:  form.delivery_url.trim(),
      allow_coupons: form.allow_coupons,
      user_id:       user.id,
    }

    const { error: dbError } = await supabase.from('products').insert(payload)

    if (dbError) {
      setError(dbError.message)
    } else {
      closeForm()
    }

    setLoadingSubmit(false)
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    await supabase.from('products').delete().eq('id', id)
    setDeletingId(null)
  }

  const handleCopyLink = async (id) => {
    const url = `${window.location.origin}/checkout/${id}`
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-th-text">Produtos</h1>
          <p className="text-zinc-500 text-sm mt-1">Gerencie seus produtos digitais.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Novo produto
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Buscar produto pelo nome..."
          className="w-full max-w-sm bg-th-surface border border-th-line text-th-text placeholder-zinc-400 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 transition-all"
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setPage(1) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-th-text-4 hover:text-th-text-3 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Modal / Form ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-th-surface border border-th-line rounded-2xl shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-th-line">
              <h2 className="font-semibold text-th-text">Novo produto</h2>
              <button onClick={closeForm} className="text-zinc-500 hover:text-th-text-2 transition-colors p-1 rounded-lg hover:bg-th-raised">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="label">Nome do produto</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Curso de React do Zero"
                  className="input-field"
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Descrição <span className="text-th-text-4">(opcional)</span></label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descreva brevemente o que está incluso..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>

              <div>
                <label className="label">Preço (R$)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-medium">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.price}
                    onChange={handlePriceInput}
                    placeholder="0,00"
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="label">Link de entrega <span className="text-th-text-4">(opcional)</span></label>
                <input
                  type="url"
                  value={form.delivery_url}
                  onChange={e => setForm(f => ({ ...f, delivery_url: e.target.value }))}
                  placeholder="https://drive.google.com/..."
                  className="input-field"
                />
              </div>

              {/* Toggle: cupom de desconto */}
              <div className="flex items-center justify-between bg-th-raised/60 border border-zinc-300/60 dark:border-zinc-700/30 rounded-xl px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-th-text-2">Cupom de desconto</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Exibe campo de cupom no checkout deste produto.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, allow_coupons: !f.allow_coupons }))}
                  aria-checked={form.allow_coupons}
                  role="switch"
                  className={`relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 ml-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    form.allow_coupons ? 'bg-emerald-600' : 'bg-zinc-600'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                    form.allow_coupons ? 'left-5' : 'left-1'
                  }`} />
                </button>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={closeForm} className="flex-1 py-2.5 text-sm font-medium text-th-text-3 bg-th-raised hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loadingSubmit} className="flex-1 btn-primary">
                  {loadingSubmit
                    ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</span>
                    : 'Criar produto'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Products table ── */}
      {loadingList ? (
        <div className="th-card bg-th-surface border border-th-line rounded-xl overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_2fr_120px_1fr_140px] gap-4 px-6 py-3 border-b border-th-line text-xs font-medium text-zinc-500 uppercase tracking-wider">
            <span>Nome</span>
            <span>Descrição</span>
            <span>Preço</span>
            <span>Link de entrega</span>
            <span className="text-right">Ações</span>
          </div>
          <ul className="divide-y divide-th-line">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonProductRow key={i} />)}
          </ul>
        </div>
      ) : products.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (() => {
        const totalPages = Math.ceil(products.length / PAGE_SIZE)
        const paginated  = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        return (
        <div className="th-card bg-th-surface border border-th-line rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1fr_2fr_120px_1fr_140px] gap-4 px-6 py-3 border-b border-th-line text-xs font-medium text-zinc-500 uppercase tracking-wider">
            <span>Nome</span>
            <span>Descrição</span>
            <span>Preço</span>
            <span>Link de entrega</span>
            <span className="text-right">Ações</span>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-th-line">
            {paginated.map(product => (
              <li key={product.id} className="grid md:grid-cols-[1fr_2fr_120px_1fr_140px] gap-4 items-center px-6 py-4 hover:bg-th-raised/40 transition-colors">
                {/* Nome */}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-th-text truncate">{product.name}</p>
                    {product.allow_coupons && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        Cupom
                      </span>
                    )}
                  </div>
                  {/* Visível só em mobile */}
                  <p className="text-xs text-zinc-500 mt-0.5 md:hidden">
                    {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>

                {/* Descrição */}
                <p className="text-sm text-zinc-500 truncate hidden md:block">
                  {product.description || <span className="italic text-th-text-4">Sem descrição</span>}
                </p>

                {/* Preço */}
                <p className="text-sm font-medium text-emerald-400 hidden md:block">
                  {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>

                {/* Link */}
                <div className="hidden md:block">
                  {product.delivery_url ? (
                    <a
                      href={product.delivery_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors truncate max-w-[180px]"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{product.delivery_url.replace(/^https?:\/\//, '')}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-th-text-4 italic">Não informado</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => handleCopyLink(product.id)}
                    className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
                    title="Copiar link de venda"
                  >
                    {copiedId === product.id
                      ? <CheckCheck className="w-4 h-4 text-emerald-400" />
                      : <Link2 className="w-4 h-4" />
                    }
                  </button>
                  <button
                    onClick={() => navigate(`/products/${product.id}`)}
                    className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    disabled={deletingId === product.id}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-40"
                    title="Excluir"
                  >
                    {deletingId === product.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-th-line">
            <span className="text-xs text-th-text-4">
              {products.length} {products.length === 1 ? 'produto cadastrado' : 'produtos cadastrados'}
            </span>
          </div>

          <Pagination page={page} totalPages={totalPages} onChange={p => { setPage(p); window.scrollTo(0, 0) }} />
        </div>
        )
      })()}
    </DashboardLayout>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div className="bg-th-surface border border-th-line rounded-xl p-14 text-center">
      <div className="w-16 h-16 bg-th-raised rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Package className="w-8 h-8 text-th-text-4" />
      </div>
      <h3 className="text-th-text-2 font-medium mb-2">Nenhum produto cadastrado</h3>
      <p className="text-th-text-4 text-sm mb-6 max-w-xs mx-auto">
        Crie seu primeiro produto digital para começar a receber pedidos.
      </p>
      <button onClick={onAdd} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
        <Plus className="w-4 h-4" />
        Adicionar produto
      </button>
    </div>
  )
}
