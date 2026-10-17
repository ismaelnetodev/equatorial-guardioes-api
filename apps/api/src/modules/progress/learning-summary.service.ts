import { getPrisma } from '../../lib/prisma.js'
import { learningDayStart } from '../quiz/learning-rules.service.js'

export async function getLearningSummary(userId: string) {
  const rows = await getPrisma().learningAward.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
  const settings = await getPrisma().programConfiguration.findMany({ where: { key: { in: ['module_completion', 'training_modules_daily', 'training_points_daily'] } } })
  const rule = settings.find(row => row.key === 'module_completion')
  const moduleLimit = settings.find(row => row.key === 'training_modules_daily')
  const pointsLimit = settings.find(row => row.key === 'training_points_daily')
  const pending = rows.filter(row => !row.grantedAt && row.points > 0)
  const canRelease = Boolean(rule?.isActive && moduleLimit && pointsLimit && (!moduleLimit.isActive || (moduleLimit.value ?? 0) >= 1) && pending.some(row => !pointsLimit.isActive || (pointsLimit.value ?? 0) >= row.points))
  return {
    totalPoints: rows.filter(row => row.grantedAt).reduce((sum, row) => sum + row.points, 0),
    pendingPoints: pending.reduce((sum, row) => sum + row.points, 0),
    modulePoints: rule?.isActive ? rule.value ?? 0 : 0,
    dailyModuleLimit: moduleLimit?.isActive ? moduleLimit.value : null,
    dailyPointsLimit: pointsLimit?.isActive ? pointsLimit.value : null,
    nextReleaseAt: canRelease ? new Date(learningDayStart(new Date()).getTime() + 86400000).toISOString() : null,
  }
}

export async function getLearningHistory(userId: string, offset: number, limit: number) {
  const rows = await getPrisma().learningAward.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: limit })
  const names: Record<string, string> = { module_completion: 'Conclusão de módulo', module_quiz: 'Quiz do módulo', post_test_improvement: 'Melhoria no pós-teste', final_exam: 'Prova final da trilha' }
  return rows.map(row => ({ id: row.id, ruleKey: row.ruleKey, description: names[row.ruleKey] ?? row.ruleKey, moduleId: row.moduleId, trailId: row.trailId, points: row.points, status: row.grantedAt ? 'GRANTED' as const : 'PENDING' as const, createdAt: row.createdAt.toISOString(), grantedAt: row.grantedAt?.toISOString() ?? null }))
}
