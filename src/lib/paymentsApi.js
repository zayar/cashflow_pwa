import { getToken } from './auth';

const base = '';

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { token } : {}),
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
}

export async function createSubscriptionOrder(payload) {
  return request('/api/payments/subscribe/create-order', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getSubscriptionStatus(paymentId) {
  return request(`/api/payments/status?payment_id=${encodeURIComponent(paymentId)}`, {
    method: 'GET'
  });
}
