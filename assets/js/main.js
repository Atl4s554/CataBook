import { auth } from './auth.js';
import { showToast } from './toast.js';

function init() {
  initBootstrapComponents();
  initRouteGuards();
  initGlobalLogout();
}

function initBootstrapComponents() {
  if (typeof bootstrap === 'undefined') return;

  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
    new bootstrap.Tooltip(el);
  });

  document.querySelectorAll('[data-bs-toggle="popover"]').forEach(el => {
    new bootstrap.Popover(el);
  });

  document.querySelectorAll('.dropdown-toggle').forEach(el => {
    new bootstrap.Dropdown(el);
  });

  document.querySelectorAll('[data-bs-toggle="collapse"]').forEach(el => {
    new bootstrap.Collapse(el.querySelector(el.dataset.bsTarget), { toggle: false });
  });
}

function initRouteGuards() {
  const path = window.location.pathname;

  const publicPages = ['/pages/login.html', '/pages/register.html'];
  const isPublicPage = publicPages.some(p => path.endsWith(p));

  if (isPublicPage) {
    auth.redirectIfAuthenticated();
  } else if (!path.endsWith('index.html') && path !== '/' && path !== '') {
    auth.requireAuth();
  }
}

function initGlobalLogout() {
  document.addEventListener('click', (e) => {
    const logoutBtn = e.target.closest('[data-action="logout"]');
    if (logoutBtn) {
      e.preventDefault();
      auth.logout();
    }
  });
}

window.showToast = showToast;

document.addEventListener('DOMContentLoaded', init);

export { init as initMain };