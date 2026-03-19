import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (Deno.env.get('APP_URL') ?? 'http://localhost:5173')
  .split(',').map(s => s.trim().replace(/\/$/, ''))

function buildCorsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// ── UUID validation ───────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  const origin = req.headers.get('origin')
  const cors   = buildCorsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, cors)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const saleId: string = body.saleId ?? ''

    // Validate saleId is a UUID to prevent injection
    if (!saleId || !UUID_RE.test(saleId)) {
      return json({ error: 'saleId inválido.' }, 400, cors)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── Verificação crítica: apenas vendas PAGAS recebem a URL de entrega ─────
    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .select('id, status, product_id')
      .eq('id', saleId)
      .single()

    if (saleErr || !sale) {
      console.warn('[get-delivery-url] Venda não encontrada:', saleId)
      // Retorna 404 genérico — não revela se o saleId existe ou não
      return json({ error: 'Não encontrado.' }, 404, cors)
    }

    if (sale.status !== 'paid') {
      console.warn('[get-delivery-url] Acesso negado — venda não paga:', saleId, 'status:', sale.status)
      return json({ error: 'Pagamento ainda não confirmado.' }, 403, cors)
    }

    // ── Busca a URL de entrega do produto ─────────────────────────────────────
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('delivery_url')
      .eq('id', sale.product_id)
      .single()

    if (prodErr || !product) {
      console.error('[get-delivery-url] Produto não encontrado para sale:', saleId)
      return json({ error: 'Produto não encontrado.' }, 404, cors)
    }

    if (!product.delivery_url) {
      return json({ deliveryUrl: null }, 200, cors)
    }

    console.log(`[get-delivery-url] URL entregue para sale ${saleId}`)
    return json({ deliveryUrl: product.delivery_url }, 200, cors)

  } catch (err) {
    console.error('[get-delivery-url] Erro interno:', err?.message)
    return json({ error: 'Erro interno.' }, 500, cors)
  }
})
