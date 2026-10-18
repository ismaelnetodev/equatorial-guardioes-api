import { getPrisma } from './prisma.js'
import { learningTransaction, releasePendingModules } from '../modules/quiz/learning-rules.service.js'

const TRAINING_QUEUE_RULE_KEYS = ['module_completion', 'training_completion'] as const

/** Releases pending training awards for every user that has them. Idempotent. */
export async function releaseAllPendingLearningAwards(now = new Date()) {
  const db = getPrisma()
  const pending = await db.learningAward.findMany({
    where: { ruleKey: { in: [...TRAINING_QUEUE_RULE_KEYS] }, grantedAt: null, points: { gt: 0 } },
    select: { userId: true },
    distinct: ['userId'],
  })
  let usersProcessed = 0
  let pointsReleased = 0
  for (const { userId } of pending) {
    const result = await learningTransaction((tx) => releasePendingModules(tx, userId, now))
    usersProcessed += 1
    pointsReleased += result.pointsReleased
  }
  return { usersProcessed, pointsReleased, usersWithPending: pending.length }
}
