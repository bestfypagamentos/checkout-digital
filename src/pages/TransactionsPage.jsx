import { useState, useEffect, useCallback } from 'react'
import { Loader2, ReceiptText, X, Copy, CheckCheck, QrCode } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import Pagination from '../components/Pagination'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const PAGE_SIZE = 15

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_MAP = {
  pending:  { label: 'Pendente',   class: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' },
  paid:     { label: 'Pago',       class: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' },
  failed:   { label: 'Falhou',     class: 'bg-red-400/10 text-red-400 border-red-400/20' },
  expired:  { label: 'Expirado',   class: 'bg-red-400/10 text-red-400 border-red-400/20' },
  refunded: { label: 'Reembolsado',class: 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20' },
}

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] ?? { label: status, class: 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20' }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${s.class}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  )
}

// ── Modal de detalhes ─────────────────────────────────────────────────────────
function DetailsModal({ sale, onClose }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!sale.qr_code_text) return
    await navigator.clipboard.writeText(sale.qr_code_text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="font-semibold text-zinc-100 text-sm">Detalhes da transação</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{formatDate(sale.created_at)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Info da venda */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-800/60 rounded-xl px-4 py-3">
              <p className="text-xs text-zinc-500 mb-1">Valor</p>
              <p className="text-sm font-semibold text-emerald-400">{formatBRL(sale.amount)}</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl px-4 py-3">
              <p className="text-xs text-zinc-500 mb-1">Status</p>
              <StatusBadge status={sale.status} />
            </div>
            <div className="bg-zinc-800/60 rounded-xl px-4 py-3 col-span-2">
              <p className="text-xs text-zinc-500 mb-1">Cliente</p>
              <p className="text-sm text-zinc-200 font-medium">{sale.customer_name}</p>
              <p className="text-xs text-zinc-500">{sale.customer_email}</p>
            </div>
          </div>

          {/* QR Code */}
          {sale.qr_code_url ? (
            <div className="text-center">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">QR Code PIX</p>
              <div className="bg-white rounded-2xl p-4 inline-block shadow-lg">
                <img
                  src={sale.qr_code_url}
                  alt="QR Code"
                  className="w-44 h-44"
                  onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4 text-zinc-700">
              <QrCode className="w-10 h-10" />
              <p className="text-xs">QR Code não disponível</p>
            </div>
          )}

          {/* Copia e cola */}
          {sale.qr_code_text && (
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">PIX Copia e Cola</p>
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 mb-3">
                <p className="text-xs text-zinc-400 font-mono break-all leading-relaxed select-all">
                  {sale.qr_code_text}
                </p>
              </div>
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                {copied
                  ? <><CheckCheck className="w-4 h-4" /> Copiado!</>
                  : <><Copy className="w-4 h-4" /> Copiar Código</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function TransactionsPage() {
  const { user } = useAuth()
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState(null)
  const [page, setPage] = useState(1)

  const fetchSales = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sales')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })

    setSales(data ?? [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { fetchSales() }, [fetchSales])

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Transações</h1>
          <p className="text-zinc-500 text-sm mt-1">Histórico de vendas geradas.</p>
        </div>
        {sales.length > 0 && (
          <span className="text-xs font-medium text-zinc-500 bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-full">
            {sales.length} {sales.length === 1 ? 'transação' : 'transações'}
          </span>
        )}
      </div>

      {/* Modal */}
      {selectedSale && (
        <DetailsModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      ) : sales.length === 0 ? (
        <EmptyState />
      ) : (() => {
        const totalPages = Math.ceil(sales.length / PAGE_SIZE)
        const paginated  = sales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        return (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[160px_1fr_120px_110px_80px] gap-4 px-6 py-3 border-b border-zinc-800 text-xs font-medium text-zinc-500 uppercase tracking-wider">
              <span>Data</span>
              <span>Cliente</span>
              <span>Valor</span>
              <span>Status</span>
              <span className="text-right">Ação</span>
            </div>

            <ul className="divide-y divide-zinc-800">
              {paginated.map(sale => (
                <li
                  key={sale.id}
                  className="grid md:grid-cols-[160px_1fr_120px_110px_80px] gap-4 items-center px-6 py-4 hover:bg-zinc-800/40 transition-colors"
                >
                  <p className="text-xs text-zinc-500 tabular-nums">{formatDate(sale.created_at)}</p>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">{sale.customer_name}</p>
                    <p className="text-xs text-zinc-500 truncate">{sale.customer_email}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-400">{formatBRL(sale.amount)}</p>
                  <StatusBadge status={sale.status} />
                  <div className="flex justify-end">
                    <button
                      onClick={() => setSelectedSale(sale)}
                      className="text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-400/20 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Ver
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination page={page} totalPages={totalPages} onChange={p => { setPage(p); window.scrollTo(0, 0) }} />
          </div>
        )
      })()}
    </DashboardLayout>
  )
}

function EmptyState() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-14 text-center">
      <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <ReceiptText className="w-8 h-8 text-zinc-600" />
      </div>
      <h3 className="text-zinc-300 font-medium mb-2">Nenhuma transação ainda</h3>
      <p className="text-zinc-600 text-sm max-w-xs mx-auto">
        Nenhuma transação gerada ainda. Divulgue seu link de checkout!
      </p>
    </div>
  )
}
