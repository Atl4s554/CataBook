const API_BASE = '/api';
const DEFAULT_TIMEOUT = 30000;

let demoBooks = [
  { id: '1', title: 'Dom Casmurro', isbn: '978-85-3590-277-8', code: 'LIV-001', author: 'Machado de Assis', genre: 'Romance', year: 1899, publisher: 'Companhia das Letras', status: 'read', description: 'Clássico da literatura brasileira narrado por Bentinho.', cover_url: null, created_at: '2024-01-15T10:30:00Z' },
  { id: '2', title: 'O Senhor dos Anéis: A Sociedade do Anel', isbn: '978-85-3361-334-9', code: 'LIV-002', author: 'J.R.R. Tolkien', genre: 'Fantasia', year: 1954, publisher: 'HarperCollins', status: 'reading', description: 'Primeiro volume da trilogia épica.', cover_url: null, created_at: '2024-01-20T14:15:00Z' },
  { id: '3', title: '1984', isbn: '978-85-254-3549-2', code: 'LIV-003', author: 'George Orwell', genre: 'Ficção Científica', year: 1949, publisher: 'Companhia das Letras', status: 'read', description: 'Distopia clássica sobre vigilância totalitária.', cover_url: null, created_at: '2024-02-01T09:00:00Z' },
  { id: '4', title: 'A Revolução dos Bichos', isbn: '978-85-3591-484-9', code: 'LIV-004', author: 'George Orwell', genre: 'Fábula Política', year: 1945, publisher: 'Companhia das Letras', status: 'want_to_read', description: 'Sátira sobre revolução e corrupção.', cover_url: null, created_at: '2024-02-10T16:45:00Z' },
  { id: '5', title: 'Cem Anos de Solidão', isbn: '978-85-3590-839-6', code: 'LIV-005', author: 'Gabriel García Márquez', genre: 'Realismo Mágico', year: 1967, publisher: 'Record', status: 'read', description: 'Obra-prima do realismo mágico latino-americano.', cover_url: null, created_at: '2024-02-15T11:20:00Z' },
];

let demoBookId = 6;

function isDemoMode() {
  return window.location.protocol === 'file:';
}

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

class ApiError extends Error {
  constructor(message, status, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let refreshPromise = null;

async function request(endpoint, options = {}) {
  if (isDemoMode()) {
    return mockRequest(endpoint, options);
  }
  
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

async function handleResponse(response) {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = isJson ? (data.message || 'Erro na requisição') : 'Erro na requisição';
    const details = isJson ? (data.details || {}) : {};
    throw new ApiError(message, response.status, details);
  }

  return isJson ? data : { success: true, data };
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Refresh failed');

      const data = await response.json();
      if (data.success && data.data?.accessToken) {
        auth.setAccessToken(data.data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const api = {
  get: (endpoint, params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    });
    const query = searchParams.toString();
    return request(`${endpoint}${query ? `?${query}` : ''}`);
  },

  post: (endpoint, data) => request(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  put: (endpoint, data) => request(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  patch: (endpoint, data) => request(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  delete: (endpoint) => request(endpoint, {
    method: 'DELETE',
  }),

  upload: (endpoint, formData) => request(endpoint, {
    method: 'POST',
    headers: {},
    body: formData,
  }),
};

export { ApiError };