import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ArrowLeft, ExternalLink, Copy, CheckCheck, ImagePlus, X, Paintbrush, Plus, Trash2, Tag, Percent, ChevronRight, Settings2, MoreVertical, Star, Files, Settings, Package, GripVertical } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const TABS = [
  { id: 'geral',    label: 'Geral' },
  { id: 'cupons',   label: 'Cupons' },
  { id: 'checkout', label: 'Checkout' },
  { id: 'links',    label: 'Links' },
  { id: 'bumps',    label: 'Order Bump' },
  { id: 'upsell',   label: 'Upsell / Downsell' },
]

const EMPTY_UPSELL = {
  has_custom_redirect:      false,
  redirect_url:             '',
  ignore_bump_failures:     false,
  send_confirmation_email:  false,
  email_timing:             'immediate',
  email_delay_minutes:      1,
}

// ─── Skeleton primitives ─────────────────────────────────────────────────────
function Sk({ w = 'w-full', h = 'h-4', round = 'rounded-lg', extra = '' }) {
  return <div className={`animate-pulse bg-neutral-200 dark:bg-neutral-700 ${w} ${h} ${round} ${extra}`} />
}

function CheckoutTableSkeleton() {
  return (
    <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-6 px-8 py-3 border-b border-zinc-200 dark:border-zinc-800/50">
        <Sk w="w-10" h="h-3" round="rounded-full" extra="shrink-0" />
        <Sk w="w-32" h="h-3" round="rounded-full" />
        <div className="ml-auto w-8 shrink-0" />
      </div>
      {/* 3 simulated rows */}
      {[
        { nameW: 'w-36', badge: true,  pills: ['w-28', 'w-24'] },
        { nameW: 'w-28', badge: false, pills: ['w-32']         },
        { nameW: 'w-32', badge: false, pills: ['w-24', 'w-20'] },
      ].map((row, i) => (
        <div key={i} className="flex items-center gap-6 px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/50 last:border-0">
          {/* Name + optional badge */}
          <div className="w-1/3 shrink-0 flex items-center gap-2">
            <Sk w={row.nameW} h="h-4" />
            {row.badge && <Sk w="w-14" h="h-5" round="rounded-full" />}
          </div>
          {/* Offer pills */}
          <div className="flex-1 flex gap-2">
            {row.pills.map((w, j) => (
              <Sk key={j} w={w} h="h-7" round="rounded-full" />
            ))}
          </div>
          {/* Action button */}
          <div className="w-8 shrink-0 flex justify-end">
            <Sk w="w-8" h="h-8" round="rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

function LinksTableSkeleton() {
  return (
    <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] gap-6 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800/50 items-center">
        <Sk w="w-12" h="h-3" round="rounded-full" />
        <Sk w="w-16" h="h-3" round="rounded-full" />
        <Sk w="w-20" h="h-3" round="rounded-full" />
      </div>
      {/* 3 simulated rows */}
      {[
        { nameW: 'w-28', priceW: 'w-16', checkoutW: 'w-24' },
        { nameW: 'w-36', priceW: 'w-20', checkoutW: 'w-32' },
        { nameW: 'w-24', priceW: 'w-14', checkoutW: 'w-28' },
      ].map((row, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] gap-6 items-center px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/50 last:border-0">
          {/* Offer */}
          <div className="space-y-1.5 min-w-0">
            <Sk w={row.nameW} h="h-3.5" />
            <Sk w={row.priceW} h="h-3" />
          </div>
          {/* Checkout name + badge */}
          <div className="flex items-center gap-2 min-w-0">
            <Sk w={row.checkoutW} h="h-3.5" />
          </div>
          {/* Link button */}
          <Sk w="w-full" h="h-10" round="rounded-xl" />
        </div>
      ))}
    </div>
  )
}

function GeralSkeleton() {
  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-start gap-4">
        <Sk w="w-24" h="h-24" round="rounded-xl" extra="shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <Sk w="w-1/2" h="h-3" />
          <Sk w="w-3/4" h="h-3" />
        </div>
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Sk w="w-24" h="h-3" round="rounded-md" />
          <Sk w="w-full" h="h-10" round="rounded-lg" />
        </div>
      ))}
    </div>
  )
}

function CuponsSkeleton() {
  return (
    <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_100px_120px_80px] gap-4 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800/50">
        {['w-16','w-14','w-20','w-8'].map((w,i) => <Sk key={i} w={w} h="h-3" round="rounded-full" />)}
      </div>
      {[['w-28','w-16','w-24'],['w-36','w-14','w-20'],['w-24','w-16','w-28']].map((cols, i) => (
        <div key={i} className="grid grid-cols-[1fr_100px_120px_80px] gap-4 items-center px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/50 last:border-0">
          <Sk w={cols[0]} h="h-4" />
          <Sk w={cols[1]} h="h-4" />
          <Sk w={cols[2]} h="h-6" round="rounded-full" />
          <div className="flex justify-end gap-1">
            <Sk w="w-7" h="h-7" round="rounded-lg" />
            <Sk w="w-7" h="h-7" round="rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

function UpsellSkeleton() {
  return (
    <div className="max-w-2xl space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-th-surface border border-zinc-200 dark:border-zinc-800/50 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Sk w="w-2/3" h="h-4" />
            <Sk w="w-10" h="h-6" round="rounded-full" extra="shrink-0" />
          </div>
          {i === 0 && <Sk w="w-full" h="h-10" round="rounded-lg" />}
        </div>
      ))}
    </div>
  )
}

function BumpsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-th-surface border border-zinc-200 dark:border-zinc-800/50 rounded-xl px-5 py-4 flex items-center gap-4">
          <Sk w="w-4" h="h-8" round="rounded-md" extra="shrink-0" />
          <Sk w="w-9" h="h-9" round="rounded-lg" extra="shrink-0" />
          <div className="flex-1 space-y-1.5 min-w-0">
            <Sk w="w-2/5" h="h-4" />
            <Sk w="w-1/3" h="h-3" />
          </div>
          <Sk w="w-20" h="h-8" round="rounded-lg" extra="shrink-0" />
        </div>
      ))}
    </div>
  )
}

const EMPTY_OFFER_FORM = { name: '', price: '', type: 'one_time', interval_type: 'week', interval_count: '1' }
const EMPTY_BUMP_FORM  = { bump_product_id: '', bump_offer_id: '', cta: 'SIM, EU ACEITO ESSA OFERTA ESPECIAL!', title: 'Nome do seu produto', description: 'Adicione a compra', apply_discount: false, original_price: '' }
const GUARANTEE_OPTIONS = [
  { value: '', label: 'Sem garantia' },
  { value: '7', label: '7 dias' },
  { value: '14', label: '14 dias' },
  { value: '30', label: '30 dias' },
  { value: '60', label: '60 dias' },
  { value: '90', label: '90 dias' },
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

// ─── Sortable bump card ───────────────────────────────────────────────────────
function SortableBumpCard({ bump, index, onEdit, onDelete, deletingId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: bump.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  }

  const bumpPrice   = bump.bump_offer?.price ?? null
  const origPrice   = bump.original_price
  const discountPct = bumpPrice && origPrice && origPrice > bumpPrice
    ? Math.round((1 - bumpPrice / origPrice) * 100)
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-th-surface border rounded-xl px-5 py-4 flex items-center gap-4 transition-shadow ${
        isDragging
          ? 'border-emerald-500/60 shadow-[0_0_0_2px_rgba(16,185,129,0.25)] shadow-2xl'
          : 'border-zinc-200 dark:border-zinc-800/50'
      }`}
    >
      {/* Drag handle + index */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center gap-1.5 shrink-0 cursor-grab active:cursor-grabbing text-th-text-4 hover:text-th-text-3 transition-colors select-none"
        title="Arrastar para reordenar"
      >
        <GripVertical className="w-4 h-4" />
        <span className="text-xs font-semibold tabular-nums text-th-text-4 w-3 text-center">{index + 1}</span>
      </div>

      {/* Icon */}
      <div className="w-9 h-9 bg-th-raised rounded-lg flex items-center justify-center shrink-0">
        <Package className="w-4 h-4 text-zinc-500" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-th-text-2 truncate">{bump.title}</p>
        <p className="text-xs text-zinc-500 truncate mt-0.5">
          {bump.bump_product?.name}
          {bump.bump_offer && <span className="text-th-text-4"> · {bump.bump_offer.name}</span>}
        </p>
      </div>

      {/* Price */}
      {bumpPrice !== null && (
        <div className="text-right shrink-0">
          {discountPct && (
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 mb-1 inline-block">
              -{discountPct}%
            </span>
          )}
          <p className="text-sm font-semibold text-emerald-400">
            {Number(bumpPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          {origPrice && (
            <p className="text-xs text-th-text-4 line-through">
              {Number(origPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(bump)}
          className="p-2 text-zinc-500 hover:text-th-text-2 hover:bg-th-raised rounded-lg transition-colors"
          title="Editar"
        >
          <Settings2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(bump.id)}
          disabled={deletingId === bump.id}
          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-40"
          title="Excluir"
        >
          {deletingId === bump.id
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Trash2 className="w-4 h-4" />
          }
        </button>
      </div>
    </div>
  )
}

export default function ProductEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const imageInputRef = useRef(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'geral'
  const [tabSwitching, setTabSwitching] = useState(false)

  const setTab = (id) => {
    setTabSwitching(true)
    // Reseta flags de cada tab para forçar re-fetch e exibir skeleton
    if (id === 'cupons')   setCouponsLoaded(false)
    if (id === 'checkout') setModelsLoaded(false)
    if (id === 'bumps')    setBumpsLoaded(false)
    if (id === 'links')    { setOffersLoaded(false); setModelsLoaded(false) }
    setSearchParams({ tab: id }, { replace: true })
  }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedLinkId, setCopiedLinkId] = useState(null)
  const [form, setForm] = useState({
    name: '', description: '', price: '', delivery_url: '', allow_coupons: false, image_url: null,
  })

  // ─── Coupon state ─────────────────────────────────────────────────────────
  const [coupons, setCoupons] = useState([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)
  const [couponsLoaded, setCouponsLoaded] = useState(false)
  const [showCouponModal, setShowCouponModal] = useState(false)
  const [couponForm, setCouponForm] = useState({ code: '', discount_percent: '', starts_at: '', expires_at: '', apply_to_bumps: false })
  const [couponFormError, setCouponFormError] = useState('')
  const [savingCoupon, setSavingCoupon] = useState(false)
  const [deletingCouponId, setDeletingCouponId] = useState(null)

  // ─── Checkout models ──────────────────────────────────────────────────────
  const [checkoutModels, setCheckoutModels]   = useState([])
  const [loadingModels, setLoadingModels]     = useState(false)
  const [modelsLoaded, setModelsLoaded]       = useState(false)
  const [showModelPanel, setShowModelPanel]   = useState(false)
  const [modelForm, setModelForm]             = useState({ name: '', is_default: false, offer_ids: [] })
  const [savingModel, setSavingModel]         = useState(false)
  const [modelMenuId, setModelMenuId]                   = useState(null)
  const [deletingModelId, setDeletingModelId]           = useState(null)
  const [confirmDeleteModelId, setConfirmDeleteModelId] = useState(null)
  const [showModelSettings, setShowModelSettings]       = useState(null)
  const [settingsForm, setSettingsForm]                 = useState({ name: '', is_default: false, offer_ids: [] })
  const [savingSettings, setSavingSettings]             = useState(false)
  const [confirmUnlink, setConfirmUnlink]               = useState(false)

  // ─── Preços / Ofertas ─────────────────────────────────────────────────────
  const [offers, setOffers] = useState([])
  const [loadingOffers, setLoadingOffers] = useState(false)
  const [offersLoaded, setOffersLoaded] = useState(false)
  const [guarantee, setGuarantee] = useState('')
  const [savingGuarantee, setSavingGuarantee] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [editingOffer, setEditingOffer] = useState(null) // null=add, object=edit
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER_FORM)
  const [offerFormError, setOfferFormError] = useState('')
  const [savingOffer, setSavingOffer] = useState(false)
  const [deletingOfferId, setDeletingOfferId] = useState(null)

  // ─── Order Bumps ──────────────────────────────────────────────────────────
  const [bumps, setBumps]                       = useState([])
  const [loadingBumps, setLoadingBumps]         = useState(false)
  const [bumpsLoaded, setBumpsLoaded]           = useState(false)
  const [showBumpModal, setShowBumpModal]       = useState(false)
  const [editingBump, setEditingBump]           = useState(null)
  const [bumpForm, setBumpForm]                 = useState(EMPTY_BUMP_FORM)
  const [bumpFormError, setBumpFormError]       = useState('')
  const [savingBump, setSavingBump]             = useState(false)
  const [deletingBumpId, setDeletingBumpId]     = useState(null)
  const [bumpProducts, setBumpProducts]         = useState([])
  const [bumpOffers, setBumpOffers]             = useState([])
  const [loadingBumpOffers, setLoadingBumpOffers] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ─── Upsell / Downsell ────────────────────────────────────────────────────
  const [upsell, setUpsell]             = useState(EMPTY_UPSELL)
  const [savingUpsell, setSavingUpsell] = useState(false)
  const [upsellSaved, setUpsellSaved]   = useState(false)
  const setU = (key, val) => setUpsell(s => ({ ...s, [key]: val }))

  // ─── Gerador de Upsell ────────────────────────────────────────────────────
  const EMPTY_GEN = {
    product_id:    '',
    offer_id:      '',
    type:          'upsell',
    accept_action: 'redirect_members',
    accept_url:    '',
    reject_action: 'redirect_members',
    reject_url:    '',
    accept_text:   'Sim! Eu quero essa oferta especial!',
    reject_text:   'Não, obrigado. Não quero essa oferta.',
    accept_color:  '#10b981',
  }
  const [showGenerator, setShowGenerator]   = useState(false)
  const [genForm, setGenForm]               = useState(EMPTY_GEN)
  const [genProducts, setGenProducts]       = useState([])
  const [genOffers, setGenOffers]           = useState([])
  const [loadingGenOffers, setLoadingGenOffers] = useState(false)
  const [savingGen, setSavingGen]           = useState(false)
  const [generatedScript, setGeneratedScript] = useState('')
  const [showGenSuccess, setShowGenSuccess]   = useState(false)
  const [scriptCopied, setScriptCopied]       = useState(false)
  const setG = (key, val) => setGenForm(s => ({ ...s, [key]: val }))

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
      setGuarantee(data.guarantee_days ? String(data.guarantee_days) : '')
      if (data.upsell_settings && Object.keys(data.upsell_settings).length > 0) {
        setUpsell({ ...EMPTY_UPSELL, ...data.upsell_settings })
      }
      setLoading(false)
    }
    load()
  }, [id, user.id, navigate])

  // ─── Desativa skeleton de transição quando o conteúdo do tab está pronto ──
  useEffect(() => {
    if (!tabSwitching) return
    if (tab === 'geral' || tab === 'upsell') {
      // Estas tabs não têm loading async — exibe skeleton brevemente
      const t = setTimeout(() => setTabSwitching(false), 300)
      return () => clearTimeout(t)
    }
    const ready =
      (tab === 'cupons'   && couponsLoaded   && !loadingCoupons)  ||
      (tab === 'checkout' && modelsLoaded    && !loadingModels)   ||
      (tab === 'links'    && offersLoaded    && modelsLoaded)      ||
      (tab === 'bumps'    && bumpsLoaded     && !loadingBumps)
    if (ready) setTabSwitching(false)
  }, [tab, tabSwitching, couponsLoaded, loadingCoupons, modelsLoaded, loadingModels, offersLoaded, bumpsLoaded, loadingBumps])

  // ─── Lazy load coupons ───────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'cupons' && !couponsLoaded && !loading) fetchCoupons()
  }, [tab, couponsLoaded, loading])

  // ─── Lazy load checkout models ───────────────────────────────────────────
  useEffect(() => {
    if (tab === 'checkout' && !modelsLoaded && !loading) fetchCheckoutModels()
  }, [tab, modelsLoaded, loading])

  // ─── Links tab: garantir que offers e checkoutModels estejam carregados ──
  useEffect(() => {
    if (tab === 'links' && !loading) {
      if (!offersLoaded)  fetchOffers()
      if (!modelsLoaded)  fetchCheckoutModels()
    }
  }, [tab, loading, offersLoaded, modelsLoaded])

  // ─── Lazy load bumps ─────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'bumps' && !bumpsLoaded && !loading) fetchBumps()
  }, [tab, bumpsLoaded, loading])

  // ─── Load offers with product ────────────────────────────────────────────
  useEffect(() => {
    if (!offersLoaded && !loading) fetchOffers()
  }, [offersLoaded, loading])

  async function fetchCoupons() {
    setLoadingCoupons(true)
    const { data } = await supabase.from('coupons').select('*').eq('product_id', id).order('created_at', { ascending: false })
    setCoupons(data || [])
    setLoadingCoupons(false)
    setCouponsLoaded(true)
  }

  async function fetchOffers() {
    setLoadingOffers(true)

    const { data } = await supabase
      .from('product_offers')
      .select('*')
      .eq('product_id', id)
      .order('is_main', { ascending: false })
      .order('created_at', { ascending: true })

    // Auto-create main offer if none exists
    if (!data || data.length === 0) {
      const price = parseCurrency(form.price)
      const { data: defaultCheckout } = await supabase
        .from('product_checkouts')
        .select('id')
        .eq('product_id', id)
        .eq('is_default', true)
        .single()

      const { data: created } = await supabase
        .from('product_offers')
        .insert({ product_id: id, name: form.name, price, type: 'one_time', is_main: true, position: 0 })
        .select()
        .single()

      if (created && defaultCheckout) {
        await supabase.from('checkout_offer_variants').insert({
          checkout_id: defaultCheckout.id,
          offer_id: created.id,
        })
      }
      setOffers(created ? [created] : [])
    } else {
      setOffers(data)
    }
    setLoadingOffers(false)
    setOffersLoaded(true)
  }

  // ─── Gerador de Upsell — funções ────────────────────────────────────────
  async function openGenerator() {
    setGenForm(EMPTY_GEN)
    setGenOffers([])
    setGeneratedScript('')
    // Carrega todos os produtos do seller
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setGenProducts(data || [])
    setShowGenerator(true)
  }

  async function handleGenProductChange(productId) {
    setG('product_id', productId)
    setG('offer_id', '')
    setGenOffers([])
    if (!productId) return
    setLoadingGenOffers(true)
    const { data } = await supabase
      .from('product_offers')
      .select('id, name, price')
      .eq('product_id', productId)
      .order('is_main', { ascending: false })
    setGenOffers(data || [])
    setLoadingGenOffers(false)
  }

  async function handleSaveGenerator() {
    if (!genForm.product_id) return
    setSavingGen(true)

    const payload = {
      seller_id:     user.id,
      product_id:    genForm.product_id,
      offer_id:      genForm.offer_id || null,
      type:          genForm.type,
      accept_action: genForm.accept_action,
      accept_url:    genForm.accept_action === 'offer_another' ? genForm.accept_url : null,
      reject_action: genForm.reject_action,
      reject_url:    genForm.reject_action === 'offer_another' ? genForm.reject_url : null,
      accept_text:   genForm.accept_text,
      reject_text:   genForm.reject_text,
      accept_color:  genForm.accept_color,
    }

    const { data, error } = await supabase
      .from('product_upsells')
      .insert(payload)
      .select('id')
      .single()

    if (!error && data) {
      const baseUrl = import.meta.env.VITE_APP_URL || 'http://localhost:5173'
      const acceptUrl = genForm.accept_action === 'offer_another' ? genForm.accept_url : ''
      const rejectUrl = genForm.reject_action === 'offer_another' ? genForm.reject_url : ''

      const script = `<!-- Bestfy Upsell Widget -->
<script src="${baseUrl}/upsell-widget.js"><\/script>

<bestfy-upsell
  app-base-url="${baseUrl}"
  upsell-id="${data.id}"
  offer-id="${genForm.offer_id || ''}"
  type="${genForm.type}"
  accept-action="${genForm.accept_action}"${acceptUrl ? `\n  accept-url="${acceptUrl}"` : ''}
  reject-action="${genForm.reject_action}"${rejectUrl ? `\n  reject-url="${rejectUrl}"` : ''}
  accept-text="${genForm.accept_text}"
  reject-text="${genForm.reject_text}"
  accept-color="${genForm.accept_color}"
></bestfy-upsell>`

      setGeneratedScript(script)
      setShowGenerator(false)
      setShowGenSuccess(true)
    }

    setSavingGen(false)
  }

  // ─── Upsell save ─────────────────────────────────────────────────────────
  async function handleSaveUpsell() {
    setSavingUpsell(true)
    await supabase.from('products').update({ upsell_settings: upsell }).eq('id', id)
    setSavingUpsell(false)
    setUpsellSaved(true)
    setTimeout(() => setUpsellSaved(false), 3000)
  }

  // ─── Order Bump functions ────────────────────────────────────────────────
  async function fetchBumps() {
    setLoadingBumps(true)
    const { data } = await supabase
      .from('product_order_bumps')
      .select('*, bump_product:products!bump_product_id(id, name, image_url), bump_offer:product_offers!bump_offer_id(id, name, price)')
      .eq('product_id', id)
      .order('position', { ascending: true })
    setBumps(data || [])
    setLoadingBumps(false)
    setBumpsLoaded(true)
  }

  async function openAddBump() {
    setBumpFormError('')
    setBumpForm(EMPTY_BUMP_FORM)
    setEditingBump(null)
    setBumpOffers([])
    if (bumpProducts.length === 0) {
      const { data } = await supabase
        .from('products')
        .select('id, name, image_url, price')
        .eq('user_id', user.id)
        .neq('id', id)
        .order('name', { ascending: true })
      setBumpProducts(data || [])
    }
    setShowBumpModal(true)
  }

  async function openEditBump(bump) {
    setBumpFormError('')
    setEditingBump(bump)
    setBumpForm({
      bump_product_id: bump.bump_product_id || '',
      bump_offer_id:   bump.bump_offer_id   || '',
      cta:             bump.cta             || 'Sim! Quero adicionar',
      title:           bump.title           || '',
      description:     bump.description     || '',
      apply_discount:  bump.apply_discount  || false,
      original_price:  bump.original_price ? formatCurrency(String(Math.round(bump.original_price * 100))) : '',
    })
    if (bumpProducts.length === 0) {
      const { data } = await supabase
        .from('products')
        .select('id, name, image_url, price')
        .eq('user_id', user.id)
        .neq('id', id)
        .order('name', { ascending: true })
      setBumpProducts(data || [])
    }
    if (bump.bump_product_id) {
      setLoadingBumpOffers(true)
      const { data } = await supabase
        .from('product_offers')
        .select('*')
        .eq('product_id', bump.bump_product_id)
        .order('is_main', { ascending: false })
      setBumpOffers(data || [])
      setLoadingBumpOffers(false)
    } else {
      setBumpOffers([])
    }
    setShowBumpModal(true)
  }

  async function handleBumpProductChange(productId) {
    setBumpForm(f => ({ ...f, bump_product_id: productId, bump_offer_id: '' }))
    setBumpOffers([])
    if (!productId) return
    setLoadingBumpOffers(true)
    const { data } = await supabase
      .from('product_offers')
      .select('*')
      .eq('product_id', productId)
      .order('is_main', { ascending: false })
    setBumpOffers(data || [])
    setLoadingBumpOffers(false)
  }

  async function handleSaveBump(e) {
    e.preventDefault()
    setBumpFormError('')
    if (!bumpForm.bump_product_id) return setBumpFormError('Selecione um produto.')
    if (!bumpForm.title.trim())    return setBumpFormError('Título é obrigatório.')
    if (!bumpForm.cta.trim())      return setBumpFormError('Call to action é obrigatório.')
    if (bumpForm.apply_discount) {
      const op = parseCurrency(bumpForm.original_price)
      if (!op || op <= 0) return setBumpFormError('Informe o preço de origem.')
    }
    setSavingBump(true)
    const payload = {
      product_id:      id,
      bump_product_id: bumpForm.bump_product_id,
      bump_offer_id:   bumpForm.bump_offer_id   || null,
      cta:             bumpForm.cta.trim(),
      title:           bumpForm.title.trim(),
      description:     bumpForm.description.trim() || null,
      apply_discount:  bumpForm.apply_discount,
      original_price:  bumpForm.apply_discount ? parseCurrency(bumpForm.original_price) : null,
      position:        editingBump ? editingBump.position : bumps.length,
    }
    if (editingBump) {
      const { error } = await supabase.from('product_order_bumps').update(payload).eq('id', editingBump.id)
      if (error) { setBumpFormError(error.message); setSavingBump(false); return }
    } else {
      const { error } = await supabase.from('product_order_bumps').insert(payload)
      if (error) { setBumpFormError(error.message); setSavingBump(false); return }
    }
    setShowBumpModal(false)
    setBumpsLoaded(false)
    await fetchBumps()
    setSavingBump(false)
  }

  async function handleDeleteBump(bumpId) {
    setDeletingBumpId(bumpId)
    await supabase.from('product_order_bumps').delete().eq('id', bumpId)
    setBumps(prev => prev.filter(b => b.id !== bumpId))
    setDeletingBumpId(null)
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = bumps.findIndex(b => b.id === active.id)
    const newIndex = bumps.findIndex(b => b.id === over.id)
    const reordered = arrayMove(bumps, oldIndex, newIndex)

    // Optimistic update
    setBumps(reordered)

    // Persist new positions
    await Promise.all(
      reordered.map((bump, i) =>
        supabase.from('product_order_bumps').update({ position: i }).eq('id', bump.id)
      )
    )
  }

  async function handleGuaranteeChange(val) {
    setGuarantee(val)
    setSavingGuarantee(true)
    await supabase
      .from('products')
      .update({ guarantee_days: val ? parseInt(val, 10) : null })
      .eq('id', id)
    setSavingGuarantee(false)
  }

  function openAddOffer() {
    setEditingOffer(null)
    setOfferForm(EMPTY_OFFER_FORM)
    setOfferFormError('')
    setShowOfferModal(true)
  }

  function openEditOffer(offer) {
    setEditingOffer(offer)
    setOfferForm({
      name: offer.name,
      price: formatCurrency(String(Math.round(offer.price * 100))),
      type: offer.type,
      interval_type: offer.interval_type || 'week',
      interval_count: offer.interval_count ? String(offer.interval_count) : '1',
    })
    setOfferFormError('')
    setShowOfferModal(true)
  }

  async function handleSaveOffer(e) {
    e.preventDefault()
    setOfferFormError('')
    if (!offerForm.name.trim()) return setOfferFormError('Nome é obrigatório.')
    const price = parseCurrency(offerForm.price)
    if (!price || price <= 0) return setOfferFormError('Preço deve ser maior que zero.')
    if (offerForm.type === 'recurring') {
      const cnt = parseInt(offerForm.interval_count, 10)
      if (!cnt || cnt < 1) return setOfferFormError('Quantidade do intervalo deve ser maior que zero.')
    }
    setSavingOffer(true)
    const payload = {
      name: offerForm.name.trim(),
      price,
      type: offerForm.type,
      interval_type: offerForm.type === 'recurring' ? offerForm.interval_type : null,
      interval_count: offerForm.type === 'recurring' ? parseInt(offerForm.interval_count, 10) : null,
    }
    if (editingOffer) {
      const { error } = await supabase.from('product_offers').update(payload).eq('id', editingOffer.id)
      if (error) { setOfferFormError(error.message); setSavingOffer(false); return }
      // Sync product price when main offer price changes
      if (editingOffer.is_main) {
        await supabase.from('products').update({ price }).eq('id', id)
        setForm(f => ({ ...f, price: formatCurrency(String(Math.round(price * 100))) }))
      }
    } else {
      if (offers.length >= 10) { setOfferFormError('Limite máximo de 10 ofertas atingido.'); setSavingOffer(false); return }
      const { data: defaultCheckout } = await supabase
        .from('product_checkouts')
        .select('id')
        .eq('product_id', id)
        .eq('is_default', true)
        .single()
      const { data: newOffer, error } = await supabase.from('product_offers').insert({
        ...payload,
        product_id: id,
        is_main:    false,
        position:   offers.length,
      }).select().single()
      if (error) { setOfferFormError(error.message); setSavingOffer(false); return }
      if (newOffer && defaultCheckout) {
        await supabase.from('checkout_offer_variants').insert({
          checkout_id: defaultCheckout.id,
          offer_id: newOffer.id,
        })
      }
    }
    setShowOfferModal(false)
    setOffersLoaded(false)
    await fetchOffers()
    setSavingOffer(false)
  }

  async function handleDeleteOffer(offerId) {
    setDeletingOfferId(offerId)
    await supabase.from('product_offers').delete().eq('id', offerId)
    setOffers(prev => prev.filter(o => o.id !== offerId))
    setDeletingOfferId(null)
  }

  async function handleAddCoupon() {
    setCouponFormError('')
    const code = couponForm.code.trim().toUpperCase()
    if (!code) {
      setCouponFormError('O código do cupom é obrigatório.')
      return
    }
    const pct = parseInt(couponForm.discount_percent, 10)
    if (!couponForm.discount_percent || isNaN(pct) || pct < 1 || pct > 100) {
      setCouponFormError('O desconto deve ser um número entre 1 e 100.')
      return
    }

    setSavingCoupon(true)

    const insertData = {
      product_id:       id,
      code,
      discount_percent: pct,
      apply_to_bumps:   couponForm.apply_to_bumps,
    }
    if (couponForm.starts_at)  insertData.starts_at  = couponForm.starts_at
    if (couponForm.expires_at) insertData.expires_at = couponForm.expires_at

    const { error: insertError } = await supabase.from('coupons').insert(insertData)

    if (insertError) {
      if (insertError.code === '23505') {
        setCouponFormError('Já existe um cupom com este código.')
      } else {
        setCouponFormError(insertError.message)
      }
      setSavingCoupon(false)
      return
    }

    setShowCouponModal(false)
    setCouponForm({ code: '', discount_percent: '', starts_at: '', expires_at: '', apply_to_bumps: false })
    setSavingCoupon(false)
    fetchCoupons()
  }

  async function handleDeleteCoupon(couponId) {
    setDeletingCouponId(couponId)
    await supabase.from('coupons').delete().eq('id', couponId)
    setCoupons(prev => prev.filter(c => c.id !== couponId))
    setDeletingCouponId(null)
  }

  // ─── Checkout models ──────────────────────────────────────────────────────
  async function fetchCheckoutModels() {
    setLoadingModels(true)
    const { data } = await supabase
      .from('product_checkouts')
      .select('*, checkout_offer_variants(offer_id, product_offers(*))')
      .eq('product_id', id)
      .order('created_at', { ascending: true })

    const normalize = (m) => ({
      ...m,
      product_offers: (m.checkout_offer_variants || []).map(v => v.product_offers).filter(Boolean),
    })

    let models = (data || []).map(normalize)

    // Auto-create default checkout for existing products that don't have one yet
    if (models.length === 0) {
      const { data: created } = await supabase
        .from('product_checkouts')
        .insert({ product_id: id, name: 'Checkout Padrão', is_default: true })
        .select()
        .single()

      if (created) {
        // Link all existing offers via junction table
        const { data: existingOffers } = await supabase
          .from('product_offers')
          .select('id')
          .eq('product_id', id)

        if (existingOffers?.length > 0) {
          await supabase.from('checkout_offer_variants').insert(
            existingOffers.map(o => ({ checkout_id: created.id, offer_id: o.id }))
          )
        }

        const { data: withOffers } = await supabase
          .from('product_checkouts')
          .select('*, checkout_offer_variants(offer_id, product_offers(*))')
          .eq('id', created.id)
          .single()
        if (withOffers) models = [normalize(withOffers)]
      }
    }

    setCheckoutModels(models)
    setModelsLoaded(true)
    setLoadingModels(false)
  }

  async function handleSaveModel() {
    if (!modelForm.name.trim()) return
    setSavingModel(true)

    const isFirst = checkoutModels.length === 0
    const setAsDefault = modelForm.is_default || isFirst

    if (setAsDefault) {
      await supabase.from('product_checkouts').update({ is_default: false }).eq('product_id', id)
    }

    const { data: newModel } = await supabase
      .from('product_checkouts')
      .insert({ product_id: id, name: modelForm.name.trim(), is_default: setAsDefault })
      .select()
      .single()

    // Link selected offers via junction table
    if (newModel && modelForm.offer_ids.length > 0) {
      await supabase.from('checkout_offer_variants').insert(
        modelForm.offer_ids.map(oid => ({ checkout_id: newModel.id, offer_id: oid }))
      )
    }

    setShowModelPanel(false)
    setModelForm({ name: '', is_default: false, offer_ids: [] })
    setModelsLoaded(false)
    await fetchCheckoutModels()
    setSavingModel(false)
  }

  async function handleDeleteModel(modelId) {
    setDeletingModelId(modelId)
    setModelMenuId(null)
    const wasDefault = checkoutModels.find(m => m.id === modelId)?.is_default
    await supabase.from('product_checkouts').delete().eq('id', modelId)
    const remaining = checkoutModels.filter(m => m.id !== modelId)
    if (wasDefault && remaining.length > 0) {
      await supabase.from('product_checkouts').update({ is_default: true }).eq('id', remaining[0].id)
      setCheckoutModels(remaining.map((m, i) => i === 0 ? { ...m, is_default: true } : m))
    } else {
      setCheckoutModels(remaining)
    }
    setDeletingModelId(null)
  }

  async function handleSetDefault(modelId) {
    await supabase.from('product_checkouts').update({ is_default: false }).eq('product_id', id)
    await supabase.from('product_checkouts').update({ is_default: true }).eq('id', modelId)
    setCheckoutModels(prev => prev.map(m => ({ ...m, is_default: m.id === modelId })))
    setModelMenuId(null)
  }

  async function handleDuplicateModel(model) {
    setModelMenuId(null)
    const { data: dup } = await supabase
      .from('product_checkouts')
      .insert({ product_id: id, name: `${model.name} (cópia)`, is_default: false })
      .select()
      .single()

    // Link the same offers to the duplicate checkout via junction table
    if (dup && model.product_offers?.length > 0) {
      await supabase.from('checkout_offer_variants').insert(
        model.product_offers.map(o => ({ checkout_id: dup.id, offer_id: o.id }))
      )
    }

    setModelsLoaded(false)
    await fetchCheckoutModels()
  }

  function handleOpenSettings(model) {
    setModelMenuId(null)
    setSettingsForm({
      name:      model.name,
      is_default: model.is_default,
      offer_ids: (model.product_offers || []).map(o => o.id),
    })
    setShowModelSettings(model)
  }

  async function handleSaveSettings(force = false) {
    const model       = showModelSettings
    const originalIds = (model.product_offers || []).map(o => o.id)
    const toUnlink    = originalIds.filter(oid => !settingsForm.offer_ids.includes(oid))

    // Ask confirmation before unlinking offers
    if (!force && toUnlink.length > 0) {
      setConfirmUnlink(true)
      return
    }

    setSavingSettings(true)
    setConfirmUnlink(false)

    // 1. Update checkout record
    if (settingsForm.is_default && !model.is_default) {
      await supabase.from('product_checkouts').update({ is_default: false }).eq('product_id', id)
    }
    await supabase
      .from('product_checkouts')
      .update({ name: settingsForm.name.trim(), is_default: settingsForm.is_default })
      .eq('id', model.id)

    // 2. Link newly checked offers
    const toLink = settingsForm.offer_ids.filter(oid => !originalIds.includes(oid))
    if (toLink.length > 0) {
      await supabase.from('checkout_offer_variants').insert(
        toLink.map(oid => ({ checkout_id: model.id, offer_id: oid }))
      )
    }

    // 3. Unlink unchecked offers
    if (toUnlink.length > 0) {
      await supabase.from('checkout_offer_variants')
        .delete()
        .eq('checkout_id', model.id)
        .in('offer_id', toUnlink)
    }

    setShowModelSettings(null)
    setModelsLoaded(false)
    setOffersLoaded(false)
    await fetchCheckoutModels()
    await fetchOffers()
    setSavingSettings(false)
  }

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
      // Sync main offer price when product price changes
      const mainOffer = offers.find(o => o.is_main)
      if (mainOffer && mainOffer.price !== price) {
        await supabase.from('product_offers').update({ price }).eq('id', mainOffer.id)
        setOffers(prev => prev.map(o => o.is_main ? { ...o, price } : o))
      }
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
          className="p-2 text-zinc-500 hover:text-th-text-2 hover:bg-th-raised rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-th-text leading-tight truncate max-w-sm">
            {form.name || 'Produto'}
          </h1>
          <p className="text-th-text-4 text-xs mt-0.5">Editar produto</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800/50 mb-8">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              tab === t.id
                ? 'text-th-text'
                : 'text-zinc-500 hover:text-th-text-2'
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Skeleton de transição entre tabs ── */}
      {tabSwitching && tab === 'geral'    && <GeralSkeleton />}
      {tabSwitching && tab === 'upsell'   && <UpsellSkeleton />}
      {tabSwitching && tab === 'cupons'   && <CuponsSkeleton />}
      {tabSwitching && tab === 'checkout' && <CheckoutTableSkeleton />}
      {tabSwitching && tab === 'links'    && <LinksTableSkeleton />}
      {tabSwitching && tab === 'bumps'    && <BumpsSkeleton />}

      {/* ── Tab: Upsell / Downsell ── */}
      {!tabSwitching && tab === 'upsell' && (
        <div className="max-w-2xl space-y-4">

          {/* ── Redirecionamento ── */}
          <div className="bg-th-surface border border-zinc-200 dark:border-zinc-800/50 rounded-xl p-5 space-y-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Redirecionamento pós-compra</p>

            {/* Toggle: página de obrigado personalizada */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-th-text-2">Esse produto tem uma página de obrigado personalizada ou upsell</p>
                <p className="text-xs text-zinc-500 mt-0.5">Redireciona o comprador após o pagamento ser aprovado.</p>
              </div>
              <button
                type="button"
                onClick={() => setU('has_custom_redirect', !upsell.has_custom_redirect)}
                aria-checked={upsell.has_custom_redirect}
                role="switch"
                className={`relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  upsell.has_custom_redirect ? 'bg-emerald-600' : 'bg-zinc-600'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${upsell.has_custom_redirect ? 'left-5' : 'left-1'}`} />
              </button>
            </div>

            {/* Conteúdo expandido quando toggle ativo */}
            {upsell.has_custom_redirect && (
              <div className="space-y-3 pt-1 border-t border-zinc-200 dark:border-zinc-800/50">
                {/* Input de URL */}
                <div>
                  <label className="label">Cartão ou Pix aprovado</label>
                  <div className="relative">
                    <ExternalLink className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="url"
                      value={upsell.redirect_url}
                      onChange={e => setU('redirect_url', e.target.value)}
                      placeholder="https://"
                      className="input-field pl-10"
                    />
                  </div>
                </div>
                {/* Gerador de Upsell */}
                <div className="flex items-center justify-between gap-4 bg-th-raised/60 border border-zinc-200 dark:border-zinc-700/40 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-th-text-2">Gerador de Upsell</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Crie funis de upsell e downsell com redirecionamento automático.</p>
                  </div>
                  <button
                    type="button"
                    onClick={openGenerator}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Criar funil
                  </button>
                </div>
              </div>
            )}

            {/* Toggle: ignorar falhas de order bumps */}
            <div className="flex items-start justify-between gap-4 pt-1 border-t border-zinc-200 dark:border-zinc-800/50">
              <div className="min-w-0">
                <p className="text-sm font-medium text-th-text-2">Redirecionar upsell ignorando falhas nos pagamentos de order bumps</p>
                <p className="text-xs text-zinc-500 mt-0.5">O comprador será redirecionado mesmo se o order bump falhar.</p>
              </div>
              <button
                type="button"
                onClick={() => setU('ignore_bump_failures', !upsell.ignore_bump_failures)}
                aria-checked={upsell.ignore_bump_failures}
                role="switch"
                className={`relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  upsell.ignore_bump_failures ? 'bg-emerald-600' : 'bg-zinc-600'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${upsell.ignore_bump_failures ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
          </div>

          {/* ── E-mail de Confirmação ── */}
          <div className="bg-th-surface border border-zinc-200 dark:border-zinc-800/50 rounded-xl p-5 space-y-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">E-mail de confirmação</p>

            {/* Toggle: enviar e-mail */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-th-text-2">Esse produto vai enviar um e-mail de confirmação</p>
                <p className="text-xs text-zinc-500 mt-0.5">Notifica o comprador automaticamente após a compra.</p>
              </div>
              <button
                type="button"
                onClick={() => setU('send_confirmation_email', !upsell.send_confirmation_email)}
                aria-checked={upsell.send_confirmation_email}
                role="switch"
                className={`relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  upsell.send_confirmation_email ? 'bg-emerald-600' : 'bg-zinc-600'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${upsell.send_confirmation_email ? 'left-5' : 'left-1'}`} />
              </button>
            </div>

            {/* Opções de timing — só visíveis quando toggle está ativo */}
            {upsell.send_confirmation_email && (
              <div className="space-y-4 pt-1 border-t border-zinc-200 dark:border-zinc-800/50">

                {/* Radio buttons */}
                <div className="space-y-2.5">
                  {[
                    { value: 'immediate',    label: 'Enviar imediatamente após o pagamento' },
                    { value: 'after_upsell', label: 'Enviar após concluir as ofertas de upsell' },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                      <div
                        onClick={() => setU('email_timing', opt.value)}
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          upsell.email_timing === opt.value
                            ? 'border-emerald-500 bg-emerald-500'
                            : 'border-zinc-400 bg-transparent group-hover:border-emerald-400'
                        }`}
                      >
                        {upsell.email_timing === opt.value && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span
                        onClick={() => setU('email_timing', opt.value)}
                        className="text-sm text-th-text-2"
                      >
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Contador de minutos */}
                {upsell.email_timing === 'after_upsell' && (
                  <div className="space-y-2">
                    <label className="label">Quantos minutos deseja atrasar o envio?</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setU('email_delay_minutes', Math.max(1, upsell.email_delay_minutes - 1))}
                        className="w-9 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors font-bold text-lg shrink-0"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-sm font-bold text-th-text tabular-nums">
                        {upsell.email_delay_minutes}
                      </span>
                      <button
                        type="button"
                        onClick={() => setU('email_delay_minutes', Math.min(60, upsell.email_delay_minutes + 1))}
                        className="w-9 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors font-bold text-lg shrink-0"
                      >
                        +
                      </button>
                      <span className="text-sm text-zinc-500">Minutos</span>
                    </div>

                    {/* Aviso */}
                    <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mt-1">
                      <span className="text-amber-400 text-base shrink-0 mt-0.5">⚠️</span>
                      <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                        O e-mail será enviado após o tempo definido, permitindo que o cliente finalize as ofertas de upsell.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Botão Salvar ── */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveUpsell}
              disabled={savingUpsell}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              {savingUpsell
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : upsellSaved
                  ? '✓ Salvo!'
                  : 'Salvar alterações'
              }
            </button>
          </div>

        </div>
      )}

      {/* ── Tab: Geral ── */}
      {!tabSwitching && tab === 'geral' && (
        <form onSubmit={handleSave} className="max-w-xl space-y-5">

          {/* ── Imagem do produto ── */}
          <div>
            <label className="label">
              Imagem do produto <span className="text-th-text-4">(opcional)</span>
            </label>
            <div className="flex items-start gap-4">
              {/* Preview / Upload zone */}
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-dashed border-zinc-300 dark:border-zinc-700/50 bg-th-raised/40 flex items-center justify-center shrink-0 hover:border-emerald-500 hover:bg-th-raised transition-all group disabled:pointer-events-none"
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
                  <ImagePlus className="w-6 h-6 text-th-text-4 group-hover:text-emerald-400 transition-colors" />
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

                <p className="text-xs text-th-text-4">JPG, PNG ou WEBP · máx. 2 MB</p>
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
            <label className="label">Descrição <span className="text-th-text-4">(opcional)</span></label>
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
            <label className="label">Link de entrega <span className="text-th-text-4">(opcional)</span></label>
            <input
              type="url"
              value={form.delivery_url}
              onChange={e => setForm(f => ({ ...f, delivery_url: e.target.value }))}
              placeholder="https://drive.google.com/..."
              className="input-field"
            />
          </div>

          {/* Toggle: cupom */}
          <div className="flex items-center justify-between bg-th-raised/60 border border-zinc-300/60 dark:border-zinc-700/30 rounded-xl px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-th-text-2">Cupom de desconto</p>
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

          {/* Garantia */}
          <div>
            <label className="label">Garantia</label>
            <div className="relative">
              <select
                value={guarantee}
                onChange={e => handleGuaranteeChange(e.target.value)}
                disabled={savingGuarantee}
                className="input-field appearance-none pr-10 disabled:opacity-60"
              >
                {GUARANTEE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-th-text-3">
                {savingGuarantee
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <ChevronRight className="w-4 h-4 rotate-90" />
                }
              </div>
            </div>
          </div>

          {/* Ofertas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-th-text-2">Ofertas</p>
                <p className="text-xs text-zinc-500 mt-0.5">Configure até 10 variações de preço para este produto.</p>
              </div>
            </div>
            {loadingOffers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
              </div>
            ) : (
              <>
                <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl overflow-hidden mb-3">
                  <div className="grid grid-cols-[1fr_120px_100px_80px] gap-3 px-5 py-3 border-b border-zinc-200 dark:border-zinc-800/50 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    <span>Nome</span>
                    <span>Preço</span>
                    <span>Tipo</span>
                    <span className="text-right">Ações</span>
                  </div>
                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
                    {offers.map(offer => (
                      <li key={offer.id} className="grid grid-cols-[1fr_120px_100px_80px] gap-3 items-center px-5 py-3.5">
                        <div>
                          <p className="text-sm font-medium text-th-text-2 truncate">{offer.name}</p>
                          {offer.type === 'recurring' && offer.interval_type && (
                            <p className="text-xs text-zinc-500 mt-0.5">
                              A cada {offer.interval_count} {
                                { day: 'dia', week: 'semana', month: 'mês', year: 'ano' }[offer.interval_type]
                              }{offer.interval_count > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <p className="text-sm font-medium text-emerald-400">
                          {Number(offer.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <span className="text-xs text-th-text-3 bg-th-raised border border-zinc-300 dark:border-zinc-700/50 rounded-full px-2.5 py-1 w-fit">
                          {offer.type === 'one_time' ? 'Único' : 'Recorrente'}
                        </span>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditOffer(offer)}
                            className="p-2 text-zinc-500 hover:text-th-text-2 hover:bg-th-raised rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Settings2 className="w-4 h-4" />
                          </button>
                          {!offer.is_main && (
                            <button
                              type="button"
                              onClick={() => handleDeleteOffer(offer.id)}
                              disabled={deletingOfferId === offer.id}
                              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-40"
                              title="Excluir"
                            >
                              {deletingOfferId === offer.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Trash2 className="w-4 h-4" />
                              }
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={openAddOffer}
                    disabled={offers.length >= 10}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar oferta
                  </button>
                  <span className="text-sm text-zinc-500">{offers.length} / 10</span>
                </div>
              </>
            )}
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
              className="px-5 py-2.5 text-sm font-medium text-th-text-3 bg-th-raised hover:bg-th-muted rounded-lg transition-colors"
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

      {/* ── Offer Modal ── */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/50">
              <div className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-emerald-400" />
                <h2 className="font-semibold text-th-text">
                  {editingOffer ? 'Editar Oferta' : 'Nova Oferta'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowOfferModal(false)}
                className="text-zinc-500 hover:text-th-text-2 p-1.5 rounded-lg hover:bg-th-raised transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveOffer} className="p-6 space-y-4">

              {/* Nome */}
              <div>
                <label className="label">Nome</label>
                <input
                  type="text"
                  value={offerForm.name}
                  onChange={e => setOfferForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Plano Básico"
                  className="input-field"
                  autoFocus
                />
              </div>

              {/* Preço */}
              <div>
                <label className="label">Preço</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-medium">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={offerForm.price}
                    onChange={e => setOfferForm(f => ({ ...f, price: formatCurrency(e.target.value) }))}
                    placeholder="0,00"
                    className="input-field pl-10"
                  />
                </div>
              </div>

              {/* Tipo */}
              <div>
                <label className="label">Tipo</label>
                <select
                  value={offerForm.type}
                  onChange={e => setOfferForm(f => ({ ...f, type: e.target.value }))}
                  className="input-field appearance-none"
                >
                  <option value="one_time">Pagamento Único</option>
                  <option value="recurring">Recorrente</option>
                </select>
              </div>

              {/* Intervalo (só para recorrente) */}
              {offerForm.type === 'recurring' && (
                <>
                  <div>
                    <label className="label">Tipo de Intervalo</label>
                    <select
                      value={offerForm.interval_type}
                      onChange={e => setOfferForm(f => ({ ...f, interval_type: e.target.value }))}
                      className="input-field appearance-none"
                    >
                      <option value="day">Dia</option>
                      <option value="week">Semana</option>
                      <option value="month">Mês</option>
                      <option value="year">Ano</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Quantidade do intervalo</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={offerForm.interval_count}
                      onChange={e => setOfferForm(f => ({ ...f, interval_count: e.target.value.replace(/\D/g, '') }))}
                      placeholder="1"
                      className="input-field"
                    />
                  </div>
                </>
              )}

              {/* Error */}
              {offerFormError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-400">{offerFormError}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowOfferModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-th-text-3 bg-th-raised hover:bg-th-muted rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingOffer}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                >
                  {savingOffer
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                    : 'Salvar'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Tab: Checkout ── */}
      {!tabSwitching && tab === 'checkout' && (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-th-text-2">Modelos de Checkout</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Crie diferentes versões de checkout para este produto.</p>
            </div>
            <button
              type="button"
              onClick={() => { setModelForm({ name: '', is_default: false, offer_ids: [] }); setShowModelPanel(true) }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-lg transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              Adicionar Checkout
            </button>
          </div>

          {(!modelsLoaded || loadingModels) ? (
            <CheckoutTableSkeleton />
          ) : (
            <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl">
              {/* Table header */}
              <div className="flex items-center gap-6 px-8 py-3 border-b border-zinc-200 dark:border-zinc-800/50 text-xs font-medium text-zinc-500 uppercase tracking-wider rounded-t-xl">
                <span className="w-1/3 shrink-0">Nome</span>
                <span className="flex-1">Ofertas vinculadas</span>
                <span className="w-8 shrink-0" />
              </div>

              {/* Rows */}
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
                {checkoutModels.map(model => {
                  const modelOffers = model.product_offers || []
                  const isDeleting  = deletingModelId === model.id

                  return (
                    <li key={model.id} className="relative flex items-center gap-6 px-8 py-5">
                      {/* Nome */}
                      <div className="w-1/3 shrink-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-th-text-2">{model.name}</p>
                          {model.is_default && (
                            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                              Padrão
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ofertas */}
                      <div className="flex-1 flex flex-wrap gap-3">
                        {modelOffers.length > 0 ? modelOffers.map(o => (
                          <span
                            key={o.id}
                            className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-medium bg-th-raised border border-zinc-300 dark:border-zinc-700/50 rounded-full px-3.5 py-1.5"
                          >
                            <span className="text-th-text-2">{o.is_main ? 'Oferta Principal' : o.name}</span>
                            <span className="w-px h-3 bg-zinc-600" />
                            <span className="text-emerald-400">{Number(o.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </span>
                        )) : (
                          <span className="text-xs text-th-text-4 italic">Nenhuma oferta vinculada</span>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="w-8 shrink-0 flex justify-end">
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setModelMenuId(modelMenuId === model.id ? null : model.id)}
                            className="p-2 text-zinc-500 hover:text-th-text-2 hover:bg-th-raised rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        )}

                        {modelMenuId === model.id && (
                          <>
                            <div className="fixed inset-0 z-[90]" onClick={() => setModelMenuId(null)} />
                            <div className="absolute top-full right-0 z-[100] mt-2 bg-th-bg border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-2xl shadow-2xl overflow-hidden w-52">

                              {/* Personalizar */}
                              <button
                                type="button"
                                onClick={() => { navigate(`/products/${id}/checkout-editor/${model.id}`); setModelMenuId(null) }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-th-text-2 hover:bg-th-raised/80 transition-colors"
                              >
                                <Paintbrush className="w-4 h-4 text-th-text-3 shrink-0" />
                                Personalizar
                              </button>

                              {/* Configurações */}
                              <button
                                type="button"
                                onClick={() => handleOpenSettings(model)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-th-text-2 hover:bg-th-raised/80 transition-colors"
                              >
                                <Settings className="w-4 h-4 text-th-text-3 shrink-0" />
                                Configurações
                              </button>

                              {/* Duplicar */}
                              <button
                                type="button"
                                onClick={() => handleDuplicateModel(model)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-th-text-2 hover:bg-th-raised/80 transition-colors"
                              >
                                <Files className="w-4 h-4 text-th-text-3 shrink-0" />
                                Duplicar
                              </button>

                              {/* Deletar — só aparece se não for o único */}
                              {checkoutModels.length > 1 && (
                                <>
                                  <div className="h-px bg-th-raised mx-3 my-1" />
                                  <button
                                    type="button"
                                    onClick={() => { setConfirmDeleteModelId(model.id); setModelMenuId(null) }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4 shrink-0" />
                                    Deletar
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Links ── */}
      {!tabSwitching && tab === 'links' && (() => {
        const linksReady = offersLoaded && modelsLoaded
        // Rows derivados da junction table: cada checkout × suas ofertas vinculadas
        const rows = checkoutModels.flatMap(checkout =>
          (checkout.product_offers || []).map(offer => ({ offer, checkout }))
        )

        const handleCopyLink = async (rowId, url) => {
          await navigator.clipboard.writeText(url)
          setCopiedLinkId(rowId)
          setTimeout(() => setCopiedLinkId(null), 2500)
        }

        return (
          <div>
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-th-text-2">Links de Venda</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Cada link direciona ao checkout com a oferta e modelo pré-selecionados.
              </p>
            </div>

            {!linksReady ? (
              <LinksTableSkeleton />
            ) : rows.length === 0 ? (
              <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl p-12 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 bg-th-raised rounded-2xl flex items-center justify-center">
                  <ExternalLink className="w-6 h-6 text-th-text-4" />
                </div>
                <p className="text-sm font-medium text-th-text-3">Nenhum link disponível</p>
                <p className="text-xs text-th-text-4 max-w-xs">
                  Crie ofertas e vincule-as a um checkout para gerar os links de venda.
                </p>
              </div>
            ) : (() => {
              const BASE = import.meta.env.VITE_APP_URL || window.location.origin
              return (
                <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] gap-6 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800/50 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    <span>Oferta</span>
                    <span>Checkout</span>
                    <span>Link de venda</span>
                  </div>

                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
                    {rows.map(({ offer, checkout }) => {
                      const url       = `${BASE}/checkout/${id}?off=${offer.id}&chk=${checkout.id}`
                      const rowId     = `${offer.id}-${checkout.id}`
                      const wasCopied = copiedLinkId === rowId
                      // Versão curta: domínio + /checkout/ + primeiros 6 chars do productId
                      const shortUrl  = `${BASE.replace(/https?:\/\//, '')}/checkout/${id.slice(0, 6)}…?off=${offer.id.slice(0, 4)}…`

                      return (
                        <li key={rowId} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] gap-6 items-center px-6 py-4">

                          {/* Oferta */}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-th-text-2 truncate">
                              {offer.is_main ? 'Oferta Principal' : offer.name}
                            </p>
                            <p className="text-xs text-emerald-400 mt-0.5">
                              {Number(offer.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>

                          {/* Checkout */}
                          <div className="min-w-0 flex items-center gap-2">
                            <p className="text-sm text-th-text-2 truncate">{checkout.name}</p>
                            {checkout.is_default && (
                              <span className="shrink-0 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                                Padrão
                              </span>
                            )}
                          </div>

                          {/* Link integrado com botão copiar */}
                          <button
                            type="button"
                            onClick={() => handleCopyLink(rowId, url)}
                            title={wasCopied ? 'Copiado!' : url}
                            className={`group w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors text-left ${
                              wasCopied
                                ? 'bg-emerald-500/5 border-emerald-500/30'
                                : 'bg-th-raised/50 border-zinc-300/60 dark:border-zinc-700/30 hover:border-zinc-500 hover:bg-th-raised'
                            }`}
                          >
                            <span className="flex-1 min-w-0 text-xs font-mono text-th-text-3 truncate group-hover:text-th-text-2 transition-colors">
                              {shortUrl}
                            </span>
                            <span className={`shrink-0 transition-colors ${wasCopied ? 'text-emerald-400' : 'text-th-text-4 group-hover:text-th-text-2'}`}>
                              {wasCopied
                                ? <CheckCheck className="w-3.5 h-3.5" />
                                : <Copy className="w-3.5 h-3.5" />
                              }
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* ── Tab: Cupons ── */}
      {!tabSwitching && tab === 'cupons' && (
        <div className="max-w-xl">

          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-th-text-2">Cupons de desconto</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Crie códigos de desconto para seus clientes.</p>
            </div>
            <button
              type="button"
              onClick={() => { setCouponFormError(''); setShowCouponModal(true) }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-lg transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              Adicionar cupom
            </button>
          </div>

          {/* Warning if allow_coupons is disabled */}
          {!form.allow_coupons && (
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-5">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
              <p className="text-xs text-amber-300 leading-relaxed">
                O campo de cupom está desabilitado no checkout. Para que os clientes possam usar cupons, ative a opção <span className="font-semibold">Cupom de desconto</span> na aba <span className="font-semibold">Geral</span>.
              </p>
            </div>
          )}

          {/* Loading */}
          {loadingCoupons && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!loadingCoupons && coupons.length === 0 && (
            <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl p-10 flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 bg-th-raised rounded-xl flex items-center justify-center">
                <Tag className="w-5 h-5 text-zinc-500" />
              </div>
              <p className="text-sm font-medium text-th-text-3">Nenhum cupom cadastrado</p>
              <p className="text-xs text-th-text-4">Clique em "Adicionar cupom" para criar o primeiro.</p>
            </div>
          )}

          {/* Coupon list */}
          {!loadingCoupons && coupons.length > 0 && (
            <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800/50">
              {coupons.map(c => {
                const now = new Date()
                const expiryDate = c.expires_at ? new Date(c.expires_at) : null
                const startDate  = c.starts_at  ? new Date(c.starts_at)  : null
                const notStarted = startDate && startDate > now

                const fmtDate = (d) => d.toLocaleDateString('pt-BR')

                return (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3.5 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-th-text uppercase">{c.code}</span>
                        <span className="inline-flex items-center text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                          -{c.discount_percent}%
                        </span>
                      </div>
                      <div className="mt-0.5 space-y-0.5">
                        {expiryDate ? (
                          <p className="text-xs text-zinc-500">Válido até {fmtDate(expiryDate)}</p>
                        ) : (
                          <p className="text-xs text-th-text-4">Validade eterna</p>
                        )}
                        {notStarted && (
                          <p className="text-xs text-amber-400">Inicia em {fmtDate(startDate)}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCoupon(c.id)}
                      disabled={deletingCouponId === c.id}
                      className="p-1.5 text-th-text-4 hover:text-red-400 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {deletingCouponId === c.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />
                      }
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Order Bump ── */}
      {!tabSwitching && tab === 'bumps' && (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-th-text-2">Order Bumps</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Produtos adicionais exibidos no checkout antes da finalização.</p>
            </div>
            <button
              type="button"
              onClick={openAddBump}
              disabled={bumps.length >= 5}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>

          {loadingBumps ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
            </div>
          ) : bumps.length === 0 ? (
            <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl p-12 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 bg-th-raised rounded-2xl flex items-center justify-center">
                <Package className="w-6 h-6 text-th-text-4" />
              </div>
              <p className="text-sm font-medium text-th-text-3">Nenhum bump adicionado</p>
              <p className="text-xs text-th-text-4 max-w-xs">
                Adicione produtos complementares para aumentar o ticket médio das suas vendas.
              </p>
              <button
                type="button"
                onClick={openAddBump}
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={bumps.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {bumps.map((bump, index) => (
                    <SortableBumpCard
                      key={bump.id}
                      bump={bump}
                      index={index}
                      onEdit={openEditBump}
                      onDelete={handleDeleteBump}
                      deletingId={deletingBumpId}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {bumps.length < 5 && (
                <p className="text-xs text-th-text-4 text-right">{bumps.length} / 5 bumps</p>
              )}
              {bumps.length >= 5 && (
                <p className="text-xs text-amber-400 text-right">Limite de 5 bumps atingido.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Configurações do Checkout ── */}
      {showModelSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-th-bg border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-emerald-400" />
                <h2 className="font-semibold text-th-text text-sm">Configurações do Checkout</h2>
              </div>
              <button
                type="button"
                onClick={() => { setShowModelSettings(null); setConfirmUnlink(false) }}
                className="p-1.5 text-zinc-500 hover:text-th-text-2 hover:bg-th-raised rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Nome */}
              <div>
                <label className="label">Nome do checkout</label>
                <input
                  type="text"
                  value={settingsForm.name}
                  onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field"
                  autoFocus
                />
              </div>

              {/* Padrão toggle */}
              <div className="flex items-center justify-between bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-th-text-2">Checkout padrão</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Usado como modelo principal do produto.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsForm(f => ({ ...f, is_default: !f.is_default }))}
                  role="switch"
                  aria-checked={settingsForm.is_default}
                  className={`relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 ml-4 focus:outline-none ${settingsForm.is_default ? 'bg-emerald-600' : 'bg-zinc-600'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${settingsForm.is_default ? 'left-5' : 'left-1'}`} />
                </button>
              </div>

              {/* Lista de ofertas */}
              <div>
                <p className="label mb-2">Ofertas vinculadas</p>
                <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl overflow-hidden">
                  {offers.length === 0 ? (
                    <p className="text-xs text-th-text-4 text-center py-6">Nenhuma oferta cadastrada.</p>
                  ) : (
                    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
                      {offers.map(offer => {
                        const checked = settingsForm.offer_ids.includes(offer.id)
                        return (
                          <li
                            key={offer.id}
                            onClick={() => setSettingsForm(f => ({
                              ...f,
                              offer_ids: checked
                                ? f.offer_ids.filter(oid => oid !== offer.id)
                                : [...f.offer_ids, offer.id],
                            }))}
                            className="flex items-center gap-4 px-4 py-3.5 cursor-pointer hover:bg-th-raised/50 transition-colors"
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-emerald-600 border-emerald-600' : 'border-zinc-600'}`}>
                              {checked && <CheckCheck className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-th-text-2 truncate">
                                {offer.is_main ? 'Oferta Principal' : offer.name}
                              </p>
                            </div>
                            <p className="text-sm font-medium text-emerald-400 shrink-0">
                              {Number(offer.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {/* Alerta de desvínculo */}
              {confirmUnlink && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-4 space-y-3">
                  <p className="text-xs text-amber-300 leading-relaxed">
                    <span className="font-semibold">Atenção:</span> ao remover uma oferta vinculada, o link de checkout associado a ela será desativado. Deseja continuar?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmUnlink(false)}
                      className="flex-1 py-2 text-xs font-medium text-th-text-3 bg-th-raised hover:bg-th-muted rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveSettings(true)}
                      className="flex-1 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors"
                    >
                      Sim, continuar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!confirmUnlink && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800/50 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModelSettings(null)}
                  className="px-4 py-2.5 text-sm font-medium text-th-text-3 bg-th-raised hover:bg-th-muted rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveSettings(false)}
                  disabled={savingSettings || !settingsForm.name.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
                >
                  {savingSettings
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                    : 'Salvar'
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirm Delete Checkout Modal ── */}
      {confirmDeleteModelId && (() => {
        const target = checkoutModels.find(m => m.id === confirmDeleteModelId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-th-bg border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-2xl shadow-2xl p-6">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center mb-4">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-sm font-semibold text-th-text mb-1">Deletar checkout</h3>
              <p className="text-xs text-zinc-500 leading-relaxed mb-6">
                Tem certeza que deseja deletar <span className="font-medium text-th-text-2">"{target?.name}"</span>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteModelId(null)}
                  className="flex-1 py-2.5 text-sm font-medium text-th-text-3 bg-th-raised hover:bg-th-muted rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deletingModelId === confirmDeleteModelId}
                  onClick={async () => {
                    await handleDeleteModel(confirmDeleteModelId)
                    setConfirmDeleteModelId(null)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl transition-colors"
                >
                  {deletingModelId === confirmDeleteModelId
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Deletando...</>
                    : 'Sim, deletar'
                  }
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Checkout Model Panel (slide-in from right) ── */}
      {showModelPanel && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setShowModelPanel(false)} />

          {/* Panel */}
          <div className="w-full max-w-sm bg-th-bg border-l border-zinc-200 dark:border-zinc-800/50 h-full overflow-y-auto flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-2 px-6 py-5 border-b border-zinc-200 dark:border-zinc-800/50">
              <ChevronRight className="w-4 h-4 text-emerald-400" />
              <h2 className="font-semibold text-th-text text-sm">Criar novo checkout</h2>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 space-y-5">
              {/* Name */}
              <input
                type="text"
                value={modelForm.name}
                onChange={e => setModelForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome"
                className="input-field"
                autoFocus
              />

              {/* Toggle: definir como padrão */}
              <div className="flex items-center justify-between bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-th-text-2">Definir como padrão</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Torna este o checkout principal do produto.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={modelForm.is_default}
                  onClick={() => setModelForm(f => ({ ...f, is_default: !f.is_default }))}
                  className={`relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 ml-4 focus:outline-none ${
                    modelForm.is_default ? 'bg-emerald-600' : 'bg-zinc-600'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                    modelForm.is_default ? 'left-5' : 'left-1'
                  }`} />
                </button>
              </div>

              {/* Offers list */}
              {offers.length > 0 && (
                <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[32px_1fr_90px] gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/50 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    <span />
                    <span>Oferta</span>
                    <span className="text-right">Preço</span>
                  </div>
                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
                    {offers.map(offer => (
                      <li
                        key={offer.id}
                        className="grid grid-cols-[32px_1fr_90px] gap-3 items-center px-4 py-3 cursor-pointer hover:bg-th-raised/40 transition-colors"
                        onClick={() => setModelForm(f => ({
                          ...f,
                          offer_ids: f.offer_ids.includes(offer.id)
                            ? f.offer_ids.filter(oid => oid !== offer.id)
                            : [...f.offer_ids, offer.id],
                        }))}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          modelForm.offer_ids.includes(offer.id)
                            ? 'bg-emerald-600 border-emerald-600'
                            : 'border-zinc-600 bg-transparent'
                        }`}>
                          {modelForm.offer_ids.includes(offer.id) && (
                            <CheckCheck className="w-2.5 h-2.5 text-white" />
                          )}
                        </div>
                        <span className="text-sm text-th-text-2 truncate">{offer.name}</span>
                        <span className="text-sm font-medium text-emerald-400 text-right">
                          {Number(offer.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800/50">
              <button
                type="button"
                onClick={() => setShowModelPanel(false)}
                className="px-4 py-2.5 text-sm font-medium text-th-text-3 bg-th-raised hover:bg-th-muted rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveModel}
                disabled={savingModel || !modelForm.name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {savingModel
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                  : 'Salvar'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Coupon Modal ── */}
      {showCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/60">
          <div className="bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-2xl w-full max-w-md shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-zinc-200 dark:border-zinc-800/50">
              <div className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-th-text">Adicionar Cupom</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCouponModal(false)}
                className="p-1.5 text-zinc-500 hover:text-th-text-2 hover:bg-th-raised rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-zinc-500">Adicione aqui os cupons para o seu produto.</p>

              {/* Code */}
              <div>
                <label className="block text-xs font-medium text-th-text-3 mb-1.5">Código do cupom</label>
                <input
                  type="text"
                  value={couponForm.code}
                  onChange={e => setCouponForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="DESCONTO10"
                  className="bg-th-raised/60 border border-zinc-300/60 dark:border-zinc-700/30 rounded-xl px-4 py-3 text-sm text-th-text-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 transition-all w-full"
                />
              </div>

              {/* Discount % */}
              <div>
                <label className="block text-xs font-medium text-th-text-3 mb-1.5">Desconto (%)</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={couponForm.discount_percent}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '')
                      if (val === '' || parseInt(val, 10) <= 100) {
                        setCouponForm(f => ({ ...f, discount_percent: val }))
                      }
                    }}
                    placeholder="10"
                    className="bg-th-raised/60 border border-zinc-300/60 dark:border-zinc-700/30 rounded-xl px-4 py-3 pr-10 text-sm text-th-text-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 transition-all w-full"
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                </div>
              </div>

              {/* Start date */}
              <div>
                <label className="block text-xs font-medium text-th-text-3 mb-1.5">Data de início do cupom <span className="text-th-text-4">(opcional)</span></label>
                <input
                  type="date"
                  value={couponForm.starts_at}
                  onChange={e => setCouponForm(f => ({ ...f, starts_at: e.target.value }))}
                  className="bg-th-raised/60 border border-zinc-300/60 dark:border-zinc-700/30 rounded-xl px-4 py-3 text-sm text-th-text-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 transition-all w-full"
                />
              </div>

              {/* Expiry date */}
              <div>
                <label className="block text-xs font-medium text-th-text-3 mb-1.5">Data de expiração do cupom <span className="text-th-text-4">(opcional)</span></label>
                <input
                  type="date"
                  value={couponForm.expires_at}
                  onChange={e => setCouponForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="bg-th-raised/60 border border-zinc-300/60 dark:border-zinc-700/30 rounded-xl px-4 py-3 text-sm text-th-text-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 transition-all w-full"
                />
                <p className="text-xs text-th-text-4 mt-1">Deixe sem valor para a validade ser eterna</p>
              </div>

              {/* Toggle: apply to bumps */}
              <div className="flex items-center justify-between bg-th-raised/60 border border-zinc-300/60 dark:border-zinc-700/30 rounded-xl px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-th-text-2">Aplicar desconto aos Order Bumps</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCouponForm(f => ({ ...f, apply_to_bumps: !f.apply_to_bumps }))}
                  aria-checked={couponForm.apply_to_bumps}
                  role="switch"
                  className={`relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 ml-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    couponForm.apply_to_bumps ? 'bg-emerald-600' : 'bg-zinc-600'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                    couponForm.apply_to_bumps ? 'left-5' : 'left-1'
                  }`} />
                </button>
              </div>

              {/* Error */}
              {couponFormError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-400">{couponFormError}</p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-1">
              <button
                type="button"
                onClick={() => setShowCouponModal(false)}
                className="px-4 py-2.5 text-sm font-medium text-th-text-3 bg-th-raised hover:bg-th-muted rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddCoupon}
                disabled={savingCoupon}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {savingCoupon
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Adicionando...</>
                  : 'Adicionar'
                }
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Order Bump Modal ── */}
      {showBumpModal && (() => {
        // Resolve bump offer price for preview
        const selectedOffer = bumpOffers.find(o => o.id === bumpForm.bump_offer_id)
          ?? bumpOffers.find(o => o.is_main)
          ?? bumpOffers[0]
        const bumpPrice  = selectedOffer?.price ?? null
        const origPrice  = bumpForm.apply_discount ? parseCurrency(bumpForm.original_price) : null
        const discountPct = (bumpPrice && origPrice && origPrice > bumpPrice)
          ? Math.round((1 - bumpPrice / origPrice) * 100)
          : null

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-th-surface border border-zinc-200 dark:border-zinc-700/50 dark:border-zinc-800/50 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/50 shrink-0">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  <h2 className="font-semibold text-th-text text-sm">
                    {editingBump ? 'Editar Order Bump' : 'Novo Order Bump'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBumpModal(false)}
                  className="p-1.5 text-zinc-500 hover:text-th-text-2 hover:bg-th-raised rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleSaveBump} className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Produto */}
                <div>
                  <label className="label">Produto</label>
                  <div className="relative">
                    <select
                      value={bumpForm.bump_product_id}
                      onChange={e => handleBumpProductChange(e.target.value)}
                      className="input-field appearance-none pr-10"
                    >
                      <option value="">Selecione um produto...</option>
                      {bumpProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-th-text-3">
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </div>
                  </div>
                </div>

                {/* Oferta */}
                <div>
                  <label className="label">Oferta <span className="text-th-text-4">(opcional)</span></label>
                  <div className="relative">
                    <select
                      value={bumpForm.bump_offer_id}
                      onChange={e => setBumpForm(f => ({ ...f, bump_offer_id: e.target.value }))}
                      disabled={!bumpForm.bump_product_id || loadingBumpOffers}
                      className="input-field appearance-none pr-10 disabled:opacity-50"
                    >
                      <option value="">
                        {loadingBumpOffers ? 'Carregando...' : 'Oferta principal'}
                      </option>
                      {bumpOffers.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.is_main ? 'Oferta Principal' : o.name} — {Number(o.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-th-text-3">
                      {loadingBumpOffers
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <ChevronRight className="w-4 h-4 rotate-90" />
                      }
                    </div>
                  </div>
                </div>

                {/* Call to Action */}
                <div>
                  <label className="label">Call to Action</label>
                  <input
                    type="text"
                    value={bumpForm.cta}
                    onChange={e => setBumpForm(f => ({ ...f, cta: e.target.value }))}
                    placeholder="Sim! Quero adicionar"
                    className="input-field"
                  />
                </div>

                {/* Título */}
                <div>
                  <label className="label">Título</label>
                  <input
                    type="text"
                    value={bumpForm.title}
                    onChange={e => setBumpForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Ex: Adicione também o módulo avançado"
                    className="input-field"
                    autoFocus
                  />
                </div>

                {/* Descrição */}
                <div>
                  <label className="label">Descrição <span className="text-th-text-4">(opcional)</span></label>
                  <input
                    type="text"
                    value={bumpForm.description}
                    onChange={e => setBumpForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descreva brevemente o que o cliente está recebendo..."
                    className="input-field"
                  />
                </div>

                {/* Toggle: aplicar desconto */}
                <div className="flex items-center justify-between bg-th-raised/60 border border-zinc-300/60 dark:border-zinc-700/30 rounded-xl px-4 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-th-text-2">Aplicar desconto</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Exibe preço original riscado e badge de desconto.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bumpForm.apply_discount}
                    onClick={() => setBumpForm(f => ({ ...f, apply_discount: !f.apply_discount }))}
                    className={`relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 ml-4 focus:outline-none ${
                      bumpForm.apply_discount ? 'bg-emerald-600' : 'bg-zinc-600'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                      bumpForm.apply_discount ? 'left-5' : 'left-1'
                    }`} />
                  </button>
                </div>

                {/* Preço de origem */}
                {bumpForm.apply_discount && (
                  <div>
                    <label className="label">Preço de origem (R$)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-medium">R$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={bumpForm.original_price}
                        onChange={e => setBumpForm(f => ({ ...f, original_price: formatCurrency(e.target.value) }))}
                        placeholder="0,00"
                        className="input-field pl-10"
                      />
                    </div>
                    {discountPct !== null && discountPct > 0 && (
                      <p className="text-xs text-emerald-400 mt-1.5">
                        Desconto de <span className="font-semibold">{discountPct}%</span> será exibido no checkout.
                      </p>
                    )}
                  </div>
                )}

                {/* ── Preview ── */}
                <div>
                    <p className="label mb-2">Preview</p>
                    <div className="border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 rounded-2xl p-4 flex items-start gap-4">
                      {/* Checkbox */}
                      <div className="w-5 h-5 rounded border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCheck className="w-3 h-3 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {discountPct !== null && discountPct > 0 && (
                          <span className="inline-block text-xs font-semibold text-white bg-emerald-600 rounded-full px-2.5 py-0.5 mb-2">
                            -{discountPct}% de desconto
                          </span>
                        )}
                        <p className="text-sm font-bold text-th-text leading-snug">{bumpForm.title}</p>
                        {bumpForm.description && (
                          <p className="text-xs text-th-text-3 mt-1 leading-relaxed">{bumpForm.description}</p>
                        )}

                        {/* Price row */}
                        {bumpPrice !== null && (
                          <div className="flex items-baseline gap-2 mt-2">
                            <span className="text-base font-bold text-emerald-400">
                              {Number(bumpPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            {origPrice > 0 && bumpForm.apply_discount && (
                              <span className="text-xs text-zinc-500 line-through">
                                {Number(origPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CTA button preview */}
                    <div className="mt-2 flex">
                      <div className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl opacity-90 pointer-events-none">
                        <CheckCheck className="w-4 h-4" />
                        {bumpForm.cta || 'Sim! Quero adicionar'}
                      </div>
                    </div>
                  </div>

                {/* Error */}
                {bumpFormError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                    <p className="text-sm text-red-400">{bumpFormError}</p>
                  </div>
                )}
              </form>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800/50 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBumpModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-th-text-3 bg-th-raised hover:bg-th-muted rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveBump}
                  disabled={savingBump}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
                >
                  {savingBump
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                    : 'Salvar'
                  }
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      {/* ══ Modal: Gerador de Upsell ══════════════════════════════════════════ */}
      {showGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700/50 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-white">Gerador de Upsell</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Configure o funil de vendas do seu produto</p>
              </div>
              <button
                onClick={() => setShowGenerator(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* ── Produto + Oferta + Tipo ── */}
              <div className="space-y-3">
                {/* Select: Produto */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Produto</label>
                  <select
                    value={genForm.product_id}
                    onChange={e => handleGenProductChange(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700/50 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60"
                  >
                    <option value="">Selecione um produto...</option>
                    {genProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Select: Oferta */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Oferta</label>
                  <select
                    value={genForm.offer_id}
                    onChange={e => setG('offer_id', e.target.value)}
                    disabled={!genForm.product_id || loadingGenOffers}
                    className="w-full bg-zinc-800 border border-zinc-700/50 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {loadingGenOffers ? 'Carregando...' : 'Selecione uma oferta...'}
                    </option>
                    {genOffers.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name} — {Number(o.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select: Tipo */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Tipo de Oferta</label>
                  <select
                    value={genForm.type}
                    onChange={e => setG('type', e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700/50 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60"
                  >
                    <option value="upsell">Upsell</option>
                    <option value="downsell">Downsell</option>
                  </select>
                </div>
              </div>

              {/* ── Ao Aceitar ── */}
              <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ao Aceitar</p>
                <select
                  value={genForm.accept_action}
                  onChange={e => setG('accept_action', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700/50 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="offer_another">Oferecer outra upsell</option>
                </select>
                {genForm.accept_action === 'offer_another' && (
                  <div className="relative">
                    <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    <input
                      type="url"
                      value={genForm.accept_url}
                      onChange={e => setG('accept_url', e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-zinc-800 border border-zinc-700/50 text-white text-sm rounded-lg pl-9 pr-3 py-2.5 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 transition-all"
                    />
                  </div>
                )}

                {/* Texto do botão aceitar */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={genForm.accept_text}
                    onChange={e => setG('accept_text', e.target.value)}
                    placeholder="Texto do botão aceitar"
                    className="flex-1 bg-zinc-800 border border-zinc-700/50 text-white text-sm rounded-lg px-3 py-2 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-zinc-700/50 shrink-0">
                    <input
                      type="color"
                      value={genForm.accept_color}
                      onChange={e => setG('accept_color', e.target.value)}
                      className="absolute -inset-1 w-14 h-14 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* ── Ao Rejeitar ── */}
              <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ao Rejeitar</p>
                <select
                  value={genForm.reject_action}
                  onChange={e => setG('reject_action', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700/50 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="offer_another">Oferecer outra downsell</option>
                </select>
                {genForm.reject_action === 'offer_another' && (
                  <div className="relative">
                    <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    <input
                      type="url"
                      value={genForm.reject_url}
                      onChange={e => setG('reject_url', e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-zinc-800 border border-zinc-700/50 text-white text-sm rounded-lg pl-9 pr-3 py-2.5 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60 transition-all"
                    />
                  </div>
                )}

                {/* Texto do link rejeitar */}
                <input
                  type="text"
                  value={genForm.reject_text}
                  onChange={e => setG('reject_text', e.target.value)}
                  placeholder="Texto do link rejeitar"
                  className="w-full bg-zinc-800 border border-zinc-700/50 text-white text-sm rounded-lg px-3 py-2 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              {/* ── Preview em tempo real ── */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-3">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Preview</p>
                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all pointer-events-none"
                    style={{ backgroundColor: genForm.accept_color, boxShadow: `0 8px 20px -4px ${genForm.accept_color}60` }}
                  >
                    {genForm.accept_text || 'Texto do botão aceitar'}
                  </button>
                  <button
                    type="button"
                    className="text-zinc-500 text-xs underline underline-offset-2 pointer-events-none"
                  >
                    {genForm.reject_text || 'Texto do link rejeitar'}
                  </button>
                </div>
              </div>


            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-700/50 shrink-0">
              <button
                type="button"
                onClick={() => setShowGenerator(false)}
                className="flex-1 py-2.5 text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSaveGenerator}
                disabled={savingGen || !genForm.product_id}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
              >
                {savingGen
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                  : 'Gerar Funil'
                }
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ══ Modal: Script Gerado com Sucesso ══════════════════════════════════ */}
      {showGenSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Script gerado com sucesso!</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Cole esse código na sua página de upsell</p>
                </div>
              </div>
              <button
                onClick={() => { setShowGenSuccess(false); setScriptCopied(false) }}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

              {/* Textarea com o script */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  Código do Widget
                </label>
                <textarea
                  readOnly
                  value={generatedScript}
                  rows={14}
                  className="w-full bg-zinc-950 border border-zinc-700/50 text-emerald-300 text-xs font-mono rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40 leading-relaxed"
                  onClick={e => e.target.select()}
                />
              </div>

              {/* Instrução */}
              <div className="flex items-start gap-2.5 bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-4 py-3">
                <span className="text-amber-400 text-sm shrink-0 mt-0.5">💡</span>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Cole esse script no <span className="text-zinc-200 font-medium">&lt;body&gt;</span> da sua página de upsell. O widget será renderizado automaticamente com as configurações que você definiu.
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-700/50 shrink-0">
              <button
                type="button"
                onClick={() => { setShowGenSuccess(false); setScriptCopied(false) }}
                className="flex-1 py-2.5 text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(generatedScript)
                  setScriptCopied(true)
                  setTimeout(() => setScriptCopied(false), 2500)
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
              >
                {scriptCopied
                  ? <><CheckCheck className="w-4 h-4" /> Copiado!</>
                  : <><Copy className="w-4 h-4" /> Copiar Código</>
                }
              </button>
            </div>

          </div>
        </div>
      )}

    </DashboardLayout>
  )
}
