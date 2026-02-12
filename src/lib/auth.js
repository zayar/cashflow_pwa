import {
  DEFAULT_BRANCH_KEY,
  DEFAULT_CURRENCY_KEY,
  DEFAULT_WAREHOUSE_KEY,
  NAME_KEY,
  TOKEN_KEY,
  resolveDefaultInvoiceCurrencyId,
  resolveDefaultInvoiceLocationIds
} from '@cashflow/shared/auth';

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

let hasHandledUnauthorized = false;

export function handleUnauthorized() {
  if (!isBrowser()) return;
  if (hasHandledUnauthorized) return;
  hasHandledUnauthorized = true;
  clearToken();
  const target = '/welcome';
  if (window.location.pathname !== target) {
    window.location.replace(target);
  } else {
    window.location.reload();
  }
}

export function getUsername() {
  if (!isBrowser()) return '';
  return localStorage.getItem(NAME_KEY) || '';
}

export function setUsername(name) {
  if (!isBrowser()) return;
  localStorage.setItem(NAME_KEY, name);
}

function readStoredDefault(key) {
  if (!isBrowser()) return 0;
  const raw = localStorage.getItem(key);
  const number = Number(raw);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.trunc(number);
}

function writeStoredDefault(key, value) {
  if (!isBrowser()) return;
  const number = Number(value);
  const normalized = Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
  if (!normalized) return;
  localStorage.setItem(key, String(normalized));
}

export function getDefaultInvoiceLocationIds() {
  const storedBranchId = readStoredDefault(DEFAULT_BRANCH_KEY);
  const storedWarehouseId = readStoredDefault(DEFAULT_WAREHOUSE_KEY);
  return resolveDefaultInvoiceLocationIds({
    storedBranchId,
    storedWarehouseId,
    token: getToken(),
    fallbackBranchId: 1,
    fallbackWarehouseId: 1
  });
}

export function saveDefaultInvoiceLocationIds(branchId, warehouseId) {
  writeStoredDefault(DEFAULT_BRANCH_KEY, branchId);
  writeStoredDefault(DEFAULT_WAREHOUSE_KEY, warehouseId);
}

export function getDefaultInvoiceCurrencyId() {
  const storedCurrencyId = readStoredDefault(DEFAULT_CURRENCY_KEY);
  return resolveDefaultInvoiceCurrencyId({
    storedCurrencyId,
    token: getToken(),
    fallbackCurrencyId: 1
  });
}

export function saveDefaultInvoiceCurrencyId(currencyId) {
  writeStoredDefault(DEFAULT_CURRENCY_KEY, currencyId);
}
