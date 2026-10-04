# Guia de Remoção do Modo de Desenvolvimento

Este documento explica como o modo de desenvolvimento (localStorage) foi implementado e como removê-lo quando o backend real estiver disponível.

---

## O que é o Modo de Desenvolvimento

O modo de desenvolvimento (`isLocalMode`) permite que a aplicação funcione sem backend, persistindo dados no `localStorage` do navegador. Foi criado para permitir desenvolvimento e testes offline.

**Arquivos envolvidos:**
- `assets/js/api.js` - Implementação principal do modo local
- `assets/js/storage.js` - Repositório localStorage (books, covers, users)
- `assets/js/auth.js` - Autenticação via localStorage

---

## Como funciona atualmente

### Ativação automática
O modo local é ativado automaticamente quando:
- `localStorage.getItem('cata_book_local_mode') === 'true'` (forçado)
- **OU** hostname é `localhost`, `127.0.0.1`, `0.0.0.0` ou termina em `.local`

```javascript
// api.js - função isLocalMode()
function isLocalMode() {
  try {
    if (localStorage.getItem('cata_book_local_mode') === 'true') return true;
    if (localStorage.getItem('cata_book_local_mode') === 'false') return false;
  } catch {}
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname.endsWith('.local');
}
```

### Dados persistidos no localStorage
| Chave | Conteúdo |
|-------|----------|
| `cata_book_books` | Array de livros (id, title, isbn, code, quantity, author, genre, year, publisher, description, cover_url, created_at, updated_at) |
| `cata_book_covers` | Objeto `{ bookId: base64DataURL }` |
| `cata_book_users` | Array de usuários (id, name, email, password, role, created_at) |
| `cata_book_local_mode` | Flag booleana para forçar modo local |

### Seed de usuários demo
Na primeira execução em modo local, cria automaticamente:
```javascript
[
  { email: 'admin@catalivro.local', password: '123456', role: 'admin' },
  { email: 'user@catalivro.local', password: '123456', role: 'user' }
]
```

---

## Como remover o Modo de Desenvolvimento

Quando o backend real estiver pronto, siga estes passos:

### 1. Remover a lógica de modo local do `api.js`

**Remover completamente:**
- Função `isLocalMode()`
- Função `seedDemoUsers()` e chamada `seedDemoUsers()`
- Função `repositoryRequest()` (todo o bloco)
- Tratamento de `isLocalMode()` na função `request()`
- Endpoints `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout` do modo local

**Manter apenas:**
- Classe `ApiError`
- Funções `request()`, `handleResponse()`, `refreshAccessToken()`
- Export `api` (get, post, put, patch, delete, upload)
- Constantes `API_BASE`, `DEFAULT_TIMEOUT`

### 2. Limpar `auth.js`

**Remover:**
- Lógica de seed de usuários demo (já removida do api.js)
- Qualquer referência a modo local

**Manter:**
- Gerenciamento de token (`getAccessToken`, `setTokens`, `clearAuth`)
- Funções `login`, `register`, `logout`, `requireAuth`, `redirectIfAuthenticated`
- Integração com `api.js` via `setTokenGetter` / `setUnauthorizedHandler`

### 3. Limpar `storage.js`

**Remover completamente** (não será mais usado):
- Todo o arquivo `assets/js/storage.js`
- Import em `api.js` (`import { bookRepository } from './storage.js'`)

### 4. Limpar `main.js` / `auth.js`

**Remover:**
- Qualquer referência a modo local ou `getDemoMode` (já removido)

### 5. Atualizar `api.js` para usar backend real

O `api.js` já tem a estrutura para backend real na função `request()`:
- Adiciona header `Authorization: Bearer <token>`
- Trata 401 com refresh token
- Trata erros de rede

Certifique-se que `API_BASE` aponta para seu backend real (ex: `https://api.seudominio.com`).

---

## Checklist de Remoção

- [ ] Remover `isLocalMode()` do `api.js`
- [ ] Remover `repositoryRequest()` e `seedDemoUsers()` do `api.js`
- [ ] Remover endpoints `/auth/*` do modo local do `repositoryRequest`
- [ ] Remover `import { bookRepository } from './storage.js'` do `api.js`
- [ ] Deletar arquivo `assets/js/storage.js`
- [ ] Remover `seedDemoUsers()` e referências a modo local do `auth.js`
- [ ] Verificar se `api.js` usa `fetch` real para todos endpoints
- [ ] Testar login/registro com backend real
- [ ] Testar CRUD de livros com backend real
- [ ] Remover flag `cata_book_local_mode` do localStorage (opcional, limpeza)

---

## Como testar antes de remover

1. **Modo local ativo** (padrão em localhost):
   ```bash
   python3 -m http.server 8000
   # Acesse http://localhost:8000/pages/login.html
   # Login: admin@catalivro.local / 123456
   ```

2. **Forçar modo API real** (para testar integração):
   ```javascript
   // No console do navegador:
   localStorage.setItem('cata_book_local_mode', 'false');
   location.reload();
   ```

3. **Verificar se API real é chamada**:
   - Abra DevTools > Network
   - Faça login/CRUD
   - Deve aparecer requisições para `/api/...`

---

## Estrutura esperada da API Real

Quando o backend estiver pronto, a API deve implementar:

### Auth
| Método | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/login` | `{email, password}` | `{accessToken, refreshToken, user}` |
| POST | `/api/auth/register` | `{email, password, name}` | `{accessToken, refreshToken, user}` |
| POST | `/api/auth/refresh` | - | `{accessToken}` |
| POST | `/api/auth/logout` | - | `{success: true}` |

### Books
| Método | Endpoint | Query/Body | Response |
|--------|----------|------------|----------|
| GET | `/api/books` | `page, limit, sort, q, has_cover` | `{books: [], pagination: {page, limit, total, totalPages}}` |
| GET | `/api/books/:id` | - | `{book}` |
| POST | `/api/books` | FormData (title, isbn, quantity, code, author, genre, year, publisher, description, cover) | `{book}` |
| PUT/PATCH | `/api/books/:id` | FormData | `{book}` |
| DELETE | `/api/books/:id` | - | `{success: true, message}` |

### Headers esperados
```
Authorization: Bearer <accessToken>
Content-Type: application/json (ou multipart/form-data para upload)
```

---

## Rollback (se precisar reativar modo local)

Se precisar voltar ao modo local após remover:

1. Recupere `api.js` e `storage.js` do Git
2. Adicione de volta `import { bookRepository } from './storage.js'`
3. Recrie `assets/js/storage.js`
4. Adicione de volta `isLocalMode()` e `repositoryRequest()`

---

## Notas Importantes

- **Não commite** `cata_book_local_mode=true` no repositório
- O modo local usa `localStorage` - dados persistem entre recarregamentos
- Senhas demo (`123456`) são **inseguras** - só para desenvolvimento
- Covers são salvos como base64 no localStorage (limitado ~5MB)

---

*Documento gerado durante refatoração do CataBook. Atualize conforme necessário.*