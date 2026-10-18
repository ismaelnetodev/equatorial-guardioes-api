import { Prisma } from '../../generated/prisma/client.js'
import { arePointsDailyLimitsEnabled } from '../../lib/points-limits.js'
import { getPrisma } from '../../lib/prisma.js'
import { creditPoints } from '../../lib/points-ledger.js'

const TRAINING_QUEUE_RULE_KEYS = ['module_completion', 'training_completion'] as const

function ledgerReasonForLearningRule(ruleKey: string): 'QUIZ_TRAINING' | 'QUIZ_POST' {
  return ruleKey === 'module_completion' || ruleKey === 'training_completion' ? 'QUIZ_TRAINING' : 'QUIZ_POST'
}

export async function creditGrantedLearningAward(tx: Prisma.TransactionClient, award: {
  userId: string; ruleKey: string; sourceId: string; points: number; grantedAt: Date | null
}) {
  if (!award.grantedAt || award.points <= 0) return 0
  const sourceId = JSON.stringify([award.userId, award.ruleKey, award.sourceId])
  const reason = ledgerReasonForLearningRule(award.ruleKey)
  // A consulta evita provocar uma violação de unicidade dentro da transação.
  const existing = await tx.pointLedgerEntry.findFirst({ where: { reason, sourceType: 'LearningAward', sourceId } })
  if (existing) {
    if (existing.userId !== award.userId || existing.delta !== award.points) throw new Error('Crédito de aprendizagem divergente no extrato.')
    return 0
  }
  await creditPoints({ userId: award.userId, amount: award.points, reason, sourceType: 'LearningAward', sourceId }, tx)
  return award.points
}

export async function reconcileLearningPoints(tx: Prisma.TransactionClient) {
  const awards = await tx.learningAward.findMany({ where: { grantedAt: { not: null }, points: { gt: 0 } }, orderBy: { id: 'asc' } })
  // Migrações antigas podem ter creditado QuizAttempt/ModuleProgressTraining.
  // Não somar novamente esses valores sem conciliar suas origens.
  const legacy = await tx.pointLedgerEntry.findFirst({ where: {
    userId: { in: [...new Set(awards.map(award => award.userId))] },
    reason: { in: ['QUIZ_PRE', 'QUIZ_TRAINING', 'QUIZ_POST'] }, sourceType: { not: 'LearningAward' },
  } })
  if (legacy) throw new Error('Há créditos legados de aprendizagem. Concilie suas origens antes de executar a reconciliação automática.')
  let pointsCredited = 0
  for (const award of awards) pointsCredited += await creditGrantedLearningAward(tx, award)
  return { awardsChecked: awards.length, pointsCredited }
}

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
  await creditGrantedLearningAward(tx, { ...input, points: rule.value!, grantedAt: now })
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

export async function queueTrainingAward(tx: Prisma.TransactionClient, userId: string, moduleId: string, trailId: string) {
  const rule = await configuration(tx, 'training_completion', 'RULE')
  const existing = await tx.learningAward.findUnique({
    where: { userId_ruleKey_sourceId: { userId, ruleKey: 'training_completion', sourceId: moduleId } },
    select: { id: true, points: true },
  })
  if (existing) return existing.points
  const points = rule.isActive ? rule.value! : 0
  await tx.learningAward.create({
    data: { userId, moduleId, trailId, ruleKey: 'training_completion', sourceId: moduleId, points },
  })
  return points
}

export async function trainingPendingPoints(tx: Prisma.TransactionClient, userId: string) {
  const pending = await tx.learningAward.findMany({
    where: { userId, ruleKey: { in: [...TRAINING_QUEUE_RULE_KEYS] }, grantedAt: null, points: { gt: 0 } },
    select: { points: true },
  })
  return pending.reduce((sum, row) => sum + row.points, 0)
}

export async function releasePendingModules(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const moduleRule = await configuration(tx, 'module_completion', 'RULE')
  const trainingRule = await configuration(tx, 'training_completion', 'RULE')
  const modulesLimit = await configuration(tx, 'training_modules_daily', 'LIMIT')
  const pointsLimit = await configuration(tx, 'training_points_daily', 'LIMIT')
  const limitsEnabled = arePointsDailyLimitsEnabled()
  const modulesLimitActive = limitsEnabled && modulesLimit.isActive
  const pointsLimitActive = limitsEnabled && pointsLimit.isActive
  const pending = await tx.learningAward.findMany({
    where: { userId, ruleKey: { in: [...TRAINING_QUEUE_RULE_KEYS] }, grantedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  if (!pending.length) return { pointsReleased: 0 }
  const today = learningDayStart(now).getTime()
  const firstDay = Math.min(...pending.map(award => learningDayStart(award.createdAt).getTime()))
  const granted = await tx.learningAward.findMany({
    where: {
      userId,
      ruleKey: { in: [...TRAINING_QUEUE_RULE_KEYS] },
      points: { gt: 0 },
      grantedAt: { gte: new Date(firstDay), lt: new Date(today + 86400000) },
    },
  })
  const buckets = new Map<number, { count: number; points: number }>()
  for (const award of granted) {
    const day = learningDayStart(award.grantedAt!).getTime()
    const bucket = buckets.get(day) ?? { count: 0, points: 0 }
    if (award.ruleKey === 'module_completion') bucket.count++
    bucket.points += award.points
    buckets.set(day, bucket)
  }
  let pointsReleased = 0
  for (const award of pending) {
    const ruleActive = award.ruleKey === 'module_completion' ? moduleRule.isActive : trainingRule.isActive
    if (!ruleActive) continue
    // Limite de módulos zerado só bloqueia module_completion; pontos acima do teto diário
    // ficam adiados (grantedAt null) em vez de descartados.
    if (
      award.ruleKey === 'module_completion' &&
      award.points > 0 &&
      modulesLimitActive &&
      modulesLimit.value! < 1
    ) {
      continue
    }
    // Reconcilia dias já vencidos: voltar ao aplicativo no dia 4 não perde as
    // liberações dos dias 2 e 3. Não altera concessões que já foram registradas.
    for (let day = learningDayStart(award.createdAt).getTime(); day <= today; day += 86400000) {
      const bucket = buckets.get(day) ?? { count: 0, points: 0 }
      const modulesBlocked =
        award.ruleKey === 'module_completion' &&
        award.points > 0 &&
        modulesLimitActive &&
        bucket.count >= modulesLimit.value!
      const pointsBlocked =
        award.points > 0 && pointsLimitActive && bucket.points + award.points > pointsLimit.value!
      if (modulesBlocked || pointsBlocked) continue
      const grantedAt = day === today ? now : new Date(Math.max(day, award.createdAt.getTime()))
      await tx.learningAward.update({ where: { id: award.id }, data: { grantedAt } })
      await creditGrantedLearningAward(tx, { ...award, grantedAt })
      if (award.ruleKey === 'module_completion' && award.points > 0) bucket.count++
      bucket.points += award.points
      buckets.set(day, bucket)
      pointsReleased += award.points
      break
    }
  }
  return { pointsReleased }
}

/** Início do dia de aprendizagem em America/Sao_Paulo (UTC-3, sem horário de verão). */
export function learningDayStart(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')!.value)
  const month = Number(parts.find((part) => part.type === 'month')!.value)
  const day = Number(parts.find((part) => part.type === 'day')!.value)
  // Meia-noite em São Paulo = 03:00 UTC.
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0))
}

export async function claimLearningAwards(userId: string) {
  return learningTransaction(async (tx) => {
    const { pointsReleased } = await releasePendingModules(tx, userId, new Date())
    const pendingPoints = await trainingPendingPoints(tx, userId)
    return { pointsReleased, pendingPoints }
  })
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
