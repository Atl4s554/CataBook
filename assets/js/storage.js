const BOOKS_KEY = 'cata_book_books';
const COVERS_KEY = 'cata_book_covers';
const SEED_KEY = 'cata_book_seeded';

const SEED_BOOKS = [
  { id: '1', title: 'Dom Casmurro', isbn: '978-85-3590-277-8', code: 'LIV-001', author: 'Machado de Assis', genre: 'Romance', year: 1899, publisher: 'Companhia das Letras', status: 'read', description: 'Clássico da literatura brasileira narrado por Bentinho.', cover_url: null, created_at: '2024-01-15T10:30:00Z', updated_at: '2024-01-15T10:30:00Z' },
  { id: '2', title: 'O Senhor dos Anéis: A Sociedade do Anel', isbn: '978-85-3361-334-9', code: 'LIV-002', author: 'J.R.R. Tolkien', genre: 'Fantasia', year: 1954, publisher: 'HarperCollins', status: 'reading', description: 'Primeiro volume da trilogia épica.', cover_url: null, created_at: '2024-01-20T14:15:00Z', updated_at: '2024-01-20T14:15:00Z' },
  { id: '3', title: '1984', isbn: '978-85-254-3549-2', code: 'LIV-003', author: 'George Orwell', genre: 'Ficção Científica', year: 1949, publisher: 'Companhia das Letras', status: 'read', description: 'Distopia clássica sobre vigilância totalitária.', cover_url: null, created_at: '2024-02-01T09:00:00Z', updated_at: '2024-02-01T09:00:00Z' },
  { id: '4', title: 'A Revolução dos Bichos', isbn: '978-85-3591-484-9', code: 'LIV-004', author: 'George Orwell', genre: 'Fábula Política', year: 1945, publisher: 'Companhia das Letras', status: 'want_to_read', description: 'Sátira sobre revolução e corrupção.', cover_url: null, created_at: '2024-02-10T16:45:00Z', updated_at: '2024-02-10T16:45:00Z' },
  { id: '5', title: 'Cem Anos de Solidão', isbn: '978-85-3590-839-6', code: 'LIV-005', author: 'Gabriel García Márquez', genre: 'Realismo Mágico', year: 1967, publisher: 'Record', status: 'read', description: 'Obra-prima do realismo mágico latino-americano.', cover_url: null, created_at: '2024-02-15T11:20:00Z', updated_at: '2024-02-15T11:20:00Z' },
];

function seedIfNeeded() {
  if (!localStorage.getItem(SEED_KEY)) {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(SEED_BOOKS));
    localStorage.setItem(COVERS_KEY, JSON.stringify({}));
    localStorage.setItem(SEED_KEY, '1');
  }
}

seedIfNeeded();

function readBooks() {
  try {
    const raw = localStorage.getItem(BOOKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeBooks(books) {
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
}

function readCovers() {
  try {
    const raw = localStorage.getItem(COVERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCovers(covers) {
  localStorage.setItem(COVERS_KEY, JSON.stringify(covers));
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function applyFilters(books, params) {
  let result = [...books];

  if (params.q) {
    const query = params.q.toLowerCase();
    result = result.filter(b =>
      (b.title || '').toLowerCase().includes(query) ||
      (b.isbn || '').includes(query) ||
      (b.code || '').toLowerCase().includes(query) ||
      (b.description || '').toLowerCase().includes(query) ||
      (b.author || '').toLowerCase().includes(query) ||
      (b.genre || '').toLowerCase().includes(query) ||
      (b.publisher || '').toLowerCase().includes(query)
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
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (dir === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }

  return result;
}

function paginate(items, page, limit) {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  return {
    books: items.slice(start, start + limit),
    pagination: { page, limit, total, totalPages }
  };
}

export const bookRepository = {
  async list(params = {}) {
    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 30;
    const books = readBooks();
    const filtered = applyFilters(books, params);
    return paginate(filtered, page, limit);
  },

  async get(id) {
    const books = readBooks();
    return books.find(b => b.id === id) || null;
  },

  async create(data) {
    const books = readBooks();
    const now = new Date().toISOString();
    const book = {
      id: generateId(),
      title: data.title || '',
      isbn: data.isbn || '',
      code: data.code || '',
      author: data.author || '',
      genre: data.genre || '',
      year: data.year ? parseInt(data.year) : null,
      publisher: data.publisher || '',
      status: data.status || '',
      description: data.description || '',
      cover_url: null,
      created_at: now,
      updated_at: now,
    };
    books.unshift(book);
    writeBooks(books);
    return book;
  },

  async update(id, data) {
    const books = readBooks();
    const idx = books.findIndex(b => b.id === id);
    if (idx === -1) return null;
    const now = new Date().toISOString();
    const updated = {
      ...books[idx],
      ...data,
      id: books[idx].id,
      created_at: books[idx].created_at,
      updated_at: now,
    };
    books[idx] = updated;
    writeBooks(books);
    return updated;
  },

  async delete(id) {
    const books = readBooks();
    const idx = books.findIndex(b => b.id === id);
    if (idx === -1) return false;
    books.splice(idx, 1);
    writeBooks(books);
    const covers = readCovers();
    delete covers[id];
    writeCovers(covers);
    return true;
  },

  async uploadCover(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ cover_url: reader.result });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  async deleteCover(id) {
    const covers = readCovers();
    delete covers[id];
    writeCovers(covers);
    const books = readBooks();
    const idx = books.findIndex(b => b.id === id);
    if (idx !== -1) {
      books[idx].cover_url = null;
      writeBooks(books);
    }
    return true;
  },

  async setCover(id, coverUrl) {
    const books = readBooks();
    const idx = books.findIndex(b => b.id === id);
    if (idx === -1) return false;
    books[idx].cover_url = coverUrl;
    books[idx].updated_at = new Date().toISOString();
    writeBooks(books);
    return true;
  },
};

export function clearAllData() {
  localStorage.removeItem(BOOKS_KEY);
  localStorage.removeItem(COVERS_KEY);
}