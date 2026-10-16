import type { paths } from '../../services/api.types'
import { apiRequest } from '../../services/api'
import { setAccessToken } from '../../services/session'

type LoginOperation = paths['/api/v1/entrar']['post']
type LoginBody = LoginOperation['requestBody']['content']['application/json']
type LoginResponse = LoginOperation['responses'][200]['content']['application/json']

export async function login(credentials: LoginBody): Promise<LoginResponse> {
  const response = await apiRequest<LoginResponse>('/entrar', { method: 'POST', body: JSON.stringify(credentials) })
  if (!response.accessToken) throw new Error('A API não retornou uma sessão. Tente novamente.')
  await setAccessToken(response.accessToken)
  return response
}

type Registration = paths['/api/v1/cadastrar']['post']
export async function register(credentials: Registration['requestBody']['content']['application/json']) {
  return apiRequest<Registration['responses'][201]['content']['application/json']>('/cadastrar', { method: 'POST', body: JSON.stringify(credentials) })
}

export type CurrentUser = paths['/api/v1/me']['get']['responses'][200]['content']['application/json']
export function getCurrentUser(signal?: AbortSignal): Promise<CurrentUser> {
  return apiRequest<CurrentUser>('/me', { signal })
}
