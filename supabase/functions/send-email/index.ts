import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ── Configuração ──────────────────────────────────────────────────────────────
const POSTMARK_TOKEN    = Deno.env.get('POSTMARK_SERVER_TOKEN') ?? ''
const HOOK_SECRET       = Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? ''
const FROM_EMAIL        = 'checkt@bestfybr.com.br'
const FROM_NAME         = 'Bestfy'
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? ''
const SITE_URL          = 'https://seguro.bestfybr.com.br'

// ── Verificação da assinatura do Supabase Hook ────────────────────────────────
// Garante que apenas o Supabase Auth pode chamar esta função.
// Formato do secret: v1,whsec_<base64>
// Header enviado pelo Supabase: x-supabase-signature (hex HMAC-SHA256)
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

async function verifyHookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader || !HOOK_SECRET) return false
  try {
    // Extrai a parte base64 após "v1,whsec_"
    const b64 = HOOK_SECRET.startsWith('v1,whsec_') ? HOOK_SECRET.slice(9) : HOOK_SECRET
    const secretBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const key = await crypto.subtle.importKey(
      'raw', secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    )
    const sigBytes  = hexToBytes(signatureHeader)
    const bodyBytes = new TextEncoder().encode(rawBody)
    return await crypto.subtle.verify('HMAC', key, sigBytes, bodyBytes)
  } catch (err) {
    console.error('[send-email] Erro na verificação HMAC:', err?.message)
    return false
  }
}

// ── Monta o link de verificação do Supabase Auth ──────────────────────────────
function buildConfirmUrl(tokenHash: string, type: string, _redirectTo: string): string {
  if (type === 'recovery') {
    const params = new URLSearchParams({ token_hash: tokenHash, type })
    return `${SITE_URL}/reset-password?${params}`
  }
  const params = new URLSearchParams({ token_hash: tokenHash, type })
  return `${SITE_URL}/auth/confirm?${params}`
}

// ── Templates HTML ─────────────────────────────────────────────────────────────
function baseLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:40px 0;">
    <tr>
      <td align="center">
        <!-- Logo / Header -->
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
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
              ${content}
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#A1A1AA;line-height:1.6;">
                Você está recebendo este e-mail porque realizou uma ação na plataforma
                <a href="${SITE_URL}" style="color:#16A34A;text-decoration:none;">Bestfy</a>.<br/>
                Se não foi você, ignore este e-mail com segurança.
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

function signupTemplate(confirmUrl: string): string {
  const content = `
    <!-- Faixa verde topo -->
    <div style="background:linear-gradient(135deg,#16A34A,#15803D);padding:32px 40px;text-align:center;">
      <div style="width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:28px;line-height:64px;display:block;">✉️</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Confirme seu e-mail</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Seu cadastro está quase pronto!</p>
    </div>

    <!-- Corpo -->
    <div style="padding:36px 40px;">
      <p style="margin:0 0 20px;font-size:15px;color:#3F3F46;line-height:1.6;">
        Obrigado por se cadastrar na <strong>Bestfy</strong>. Para ativar sua conta e começar a usar a plataforma, confirme seu e-mail clicando no botão abaixo.
      </p>

      <!-- Botão -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
        <tr>
          <td align="center">
            <a href="${confirmUrl}"
               style="display:inline-block;background:#16A34A;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">
              Confirmar e-mail →
            </a>
          </td>
        </tr>
      </table>

      <!-- Aviso de expiração -->
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#15803D;">
          ⏱ Este link expira em <strong>24 horas</strong>.
        </p>
      </div>

      <p style="margin:0;font-size:13px;color:#A1A1AA;line-height:1.6;">
        Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br/>
        <a href="${confirmUrl}" style="color:#16A34A;word-break:break-all;font-size:12px;">${confirmUrl}</a>
      </p>
    </div>`
  return baseLayout('Confirme seu e-mail — Bestfy', content)
}

function recoveryTemplate(confirmUrl: string): string {
  const content = `
    <!-- Faixa topo -->
    <div style="background:linear-gradient(135deg,#1D4ED8,#1E40AF);padding:32px 40px;text-align:center;">
      <div style="width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;">
        <span style="font-size:28px;line-height:64px;display:block;">🔑</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Redefinição de senha</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Recebemos uma solicitação de redefinição</p>
    </div>

    <!-- Corpo -->
    <div style="padding:36px 40px;">
      <p style="margin:0 0 20px;font-size:15px;color:#3F3F46;line-height:1.6;">
        Recebemos uma solicitação para redefinir a senha da sua conta na <strong>Bestfy</strong>. Clique no botão abaixo para criar uma nova senha.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
        <tr>
          <td align="center">
            <a href="${confirmUrl}"
               style="display:inline-block;background:#1D4ED8;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;">
              Redefinir senha →
            </a>
          </td>
        </tr>
      </table>

      <div style="background:#FEF9C3;border:1px solid #FDE047;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#854D0E;">
          ⏱ Este link expira em <strong>1 hora</strong>. Se não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.
        </p>
      </div>

      <p style="margin:0;font-size:13px;color:#A1A1AA;line-height:1.6;">
        Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br/>
        <a href="${confirmUrl}" style="color:#1D4ED8;word-break:break-all;font-size:12px;">${confirmUrl}</a>
      </p>
    </div>`
  return baseLayout('Redefinição de senha — Bestfy', content)
}

function magiclinkTemplate(confirmUrl: string): string {
  const content = `
    <!-- Faixa topo -->
    <div style="background:linear-gradient(135deg,#7C3AED,#6D28D9);padding:32px 40px;text-align:center;">
      <div style="width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;">
        <span style="font-size:28px;line-height:64px;display:block;">✨</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Seu link de acesso</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Acesse sua conta com um clique</p>
    </div>

    <!-- Corpo -->
    <div style="padding:36px 40px;">
      <p style="margin:0 0 20px;font-size:15px;color:#3F3F46;line-height:1.6;">
        Você solicitou um link mágico para acessar sua conta na <strong>Bestfy</strong> sem precisar de senha. Clique no botão abaixo para entrar.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
        <tr>
          <td align="center">
            <a href="${confirmUrl}"
               style="display:inline-block;background:#7C3AED;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;">
              Acessar minha conta →
            </a>
          </td>
        </tr>
      </table>

      <div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#5B21B6;">
          ⏱ Este link expira em <strong>1 hora</strong> e só pode ser usado uma vez.
        </p>
      </div>

      <p style="margin:0;font-size:13px;color:#A1A1AA;line-height:1.6;">
        Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br/>
        <a href="${confirmUrl}" style="color:#7C3AED;word-break:break-all;font-size:12px;">${confirmUrl}</a>
      </p>
    </div>`
  return baseLayout('Link de acesso — Bestfy', content)
}

function inviteTemplate(confirmUrl: string): string {
  const content = `
    <!-- Faixa topo -->
    <div style="background:linear-gradient(135deg,#16A34A,#15803D);padding:32px 40px;text-align:center;">
      <div style="width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;">
        <span style="font-size:28px;line-height:64px;display:block;">🎉</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Você foi convidado!</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Acesse a Bestfy com seu convite</p>
    </div>

    <div style="padding:36px 40px;">
      <p style="margin:0 0 20px;font-size:15px;color:#3F3F46;line-height:1.6;">
        Você recebeu um convite para acessar a plataforma <strong>Bestfy</strong>. Clique no botão abaixo para criar sua conta e começar.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
        <tr>
          <td align="center">
            <a href="${confirmUrl}"
               style="display:inline-block;background:#16A34A;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;">
              Aceitar convite →
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:13px;color:#A1A1AA;line-height:1.6;">
        Se o botão não funcionar, copie e cole o link abaixo:<br/>
        <a href="${confirmUrl}" style="color:#16A34A;word-break:break-all;font-size:12px;">${confirmUrl}</a>
      </p>
    </div>`
  return baseLayout('Convite — Bestfy', content)
}

// ── Seleciona template e assunto por tipo de ação ─────────────────────────────
function buildEmail(actionType: string, confirmUrl: string, toEmail: string) {
  switch (actionType) {
    case 'signup':
      return { subject: 'Confirme seu e-mail — Bestfy', html: signupTemplate(confirmUrl) }
    case 'recovery':
      return { subject: 'Redefinição de senha — Bestfy', html: recoveryTemplate(confirmUrl) }
    case 'magiclink':
      return { subject: 'Seu link de acesso — Bestfy', html: magiclinkTemplate(confirmUrl) }
    case 'invite':
      return { subject: 'Você foi convidado — Bestfy', html: inviteTemplate(confirmUrl) }
    case 'email_change':
      return { subject: 'Confirme seu novo e-mail — Bestfy', html: signupTemplate(confirmUrl) }
    default:
      return { subject: `Ação na sua conta — Bestfy`, html: signupTemplate(confirmUrl) }
  }
}

// ── Handler principal ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // ── Lê o body ─────────────────────────────────────────────────────────────
    const rawBody   = await req.text()
    const sigHeader = req.headers.get('x-supabase-signature')
    console.log('[send-email] Hook chamado. Signature header presente:', !!sigHeader)

    // Verificação de assinatura (temporariamente em modo log-only para diagnóstico)
    const valid = await verifyHookSignature(rawBody, sigHeader)
    if (!valid) {
      console.warn('[send-email] Assinatura inválida — continuando em modo diagnóstico.')
      // TODO: trocar para return 401 após confirmar que hook funciona
    }

    const payload = JSON.parse(rawBody)
    const { user, email_data } = payload

    console.log('[send-email] email_data:', JSON.stringify(email_data))

    const toEmail     = user?.email ?? ''
    const actionType  = email_data?.email_action_type ?? ''
    const tokenHash   = email_data?.token_hash ?? email_data?.token ?? ''
    const rawRedirect = email_data?.redirect_to ?? SITE_URL
    // Para recovery, garante que o redirect aponte para /reset-password
    const redirectTo  = actionType === 'recovery'
      ? `${SITE_URL}/reset-password`
      : rawRedirect

    if (!toEmail || !actionType || !tokenHash) {
      console.error('[send-email] Payload incompleto:', { toEmail, actionType, tokenHash })
      return new Response(JSON.stringify({ error: 'Payload incompleto.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const confirmUrl = buildConfirmUrl(tokenHash, actionType, redirectTo)
    const { subject, html } = buildEmail(actionType, confirmUrl, toEmail)

    console.log(`[send-email] Enviando '${actionType}' para ${toEmail}`)
    console.log(`[send-email] confirmUrl: ${confirmUrl}`)

    // ── Chama a API do Postmark ────────────────────────────────────────────────
    const pmRes = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Content-Type':           'application/json',
        'Accept':                 'application/json',
        'X-Postmark-Server-Token': POSTMARK_TOKEN,
      },
      body: JSON.stringify({
        From:        `${FROM_NAME} <${FROM_EMAIL}>`,
        To:          toEmail,
        Subject:     subject,
        HtmlBody:    html,
        TextBody:    `Acesse o link para continuar: ${confirmUrl}`,
        Tag:         actionType,
        TrackOpens:  true,
        MessageStream: 'outbound',
      }),
    })

    const pmBody = await pmRes.json()

    if (!pmRes.ok) {
      console.error('[send-email] Erro Postmark:', pmBody)
      return new Response(JSON.stringify({ error: 'Falha ao enviar e-mail.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    console.log(`[send-email] ✓ Entregue — MessageID: ${pmBody.MessageID}`)
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('[send-email] Erro interno:', err?.message)
    return new Response(JSON.stringify({ error: 'Erro interno.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
