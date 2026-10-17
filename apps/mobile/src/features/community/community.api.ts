import type { paths } from '../../services/api.types'
import { apiRequest } from '../../services/api'

export type Ranking = paths['/api/v1/ranking']['get']['responses'][200]['content']['application/json']
export type Profile = paths['/api/v1/perfil']['get']['responses'][200]['content']['application/json']
export type Rewards = paths['/api/v1/recompensas']['get']['responses'][200]['content']['application/json']
export type Invite = paths['/api/v1/convidar']['get']['responses'][200]['content']['application/json']

export function getRanking(signal?: AbortSignal): Promise<Ranking> {
  return apiRequest<Ranking>('/ranking', { signal })
}

export function getProfile(signal?: AbortSignal): Promise<Profile> {
  return apiRequest<Profile>('/perfil', { signal })
}

export function getRewards(signal?: AbortSignal): Promise<Rewards> {
  return apiRequest<Rewards>('/recompensas', { signal })
}

export function getInvite(signal?: AbortSignal): Promise<Invite> {
  return apiRequest<Invite>('/convidar', { signal })
}

export function redeemReward(key: string) {
  type Redeemed = paths['/api/v1/recompensas/{key}/resgatar']['post']['responses'][201]['content']['application/json']
  return apiRequest<Redeemed>('/recompensas/' + encodeURIComponent(key) + '/resgatar', { method: 'POST' })
}
