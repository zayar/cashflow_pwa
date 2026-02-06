import { getToken } from './auth';

const DEFAULT_PROD_URI = '/query';
const DEFAULT_DEV_URI = 'http://localhost:4000/query';

const getGraphqlEndpoint = () => {
  const envUri = import.meta?.env?.VITE_GRAPHQL_ENDPOINT;
  if (envUri) {
    return envUri;
  }
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  return isLocalhost ? DEFAULT_DEV_URI : DEFAULT_PROD_URI;
};

export const getApiBaseUrl = () => {
  const envBase = import.meta?.env?.VITE_API_BASE_URL;
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }
  const graphqlUri = getGraphqlEndpoint();
  if (graphqlUri.startsWith('http')) {
    return graphqlUri.replace(/\/query$/, '');
  }
  return '';
};

export const extractStorageObjectKey = (maybeUrlOrKey) => {
  if (!maybeUrlOrKey) return '';
  const value = String(maybeUrlOrKey).trim();
  if (!value) return '';
  if (!value.includes('://') && !value.startsWith('/') && value.includes('/')) return value;
  if (/^gs:\/\//i.test(value)) {
    const noScheme = value.replace(/^gs:\/\//i, '');
    const slash = noScheme.indexOf('/');
    if (slash > 0 && slash < noScheme.length - 1) return noScheme.slice(slash + 1);
    return '';
  }
  try {
    const u = new URL(value, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const qpKey = u.searchParams.get('key') || u.searchParams.get('objectKey') || '';
    if (qpKey) return qpKey;

    const host = (u.hostname || '').toLowerCase();
    const pathname = u.pathname || '';

    if (host.includes('firebasestorage.googleapis.com')) {
      const m = pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)$/);
      if (m && m[1]) {
        try {
          return decodeURIComponent(m[1]);
        } catch {
          return m[1];
        }
      }
    }

    if (host === 'storage.googleapis.com') {
      const m = pathname.match(/\/download\/storage\/v1\/b\/[^/]+\/o\/(.+)$/);
      if (m && m[1]) {
        try {
          return decodeURIComponent(m[1]);
        } catch {
          return m[1];
        }
      }
    }

    if (host === 'storage.googleapis.com' || host === 'storage.cloud.google.com') {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return parts.slice(1).join('/');
      }
    }
    if (host.endsWith('.storage.googleapis.com')) {
      const key = pathname.replace(/^\/+/, '');
      if (key) return key;
    }

    const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/i;
    const matchIndex = pathname.search(uuidRegex);
    if (matchIndex !== -1) {
      const potentialKey = pathname.slice(matchIndex);
      if (potentialKey.includes('/')) {
        return potentialKey;
      }
    }

    return '';
  } catch {
    return '';
  }
};

export const resolveStorageAccessUrl = (maybeUrlOrKey) => {
  if (!maybeUrlOrKey) return '';
  const value = String(maybeUrlOrKey).trim();
  if (!value) return '';

  const buildProxyUrl = (objectKey) => {
    let baseUrl = getApiBaseUrl();
    if (!baseUrl && typeof window !== 'undefined' && window.location?.origin) {
      baseUrl = window.location.origin.replace(/\/$/, '');
    }
    return `${baseUrl}/api/uploads/object?key=${encodeURIComponent(objectKey)}`;
  };

  if (/^\/api\/uploads\/object\?key=/i.test(value)) return value;

  const objectKey = extractStorageObjectKey(value);
  if (objectKey) {
    return buildProxyUrl(objectKey);
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return buildProxyUrl(value);
};

const buildHeaders = () => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.token = token;
  }
  return headers;
};

const parseJsonResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (contentType.includes('application/json')) {
    try {
      return { data: JSON.parse(text), text };
    } catch (error) {
      return { data: null, text };
    }
  }
  try {
    return { data: JSON.parse(text), text };
  } catch (error) {
    return { data: null, text };
  }
};

export const signUpload = async ({ file, context }) => {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/uploads/sign`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      context
    })
  });
  const { data: payload, text } = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(
      payload?.error ||
        text ||
        'Failed to sign upload. Check /api rewrite or VITE_API_BASE_URL.'
    );
  }
  if (!payload?.data?.uploadUrl) {
    throw new Error(
      'Unexpected response from upload API. Check /api rewrite or VITE_API_BASE_URL.'
    );
  }
  return payload.data;
};

export const uploadToSignedUrl = async ({ signed, file }) => {
  const headers = {
    ...(signed?.headers || {})
  };
  if (!headers['Content-Type']) {
    headers['Content-Type'] = file.type;
  }
  const response = await fetch(signed.uploadUrl, {
    method: signed.method || 'PUT',
    headers,
    body: file
  });
  if (!response.ok) {
    throw new Error('Failed to upload file');
  }
};

export const completeUpload = async ({ objectKey, mimeType, context }) => {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/uploads/complete`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      objectKey,
      mimeType,
      context
    })
  });
  const { data: payload, text } = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(
      payload?.error ||
        text ||
        'Failed to complete upload. Check /api rewrite or VITE_API_BASE_URL.'
    );
  }
  if (!payload?.data) {
    throw new Error(
      'Unexpected response from upload API. Check /api rewrite or VITE_API_BASE_URL.'
    );
  }
  return payload.data;
};
