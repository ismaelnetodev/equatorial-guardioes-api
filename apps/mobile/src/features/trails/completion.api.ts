import { ApiError } from '../../services/api'
import { getLearnState, getPostResult } from './learning.api'
import { getTrail, getTrailProgress, listTrails, type TrailDetails } from './trails.api'
import { refreshLearningSummary } from './progress.api'

export async function getModuleCompletion(moduleId: string, trailId?: string, signal?: AbortSignal) {
  await refreshLearningSummary(signal)
  const [catalog, selectedTrail] = await Promise.all([listTrails(signal), trailId ? getTrail(trailId, signal) : Promise.resolve(undefined)])
  let trail: TrailDetails | undefined = selectedTrail
  if (!trail) {
    const details = await Promise.all(catalog.map(item => getTrail(item.id, signal)))
    trail = details.find(item => item.modules.some(module => module.id === moduleId))
  }
  const module = trail?.modules.find(item => item.id === moduleId && item.isActive)
  if (!trail || !module) throw new ApiError(404, 'MODULE_NOT_FOUND', 'Este módulo não está disponível.')
  const progress = await getTrailProgress(trail.id, signal)
  const state = progress.modules.find(item => item.moduleId === moduleId)
  if (state?.status !== 'completed') throw new ApiError(409, 'MODULE_NOT_COMPLETED', 'Conclua o módulo antes de consultar esta tela.')
  const [learn, postResult] = await Promise.all([getLearnState(moduleId, signal), state.requiresQuiz ? getPostResult(moduleId, signal) : Promise.resolve(null)])
  // A API de relatos exige o primeiro módulo da primeira trilha publicada, não de qualquer trilha.
  const firstTrailId = catalog[0]?.id
  const reportProgress = firstTrailId === trail.id ? progress : firstTrailId ? await getTrailProgress(firstTrailId, signal) : null
  const moduleZero = reportProgress?.modules[0]
  const before = { correctCount: learn.preTest.correctCount ?? 0, totalCount: learn.preTest.totalCount ?? 0 }
  const after = { correctCount: learn.postTest.correctCount ?? 0, totalCount: learn.postTest.totalCount ?? 0 }
  return {
    trailId: trail.id,
    moduleTitle: module.title,
    firstModule: moduleZero?.moduleId === moduleId,
    reportsUnlocked: moduleZero?.status === 'completed',
    totalPoints: learn.totalPoints,
    pendingPoints: learn.moduleCompletion.pendingPoints,
    breakdown: { preTest: learn.preTest.pointsAwarded, training: learn.training.pointsAwarded, postTest: postResult?.pointsBreakdown.postTest ?? learn.postTest.pointsAwarded, moduleCompletion: learn.moduleCompletion.pointsAwarded },
    completedModules: progress.modules.filter(item => item.status === 'completed').length,
    totalModules: progress.modules.length,
    before,
    after,
  }
}
export type ModuleCompletion = Awaited<ReturnType<typeof getModuleCompletion>>
