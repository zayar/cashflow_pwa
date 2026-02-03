const TOKEN_KEY = 'pwa-invoice-token';
const NAME_KEY = 'pwa-invoice-username';

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function getToken() {
  if (!isBrowser()) return '';
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (!isBrowser()) return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (!isBrowser()) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
}

export function getUsername() {
  if (!isBrowser()) return '';
  return localStorage.getItem(NAME_KEY) || '';
}

export function setUsername(name) {
  if (!isBrowser()) return;
  localStorage.setItem(NAME_KEY, name);
}
