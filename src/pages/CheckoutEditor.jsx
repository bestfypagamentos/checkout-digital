import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Upload, AlignLeft, AlignCenter } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const DEFAULT_SETTINGS = {
  logo_url:         '',
  logo_position:    'left',
  timer_seconds:    600,
  timer_bg_color:   '#EAB308',
  timer_text_color: '#713F12',
  button_color:     '#16A34A',
}

// ─── Color Picker ──────────────────────────────────────────────────────────────
function ColorPicker({ label, value, onChange }) {
  const handleText = (e) => {
    if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value)
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-700/50 shrink-0">
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="absolute -inset-1 w-14 h-14 cursor-pointer"
          />
        </div>
        <input
          type="text"
          value={value.toUpperCase()}
          onChange={handleText}
          maxLength={7}
          className="input-field font-mono uppercase flex-1"
          placeholder="#000000"
        />
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl p-4 space-y-4">
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{title}</p>
      {children}
    </div>
  )
}

// ─── Checkout Preview ─────────────────────────────────────────────────────────
function CheckoutPreview({ settings, product }) {
  const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const mm  = String(Math.floor(settings.timer_seconds / 60)).padStart(2, '0')
  const ss  = String(settings.timer_seconds % 60).padStart(2, '0')
  const price = product?.price || 0
  const btn = settings.button_color

  return (
    <div className="bg-gray-50 min-h-full" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className={`px-4 h-14 flex items-center ${settings.logo_position === 'center' ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt=""
                className="h-8 max-w-[120px] object-contain"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: btn }}>
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            )}
          </div>
          {settings.logo_position !== 'center' && (
            <div className="flex items-center gap-1 text-th-text-3">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-[10px] font-medium">Ambiente seguro</span>
            </div>
          )}
        </div>
      </header>

      <div className="px-4 py-5 space-y-3">

        {/* Countdown */}
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-center gap-2"
          style={{ backgroundColor: settings.timer_bg_color }}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke={settings.timer_text_color} strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: settings.timer_text_color }}>
            Essa oferta acabará em <strong>{mm}:{ss}</strong>
          </span>
        </div>

        {/* Product card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-green-50 to-green-100 border border-green-100 flex items-center justify-center shrink-0">
              {product?.image_url ? (
                <img src={product.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={btn}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-zinc-900 text-sm leading-tight">{product?.name || 'Nome do produto'}</p>
              {product?.description && (
                <p className="text-[11px] text-th-text-3 mt-0.5 truncate">{product.description}</p>
              )}
              <p className="text-base font-black mt-1" style={{ color: btn }}>{fmt(price)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <div className="w-6 h-6 rounded border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-center text-th-text-3 text-xs">−</div>
              <span className="text-sm font-bold text-zinc-800 w-5 text-center">01</span>
              <div className="w-6 h-6 rounded border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-center text-th-text-3 text-xs">+</div>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between text-sm mb-2.5">
            <span className="text-zinc-500">Subtotal</span>
            <span className="text-zinc-700 font-medium">{fmt(price)}</span>
          </div>
          <div className="border-t border-gray-100 pt-2.5 flex items-baseline justify-between">
            <span className="font-bold text-zinc-900 text-sm">Total</span>
            <span className="text-xl font-black" style={{ color: btn }}>{fmt(price)}</span>
          </div>
          <p className="text-[10px] text-th-text-3 text-right mt-0.5">Pagamento exclusivo via PIX</p>
        </div>

        {/* Contact mock */}
        <div>
          <h2 className="text-base font-bold text-zinc-900 mb-2.5">Contato</h2>
          <div className="space-y-2">
            {['Email', 'Nome completo', 'Celular', 'CPF'].map(p => (
              <div key={p} className="bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-[13px] text-th-text-3 shadow-sm">
                {p}
              </div>
            ))}
          </div>
        </div>

        {/* Payment mock */}
        <div>
          <h2 className="text-base font-bold text-zinc-900 mb-2.5">Pagamento</h2>
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3 border-2"
            style={{ borderColor: btn, backgroundColor: `${btn}18` }}
          >
            <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: btn }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: btn }} />
            </div>
            <span className="font-semibold text-zinc-800 text-sm">PIX</span>
            <span
              className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ color: btn, backgroundColor: `${btn}28` }}
            >
              Aprovação imediata
            </span>
          </div>
        </div>

        {/* Submit button */}
        <button
          className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-xl text-sm pointer-events-none"
          style={{ backgroundColor: btn, boxShadow: `0 8px 20px -4px ${btn}60` }}
        >
          🔒 Finalizar compra · {fmt(price)}
        </button>

        <p className="text-center text-[10px] text-th-text-3 pb-4">Processado com segurança pela Bestfy</p>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CheckoutEditor() {
  const { id, checkoutId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const logoInputRef = useRef(null)

  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [saveSuccess, setSaveSuccess]     = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [product, setProduct]             = useState(null)
  const [checkoutName, setCheckoutName]   = useState('')
  const [settings, setSettings]           = useState(DEFAULT_SETTINGS)

  useEffect(() => {
    async function load() {
      // Load product data (for preview)
      const { data: prod, error: prodErr } = await supabase
        .from('products')
        .select('id, name, description, price, image_url')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (prodErr || !prod) { navigate('/products'); return }
      setProduct(prod)

      // Load this checkout's specific settings
      const { data: checkout, error: checkoutErr } = await supabase
        .from('product_checkouts')
        .select('id, name, settings')
        .eq('id', checkoutId)
        .single()

      if (checkoutErr || !checkout) { navigate(`/products/${id}?tab=checkout`); return }

      setCheckoutName(checkout.name)
      if (checkout.settings && Object.keys(checkout.settings).length > 0) {
        setSettings({ ...DEFAULT_SETTINGS, ...checkout.settings })
      }
      setLoading(false)
    }
    load()
  }, [id, checkoutId, user.id, navigate])

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }))

  // ─── Logo upload — scoped to checkoutId ───────────────────────────────────
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('A logo deve ter no máximo 2 MB.'); return }

    setUploadingLogo(true)
    const path = `${user.id}/checkout-logo-${checkoutId}`

    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
      set('logo_url', `${publicUrl}?t=${Date.now()}`)
    }
    setUploadingLogo(false)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  // ─── Save — scoped to checkoutId ──────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('product_checkouts')
      .update({ settings })
      .eq('id', checkoutId)

    if (!error) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
    setSaving(false)
  }

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    </DashboardLayout>
  )

  const timerMin = Math.floor(settings.timer_seconds / 60)
  const timerSec = settings.timer_seconds % 60

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`/products/${id}?tab=checkout`)}
          className="p-2 text-zinc-500 hover:text-th-text-2 hover:bg-th-raised rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-th-text">Customizar Checkout</h1>
          <p className="text-th-text-4 text-xs mt-0.5 truncate">
            {product?.name} · <span className="text-zinc-500">{checkoutName}</span>
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shrink-0"
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            : saveSuccess
              ? '✓ Salvo!'
              : 'Salvar alterações'
          }
        </button>
      </div>

      {/* Split screen */}
      <div className="flex gap-5 items-start">

        {/* ── Controls ── */}
        <div className="w-64 shrink-0 space-y-4">

          {/* Logo */}
          <Section title="Identidade Visual">
            <div>
              <label className="label">Logomarca</label>

              {settings.logo_url && (
                <div className="mb-2 bg-white border border-zinc-300 dark:border-zinc-700/50 rounded-xl p-3 flex items-center justify-center h-16">
                  <img
                    src={settings.logo_url}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
              )}

              <input
                type="url"
                value={settings.logo_url}
                onChange={e => set('logo_url', e.target.value)}
                placeholder="https://exemplo.com/logo.png"
                className="input-field text-sm mb-2"
              />

              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="w-full flex items-center justify-center gap-2 text-sm text-th-text-3 hover:text-th-text-2 bg-th-raised hover:bg-th-muted border border-zinc-300 dark:border-zinc-700/50 rounded-lg py-2 transition-colors disabled:opacity-50"
              >
                {uploadingLogo
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
                  : <><Upload className="w-3.5 h-3.5" /> Fazer upload</>
                }
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

              {settings.logo_url && (
                <button
                  type="button"
                  onClick={() => set('logo_url', '')}
                  className="w-full text-xs text-th-text-4 hover:text-red-400 transition-colors mt-2"
                >
                  Remover logo
                </button>
              )}
            </div>

            {/* Position */}
            <div>
              <label className="label">Posição da logo</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'left',   label: 'Esquerda', Icon: AlignLeft },
                  { value: 'center', label: 'Centro',   Icon: AlignCenter },
                ].map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('logo_position', value)}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      settings.logo_position === value
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-zinc-300 dark:border-zinc-700/50 bg-th-raised text-zinc-500 hover:text-th-text-2'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* Timer */}
          <Section title="Temporizador">
            <div>
              <label className="label">Duração</label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-1 bg-th-raised border border-zinc-300 dark:border-zinc-700/50 rounded-lg px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={timerMin}
                    onChange={e => set('timer_seconds', Math.max(0, parseInt(e.target.value) || 0) * 60 + timerSec)}
                    className="w-10 bg-transparent text-th-text text-sm text-center outline-none"
                  />
                  <span className="text-th-text-4 text-xs">min</span>
                </div>
                <span className="text-th-text-4 font-bold">:</span>
                <div className="flex items-center gap-1 flex-1 bg-th-raised border border-zinc-300 dark:border-zinc-700/50 rounded-lg px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={timerSec}
                    onChange={e => set('timer_seconds', timerMin * 60 + Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-10 bg-transparent text-th-text text-sm text-center outline-none"
                  />
                  <span className="text-th-text-4 text-xs">seg</span>
                </div>
              </div>
            </div>

            <ColorPicker
              label="Cor de fundo"
              value={settings.timer_bg_color}
              onChange={v => set('timer_bg_color', v)}
            />
            <ColorPicker
              label="Cor do texto"
              value={settings.timer_text_color}
              onChange={v => set('timer_text_color', v)}
            />
          </Section>

          {/* Button */}
          <Section title="Botão de Pagamento">
            <ColorPicker
              label="Cor principal"
              value={settings.button_color}
              onChange={v => set('button_color', v)}
            />
            <p className="text-[11px] text-th-text-4 leading-relaxed">
              Aplicada também nos preços, totais e seleção do método de pagamento.
            </p>
          </Section>

        </div>

        {/* ── Preview ── */}
        <div className="flex-1 min-w-0">
          <div className="sticky top-6">
            {/* Browser mockup */}
            <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-2xl overflow-hidden shadow-2xl">
              {/* Browser bar */}
              <div className="bg-th-raised/80 px-4 py-2.5 flex items-center gap-3 border-b border-zinc-300/50 dark:border-zinc-700/30">
                <div className="flex gap-1.5 shrink-0">
                  <div className="w-3 h-3 rounded-full bg-zinc-600" />
                  <div className="w-3 h-3 rounded-full bg-zinc-600" />
                  <div className="w-3 h-3 rounded-full bg-zinc-600" />
                </div>
                <div className="flex-1 bg-th-muted/60 rounded-full h-5 px-3 flex items-center overflow-hidden">
                  <span className="text-[11px] text-zinc-500 truncate">
                    {window.location.origin}/checkout/{id}?chk={checkoutId}
                  </span>
                </div>
              </div>

              {/* Scrollable checkout preview */}
              <div className="h-[calc(100vh-180px)] overflow-y-auto">
                <CheckoutPreview settings={settings} product={product} />
              </div>
            </div>

            <p className="text-center text-xs text-th-text-4 mt-3">
              Preview em tempo real — as alterações refletem instantaneamente
            </p>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
