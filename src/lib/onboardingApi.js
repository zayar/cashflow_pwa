import { getToken, handleUnauthorized } from './auth.js';
import { getApiBaseUrl } from './uploadApi.js';

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
    const message =
      response.status === 401 ? 'Session expired. Please sign in again.' : data?.error || text || 'Request failed';
    throw new Error(message);
  }
  return data;
};

export const getOnboardingStatus = async () => {
  const payload = await request('/api/onboarding/status');
  return payload?.status || { step: 0, completed: false };
};

export const updateOnboardingStatus = async ({ step, completed }) => {
  const payload = await request('/api/onboarding/status', {
    method: 'POST',
    body: { step, completed }
  });
  return payload?.status || { step, completed };
};
