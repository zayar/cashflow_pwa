import { getToken } from './auth';

const getApiBaseUrl = () => {
  const envBase = import.meta?.env?.VITE_API_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, '');
  return '';
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
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(payload?.error || text || 'Request failed');
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

export const buildInvoiceShareUrl = (token) => {
  if (!token) return '';
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin.replace(/\/$/, '')
      : '';
  return `${origin}/#/public/invoices/${encodeURIComponent(String(token))}`;
};
