// Form state management
function createFormState() {
  let dirty = false;

  return {
    isDirty() {
      return dirty;
    },

    setDirty(value) {
      dirty = !!value;
    },

    markDirty() {
      dirty = true;
    },

    markClean() {
      dirty = false;
    },
  };
}

export { createFormState };