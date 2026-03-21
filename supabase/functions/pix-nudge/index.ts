import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ══════════════════════════════════════════════════════════════════════════════
// PIX NUDGE — Worker de Recuperação de Vendas Abandonadas
//
// Invocado a cada minuto via pg_cron.
// Busca vendas PIX pendentes com 3+ minutos e ainda não notificadas.
// Envia e-mail de recuperação via Postmark e marca email_recuperacao_enviado = true.
// ══════════════════════════════════════════════════════════════════════════════

const POSTMARK_TOKEN = Deno.env.get('POSTMARK_SERVER_TOKEN') ?? ''
const FROM_EMAIL     = 'checkt@bestfybr.com.br'
const FROM_NAME      = 'Bestfy'
const SITE_URL       = 'https://seguro.bestfybr.com.br'

// ── Formata moeda ─────────────────────────────────────────────────────────────
function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── Template de e-mail de recuperação PIX ────────────────────────────────────
function pixNudgeTemplate(params: {
  customerName: string
  productName:  string
  amount:       number
  saleId:       string
  productImage: string | null
}): string {
  const { customerName, productName, amount, saleId, productImage } = params
  const firstName    = customerName.split(' ')[0]
  const recoveryUrl  = `${SITE_URL}/checkout/recuperar/${saleId}`
  const amountFormatted = brl(amount)

  const productImgHtml = productImage
    ? `<img src="${productImage}" alt="${productName}" width="48" height="48"
           style="width:48px;height:48px;object-fit:cover;border-radius:8px;display:block;" />`
    : `<div style="width:48px;height:48px;background:#F4F4F5;border-radius:8px;display:flex;align-items:center;justify-content:center;">
         <span style="font-size:22px;line-height:48px;display:block;text-align:center;">📦</span>
       </div>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Finalize sua compra no PIX</title>
</head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo Bestfy -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <a href="${SITE_URL}" style="text-decoration:none;display:inline-block;">
                <img src="${SITE_URL}/bestfy-logo.svg" alt="Bestfy" width="120" height="39"
                     style="display:block;border:0;outline:none;" />
              </a>
            </td>
          </tr>

          <!-- Card principal -->
          <tr>
            <td style="background:#fff;border-radius:16px;border:1px solid #E4E4E7;overflow:hidden;">

              <!-- Ícone PIX -->
              <div style="padding:40px 40px 24px;text-align:center;">
                <div style="width:88px;height:88px;margin:0 auto 20px;position:relative;">
                  <div style="width:88px;height:88px;background:#F0FDF4;border-radius:50%;display:flex;align-items:center;justify-content:center;">
                    <!-- PIX Icon SVG -->
                    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:22px auto;">
                      <path d="M18.09 18.88C18.4 18.88 18.7 18.75 18.92 18.52L21.28 16.13C21.37 16.04 21.49 15.99 21.62 15.99C21.75 15.99 21.87 16.04 21.96 16.13L24.33 18.52C24.55 18.75 24.85 18.88 25.16 18.88H25.65L22.98 21.59C22.76 21.81 22.46 21.93 22.14 21.93C21.82 21.93 21.52 21.81 21.3 21.59L18.61 18.88H18.09ZM25.16 25.12C24.85 25.12 24.55 24.99 24.33 24.76L21.96 22.37C21.87 22.28 21.75 22.23 21.62 22.23C21.49 22.23 21.37 22.28 21.28 22.37L18.92 24.76C18.7 24.99 18.4 25.12 18.09 25.12H17.59L20.27 27.84C20.73 28.3 21.36 28.56 22.02 28.56C22.68 28.56 23.31 28.3 23.77 27.84L26.44 25.12H25.16ZM15.33 20.65L16.97 19.01H18.09C18.52 19.01 18.93 19.18 19.23 19.49L21.3 21.59C21.41 21.7 21.54 21.79 21.68 21.84C21.82 21.9 21.97 21.93 22.12 21.93C22.27 21.93 22.42 21.9 22.56 21.84C22.7 21.79 22.83 21.7 22.94 21.59L25.01 19.49C25.31 19.18 25.72 19.01 26.15 19.01H27.27L28.91 20.65C29.37 21.11 29.63 21.74 29.63 22.4C29.63 23.06 29.37 23.69 28.91 24.15L27.27 25.79H26.15C25.72 25.79 25.31 25.62 25.01 25.31L22.94 23.21C22.72 22.99 22.42 22.87 22.12 22.87C21.82 22.87 21.52 22.99 21.3 23.21L19.23 25.31C18.93 25.62 18.52 25.79 18.09 25.79H16.97L15.33 24.15C14.87 23.69 14.61 23.06 14.61 22.4C14.61 21.74 14.87 21.11 15.33 20.65Z" fill="#1FAD7B"/>
                    </svg>
                  </div>
                </div>

                <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#09090B;letter-spacing:-0.5px;">
                  Quase lá! Seu pedido está reservado.
                </h1>
                <p style="margin:0;font-size:15px;color:#71717A;line-height:1.6;">
                  Olá <strong style="color:#18181B;">${firstName}</strong>, notamos que você não finalizou o pagamento.<br/>
                  Para garantir sua reserva, disponibilizamos o acesso rápido ao seu código Pix abaixo.
                </p>
              </div>

              <!-- Divisor -->
              <div style="height:1px;background:#F4F4F5;margin:0 40px;"></div>

              <!-- Valor + CTA -->
              <div style="padding:24px 40px 32px;text-align:center;">
                <p style="margin:0 0 4px;font-size:13px;color:#A1A1AA;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">
                  Valor a pagar
                </p>
                <p style="margin:0 0 24px;font-size:32px;font-weight:900;color:#09090B;letter-spacing:-1px;">
                  ${amountFormatted}
                </p>

                <!-- Botão CTA -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center">
                      <a href="${recoveryUrl}"
                         style="display:inline-block;background:#1FAD7B;color:#fff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:12px;letter-spacing:0.2px;">
                        Acessar código PIX →
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:20px 0 0;font-size:12px;color:#A1A1AA;line-height:1.6;">
                  O PIX pode demorar alguns minutos até ser processado após o pagamento.<br/>
                  Caso você já tenha pago, desconsidere este e-mail.
                </p>
              </div>

              <!-- Divisor -->
              <div style="height:8px;background:#F9F9F9;border-top:1px solid #F4F4F5;border-bottom:1px solid #F4F4F5;"></div>

              <!-- Resumo do pedido -->
              <div style="padding:24px 40px 32px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:13px;font-weight:700;color:#09090B;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:16px;">
                      Seu pedido
                    </td>
                    <td align="right" style="font-size:13px;font-weight:700;color:#A1A1AA;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:16px;">
                      Qtde.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom:16px;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align:middle;padding-right:12px;">
                            ${productImgHtml}
                          </td>
                          <td style="vertical-align:middle;">
                            <span style="font-size:14px;font-weight:600;color:#18181B;">${productName}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" style="vertical-align:middle;font-size:14px;font-weight:600;color:#18181B;padding-bottom:16px;">
                      × 1
                    </td>
                  </tr>
                </table>

                <!-- Divisor -->
                <div style="height:1px;background:#F4F4F5;margin-bottom:12px;"></div>

                <!-- Subtotal -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                  <tr>
                    <td style="font-size:13px;color:#71717A;">Subtotal</td>
                    <td align="right" style="font-size:13px;color:#71717A;">${amountFormatted}</td>
                  </tr>
                </table>

                <!-- Total -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:15px;font-weight:800;color:#09090B;">Total</td>
                    <td align="right" style="font-size:15px;font-weight:800;color:#09090B;">${amountFormatted}</td>
                  </tr>
                </table>
              </div>

            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#A1A1AA;line-height:1.6;">
                Você está recebendo este e-mail porque iniciou uma compra na
                <a href="${SITE_URL}" style="color:#1FAD7B;text-decoration:none;">Bestfy</a>.<br/>
                Se não reconhece esta compra, ignore com segurança.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#D4D4D8;">
                © ${new Date().getFullYear()} Bestfy · checkt@bestfybr.com.br
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Handler principal ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // ── Busca vendas PIX pendentes com 3+ minutos sem e-mail enviado ──────────
    // Janela: entre 3 e 60 minutos (evita reprocessar vendas antigas demais)
    const { data: sales, error } = await supabase
      .from('sales')
      .select(`
        id,
        amount,
        customer_name,
        customer_email,
        product_id,
        products ( name, image_url )
      `)
      .eq('status', 'pending')
      .eq('email_recuperacao_enviado', false)
      .lte('created_at', new Date(Date.now() - 3 * 60 * 1000).toISOString())
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

    if (error) {
      console.error('[pix-nudge] Erro ao buscar vendas:', error.message)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!sales || sales.length === 0) {
      console.log('[pix-nudge] Nenhuma venda para notificar.')
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`[pix-nudge] Processando ${sales.length} venda(s)...`)

    let sent = 0
    let failed = 0

    for (const sale of sales) {
      const product     = (sale.products as { name: string; image_url: string | null } | null)
      const productName = product?.name ?? 'Produto'
      const imageUrl    = product?.image_url ?? null

      try {
        const subject = `Re: Finalize sua compra - Seu Pix está aguardando (${brl(sale.amount)})`
        const html    = pixNudgeTemplate({
          customerName: sale.customer_name,
          productName,
          amount:       Number(sale.amount),
          saleId:       sale.id,
          productImage: imageUrl,
        })

        // ── Envia via Postmark ────────────────────────────────────────────────
        const pmRes = await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            'Content-Type':            'application/json',
            'Accept':                  'application/json',
            'X-Postmark-Server-Token': POSTMARK_TOKEN,
          },
          body: JSON.stringify({
            From:          `${FROM_NAME} <${FROM_EMAIL}>`,
            To:            sale.customer_email,
            Subject:       subject,
            HtmlBody:      html,
            TextBody:      `Olá! Seu PIX está aguardando. Acesse: ${SITE_URL}/checkout/recuperar/${sale.id}`,
            Tag:           'pix-nudge',
            TrackOpens:    true,
            MessageStream: 'outbound',
          }),
        })

        const pmBody = await pmRes.json()

        if (!pmRes.ok) {
          console.error(`[pix-nudge] Postmark erro para ${sale.id}:`, pmBody)
          failed++
          continue
        }

        // ── Marca como enviado (idempotência) ─────────────────────────────────
        const { error: updateErr } = await supabase
          .from('sales')
          .update({ email_recuperacao_enviado: true })
          .eq('id', sale.id)

        if (updateErr) {
          console.error(`[pix-nudge] Erro ao marcar venda ${sale.id}:`, updateErr.message)
          failed++
          continue
        }

        console.log(`[pix-nudge] ✓ E-mail enviado para ${sale.customer_email} — venda ${sale.id}`)
        sent++

      } catch (err) {
        console.error(`[pix-nudge] Erro inesperado na venda ${sale.id}:`, err?.message)
        failed++
      }
    }

    return new Response(JSON.stringify({ processed: sales.length, sent, failed }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[pix-nudge] Erro interno:', err?.message)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
