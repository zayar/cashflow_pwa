import { getToken, handleUnauthorized } from './auth.js';
import { getApiBaseUrl } from './uploadApi.js';

const buildHeaders = () => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    'X-Client-App': 'pwa'
  };
  if (token) {
    headers.token = token;
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const parseJsonResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (contentType.includes('application/json')) {
    try {
      return { data: JSON.parse(text), text };
    } catch (e) {
      return { data: null, text };
    }
  }
  try {
    return { data: JSON.parse(text), text };
  } catch (e) {
    return { data: null, text };
  }
};

const request = async (path, { method = 'GET', body } = {}) => {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: buildHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 401) {
    handleUnauthorized();
  }
  const { data, text } = await parseJsonResponse(response);
  if (!response.ok) {
    const message = response.status === 401 ? 'Session expired. Please sign in again.' : data?.error || text || 'Request failed';
    throw new Error(message);
  }
  return data;
};

export const DOCUMENT_TYPES = [
  { key: 'invoice', labelKey: 'docTypes.invoice' },
  { key: 'credit_note', labelKey: 'docTypes.creditNote' },
  { key: 'payment_receipt', labelKey: 'docTypes.paymentReceipt' },
  { key: 'bill', labelKey: 'docTypes.bill' }
];

export const safeParseConfigString = (configJson) => {
  if (!configJson) return {};
  if (typeof configJson === 'object') return configJson;
  try {
    return JSON.parse(configJson);
  } catch (e) {
    return {};
  }
};

const appendBusinessId = (qs, businessId) => {
  const v = businessId === undefined || businessId === null ? '' : String(businessId).trim();
  if (v) qs.set('business_id', v);
};

export const listTemplates = async (documentType, businessId) => {
  const qs = new URLSearchParams();
  if (documentType) qs.set('document_type', documentType);
  appendBusinessId(qs, businessId);
  const payload = await request(`/api/templates?${qs.toString()}`);
  return payload?.templates || [];
};

export const getTemplate = async (id, businessId) => {
  const qs = new URLSearchParams();
  appendBusinessId(qs, businessId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const payload = await request(`/api/templates/${id}${suffix}`);
  return payload?.template;
};

export const getDefaultTemplate = async (documentType, businessId) => {
  const qs = new URLSearchParams();
  qs.set('document_type', documentType);
  appendBusinessId(qs, businessId);
  const payload = await request(`/api/templates/default?${qs.toString()}`);
  return payload?.template || null;
};

export const createTemplate = async ({ documentType, name, isDefault, config, businessId }) => {
  const qs = new URLSearchParams();
  appendBusinessId(qs, businessId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const payload = await request(`/api/templates${suffix}`, {
    method: 'POST',
    body: {
      document_type: documentType,
      name,
      is_default: isDefault,
      config_json: config || {}
    }
  });
  return payload?.template;
};

export const updateTemplate = async ({ id, documentType, name, isDefault, config, businessId }) => {
  const qs = new URLSearchParams();
  appendBusinessId(qs, businessId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const payload = await request(`/api/templates/${id}${suffix}`, {
    method: 'PUT',
    body: {
      document_type: documentType,
      name,
      is_default: isDefault,
      config_json: config || {}
    }
  });
  return payload?.template;
};

export const setDefaultTemplate = async (id, businessId) => {
  const qs = new URLSearchParams();
  appendBusinessId(qs, businessId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const payload = await request(`/api/templates/${id}/set-default${suffix}`, {
    method: 'POST',
    body: {}
  });
  return payload?.template;
};
