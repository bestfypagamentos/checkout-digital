// ── Limites de tamanho ────────────────────────────────────────────────────────
export const LIMITS = {
  name:     { min: 2,  max: 80  },
  email:    { min: 5,  max: 254 },
  password: { min: 8,  max: 128 },
}

// RFC 5322 simplificado — rejeita domínios sem TLD, múltiplos @, etc.
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/

// Letras (incluindo acentuadas), espaços, hífens, apóstrofos
const NAME_RE = /^[\p{L}\s'\-]+$/u

// ── Validação de nome ─────────────────────────────────────────────────────────
export function validateName(name) {
  const v = name.trim()
  if (v.length < LIMITS.name.min)  return `Nome deve ter pelo menos ${LIMITS.name.min} caracteres.`
  if (v.length > LIMITS.name.max)  return `Nome muito longo (máximo ${LIMITS.name.max} caracteres).`
  if (!NAME_RE.test(v))            return 'Nome contém caracteres inválidos.'
  return null
}

// ── Validação de e-mail ───────────────────────────────────────────────────────
export function validateEmail(email) {
  const v = email.trim()
  if (v.length < LIMITS.email.min) return 'E-mail inválido.'
  if (v.length > LIMITS.email.max) return `E-mail muito longo (máximo ${LIMITS.email.max} caracteres).`
  if (!EMAIL_RE.test(v))           return 'Formato de e-mail inválido.'
  return null
}

// ── Validação de senha ────────────────────────────────────────────────────────
export function validatePassword(password) {
  if (password.length < LIMITS.password.min) return `A senha deve ter pelo menos ${LIMITS.password.min} caracteres.`
  if (password.length > LIMITS.password.max) return `Senha muito longa (máximo ${LIMITS.password.max} caracteres).`
  return null
}

// ── Força da senha (para exibição no cadastro) ────────────────────────────────
// Retorna: 0=muito fraca, 1=fraca, 2=média, 3=forte
export function passwordStrength(password) {
  if (password.length === 0) return -1
  let score = 0
  if (password.length >= 8)                            score++
  if (password.length >= 12)                           score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password))                          score++
  if (/[^a-zA-Z0-9]/.test(password))                  score++
  if (score <= 1) return 0  // Fraca
  if (score === 2) return 1  // Média
  if (score === 3) return 2  // Boa
  return 3                   // Forte
}

export const STRENGTH_LABELS = ['Fraca', 'Média', 'Boa', 'Forte']
export const STRENGTH_COLORS = [
  'bg-red-500',
  'bg-yellow-400',
  'bg-blue-400',
  'bg-emerald-500',
]
export const STRENGTH_TEXT = [
  'text-red-400',
  'text-yellow-400',
  'text-blue-400',
  'text-emerald-400',
]

// ── Honeypot ──────────────────────────────────────────────────────────────────
// Campo invisível — bots preenchem, humanos não.
export function isHoneypotFilled(value) {
  return value.length > 0
}

// ── Proteção contra envio ultra-rápido (bots) ─────────────────────────────────
// Humanos levam pelo menos ~1s para preencher e enviar um formulário.
export function isTooFast(mountedAt, minMs = 1200) {
  return Date.now() - mountedAt < minMs
}

// ── Rate limiter de login (client-side) ───────────────────────────────────────
// Não substitui o rate limit do servidor — serve como primeira barreira de UX.
//   5 falhas  → bloqueio de 30 segundos
//   10 falhas → bloqueio de 5 minutos
const LOCK_TIERS = [
  { after: 5,  lockMs: 30_000   },
  { after: 10, lockMs: 300_000  },
]

class LoginRateLimiter {
  #attempts   = 0
  #lockedUntil = 0

  get isLocked() {
    return Date.now() < this.#lockedUntil
  }

  get remainingSeconds() {
    return Math.max(0, Math.ceil((this.#lockedUntil - Date.now()) / 1000))
  }

  recordFailure() {
    this.#attempts++
    const tier = [...LOCK_TIERS].reverse().find(t => this.#attempts >= t.after)
    if (tier) this.#lockedUntil = Date.now() + tier.lockMs
  }

  reset() {
    this.#attempts  = 0
    this.#lockedUntil = 0
  }
}

// Instância singleton — persiste enquanto o app estiver montado.
export const loginLimiter = new LoginRateLimiter()
