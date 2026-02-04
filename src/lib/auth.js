const TOKEN_KEY = 'pwa-invoice-token';
const NAME_KEY = 'pwa-invoice-username';
const DEFAULT_BRANCH_KEY = 'pwa-invoice-default-branch-id';
const DEFAULT_WAREHOUSE_KEY = 'pwa-invoice-default-warehouse-id';
const DEFAULT_CURRENCY_KEY = 'pwa-invoice-default-currency-id';

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

function toPositiveInt(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.trunc(number);
}

function decodeTokenPayload(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function findNumericClaim(source, targetKeys) {
  if (!source || typeof source !== 'object') return 0;

  const stack = [source];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;

    for (const [key, value] of Object.entries(current)) {
      const normalized = key.toLowerCase();
      if (targetKeys.includes(normalized)) {
        const matchedValue = toPositiveInt(value);
        if (matchedValue) return matchedValue;
      }

      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return 0;
}

function readStoredDefault(key) {
  if (!isBrowser()) return 0;
  return toPositiveInt(localStorage.getItem(key));
}

function writeStoredDefault(key, value) {
  if (!isBrowser()) return;
  const normalized = toPositiveInt(value);
  if (!normalized) return;
  localStorage.setItem(key, String(normalized));
}

function inferDefaultsFromToken() {
  if (!isBrowser()) return { branchId: 0, warehouseId: 0, currencyId: 0 };

  const payload = decodeTokenPayload(getToken());
  if (!payload) return { branchId: 0, warehouseId: 0, currencyId: 0 };

  const branchId = findNumericClaim(payload, [
    'branchid',
    'defaultbranchid',
    'activebranchid',
    'selectedbranchid',
    'branch_id',
    'default_branch_id'
  ]);

  const warehouseId = findNumericClaim(payload, [
    'warehouseid',
    'defaultwarehouseid',
    'activewarehouseid',
    'selectedwarehouseid',
    'warehouse_id',
    'default_warehouse_id'
  ]);

  const currencyId = findNumericClaim(payload, [
    'currencyid',
    'defaultcurrencyid',
    'basecurrencyid',
    'currency_id',
    'default_currency_id',
    'base_currency_id'
  ]);

  return { branchId, warehouseId, currencyId };
}

export function getDefaultInvoiceLocationIds() {
  const storedBranchId = readStoredDefault(DEFAULT_BRANCH_KEY);
  const storedWarehouseId = readStoredDefault(DEFAULT_WAREHOUSE_KEY);

  if (storedBranchId && storedWarehouseId) {
    return { branchId: storedBranchId, warehouseId: storedWarehouseId };
  }

  const tokenDefaults = inferDefaultsFromToken();
  const branchId = storedBranchId || tokenDefaults.branchId || 1;
  const warehouseId = storedWarehouseId || tokenDefaults.warehouseId || 1;

  return { branchId, warehouseId };
}

export function saveDefaultInvoiceLocationIds(branchId, warehouseId) {
  writeStoredDefault(DEFAULT_BRANCH_KEY, branchId);
  writeStoredDefault(DEFAULT_WAREHOUSE_KEY, warehouseId);
}

export function getDefaultInvoiceCurrencyId() {
  const storedCurrencyId = readStoredDefault(DEFAULT_CURRENCY_KEY);
  if (storedCurrencyId) return storedCurrencyId;

  const tokenDefaults = inferDefaultsFromToken();
  return tokenDefaults.currencyId || 1;
}

export function saveDefaultInvoiceCurrencyId(currencyId) {
  writeStoredDefault(DEFAULT_CURRENCY_KEY, currencyId);
}
