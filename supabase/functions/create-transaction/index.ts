import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { productId, customerName, customerEmail, customerCpf, customerPhone, couponCode, offerId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: product, error: pError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (pError || !product) {
      throw new Error("Produto não encontrado.")
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('bestfy_api_key')
      .eq('id', product.user_id)
      .single()

    if (profileError || !profile?.bestfy_api_key) {
      throw new Error("Configuração de pagamento do vendedor não encontrada.")
    }

    const apiKey = profile.bestfy_api_key

    // Resolve offer price (if offerId provided)
    let basePrice = product.price
    if (offerId) {
      const { data: offer } = await supabase
        .from('product_offers')
        .select('price')
        .eq('id', offerId)
        .eq('product_id', productId)
        .single()
      if (offer) basePrice = offer.price
    }

    // ── Validar e aplicar cupom (se fornecido) ───────────────────────────────
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
        const now = new Date()
        const startsOk = !coupon.starts_at || new Date(coupon.starts_at) <= now
        const expiresOk = !coupon.expires_at || new Date(coupon.expires_at) >= now

        if (startsOk && expiresOk) {
          finalPrice = basePrice * (1 - coupon.discount_percent / 100)
          couponId = coupon.id
        }
      }
      // Se cupom não encontrado ou inválido, prossegue sem desconto
    }

    const priceInCents = Math.round(finalPrice * 100)

    // ESTRUTURA EXATA DA DOCUMENTAÇÃO QUE VOCÊ ENVIOU
    const payload = {
      paymentMethod: "PIX",
      items: [
        {
          productTitle: product.name,
          description: product.description || "Sem descrição",
          quantity: 1,
          priceCents: priceInCents,
          productType: "DIGITAL"
        }
      ],
      customer: {
        name: customerName,
        email: customerEmail,
        phone: (customerPhone ?? '').replace(/\D/g, ''),
        cpfOrCnpj: customerCpf.replace(/\D/g, ''),
      },
      metadata: JSON.stringify({ productId: product.id }),
      postbackUrl: "https://vtqipknneiebnklkvrcw.supabase.co/functions/v1/bestfy-webhook"
    }

    console.log("Chave utilizada (início):", apiKey.substring(0, 10))
    console.log("Enviando para Bestfy:", JSON.stringify(payload))

    const response = await fetch('https://api.bestfy.io/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim()
      },
      body: JSON.stringify(payload)
    })

    const result = await response.json()

    if (!response.ok) {
      console.error("ERRO DETALHADO DA BESTFY:", JSON.stringify(result))
      throw new Error(result.message || "Erro ao processar transação na Bestfy")
    }

    console.log("Resposta da Bestfy:", JSON.stringify(result))

    // ── Salva venda no banco ─────────────────────────────────────────────────
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        bestfy_id:      result.financialTransactionId,
        qr_code_url:    result.qrCode,
        qr_code_text:   result.qrCodeText,
        product_id:     product.id,
        seller_id:      product.user_id,
        amount:         finalPrice,
        coupon_id:      couponId,
        offer_id:       offerId || null,
        customer_name:  customerName,
        customer_email: customerEmail,
        customer_cpf:   customerCpf.replace(/\D/g, ''),
        customer_phone: (customerPhone ?? '').replace(/\D/g, ''),
        status:         'pending',
      })
      .select('id')
      .single()

    if (saleError) {
      console.error("ERRO AO SALVAR VENDA:", saleError.message)
      throw new Error("Pagamento gerado, mas falha ao registrar a venda: " + saleError.message)
    }

    // Retorna dados da Bestfy + saleId do nosso banco (necessário para Realtime)
    return new Response(JSON.stringify({ ...result, saleId: sale.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("ERRO NA FUNÇÃO:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
