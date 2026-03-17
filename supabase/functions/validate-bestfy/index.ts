import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    // ── Lê o body ─────────────────────────────────────────────────────────
    // "Enforce JWT" desativado no painel — autenticação gerenciada pelo frontend
    const { apiKey } = await req.json()

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return new Response(JSON.stringify({ error: 'apiKey is required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── 3. Valida na Bestfy (server-side — sem CORS, key nunca exposta) ──────
    const bestfyRes = await fetch('https://api.bestfy.io/company/validate-api-key', {
      method: 'GET',
      headers: { 'x-api-key': apiKey.trim() },
    })

    const body = await bestfyRes.json().catch(() => ({}))

    if (!bestfyRes.ok) {
      return new Response(
        JSON.stringify({ valid: false, status: bestfyRes.status }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const company = body?.company ?? body

    return new Response(
      JSON.stringify({ valid: true, company }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', detail: err?.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
