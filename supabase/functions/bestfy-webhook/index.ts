import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Segredo de assinatura do webhook (configurar no Supabase Secrets)
// Supabase Dashboard → Settings → Edge Functions → Secrets
// Nome: BESTFY_WEBHOOK_SECRET  |  Valor: obtido no painel da Bestfy
const WEBHOOK_SECRET = Deno.env.get('BESTFY_WEBHOOK_SECRET') ?? ''

// ── CORS: webhook vem server-to-server (sem Origin) ──────────────────────────
const ALLOWED_ORIGINS = (Deno.env.get('APP_URL') ?? 'http://localhost:5173')
  .split(',').map(s => s.trim().replace(/\/$/, ''))

function buildCorsHeaders(requestOrigin: string | null) {
  if (!requestOrigin) {
    return { 'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0], 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
  }
  const origin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// ── Converte hex string para Uint8Array ───────────────────────────────────────
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

// ── Verificação HMAC-SHA256 (resistente a timing attacks) ─────────────────────
// A Bestfy assina o payload com o segredo configurado no painel deles.
// O header com a assinatura é x-bestfy-signature (confirme na doc da Bestfy).
async function verifyHmacSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader || !WEBHOOK_SECRET) {
    console.warn('[SECURITY] Assinatura ou segredo ausente.')
    return false
  }

  try {
    const encoder   = new TextEncoder()
    const keyBytes  = encoder.encode(WEBHOOK_SECRET)
    const bodyBytes = encoder.encode(rawBody)

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    )

    // Bestfy pode enviar o hash como "sha256=<hex>" ou apenas "<hex>" — adaptamos
    const hexSignature = signatureHeader.startsWith('sha256=')
      ? signatureHeader.slice(7)
      : signatureHeader

    const sigBytes = hexToBytes(hexSignature)
    return await crypto.subtle.verify('HMAC', cryptoKey, sigBytes, bodyBytes)
  } catch (err) {
    console.error('[SECURITY] Erro na verificação HMAC:', err?.message)
    return false
  }
}

// ── Proteção contra replay attacks ────────────────────────────────────────────
// Rejeita webhooks com timestamp mais velho que 5 minutos
function isTimestampFresh(timestamp: string | null): boolean {
  if (!timestamp) return true // Se não tem timestamp, não bloqueia (depende da Bestfy)
  const webhookTime = new Date(timestamp).getTime()
  if (isNaN(webhookTime)) return true
  return Date.now() - webhookTime < 5 * 60 * 1000
}

// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  const origin = req.headers.get('origin')
  const cors   = buildCorsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // ── Lê o body como texto antes de qualquer parse (necessário para HMAC) ────
  const rawBody = await req.text()

  // ── C-01: Verificação HMAC — bloqueia webhooks não assinados pela Bestfy ───
  const signature = req.headers.get('x-bestfy-signature')
                 ?? req.headers.get('x-webhook-signature')
                 ?? req.headers.get('x-signature')

  const isValid = await verifyHmacSignature(rawBody, signature)

  if (!isValid) {
    console.warn('[SECURITY] Webhook rejeitado — assinatura HMAC inválida ou ausente.')
    // Retorna 200 para não acionar retentativas da Bestfy com payload inválido
    // mas logamos para monitoramento
    return new Response(JSON.stringify({ received: false, error: 'Invalid signature' }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = JSON.parse(rawBody)

    console.log("=== BESTFY WEBHOOK RECEBIDO E AUTENTICADO ===")

    let data: Record<string, string> = {}
    if (body.event_message) {
      try {
        data = JSON.parse(body.event_message)
      } catch {
        console.error("Falha ao fazer JSON.parse do event_message")
      }
    }

    const transactionId = data.transactionId || body.transactionId || null
    const rawStatus     = data.status        || body.status        || null
    const timestamp     = data.timestamp     || body.timestamp     || body.created_at || null

    // ── Proteção contra replay attacks ──────────────────────────────────────
    if (!isTimestampFresh(timestamp)) {
      console.warn(`[SECURITY] Webhook com timestamp expirado: ${timestamp}`)
      return new Response(JSON.stringify({ received: false, error: 'Webhook expired' }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    console.log("ID:", transactionId, "| Status:", rawStatus)

    if (!transactionId || !rawStatus) {
      console.error("Campos obrigatórios ausentes")
      return new Response(JSON.stringify({ received: true, error: 'Missing fields' }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const STATUS_MAP: Record<string, string> = {
      'PAID':      'paid',
      'APPROVED':  'paid',
      'COMPLETED': 'paid',
      'EXPIRED':   'expired',
      'FAILED':    'failed',
      'REFUNDED':  'refunded',
      'PENDING':   'pending',
    }

    const normalizedStatus = STATUS_MAP[rawStatus.toUpperCase()] ?? null

    if (!normalizedStatus) {
      console.log(`Status desconhecido '${rawStatus}' — ignorando`)
      return new Response(JSON.stringify({ received: true, warning: `Unknown status: ${rawStatus}` }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: sale, error: findError } = await supabase
      .from('sales')
      .select('id, status')
      .eq('bestfy_id', transactionId)
      .single()

    if (findError || !sale) {
      console.error("Venda não encontrada para bestfy_id:", transactionId)
      return new Response(JSON.stringify({ received: true, error: 'Sale not found' }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (sale.status === normalizedStatus) {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Proteção de estado: vendas pagas não retrocedem para pending/failed
    const FINAL_STATES = ['paid', 'refunded']
    if (FINAL_STATES.includes(sale.status) && !FINAL_STATES.includes(normalizedStatus)) {
      console.warn(`[SECURITY] Tentativa de rebaixar status de '${sale.status}' para '${normalizedStatus}' — bloqueado.`)
      return new Response(JSON.stringify({ received: true, skipped: true, reason: 'State downgrade blocked' }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { error: updateError } = await supabase
      .from('sales')
      .update({ status: normalizedStatus, updated_at: new Date().toISOString() })
      .eq('id', sale.id)

    if (updateError) {
      console.error("Erro ao atualizar venda:", updateError.message)
      return new Response(JSON.stringify({ error: 'DB update failed' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    console.log(`✓ Venda ${sale.id} → '${normalizedStatus}'`)

    return new Response(JSON.stringify({ received: true, updated: true, status: normalizedStatus }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error("ERRO NO WEBHOOK:", err?.message)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...buildCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
    })
  }
})
