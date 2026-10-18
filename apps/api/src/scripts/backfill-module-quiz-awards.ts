import 'dotenv/config'
import { Prisma } from '../generated/prisma/client.js'
import { getPrisma } from '../lib/prisma.js'
import { awardOnce, learningTransaction } from '../modules/quiz/learning-rules.service.js'

/**
 * Idempotent: for each approved POST attempt without a module_quiz LearningAward,
 * grant the current module_quiz rule (if active and > 0).
 */
async function backfill() {
  const db = getPrisma()
  const rule = await db.programConfiguration.findUnique({ where: { key: 'module_quiz' } })
  if (!rule || rule.kind !== 'RULE' || !rule.isActive || rule.value == null || rule.value <= 0) {
    console.log(JSON.stringify({ skipped: true, reason: 'module_quiz inactive or zero' }))
    return
  }

  const attempts = await db.quizAttempt.findMany({
    where: {
      phase: 'POST',
      isApproved: true,
      finishedAt: { not: null },
      supersededAt: null,
    },
    select: {
      id: true,
      pointsAwarded: true,
      progressId: true,
    },
    orderBy: { id: 'asc' },
  })

  let awarded = 0
  let alreadyHad = 0
  let skippedOrphans = 0
  for (const attempt of attempts) {
    const progress = await db.moduleProgress.findUnique({
      where: { id: attempt.progressId },
      select: { userId: true, moduleId: true },
    })
    if (!progress) {
      skippedOrphans += 1
      console.warn(`orphan quiz attempt skipped id=${attempt.id} missingProgress=${attempt.progressId}`)
      continue
    }
    const { userId, moduleId } = progress
    const [user, trailModule] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { id: true } }),
      db.trailModule.findUnique({ where: { id: moduleId }, select: { id: true, trailId: true } }),
    ])
    const trail = trailModule
      ? await db.trail.findUnique({ where: { id: trailModule.trailId }, select: { id: true } })
      : null
    if (!user || !trailModule || !trail) {
      skippedOrphans += 1
      console.warn(`orphan quiz attempt skipped id=${attempt.id} missingUser=${user ? '' : userId} missingModule=${trailModule ? '' : moduleId} missingTrail=${trail ? '' : trailModule?.trailId ?? 'unknown'}`)
      continue
    }
    const existing = await db.learningAward.findUnique({
      where: {
        userId_ruleKey_sourceId: {
          userId,
          ruleKey: 'module_quiz',
          sourceId: moduleId,
        },
      },
      select: { id: true },
    })
    if (existing) {
      alreadyHad += 1
      continue
    }

    const points = await learningTransaction(async (tx) => {
      const granted = await awardOnce(
        tx,
        {
          userId,
          ruleKey: 'module_quiz',
          sourceId: moduleId,
          moduleId,
          trailId: trailModule.trailId,
        },
        new Date(),
      )
      if (granted > 0 && attempt.pointsAwarded < granted) {
        await tx.quizAttempt.update({
          where: { id: attempt.id },
          data: { pointsAwarded: attempt.pointsAwarded + granted },
        })
      }
      return granted
    })
    if (points > 0) awarded += 1
  }

  console.log(JSON.stringify({ attempts: attempts.length, awarded, alreadyHad, skippedOrphans, ruleValue: rule.value }))
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
