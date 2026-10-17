import { Prisma } from '../../generated/prisma/client.js'
import { getPrisma } from '../../lib/prisma.js'

export class LearningError extends Error {
  constructor(public readonly code: 'LEARNING_CONFIGURATION_PENDING' | 'LEARNING_CONFLICT' | 'MINIMUM_TIME_REQUIRED' | 'RETRY_NOT_AVAILABLE' | 'FINAL_EXAM_LOCKED', message: string) { super(message) }
}

export async function learningTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    return await getPrisma().$transaction(operation, { isolationLevel: 'Serializable' })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002', 'P2003', 'P2025'].includes(error.code)) {
      throw new LearningError('LEARNING_CONFLICT', 'Atualização concorrente. Consulte o estado atual e tente novamente.')
    }
    throw error
  }
}

export async function configuration(tx: Prisma.TransactionClient, key: string, kind: 'RULE' | 'LIMIT') {
  const row = await tx.programConfiguration.findUnique({ where: { key } })
  if (!row || row.kind !== kind || (row.isActive && row.value === null)) {
    throw new LearningError('LEARNING_CONFIGURATION_PENDING', 'Esta etapa está temporariamente indisponível. Tente novamente mais tarde.')
  }
  return row
}

export async function minimumCorrect(tx: Prisma.TransactionClient, total: number) {
  const rule = await configuration(tx, 'quiz_pass_score', 'LIMIT')
  // Desativar o requisito remove o corte, sem restaurar o antigo padrão de 70%.
  return rule.isActive ? Math.ceil(total * rule.value! / 100) : 0
}

export async function assertRetry(tx: Prisma.TransactionClient, previous: Date | null, now: Date) {
  if (!previous) return
  const interval = await configuration(tx, 'quiz_retry_interval', 'LIMIT')
  const remaining = Math.ceil((previous.getTime() + (interval.value ?? 0) * 1000 - now.getTime()) / 1000)
  if (interval.isActive && remaining > 0) {
    throw new LearningError('RETRY_NOT_AVAILABLE', `Aguarde ${remaining} ${remaining === 1 ? 'segundo' : 'segundos'} para tentar novamente. Você pode revisar o conteúdo enquanto isso.`)
  }
}

export async function awardOnce(tx: Prisma.TransactionClient, input: {
  userId: string; ruleKey: string; sourceId: string; moduleId?: string; trailId?: string
}, now: Date) {
  const rule = await configuration(tx, input.ruleKey, 'RULE')
  if (!rule.isActive || rule.value === 0) return 0
  const existing = await tx.learningAward.findUnique({ where: { userId_ruleKey_sourceId: { userId: input.userId, ruleKey: input.ruleKey, sourceId: input.sourceId } } })
  if (existing) return 0
  await tx.learningAward.create({ data: { ...input, points: rule.value!, grantedAt: now } })
  return rule.value!
}

export async function assertMinimumTime(tx: Prisma.TransactionClient, startedAt: Date, readingSeconds: number, now: Date) {
  const rule = await configuration(tx, 'module_minimum_time', 'LIMIT')
  if (!rule.isActive || rule.value === 0) return
  const minimumSeconds = Math.ceil(readingSeconds * rule.value! / 100)
  const remaining = Math.ceil((minimumSeconds * 1000 - Math.max(0, now.getTime() - startedAt.getTime())) / 1000)
  if (remaining > 0) {
    const time = remaining >= 60 ? `${Math.floor(remaining / 60)} min${remaining % 60 ? ` e ${remaining % 60} s` : ''}` : `${remaining} s`
    throw new LearningError('MINIMUM_TIME_REQUIRED', `Leia o conteúdo com atenção. Você poderá concluir em ${time}.`)
  }
}

export async function queueModuleAward(tx: Prisma.TransactionClient, userId: string, moduleId: string, trailId: string) {
  const rule = await configuration(tx, 'module_completion', 'RULE')
  // Registrar também zero impede concessão retroativa após reativar uma regra.
  await tx.learningAward.create({ data: { userId, moduleId, trailId, ruleKey: 'module_completion', sourceId: moduleId, points: rule.isActive ? rule.value! : 0 } })
}

export async function releasePendingModules(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const rule = await configuration(tx, 'module_completion', 'RULE')
  const modulesLimit = await configuration(tx, 'training_modules_daily', 'LIMIT')
  const pointsLimit = await configuration(tx, 'training_points_daily', 'LIMIT')
  if (!rule.isActive) return { pointsReleased: 0 }
  const local = new Date(now.getTime() - 10800000)
  const day = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3))
  const granted = await tx.learningAward.findMany({ where: { userId, ruleKey: 'module_completion', points: { gt: 0 }, grantedAt: { gte: day, lt: new Date(day.getTime() + 86400000) } } })
  let count = granted.length
  let points = granted.reduce((sum, award) => sum + award.points, 0)
  let pointsReleased = 0
  const pending = await tx.learningAward.findMany({ where: { userId, ruleKey: 'module_completion', grantedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
  for (const award of pending) {
    if (award.points > 0 && ((modulesLimit.isActive && count >= modulesLimit.value!) || (pointsLimit.isActive && points + award.points > pointsLimit.value!))) continue
    await tx.learningAward.update({ where: { id: award.id }, data: { grantedAt: now } })
    if (award.points > 0) count++
    points += award.points
    pointsReleased += award.points
  }
  return { pointsReleased }
}

export async function claimLearningAwards(userId: string) {
  return learningTransaction(tx => releasePendingModules(tx, userId, new Date()))
}

export async function moduleAwards(tx: Prisma.TransactionClient, userId: string, moduleId: string) {
  const rows = await tx.learningAward.findMany({ where: { userId, moduleId } })
  return {
    moduleCompletion: {
      pointsAwarded: rows.filter(row => row.ruleKey === 'module_completion' && row.grantedAt).reduce((sum, row) => sum + row.points, 0),
      pendingPoints: rows.filter(row => row.ruleKey === 'module_completion' && !row.grantedAt).reduce((sum, row) => sum + row.points, 0),
    },
    quizPoints: rows.filter(row => row.ruleKey !== 'module_completion' && row.grantedAt).reduce((sum, row) => sum + row.points, 0),
  }
}
