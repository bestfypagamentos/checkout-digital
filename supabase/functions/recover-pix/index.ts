import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ══════════════════════════════════════════════════════════════════════════════
// RECOVER-PIX — Endpoint público de recuperação de PIX abandonado
//
// GET  /recover-pix?sale_id=<uuid>
//
// Retorna dados da venda + QR code PIX.
// Se o PIX tiver mais de PIX_EXPIRY_MINUTES, gera um novo via Bestfy API
// e atualiza qr_code_url / qr_code_text na venda original.
// ══════════════════════════════════════════════════════════════════════════════

// Tempo de validade assumido para o PIX (minutos).
// Ajuste conforme o TTL configurado na Bestfy.
const PIX_EXPIRY_MINUTES = 30

const ALLOWED_ORIGINS = (Deno.env.get('APP_URL') ?? 'http://localhost:5173')
  .split(',')
  .map(s => s.trim().replace(/\/$/, ''))

function buildCorsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  }
}

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// ── Verifica se o PIX ainda é válido com base na criação ─────────────────────
function isPixStillValid(createdAt: string): boolean {
  const age = (Date.now() - new Date(createdAt).getTime()) / 1000 / 60 // minutos
  return age < PIX_EXPIRY_MINUTES
}

// ── Handler principal ──────────────────────────────────────────────────────────
serve(async (req) => {
  const origin = req.headers.get('origin')
  const cors   = buildCorsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405, cors)
  }

  const url    = new URL(req.url)
  const saleId = url.searchParams.get('sale_id')

  if (!saleId || !/^[0-9a-f-]{36}$/i.test(saleId)) {
    return json({ error: 'sale_id inválido ou ausente.' }, 400, cors)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // ── Busca a venda com produto ─────────────────────────────────────────────
    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .select(`
        id, status, amount, created_at,
        customer_name, customer_email, customer_cpf,
        qr_code_url, qr_code_text,
        product_id, seller_id,
        products ( id, name, image_url, description )
      `)
      .eq('id', saleId)
      .single()

    if (saleErr || !sale) {
      console.warn('[recover-pix] Venda não encontrada:', saleId)
      return json({ error: 'Venda não encontrada.' }, 404, cors)
    }

    // ── Venda já paga — informa o frontend ───────────────────────────────────
    if (sale.status === 'paid') {
      return json({ status: 'paid', message: 'Este pedido já foi pago. Obrigado!' }, 200, cors)
    }

    // ── Venda cancelada/falhou ────────────────────────────────────────────────
    if (sale.status === 'failed' || sale.status === 'refunded') {
      return json({ status: sale.status, message: 'Este pedido foi cancelado.' }, 200, cors)
    }

    const product = sale.products as { id: string; name: string; image_url: string | null; description: string | null } | null

    // ── Busca a API key do vendedor (profiles.id = sales.seller_id) ──────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('bestfy_api_key')
      .eq('id', sale.seller_id)
      .single()

    let qrCodeUrl  = sale.qr_code_url
    let qrCodeText = sale.qr_code_text
    let pixRefreshed = false

    // ── PIX expirado: gera novo via Bestfy API ────────────────────────────────
    if (!isPixStillValid(sale.created_at)) {
      console.log(`[recover-pix] PIX expirado para venda ${saleId}. Gerando novo...`)

      if (!profile?.bestfy_api_key) {
        return json({ error: 'Gateway de pagamento não configurado.' }, 400, cors)
      }

      const payload = {
        paymentMethod: 'PIX',
        items: [{
          productTitle: product?.name ?? 'Produto',
          description:  product?.description ?? 'Produto digital',
          quantity:     1,
          priceCents:   Math.round(Number(sale.amount) * 100),
          productType:  'DIGITAL',
        }],
        customer: {
          name:      sale.customer_name,
          email:     sale.customer_email,
          cpfOrCnpj: sale.customer_cpf ?? '',
        },
        metadata:    JSON.stringify({ productId: product?.id, recoveredSaleId: sale.id }),
        postbackUrl: 'https://vtqipknneiebnklkvrcw.supabase.co/functions/v1/bestfy-webhook',
      }

      const bestfyRes = await fetch('https://api.bestfy.io/payment', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key':    profile.bestfy_api_key.trim(),
        },
        body: JSON.stringify(payload),
      })

      if (bestfyRes.ok) {
        const result = await bestfyRes.json()
        qrCodeUrl  = result.qrCode     ?? qrCodeUrl
        qrCodeText = result.qrCodeText ?? qrCodeText

        // Atualiza a venda com o novo QR code
        await supabase
          .from('sales')
          .update({
            qr_code_url:  qrCodeUrl,
            qr_code_text: qrCodeText,
            updated_at:   new Date().toISOString(),
          })
          .eq('id', sale.id)

        pixRefreshed = true
        console.log(`[recover-pix] ✓ PIX renovado para venda ${saleId}`)
      } else {
        const errBody = await bestfyRes.json().catch(() => ({}))
        console.error('[recover-pix] Erro Bestfy ao renovar PIX:', errBody)
        // Retorna o QR antigo mesmo assim — melhor que erro total
      }
    }

    return json({
      status:       'pending',
      saleId:       sale.id,
      customerName: sale.customer_name,
      amount:       Number(sale.amount),
      productName:  product?.name ?? 'Produto',
      productImage: product?.image_url ?? null,
      qrCodeUrl,
      qrCodeText,
      createdAt:    sale.created_at,
      pixRefreshed,
      pixExpiresAt: new Date(
        (pixRefreshed ? Date.now() : new Date(sale.created_at).getTime()) + PIX_EXPIRY_MINUTES * 60 * 1000
      ).toISOString(),
    }, 200, cors)

  } catch (err) {
    console.error('[recover-pix] Erro interno:', err?.message)
    return json({ error: 'Erro interno. Tente novamente.' }, 500, cors)
  }
})
