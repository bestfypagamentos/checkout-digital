import {
  Package,
  CheckCircle2, ChevronRight, Clock, Zap,
} from 'lucide-react'
import BestfyIcon from './BestfyIcon'

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ type }) {
  const map = {
    done:    { label: 'Concluído',    cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
    pending: { label: 'Pendente',     cls: 'bg-yellow-500/10  text-yellow-400  border border-yellow-500/20'  },
    start:   { label: 'Comece agora', cls: 'bg-emerald-500/10  text-emerald-400  border border-emerald-500/20'  },
    soon:    { label: 'Em breve',     cls: 'bg-th-raised      text-th-text-4   border border-zinc-300 dark:border-zinc-700/50'      },
    ready:   { label: 'Disponível',   cls: 'bg-sky-500/10     text-sky-400     border border-sky-500/20'     },
  }
  const { label, cls } = map[type] ?? map.soon
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full ${cls}`}>
      {type === 'done' && <CheckCircle2 className="w-2.5 h-2.5 mr-1" />}
      {type === 'pending' && <Clock className="w-2.5 h-2.5 mr-1" />}
      {type === 'start' && <Zap className="w-2.5 h-2.5 mr-1" />}
      {label}
    </span>
  )
}

// ── Card grande ───────────────────────────────────────────────────────────────
function LargeCard({ step, icon: Icon, iconColor, iconBg, iconNode, title, titleHref, description, badge, action }) {
  return (
    <div className="relative bg-th-raised border border-th-line rounded-xl p-6 flex flex-col gap-4 group hover:border-th-line-2 transition-all duration-200">

      {/* Icon + Badge */}
      <div className="flex items-start justify-between">
        {iconNode ?? (
          <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={1.5} />
          </div>
        )}
        <Badge type={badge} />
      </div>

      {/* Text */}
      <div>
        <p className="text-[10px] font-bold text-th-text-4 uppercase tracking-widest mb-1.5">
          Passo {String(step).padStart(2, '0')}
        </p>
        <h3 className="text-sm font-semibold text-th-text leading-snug">
          {titleHref ? (
            <a href={titleHref} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
              {title}
            </a>
          ) : title}
        </h3>
        <p className="text-xs text-th-text-3 mt-2 leading-relaxed">{description}</p>
      </div>

      {/* Action */}
      {action && (
        <div className="mt-auto pt-2">
          {badge === 'done' ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Configurado
            </span>
          ) : (
            <button
              onClick={action.onClick}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 group-hover:gap-2.5 transition-all"
            >
              {action.label} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── OnboardingGrid principal ──────────────────────────────────────────────────
export default function OnboardingGrid({
  hasApiKey,
  hasProducts,
  onConnectBestfy,
  onAddProduct,
}) {
  const completedCount = [hasApiKey, hasProducts].filter(Boolean).length
  const totalRequired  = 2

  return (
    <div>
      {/* Cabeçalho da seção */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-th-text-2 uppercase tracking-wider">
            Primeiros Passos
          </h2>
          <p className="text-xs text-th-text-4 mt-0.5">
            {completedCount === totalRequired
              ? 'Configuração completa — você está pronto para vender.'
              : `${completedCount} de ${totalRequired} etapas obrigatórias concluídas.`}
          </p>
        </div>

        {/* Barra de progresso */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-24 h-1.5 bg-th-raised rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / totalRequired) * 100}%` }}
            />
          </div>
          <span className="text-xs text-th-text-4 font-mono">
            {completedCount}/{totalRequired}
          </span>
        </div>
      </div>

      {/* 2 cards grandes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LargeCard
          step={1}
          iconNode={<BestfyIcon size={44} />}
          title="Conectar Bestfy.io"
          titleHref="https://app.bestfy.io"
          description="Vincule sua conta Bestfy para começar a receber pagamentos via PIX de forma automática."
          badge={hasApiKey ? 'done' : 'pending'}
          action={{ label: 'Conectar Bestfy', onClick: onConnectBestfy }}
        />

        <LargeCard
          step={2}
          icon={Package}
          iconColor="text-sky-400"
          iconBg="bg-sky-500/10"
          title="Criar Produto Digital"
          description="Cadastre o infoproduto que deseja vender, defina o preço e o link de entrega para o cliente."
          badge={hasProducts ? 'done' : 'start'}
          action={{ label: 'Criar produto', onClick: onAddProduct }}
        />
      </div>
    </div>
  )
}
