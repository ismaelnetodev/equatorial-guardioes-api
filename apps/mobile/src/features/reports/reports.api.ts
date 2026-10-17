import type { paths } from '../../services/api.types'
import { apiRequest } from '../../services/api'

export type ReportsList = paths['/api/v1/relatos/']['get']['responses'][200]['content']['application/json']
export type Reports = ReportsList
export type CreateReportBody = paths['/api/v1/relatos/']['post']['requestBody']['content']['application/json']
export type ReportDetail = paths['/api/v1/relatos/{reportId}']['get']['responses'][200]['content']['application/json']
export type PendingReportImpact = paths['/api/v1/relatos/impacto']['get']['responses'][200]['content']['application/json']
export type ReportImpact = NonNullable<PendingReportImpact>

export function getPendingReportImpact(signal?: AbortSignal): Promise<PendingReportImpact> {
  return apiRequest<PendingReportImpact>('/relatos/impacto', { signal })
}

export function markReportImpactSeen(reportId: string) {
  type Seen = paths['/api/v1/relatos/{reportId}/impacto/visto']['post']['responses'][200]['content']['application/json']
  return apiRequest<Seen>('/relatos/' + encodeURIComponent(reportId) + '/impacto/visto', { method: 'POST' })
}

export function getReport(id: string, signal?: AbortSignal): Promise<ReportDetail> {
  return apiRequest<ReportDetail>('/relatos/' + encodeURIComponent(id), { signal })
}

export function listReports(signal?: AbortSignal): Promise<ReportsList> {
  return apiRequest<ReportsList>('/relatos/', { signal })
}

export function createReport(body: CreateReportBody): Promise<ReportDetail> {
  return apiRequest<ReportDetail>('/relatos/', { method: 'POST', body: JSON.stringify(body) })
}
