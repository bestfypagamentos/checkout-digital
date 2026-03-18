import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null

  // Gera range de páginas visíveis (máx 5 ao redor da página atual)
  const range = []
  const delta = 2
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    range.push(i)
  }

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-th-line">
      <p className="text-xs text-th-text-3">
        Página {page} de {totalPages}
      </p>

      <div className="flex items-center gap-1">
        {/* Anterior */}
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-th-text-3 hover:text-th-text hover:bg-th-raised disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Primeira página se não está no range */}
        {range[0] > 1 && (
          <>
            <PageBtn n={1} current={page} onClick={onChange} />
            {range[0] > 2 && <span className="text-zinc-600 text-xs px-1">…</span>}
          </>
        )}

        {/* Páginas do range */}
        {range.map(n => (
          <PageBtn key={n} n={n} current={page} onClick={onChange} />
        ))}

        {/* Última página se não está no range */}
        {range[range.length - 1] < totalPages && (
          <>
            {range[range.length - 1] < totalPages - 1 && (
              <span className="text-zinc-600 text-xs px-1">…</span>
            )}
            <PageBtn n={totalPages} current={page} onClick={onChange} />
          </>
        )}

        {/* Próxima */}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg text-th-text-3 hover:text-th-text hover:bg-th-raised disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function PageBtn({ n, current, onClick }) {
  const isActive = n === current
  return (
    <button
      onClick={() => onClick(n)}
      className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-medium transition-colors ${
        isActive
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'text-th-text-3 hover:text-th-text hover:bg-th-raised'
      }`}
    >
      {n}
    </button>
  )
}
