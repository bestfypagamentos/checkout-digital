import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft, ExternalLink, Copy, CheckCheck, ImagePlus, X, Paintbrush } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const TABS = [
  { id: 'geral',    label: 'Geral' },
  { id: 'checkout', label: 'Checkout' },
]

function formatCurrency(raw) {
  const digits = String(raw).replace(/\D/g, '')
  if (!digits) return ''
  const number = parseInt(digits, 10) / 100
  return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseCurrency(formatted) {
  return parseFloat(String(formatted).replace(/\./g, '').replace(',', '.')) || 0
}

export default function ProductEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const imageInputRef = useRef(null)

  const [tab, setTab] = useState('geral')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', price: '', delivery_url: '', allow_coupons: false, image_url: null,
  })

  // ─── Load product ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        navigate('/products')
        return
      }

      setForm({
        name:          data.name,
        description:   data.description || '',
        price:         formatCurrency(String(Math.round(data.price * 100))),
        delivery_url:  data.delivery_url || '',
        allow_coupons: data.allow_coupons ?? false,
        image_url:     data.image_url || null,
      })
      setLoading(false)
    }
    load()
  }, [id, user.id, navigate])

  // ─── Image upload ─────────────────────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
    if (file.size > MAX_SIZE) {
      setImageError('A imagem deve ter no máximo 2 MB.')
      return
    }

    setImageError(null)
    setUploadingImage(true)

    const storagePath = `${user.id}/${id}`

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(storagePath, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setImageError('Erro ao fazer upload da imagem.')
      setUploadingImage(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(storagePath)

    // Cache-bust para forçar recarregamento se a imagem foi substituída
    const urlWithBust = `${publicUrl}?t=${Date.now()}`

    await supabase.from('products').update({ image_url: urlWithBust }).eq('id', id)
    setForm(f => ({ ...f, image_url: urlWithBust }))
    setUploadingImage(false)

    // Reset input para permitir reselecionar o mesmo arquivo
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleRemoveImage = async () => {
    await supabase.storage.from('product-images').remove([`${user.id}/${id}`])
    await supabase.from('products').update({ image_url: null }).eq('id', id)
    setForm(f => ({ ...f, image_url: null }))
    setImageError(null)
  }

  // ─── Save form ────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!form.name.trim()) return setError('Nome é obrigatório.')
    if (!form.price) return setError('Preço é obrigatório.')
    const price = parseCurrency(form.price)
    if (price <= 0) return setError('Preço deve ser maior que zero.')

    setSaving(true)
    const { error: dbError } = await supabase
      .from('products')
      .update({
        name:          form.name.trim(),
        description:   form.description.trim(),
        price,
        delivery_url:  form.delivery_url.trim(),
        allow_coupons: form.allow_coupons,
      })
      .eq('id', id)

    if (dbError) {
      setError(dbError.message)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  const checkoutUrl = `${window.location.origin}/checkout/${id}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(checkoutUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/products')}
          className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 leading-tight truncate max-w-sm">
            {form.name || 'Produto'}
          </h1>
          <p className="text-zinc-600 text-xs mt-0.5">Editar produto</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800 mb-8">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              tab === t.id
                ? 'text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Geral ── */}
      {tab === 'geral' && (
        <form onSubmit={handleSave} className="max-w-xl space-y-5">

          {/* ── Imagem do produto ── */}
          <div>
            <label className="label">
              Imagem do produto <span className="text-zinc-600">(opcional)</span>
            </label>
            <div className="flex items-start gap-4">
              {/* Preview / Upload zone */}
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-dashed border-zinc-700 bg-zinc-800/40 flex items-center justify-center shrink-0 hover:border-emerald-500 hover:bg-zinc-800 transition-all group disabled:pointer-events-none"
              >
                {form.image_url ? (
                  <img
                    src={form.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : uploadingImage ? (
                  <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
                ) : (
                  <ImagePlus className="w-6 h-6 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                )}

                {/* Overlay de loading quando substituindo imagem */}
                {uploadingImage && form.image_url && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </button>

              {/* Ações */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="text-sm font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors text-left"
                >
                  {uploadingImage
                    ? 'Enviando...'
                    : form.image_url
                      ? 'Trocar imagem'
                      : 'Selecionar imagem'
                  }
                </button>

                {form.image_url && !uploadingImage && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="flex items-center gap-1 text-sm text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remover
                  </button>
                )}

                <p className="text-xs text-zinc-600">JPG, PNG ou WEBP · máx. 2 MB</p>
              </div>
            </div>

            {imageError && (
              <p className="text-xs text-red-400 mt-2">{imageError}</p>
            )}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>

          <div>
            <label className="label">Nome do produto</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Curso de React do Zero"
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Descrição <span className="text-zinc-600">(opcional)</span></label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descreva brevemente o que está incluso..."
              rows={4}
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
                onChange={e => setForm(f => ({ ...f, price: formatCurrency(e.target.value) }))}
                placeholder="0,00"
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label className="label">Link de entrega <span className="text-zinc-600">(opcional)</span></label>
            <input
              type="url"
              value={form.delivery_url}
              onChange={e => setForm(f => ({ ...f, delivery_url: e.target.value }))}
              placeholder="https://drive.google.com/..."
              className="input-field"
            />
          </div>

          {/* Toggle: cupom */}
          <div className="flex items-center justify-between bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-zinc-200">Cupom de desconto</p>
              <p className="text-xs text-zinc-500 mt-0.5">Exibe campo de cupom no checkout deste produto.</p>
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

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
              <p className="text-sm text-emerald-400">Alterações salvas com sucesso.</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="px-5 py-2.5 text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary px-6">
              {saving
                ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</span>
                : 'Salvar alterações'
              }
            </button>
          </div>
        </form>
      )}

      {/* ── Tab: Checkout ── */}
      {tab === 'checkout' && (
        <div className="max-w-xl space-y-6">

          {/* Customizar aparência */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
              <Paintbrush className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-200">Aparência do Checkout</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                Personalize cores, logo, temporizador e muito mais com preview em tempo real.
              </p>
            </div>
            <button
              onClick={() => navigate(`/products/${id}/checkout-editor`)}
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-lg transition-colors"
            >
              Personalizar
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-zinc-200 mb-1">Link de venda</h2>
            <p className="text-xs text-zinc-500 mb-4">Compartilhe este link com seus clientes para direcionar ao checkout.</p>

            <div className="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3">
              <p className="flex-1 text-sm text-zinc-400 truncate">{checkoutUrl}</p>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
                title="Copiar link"
              >
                {copied
                  ? <CheckCheck className="w-4 h-4 text-emerald-400" />
                  : <Copy className="w-4 h-4" />
                }
              </button>
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
                title="Abrir checkout"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
