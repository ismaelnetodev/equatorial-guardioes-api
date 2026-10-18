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
      progress: {
        select: {
          userId: true,
          moduleId: true,
          module: { select: { trailId: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
  })

  let awarded = 0
  let alreadyHad = 0
  for (const attempt of attempts) {
    const { userId, moduleId, module } = attempt.progress
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
          trailId: module.trailId,
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

  console.log(JSON.stringify({ attempts: attempts.length, awarded, alreadyHad, ruleValue: rule.value }))
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
