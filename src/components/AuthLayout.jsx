import { Link } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'

export default function AuthLayout({ children, title, subtitle, footerText, footerLink, footerLinkText }) {
  const { dark } = useTheme()

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-th-bg">
      {/* Background subtle grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <img
            src={dark ? '/logo-dark.svg' : '/logo-white.svg'}
            alt="Bestfy"
            className="h-10 mx-auto mb-4"
          />
          <h1 className="text-2xl font-semibold text-th-text">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-th-text-3">{subtitle}</p>}
        </div>

        {/* Card */}
        <div className="th-card bg-th-surface border border-th-line rounded-2xl p-8 shadow-xl">
          {children}
        </div>

        {/* Footer link */}
        {footerText && (
          <p className="text-center mt-6 text-sm text-th-text-3">
            {footerText}{' '}
            <Link to={footerLink} className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              {footerLinkText}
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
