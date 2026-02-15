// Local copy of shared auth utilities to avoid workspace package resolution in standalone PWA build.
const TOKEN_KEY = 'pwa-invoice-token';
const NAME_KEY = 'pwa-invoice-username';
const DEFAULT_BRANCH_KEY = 'pwa-invoice-default-branch-id';
const DEFAULT_WAREHOUSE_KEY = 'pwa-invoice-default-warehouse-id';
const DEFAULT_CURRENCY_KEY = 'pwa-invoice-default-currency-id';

const toPositiveInt = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.trunc(number);
};

const decodeJwtPayload = (token) => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64Url = parts[1] || '';
    const padded = base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4);
    const normalized = padded.replace(/-/g, '+').replace(/_/g, '/');
    const json =
      typeof atob === 'function'
        ? atob(normalized)
        : Buffer.from(normalized, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const findNumericClaim = (source, targetKeys) => {
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
      if (value && typeof value === 'object') stack.push(value);
    }
  }
  return 0;
};

const inferDefaultsFromToken = (token) => {
  const payload = decodeJwtPayload(token);
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
};

export const resolveDefaultInvoiceLocationIds = ({
  storedBranchId,
  storedWarehouseId,
  token,
  fallbackBranchId = 1,
  fallbackWarehouseId = 1
}) => {
  const branch = toPositiveInt(storedBranchId);
  const wh = toPositiveInt(storedWarehouseId);
  if (branch && wh) return { branchId: branch, warehouseId: wh };
  const tokenDefaults = inferDefaultsFromToken(token);
  return {
    branchId: branch || tokenDefaults.branchId || fallbackBranchId,
    warehouseId: wh || tokenDefaults.warehouseId || fallbackWarehouseId
  };
};

export const resolveDefaultInvoiceCurrencyId = ({
  storedCurrencyId,
  token,
  fallbackCurrencyId = 1
}) => {
  const stored = toPositiveInt(storedCurrencyId);
  if (stored) return stored;
  const tokenDefaults = inferDefaultsFromToken(token);
  return tokenDefaults.currencyId || fallbackCurrencyId;
};

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

const buildScopedKey = (baseKey, businessId) => {
  const normalizedId = toPositiveInt(businessId);
  return normalizedId ? `${baseKey}:${normalizedId}` : baseKey;
};

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

export function getDefaultInvoiceLocationIds(businessId = 0) {
  const branchKey = buildScopedKey(DEFAULT_BRANCH_KEY, businessId);
  const warehouseKey = buildScopedKey(DEFAULT_WAREHOUSE_KEY, businessId);
  const storedBranchId = readStoredDefault(branchKey);
  const storedWarehouseId = readStoredDefault(warehouseKey);
  return resolveDefaultInvoiceLocationIds({
    storedBranchId,
    storedWarehouseId,
    token: getToken(),
    fallbackBranchId: 1,
    fallbackWarehouseId: 1
  });
}

export function saveDefaultInvoiceLocationIds(branchId, warehouseId, businessId = 0) {
  const branchKey = buildScopedKey(DEFAULT_BRANCH_KEY, businessId);
  const warehouseKey = buildScopedKey(DEFAULT_WAREHOUSE_KEY, businessId);
  writeStoredDefault(branchKey, branchId);
  writeStoredDefault(warehouseKey, warehouseId);
}

export function getDefaultInvoiceCurrencyId(businessId = 0) {
  const currencyKey = buildScopedKey(DEFAULT_CURRENCY_KEY, businessId);
  const storedCurrencyId = readStoredDefault(currencyKey);
  return resolveDefaultInvoiceCurrencyId({
    storedCurrencyId,
    token: getToken(),
    fallbackCurrencyId: 1
  });
}

export function saveDefaultInvoiceCurrencyId(currencyId, businessId = 0) {
  const currencyKey = buildScopedKey(DEFAULT_CURRENCY_KEY, businessId);
  writeStoredDefault(currencyKey, currencyId);
}
