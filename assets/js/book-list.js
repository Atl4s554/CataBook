import { api, ApiError } from './api.js';
import { auth } from './auth.js';
import { showToast } from './toast.js';
import { createConfirmModal } from './ui/modal.js';
import { debounce, escapeHtml } from './utils.js';

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
      updateFilterButton();
      option.closest('.dropdown-menu').classList.remove('show');
    });
  });

  filterCover.addEventListener('change', (e) => {
    state.hasCover = e.target.checked ? true : null;
    state.page = 1;
    syncURL();
    loadBooks();
    updateFilterButton();
  });

  if (filterDropdown && window.bootstrap) {
    new window.bootstrap.Dropdown(filterDropdown);
  }

  prevBtn.addEventListener('click', () => changePage(state.page - 1));
  nextBtn.addEventListener('click', () => changePage(state.page + 1));
  newBookBtn.addEventListener('click', () => window.location.href = '/pages/book-form.html');

  updateFilterButton();
}

function updateFilterButton() {
  const filterDropdown = document.getElementById('filter-dropdown');
  if (!filterDropdown) return;

  const sortLabels = {
    'created_at:desc': 'Mais recentes',
    'created_at:asc': 'Mais antigos',
    'title:asc': 'Título (A-Z)',
    'title:desc': 'Título (Z-A)',
    'code:asc': 'Código (A-Z)',
    'code:desc': 'Código (Z-A)',
  };

  const parts = [];
  if (state.sort && sortLabels[state.sort]) {
    parts.push(sortLabels[state.sort]);
  }
  if (state.hasCover) {
    parts.push('Com capa');
  }

  const text = parts.length > 0 ? parts.join(' · ') : 'Filtros';
  filterDropdown.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-1"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
    ${text}
  `;
}

function setupUserMenu() {
  const user = auth.getUser();
  const userNameEl = document.getElementById('user-name');
  const logoutBtn = document.querySelector('[data-action="logout"]');

  if (userNameEl && user) {
    userNameEl.textContent = user.name || user.email;
    userNameEl.classList.remove('d-none');
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
  updateFilterButton();
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
  const table = document.getElementById('books-table');
  const tbody = document.getElementById('books-tbody');
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

      if (books.length) {
        table.style.display = 'block';
        emptyState.style.display = 'none';
      } else {
        table.style.display = 'none';
        emptyState.style.display = 'block';
      }
      pagination.style.display = state.totalPages > 1 ? 'flex' : 'none';
    }
  } catch (error) {
    showToast('Erro ao carregar livros: ' + error.message, 'error');
    table.style.display = 'none';
    emptyState.style.display = 'block';
    pagination.style.display = 'none';
  } finally {
    showGridLoading(false);
  }
}

function renderBooks(books) {
  const tbody = document.getElementById('books-tbody');
  tbody.innerHTML = books.map(book => createBookRow(book)).join('');

  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = `/pages/book-form.html?id=${btn.dataset.id}`;
    });
  });

  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      confirmDelete(btn.dataset.id, btn.dataset.title);
    });
  });
}

function createBookRow(book) {
  const coverUrl = book.cover_url || '/assets/img/placeholder-book.svg';
  const hasCover = !!book.cover_url;

  return `
    <tr data-id="${book.id}">
      <td>
        <img src="${coverUrl}" alt="${escapeHtml(book.title)}" class="book-cover-thumb" loading="lazy" style="width: 40px; height: 60px; object-fit: cover; border-radius: 4px; background: var(--color-light);">
      </td>
      <td>
        <div class="fw-medium text-truncate" style="max-width: 300px;" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</div>
        ${book.description ? `<div class="text-muted small text-truncate" style="max-width: 300px;">${escapeHtml(book.description)}</div>` : ''}
      </td>
      <td class="text-muted small">${escapeHtml(book.isbn)}</td>
      <td class="text-muted small text-center">${escapeHtml(book.quantity || 1)}</td>
      <td class="text-muted small">${escapeHtml(book.code || '—')}</td>
      <td class="text-muted small">${escapeHtml(book.author || '—')}</td>
      <td class="text-muted small">${escapeHtml(book.genre || '—')}</td>
      <td>
        <div class="d-flex flex-column gap-1">
          <a href="/pages/book-form.html?id=${book.id}" class="btn btn-outline-custom btn-sm btn-edit" data-id="${book.id}" title="Editar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </a>
          <button type="button" class="btn btn-danger-custom btn-sm btn-delete" data-id="${book.id}" data-title="${escapeHtml(book.title)}" title="Excluir">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
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
  const { modal, backdrop } = createConfirmModal(
    'Excluir Livro',
    `Tem certeza que deseja excluir "<strong>${escapeHtml(title)}</strong>"? Esta ação não pode ser desfeita.`,
    async () => {
      await deleteBook(id);
      modal.remove();
      backdrop.remove();
    }
  );
  document.body.appendChild(backdrop);
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



function showGridLoading(show) {
  const table = document.getElementById('books-table');
  const overlay = document.getElementById('grid-loading-overlay');

  if (!table || !overlay) return;

  if (show) {
    overlay.classList.remove('d-none');
    table.style.opacity = '0.5';
  } else {
    overlay.classList.add('d-none');
    table.style.opacity = '1';
  }
}

document.addEventListener('DOMContentLoaded', init);

export { init as initBookList };