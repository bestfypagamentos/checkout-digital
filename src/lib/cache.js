// ── cache.js ──────────────────────────────────────────────────────────────────
// Cache client-side em memória com TTL.
// Implementa o padrão Stale-While-Revalidate:
//   - Cache hit  → retorna dados imediatamente + re-fetch silencioso em background
//   - Cache miss → fetch normal com estado de loading (exibe skeleton)
//
// O store vive na memória do módulo (persiste enquanto a aba estiver aberta).
// Ao fechar/reabrir a aba, o cache é zerado — comportamento correto.

const store = new Map()

// TTL padrão: 60 segundos
const DEFAULT_TTL = 60_000

/**
 * Retorna entrada do cache se existir e não tiver expirado.
 * @param {string} key
 * @returns {any | null}
 */
export function cacheGet(key) {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > entry.ttl) {
    store.delete(key)
    return null
  }
  return entry.data
}

/**
 * Armazena um valor no cache.
 * @param {string} key
 * @param {any} data
 * @param {number} ttl - Tempo de vida em ms (padrão 60s)
 */
export function cacheSet(key, data, ttl = DEFAULT_TTL) {
  store.set(key, { data, ts: Date.now(), ttl })
}

/**
 * Remove uma entrada do cache (ex: após mutação).
 * @param {string} key
 */
export function cacheDel(key) {
  store.delete(key)
}

/**
 * Remove todas as entradas que começam com um prefixo.
 * Útil para invalidar tudo de um usuário: cacheClear(`stats:${userId}`)
 * @param {string} prefix
 */
export function cacheClear(prefix) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}
