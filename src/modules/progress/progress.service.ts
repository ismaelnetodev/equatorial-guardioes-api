import { getPrisma } from '../../lib/prisma.js'
import type { SubmitQuiz } from './progress.schemas.js'

export type ModuleStatus = 'blocked' | 'available' | 'in_progress' | 'completed'
export interface ModuleProgressView { moduleId: string; title: string; order: number; status: ModuleStatus; requiresQuiz: boolean; startedAt: string | null; completedAt: string | null }

export class ProgressError extends Error {
  constructor(public readonly code: 'UNAUTHENTICATED' | 'MODULE_NOT_FOUND' | 'MODULE_LOCKED' | 'MODULE_NOT_STARTED' | 'MODULE_ALREADY_COMPLETED' | 'QUIZ_REQUIRED' | 'INVALID_QUIZ_CONFIGURATION' | 'INVALID_QUIZ_ANSWERS', message: string) { super(message) }
}

function getStatus(progress: { startedAt: Date; completedAt: Date | null } | undefined, previousCompleted: boolean): ModuleStatus {
  if (progress?.completedAt) return 'completed'
  if (progress) return 'in_progress'
  return previousCompleted ? 'available' : 'blocked'
}

export async function getTrailProgress(userId: string, trailId: string): Promise<{ trailId: string; modules: ModuleProgressView[] }> {
  const trail = await getPrisma().trail.findUnique({ where: { id: trailId }, select: { id: true, modules: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, title: true, order: true, requiresQuiz: true, progressRecords: { where: { userId }, select: { startedAt: true, completedAt: true } } } } } })
  if (!trail) throw new ProgressError('MODULE_NOT_FOUND', 'Trilha não encontrada.')
  let previousCompleted = true
  const modules = trail.modules.map((module) => {
    const progress = module.progressRecords[0]
    const status = getStatus(progress, previousCompleted)
    previousCompleted = status === 'completed'
    return { moduleId: module.id, title: module.title, order: module.order, status, requiresQuiz: module.requiresQuiz, startedAt: progress?.startedAt.toISOString() ?? null, completedAt: progress?.completedAt?.toISOString() ?? null }
  })
  return { trailId: trail.id, modules }
}

async function getModuleState(userId: string, moduleId: string) {
  const module = await getPrisma().trailModule.findUnique({ where: { id: moduleId }, select: { id: true, trailId: true, isActive: true, requiresQuiz: true, quizMinimumScore: true } })
  if (!module || !module.isActive) throw new ProgressError('MODULE_NOT_FOUND', 'Módulo não encontrado.')
  const progress = await getTrailProgress(userId, module.trailId)
  const state = progress.modules.find((item) => item.moduleId === moduleId)
  if (!state) throw new ProgressError('MODULE_NOT_FOUND', 'Módulo não encontrado.')
  return { module, state }
}

export async function startModule(userId: string, moduleId: string): Promise<ModuleProgressView> {
  const { state } = await getModuleState(userId, moduleId)
  if (state.status === 'blocked') throw new ProgressError('MODULE_LOCKED', 'Conclua o módulo anterior para liberar este módulo.')
  if (state.status === 'completed') throw new ProgressError('MODULE_ALREADY_COMPLETED', 'Este módulo já foi concluído.')
  await getPrisma().moduleProgress.upsert({ where: { userId_moduleId: { userId, moduleId } }, create: { userId, moduleId }, update: {} })
  return { ...state, status: 'in_progress', startedAt: state.startedAt ?? new Date().toISOString() }
}

export async function submitQuiz(userId: string, moduleId: string, submission: SubmitQuiz): Promise<{ score: number; approved: boolean }> {
  const { module, state } = await getModuleState(userId, moduleId)
  if (state.status !== 'in_progress') throw new ProgressError('MODULE_NOT_STARTED', 'Inicie o módulo antes de responder o quiz.')
  if (!module.requiresQuiz || module.quizMinimumScore === null) throw new ProgressError('INVALID_QUIZ_CONFIGURATION', 'Este módulo não possui um quiz configurado.')
  const questions = await getPrisma().quizQuestion.findMany({ where: { moduleId }, orderBy: { order: 'asc' }, select: { id: true, options: { select: { id: true, isCorrect: true } } } })
  if (questions.length === 0 || module.quizMinimumScore < 0 || module.quizMinimumScore > 100) throw new ProgressError('INVALID_QUIZ_CONFIGURATION', 'O quiz do módulo está configurado incorretamente.')
  const answers = new Map(submission.answers.map((answer) => [answer.questionId, answer.optionId]))
  if (answers.size !== questions.length || questions.some((question) => !answers.has(question.id))) throw new ProgressError('INVALID_QUIZ_ANSWERS', 'Responda todas as questões do quiz uma única vez.')
  const correctAnswers = questions.filter((question) => question.options.some((option) => option.id === answers.get(question.id) && option.isCorrect)).length
  const score = Number(((correctAnswers / questions.length) * 100).toFixed(2))
  const approved = score >= module.quizMinimumScore
  const progress = await getPrisma().moduleProgress.findUnique({ where: { userId_moduleId: { userId, moduleId } }, select: { id: true } })
  if (!progress) throw new ProgressError('MODULE_NOT_STARTED', 'Inicie o módulo antes de responder o quiz.')
  await getPrisma().quizAttempt.create({ data: { progressId: progress.id, score, isApproved: approved } })
  return { score, approved }
}

export async function completeModule(userId: string, moduleId: string): Promise<ModuleProgressView> {
  const { module, state } = await getModuleState(userId, moduleId)
  if (state.status !== 'in_progress') throw new ProgressError('MODULE_NOT_STARTED', 'Inicie o módulo antes de concluí-lo.')
  const progress = await getPrisma().moduleProgress.findUnique({ where: { userId_moduleId: { userId, moduleId } }, select: { id: true, attempts: { where: { isApproved: true }, select: { id: true }, take: 1 } } })
  if (!progress) throw new ProgressError('MODULE_NOT_STARTED', 'Inicie o módulo antes de concluí-lo.')
  if (module.requiresQuiz && progress.attempts.length === 0) throw new ProgressError('QUIZ_REQUIRED', 'A aprovação no quiz é obrigatória para concluir este módulo.')
  const completed = await getPrisma().moduleProgress.update({ where: { id: progress.id }, data: { completedAt: new Date() }, select: { completedAt: true } })
  return { ...state, status: 'completed', completedAt: completed.completedAt?.toISOString() ?? new Date().toISOString() }
}
