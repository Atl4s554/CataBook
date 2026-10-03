import { bookRepository } from './storage.js';
import { auth } from './auth.js';

const API_BASE = '/api';
const DEFAULT_TIMEOUT = 30000;

function isDemoMode() {
  try {
    if (localStorage.getItem('cata_book_use_api') === '1') return false;
  } catch {}
  return true;
}

function parseFormData(formData) {
  const data = {};
  for (const [key, value] of formData.entries()) {
    data[key] = value;
  }
  return data;
}

async function repositoryRequest(endpoint, options = {}) {
  await new Promise(r => setTimeout(r, 150));
  
  const method = options.method || 'GET';
  const isUpload = options.body instanceof FormData;
  const bodyData = isUpload ? parseFormData(options.body) : options.body;
  
  // Parse query string from endpoint (api.get appends params to URL)
  const [path, queryString] = endpoint.split('?');
  const queryParams = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};
  
  // Books endpoints
  if (path === '/books' && method === 'GET') {
    const result = await bookRepository.list(queryParams);
    return { success: true, data: result };
  }
  
  if (path === '/books' && method === 'POST') {
    const book = await bookRepository.create(bodyData);
    if (bodyData.cover instanceof File) {
      const coverResult = await bookRepository.uploadCover(bodyData.cover);
      await bookRepository.setCover(book.id, coverResult.cover_url);
      book.cover_url = coverResult.cover_url;
    }
    return { success: true, data: { book } };
  }
  
  if (path.startsWith('/books/') && method === 'GET') {
    const id = path.split('/')[2];
    const book = await bookRepository.get(id);
    if (book) return { success: true, data: book };
    throw new ApiError('Livro não encontrado', 404);
  }
  
  if (path.startsWith('/books/') && (method === 'PUT' || method === 'PATCH' || method === 'POST')) {
    const id = path.split('/')[2];
    let book = await bookRepository.update(id, bodyData);
    if (!book) throw new ApiError('Livro não encontrado', 404);
    if (bodyData && bodyData.cover instanceof File) {
      const coverResult = await bookRepository.uploadCover(bodyData.cover);
      await bookRepository.setCover(book.id, coverResult.cover_url);
      book = { ...book, cover_url: coverResult.cover_url };
    }
    return { success: true, data: { book } };
  }
  
  if (path.startsWith('/books/') && method === 'DELETE') {
    const id = path.split('/')[2];
    await bookRepository.delete(id);
    return { success: true, message: 'Livro excluído' };
  }
  
  if (path === '/auth/login') {
    return { success: true, data: { accessToken: 'demo-token', refreshToken: 'demo-refresh', user: { id: 'demo', name: 'Demo User', email: 'demo@test.com' } } };
  }
  
  if (path === '/auth/register') {
    return { success: true, data: { accessToken: 'demo-token', refreshToken: 'demo-refresh', user: { id: 'demo', name: 'Demo User', email: 'demo@test.com' } } };
  }
  
  if (path === '/auth/refresh') {
    return { success: true, data: { accessToken: 'demo-token-new' } };
  }
  
  if (path === '/auth/logout') {
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
    return repositoryRequest(endpoint, options);
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