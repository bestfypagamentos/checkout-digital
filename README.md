# ⚡ Checkout Digital

> **SaaS de Checkout de Alta Conversão** — múltiplos modelos visuais por produto, gestão de ofertas, cupons de desconto, confirmação de pagamento via PIX em tempo real e Área de Membros integrada.

---

## ✨ Principais Funcionalidades

### 🎨 Sistema Multi-Checkout com Identidade Visual Independente
Cada produto pode ter **N modelos de checkout**, cada um com sua própria combinação de cores, logomarca e temporizador. Um Checkout A pode ser verde com a logo da marca A, enquanto o Checkout B é azul com a logo da marca B — completamente isolados.

### 🔗 Gestão de Ofertas com Tabela de Junção
Uma oferta pode pertencer a múltiplos checkouts simultaneamente. A arquitetura usa a tabela `checkout_offer_variants` para relacionar `product_offers ↔ product_checkouts` sem duplicação de dados.

### 💸 PIX com Confirmação em Tempo Real
O comprador paga e a tela muda sozinha — sem refresh. Alimentado por **Supabase Realtime** escutando o webhook da Bestfy via PostgreSQL Change Streams.

### 🛡️ Anti-F5: Sessão Persistente
O `saleId` é gravado na URL (`?sale=uuid`). Ao recarregar a página, o sistema restaura automaticamente o QR Code (se pendente) ou exibe a tela de confirmação (se pago).

### 🎫 Cupons de Desconto
Códigos com desconto percentual, data de início e expiração opcionais. Validados no frontend e reaplicados server-side na Edge Function `create-transaction` para segurança total.

### 🔖 Múltiplas Ofertas por Produto
Até 10 variações de preço por produto (pagamento único ou recorrente), com seletor visual no checkout público. Preço da oferta principal sincronizado bidirecionalmente com o preço do produto.

### 🔗 Links de Venda por Combinação Oferta × Checkout
Cada par oferta/checkout gera um link exclusivo com os parâmetros `?off=` e `?chk=` pré-selecionados, permitindo campanhas de marketing segmentadas.

### 📊 Dashboard Dark Mode com Persistência de Abas
Painel administrativo completo em dark mode. A aba ativa persiste na URL via `useSearchParams` — sobrevive a F5 e ao botão voltar do browser.

### 🏗️ Multi-tenant por RLS
Cada vendedor gerencia exclusivamente seus próprios dados. O Row Level Security do PostgreSQL garante isolamento total em nível de banco, sem filtros manuais no código.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | React + Vite | 18 / 5 |
| Estilização | Tailwind CSS | 3.4 |
| Ícones | Lucide React | latest |
| Roteamento | React Router DOM | 6 |
| Backend / DB | Supabase (PostgreSQL) | 2 |
| Realtime | Supabase Realtime | nativo |
| Edge Functions | Deno (TypeScript) | nativo |
| Pagamentos | Bestfy API (PIX) | v1 |

---

## 🗄️ Arquitetura do Banco de Dados

### Visão Geral do Modelo Relacional

```
auth.users (Supabase Auth)
    │
    ├──► profiles          ← bestfy_api_key, nome da empresa
    │
    └──► products          ← nome, preço, imagem, delivery_url
              │
              ├──► product_offers         ← variações de preço (até 10)
              │         │
              │         └──► checkout_offer_variants  ← junção M:N
              │                     │
              ├──► product_checkouts ──┘   ← modelos visuais (settings JSONB)
              │
              ├──► coupons           ← cupons de desconto por produto
              │
              └──► sales             ← registro de cada transação
```

### Tabelas Principais

| Tabela | Descrição |
|---|---|
| `profiles` | Dados do vendedor, `bestfy_api_key` |
| `products` | Catálogo de produtos com imagem e link de entrega |
| `product_offers` | Ofertas/variações de preço por produto |
| `product_checkouts` | Modelos de checkout com `settings` JSONB (cores, logo, timer) |
| `checkout_offer_variants` | Tabela de junção `offer_id ↔ checkout_id` (M:N) |
| `coupons` | Cupons com desconto %, validade e restrições |
| `sales` | Transações com status realtime e dados do comprador |

### Detalhe: `product_checkouts.settings` (JSONB)

Cada modelo de checkout armazena suas configurações visuais de forma independente:

```json
{
  "logo_url":         "https://cdn.exemplo.com/logo-marca-a.png",
  "logo_position":    "left",
  "timer_seconds":    600,
  "timer_bg_color":   "#EAB308",
  "timer_text_color": "#713F12",
  "button_color":     "#16A34A"
}
```

### Detalhe: Link de Venda

```
/checkout/{productId}?off={offerId}&chk={checkoutId}
```

O checkout público carrega automaticamente a oferta e o modelo visual referenciados pelos params, garantindo a experiência visual correta para cada link de campanha.

---

## 📁 Estrutura de Pastas

```
checkout-digital/
├── src/
│   ├── lib/
│   │   ├── supabaseClient.js           # Inicialização do cliente Supabase
│   │   └── cache.js                    # Helpers de cache client-side (SWR)
│   ├── contexts/
│   │   └── AuthContext.jsx             # Provider + hook useAuth
│   ├── components/
│   │   ├── ProtectedRoute.jsx          # Guard para rotas autenticadas
│   │   ├── DashboardLayout.jsx         # Layout com sidebar do painel
│   │   ├── OnboardingGrid.jsx          # Checklist de onboarding do vendedor
│   │   └── Skeleton.jsx                # Skeletons de loading
│   └── pages/
│       ├── LoginPage.jsx
│       ├── RegisterPage.jsx
│       ├── DashboardPage.jsx           # Dashboard com stats + criação de produto
│       ├── ProductsPage.jsx            # CRUD de produtos
│       ├── ProductEditPage.jsx         # Edição: Geral | Cupons | Checkout | Links
│       ├── CheckoutEditor.jsx          # Editor visual por modelo de checkout
│       ├── IntegrationsPage.jsx        # Configuração da API Key Bestfy
│       ├── TransactionsPage.jsx        # Histórico de vendas + QR Code
│       └── CheckoutPage.jsx            # Página pública de compra (PIX)
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
│   │   └── 012_add_settings_to_product_checkouts.sql
│   └── functions/
│       ├── validate-bestfy/index.ts
│       ├── create-transaction/index.ts
│       └── bestfy-webhook/index.ts
├── .env.example
└── package.json
```

---

## 🔄 Fluxo de Pagamento

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

## 🛣️ Rotas da Aplicação

| Rota | Acesso | Descrição |
|---|---|---|
| `/login` | Público | Login do vendedor |
| `/register` | Público | Cadastro do vendedor |
| `/checkout/:productId` | Público | Página de compra do cliente |
| `/dashboard` | Autenticado | Painel com stats e criação rápida de produto |
| `/products` | Autenticado | Listagem e gerenciamento de produtos |
| `/products/:id` | Autenticado | Edição: Geral, Cupons, Checkout, Links |
| `/products/:id/checkout-editor/:checkoutId` | Autenticado | Editor visual isolado por modelo |
| `/integrations` | Autenticado | Configurar chave da API Bestfy |
| `/transactions` | Autenticado | Histórico de vendas com QR Code |

---

## 🚀 Instalação e Configuração

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

Edite o `.env` com suas credenciais do Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
VITE_APP_URL=https://seu-dominio.com.br
```

> `VITE_APP_URL` é usado para gerar os links de venda na aba **Links**. Em desenvolvimento, deixe `http://localhost:5173`.

### 3. Aplique as migrations no Supabase

Execute cada arquivo em ordem no **Supabase Dashboard → SQL Editor**:

```
001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012
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

## 🔐 Segurança

- **RLS em todas as tabelas** — isolamento total entre vendedores no nível do banco
- **API Key da Bestfy nunca exposta no browser** — buscada server-side pela Edge Function
- **INSERT em `sales` apenas via service role** — compradores não criam registros diretamente
- **Validação de cupons dupla** — frontend + server-side na Edge Function
- **Checkout público com verificação cruzada** — `?sale=` valida `product_id + sale_id` juntos

---

## 🔧 Edge Functions

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

## 🗺️ Roadmap

### 🔜 Próximas Entregas

| # | Feature | Descrição |
|---|---|---|
| 1 | **Upsell de 1-Clique** | Oferta adicional exibida após confirmação do PIX, aceita sem novo preenchimento de dados |
| 2 | **Área de Membros (LXP)** | Plataforma integrada de cursos e conteúdo com controle de acesso por produto/oferta |
| 3 | **Order Bump** | Produto adicional exibido no checkout antes da finalização |
| 4 | **Pixels de Rastreamento** | Integração com Meta Pixel e Google Tag Manager por produto |
| 5 | **Abandono de Carrinho** | Webhook acionado quando o comprador não finaliza o checkout |
| 6 | **Relatórios Avançados** | Gráficos de receita, taxa de conversão e ticket médio por produto |
| 7 | **Checkout Embutido** | Widget iframe para incorporar o checkout em landing pages externas |
| 8 | **Boleto / Cartão** | Suporte a múltiplos métodos de pagamento além do PIX |

---

## 📦 Dependências Principais

```json
{
  "dependencies": {
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
