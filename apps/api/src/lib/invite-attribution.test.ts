import { beforeEach, describe, expect, it, vi } from 'vitest'
import { maybeAwardInviteOnModule0 } from './invite-attribution.js'

const db = {
  trail: { findFirst: vi.fn() },
  inviteAttribution: {
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  programConfiguration: { findUnique: vi.fn() },
  pointAccount: { upsert: vi.fn(), update: vi.fn() },
  pointLedgerEntry: { create: vi.fn(), findFirst: vi.fn() },
}

const module0 = '33333333-3333-4333-8333-333333333333'
const inviteeId = '11111111-1111-4111-8111-111111111111'
const inviterId = '22222222-2222-4222-8222-222222222222'
const attributionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

beforeEach(() => {
  vi.resetAllMocks()
  db.trail.findFirst.mockResolvedValue({ modules: [{ id: module0 }] })
  db.inviteAttribution.findUnique.mockResolvedValue({
    id: attributionId,
    inviterId,
    module0CompletedAt: null,
    pointsAwarded: 0,
  })
  db.inviteAttribution.count.mockResolvedValue(0)
  db.inviteAttribution.update.mockResolvedValue({})
  db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
    if (where.key === 'invite_module0_reward') return { value: 50, isActive: true }
    if (where.key === 'invite_reward_limit') return { value: 10, isActive: true }
    return null
  })
  db.pointAccount.upsert.mockResolvedValue({ userId: inviterId, accumulated: 0, balance: 0 })
  db.pointAccount.update.mockResolvedValue({ userId: inviterId, accumulated: 50, balance: 50 })
  db.pointLedgerEntry.create.mockResolvedValue({ id: 'e1' })
  db.pointLedgerEntry.findFirst.mockResolvedValue(null)
})

describe('maybeAwardInviteOnModule0', () => {
  it('credita +50 ao convidante no módulo 0', async () => {
    await maybeAwardInviteOnModule0(inviteeId, module0, db as never)
    expect(db.pointLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: inviterId,
        delta: 50,
        reason: 'INVITE_REWARD',
        sourceType: 'InviteAttribution',
        sourceId: attributionId,
      }),
    })
    expect(db.inviteAttribution.update).toHaveBeenCalledWith({
      where: { id: attributionId },
      data: expect.objectContaining({ pointsAwarded: 50 }),
    })
  })

  it('respeita o teto de 10 convites pontuados', async () => {
    db.inviteAttribution.count.mockResolvedValue(10)
    await maybeAwardInviteOnModule0(inviteeId, module0, db as never)
    expect(db.pointLedgerEntry.create).not.toHaveBeenCalled()
    expect(db.inviteAttribution.update).toHaveBeenCalledWith({
      where: { id: attributionId },
      data: expect.objectContaining({ pointsAwarded: 0 }),
    })
  })

  it('ignora módulos que não são o módulo 0', async () => {
    await maybeAwardInviteOnModule0(inviteeId, 'other-module', db as never)
    expect(db.inviteAttribution.findUnique).not.toHaveBeenCalled()
  })
})
