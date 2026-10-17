import { beforeEach, describe, expect, it, vi } from 'vitest'
import { creditPoints, debitPoints, PointsLedgerError } from './points-ledger.js'

const db = {
  pointAccount: {
    upsert: vi.fn(),
    update: vi.fn(),
  },
  pointLedgerEntry: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
}

beforeEach(() => {
  vi.resetAllMocks()
  db.pointAccount.upsert.mockResolvedValue({ userId: 'u1', accumulated: 10, balance: 10 })
  db.pointAccount.update.mockResolvedValue({ userId: 'u1', accumulated: 15, balance: 15 })
  db.pointLedgerEntry.create.mockResolvedValue({ id: 'e1' })
  db.pointLedgerEntry.findFirst.mockResolvedValue(null)
})

describe('creditPoints', () => {
  it('aumenta acumulados e saldo', async () => {
    const result = await creditPoints(
      {
        userId: 'u1',
        amount: 5,
        reason: 'QUIZ_PRE',
        sourceType: 'QuizAttempt',
        sourceId: 'a1',
      },
      db as never,
    )
    expect(db.pointLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        delta: 5,
        affectsAccumulated: true,
        reason: 'QUIZ_PRE',
        sourceType: 'QuizAttempt',
        sourceId: 'a1',
      },
    })
    expect(db.pointAccount.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: {
        balance: { increment: 5 },
        accumulated: { increment: 5 },
      },
      select: { userId: true, accumulated: true, balance: true },
    })
    expect(result).toEqual({ userId: 'u1', accumulated: 15, balance: 15 })
  })
})

describe('debitPoints', () => {
  it('reduz apenas o saldo', async () => {
    db.pointAccount.upsert.mockResolvedValue({ userId: 'u1', accumulated: 100, balance: 80 })
    db.pointAccount.update.mockResolvedValue({ userId: 'u1', accumulated: 100, balance: 50 })

    const result = await debitPoints(
      {
        userId: 'u1',
        amount: 30,
        reason: 'REDEMPTION',
        sourceType: 'RewardRedemption',
        sourceId: 'r1',
      },
      db as never,
    )

    expect(db.pointLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        delta: -30,
        affectsAccumulated: false,
        reason: 'REDEMPTION',
        sourceType: 'RewardRedemption',
        sourceId: 'r1',
      },
    })
    expect(db.pointAccount.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { balance: { decrement: 30 } },
      select: { userId: true, accumulated: true, balance: true },
    })
    expect(result).toEqual({ userId: 'u1', accumulated: 100, balance: 50 })
  })

  it('bloqueia saldo insuficiente', async () => {
    db.pointAccount.upsert.mockResolvedValue({ userId: 'u1', accumulated: 100, balance: 10 })
    await expect(
      debitPoints(
        {
          userId: 'u1',
          amount: 30,
          reason: 'REDEMPTION',
          sourceType: 'RewardRedemption',
          sourceId: 'r1',
        },
        db as never,
      ),
    ).rejects.toBeInstanceOf(PointsLedgerError)
    expect(db.pointLedgerEntry.create).not.toHaveBeenCalled()
  })
})
