import type { paths } from '../../services/api.types'
import { apiRequest } from '../../services/api'

type Response = paths['/api/v1/neighborhoods/']['get']['responses'][200]['content']['application/json']
export type Neighborhood = Response['neighborhoods'][number]
export function getNeighborhoods() {
  return apiRequest<Response>('/neighborhoods/?municipalityCode=2111300')
}
