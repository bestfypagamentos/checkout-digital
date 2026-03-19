import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CORS restrito por origem ──────────────────────────────────────────────────
const ALLOWED_ORIGINS = (Deno.env.get('APP_URL') ?? 'http://localhost:5173')
  .split(',')
  .map(s => s.trim().replace(/\/$/, ''))

function buildCorsHeaders(requestOrigin: string | null) {
  const origin = ALLOWED_ORIGINS.includes(requestOrigin ?? '')
    ? requestOrigin!
    : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// ── Hash de IP para auditoria (LGPD: não armazenamos o IP puro) ───────────────
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const data    = encoder.encode(ip + (Deno.env.get('IP_HASH_SALT') ?? 'default-salt'))
  const hash    = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const cors   = buildCorsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { sale_id, upsell_id } = await req.json()

    if (!sale_id || !upsell_id) {
      return new Response(JSON.stringify({ error: 'sale_id e upsell_id são obrigatórios.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── Valida que a venda existe e está paga ─────────────────────────────────
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('id, status, product_id, seller_id')
      .eq('id', sale_id)
      .maybeSingle()

    if (saleError || !sale) {
      return new Response(JSON.stringify({ error: 'Venda não encontrada.' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    if (sale.status !== 'paid') {
      return new Response(JSON.stringify({ error: 'Sessão de upsell requer venda confirmada.' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // ── Valida que o upsell pertence ao mesmo seller do produto ───────────────
    const { data: upsell, error: upsellError } = await supabase
      .from('product_upsells')
      .select('id, seller_id, product_id')
      .eq('id', upsell_id)
      .eq('product_id', sale.product_id)
      .maybeSingle()

    if (upsellError || !upsell) {
      return new Response(JSON.stringify({ error: 'Upsell inválido para este produto.' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    if (upsell.seller_id !== sale.seller_id) {
      return new Response(JSON.stringify({ error: 'Upsell não pertence ao vendedor da venda.' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // ── Verifica se já existe sessão ativa para este par sale+upsell ──────────
    // Evita geração de múltiplos tokens para a mesma oferta
    const { data: existingSession } = await supabase
      .from('upsell_sessions')
      .select('token, expires_at, used_at')
      .eq('sale_id', sale_id)
      .eq('upsell_id', upsell_id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (existingSession) {
      console.log(`[upsell-session] Retornando sessão ativa existente para sale ${sale_id}`)
      return new Response(JSON.stringify({
        session_token: existingSession.token,
        expires_at:    existingSession.expires_at,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // ── Cria nova sessão com token de 32 bytes (256 bits de entropia) ─────────
    const { data: session, error: sessionError } = await supabase
      .from('upsell_sessions')
      .insert({ upsell_id, sale_id })
      .select('token, expires_at')
      .single()

    if (sessionError || !session) {
      console.error("Erro ao criar sessão:", sessionError?.message)
      return new Response(JSON.stringify({ error: 'Erro ao criar sessão de upsell.' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // ── Log de auditoria ──────────────────────────────────────────────────────
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const ipHash   = await hashIP(clientIP)

    await supabase.from('upsell_logs').insert({
      seller_id: upsell.seller_id,
      upsell_id,
      sale_id,
      event:    'session_created',
      ip_hash:   ipHash,
    })

    console.log(`[upsell-session] Token criado para sale ${sale_id}, expira em ${session.expires_at}`)

    // ── Retorna apenas o token — nunca o upsell_id real ───────────────────────
    return new Response(JSON.stringify({
      session_token: session.token,
      expires_at:    session.expires_at,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error("ERRO:", err?.message)
    return new Response(JSON.stringify({ error: 'Erro interno.' }), {
      status: 500,
      headers: { ...buildCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
    })
  }
})
