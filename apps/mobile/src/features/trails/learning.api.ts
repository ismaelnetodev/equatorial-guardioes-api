import type { paths } from '../../services/api.types'
import { apiRequest } from '../../services/api'

export type LearnState = paths['/api/v1/modules/{moduleId}/learn']['get']['responses'][200]['content']['application/json']
export type Questions = paths['/api/v1/modules/{moduleId}/quiz/pre']['get']['responses'][200]['content']['application/json']
export type Training = paths['/api/v1/modules/{moduleId}/training']['get']['responses'][200]['content']['application/json']
export type PreResult = paths['/api/v1/modules/{moduleId}/quiz/pre']['post']['responses'][200]['content']['application/json']
export type PostResult = paths['/api/v1/modules/{moduleId}/quiz/pos/finish']['post']['responses'][200]['content']['application/json']
export type Feedback = paths['/api/v1/modules/{moduleId}/quiz/pos/answers']['post']['responses'][200]['content']['application/json']
const base = (id: string) => '/modules/' + encodeURIComponent(id)
export const getLearnState = (id: string, signal?: AbortSignal) => apiRequest<LearnState>(base(id) + '/learn', { signal })
export const getQuestions = (id: string, phase: 'pre' | 'pos', signal?: AbortSignal) => apiRequest<Questions>(base(id) + '/quiz/' + phase, { signal })
export const getTraining = (id: string, signal?: AbortSignal) => apiRequest<Training>(base(id) + '/training', { signal })
export const completeTraining = (id: string) => apiRequest<paths['/api/v1/modules/{moduleId}/training/complete']['post']['responses'][200]['content']['application/json']>(base(id) + '/training/complete', { method: 'POST' })
export const submitPre = (id: string, answers: { questionId: string; optionId: string }[]) => apiRequest<PreResult>(base(id) + '/quiz/pre', { method: 'POST', body: JSON.stringify({ answers }) })
export const submitPostAnswer = (id: string, attemptId: string, questionId: string, optionId: string) => apiRequest<Feedback>(base(id) + '/quiz/pos/answers', { method: 'POST', body: JSON.stringify({ attemptId, questionId, optionId }) })
export const finishPost = (id: string, attemptId: string) => apiRequest<PostResult>(base(id) + '/quiz/pos/finish', { method: 'POST', body: JSON.stringify({ attemptId }) })
export const getPreResult = (id: string, signal?: AbortSignal) => apiRequest<PreResult>(base(id) + '/quiz/pre/resultado', { signal })
export const getPostResult = (id: string, signal?: AbortSignal) => apiRequest<PostResult>(base(id) + '/quiz/pos/resultado', { signal })
