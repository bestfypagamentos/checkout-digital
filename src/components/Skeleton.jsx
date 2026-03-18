// ── Skeleton.jsx ──────────────────────────────────────────────────────────────
// Componente base de loading skeleton com animação de pulsação suave.
// Usa neutral-200/700 (primário) e neutral-300/600 (secundário) para garantir
// contraste suficiente mesmo quando animate-pulse reduz opacity para 50%.

// ── Bloco genérico ────────────────────────────────────────────────────────────
export function Skeleton({ className = '' }) {
  return <div className={`rounded-xl bg-neutral-200 dark:bg-neutral-700 animate-pulse ${className}`} />
}

// ── Dashboard: Card de Métrica ────────────────────────────────────────────────
export function SkeletonStatCard() {
  return (
    <div className="th-card bg-th-surface border border-th-line rounded-xl p-5">
      {/* Ícone */}
      <div className="w-10 h-10 rounded-xl bg-neutral-200 dark:bg-neutral-700 animate-pulse mb-4" />
      {/* Valor principal */}
      <div className="h-7 w-28 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse mb-2" />
      {/* Label */}
      <div className="h-3 w-20 rounded-md bg-neutral-300 dark:bg-neutral-600 animate-pulse" />
    </div>
  )
}

// ── Dashboard: Item da lista de produtos recentes ─────────────────────────────
export function SkeletonProductListItem() {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="h-4 w-2/3 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse mb-1.5" />
        <div className="h-3 w-20 rounded-md bg-neutral-300 dark:bg-neutral-600 animate-pulse" />
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        <div className="h-7 w-20 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        <div className="h-7 w-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      </div>
    </div>
  )
}

// ── Produtos: Linha de tabela ─────────────────────────────────────────────────
// Replica grid-cols-[1fr_2fr_120px_1fr_140px]
export function SkeletonProductRow() {
  return (
    <li className="grid md:grid-cols-[1fr_2fr_120px_1fr_140px] gap-4 items-center px-6 py-4">
      {/* Nome */}
      <div className="h-4 w-3/4 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      {/* Descrição */}
      <div className="h-4 w-2/3 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse hidden md:block" />
      {/* Preço */}
      <div className="h-4 w-14 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse hidden md:block" />
      {/* Link */}
      <div className="h-4 w-32 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse hidden md:block" />
      {/* Ações */}
      <div className="flex items-center justify-end gap-1">
        <div className="h-8 w-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        <div className="h-8 w-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        <div className="h-8 w-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      </div>
    </li>
  )
}

// ── Transações: Linha de tabela ───────────────────────────────────────────────
// Replica grid-cols-[160px_1fr_120px_110px_80px]
export function SkeletonTransactionRow() {
  return (
    <li className="grid md:grid-cols-[160px_1fr_120px_110px_80px] gap-4 items-center px-6 py-4">
      {/* Data */}
      <div className="h-3.5 w-28 rounded-md bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      {/* Cliente */}
      <div className="space-y-1.5">
        <div className="h-4 w-3/5 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        <div className="h-3 w-2/5 rounded-md bg-neutral-300 dark:bg-neutral-600 animate-pulse" />
      </div>
      {/* Valor */}
      <div className="h-4 w-16 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      {/* Status badge */}
      <div className="h-6 w-20 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      {/* Ação */}
      <div className="flex justify-end">
        <div className="h-7 w-10 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      </div>
    </li>
  )
}

// ── Checkout: Card do Produto (tema claro) ────────────────────────────────────
// Usa bg-gray-200 pois o checkout tem fundo bg-gray-50 / white
export function SkeletonCheckoutProduct() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
      <div className="flex items-center gap-4">
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-xl bg-gray-200 animate-pulse shrink-0" />
        {/* Info */}
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-4 w-3/4 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-3 w-1/2 rounded-md bg-gray-200 animate-pulse" />
          <div className="h-5 w-24 rounded-lg bg-gray-200 animate-pulse" />
        </div>
        {/* Controles de quantidade */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gray-200 animate-pulse" />
          <div className="w-7 h-5 rounded-md bg-gray-200 animate-pulse" />
          <div className="w-7 h-7 rounded-lg bg-gray-200 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// ── Checkout: Bloco de Totais (tema claro) ────────────────────────────────────
export function SkeletonCheckoutTotals() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="h-4 w-16 rounded-md bg-gray-200 animate-pulse" />
          <div className="h-4 w-20 rounded-md bg-gray-200 animate-pulse" />
        </div>
      </div>
      <div className="border-t border-gray-100 mt-3 pt-3 flex items-baseline justify-between">
        <div className="h-5 w-10 rounded-md bg-gray-200 animate-pulse" />
        <div className="h-8 w-28 rounded-lg bg-gray-200 animate-pulse" />
      </div>
    </div>
  )
}
