# ⚡ Checkout Digital SaaS

Plataforma de vendas de infoprodutos com geração de PIX automático, confirmação de pagamento em tempo real e liberação de acesso instantânea — sem intervenção manual.

---

## 📐 Arquitetura do Sistema

O sistema opera em um **triângulo de responsabilidades** bem definido:

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLUXO COMPLETO                           │
│                                                                 │
│  Cliente                 Supabase                   Bestfy      │
│  ──────                  ────────                   ──────      │
│  Preenche form  ──────►  Edge Function          ──► /payment    │
│                          create-transaction                      │
│                          (busca API Key do                       │
│                           vendedor no banco)   ◄── QR Code PIX  │
│                                                                 │
│  Exibe QR Code  ◄──────  Salva em sales{}                       │
│  (status=pending)        Retorna saleId                         │
│                                                                 │
│  ─ ─ ─ ─ cliente paga no banco ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                 │
│                          Edge Function     ◄── POST webhook     │
│                          bestfy-webhook        (status=PAID)    │
│                          UPDATE sales                           │
│                          status → 'paid'                        │
│                                                                 │
│  Tela "Pago!" ◄────────  Supabase Realtime                      │
│  (automático)            (escuta o UPDATE)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React + Vite | 18 / 5 |
| Estilização | Tailwind CSS | 3.4 |
| Ícones | Lucide React | latest |
| Roteamento | React Router DOM | 6 |
| Backend / DB | Supabase (PostgreSQL) | 2 |
| Realtime | Supabase Realtime | nativo |
| Edge Functions | Deno (TypeScript) | nativo |
| Pagamentos | Bestfy API (PIX) | v1 |

---

## ✨ Principais Funcionalidades

### 🔄 Realtime — Tela muda sozinha ao pagar
Após gerar o PIX, o frontend abre um canal Supabase Realtime que escuta `UPDATE` na linha da venda:
```javascript
supabase
  .channel(`sale-${saleId}`)
  .on('postgres_changes', {
    event: 'UPDATE', schema: 'public',
    table: 'sales', filter: `id=eq.${saleId}`
  }, (payload) => {
    if (payload.new.status === 'paid') setPageState('confirmed')
  })
  .subscribe()
```
Quando o webhook da Bestfy atualiza o banco, o cliente vê a tela de confirmação **sem precisar recarregar**.

### 🛡️ Anti-F5 — Sessão recuperada após refresh
O `saleId` é gravado diretamente na URL como query param:
```
/checkout/{productId}?sale={saleId}
```
No `useEffect` de montagem, se `?sale=` existir, o sistema consulta o banco, restaura o QR Code (se `pending`) ou vai direto para a tela de obrigado (se `paid`). Nome e e-mail são pré-preenchidos automaticamente.

### 🏗️ Multi-tenant por RLS
Cada vendedor gerencia seus próprios produtos e vê apenas suas vendas. O Row Level Security do PostgreSQL garante isso em nível de banco — sem filtros manuais no código.

### ✅ Validação de API Key server-side
A chave da Bestfy nunca é exposta no browser. A Edge Function `validate-bestfy` faz a chamada ao endpoint `/company/validate-api-key` server-side e retorna apenas o resultado.

---

## 📁 Estrutura de Pastas

```
checkout-digital/
├── src/
│   ├── lib/
│   │   └── supabaseClient.js       # Inicialização do cliente Supabase
│   ├── contexts/
│   │   └── AuthContext.jsx         # Provider + hook useAuth
│   ├── components/
│   │   ├── ProtectedRoute.jsx      # Guard para rotas autenticadas
│   │   ├── DashboardLayout.jsx     # Layout com sidebar/nav do painel
│   │   └── AuthLayout.jsx          # Layout das telas de login/cadastro
│   └── pages/
│       ├── LoginPage.jsx
│       ├── RegisterPage.jsx
│       ├── DashboardPage.jsx
│       ├── ProductsPage.jsx        # CRUD de produtos + Copiar Link
│       ├── IntegrationsPage.jsx    # Configuração da API Key Bestfy
│       ├── TransactionsPage.jsx    # Histórico de vendas + modal QR Code
│       └── CheckoutPage.jsx        # Página pública de checkout (PIX)
├── supabase/
│   ├── migrations/
│   │   ├── 001_create_products.sql
│   │   ├── 002_create_profiles.sql
│   │   ├── 003_create_sales.sql
│   │   └── 004_update_sales_columns.sql
│   └── functions/
│       ├── validate-bestfy/index.ts
│       ├── create-transaction/index.ts
│       └── bestfy-webhook/index.ts
├── .env.example
└── package.json
```

---

## 🗄️ Esquema do Banco de Dados

### `profiles` — Dados do vendedor
```sql
create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  bestfy_api_key       text,
  bestfy_company_name  text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
```
> Criado automaticamente via trigger `on_auth_user_created` ao registrar um novo usuário.

---

### `products` — Catálogo de produtos do vendedor
```sql
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text,
  price         numeric(10, 2) not null check (price > 0),
  delivery_url  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

---

### `sales` — Registro completo de cada venda
```sql
create table public.sales (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid references public.products(id) on delete set null,
  seller_id           uuid not null references auth.users(id) on delete cascade,

  -- Dados da Bestfy
  bestfy_id           text,                    -- financialTransactionId da Bestfy
  qr_code_url         text,                    -- URL da imagem do QR Code
  qr_code_text        text,                    -- Código PIX copia e cola

  -- Status da venda
  status              text not null default 'pending'
                        check (status in ('pending', 'paid', 'failed', 'refunded')),
  amount              numeric(10, 2) not null,

  -- Dados do comprador
  customer_name       text not null,
  customer_email      text not null,
  customer_cpf        text not null,
  customer_phone      text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Índices
create index sales_seller_id_idx  on public.sales(seller_id);
create index sales_bestfy_id_idx  on public.sales(bestfy_id);
create index sales_status_idx     on public.sales(status);
```

> **RLS**: O vendedor lê apenas `seller_id = auth.uid()`. O `INSERT` é feito exclusivamente via service role key nas Edge Functions, sem policy de insert para usuários.

---

## 🔧 Configuração do Ambiente

### 1. Variáveis de ambiente — Frontend (`.env`)

```bash
# Copie o template
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

Encontre esses valores em: **Supabase Dashboard → Settings → API**.

### 2. Secrets das Edge Functions — Supabase CLI

As funções usam variáveis injetadas automaticamente pelo Supabase:

| Variável | Origem | Uso |
|----------|--------|-----|
| `SUPABASE_URL` | Automático | URL do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | Automático | Acesso admin ao banco (bypass RLS) |

> Nenhum secret manual é necessário — a API Key da Bestfy é buscada do banco em tempo de execução, por produto/vendedor.

---

## 🚀 Guia de Deploy

### Instalação local

```bash
npm install
npm run dev
```

### Aplicar migrations no Supabase

Execute cada arquivo SQL no **Supabase Dashboard → SQL Editor**:

```
001_create_products.sql
002_create_profiles.sql
003_create_sales.sql
004_update_sales_columns.sql
```

### Deploy das Edge Functions

```bash
# Login na CLI
supabase login

# Vincula ao projeto remoto
supabase link --project-ref SEU-PROJECT-REF

# Deploy de cada função
supabase functions deploy validate-bestfy
supabase functions deploy create-transaction
supabase functions deploy bestfy-webhook
```

### Desativar JWT no Webhook

A função `bestfy-webhook` recebe chamadas da Bestfy (sem JWT). Para isso:

**Supabase Dashboard → Edge Functions → bestfy-webhook → Settings**
→ Desmarque **"Enforce JWT Verification"**

---

## 🔗 Edge Functions

### `POST /validate-bestfy`
Valida a API Key da Bestfy server-side antes de salvar no banco.

```jsonc
// Request
{ "apiKey": "bfy_live_..." }

// Response 200
{ "valid": true, "company": { "fantasyName": "Minha Empresa", "status": "ACTIVE" } }

// Response 200 (inválida)
{ "valid": false, "status": 401 }
```

---

### `POST /create-transaction`
Cria uma cobrança PIX na Bestfy e registra a venda no banco.

```jsonc
// Request
{
  "productId": "uuid",
  "customerName": "João Silva",
  "customerEmail": "joao@email.com",
  "customerCpf": "12345678901",
  "customerPhone": "11999999999"
}

// Response 200
{
  "financialTransactionId": "txn_xxx",
  "qrCode": "https://...",           // URL da imagem
  "qrCodeText": "00020126...",       // Código copia e cola
  "saleId": "uuid-do-banco"          // ID da linha em public.sales
}
```

**Fluxo interno:**
1. Busca o produto e a `bestfy_api_key` do vendedor em `profiles`
2. Converte preço para centavos (`price * 100`)
3. Chama `POST https://api.bestfy.io/payment` com `x-api-key`
4. Insere linha em `sales` com `status = 'pending'`
5. Retorna os dados da Bestfy + `saleId` gerado

---

### `POST /bestfy-webhook`
Recebe notificações de status da Bestfy e atualiza o banco.

**Fluxo técnico — Double Parse:**
```typescript
// O payload da Bestfy tem esta estrutura:
// { event_message: "{\"transactionId\":\"txn_xxx\",\"status\":\"PAID\"}" }

const body     = await req.json()
const data     = body.event_message ? JSON.parse(body.event_message) : body
const txnId    = data.transactionId || body.transactionId
const rawStatus = data.status || body.status
```

**Mapeamento de status Bestfy → banco:**

| Status Bestfy | Status no banco |
|--------------|-----------------|
| `PAID` / `APPROVED` / `COMPLETED` | `paid` |
| `EXPIRED` | `expired` |
| `FAILED` / `CANCELED` | `failed` |
| `REFUNDED` | `refunded` |
| outros | `pending` |

URL configurada em `create-transaction`:
```
https://SEU-PROJETO.supabase.co/functions/v1/bestfy-webhook
```

---

## 🔄 Fluxo Completo — Do Clique ao "Pago"

```
1. Vendedor cadastra produto → /products
2. Vendedor configura API Key Bestfy → /integrations
   └── validate-bestfy valida a chave server-side
   └── bestfy_api_key salvo em profiles

3. Vendedor copia link → /checkout/{productId}
   └── Link compartilhado com o comprador

4. Comprador preenche form (nome, email, CPF, telefone)
5. Frontend chama create-transaction
   └── Função busca bestfy_api_key do vendedor
   └── Chama api.bestfy.io/payment
   └── Cria linha em sales (status=pending)
   └── Retorna qrCode + saleId

6. Frontend exibe QR Code
   └── URL atualizada: /checkout/{productId}?sale={saleId}
   └── Realtime ativo: escuta UPDATE em sales WHERE id={saleId}

7. Comprador paga no banco

8. Bestfy chama bestfy-webhook (POST)
   └── Double Parse do payload
   └── UPDATE sales SET status='paid' WHERE bestfy_id='{txnId}'

9. Supabase Realtime dispara o evento
   └── Frontend recebe payload.new.status === 'paid'
   └── Tela muda automaticamente para "Pagamento Confirmado!"
   └── Botão "Acessar meu Produto" exibe o delivery_url
```

---

## 🛣️ Rotas da Aplicação

| Rota | Acesso | Descrição |
|------|--------|-----------|
| `/login` | Público | Login do vendedor |
| `/register` | Público | Cadastro do vendedor |
| `/checkout/:productId` | Público | Página de compra do cliente |
| `/dashboard` | Autenticado | Painel principal |
| `/products` | Autenticado | Gerenciar produtos |
| `/integrations` | Autenticado | Configurar API Key Bestfy |
| `/transactions` | Autenticado | Histórico de vendas |

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

## 🔐 Segurança

- **RLS em todas as tabelas** — nenhum dado vaza entre vendedores
- **API Key nunca exposta no browser** — validação e uso server-side via Edge Functions
- **INSERT em `sales` apenas via service role** — clientes não podem criar vendas diretamente
- **Checkout público com verificação cruzada** — `?sale=` valida `product_id` junto ao `sale_id`, impedindo acesso a vendas de outros produtos

---

*Projeto desenvolvido com React, Supabase e integração Bestfy.*
