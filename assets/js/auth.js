import { setTokenGetter, setUnauthorizedHandler } from './api.js';

const ACCESS_TOKEN_KEY = 'cata_book_access_token';
const USER_KEY = 'cata_book_user';

let accessToken = null;
let user = null;

function initAuth() {
  try {
    const storedToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    const storedUser = sessionStorage.getItem(USER_KEY);
    if (storedToken) accessToken = storedToken;
    if (storedUser) user = JSON.parse(storedUser);
  } catch {
    clearAuth();
  }
  setTokenGetter(getAccessToken);
  setUnauthorizedHandler(() => {
    clearAuth();
    window.location.href = '/pages/login.html';
  });
}

function setTokens(tokenData) {
  if (tokenData.accessToken) {
    accessToken = tokenData.accessToken;
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (tokenData.user) {
    user = tokenData.user;
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

function setAccessToken(token) {
  accessToken = token;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

function getAccessToken() {
  return accessToken;
}

function getUser() {
  return user;
}

function isAuthenticated() {
  return !!accessToken;
}

function clearAuth() {
  accessToken = null;
  user = null;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

async function login(credentials) {
  const { api } = await import('./api.js');
  const response = await api.post('/auth/login', credentials);
  if (response.success && response.data) {
    setTokens(response.data);
    return response.data;
  }
  throw new Error(response.message || 'Erro ao fazer login');
}

async function register(data) {
  const { api } = await import('./api.js');
  const response = await api.post('/auth/register', data);
  if (response.success && response.data) {
    setTokens(response.data);
    return response.data;
  }
  throw new Error(response.message || 'Erro ao cadastrar');
}

async function logout() {
  try {
    const { api } = await import('./api.js');
    await api.post('/auth/logout');
  } catch {
    // Ignore logout API errors
  }
  clearAuth();
  window.location.href = '/pages/login.html';
}

function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/pages/login.html';
    return false;
  }
  return true;
}

function redirectIfAuthenticated() {
  if (isAuthenticated()) {
    window.location.href = '/pages/book-list.html';
    return true;
  }
  return false;
}

// initAuth será chamado no DOMContentLoaded para garantir que sessionStorage esteja disponível

document.addEventListener('DOMContentLoaded', initAuth);

export const auth = {
  login,
  register,
  logout,
  getAccessToken,
  getUser,
  isAuthenticated,
  requireAuth,
  redirectIfAuthenticated,
  setAccessToken,
};