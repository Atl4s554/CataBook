import { api, ApiError } from './api.js';
import { auth } from './auth.js';
import { showToast } from './toast.js';

const state = {
  page: 1,
  limit: 30,
  q: '',
  sort: 'created_at:desc',
  hasCover: null,
  totalPages: 1,
  totalItems: 0,
};

let debouncedSearch = null;

function init() {
  if (!auth.requireAuth()) return;

  setupEventListeners();
  parseURL();
  loadBooks();
  setupUserMenu();
}

function setupEventListeners() {
  const searchInput = document.getElementById('search-input');
  const filterCover = document.getElementById('filter-cover');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const newBookBtn = document.getElementById('new-book-btn');
  const filterDropdown = document.getElementById('filter-dropdown');
  const sortOptions = document.querySelectorAll('.sort-option');

  debouncedSearch = debounce((term) => {
    state.q = term;
    state.page = 1;
    syncURL();
    loadBooks();
  }, 300);

  searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));

  sortOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      e.preventDefault();
      state.sort = option.dataset.sort;
      state.page = 1;
      syncURL();
      loadBooks();
      option.closest('.dropdown-menu').classList.remove('show');
    });
  });

  filterCover.addEventListener('change', (e) => {
    state.hasCover = e.target.checked ? true : null;
    state.page = 1;
    syncURL();
    loadBooks();
  });
  prevBtn.addEventListener('click', () => changePage(state.page - 1));
  nextBtn.addEventListener('click', () => changePage(state.page + 1));
  newBookBtn.addEventListener('click', () => window.location.href = '/pages/book-form.html');
}

function setupUserMenu() {
  const user = auth.getUser();
  const userNameEl = document.getElementById('user-name');
  const logoutBtn = document.getElementById('logout-btn');

  if (userNameEl && user?.name) {
    userNameEl.textContent = user.name;
  }
  if (userNameEl && user?.email) {
    userNameEl.textContent = user.email;
  }

  logoutBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    auth.logout();
  });
}

function parseURL() {
  const params = new URLSearchParams(window.location.search);
  state.page = parseInt(params.get('page')) || 1;
  state.q = params.get('q') || '';
  state.sort = params.get('sort') || 'created_at:desc';
  state.hasCover = params.get('has_cover') === 'true' ? true : null;

  document.getElementById('search-input').value = state.q;
  document.getElementById('filter-cover').checked = state.hasCover === true;
}

function syncURL() {
  const params = new URLSearchParams();
  if (state.page > 1) params.set('page', state.page);
  if (state.q) params.set('q', state.q);
  if (state.sort !== 'created_at:desc') params.set('sort', state.sort);
  if (state.hasCover === true) params.set('has_cover', 'true');

  const newURL = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  window.history.pushState({}, '', newURL);
}

async function loadBooks() {
  const grid = document.getElementById('books-grid');
  const pagination = document.getElementById('pagination');
  const emptyState = document.getElementById('empty-state');
  const resultsInfo = document.getElementById('results-info');

  showGridLoading(true);

  try {
    const params = {
      page: state.page,
      limit: state.limit,
      sort: state.sort,
    };
    if (state.q) params.q = state.q;
    if (state.hasCover !== null) params.has_cover = state.hasCover;

    const response = await api.get('/books', params);

    if (response.success && response.data) {
      const { books, pagination: pag } = response.data;
      state.totalPages = pag.totalPages || 1;
      state.totalItems = pag.total || 0;

      renderBooks(books);
      renderPagination();
      updateResultsInfo();

      grid.style.display = books.length ? 'grid' : 'none';
      emptyState.style.display = books.length ? 'none' : 'block';
      pagination.style.display = state.totalPages > 1 ? 'flex' : 'none';
    }
  } catch (error) {
    showToast('Erro ao carregar livros: ' + error.message, 'error');
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    pagination.style.display = 'none';
  } finally {
    showGridLoading(false);
  }
}

function renderBooks(books) {
  const grid = document.getElementById('books-grid');
  grid.innerHTML = books.map(book => createBookCard(book)).join('');

  grid.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = `/pages/book-form.html?id=${btn.dataset.id}`;
    });
  });

  grid.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      confirmDelete(btn.dataset.id, btn.dataset.title);
    });
  });
}

function createBookCard(book) {
  const coverUrl = book.cover_url || '/assets/img/placeholder-book.svg';
  const hasCover = !!book.cover_url;

  return `
    <article class="card-book" data-id="${book.id}">
      <img src="${coverUrl}" alt="${escapeHtml(book.title)}" class="card-book__image" loading="lazy">
      <div class="card-book__body">
        <h3 class="card-book__title text-truncate-2" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h3>
        <p class="card-book__meta">
          <span>ISBN: ${escapeHtml(book.isbn)}</span>
          ${book.code ? ` • Código: ${escapeHtml(book.code)}` : ''}
        </p>
        ${book.description ? `<p class="card-book__description text-truncate-3">${escapeHtml(book.description)}</p>` : ''}
        <div class="card-book__actions">
          <a href="/pages/book-form.html?id=${book.id}" class="btn btn-outline-custom btn-sm btn-edit" data-id="${book.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Editar
          </a>
          <button type="button" class="btn btn-danger-custom btn-sm btn-delete" data-id="${book.id}" data-title="${escapeHtml(book.title)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Excluir
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderPagination() {
  const pagination = document.getElementById('pagination');
  const pageNumbers = document.getElementById('page-numbers');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');

  prevBtn.disabled = state.page <= 1;
  nextBtn.disabled = state.page >= state.totalPages;

  let pagesHtml = '';
  const maxVisible = 5;
  let start = Math.max(1, state.page - Math.floor(maxVisible / 2));
  let end = Math.min(state.totalPages, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pagesHtml += `
      <a href="#" class="page-link-custom ${i === state.page ? 'active' : ''}" data-page="${i}">${i}</a>
    `;
  }

  pageNumbers.innerHTML = pagesHtml;

  pageNumbers.querySelectorAll('.page-link-custom').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      changePage(parseInt(link.dataset.page));
    });
  });
}

function changePage(page) {
  if (page < 1 || page > state.totalPages) return;
  state.page = page;
  syncURL();
  loadBooks();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateResultsInfo() {
  const info = document.getElementById('results-info');
  if (state.totalItems === 0) {
    info.textContent = 'Nenhum livro encontrado';
  } else {
    const start = (state.page - 1) * state.limit + 1;
    const end = Math.min(state.page * state.limit, state.totalItems);
    info.textContent = `Mostrando ${start} a ${end} de ${state.totalItems} livro(s)`;
  }
}

function confirmDelete(id, title) {
  const modal = createConfirmModal(
    'Excluir Livro',
    `Tem certeza que deseja excluir "<strong>${escapeHtml(title)}</strong>"? Esta ação não pode ser desfeita.`,
    async () => {
      await deleteBook(id);
      modal.remove();
    }
  );
  document.body.appendChild(modal);
  modal.querySelector('.btn-danger-custom').focus();
}

async function deleteBook(id) {
  try {
    showToast('Excluindo...', 'info');
    const response = await api.delete(`/books/${id}`);
    if (response.success) {
      showToast('Livro excluído com sucesso', 'success');
      loadBooks();
    }
  } catch (error) {
    showToast('Erro ao excluir: ' + error.message, 'error');
  }
}

function createConfirmModal(title, message, onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'modal-custom';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'modal-title');
  modal.innerHTML = `
    <div class="modal-backdrop-custom" data-dismiss="modal"></div>
    <div class="modal-custom__content">
      <header class="modal-custom__header">
        <h2 id="modal-title" class="modal-custom__title">${title}</h2>
        <button type="button" class="modal-custom__close" data-dismiss="modal" aria-label="Fechar">&times;</button>
      </header>
      <div class="modal-custom__body">${message}</div>
      <footer class="modal-custom__footer">
        <button type="button" class="btn btn-outline-custom" data-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-danger-custom">Excluir</button>
      </footer>
    </div>
  `;

  modal.querySelectorAll('[data-dismiss="modal"]').forEach(el => {
    el.addEventListener('click', () => modal.remove());
  });

  modal.querySelector('.btn-danger-custom').addEventListener('click', () => {
    onConfirm();
  });

  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  });

  return modal;
}

function showGridLoading(show) {
  const grid = document.getElementById('books-grid');
  const overlay = document.getElementById('grid-loading-overlay');

  if (show) {
    overlay.classList.remove('d-none');
    grid.style.opacity = '0.5';
  } else {
    overlay.classList.add('d-none');
    grid.style.opacity = '1';
  }
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);

export { init as initBookList };