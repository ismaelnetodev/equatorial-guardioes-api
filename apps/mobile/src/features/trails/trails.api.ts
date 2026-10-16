import type { paths } from '../../services/api.types'
import { apiRequest } from '../../services/api'

export type Trails = paths['/api/v1/trails/']['get']['responses'][200]['content']['application/json']

export function listTrails(signal?: AbortSignal): Promise<Trails> {
  return apiRequest<Trails>('/trails/', { signal })
}
