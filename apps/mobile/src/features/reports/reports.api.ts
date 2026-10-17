import type { paths } from '../../services/api.types'
import { apiRequest } from '../../services/api'

export type ReportsList = paths['/api/v1/relatos/']['get']['responses'][200]['content']['application/json']
export type CreateReportBody = paths['/api/v1/relatos/']['post']['requestBody']['content']['application/json']
export type ReportDetail = paths['/api/v1/relatos/']['post']['responses'][201]['content']['application/json']

export function listReports(signal?: AbortSignal): Promise<ReportsList> {
  return apiRequest<ReportsList>('/relatos/', { signal })
}

export function createReport(body: CreateReportBody): Promise<ReportDetail> {
  return apiRequest<ReportDetail>('/relatos/', { method: 'POST', body: JSON.stringify(body) })
}
