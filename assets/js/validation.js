export function validateEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export function validatePassword(password) {
  const errors = [];
  let strength = 'weak';
  const requirements = {
    minLength: false,
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
    hasSpecial: false,
  };

  if (!password) {
    errors.push('Senha é obrigatória');
    return { valid: false, strength, errors, requirements };
  }

  if (password.length < 10) {
    errors.push('Mínimo 10 caracteres');
  } else {
    requirements.minLength = true;
  }
  if (/[A-Z]/.test(password)) requirements.hasUpper = true;
  else errors.push('Pelo menos uma letra maiúscula');
  
  if (/[a-z]/.test(password)) requirements.hasLower = true;
  else errors.push('Pelo menos uma letra minúscula');
  
  if (/[0-9]/.test(password)) requirements.hasNumber = true;
  else errors.push('Pelo menos um número');
  
  if (/[^A-Za-z0-9]/.test(password)) requirements.hasSpecial = true;
  else errors.push('Pelo menos um caractere especial (!@#$%^&*...)');

  const metCount = Object.values(requirements).filter(Boolean).length;
  if (metCount <= 2) strength = 'weak';
  else if (metCount <= 4) strength = 'medium';
  else strength = 'strong';

  return {
    valid: errors.length === 0,
    strength,
    errors,
    requirements,
  };
}

export function validateFile(file, options = {}) {
  const { maxSize = 5 * 1024 * 1024, allowedTypes = ['image/jpeg', 'image/png', 'image/webp'] } = options;

  if (!file) return { valid: true };

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Tipo de arquivo não permitido. Use JPG, PNG ou WebP.' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: `Arquivo muito grande. Máximo ${formatFileSize(maxSize)}.` };
  }

  return { valid: true };
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateISBN(isbn) {
  if (!isbn) return { valid: false, type: null, clean: '', error: 'ISBN é obrigatório' };

  const clean = isbn.replace(/[-\s]/g, '');

  if (clean.length === 10) {
    const valid = validateISBN10(clean);
    return { valid, type: valid ? 'ISBN10' : null, clean, error: valid ? null : 'ISBN-10 inválido' };
  }

  if (clean.length === 13) {
    const valid = validateISBN13(clean);
    return { valid, type: valid ? 'ISBN13' : null, clean, error: valid ? null : 'ISBN-13 inválido' };
  }

  return { valid: false, type: null, clean, error: 'ISBN deve ter 10 ou 13 dígitos' };
}

function validateISBN10(isbn) {
  if (!/^\d{9}[\dX]$/i.test(isbn)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(isbn[i], 10) * (10 - i);
  }
  const checkChar = isbn[9].toUpperCase();
  const checkValue = checkChar === 'X' ? 10 : parseInt(checkChar, 10);
  sum += checkValue;

  return sum % 11 === 0;
}

function validateISBN13(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const weight = i % 2 === 0 ? 1 : 3;
    sum += parseInt(isbn[i], 10) * weight;
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return checkDigit === parseInt(isbn[12], 10);
}

export function formatISBN(isbn) {
  const clean = isbn.replace(/[-\s]/g, '');

  if (clean.length === 10) {
    return `${clean.slice(0, 1)}-${clean.slice(1, 4)}-${clean.slice(4, 9)}-${clean.slice(9)}`;
  }

  if (clean.length === 13) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 4)}-${clean.slice(4, 7)}-${clean.slice(7, 12)}-${clean.slice(12)}`;
  }

  return isbn;
}

export function showError(input, message) {
  input.classList.add('is-invalid');
  input.classList.remove('is-valid');

  let feedback = input.parentNode.querySelector('.invalid-feedback');
  if (!feedback) {
    feedback = document.createElement('div');
    feedback.className = 'invalid-feedback';
    input.parentNode.appendChild(feedback);
  }
  feedback.textContent = message;
}

export function clearError(input) {
  input.classList.remove('is-invalid', 'is-valid');
  const feedback = input.parentNode.querySelector('.invalid-feedback, .valid-feedback');
  if (feedback) feedback.remove();
}

export function setFieldValid(input, isValid) {
  if (isValid) {
    input.classList.add('is-valid');
    input.classList.remove('is-invalid');
  } else {
    input.classList.add('is-invalid');
    input.classList.remove('is-valid');
  }

  const feedback = input.parentNode.querySelector('.invalid-feedback, .valid-feedback');
  if (feedback) feedback.remove();
}