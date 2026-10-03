import { api, ApiError } from './api.js';
import { auth } from './auth.js';
import { validateISBN, formatISBN, validateFile, showError, clearError, setFieldValid } from './validation.js';
import { showToast } from './toast.js';
import { createConfirmModal } from './book-list.js';

let currentMode = 'create';
let currentBookId = null;
let coverFile = null;
let originalData = null;

function init() {
  console.log('Init book-form');
  const params = new URLSearchParams(window.location.search);
  currentBookId = params.get('id');
  currentMode = currentBookId ? 'edit' : 'create';

  setupEventListeners();
  setupDropZone();
  setupISBNValidation();
  setupAccordion();
  setupDirtyCheck();
  updateUserName();

  if (currentMode === 'edit') {
    loadBook(currentBookId);
  } else {
    updatePageTitle('Novo Livro');
  }
}

function updateUserName() {
  const user = auth.getUser();
  const userNameEl = document.getElementById('user-name');
  if (user && userNameEl) {
    userNameEl.textContent = user.name || user.email;
    userNameEl.classList.remove('d-none');
  }
}

function setupEventListeners() {
  const form = document.getElementById('book-form');
  form.addEventListener('submit', handleSubmit);

  const cancelBtn = document.getElementById('cancel-btn');
  cancelBtn?.addEventListener('click', handleCancel);

  const cancelBtnBottom = document.getElementById('cancel-btn-bottom');
  cancelBtnBottom?.addEventListener('click', handleCancel);

  const coverInput = document.getElementById('cover');
  coverInput.addEventListener('change', handleFileSelect);

  const removeCoverBtn = document.getElementById('remove-cover');
  removeCoverBtn?.addEventListener('click', removeCover);

  const logoutBtn = document.querySelector('[data-action="logout"]');
  logoutBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    auth.logout();
  });
}

function setupDropZone() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('cover');

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) handleFile(files[0]);
  });

  dropZone.addEventListener('click', () => fileInput.click());
}

function setupISBNValidation() {
  const isbnInput = document.getElementById('isbn');
  isbnInput.addEventListener('blur', () => {
    const result = validateISBN(isbnInput.value);
    updateISBNFeedback(isbnInput, result);
    if (result.valid && result.clean !== isbnInput.value) {
      isbnInput.value = formatISBN(isbnInput.value);
    }
  });

  isbnInput.addEventListener('input', () => {
    clearError(isbnInput);
  });
}

function setupAccordion() {
  const headers = document.querySelectorAll('.accordion-custom__header');
  console.log('Found accordion headers:', headers.length);
  headers.forEach(header => {
    header.addEventListener('click', (e) => { e.preventDefault();
      console.log('Accordion clicked');
      const expanded = header.getAttribute('aria-expanded') === 'true';
      header.setAttribute('aria-expanded', !expanded);
      const body = header.nextElementSibling;
      console.log('Body:', body);
      if (!expanded) {
        body.removeAttribute('hidden');
      } else {
        body.setAttribute('hidden', '');
      }
    });
  });
}

function setupDirtyCheck() {
  const form = document.getElementById('book-form');
  const inputs = form.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    input.addEventListener('change', () => {
      window.formDirty = true;
    });
  });
}

async function loadBook(id) {
  try {
    showLoading(true);
    const response = await api.get(`/books/${id}`);
    if (response.success && response.data) {
      populateForm(response.data);
      originalData = serializeForm();
      updatePageTitle(`Editar: ${response.data.title}`);
    }
  } catch (error) {
    showToast('Erro ao carregar livro: ' + error.message, 'error');
    setTimeout(() => window.location.href = '/pages/book-list.html', 2000);
  } finally {
    showLoading(false);
  }
}

function populateForm(book) {
  document.getElementById('title').value = book.title || '';
  document.getElementById('isbn').value = book.isbn || '';
  document.getElementById('quantity').value = book.quantity || 1;
  document.getElementById('code').value = book.code || '';
  document.getElementById('author').value = book.author || '';
  document.getElementById('genre').value = book.genre || '';
  document.getElementById('year').value = book.year || '';
  document.getElementById('publisher').value = book.publisher || '';
  document.getElementById('description').value = book.description || '';

  if (book.cover_url) {
    showCoverPreview(book.cover_url);
  }
}

function serializeForm() {
  return {
    title: document.getElementById('title').value.trim(),
    isbn: document.getElementById('isbn').value.trim(),
    quantity: document.getElementById('quantity').value.trim(),
    code: document.getElementById('code').value.trim(),
    author: document.getElementById('author').value.trim(),
    genre: document.getElementById('genre').value.trim(),
    year: document.getElementById('year').value.trim(),
    publisher: document.getElementById('publisher').value.trim(),
    description: document.getElementById('description').value.trim(),
  };
}

function updateISBNFeedback(input, result) {
  const feedback = document.getElementById('isbn-feedback');
  if (!feedback) return;

  feedback.innerHTML = '';
  if (!input.value.trim()) {
    feedback.className = 'isbn-feedback';
    return;
  }

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', `isbn-feedback__icon ${result.valid ? 'valid' : 'invalid'}`);
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  icon.innerHTML = result.valid
    ? '<path d="M20 6L9 17l-5-5"></path>'
    : '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>';

  const text = document.createElement('span');
  text.className = `isbn-feedback__text ${result.valid ? 'valid' : 'invalid'}`;
  text.textContent = result.valid ? `ISBN válido (${result.type})` : result.error;

  feedback.appendChild(icon);
  feedback.appendChild(text);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) handleFile(file);
}

function handleFile(file) {
  const validation = validateFile(file);
  if (!validation.valid) {
    showToast(validation.error, 'error');
    return;
  }

  coverFile = file;
  showCoverPreview(URL.createObjectURL(file));
}

function showCoverPreview(url) {
  const dropZone = document.getElementById('drop-zone');
  const preview = document.getElementById('cover-preview');
  const previewImg = document.getElementById('cover-preview-img');
  const removeBtn = document.getElementById('remove-cover');
  const dropZoneText = dropZone.querySelector('.drop-zone__text');
  const dropZoneIcon = dropZone.querySelector('.drop-zone__icon');

  dropZone.classList.add('has-file');
  dropZoneText.style.display = 'none';
  dropZoneIcon.style.display = 'none';
  preview.style.display = 'block';
  previewImg.src = url;
  removeBtn.style.display = 'flex';
}

function removeCover() {
  coverFile = null;
  const dropZone = document.getElementById('drop-zone');
  const preview = document.getElementById('cover-preview');
  const previewImg = document.getElementById('cover-preview-img');
  const removeBtn = document.getElementById('remove-cover');
  const dropZoneText = dropZone.querySelector('.drop-zone__text');
  const dropZoneIcon = dropZone.querySelector('.drop-zone__icon');
  const fileInput = document.getElementById('cover');

  fileInput.value = '';
  dropZone.classList.remove('has-file');
  dropZoneText.style.display = '';
  dropZoneIcon.style.display = '';
  preview.style.display = 'none';
  previewImg.src = '';
  removeBtn.style.display = 'none';
}

async function handleSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = document.getElementById('submit-btn');

  if (!validateForm()) {
    console.log('[handleSubmit] Validation failed');
    return;
  }

  showLoading(true, submitBtn);

  try {
    const formData = new FormData();
    formData.append('title', document.getElementById('title').value.trim());
    formData.append('isbn', document.getElementById('isbn').value.trim());
    formData.append('quantity', document.getElementById('quantity').value.trim());
    formData.append('code', document.getElementById('code').value.trim());
    formData.append('author', document.getElementById('author').value.trim());
    formData.append('genre', document.getElementById('genre').value.trim());
    formData.append('year', document.getElementById('year').value.trim());
    formData.append('publisher', document.getElementById('publisher').value.trim());
    formData.append('description', document.getElementById('description').value.trim());

    if (coverFile) {
      formData.append('cover', coverFile);
    }

    console.log('[handleSubmit] Sending FormData:', Object.fromEntries(formData.entries()));

    let response;
    if (currentMode === 'edit') {
      response = await api.upload(`/books/${currentBookId}`, formData);
    } else {
      response = await api.upload('/books', formData);
    }

    console.log('[handleSubmit] Response:', response);

    if (response.success) {
      showToast(currentMode === 'edit' ? 'Livro atualizado com sucesso' : 'Livro cadastrado com sucesso', 'success');
      window.formDirty = false;
      setTimeout(() => window.location.href = '/pages/book-list.html', 1000);
    }
  } catch (error) {
    console.error('[handleSubmit] Error:', error);
    if (error instanceof ApiError && error.status === 400 && error.details) {
      Object.entries(error.details).forEach(([field, message]) => {
        const input = form.querySelector(`[name="${field}"]`);
        if (input) showError(input, message);
      });
      showToast('Corrija os erros no formulário', 'error');
    } else {
      showToast('Erro ao salvar: ' + error.message, 'error');
    }
  } finally {
    showLoading(false, submitBtn);
  }
}

function validateForm() {
  const form = document.getElementById('book-form');
  let valid = true;

  const title = document.getElementById('title');
  if (!title.value.trim()) {
    showError(title, 'Título é obrigatório');
    valid = false;
  } else {
    clearError(title);
  }

  const isbn = document.getElementById('isbn');
  const isbnResult = validateISBN(isbn.value);
  if (!isbnResult.valid) {
    showError(isbn, isbnResult.error);
    valid = false;
  } else {
    clearError(isbn);
  }

  const quantity = document.getElementById('quantity');
  if (!quantity.value.trim() || parseInt(quantity.value) < 1) {
    showError(quantity, 'Quantidade é obrigatória e deve ser maior que zero');
    valid = false;
  } else {
    clearError(quantity);
  }

  const code = document.getElementById('code');
  if (!code.value.trim()) {
    showError(code, 'Código interno é obrigatório');
    valid = false;
  } else {
    clearError(code);
  }

  return valid;
}

function handleCancel(e) {
  if (e) e.preventDefault();
  if (window.formDirty) {
    const { modal, backdrop } = createConfirmModal(
      'Descartar alterações?',
      'Você tem alterações não salvas. Tem certeza que deseja sair sem salvar?',
      () => {
        modal.remove();
        backdrop.remove();
        window.location.href = '/pages/book-list.html';
      }
    );
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    modal.querySelector('.btn-danger-custom').textContent = 'Descartar e sair';
    modal.querySelector('.btn-danger-custom').focus();
  } else {
    window.location.href = '/pages/book-list.html';
  }
}

function updatePageTitle(title) {
  document.getElementById('page-title').textContent = title;
  document.title = `${title} - CataBook`;
}

function showLoading(show, button = null) {
  const overlay = document.getElementById('loading-overlay');
  if (show) {
    overlay.classList.remove('d-none');
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span class="spinner spinner-sm me-2"></span>Salvando...';
    }
  } else {
    overlay.classList.add('d-none');
    if (button) {
      button.disabled = false;
      button.innerHTML = 'Salvar';
    }
  }
}

document.addEventListener('DOMContentLoaded', init);

export { init as initBookForm };