import { getToken, handleUnauthorized } from './auth';

const getApiBaseUrl = () => {
  const envBase = import.meta?.env?.VITE_API_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, '');
  return '';
};

const getShareViewerOrigin = () => {
  const envOrigin = import.meta?.env?.VITE_SHARE_VIEWER_ORIGIN;
  if (envOrigin) return String(envOrigin).replace(/\/$/, '');

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin.replace(/\/$/, '')
      : '';

  // Default to the main Cashflow web app for the public invoice viewer.
  // This matches how share links work in the web product.
  if (typeof window !== 'undefined') {
    const hostname = window.location?.hostname || '';
    if (hostname === 'pwa-invoice.web.app') {
      return 'https://cashflow-483906.web.app';
    }
  }

  return origin;
};

const request = async (path, { method = 'GET', body, includeToken = true } = {}) => {
  const baseUrl = getApiBaseUrl();
  const headers = { 'Content-Type': 'application/json' };
  if (includeToken) {
    const token = getToken();
    if (token) {
      headers.token = token;
      headers.Authorization = `Bearer ${token}`;
    }
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 401) {
    handleUnauthorized();
  }
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = response.status === 401 ? 'Session expired. Please sign in again.' : payload?.error || text || 'Request failed';
    throw new Error(message);
  }
  return payload;
};

export const createInvoiceShareToken = async (invoiceId) => {
  if (!invoiceId) {
    throw new Error('Invoice ID is required');
  }
  return request(`/api/share/invoices/${encodeURIComponent(invoiceId)}`, {
    method: 'POST'
  });
};

export const buildInvoiceShareUrl = (token, { lang } = {}) => {
  if (!token) return '';
  const origin = getShareViewerOrigin();
  // Public invoice viewer lives in the main Cashflow web app.
  const normalizedLang = String(lang || '').trim().toLowerCase();
  const suffix = normalizedLang && normalizedLang !== 'en' ? `?lang=${encodeURIComponent(normalizedLang)}` : '';
  return `${origin}/#/public/invoices/${encodeURIComponent(String(token))}${suffix}`;
};
