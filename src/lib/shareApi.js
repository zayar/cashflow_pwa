import { getToken, handleUnauthorized } from './auth.js';

const DEFAULT_PUBLIC_HOST = 'https://cashfloweasy.app';

const getApiBaseUrl = () => {
  const envBase = import.meta?.env?.VITE_API_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, '');
  return '';
};

const getPublicHost = () => {
  const envHost = import.meta?.env?.VITE_PUBLIC_HOST;
  if (envHost) return String(envHost).replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, '');
    if (origin && !origin.includes('localhost')) return origin;
  }
  return DEFAULT_PUBLIC_HOST;
};

const request = async (path, { method = 'GET', body, includeToken = true } = {}) => {
  const baseUrl = getApiBaseUrl();
  const headers = {
    'Content-Type': 'application/json',
    'X-Client-App': 'pwa'
  };
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

export const createShortLink = async (invoiceId, { lang } = {}) => {
  if (!invoiceId) {
    throw new Error('Invoice ID is required');
  }
  const body = { invoice_id: invoiceId };
  if (lang && lang !== 'en') body.lang = lang;
  return request('/api/share/short-link', { method: 'POST', body });
};

export const buildInvoiceShareUrl = (token, { lang } = {}) => {
  if (!token) return '';
  const host = getPublicHost();
  const normalizedLang = String(lang || '').trim().toLowerCase();
  const suffix = normalizedLang && normalizedLang !== 'en' ? `?lang=${encodeURIComponent(normalizedLang)}` : '';
  return `${host}/p/${encodeURIComponent(String(token))}${suffix}`;
};

export const buildShortShareUrl = (shortId) => {
  if (!shortId) return '';
  return `${getPublicHost()}/i/${encodeURIComponent(shortId)}`;
};
