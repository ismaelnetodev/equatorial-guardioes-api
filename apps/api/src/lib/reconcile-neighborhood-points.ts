import { Prisma } from '../generated/prisma/client.js'
import { reconcileLearningPoints } from '../modules/quiz/learning-rules.service.js'
import { creditPoints, type PointsDb } from './points-ledger.js'
import { getPrisma } from './prisma.js'

/**
 * Idempotent backfill: learning awards, invite rewards and confirmed reports
 * that already recorded pointsAwarded but may be missing from the ledger/ranking.
 */
export async function reconcileNeighborhoodPoints(
  db: PointsDb = getPrisma(),
): Promise<{
  learning: { awardsChecked: number; pointsCredited: number }
  invitesCredited: number
  reportsCredited: number
}> {
  const learning = await reconcileLearningPoints(db as Prisma.TransactionClient)

  let invitesCredited = 0
  const invites = await db.inviteAttribution.findMany({
    where: { pointsAwarded: { gt: 0 }, module0CompletedAt: { not: null } },
    select: { id: true, inviterId: true, pointsAwarded: true },
    orderBy: { id: 'asc' },
  })
  for (const invite of invites) {
    const before = await db.pointLedgerEntry.findFirst({
      where: {
        reason: 'INVITE_REWARD',
        sourceType: 'InviteAttribution',
        sourceId: invite.id,
      },
      select: { id: true },
    })
    if (before) continue
    await creditPoints(
      {
        userId: invite.inviterId,
        amount: invite.pointsAwarded,
        reason: 'INVITE_REWARD',
        sourceType: 'InviteAttribution',
        sourceId: invite.id,
      },
      db,
    )
    invitesCredited += 1
  }

  let reportsCredited = 0
  const reports = await db.report.findMany({
    where: { status: 'RESOLVED', pointsAwarded: { gt: 0 } },
    select: { id: true, userId: true, pointsAwarded: true },
    orderBy: { id: 'asc' },
  })
  for (const report of reports) {
    const before = await db.pointLedgerEntry.findFirst({
      where: {
        reason: 'REPORT_CONFIRM',
        sourceType: 'Report',
        sourceId: report.id,
      },
      select: { id: true },
    })
    if (before) continue
    await creditPoints(
      {
        userId: report.userId,
        amount: report.pointsAwarded,
        reason: 'REPORT_CONFIRM',
        sourceType: 'Report',
        sourceId: report.id,
      },
      db,
    )
    reportsCredited += 1
  }

  return { learning, invitesCredited, reportsCredited }
}
