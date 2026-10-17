import type { paths } from '../../services/api.types'
import { apiRequest } from '../../services/api'

export type Trails = paths['/api/v1/trails/']['get']['responses'][200]['content']['application/json']

export function listTrails(signal?: AbortSignal): Promise<Trails> {
  return apiRequest<Trails>('/trails/', { signal })
}

export type TrailDetails = paths['/api/v1/trails/{trailId}']['get']['responses'][200]['content']['application/json']
export type TrailModule = TrailDetails['modules'][number]

export function getTrail(id: string, signal?: AbortSignal): Promise<TrailDetails> {
  return apiRequest<TrailDetails>('/trails/' + encodeURIComponent(id), { signal })
}

export function startModule(id: string) {
  type Started = paths['/api/v1/progress/modules/{moduleId}/start']['post']['responses'][200]['content']['application/json']
  return apiRequest<Started>('/progress/modules/' + encodeURIComponent(id) + '/start', { method: 'POST' })
}

export type TrailProgress = paths['/api/v1/progress/trails/{trailId}']['get']['responses'][200]['content']['application/json']
export function getTrailProgress(id: string, signal?: AbortSignal): Promise<TrailProgress> {
  return apiRequest<TrailProgress>('/progress/trails/' + encodeURIComponent(id), { signal })
}

export function completeModule(id: string) {
  type Completed = paths['/api/v1/progress/modules/{moduleId}/complete']['post']['responses'][200]['content']['application/json']
  return apiRequest<Completed>('/progress/modules/' + encodeURIComponent(id) + '/complete', { method: 'POST' })
}
