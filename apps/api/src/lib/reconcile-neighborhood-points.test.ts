import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reconcileNeighborhoodPoints } from './reconcile-neighborhood-points.js'

vi.mock('../modules/quiz/learning-rules.service.js', () => ({
  reconcileLearningPoints: vi.fn(async () => ({ awardsChecked: 1, pointsCredited: 2 })),
}))

const db = {
  inviteAttribution: { findMany: vi.fn() },
  report: { findMany: vi.fn() },
  pointLedgerEntry: { findFirst: vi.fn(), create: vi.fn() },
  pointAccount: { upsert: vi.fn(), update: vi.fn() },
}

beforeEach(() => {
  vi.resetAllMocks()
  db.inviteAttribution.findMany.mockResolvedValue([
    { id: 'invite-1', inviterId: 'user-inviter', pointsAwarded: 50 },
  ])
  db.report.findMany.mockResolvedValue([
    { id: 'report-1', userId: 'user-report', pointsAwarded: 25 },
  ])
  db.pointLedgerEntry.findFirst.mockResolvedValue(null)
  db.pointLedgerEntry.create.mockResolvedValue({ id: 'ledger' })
  db.pointAccount.upsert.mockImplementation(async ({ where }: { where: { userId: string } }) => ({
    userId: where.userId,
    accumulated: 0,
    balance: 0,
  }))
  db.pointAccount.update.mockImplementation(async ({ where, data }: {
    where: { userId: string }
    data: { balance: { increment: number }; accumulated?: { increment: number } }
  }) => ({
    userId: where.userId,
    accumulated: data.accumulated?.increment ?? 0,
    balance: data.balance.increment,
  }))
})

describe('reconcileNeighborhoodPoints', () => {
  it('credita convites e relatos faltantes de forma idempotente', async () => {
    const result = await reconcileNeighborhoodPoints(db as never)
    expect(result).toEqual({
      learning: { awardsChecked: 1, pointsCredited: 2 },
      invitesCredited: 1,
      reportsCredited: 1,
    })
    expect(db.pointLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: 'INVITE_REWARD',
        sourceType: 'InviteAttribution',
        sourceId: 'invite-1',
        delta: 50,
      }),
    })
    expect(db.pointLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: 'REPORT_CONFIRM',
        sourceType: 'Report',
        sourceId: 'report-1',
        delta: 25,
      }),
    })
  })

  it('não duplica créditos já presentes no extrato', async () => {
    db.pointLedgerEntry.findFirst.mockResolvedValue({ id: 'existing' })
    const result = await reconcileNeighborhoodPoints(db as never)
    expect(result.invitesCredited).toBe(0)
    expect(result.reportsCredited).toBe(0)
    expect(db.pointLedgerEntry.create).not.toHaveBeenCalled()
  })
})
