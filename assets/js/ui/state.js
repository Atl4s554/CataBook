// State management module for book list
function createBookListState() {
  let state = {
    page: 1,
    limit: 30,
    q: '',
    sort: 'created_at:desc',
    hasCover: null,
    totalPages: 1,
    totalItems: 0,
  };

  return {
    getState() {
      return { ...state };
    },

    get(key) {
      return state[key];
    },

    set(key, value) {
      if (key in state) {
        state[key] = value;
      }
    },

    update(updates) {
      state = { ...state, ...updates };
    },

    reset() {
      state = {
        page: 1,
        limit: 30,
        q: '',
        sort: 'created_at:desc',
        hasCover: null,
        totalPages: 1,
        totalItems: 0,
      };
    },

    // Pagination helpers
    nextPage() {
      if (state.page < state.totalPages) {
        state.page++;
        return true;
      }
      return false;
    },

    prevPage() {
      if (state.page > 1) {
        state.page--;
        return true;
      }
      return false;
    },

    goToPage(page) {
      if (page >= 1 && page <= state.totalPages) {
        state.page = page;
        return true;
      }
      return false;
    },
  };
}

export { createBookListState };