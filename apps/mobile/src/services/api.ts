import { clearAccessToken, getAccessToken } from './session'

const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message) }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', 'Bearer ' + token)
  const response = await fetch(apiUrl + path, { ...options, headers })
  if (!response.ok) {
    if (response.status === 401) await clearAccessToken()
    const body: unknown = await response.json().catch(() => null)
    const code = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string' ? body.code : 'REQUEST_FAILED'
    const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : 'Não foi possível concluir a solicitação.'
    throw new ApiError(response.status, code, message)
  }
  return response.json() as Promise<T>
}
