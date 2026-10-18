import 'dotenv/config'
import { Prisma } from '../generated/prisma/client.js'
import { getPrisma } from '../lib/prisma.js'
import { learningTransaction, queueTrainingAward, releasePendingModules } from '../modules/quiz/learning-rules.service.js'

/**
 * Idempotent: for each ModuleProgress with trainingCompletedAt and no
 * training_completion LearningAward, queue the award and try to release it.
 */
async function backfill() {
  const db = getPrisma()
  const rule = await db.programConfiguration.findUnique({ where: { key: 'training_completion' } })
  if (!rule || rule.kind !== 'RULE') {
    console.log(JSON.stringify({ skipped: true, reason: 'training_completion missing' }))
    return
  }

  const progresses = await db.moduleProgress.findMany({
    where: { trainingCompletedAt: { not: null } },
    select: {
      id: true,
      userId: true,
      moduleId: true,
      trainingPointsAwarded: true,
    },
    orderBy: { id: 'asc' },
  })

  let queued = 0
  let alreadyHad = 0
  let released = 0
  let skippedOrphans = 0
  for (const progress of progresses) {
    const [user, trailModule] = await Promise.all([
      db.user.findUnique({ where: { id: progress.userId }, select: { id: true } }),
      db.trailModule.findUnique({ where: { id: progress.moduleId }, select: { id: true, trailId: true } }),
    ])
    const trail = trailModule
      ? await db.trail.findUnique({ where: { id: trailModule.trailId }, select: { id: true } })
      : null
    if (!user || !trailModule || !trail) {
      skippedOrphans += 1
      console.warn(`orphan training progress skipped id=${progress.id} missingUser=${user ? '' : progress.userId} missingModule=${trailModule ? '' : progress.moduleId} missingTrail=${trail ? '' : trailModule?.trailId ?? 'unknown'}`)
      continue
    }
    const existing = await db.learningAward.findUnique({
      where: {
        userId_ruleKey_sourceId: {
          userId: progress.userId,
          ruleKey: 'training_completion',
          sourceId: progress.moduleId,
        },
      },
      select: { id: true, grantedAt: true, points: true },
    })
    if (existing) {
      alreadyHad += 1
      continue
    }

    const result = await learningTransaction(async (tx) => {
      const points = await queueTrainingAward(tx, progress.userId, progress.moduleId, trailModule.trailId)
      const rulePoints = rule.isActive ? (rule.value ?? 0) : 0
      if (progress.trainingPointsAwarded !== rulePoints) {
        await tx.moduleProgress.update({
          where: { id: progress.id },
          data: { trainingPointsAwarded: rulePoints },
        })
      }
      const { pointsReleased } = await releasePendingModules(tx, progress.userId, new Date())
      return { points, pointsReleased }
    })
    queued += 1
    released += result.pointsReleased > 0 ? 1 : 0
  }

  console.log(JSON.stringify({
    progresses: progresses.length,
    queued,
    alreadyHad,
    released,
    skippedOrphans,
    ruleValue: rule.value,
    ruleActive: rule.isActive,
  }))
}

try {
  for (let attempt = 0; ; attempt++) {
    try {
      await backfill()
      break
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2034' ||
        attempt >= 2
      ) {
        throw error
      }
    }
  }
} finally {
  await getPrisma().$disconnect()
}
