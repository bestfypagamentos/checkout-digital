import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useNavigate, NavLink } from 'react-router-dom'
import { LayoutDashboard, Package, ReceiptText, Plug, LogOut, ChevronRight, Sun, Moon } from 'lucide-react'
import bestfyLogo from '../assets/bestfy-logo.svg'
import bestfyLogoLight from '../assets/bestfy-logo-light.svg'

const navItems = [
  { to: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/products',     label: 'Produtos',    icon: Package },
  { to: '/transactions', label: 'Transações',  icon: ReceiptText },
  { to: '/integrations', label: 'Integrações', icon: Plug },
]

export default function DashboardLayout({ children }) {
  const { user, signOut } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const fullName  = user?.user_metadata?.full_name || user?.email || ''
  const initials  = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const firstName = fullName.split(' ')[0]

  return (
    <div className="flex min-h-screen bg-th-bg">

      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 flex flex-col bg-th-surface border-r border-th-line sticky top-0 h-screen">

        {/* Logo */}
        <div className="flex justify-center px-6 py-6 border-b border-th-line">
          <img src={dark ? bestfyLogo : bestfyLogoLight} alt="Bestfy" className="w-full max-w-[160px] h-auto" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'text-th-text-3 hover:text-th-text-2 hover:bg-th-raised'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${isActive ? 'text-emerald-500' : 'text-th-text-4 group-hover:text-th-text-3'}`}
                      strokeWidth={1.8}
                    />
                    {label}
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-opacity ${isActive ? 'opacity-60 text-emerald-500' : 'opacity-0 group-hover:opacity-40'}`}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer: toggle + user + sair */}
        <div className="px-3 py-4 border-t border-th-line space-y-1">

          {/* Tema */}
          <button
            onClick={toggle}
            title={dark ? 'Mudar para Light Mode' : 'Mudar para Dark Mode'}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-th-text-3 hover:text-th-text-2 hover:bg-th-raised transition-colors"
          >
            {dark
              ? <Sun  className="w-4 h-4" strokeWidth={1.8} />
              : <Moon className="w-4 h-4" strokeWidth={1.8} />
            }
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>

          {/* Usuário */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-th-text-2 truncate">{firstName}</p>
              <p className="text-[11px] text-th-text-4 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Sair */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-th-text-3 hover:text-red-500 hover:bg-th-raised transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.8} />
            Sair
          </button>
        </div>
      </aside>

      {/* ── Conteúdo ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>

    </div>
  )
}
