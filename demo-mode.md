# Demo Mode - Documentação de Mudanças

Este arquivo documenta todas as modificações feitas para habilitar o modo demo (funcionamento via `file://` sem backend). Para restaurar o comportamento original (produção com backend real), remova ou reverta as seções marcadas com `// DEMO MODE:`.

---

## 1. assets/js/auth.js

### Adicionado no topo (após imports/variáveis):
```javascript
// DEMO MODE: Variável para controlar modo demo
let isDemoMode = false;

// DEMO MODE: Detecta se está rodando via file://
function isFileProtocol() {
  return window.location.protocol === 'file:';
}

// DEMO MODE: Inicializa modo demo se file://
function initDemoMode() {
  if (isFileProtocol() && !sessionStorage.getItem('cata_book_demo_disabled')) {
    isDemoMode = true;
    accessToken = 'demo-token-' + Date.now();
    user = { id: 'demo', name: 'Usuário Demo', email: 'demo@catalivro.local' };
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    console.log('[CataBook] Modo demo ativado (file:// detectado)');
  }
}

// DEMO MODE: Chamada adicionada no initAuth()
function initAuth() {
  initDemoMode();  // DEMO MODE: Adicionado
  try {
    const storedToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    const storedUser = sessionStorage.getItem(USER_KEY);
    if (storedToken) accessToken = storedToken;
    if (storedUser) user = JSON.parse(storedUser);
  } catch {
    clearAuth();
  }
}
```

### Adicionado getter para demo mode:
```javascript
// DEMO MODE: Getter para verificar se está em modo demo
function getDemoMode() {
  return isDemoMode;
}
```

### Export atualizado:
```javascript
// DEMO MODE: Adicionado getDemoMode ao export
export const auth = {
  login,
  register,
  logout,
  getAccessToken,
  getUser,
  isAuthenticated,
  getDemoMode,  // DEMO MODE: Adicionado
  requireAuth,
  redirectIfAuthenticated,
  setAccessToken,
};
```

---

## 2. assets/js/main.js

### Modificado initRouteGuards():
```javascript
// DEMO MODE: Verifica getDemoMode() antes de exigir auth
function initRouteGuards() {
  const path = window.location.pathname;

  const publicPages = ['/pages/login.html', '/pages/register.html'];
  const isPublicPage = publicPages.some(p => path.endsWith(p));

  if (isPublicPage) {
    auth.redirectIfAuthenticated();
  } else if (!path.endsWith('index.html') && path !== '/' && path !== '') {
    if (!auth.getDemoMode()) {  // DEMO MODE: Adicionado esta verificação
      auth.requireAuth();
    }
  }
}
```

---

## 3. assets/js/api.js

### Substituído completamente - Adicionado mock completo no topo:
```javascript
// DEMO MODE: Início do mock da API para modo file://
const API_BASE = '/api';
const DEFAULT_TIMEOUT = 30000;

// DEMO MODE: Dados mock persistidos na sessão
let demoBooks = [
  { id: '1', title: 'Dom Casmurro', isbn: '978-85-3590-277-8', code: 'LIV-001', author: 'Machado de Assis', genre: 'Romance', year: 1899, publisher: 'Companhia das Letras', status: 'read', description: 'Clássico da literatura brasileira narrado por Bentinho.', cover_url: null, created_at: '2024-01-15T10:30:00Z' },
  { id: '2', title: 'O Senhor dos Anéis: A Sociedade do Anel', isbn: '978-85-3361-334-9', code: 'LIV-002', author: 'J.R.R. Tolkien', genre: 'Fantasia', year: 1954, publisher: 'HarperCollins', status: 'reading', description: 'Primeiro volume da trilogia épica.', cover_url: null, created_at: '2024-01-20T14:15:00Z' },
  { id: '3', title: '1984', isbn: '978-85-254-3549-2', code: 'LIV-003', author: 'George Orwell', genre: 'Ficção Científica', year: 1949, publisher: 'Companhia das Letras', status: 'read', description: 'Distopia clássica sobre vigilância totalitária.', cover_url: null, created_at: '2024-02-01T09:00:00Z' },
  { id: '4', title: 'A Revolução dos Bichos', isbn: '978-85-3591-484-9', code: 'LIV-004', author: 'George Orwell', genre: 'Fábula Política', year: 1945, publisher: 'Companhia das Letras', status: 'want_to_read', description: 'Sátira sobre revolução e corrupção.', cover_url: null, created_at: '2024-02-10T16:45:00Z' },
  { id: '5', title: 'Cem Anos de Solidão', isbn: '978-85-3590-839-6', code: 'LIV-005', author: 'Gabriel García Márquez', genre: 'Realismo Mágico', year: 1967, publisher: 'Record', status: 'read', description: 'Obra-prima do realismo mágico latino-americano.', cover_url: null, created_at: '2024-02-15T11:20:00Z' },
];

let demoBookId = 6;

// DEMO MODE: Detecta modo file://
function isDemoMode() {
  return window.location.protocol === 'file:';
}

// DEMO MODE: Gera livro mock
function generateMockBook(data) {
  return {
    id: String(demoBookId++),
    title: data.title,
    isbn: data.isbn,
    code: data.code,
    author: data.author || '',
    genre: data.genre || '',
    year: data.year ? parseInt(data.year) : null,
    publisher: data.publisher || '',
    status: data.status || '',
    description: data.description || '',
    cover_url: null,
    created_at: new Date().toISOString(),
  };
}

// DEMO MODE: Filtra livros mock
function filterBooks(params) {
  let result = [...demoBooks];
  
  if (params.q) {
    const query = params.q.toLowerCase();
    result = result.filter(b => 
      b.title.toLowerCase().includes(query) ||
      b.isbn.includes(query) ||
      b.code.toLowerCase().includes(query) ||
      (b.description && b.description.toLowerCase().includes(query))
    );
  }
  
  if (params.has_cover === 'true') {
    result = result.filter(b => b.cover_url);
  }
  
  if (params.sort) {
    const [field, dir] = params.sort.split(':');
    result.sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (dir === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }
  
  return result;
}

// DEMO MODE: Handler principal do mock
async function mockRequest(endpoint, options = {}) {
  await new Promise(r => setTimeout(r, 300));
  
  const method = options.method || 'GET';
  
  if (endpoint === '/books' && method === 'GET') {
    const params = new URLSearchParams(options.body?.toString() || '');
    const page = parseInt(params.get('page')) || 1;
    const limit = parseInt(params.get('limit')) || 30;
    const filtered = filterBooks(Object.fromEntries(params));
    const total = filtered.length;
    const start = (page - 1) * limit;
    const books = filtered.slice(start, start + limit);
    
    return { success: true, data: { books, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } };
  }
  
  if (endpoint.startsWith('/books/') && method === 'GET') {
    const id = endpoint.split('/')[2];
    const book = demoBooks.find(b => b.id === id);
    if (book) return { success: true, data: { book } };
    throw new ApiError('Livro não encontrado', 404);
  }
  
  if (endpoint === '/books' && (method === 'POST' || method === 'PUT')) {
    const formData = options.body;
    const data = {};
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }
    let book;
    if (method === 'POST') {
      book = generateMockBook(data);
      demoBooks.unshift(book);
    } else {
      const id = endpoint.split('/')[2];
      const idx = demoBooks.findIndex(b => b.id === id);
      if (idx === -1) throw new ApiError('Livro não encontrado', 404);
      book = { ...demoBooks[idx], ...data };
      demoBooks[idx] = book;
    }
    return { success: true, data: { book } };
  }
  
  if (endpoint.startsWith('/books/') && method === 'DELETE') {
    const id = endpoint.split('/')[2];
    const idx = demoBooks.findIndex(b => b.id === id);
    if (idx === -1) throw new ApiError('Livro não encontrado', 404);
    demoBooks.splice(idx, 1);
    return { success: true, message: 'Livro excluído' };
  }
  
  if (endpoint === '/auth/login') {
    return { success: true, data: { accessToken: 'demo-token', refreshToken: 'demo-refresh', user: { id: 'demo', name: 'Demo User', email: 'demo@test.com' } } };
  }
  
  if (endpoint === '/auth/register') {
    return { success: true, data: { accessToken: 'demo-token', refreshToken: 'demo-refresh', user: { id: 'demo', name: 'Demo User', email: 'demo@test.com' } } };
  }
  
  if (endpoint === '/auth/refresh') {
    return { success: true, data: { accessToken: 'demo-token-new' } };
  }
  
  if (endpoint === '/auth/logout') {
    return { success: true };
  }
  
  throw new ApiError('Endpoint não simulado: ' + endpoint, 501);
}

// DEMO MODE: Classe ApiError (mantida igual)
class ApiError extends Error {
  constructor(message, status, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let refreshPromise = null;

// DEMO MODE: request() modificada para usar mock no modo demo
async function request(endpoint, options = {}) {
  if (isDemoMode()) {  // DEMO MODE: Verifica modo demo
    return mockRequest(endpoint, options);
  }
  
  // ... código original de fetch real mantido abaixo ...
```

### request() - Mantido código original após bloco demo:
```javascript
  // DEMO MODE: Código original de produção mantido
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const accessToken = auth.getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);
  config.signal = controller.signal;

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);

    if (response.status === 401 && !endpoint.includes('/auth/')) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        config.headers.Authorization = `Bearer ${auth.getAccessToken()}`;
        const retryResponse = await fetch(url, config);
        return handleResponse(retryResponse);
      }
      auth.logout();
      window.location.href = '/pages/login.html';
      throw new ApiError('Sessão expirada. Faça login novamente.', 401);
    }

    return handleResponse(response);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new ApiError('Tempo de requisição esgotado', 408);
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError('Erro de conexão com o servidor', 0);
  }
}
```

### handleResponse() e refreshAccessToken() - Mantidos originais:
```javascript
// DEMO MODE: Funções originais mantidas sem alteração
async function handleResponse(response) { ... }
async function refreshAccessToken() { ... }
```

### Export api - Mantido original:
```javascript
// DEMO MODE: Export original mantido
export const api = { get, post, put, patch, delete, upload };
export { ApiError };
```

---

## Como Restaurar para Produção

### Opção 1: Remover completamente o modo demo (recomendado)
Substitua `assets/js/api.js` pela versão original (apenas fetch real, sem mock).
Remova de `auth.js`: `isDemoMode`, `isFileProtocol()`, `initDemoMode()`, `getDemoMode()`, e a chamada `initDemoMode()` no `initAuth()`.
Remova de `main.js`: o `if (!auth.getDemoMode())` no `initRouteGuards()`.

### Opção 2: Desabilitar via flag (temporário)
No console do navegador, execute:
```javascript
sessionStorage.setItem('cata_book_demo_disabled', 'true');
location.reload();
```
Isso força o modo produção mesmo em `file://`.

### Opção 3: Servidor local (para testar integração real)
```bash
npx serve .
# ou
python -m http.server 8000
```
Acesse via `http://localhost:3000` ou `http://localhost:8000` - o modo demo **não** será ativado automaticamente.

---

## Arquivos Modificados
- `assets/js/auth.js` - +35 linhas (demo mode detection, init, getter)
- `assets/js/main.js` - +3 linhas (guard condicional)
- `assets/js/api.js` - +180 linhas (mock completo da API)

Total: ~218 linhas adicionadas para suporte ao modo demo.