# Checkout Digital

> **SaaS de Checkout de Alta Conversão** — múltiplos modelos visuais por produto, gestão de ofertas, cupons, Order Bumps, Upsell/Downsell, confirmação de pagamento via PIX em tempo real e Área de Membros integrada.

---

## Funcionalidades

### Sistema Multi-Checkout com Identidade Visual Independente
Cada produto pode ter **N modelos de checkout**, cada um com sua própria combinação de cores, logomarca, temporizador e cor dos botões. Um Checkout A pode ser verde com a logo da marca A, enquanto o Checkout B é azul com a logo da marca B — completamente isolados.

### Gestão de Ofertas com Tabela de Junção
Uma oferta pode pertencer a múltiplos checkouts simultaneamente. A arquitetura usa a tabela `checkout_offer_variants` para relacionar `product_offers ↔ product_checkouts` sem duplicação de dados.

### PIX com Confirmação em Tempo Real
O comprador paga e a tela muda sozinha — sem refresh. Alimentado por **Supabase Realtime** escutando o webhook da Bestfy via PostgreSQL Change Streams.

### Anti-F5: Sessão Persistente
O `saleId` é gravado na URL (`?sale=uuid`). Ao recarregar, o sistema restaura automaticamente o QR Code (se pendente) ou exibe a tela de confirmação (se pago).

### Cupons de Desconto
Códigos com desconto percentual, data de início e expiração opcionais. Validados no frontend e reaplicados server-side na Edge Function `create-transaction` para segurança total.

### Múltiplas Ofertas por Produto
Até 10 variações de preço por produto (pagamento único ou recorrente), com seletor visual no checkout público. Preço da oferta principal sincronizado bidirecionalmente com o preço do produto.

### Links de Venda por Combinação Oferta × Checkout
Cada par oferta/checkout gera um link exclusivo com os parâmetros `?off=` e `?chk=` pré-selecionados, permitindo campanhas de marketing segmentadas.

### Order Bumps
Produtos complementares exibidos no checkout público entre o PIX e o botão de finalização. O vendedor configura CTA, título, descrição, desconto e posição. Os bumps selecionados são somados ao total em tempo real com animação suave. A ordem dos bumps é gerenciada via **drag-and-drop** com `@dnd-kit`.

### Upsell / Downsell
Gerador de funis pós-compra. O vendedor configura o comportamento ao aceitar/rejeitar a oferta e gera um script de **Web Component** (`<bestfy-upsell>`) para embutir em páginas externas.

### Checkout Visual Customizável
Além de cores de botões e logo, o editor permite configurar:
- Cor do header do checkout (`header_bg_color` / `header_text_color`)
- Cor do card de Order Bump (`bump_color`)

### Dashboard com Onboarding Guiado
Checklist interativo que orienta o vendedor nos primeiros passos: conectar gateway e criar o primeiro produto.

### Multi-tenant por RLS
Cada vendedor gerencia exclusivamente seus próprios dados. O Row Level Security do PostgreSQL garante isolamento total em nível de banco, sem filtros manuais no código.

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | React + Vite | 18 / 5 |
| Estilização | Tailwind CSS | 3.4 |
| Ícones | Lucide React | latest |
| Roteamento | React Router DOM | 6 |
| Drag-and-drop | @dnd-kit | 6 / 10 |
| Backend / DB | Supabase (PostgreSQL) | 2 |
| Realtime | Supabase Realtime | nativo |
| Edge Functions | Deno (TypeScript) | nativo |
| Pagamentos | Bestfy API (PIX) | v1 |

---

## Arquitetura do Banco de Dados

### Modelo Relacional

```
auth.users (Supabase Auth)
    │
    ├──► profiles               ← bestfy_api_key, nome da empresa
    │
    └──► products               ← nome, preço, imagem, delivery_url, upsell_settings
              │
              ├──► product_offers         ← variações de preço (até 10)
              │         │
              │         └──► checkout_offer_variants  ← junção M:N
              │                     │
              ├──► product_checkouts ──┘  ← modelos visuais (settings JSONB)
              │
              ├──► product_order_bumps    ← bumps com posição e configurações
              │
              ├──► product_upsells        ← funis upsell/downsell
              │
              ├──► coupons               ← cupons de desconto por produto
              │
              └──► sales                 ← registro de cada transação
```

### Tabelas

| Tabela | Descrição |
|---|---|
| `profiles` | Dados do vendedor, `bestfy_api_key` |
| `products` | Catálogo com imagem, link de entrega e `upsell_settings` (JSONB) |
| `product_offers` | Ofertas/variações de preço por produto |
| `product_checkouts` | Modelos de checkout com `settings` JSONB (cores, logo, timer) |
| `checkout_offer_variants` | Junção M:N entre `offer_id` e `checkout_id` |
| `product_order_bumps` | Bumps com CTA, título, descrição, desconto e posição |
| `product_upsells` | Funis de upsell/downsell com ações ao aceitar/rejeitar |
| `coupons` | Cupons com desconto %, validade e restrições |
| `sales` | Transações com status realtime e dados do comprador |

### `product_checkouts.settings` (JSONB)

```json
{
  "logo_url":          "https://cdn.exemplo.com/logo.png",
  "logo_position":     "left",
  "timer_seconds":     600,
  "timer_bg_color":    "#EAB308",
  "timer_text_color":  "#713F12",
  "button_color":      "#16A34A",
  "bump_color":        "#16A34A",
  "header_bg_color":   "#FFFFFF",
  "header_text_color": "#18181B"
}
```

### `products.upsell_settings` (JSONB)

```json
{
  "has_custom_redirect":     true,
  "redirect_url":            "https://minha-pagina.com/obrigado",
  "send_confirmation_email": true,
  "email_timing":            "delayed",
  "email_delay_minutes":     10
}
```

### Link de Venda

```
/checkout/{productId}?off={offerId}&chk={checkoutId}
```

---

## Estrutura de Pastas

```
checkout-digital/
├── src/
│   ├── lib/
│   │   ├── supabaseClient.js           # Inicialização do cliente Supabase
│   │   ├── cache.js                    # Helpers de cache client-side (SWR)
│   │   └── formSecurity.js             # Validações, honeypot, rate limiter, força de senha
│   ├── contexts/
│   │   └── AuthContext.jsx             # Provider + hook useAuth
│   ├── components/
│   │   ├── ProtectedRoute.jsx          # Guard para rotas autenticadas
│   │   ├── DashboardLayout.jsx         # Layout com sidebar (dark/light logo)
│   │   ├── OnboardingGrid.jsx          # Checklist de onboarding do vendedor
│   │   ├── AuthLayout.jsx              # Layout compartilhado de login/cadastro
│   │   ├── BestfyIcon.jsx              # Ícone SVG da Bestfy
│   │   └── Skeleton.jsx                # Componentes de loading skeleton
│   └── pages/
│       ├── LoginPage.jsx               # Login com rate limiter + honeypot
│       ├── RegisterPage.jsx            # Cadastro com validação completa + indicador de senha
│       ├── DashboardPage.jsx           # Painel com stats e onboarding
│       ├── ProductsPage.jsx            # CRUD de produtos com busca e paginação
│       ├── ProductEditPage.jsx         # Edição: Geral | Cupons | Checkout | Links | Order Bump | Upsell
│       ├── CheckoutEditor.jsx          # Editor visual completo por modelo de checkout
│       ├── IntegrationsPage.jsx        # Configuração da API Key Bestfy
│       ├── TransactionsPage.jsx        # Histórico de vendas + QR Code
│       └── CheckoutPage.jsx            # Página pública de compra com Order Bumps
├── supabase/
│   ├── migrations/
│   │   ├── 001_create_products.sql
│   │   ├── 002_create_profiles.sql
│   │   ├── 003_create_sales.sql
│   │   ├── 004_update_sales_columns.sql
│   │   ├── 005_add_allow_coupons.sql
│   │   ├── 006_add_product_image.sql
│   │   ├── 007_add_checkout_settings.sql
│   │   ├── 008_create_coupons.sql
│   │   ├── 009_create_product_offers.sql
│   │   ├── 010_create_checkout_models.sql
│   │   ├── 011_checkout_offer_variants.sql
│   │   ├── 012_add_settings_to_product_checkouts.sql
│   │   ├── 013_create_product_order_bumps.sql
│   │   ├── 014_add_upsell_settings.sql
│   │   └── 015_create_product_upsells.sql
│   └── functions/
│       ├── validate-bestfy/index.ts
│       ├── create-transaction/index.ts
│       └── bestfy-webhook/index.ts
├── .env.example
└── package.json
```

---

## Fluxo de Pagamento

```
┌──────────────────────────────────────────────────────────────────┐
│                         FLUXO COMPLETO                           │
│                                                                  │
│  Comprador              Supabase                   Bestfy        │
│  ─────────              ────────                   ──────        │
│  Preenche form  ──────► Edge Function           ──► /payment     │
│                         create-transaction                        │
│                         (busca API Key do                         │
│                          vendedor no banco)    ◄── QR Code PIX   │
│                                                                  │
│  Exibe QR Code  ◄──────  Salva em sales{}                        │
│  (status=pending)        Retorna saleId                          │
│                                                                  │
│  ─ ─ ─ ─ ─ ─ comprador paga no banco ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│                                                                  │
│                          Edge Function     ◄── POST webhook      │
│                          bestfy-webhook        (status=PAID)     │
│                          UPDATE sales                            │
│                          status → 'paid'                         │
│                                                                  │
│  Tela "Pago!" ◄─────────  Supabase Realtime                      │
│  (automático)             (escuta o UPDATE)                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Rotas da Aplicação

| Rota | Acesso | Descrição |
|---|---|---|
| `/login` | Público | Login do vendedor |
| `/register` | Público | Cadastro do vendedor |
| `/checkout/:productId` | Público | Página de compra do cliente com Order Bumps |
| `/dashboard` | Autenticado | Painel com stats e onboarding |
| `/products` | Autenticado | Listagem, busca e gerenciamento de produtos |
| `/products/:id` | Autenticado | Edição: Geral, Cupons, Checkout, Links, Order Bump, Upsell/Downsell |
| `/products/:id/checkout-editor/:checkoutId` | Autenticado | Editor visual isolado por modelo |
| `/integrations` | Autenticado | Configurar chave da API Bestfy |
| `/transactions` | Autenticado | Histórico de vendas com QR Code |

---

## Instalação e Configuração

### 1. Clone e instale as dependências

```bash
git clone https://github.com/seu-usuario/checkout-digital.git
cd checkout-digital
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
VITE_APP_URL=https://seu-dominio.com.br
```

> `VITE_APP_URL` é usado para gerar links de venda e scripts de Upsell Widget. Em desenvolvimento, use `http://localhost:5173`.

### 3. Aplique as migrations no Supabase

Execute cada arquivo em ordem no **Supabase Dashboard → SQL Editor**:

```
001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015
```

### 4. Deploy das Edge Functions

```bash
supabase login
supabase link --project-ref SEU-PROJECT-REF

supabase functions deploy validate-bestfy
supabase functions deploy create-transaction
supabase functions deploy bestfy-webhook
```

> **Importante:** Desative a verificação JWT na função `bestfy-webhook`:
> Supabase Dashboard → Edge Functions → bestfy-webhook → Settings → desmarcar **"Enforce JWT Verification"**

### 5. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

---

## Segurança

### Banco de Dados
- **RLS em todas as tabelas** — isolamento total entre vendedores no nível do PostgreSQL
- **API Key da Bestfy nunca exposta no browser** — buscada server-side pela Edge Function
- **INSERT em `sales` apenas via service role** — compradores não criam registros diretamente
- **Validação de cupons dupla** — frontend + server-side na Edge Function
- **Checkout público com verificação cruzada** — `?sale=` valida `product_id + sale_id` juntos

### Formulários de Login e Cadastro (`src/lib/formSecurity.js`)

| Proteção | Detalhe |
|---|---|
| **Honeypot** | Campo oculto (`name="website"`) que bots preenchem — formulário ignorado silenciosamente |
| **Timing check** | Rejeita envios em menos de 1,2s — padrão de automação por bots |
| **Rate limiter** | 5 falhas → bloqueio 30s · 10 falhas → bloqueio 5min · contador regressivo na UI |
| **Limites de tamanho** | Nome: 2–80 chars · E-mail: 5–254 chars · Senha: 8–128 chars (via `maxLength` + JS) |
| **Validação de nome** | Regex Unicode `\p{L}` — bloqueia nomes numéricos, caracteres especiais e injeções |
| **Validação de e-mail** | Regex RFC 5322 simplificado — rejeita domínios sem TLD, múltiplos `@`, etc. |
| **Senha mínima 8 chars** | Padrão NIST SP 800-63B — elevado de 6 para 8 |
| **Indicador de força** | 4 níveis visuais (Fraca/Média/Boa/Forte) com barra colorida no cadastro |
| **Confirmação de senha** | Campo extra com feedback inline em tempo real |
| **Mensagens genéricas** | Erros de login/cadastro não revelam se o e-mail existe (anti user-enumeration) |
| **`autocomplete` correto** | `current-password` no login · `new-password` no cadastro |

---

## Edge Functions

### `POST /validate-bestfy`
Valida a API Key da Bestfy server-side antes de salvar no banco.

```jsonc
// Request
{ "apiKey": "bfy_live_..." }

// Response 200 — válida
{ "valid": true, "company": { "fantasyName": "Minha Empresa", "status": "ACTIVE" } }

// Response 200 — inválida
{ "valid": false }
```

### `POST /create-transaction`
Cria cobrança PIX, aplica cupom/oferta e registra a venda.

```jsonc
// Request
{
  "productId":     "uuid",
  "customerName":  "João Silva",
  "customerEmail": "joao@email.com",
  "customerCpf":   "12345678901",
  "customerPhone": "11999999999",
  "couponCode":    "PROMO10",   // opcional
  "offerId":       "uuid"       // opcional
}

// Response 200
{
  "financialTransactionId": "txn_xxx",
  "qrCode":     "https://...",
  "qrCodeText": "00020126...",
  "saleId":     "uuid"
}
```

### `POST /bestfy-webhook`
Recebe notificações de status da Bestfy e aciona o Realtime.

| Status Bestfy | Status no banco |
|---|---|
| `PAID` / `APPROVED` / `COMPLETED` | `paid` |
| `EXPIRED` | `expired` |
| `FAILED` / `CANCELED` | `failed` |
| `REFUNDED` | `refunded` |

---

## Roadmap

### Concluído

| Feature | Status |
|---|---|
| Multi-checkout com identidade visual independente | Entregue |
| Gestão de ofertas (M:N com checkouts) | Entregue |
| PIX com confirmação em tempo real (Supabase Realtime) | Entregue |
| Cupons de desconto com validação dupla | Entregue |
| Links de venda segmentados por oferta × checkout | Entregue |
| Order Bumps com drag-and-drop e animação no total | Entregue |
| Upsell / Downsell com gerador de script Web Component | Entregue |
| Checkout customizável (header, bumps, botões) | Entregue |
| Segurança de formulários (honeypot, rate limiter, timing) | Entregue |

### Próximas Entregas

| # | Feature | Descrição |
|---|---|---|
| 1 | **Área de Membros (LXP)** | Plataforma integrada de cursos com controle de acesso por produto/oferta |
| 2 | **Pixels de Rastreamento** | Integração com Meta Pixel e Google Tag Manager por produto |
| 3 | **Abandono de Carrinho** | Webhook acionado quando o comprador não finaliza o checkout |
| 4 | **Relatórios Avançados** | Gráficos de receita, taxa de conversão e ticket médio por produto |
| 5 | **Checkout Embutido** | Widget iframe para incorporar o checkout em landing pages externas |
| 6 | **Boleto / Cartão** | Suporte a múltiplos métodos de pagamento além do PIX |

---

## Dependências Principais

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@supabase/supabase-js": "^2.39.0",
    "lucide-react": "latest",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "vite": "^5.0.8"
  }
}
```

---

*Desenvolvido com React 18, Supabase e integração Bestfy PIX.*
