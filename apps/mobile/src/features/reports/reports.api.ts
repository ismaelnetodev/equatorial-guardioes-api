import type { paths } from '../../services/api.types'
import { apiRequest } from '../../services/api'

export type ReportsList = paths['/api/v1/relatos/']['get']['responses'][200]['content']['application/json']
export type CreateReportBody = paths['/api/v1/relatos/']['post']['requestBody']['content']['application/json']
export type CreatedReport = paths['/api/v1/relatos/']['post']['responses'][201]['content']['application/json']
export type ReportDetail = paths['/api/v1/relatos/{reportId}']['get']['responses'][200]['content']['application/json']

export function listReports(signal?: AbortSignal): Promise<ReportsList> {
  return apiRequest<ReportsList>('/relatos/', { signal })
}

export function getReport(id: string, signal?: AbortSignal): Promise<ReportDetail> {
  return apiRequest<ReportDetail>('/relatos/' + encodeURIComponent(id), { signal })
}

export type PendingImpact = paths['/api/v1/relatos/impacto']['get']['responses'][200]['content']['application/json']
export function getPendingImpact(signal?: AbortSignal): Promise<PendingImpact | null> {
  return apiRequest<PendingImpact | null>('/relatos/impacto', { signal })
}

export type ImpactSeen = paths['/api/v1/relatos/{reportId}/impacto/visto']['post']['responses'][200]['content']['application/json']
export function markImpactSeen(id: string): Promise<ImpactSeen> {
  return apiRequest<ImpactSeen>('/relatos/' + encodeURIComponent(id) + '/impacto/visto', { method: 'POST' })
}

export function createReport(body: CreateReportBody): Promise<CreatedReport> {
  return apiRequest<CreatedReport>('/relatos/', { method: 'POST', body: JSON.stringify(body) })
}
