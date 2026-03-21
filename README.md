# Checkout Digital — Bestfy

> **SaaS de Checkout de Alta Conversão** — múltiplos modelos visuais por produto, gestão de ofertas, cupons, Order Bumps, Upsell/Downsell, recuperação automática de vendas PIX abandonadas, e-mails transacionais customizados e confirmação de pagamento em tempo real.

---

## Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React + Vite | 18 / 5 |
| Estilização | Tailwind CSS | 3.4 |
| Ícones | Lucide React | latest |
| Roteamento | React Router DOM | 6 |
| Drag-and-drop | @dnd-kit | 6 / 10 |
| Backend / DB | Supabase (PostgreSQL + Auth + Realtime) | 2 |
| Edge Functions | Deno (TypeScript) via Supabase Functions | — |
| E-mail transacional | Postmark | — |
| Gateway de pagamento | Bestfy API (PIX) | v1 |
| Agendamento | pg_cron + pg_net (Supabase) | — |
| Deploy frontend | Vercel | — |

---

## Funcionalidades

### Checkout Público
- Página de compra por produto (`/checkout/:productId`) com suporte a ofertas variantes e order bumps
- Cupons de desconto com validação server-side (período de validade + pertence ao produto)
- Geração de PIX com QR Code e Copia e Cola em tempo real
- **Price Protection**: valor sempre lido do banco, nunca definido pelo frontend
- **Idempotência**: chave única por sessão previne cobranças duplicadas em cliques repetidos
- **Anti-F5**: `saleId` gravado na URL — recarregar restaura o QR Code ou exibe tela de sucesso
- Personalização visual completa por produto: logo do vendedor, cores, timer de urgência

### Recuperação de Vendas Abandonadas (PIX Nudge)
- Worker pg_cron executado a cada minuto monitora transações PIX pendentes
- Após 3 minutos sem pagamento, dispara e-mail de recuperação via Postmark (envio único por venda)
- Página de recuperação (`/checkout/recuperar/:saleId`) com:
  - Countdown de urgência: âmbar acima de 5 min, vermelho abaixo de 5 min
  - PIX ainda válido → exibe QR code existente
  - PIX expirado → gera novo código silenciosamente via Bestfy e atualiza o banco
  - Supabase Realtime: muda automaticamente para tela de sucesso ao confirmar pagamento

### Upsell / Downsell
- Oferta pós-pagamento ativada via token de sessão (256 bits, 30 min, uso único)
- Token gerado no backend após confirmação do webhook — nunca exposto no frontend
- Gerador de script Web Component (`<bestfy-upsell>`) para embutir em páginas externas
- Log de auditoria completo: `session_created`, `accepted`, `rejected`, `expired`

### E-mails Transacionais
- Templates HTML responsivos com logo oficial da Bestfy
- Tipos: confirmação de cadastro, redefinição de senha, magic link, convite, recuperação de PIX
- Enviados via Postmark com rastreamento de abertura
- Hook do Supabase Auth (`send-email`) intercepta todos os e-mails do sistema

### Autenticação e Contas
- Cadastro e login com Supabase Auth
- Redefinição de senha via link direto para `/reset-password` (verifyOtp client-side)
- Anonymous sign-in para sessões de checkout (sem fricção para o comprador)

### Painel do Vendedor
- Dashboard com visão geral de vendas e onboarding guiado
- CRUD de produtos com imagem, descrição e preço
- Editor visual de checkout por produto (logo, cores, timer, bumps, upsells)
- Página de integrações (chave da API Bestfy com validação server-side)
- Listagem de transações com status em tempo real

### Multi-tenant por RLS
- Cada vendedor acessa exclusivamente seus próprios dados
- Row Level Security do PostgreSQL garante isolamento total em nível de banco

---

## Edge Functions

| Função | Método | Descrição |
|--------|--------|-----------|
| `send-email` | POST (hook) | Recebe hook do Supabase Auth e envia e-mails via Postmark |
| `create-transaction` | POST | Cria cobrança PIX na Bestfy e registra venda no banco |
| `bestfy-webhook` | POST | Recebe eventos da Bestfy (HMAC-SHA256), atualiza status da venda |
| `get-delivery-url` | POST | Retorna URL de entrega do produto após pagamento confirmado |
| `create-upsell-session` | POST | Emite token de sessão de upsell após pagamento |
| `pix-nudge` | POST | Worker: detecta PIX abandonados e dispara e-mails de recuperação |
| `recover-pix` | GET | Retorna dados da venda e renova PIX expirado silenciosamente |
| `validate-bestfy` | POST | Valida chave de API da Bestfy informada pelo vendedor |

---

## Arquitetura de Segurança

| Camada | Proteção |
|--------|----------|
| **JWT** | `--no-verify-jwt` no gateway; verificação interna via `adminClient.auth.getUser()` — aceita sessões anônimas e autenticadas |
| **Price Protection** | Preço sempre lido do banco — frontend nunca define valores de cobrança |
| **Idempotência** | `UNIQUE INDEX` em `sales.idempotency_key` previne cobranças duplicadas |
| **Webhook HMAC** | `bestfy-webhook` valida assinatura HMAC-SHA256 da Bestfy; rejeita payloads inválidos |
| **Proteção de estado** | Vendas pagas não retrocedem para `pending`/`failed` via webhook |
| **Anti-replay** | Webhook rejeita eventos com timestamp > 5 minutos |
| **CORS restrito** | Secret `APP_URL` define origens permitidas; outras origens recebem 403 |
| **RLS** | Row Level Security em todas as tabelas — isolamento total entre vendedores |
| **Sessões de upsell** | Token hex de 32 bytes (256 bits), expiração 30 min, uso único |
| **IDs opacos** | Links de recuperação usam UUIDs (122 bits de entropia), resistentes a enumeração |
| **Formulários** | Honeypot, timing check, rate limiter progressivo, validação de nome/e-mail/senha |

---

## Banco de Dados

### Modelo Relacional

```
auth.users (Supabase Auth)
    │
    ├──► profiles                  ← bestfy_api_key, nome da empresa
    │
    └──► products                  ← nome, preço, imagem, delivery_url, upsell_settings
              │
              ├──► product_offers          ← variações de preço (até 10)
              │         │
              │         └──► checkout_offer_variants   ← junção M:N
              │                     │
              ├──► product_checkouts ──────┘  ← modelos visuais (settings JSONB)
              │
              ├──► product_order_bumps     ← bumps com posição e configurações
              │
              ├──► product_upsells         ← funis upsell/downsell
              │
              ├──► coupons                ← cupons de desconto por produto
              │
              └──► sales                  ← registro de cada transação
                        │
                        └──► upsell_sessions   ← tokens de sessão pós-pagamento
```

### Migrations

| # | Arquivo | Descrição |
|---|---------|-----------|
| 001 | `create_products` | Tabela de produtos com RLS |
| 002 | `create_profiles` | Perfis de vendedores + trigger auto-criação |
| 003 | `create_sales` | Tabela de vendas com RLS |
| 004 | `update_sales_columns` | Adiciona `bestfy_id`, `qr_code_url`, `qr_code_text` |
| 005 | `add_allow_coupons` | Flag de cupons por produto |
| 006 | `add_product_image` | Imagem do produto |
| 007 | `add_checkout_settings` | Configurações visuais do checkout |
| 008 | `create_coupons` | Cupons com validade e desconto percentual |
| 009 | `create_product_offers` | Variantes de oferta por produto |
| 010 | `create_checkout_models` | Modelos de checkout |
| 011 | `checkout_offer_variants` | Junção M:N entre ofertas e checkouts |
| 012 | `add_settings_to_product_checkouts` | Configurações avançadas de checkout |
| 013 | `create_product_order_bumps` | Order bumps com drag-and-drop |
| 014 | `add_upsell_settings` | Configurações de upsell |
| 015 | `create_product_upsells` | Funis de upsell/downsell |
| 016 | `upsell_hardening` | Idempotência + sessões de upsell + log de auditoria |
| 017 | `pix_nudge` | Coluna `email_recuperacao_enviado` + índice parcial para o worker |

---

## Rotas da Aplicação

| Rota | Acesso | Descrição |
|------|--------|-----------|
| `/login` | Público | Login do vendedor |
| `/register` | Público | Cadastro do vendedor |
| `/reset-password` | Público | Redefinição de senha via link |
| `/checkout/:productId` | Público | Página de compra com Order Bumps |
| `/checkout/recuperar/:saleId` | Público | Recuperação de PIX abandonado |
| `/dashboard` | Autenticado | Painel com stats e onboarding |
| `/products` | Autenticado | Listagem e gerenciamento de produtos |
| `/products/:id` | Autenticado | Edição: Geral, Cupons, Checkout, Links, Order Bump, Upsell |
| `/products/:id/checkout-editor/:checkoutId` | Autenticado | Editor visual isolado por modelo |
| `/integrations` | Autenticado | Configurar chave da API Bestfy |
| `/transactions` | Autenticado | Histórico de vendas com status em tempo real |

---

## Fluxos Principais

### Pagamento PIX

```
Cliente preenche checkout
        ↓
create-transaction (Edge Function)
  → verifica JWT anônimo
  → lê preço do banco (price protection)
  → aplica cupom server-side
  → cria cobrança na Bestfy API
  → salva venda com status 'pending'
        ↓
Cliente escaneia QR Code / copia código
        ↓
Bestfy confirma pagamento → bestfy-webhook
  → verifica assinatura HMAC-SHA256
  → atualiza status para 'paid'
  → Supabase Realtime notifica o frontend
        ↓
Tela de confirmação exibida automaticamente
```

### Recuperação de Venda Abandonada

```
pg_cron → pix-nudge (a cada minuto)
  → busca: status=pending, email não enviado, criado há 3–60 min
  → envia e-mail de recuperação via Postmark
  → marca email_recuperacao_enviado = true (idempotência)
        ↓
Cliente clica no link do e-mail
        ↓
/checkout/recuperar/:saleId → recover-pix (Edge Function)
  → PIX < 30 min: retorna QR code existente com countdown
  → PIX > 30 min: gera novo código na Bestfy, atualiza banco
        ↓
Cliente paga → bestfy-webhook atualiza status
  → Realtime exibe tela de sucesso automaticamente
```

---

## Variáveis de Ambiente

### Frontend (`.env`)

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
VITE_APP_URL=https://seu-dominio.com.br
```

### Supabase Secrets

Configurar em **Dashboard → Settings → Edge Functions → Secrets**:

```
POSTMARK_SERVER_TOKEN=
SEND_EMAIL_HOOK_SECRET=
BESTFY_WEBHOOK_SECRET=
APP_URL=https://seu-dominio.com.br,http://localhost:5173
```

---

## Setup e Deploy

### Desenvolvimento local

```bash
npm install
npm run dev
```

### Deploy das Edge Functions

```bash
supabase functions deploy send-email --no-verify-jwt
supabase functions deploy create-transaction --no-verify-jwt
supabase functions deploy bestfy-webhook
supabase functions deploy get-delivery-url --no-verify-jwt
supabase functions deploy create-upsell-session --no-verify-jwt
supabase functions deploy pix-nudge --no-verify-jwt
supabase functions deploy recover-pix --no-verify-jwt
supabase functions deploy validate-bestfy --no-verify-jwt
```

### Agendamento do PIX Nudge

Habilite `pg_cron` e `pg_net` em **Database → Extensions**, depois execute no SQL Editor:

```sql
SELECT cron.schedule(
  'pix-nudge-every-minute',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/pix-nudge',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := '{}'::jsonb
    );
  $$
);
```

### Deploy do frontend

```bash
vercel --prod
```

---

## Roadmap

### Concluído

| Feature | Status |
|---------|--------|
| Multi-checkout com identidade visual independente | ✅ |
| Gestão de ofertas (M:N com checkouts) | ✅ |
| PIX com confirmação em tempo real (Supabase Realtime) | ✅ |
| Cupons de desconto com validação server-side | ✅ |
| Order Bumps com drag-and-drop | ✅ |
| Upsell / Downsell com gerador de script Web Component | ✅ |
| E-mails transacionais customizados (Postmark) | ✅ |
| Redefinição de senha por e-mail | ✅ |
| Hardening de segurança (HMAC, idempotência, RLS, price protection) | ✅ |
| Recuperação automática de vendas PIX abandonadas (PIX Nudge) | ✅ |

### Próximas Entregas

| # | Feature | Descrição |
|---|---------|-----------|
| 1 | **Tracking de recuperação** | Coluna `recovery_clicked_at` + janela de atribuição de 24h |
| 2 | **Pixels de Rastreamento** | Meta Pixel e Google Tag Manager por produto |
| 3 | **Relatórios Avançados** | Taxa de conversão do PIX Nudge, receita recuperada, funil completo |
| 4 | **Área de Membros** | Plataforma de cursos integrada com controle de acesso por produto |
| 5 | **Checkout Embutido** | Widget iframe para landing pages externas |
| 6 | **Boleto / Cartão** | Suporte a múltiplos métodos de pagamento |

---

*Desenvolvido com React 18, Supabase e integração Bestfy PIX.*
