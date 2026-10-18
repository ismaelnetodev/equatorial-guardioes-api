import { estimateReadingSeconds } from '../../lib/reading-time.js'
import { assertMinimumTime, learningTransaction, queueModuleAward, releasePendingModules } from '../quiz/learning-rules.service.js'
import { publishedTrailWhere, publishedModuleWhere } from '../../lib/content-visibility.js'
import { maybeAwardInviteOnModule0 } from '../../lib/invite-attribution.js'
import { getPrisma } from '../../lib/prisma.js'
import { canReport } from '../../lib/reports-unlock.js'
import { getQuizCompletionStatus } from '../quiz/quiz.service.js'

import { getModuleStatus, type ModuleStatus } from '../../lib/module-status.js'
export type { ModuleStatus } from '../../lib/module-status.js'
const readingSelect = { content: true, trainingSteps: { select: { title: true, introText: true, cards: { select: { title: true, description: true } } } } } as const
export interface ModuleProgressView { readingSeconds: number; moduleId: string; title: string; order: number; status: ModuleStatus; requiresQuiz: boolean; startedAt: string | null; completedAt: string | null }

export class ProgressError extends Error {
  constructor(public readonly code: 'MODULE_NOT_FOUND' | 'MODULE_LOCKED' | 'MODULE_NOT_STARTED' | 'MODULE_ALREADY_COMPLETED' | 'QUIZ_REQUIRED' | 'QUIZ_NOT_IMPLEMENTED', message: string) { super(message) }
}

async function loadTrailModules(userId: string, trailId: string): Promise<{ trailId: string; modules: ModuleProgressView[] }> {
  const trail = await getPrisma().trail.findUnique({ where: { id: trailId, ...publishedTrailWhere }, select: { id: true, modules: { where: publishedModuleWhere, orderBy: { order: 'asc' }, select: { id: true, title: true, order: true, requiresQuiz: true, ...readingSelect, progressRecords: { where: { userId }, select: { startedAt: true, completedAt: true } } } } } })
  if (!trail) throw new ProgressError('MODULE_NOT_FOUND', 'Trilha não encontrada.')
  let previousCompleted = true
  const modules = trail.modules.map((module) => {
    const progress = module.progressRecords[0]
    const status = getModuleStatus(progress, previousCompleted)
    previousCompleted = previousCompleted && status === 'completed'
    return { readingSeconds: estimateReadingSeconds(module), moduleId: module.id, title: module.title, order: module.order, status, requiresQuiz: module.requiresQuiz, startedAt: progress?.startedAt.toISOString() ?? null, completedAt: progress?.completedAt?.toISOString() ?? null }
  })
  return { trailId: trail.id, modules }
}

export async function getTrailProgress(userId: string, trailId: string): Promise<{ trailId: string; modules: ModuleProgressView[]; canReport: boolean }> {
  const progress = await loadTrailModules(userId, trailId)
  return { ...progress, canReport: await canReport(userId) }
}

async function getModuleState(userId: string, moduleId: string) {
  const module = await getPrisma().trailModule.findUnique({ where: { id: moduleId, ...publishedModuleWhere, trail: publishedTrailWhere }, select: { id: true, trailId: true, isActive: true, requiresQuiz: true, ...readingSelect } })
  if (!module || !module.isActive) throw new ProgressError('MODULE_NOT_FOUND', 'Módulo não encontrado.')
  const progress = await loadTrailModules(userId, module.trailId)
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

export async function completeModule(userId: string, moduleId: string): Promise<ModuleProgressView> {
  const { module, state } = await getModuleState(userId, moduleId)
  if (state.status !== 'in_progress') throw new ProgressError('MODULE_NOT_STARTED', 'Inicie o módulo antes de concluí-lo.')
  const progress = await getPrisma().moduleProgress.findUnique({ where: { userId_moduleId: { userId, moduleId } }, select: { id: true } })
  if (!progress) throw new ProgressError('MODULE_NOT_STARTED', 'Inicie o módulo antes de concluí-lo.')
  if (module.requiresQuiz) {
    const quizStatus = await getQuizCompletionStatus({ userId, moduleId })
    if (quizStatus === 'unavailable') throw new ProgressError('QUIZ_NOT_IMPLEMENTED', 'A integração com o quiz ainda não está disponível.')
    if (quizStatus !== 'approved') throw new ProgressError('QUIZ_REQUIRED', 'A aprovação no quiz é obrigatória para concluir este módulo.')
  }
  const completed = await learningTransaction(async tx => {
    const fresh = await tx.moduleProgress.findUniqueOrThrow({ where: { id: progress.id } })
    if (fresh.completedAt) throw new ProgressError('MODULE_ALREADY_COMPLETED', 'Este módulo já foi concluído.')
    const now = new Date()
    await assertMinimumTime(tx, fresh.startedAt, estimateReadingSeconds(module), now)
    const result = await tx.moduleProgress.update({ where: { id: progress.id }, data: { completedAt: now }, select: { completedAt: true } })
    await queueModuleAward(tx, userId, moduleId, module.trailId)
    await releasePendingModules(tx, userId, now)
    await maybeAwardInviteOnModule0(userId, moduleId, tx)
    return result
  })
  return { ...state, status: 'completed', completedAt: completed.completedAt?.toISOString() ?? new Date().toISOString() }
}
