import { getToken, handleUnauthorized } from './auth';
import { getApiBaseUrl } from './uploadApi';

const buildHeaders = () => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json'
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

export const getActiveTelegramLinkCode = async () => {
  const payload = await request('/api/telegram/link-code/active');
  return payload?.activeCode || null;
};

export const generateTelegramLinkCode = async () => {
  return request('/api/telegram/link-code', {
    method: 'POST',
    body: {}
  });
};

export const getTelegramAutoReportSettings = async () => {
  return request('/api/telegram/auto-reports');
};

export const upsertTelegramAutoReportSchedule = async (payload) => {
  return request('/api/telegram/auto-reports', {
    method: 'POST',
    body: payload
  });
};

export const sendTelegramAutoReportTest = async (scheduleId) => {
  return request('/api/telegram/auto-reports/test', {
    method: 'POST',
    body: { id: scheduleId }
  });
};

export const deleteTelegramAutoReportSchedule = async (scheduleId) => {
  return request('/api/telegram/auto-reports/delete', {
    method: 'POST',
    body: { id: scheduleId }
  });
};
