import type { paths } from '../../services/api.types'
import { apiRequest } from '../../services/api'

export type LearnState = paths['/api/v1/modules/{moduleId}/learn']['get']['responses'][200]['content']['application/json']
export type Training = paths['/api/v1/modules/{moduleId}/training']['get']['responses'][200]['content']['application/json']
export type QuizQuestions = paths['/api/v1/modules/{moduleId}/quiz/pre']['get']['responses'][200]['content']['application/json']
export type PreTestResult = paths['/api/v1/modules/{moduleId}/quiz/pre']['post']['responses'][200]['content']['application/json']
export type PostAnswer = paths['/api/v1/modules/{moduleId}/quiz/pos/answers']['post']['responses'][200]['content']['application/json']
export type PostResult = paths['/api/v1/modules/{moduleId}/quiz/pos/finish']['post']['responses'][200]['content']['application/json']

function modulePath(moduleId: string, suffix: string) {
  return '/modules/' + encodeURIComponent(moduleId) + suffix
}

export function getLearnState(moduleId: string, signal?: AbortSignal): Promise<LearnState> {
  return apiRequest<LearnState>(modulePath(moduleId, '/learn'), { signal })
}

export function getTraining(moduleId: string, signal?: AbortSignal): Promise<Training> {
  return apiRequest<Training>(modulePath(moduleId, '/training'), { signal })
}

export function getPreTestQuestions(moduleId: string, signal?: AbortSignal): Promise<QuizQuestions> {
  return apiRequest<QuizQuestions>(modulePath(moduleId, '/quiz/pre'), { signal })
}

export function submitPreTest(moduleId: string, answers: { questionId: string; optionId: string }[]): Promise<PreTestResult> {
  return apiRequest<PreTestResult>(modulePath(moduleId, '/quiz/pre'), {
    method: 'POST',
    body: JSON.stringify({ answers }),
  })
}

export function completeTraining(moduleId: string) {
  type Done = paths['/api/v1/modules/{moduleId}/training/complete']['post']['responses'][200]['content']['application/json']
  return apiRequest<Done>(modulePath(moduleId, '/training/complete'), { method: 'POST' })
}

export function getPostTestQuestions(moduleId: string, signal?: AbortSignal): Promise<QuizQuestions> {
  return apiRequest<QuizQuestions>(modulePath(moduleId, '/quiz/pos'), { signal })
}

export function submitPostAnswer(moduleId: string, questionId: string, optionId: string): Promise<PostAnswer> {
  return apiRequest<PostAnswer>(modulePath(moduleId, '/quiz/pos/answers'), {
    method: 'POST',
    body: JSON.stringify({ questionId, optionId }),
  })
}

export function finishPostTest(moduleId: string): Promise<PostResult> {
  return apiRequest<PostResult>(modulePath(moduleId, '/quiz/pos/finish'), { method: 'POST' })
}
