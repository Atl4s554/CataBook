export function createConfirmModal(title, message, onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'modal-custom';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'modal-title');
  modal.innerHTML = `
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

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop-custom';
  backdrop.setAttribute('data-dismiss', 'modal');

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      modal.remove();
      backdrop.remove();
    }
  });

  modal.querySelectorAll('[data-dismiss="modal"]').forEach(el => {
    if (el !== backdrop) {
      el.addEventListener('click', () => {
        modal.remove();
        backdrop.remove();
      });
    }
  });

  modal.querySelector('.btn-danger-custom').addEventListener('click', () => {
    onConfirm();
  });

  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      modal.remove();
      backdrop.remove();
      document.removeEventListener('keydown', escHandler);
    }
  });

  return { modal, backdrop };
}