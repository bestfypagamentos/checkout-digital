import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3'

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// Secrets obrigatórios no Supabase Dashboard → Settings → Edge Functions → Secrets:
//   APP_URL = https://meuapp.com,http://localhost:5173
// Autenticação: JWT do Supabase Anonymous Auth verificado INTERNAMENTE pela função.
// Deploy com --no-verify-jwt (o gateway não verifica — a função verifica via getUser).
// Pré-requisito: habilitar "Anonymous sign-ins" em Auth → Settings no dashboard.
// ══════════════════════════════════════════════════════════════════════════════

const ALLOWED_ORIGINS = (Deno.env.get('APP_URL') ?? 'http://localhost:5173')
  .split(',')
  .map(s => s.trim().replace(/\/$/, ''))

// ── CORS ──────────────────────────────────────────────────────────────────────
function buildCorsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// ── Helpers de resposta ───────────────────────────────────────────────────────
const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// ── Validação de CPF (dígitos verificadores) ──────────────────────────────────
function isValidCpf(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false  // todos iguais (111.111.111-11)
  const calc = (mod: number) => {
    const sum = cpf.slice(0, mod - 1).split('').reduce((acc, d, i) => acc + Number(d) * (mod - i), 0)
    const rem = (sum * 10) % 11
    return rem >= 10 ? 0 : rem
  }
  return calc(10) === Number(cpf[9]) && calc(11) === Number(cpf[10])
}

// ── Schema de validação com Zod ───────────────────────────────────────────────
const BodySchema = z.object({
  productId: z
    .string({ required_error: 'productId é obrigatório.' })
    .uuid('productId deve ser um UUID válido.'),

  customerName: z
    .string({ required_error: 'Nome é obrigatório.' })
    .min(2,  'Nome muito curto.')
    .max(100, 'Nome muito longo.'),

  customerEmail: z
    .string({ required_error: 'E-mail é obrigatório.' })
    .email('E-mail inválido.')
    .max(254, 'E-mail muito longo.'),

  customerCpf: z
    .string({ required_error: 'CPF é obrigatório.' })
    .transform(v => v.replace(/\D/g, ''))
    .pipe(z.string()
      .length(11, 'CPF deve ter 11 dígitos.')
      .refine(isValidCpf, 'CPF inválido.')),

  customerPhone: z
    .string({ required_error: 'Telefone é obrigatório.' })
    .transform(v => v.replace(/\D/g, ''))
    .pipe(z.string()
      .min(10, 'Telefone deve ter DDD + número (10 ou 11 dígitos).')
      .max(11, 'Telefone inválido.')),

  couponCode: z.string().max(50).optional().nullable(),

  offerId: z.string().uuid('offerId deve ser um UUID válido.').optional().nullable(),

  idempotencyKey: z.string().uuid('idempotencyKey deve ser um UUID.').optional().nullable(),
})

// ══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  const origin = req.headers.get('origin')
  const cors   = buildCorsHeaders(origin)

  // Preflight CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // ── DIRETRIZ 3: CORS & Origin Check ──────────────────────────────────────
  // Bloqueia requests de origens não cadastradas em APP_URL
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn(`[SECURITY] Origin rejeitada: ${origin}`)
    return json({ error: 'Origem não autorizada.' }, 403, cors)
  }

  // ── C-03: Verificação JWT interna (Anonymous Auth) ────────────────────────
  // O gateway usa --no-verify-jwt, mas verificamos o token aqui via getUser().
  // Isso aceita sessões anônimas e autenticadas; rejeita chamadas sem sessão.
  const authHeader = req.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!bearerToken) {
    console.warn('[SECURITY] Authorization header ausente.')
    return json({ error: 'Acesso não autorizado.' }, 401, cors)
  }

  {
    // Usa service role para verificar o JWT sem depender de sessão ativa
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(bearerToken)
    if (authErr || !user) {
      console.warn('[SECURITY] JWT inválido:', authErr?.message)
      return json({ error: 'Acesso não autorizado.' }, 401, cors)
    }
  }

  try {
    // ── Lê o body uma única vez ───────────────────────────────────────────────
    const rawBody = await req.json().catch(() => ({}))

    // ── DIRETRIZ 5: Schema Validation (Zod) ──────────────────────────────────
    const parsed = BodySchema.safeParse(rawBody)

    if (!parsed.success) {
      const messages = parsed.error.issues.map(i => i.message).join(' | ')
      console.warn('[VALIDATION]', messages)
      return json({ error: messages }, 400, cors)
    }

    const {
      productId,
      customerName,
      customerEmail,
      customerCpf,
      customerPhone,
      couponCode,
      offerId,
      idempotencyKey,
    } = parsed.data

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── DIRETRIZ 4: Idempotência ──────────────────────────────────────────────
    // Se venda com essa chave já existe → retorna sem criar nova cobrança
    if (idempotencyKey) {
      const { data: existingSale } = await supabase
        .from('sales')
        .select('id, bestfy_id, qr_code_url, qr_code_text, status')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()

      if (existingSale) {
        console.log(`[idempotency] Retornando venda existente: ${existingSale.id}`)
        return json({
          financialTransactionId: existingSale.bestfy_id,
          qrCode:     existingSale.qr_code_url,
          qrCodeText: existingSale.qr_code_text,
          saleId:     existingSale.id,
          idempotent: true,
        }, 200, cors)
      }
    }

    // ── DIRETRIZ 2: Price Protection ──────────────────────────────────────────
    // Preço buscado do banco — o frontend NUNCA define o valor da cobrança
    const { data: product, error: pError } = await supabase
      .from('products')
      .select('id, name, description, price, user_id')
      .eq('id', productId)
      .single()

    if (pError || !product) return json({ error: 'Produto não encontrado.' }, 404, cors)

    const { data: profile } = await supabase
      .from('profiles')
      .select('bestfy_api_key')
      .eq('id', product.user_id)
      .single()

    if (!profile?.bestfy_api_key) {
      return json({ error: 'Gateway de pagamento não configurado.' }, 400, cors)
    }

    // Preço da oferta também vem do banco (offerId validado como UUID pelo Zod)
    let basePrice = Number(product.price)
    if (offerId) {
      const { data: offer } = await supabase
        .from('product_offers')
        .select('price')
        .eq('id', offerId)
        .eq('product_id', productId)   // garante que a oferta pertence ao produto
        .single()
      if (offer) basePrice = Number(offer.price)
    }

    // Cupom validado server-side (período de validade + pertence ao produto)
    let finalPrice = basePrice
    let couponId: string | null = null

    if (couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('id, discount_percent, starts_at, expires_at')
        .eq('product_id', productId)
        .eq('code', couponCode.trim().toUpperCase())
        .single()

      if (coupon) {
        const now       = new Date()
        const startsOk  = !coupon.starts_at  || new Date(coupon.starts_at)  <= now
        const expiresOk = !coupon.expires_at || new Date(coupon.expires_at) >= now
        if (startsOk && expiresOk) {
          finalPrice = basePrice * (1 - coupon.discount_percent / 100)
          couponId   = coupon.id
        }
      }
    }

    const priceInCents = Math.round(finalPrice * 100)

    // Sanity check: mínimo R$ 1,00 — evita transações de R$ 0,00
    if (priceInCents < 100) {
      return json({ error: 'Valor mínimo para pagamento é R$ 1,00.' }, 400, cors)
    }

    // ── Envia para a Bestfy ───────────────────────────────────────────────────
    const payload = {
      paymentMethod: "PIX",
      items: [{
        productTitle: product.name,
        description:  product.description || "Produto digital",
        quantity:     1,
        priceCents:   priceInCents,
        productType:  "DIGITAL"
      }],
      customer: {
        name:      customerName,
        email:     customerEmail,
        phone:     customerPhone,
        cpfOrCnpj: customerCpf,
      },
      metadata:    JSON.stringify({ productId: product.id }),
      postbackUrl: "https://vtqipknneiebnklkvrcw.supabase.co/functions/v1/bestfy-webhook"
    }

    console.log("Enviando para Bestfy — produto:", product.id, "| valor:", priceInCents, "cents")

    const response = await fetch('https://api.bestfy.io/payment', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': profile.bestfy_api_key.trim() },
      body:    JSON.stringify(payload)
    })

    const result = await response.json()

    if (!response.ok) {
      console.error("ERRO BESTFY:", JSON.stringify(result))
      throw new Error(result.message || "Erro ao processar transação.")
    }

    // ── Salva venda no banco ──────────────────────────────────────────────────
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        bestfy_id:       result.financialTransactionId,
        qr_code_url:     result.qrCode,
        qr_code_text:    result.qrCodeText,
        product_id:      product.id,
        seller_id:       product.user_id,
        amount:          finalPrice,
        coupon_id:       couponId,
        offer_id:        offerId ?? null,
        customer_name:   customerName,
        customer_email:  customerEmail,
        customer_cpf:    customerCpf,
        customer_phone:  customerPhone,
        status:          'pending',
        idempotency_key: idempotencyKey ?? null,
      })
      .select('id')
      .single()

    if (saleError) {
      // Race condition: outra request paralela venceu o INSERT com a mesma chave
      if (saleError.code === '23505' && idempotencyKey) {
        const { data: raceSale } = await supabase
          .from('sales')
          .select('id, bestfy_id, qr_code_url, qr_code_text')
          .eq('idempotency_key', idempotencyKey)
          .single()

        if (raceSale) {
          return json({
            financialTransactionId: raceSale.bestfy_id,
            qrCode:     raceSale.qr_code_url,
            qrCodeText: raceSale.qr_code_text,
            saleId:     raceSale.id,
            idempotent: true,
          }, 200, cors)
        }
      }
      throw new Error("Falha ao registrar a venda.")
    }

    console.log(`✓ Venda criada: ${sale.id}`)
    return json({ ...result, saleId: sale.id }, 200, cors)

  } catch (err) {
    // Nunca exponha detalhes internos ao cliente
    console.error("ERRO INTERNO:", err?.message)
    return json({ error: 'Erro interno. Tente novamente.' }, 500, cors)
  }
})
