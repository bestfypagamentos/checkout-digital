import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()

    // ── Log do body bruto ─────────────────────────────────────────────────────
    console.log("=== BESTFY WEBHOOK RECEBIDO ===")
    console.log("Body completo recebido:", JSON.stringify(body))

    // ── Extrai os dados reais: podem estar dentro de event_message (string JSON)
    let data: Record<string, string> = {}
    if (body.event_message) {
      try {
        data = JSON.parse(body.event_message)
        console.log("event_message parseado:", JSON.stringify(data))
      } catch {
        console.error("Falha ao fazer JSON.parse do event_message")
      }
    }

    // ── Extrai ID e status priorizando o objeto interno ───────────────────────
    const transactionId = data.transactionId || body.transactionId || null
    const rawStatus     = data.status        || body.status        || null

    console.log("ID identificado:", transactionId, "Status:", rawStatus)

    if (!transactionId || !rawStatus) {
      console.error("Campos obrigatórios ausentes — transactionId ou status não encontrados")
      return new Response(JSON.stringify({ received: true, error: 'Missing fields' }), {
        status: 200, // 200 para Bestfy não re-tentar
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Mapeia status da Bestfy para o nosso schema ──────────────────────────
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
      console.log(`Status desconhecido '${rawStatus}' — ignorando atualização`)
      return new Response(JSON.stringify({ received: true, warning: `Unknown status: ${rawStatus}` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Admin client: ignora RLS ──────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── Busca a venda pelo bestfy_id ──────────────────────────────────────────
    const { data: sale, error: findError } = await supabase
      .from('sales')
      .select('id, status')
      .eq('bestfy_id', transactionId)
      .single()

    if (findError || !sale) {
      console.error("Venda não encontrada para bestfy_id:", transactionId)
      return new Response(JSON.stringify({ received: true, error: 'Sale not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Venda encontrada: ${sale.id} | ${sale.status} → ${normalizedStatus}`)

    if (sale.status === normalizedStatus) {
      console.log("Status já é o mesmo — sem atualização necessária")
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Atualiza o status ─────────────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('sales')
      .update({ status: normalizedStatus, updated_at: new Date().toISOString() })
      .eq('id', sale.id)

    if (updateError) {
      console.error("Erro ao atualizar venda:", updateError.message)
      return new Response(JSON.stringify({ error: 'DB update failed' }), {
        status: 500, // 500 para Bestfy re-tentar
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`✓ Venda ${sale.id} atualizada para '${normalizedStatus}'`)

    return new Response(JSON.stringify({ received: true, updated: true, status: normalizedStatus }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error("ERRO NO WEBHOOK:", err?.message)
    return new Response(JSON.stringify({ error: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
