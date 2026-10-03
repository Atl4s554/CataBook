# Planejamento Frontend - CataBook

## Visão Geral
Projeto de frontend para sistema de biblioteca de categorização de livros. Interface em Bootstrap 5, pronta para integração com backend Node.js/Express via API REST com autenticação JWT.

---

## Stack Tecnológica
- **HTML5** + **Bootstrap 5.3** (CDN)
- **CSS Custom Properties** (variáveis nativas, sem pré-processador)
- **JavaScript Vanilla (ES6+)** - Módulos, Fetch API, sem frameworks
- **Autenticação**: JWT (Access Token + Refresh Token)
- **Upload**: multipart/form-data

---

## Estrutura de Pastas

```
CataBook/
├── index.html                      # Entry point - redireciona para login ou dashboard
├── pages/
│   ├── login.html                  # Página de login
│   ├── register.html               # Página de cadastro
│   ├── book-form.html              # Formulário criar/editar livro
│   └── book-list.html              # Lista de livros com CRUD
├── assets/
│   ├── css/
│   │   ├── main.css                # Variáveis, reset, utilitários, layout
│   │   └── components.css          # Componentes reutilizáveis (cards, forms, buttons)
│   ├── js/
│   │   ├── api.js                  # Service centralizado de comunicação com backend
│   │   ├── auth.js                 # Gerenciamento de tokens JWT e sessão
│   │   ├── validation.js           # Validações (ISBN, email, senha, arquivos, formulários)
│   │   ├── book-form.js            # Lógica específica do formulário de livro
│   │   ├── book-list.js            # Lógica da lista (busca, filtros, paginação, CRUD)
│   │   └── main.js                 # Inicialização comum, guards de rota
│   └── img/
│       └── placeholder-book.svg    # Placeholder SVG inline para capas ausentes
```

---

## Design System

### Variáveis CSS (`:root` em `assets/css/main.css`)

```css
:root {
  /* Cores */
  --color-primary: #2c3e50;
  --color-primary-light: #34495e;
  --color-primary-dark: #1a252f;
  --color-secondary: #e74c3c;
  --color-secondary-hover: #c0392b;
  --color-success: #27ae60;
  --color-warning: #f39c12;
  --color-info: #3498db;
  --color-light: #f8f9fa;
  --color-white: #ffffff;
  --color-text: #2c3e50;
  --color-text-muted: #6c757d;
  --color-border: #dee2e6;
  --color-border-focus: #2c3e50;
  --color-error: #e74c3c;
  --color-error-bg: #fdf2f2;

  /* Espaçamento */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-xxl: 3rem;

  /* Tipografia */
  --font-family-base: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-xxl: 1.5rem;
  --font-size-heading: 2rem;

  /* Bordas e Sombras */
  --border-radius: 8px;
  --border-radius-sm: 4px;
  --border-radius-lg: 12px;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.12);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.16);

  /* Transições */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;

  /* Layout */
  --header-height: 64px;
  --sidebar-width: 260px;
  --content-max-width: 1200px;
  --form-max-width: 480px;
}
```

### Componentes Reutilizáveis (`assets/css/components.css`)

| Componente | Classes | Descrição |
|------------|---------|-----------|
| Botão Primário | `.btn-primary-custom` | Fundo `--color-primary`, hover `--color-primary-dark` |
| Botão Outline | `.btn-outline-custom` | Borda `--color-primary`, texto `--color-primary` |
| Botão Perigo | `.btn-danger-custom` | Fundo `--color-secondary`, hover `--color-secondary-hover` |
| Input Custom | `.form-control-custom` | Focus com sombra `--color-border-focus`, borda 2px |
| Label Custom | `.form-label-custom` | Peso 500, cor `--color-text` |
| Card Livro | `.card-book` | Grid responsivo, sombra `--shadow-sm`, hover `--shadow-md` |
| Drop Zone | `.drop-zone` | Área drag-and-drop para upload de imagem |
| Badge Status | `.badge-status` | Badges coloridos para status (futuro) |
| Skeleton | `.skeleton` | Loading placeholder animado |

---

## Páginas - Especificação Detalhada

### 1. `index.html` - Entry Point
- Verifica `auth.isAuthenticated()`
- Se autenticado → redirect `pages/book-list.html`
- Senão → redirect `pages/login.html`
- Script inline mínimo (sem dependências externas)

### 2. `pages/login.html`
**Layout:** Centralizado vertical/horizontal, max-width 400px, card com sombra `--shadow-md`

**Campos:**
| Campo | Tipo | Validação |
|-------|------|-----------|
| Email | `email` | Obrigatório, formato válido |
| Senha | `password` | Obrigatório, min 6 caracteres |

**Features:**
- Toggle mostrar/ocultar senha (ícone olho)
- Validação em tempo real (on blur + on submit)
- Loading state no botão (spinner + disabled)
- Tratamento de erros da API (credenciais inválidas, servidor indisponível)
- Link "Esqueci minha senha" (placeholder para futura implementação)
- Link "Não tem conta? Cadastre-se" → `register.html`

**Endpoints:**
- `POST /api/auth/login` → `{ accessToken, refreshToken, user }`

---

### 3. `pages/register.html`
**Mesmo layout do login**

**Campos:**
| Campo | Tipo | Validação |
|-------|------|-----------|
| Email | `email` | Obrigatório, formato válido, único (backend) |
| Senha | `password` | Obrigatório, min 6 caracteres, medidor de força |
| Confirmar Senha | `password` | Obrigatório, deve coincidir com senha |

**Features:**
- Medidor visual de força da senha (fraco/médio/forte)
- Checkbox "Li e aceito os termos" (obrigatório)
- Auto-login após cadastro bem-sucedido → redirect `book-list.html`
- Validação de senhas coincidindo em tempo real

**Endpoints:**
- `POST /api/auth/register` → `{ accessToken, refreshToken, user }`

---

### 4. `pages/book-form.html` - Criar/Editar Livro

**Modo:** Detecta parâmetro `?id=` na URL
- **Create:** Sem `id` → formulário vazio, título "Novo Livro"
- **Edit:** Com `id` → carrega dados via `GET /api/books/:id`, título "Editar Livro"

**Campos Obrigatórios (Sempre Visíveis):**
| Campo | Tipo | Validação | API Field |
|-------|------|-----------|-----------|
| Nome do Livro | `text` | Obrigatório, max 200 chars | `title` |
| ISBN | `text` | **ISBN-10 ou ISBN-13 válido** (checksum) | `isbn` |
| Código Interno | `text` | Obrigatório, max 50 chars, único | `code` |
| Foto da Capa | `file` | Opcional, aceita: jpg, jpeg, png, webp, max 5MB | `cover` |

**Seção Opcional (Accordion "Detalhes Adicionais"):**
| Campo | Tipo | Validação | API Field |
|-------|------|-----------|-----------|
| Autor | `text` | Opcional, max 200 chars | `author` |
| Gênero/Categoria | `text` | Opcional, max 100 chars | `genre` |
| Ano de Publicação | `number` | Opcional, 1000-ano atual | `year` |
| Editora | `text` | Opcional, max 200 chars | `publisher` |
| Status | `select` | Opcional: `reading`, `read`, `want_to_read` | `status` |
| Descrição | `textarea` | Opcional, max 2000 chars, contagem de caracteres | `description` |

**Features:**
- **ISBN:** Validação completa (formato + checksum ISBN-10/13), feedback visual (verde/vermelho)
- **Upload de imagem:**
  - Drag & drop zone com preview
  - Click para selecionar arquivo
  - Preview da imagem selecionada (max 200px altura)
  - Botão remover imagem
  - Validação de tipo e tamanho client-side
- **Botões:**
  - [Salvar] - Submit (loading state)
  - [Cancelar] - Volta para `book-list.html` (confirma se houver alterações não salvas)
- **Loading/Error states** completos

**Endpoints:**
- Create: `POST /api/books` (multipart/form-data)
- Edit: `PUT /api/books/:id` (multipart/form-data)
- Get (edit): `GET /api/books/:id`

---

### 5. `pages/book-list.html` - Lista de Livros

**Header Fixo:**
```
┌─────────────────────────────────────────────────────────────┐
│ CataBook                                    [Novo Livro +]  │
├─────────────────────────────────────────────────────────────┤
│ [Buscar: ___________________] [Ordenar ▼] [Filtros ▼]       │
└─────────────────────────────────────────────────────────────┘
```

**Controles:**
| Controle | Tipo | Comportamento |
|----------|------|---------------|
| Busca | Input + debounce 300ms | Busca em: título, ISBN, código, descrição (param `q`) |
| Ordenação | Select | `title:asc`, `title:desc`, `code:asc`, `code:desc`, `created_at:desc`, `created_at:asc` |
| Filtros | Dropdown | ☑ Com capa / ☐ Sem capa (param `has_cover`) |
| Paginação | Padrão Bootstrap | 30 itens/página, controlo anterior/próximo + números |

**Grid de Livros (Cards Responsivos):**
- **Breakpoints:** 1 col (xs) → 2 col (sm) → 3 col (md) → 4 col (lg/xl)
- **Card:**
  - Imagem capa (aspect-ratio 2:3, object-fit: cover, placeholder SVG se sem imagem)
  - Título (truncado 2 linhas, tooltip no hover)
  - ISBN + Código (small, muted)
  - Descrição (truncada 3 linhas, se houver)
  - **Ações:** [Editar] [Excluir]
    - Editar → `book-form.html?id=XXX`
    - Excluir → Modal confirmação → `DELETE /api/books/:id` → remove do DOM + toast

**Estado Vazio:**
- Ilustração SVG + "Nenhum livro cadastrado" + Botão "Adicionar primeiro livro"

**Sincronização com URL:**
- Todos os estados (page, q, sort, has_cover) refletidos na URL via `history.pushState`
- Permite refresh, compartilhamento, voltar do navegador

**Endpoints:**
- `GET /api/books?page=1&limit=30&q=termo&sort=title:asc&has_cover=true`
- `DELETE /api/books/:id`

---

## JavaScript Architecture

### `assets/js/api.js` - Service Centralizado
```javascript
// Configuração
const API_BASE = '/api';  // Ajustável via variável de build

// Métodos exportados:
api.get(endpoint, params)           // GET com query string
api.post(endpoint, data)            // POST JSON
api.put(endpoint, data)             // PUT JSON
api.patch(endpoint, data)           // PATCH JSON
api.delete(endpoint)                // DELETE
api.upload(endpoint, formData)      // POST multipart/form-data

// Features:
// - Auto Authorization: Bearer <accessToken>
// - Interceptor 401 → refresh token automático (1 tentativa)
// - Error handling padronizado: lança ApiError com { status, message, details }
// - Timeout configurável (padrão 30s)
// - Cancelamento via AbortController
```

### `assets/js/auth.js` - Gerenciamento de Autenticação
```javascript
// Storage: accessToken (memory), refreshToken (HttpOnly cookie ideal, fallback localStorage)
auth.login(credentials)              // POST /auth/login + armazena tokens
auth.register(data)                  // POST /auth/register + armazena tokens
auth.logout()                        // POST /auth/logout + limpa storage
auth.refreshAccessToken()            // POST /auth/refresh
auth.getAccessToken()                // Retorna access token válido (renova se expirado)
auth.isAuthenticated()               // Boolean
auth.getUser()                       // Dados do usuário logado
auth.requireAuth()                   // Guard: redirect login se não autenticado
auth.redirectIfAuthenticated()       // Guard: redirect book-list se autenticado (login/register)
```

### `assets/js/validation.js` - Validações
```javascript
// ISBN
validateISBN(isbn) → { valid: boolean, type: 'ISBN10'|'ISBN13'|null, clean: string }
formatISBN(isbn) → string formatado (grupos)

// Email
validateEmail(email) → boolean

// Senha
validatePassword(password) → { valid: boolean, strength: 'weak'|'medium'|'strong', errors: string[] }
checkPasswordMatch(password, confirm) → boolean

// Arquivo
validateFile(file, { maxSize: 5*1024*1024, allowedTypes: ['image/jpeg','image/png','image/webp'] })

// Formulário genérico
validateForm(formElement, rules) → { valid: boolean, errors: Map<field, string> }

// UI Helpers
showError(input, message)
clearError(input)
setFieldValid(input, isValid)
```

### `assets/js/book-form.js`
```javascript
// Inicialização
BookForm.init({ mode: 'create'|'edit', bookId?: string })

// Features:
// - Carrega dados se edit mode
// - Validação em tempo real (on blur + on input)
// - ISBN: validação + formatação automática
// - Upload: drag-drop, preview, validação, remoção
// - Accordion detalhes opcionais
// - Dirty check (avisa se sair com alterações)
// - Submit: loading, error handling, redirect on success
```

### `assets/js/book-list.js`
```javascript
// Estado
state = { page: 1, limit: 30, q: '', sort: 'created_at:desc', hasCover: null }

// Inicialização
BookList.init()

// Métodos principais:
loadBooks()              // Chama API, renderiza grid, atualiza paginação
debouncedSearch(term)    // Debounce 300ms → atualiza state.q → loadBooks()
changeSort(field, dir)   // Atualiza state.sort → loadBooks()
toggleFilter(key, value) // Atualiza state.hasCover → loadBooks()
changePage(page)         // Atualiza state.page → loadBooks()
deleteBook(id)           // Modal confirm → DELETE → loadBooks() + toast
syncURL()                // history.pushState com estado atual
parseURL()               // Lê URL na inicialização → popula state
```

### `assets/js/main.js`
```javascript
// Inicialização comum
- Carrega Bootstrap (tooltips, modals, dropdowns, collapse)
- Configura guards de rota por pathname
- Inicializa tooltips globais
- Toast system (sucesso, erro, aviso)
- Logout global (botão no header se autenticado)
```

---

## Endpoints da API (Contrato Esperado)

### Autenticação
| Método | Endpoint | Request | Response Success |
|--------|----------|---------|------------------|
| POST | `/api/auth/login` | `{ email, password }` | `{ success: true, data: { accessToken, refreshToken, user }, message }` |
| POST | `/api/auth/register` | `{ email, password, passwordConfirm }` | `{ success: true, data: { accessToken, refreshToken, user }, message }` |
| POST | `/api/auth/refresh` | (cookie refreshToken) | `{ success: true, data: { accessToken }, message }` |
| POST | `/api/auth/logout` | - | `{ success: true, message }` |

### Livros
| Método | Endpoint | Request | Response Success |
|--------|----------|---------|------------------|
| GET | `/api/books` | Query: `page, limit, q, sort, has_cover` | `{ success: true, data: { books: [], pagination: { page, limit, total, totalPages } }, message }` |
| GET | `/api/books/:id` | - | `{ success: true, data: { book }, message }` |
| POST | `/api/books` | multipart: title, isbn, code, cover?, author?, genre?, year?, publisher?, status?, description? | `{ success: true, data: { book }, message }` |
| PUT | `/api/books/:id` | multipart (campos opcionais) | `{ success: true, data: { book }, message }` |
| DELETE | `/api/books/:id` | - | `{ success: true, message }` |

### Formato Padrão de Resposta
```json
// Sucesso
{
  "success": true,
  "data": { ... },
  "message": "Operação realizada com sucesso"
}

// Erro
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Dados inválidos",
  "details": { "field": "mensagem" }
}

// Erro 401
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Token expirado ou inválido"
}
```

---

## Responsividade (Mobile-First)

| Breakpoint | Grid Livros | Formulário | Header/Nav |
|------------|-------------|------------|------------|
| `< 576px` (xs) | 1 coluna | Stack vertical (1 col) | Hamburger menu |
| `≥ 576px` (sm) | 2 colunas | Stack vertical | Hamburger menu |
| `≥ 768px` (md) | 3 colunas | 2 colunas (ISBN+Código side-by-side) | Expandido |
| `≥ 992px` (lg) | 4 colunas | 2 colunas | Expandido |
| `≥ 1200px` (xl) | 4 colunas | 2 colunas (max-width 480px) | Expandido |

**Container principal:** `max-width: var(--content-max-width)` centralizado

---

## Fluxo de Autenticação (JWT)

```
┌─────────────┐     POST /api/auth/login      ┌─────────────┐
│   Login     │ ─────────────────────────────> │   Backend   │
│  (email,    │ <───────────────────────────── │  (valida,   │
│  password)  │    { accessToken,             │  gera tokens)│
└─────────────┘    refreshToken, user }       └─────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend:                                                  │
│  - accessToken → memory (variável JS)                       │
│  - refreshToken → HttpOnly Cookie (ideal) OU localStorage  │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Requisições autenticadas:                                  │
│  Authorization: Bearer <accessToken>                        │
└─────────────────────────────────────────────────────────────┘
       │
       ▼ (401 - Token expirado)
┌─────────────────────────────────────────────────────────────┐
│  Interceptor api.js:                                        │
│  1. POST /api/auth/refresh (com refreshToken)               │
│  2. Se sucesso: atualiza accessToken, repete request        │
│  3. Se falha: logout(), redirect login                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Validação ISBN (Detalhada)

### ISBN-10
- Formato: 9 dígitos + 1 dígito verificador (0-9 ou X)
- Peso: 10,9,8,7,6,5,4,3,2,1
- Soma ponderada % 11 == 0

### ISBN-13
- Formato: 13 dígitos
- Peso alternado: 1,3,1,3,1,3,1,3,1,3,1,3,1
- Soma ponderada % 10 == 0

### Implementação
```javascript
function validateISBN(isbn) {
  const clean = isbn.replace(/[-\s]/g, '');
  
  if (clean.length === 10) return validateISBN10(clean);
  if (clean.length === 13) return validateISBN13(clean);
  
  return { valid: false, type: null, clean };
}
```
- Feedback visual: borda verde/vermelha + ícone check/x + tooltip com tipo detectado
- Formatação automática no blur (ex: `9788535902778` → `978-85-3590-277-8`)

---

## Upload de Imagem (multipart/form-data)

### Client-side
- **Drop zone** com `ondragenter`, `ondragover`, `ondragleave`, `ondrop`
- **Input file** oculto, triggerado por click na drop zone
- **Validação:**
  - Tipos: `image/jpeg`, `image/png`, `image/webp`
  - Tamanho: ≤ 5MB
  - Dimensões: recomendado ≥ 300x450px (aspecto 2:3)
- **Preview:** `URL.createObjectURL(file)` → `<img>` na drop zone
- **Remoção:** Botão X limpa input + preview

### FormData Structure
```javascript
const formData = new FormData();
formData.append('title', title);
formData.append('isbn', isbn);
formData.append('code', code);
formData.append('author', author);        // opcional
formData.append('genre', genre);          // opcional
formData.append('year', year);            // opcional
formData.append('publisher', publisher);  // opcional
formData.append('status', status);        // opcional
formData.append('description', description); // opcional
if (coverFile) formData.append('cover', coverFile);
```

---

## Checklist de Entrega (Definition of Done)

### Estrutura e Base
- [ ] Pastas criadas conforme especificação
- [ ] `index.html` com redirect logic
- [ ] Bootstrap 5.3 via CDN (CSS + JS bundle)
- [ ] `main.css` com design system completo
- [ ] `components.css` com todos os componentes

### Autenticação
- [ ] `login.html` funcional com validação + toggle senha
- [ ] `register.html` funcional com medidor força + confirm
- [ ] `api.js` com interceptors + refresh token automático
- [ ] `auth.js` com guards + storage management
- [ ] Logout funcional (limpa estado + redirect)

### Formulário de Livro
- [ ] `book-form.html` (create + edit modes)
- [ ] Validação ISBN-10/13 completa com checksum
- [ ] Upload drag-drop + preview + validação
- [ ] Accordion detalhes opcionais
- [ ] Dirty check (aviso saída com alterações)
- [ ] Loading/error states
- [ ] `book-form.js` modular

### Lista de Livros
- [ ] `book-list.html` com header controles
- [ ] Busca com debounce 300ms
- [ ] Ordenação (6 opções)
- [ ] Filtro Com/Sem capa
- [ ] Paginação 30/página
- [ ] Grid responsivo (1/2/3/4 colunas)
- [ ] Cards com ações Editar/Excluir + modal confirmação
- [ ] Estado vazio ilustrado
- [ ] Sincronização URL (pushState + parse)
- [ ] `book-list.js` modular

### Qualidade
- [ ] Responsividade testada nos 5 breakpoints
- [ ] Acessibilidade: labels, aria-labels, foco visível, contraste
- [ ] Código comentado para integração backend
- [ ] README.md com setup e endpoints
- [ ] Sem erros de console
- [ ] Funciona offline (exceto chamadas API)

---

## Próximos Passos (Pós-MVP)

1. **Campos ricos no formulário** → Autor, Gênero, Ano, Editora, Status (já preparados no accordion)
2. **Filtros avançados** → Por gênero, status, autor, ano
3. **Busca autocomplete ISBN** → Integração Google Books API
4. **Perfil de usuário** → Avatar, preferências, alterar senha
5. **Recuperação de senha** → Fluxo email + token
6. **PWA** → Service Worker, manifest, offline-first
7. **Testes** → Cypress E2E, Vitest unit
8. **CI/CD** → GitHub Actions + deploy automático

---

## Notas para Integração Backend

1. **CORS:** Configurar `Access-Control-Allow-Origin` para domínio do frontend
2. **Cookies:** `Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth`
3. **Rate limiting:** Recomendado em `/auth/login` e `/auth/register`
4. **Validação server-side:** Nunca confiar apenas no frontend
5. **Sanitização:** Limpar inputs (XSS prevention)
6. **Logs:** Registrar tentativas de login falhas, operações CRUD
7. **Backup:** Estratégia para imagens de capa (S3, local storage, etc.)

---

*Documento gerado em 2026-10-03 - Versão 1.0 (MVP Mínimo)*