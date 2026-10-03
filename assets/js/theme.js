// Theme management module
const THEME_KEY = 'cata_book_theme';
const THEME_ATTR = 'data-theme';

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY);
}

function getPreferredTheme() {
  const stored = getStoredTheme();
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute(THEME_ATTR, theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute(THEME_ATTR) || getPreferredTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  updateToggleButtons(next);
  return next;
}

function initTheme() {
  const theme = getPreferredTheme();
  applyTheme(theme);
  updateToggleButtons(theme);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!getStoredTheme()) {
      applyTheme(e.matches ? 'dark' : 'light');
      updateToggleButtons(e.matches ? 'dark' : 'light');
    }
  });
}

function createThemeToggleButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn theme-toggle d-flex align-items-center gap-2 px-3 py-2';
  btn.style.cssText = `
    background: var(--color-white);
    border: 2px solid var(--color-border);
    color: var(--color-text);
    border-radius: var(--border-radius);
    font-size: 0.95rem;
    font-weight: 500;
    box-shadow: var(--shadow-sm);
    transition: all var(--transition-fast);
  `;
  btn.setAttribute('aria-label', 'Alternar tema');
  btn.innerHTML = `
    <svg class="theme-icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
    <svg class="theme-icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
    <span class="theme-text-light">Tema Claro</span>
    <span class="theme-text-dark">Tema Escuro</span>
  `;
  btn.addEventListener('click', toggleTheme);
  
  const updateHoverStyles = () => {
    const style = getComputedStyle(document.documentElement);
    const primaryColor = style.getPropertyValue('--color-primary').trim();
    const borderColor = style.getPropertyValue('--color-border').trim();
    const shadowMd = style.getPropertyValue('--shadow-md').trim();
    const shadowSm = style.getPropertyValue('--shadow-sm').trim();
    
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = primaryColor;
      btn.style.boxShadow = shadowMd;
    }, { once: true });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = borderColor;
      btn.style.boxShadow = shadowSm;
    }, { once: true });
  };
  
  // Initial setup
  updateHoverStyles();
  
  // Re-attach on theme change
  const observer = new MutationObserver(() => {
    updateHoverStyles();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  
  return btn;
}

function updateToggleButtons(theme) {
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.setAttribute('aria-label', theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro');
  });
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}

export { initTheme, toggleTheme, createThemeToggleButton, applyTheme, getPreferredTheme };