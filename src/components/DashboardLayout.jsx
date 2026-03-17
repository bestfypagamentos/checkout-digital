import { useAuth } from '../contexts/AuthContext'
import { useNavigate, NavLink } from 'react-router-dom'
import { LayoutDashboard, Package, ReceiptText, Plug, LogOut, ChevronRight } from 'lucide-react'

const navItems = [
  { to: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/products',     label: 'Produtos',    icon: Package },
  { to: '/transactions', label: 'Transações',  icon: ReceiptText },
  { to: '/integrations', label: 'Integrações', icon: Plug },
]

// Bestfy "b" mark SVG reutilizável
function BestfyMark({ size = 32 }) {
  return (
    <div
      className="rounded-2xl bg-emerald-500 flex items-center justify-center shadow-sm shrink-0"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 22 26" fill="none" style={{ width: size * 0.62, height: size * 0.62 }}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2 1 L8 1 L8 11 Q20 11 20 18 Q20 25 8 25 L2 25 Z M8 14 Q16 14 16 18 Q16 22 8 22 Z"
          fill="white"
        />
      </svg>
    </div>
  )
}

export default function DashboardLayout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const fullName  = user?.user_metadata?.full_name || user?.email || ''
  const initials  = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const firstName = fullName.split(' ')[0]

  return (
    <div className="flex min-h-screen bg-zinc-950">

      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 flex flex-col bg-zinc-900 border-r border-zinc-800 sticky top-0 h-screen">

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-zinc-800">
          <BestfyMark size={36} />
          <span className="font-bold text-zinc-100 text-lg tracking-tight">Bestfy</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} strokeWidth={1.8} />
                    {label}
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 transition-opacity ${isActive ? 'opacity-60 text-emerald-400' : 'opacity-0 group-hover:opacity-40'}`} />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + Sign out */}
        <div className="px-3 py-4 border-t border-zinc-800 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{firstName}</p>
              <p className="text-[11px] text-zinc-600 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.8} />
            Sair
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>

    </div>
  )
}
