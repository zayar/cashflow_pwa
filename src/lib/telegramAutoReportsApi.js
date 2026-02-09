import { getToken } from './auth';
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
  const { data, text } = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data?.error || text || 'Request failed');
  }
  return data;
};

export const getTelegramAutoReports = async () => request('/api/telegram/auto-reports');

export const upsertTelegramAutoReportSchedule = async (payload) =>
  request('/api/telegram/auto-reports', { method: 'POST', body: payload });

export const deleteTelegramAutoReportSchedule = async (id) =>
  request('/api/telegram/auto-reports/delete', { method: 'POST', body: { id } });

export const sendTelegramAutoReportTest = async (id) =>
  request('/api/telegram/auto-reports/test', { method: 'POST', body: { id } });

