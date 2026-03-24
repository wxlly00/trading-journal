import { useAuthStore } from '../stores/auth'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().session?.access_token
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

async function requestForm<T>(path: string, form: FormData, method = 'POST'): Promise<T> {
  const token = useAuthStore.getState().session?.access_token
  const res = await fetch(`${BASE}${path}`, {
    method,
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, form: FormData) => requestForm<T>(path, form),
}
