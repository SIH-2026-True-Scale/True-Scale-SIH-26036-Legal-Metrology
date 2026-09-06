import { supabase } from './supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
    ...(options.headers ?? {}),
  }
  const res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res.json()
}

export const api = {
  logLoginAttempt: (email: string, success: boolean, reason?: string) =>
    request('/auth/log-login-attempt', {
      method: 'POST',
      body: JSON.stringify({ email, success, reason }),
    }),

  whoami: () => request('/auth/me'),

  submitApplication: (payload: import('../types').ApplicationCreate) =>
    request<import('../types').Application>('/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listMyApplications: () =>
    request<import('../types').Application[]>('/applications/me'),

  getCertificate: (applicationId: string) =>
    request<import('../types').Certificate>(`/applications/${applicationId}/certificate`),
}