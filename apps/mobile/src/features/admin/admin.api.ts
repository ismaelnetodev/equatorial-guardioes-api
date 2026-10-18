import type { paths } from '../../services/api.types'
import { apiRequest } from '../../services/api'

type JsonResponse<T> = T extends { responses: { 200: { content: { 'application/json': infer R } } } } ? R : never
export type AdminTrail = JsonResponse<paths['/api/v1/admin/trails']['get']>[number]
export type TrailDetails = JsonResponse<paths['/api/v1/admin/trails/{trailId}']['get']>
export type AdminModule = TrailDetails['modules'][number]
export type ContentStatus = AdminTrail['publicationStatus']
export type Configuration = JsonResponse<paths['/api/v1/admin/points-rewards/rules']['get']>[number]
export type Change = JsonResponse<paths['/api/v1/admin/points-rewards/history']['get']>[number]
export type Category = 'rules' | 'rewards' | 'limits'
type TrailBody = paths['/api/v1/admin/trails']['post']['requestBody']['content']['application/json']
type ModuleBody = paths['/api/v1/admin/trails/{trailId}/modules']['post']['requestBody']['content']['application/json']
type ConfigurationBody = paths['/api/v1/admin/points-rewards/rules/{key}']['patch']['requestBody']['content']['application/json']
const request = <T>(path: string, method: 'POST' | 'PATCH' | 'PUT', body: unknown) => apiRequest<T>('/admin' + path, { method, body: JSON.stringify(body) })

export const listTrails = () => apiRequest<AdminTrail[]>('/admin/trails')
export const getTrail = (id: string) => apiRequest<TrailDetails>('/admin/trails/' + id)
export const saveTrail = (body: TrailBody, id?: string) => request<AdminTrail>('/trails' + (id ? '/' + id : ''), id ? 'PATCH' : 'POST', body)
export const trailStatus = (id: string, status: ContentStatus) => request<AdminTrail>('/trails/' + id + '/status', 'PATCH', { status })
export const orderTrails = (ids: string[]) => request<AdminTrail[]>('/trails/order', 'PUT', { ids })
export const saveModule = (trailId: string, body: ModuleBody, id?: string) => request<AdminModule>('/trails/' + trailId + '/modules' + (id ? '/' + id : ''), id ? 'PATCH' : 'POST', body)
export const moduleStatus = (trailId: string, id: string, status: ContentStatus) => request<AdminModule>('/trails/' + trailId + '/modules/' + id + '/status', 'PATCH', { status })
export const orderModules = (trailId: string, ids: string[]) => request<AdminModule[]>('/trails/' + trailId + '/modules/order', 'PUT', { ids })
export const listConfigurations = (category: Category) => apiRequest<Configuration[]>('/admin/points-rewards/' + category)
export const saveConfiguration = (category: Category, key: string, body: ConfigurationBody) => request<Configuration>('/points-rewards/' + category + '/' + encodeURIComponent(key), 'PATCH', body)
export const history = (offset: number, kind: string, key: string) => apiRequest<Change[]>('/admin/points-rewards/history?' + new URLSearchParams({ offset: String(offset), limit: '20', ...(kind ? { kind } : {}), ...(key.trim() ? { key: key.trim() } : {}) }))
export const changePassword = (body: paths['/api/v1/admin/password']['patch']['requestBody']['content']['application/json']) => request<{ message: string }>('/password', 'PATCH', body)

export type AdminReport = JsonResponse<paths['/api/v1/admin/relatos']['get']>[number]
export type ReportStatusCode = AdminReport['status']['code']
export type ReportUrgencyCode = AdminReport['urgency']['code']
type ReportStatusBody = paths['/api/v1/admin/relatos/{reportId}/status']['patch']['requestBody']['content']['application/json']

export const listReports = (status?: ReportStatusCode) => apiRequest<AdminReport[]>('/admin/relatos' + (status ? '?' + new URLSearchParams({ status }).toString() : ''))
export const reportStatus = (id: string, body: ReportStatusBody) => request<AdminReport>('/relatos/' + id + '/status', 'PATCH', body)

type EmergencyBody = paths['/api/v1/admin/relatos/{reportId}/emergency']['patch']['requestBody']['content']['application/json']
type EmergencyDecision = JsonResponse<paths['/api/v1/admin/relatos/{reportId}/emergency']['patch']>
export const reportEmergency = (id: string, body: EmergencyBody) => request<EmergencyDecision>('/relatos/' + id + '/emergency', 'PATCH', body)
