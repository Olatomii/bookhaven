type Data = Record<string, unknown>;
import { localRequest } from './local-api';

async function request(method: string, path: string, body?: Data) {
  if (import.meta.env.VITE_DEMO === 'true') return localRequest(method, path, body);
  const url = new URL(path, window.location.origin);
  if (method === 'GET' && body) {
    for (const [key, value] of Object.entries(body)) {
      if (value != null) url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body && method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
    body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return { data };
}

export const api = {
  get: (path: string, query?: Data) => request('GET', path, query),
  post: (path: string, body?: Data) => request('POST', path, body),
  put: (path: string, body?: Data) => request('PUT', path, body),
  delete: (path: string) => request('DELETE', path),
};

export const auth = {
  async getUser() {
    if (import.meta.env.VITE_DEMO === 'true') return { name: 'Reader', email: 'Saved on this device' };
    try { return (await api.get('/api/me')).data.user as { name?: string; email?: string }; }
    catch { return null; }
  },
  async signOut() { if (import.meta.env.VITE_DEMO !== 'true') await api.post('/api/logout'); },
};
