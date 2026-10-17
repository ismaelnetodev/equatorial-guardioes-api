import type { paths } from '../../services/api.types'
import { apiRequest } from '../../services/api'

export type LearningSummary = paths['/api/v1/progress/learning']['get']['responses'][200]['content']['application/json']
export type LearningHistory = paths['/api/v1/progress/learning/history']['get']['responses'][200]['content']['application/json']
export type TrailCompletion = paths['/api/v1/trails/{trailId}/completion']['get']['responses'][200]['content']['application/json']
export type FinalQuestions = paths['/api/v1/trails/{trailId}/final-exam']['get']['responses'][200]['content']['application/json']
export type FinalResult = paths['/api/v1/trails/{trailId}/final-exam']['post']['responses'][200]['content']['application/json']
export async function refreshLearningSummary(signal?: AbortSignal): Promise<LearningSummary> {
  await apiRequest('/progress/learning-awards/claim', { method: 'POST', signal })
  return apiRequest<LearningSummary>('/progress/learning', { signal })
}
export const getLearningHistory = (offset = 0, signal?: AbortSignal) => apiRequest<LearningHistory>('/progress/learning/history?limit=20&offset=' + offset, { signal })
export const getTrailCompletion = (id: string, signal?: AbortSignal) => apiRequest<TrailCompletion>('/trails/' + encodeURIComponent(id) + '/completion', { signal })
export const getFinalQuestions = (id: string, signal?: AbortSignal) => apiRequest<FinalQuestions>('/trails/' + encodeURIComponent(id) + '/final-exam', { signal })
export const submitFinal = (id: string, answers: { questionId: string; optionId: string }[]) => apiRequest<FinalResult>('/trails/' + encodeURIComponent(id) + '/final-exam', { method: 'POST', body: JSON.stringify({ answers }) })
export const issueCertificate = (id: string) => apiRequest<NonNullable<TrailCompletion['certificate']>>('/trails/' + encodeURIComponent(id) + '/certificate', { method: 'POST' })
