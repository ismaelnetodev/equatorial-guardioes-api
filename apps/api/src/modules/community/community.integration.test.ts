import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'
import { PointsLedgerError } from '../../lib/points-ledger.js'

const userId = '11111111-1111-4111-8111-111111111111'
const otherUserId = '22222222-2222-4222-8222-222222222222'
const redemptionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const attributionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  neighborhood: { findUnique: vi.fn() },
  pointAccount: { upsert: vi.fn(), update: vi.fn() },
  pointLedgerEntry: { create: vi.fn(), findFirst: vi.fn() },
  programConfiguration: { findUnique: vi.fn(), findMany: vi.fn() },
  report: { count: vi.fn() },
  rewardRedemption: { create: vi.fn() },
  inviteAttribution: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  trail: { findMany: vi.fn(), findFirst: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))

let app: FastifyInstance
let token: string
const headers = () => ({ authorization: 'Bearer ' + token })

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
  token = createSessionToken(userId)
  db.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) => {
    if (where.id === userId) {
      return {
        id: userId,
        role: 'USER',
        name: 'Ana Guardiã',
        neighborhood: 'Cohama',
        inviteCode: 'ABCD1234',
      }
    }
    return null
  })
  db.user.findFirst.mockResolvedValue(null)
  db.user.findMany.mockResolvedValue([
    { neighborhood: 'Cohama', pointAccount: { accumulated: 100 } },
    { neighborhood: 'Cohama', pointAccount: { accumulated: 65 } },
    { neighborhood: 'Centro', pointAccount: { accumulated: 200 } },
  ])
  db.user.update.mockImplementation(async ({ data }: { data: { inviteCode?: string } }) => ({
    inviteCode: data.inviteCode ?? 'ABCD1234',
  }))
  db.pointAccount.upsert.mockResolvedValue({ userId, accumulated: 165, balance: 120 })
  db.pointAccount.update.mockResolvedValue({ userId, accumulated: 165, balance: 70 })
  db.pointLedgerEntry.create.mockResolvedValue({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })
  db.pointLedgerEntry.findFirst.mockResolvedValue(null)
  db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
    const values: Record<string, number> = {
      level_silver_threshold: 250,
      level_gold_threshold: 600,
      level_platinum_threshold: 1200,
      redemption_validated_reports: 2,
      invite_reward_limit: 10,
      invite_module0_reward: 50,
    }
    if (where.key in values) {
      return { value: values[where.key], isActive: true }
    }
    return null
  })
  db.programConfiguration.findMany.mockResolvedValue([
    {
      key: 'partner_coupon',
      name: 'Cupom',
      description: 'Cupom parceiro',
      value: 200,
      unit: 'points',
    },
    {
      key: 'certificate',
      name: 'Certificado',
      description: 'Sem preço',
      value: null,
      unit: 'trail_completion',
    },
  ])
  db.report.count.mockResolvedValue(2)
  db.rewardRedemption.create.mockResolvedValue({
    id: redemptionId,
    rewardKey: 'partner_coupon',
    pointsSpent: 200,
  })
  db.inviteAttribution.findMany.mockResolvedValue([
    { module0CompletedAt: new Date(), pointsAwarded: 50 },
    { module0CompletedAt: null, pointsAwarded: 0 },
  ])
  db.inviteAttribution.findUnique.mockResolvedValue(null)
  db.inviteAttribution.create.mockResolvedValue({ id: attributionId })
  db.trail.findMany.mockResolvedValue([
    {
      modules: [
        { id: 'm0', progressRecords: [{ id: 'p0' }] },
        { id: 'm1', progressRecords: [] },
      ],
    },
  ])
  db.trail.findFirst.mockResolvedValue({
    modules: [{ id: 'm0', progressRecords: [{ completedAt: new Date() }] }],
  })
  db.$transaction.mockImplementation(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db))
  app = await buildApp({ logger: false })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await app.close()
})

describe('GET /api/v1/ranking', () => {
  it('ordena apenas por bairro e marca o bairro do usuário', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/ranking', headers: headers() })
    expect(r.statusCode).toBe(200)
    const body = r.json()
    expect(body.neighborhoods.map((item: { neighborhood: string }) => item.neighborhood)).toEqual([
      'Centro',
      'Cohama',
    ])
    expect(body.neighborhoods[0]).toMatchObject({
      accumulatedPoints: 200,
      guardiansCount: 1,
      isCurrentUserNeighborhood: false,
    })
    expect(body.neighborhoods[1]).toMatchObject({
      accumulatedPoints: 165,
      guardiansCount: 2,
      isCurrentUserNeighborhood: true,
    })
    expect(body.yourContribution).toMatchObject({
      accumulatedPoints: 165,
      neighborhood: 'Cohama',
      neighborhoodSharePercent: 100,
    })
  })
})

describe('GET /api/v1/recompensas', () => {
  it('expõe saldo, acumulados, nível e catálogo ativo', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/recompensas', headers: headers() })
    expect(r.statusCode).toBe(200)
    const body = r.json()
    expect(body).toMatchObject({
      balance: 120,
      accumulated: 165,
      level: { code: 'BRONZE', name: 'Bronze', pointsToNextLevel: 85 },
    })
    expect(body.rewards).toEqual([
      expect.objectContaining({
        key: 'partner_coupon',
        cost: 200,
        canRedeem: false,
        pointsMissing: 80,
      }),
      expect.objectContaining({
        key: 'certificate',
        cost: null,
        canRedeem: false,
        pointsMissing: null,
      }),
    ])
  })
})

describe('POST /api/v1/recompensas/:key/resgatar', () => {
  it('debita apenas o saldo e cria resgate', async () => {
    db.pointAccount.upsert.mockResolvedValue({ userId, accumulated: 400, balance: 250 })
    db.pointAccount.update.mockResolvedValue({ userId, accumulated: 400, balance: 50 })
    db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === 'partner_coupon') {
        return { key: 'partner_coupon', kind: 'REWARD', isActive: true, value: 200, unit: 'points' }
      }
      if (where.key === 'redemption_validated_reports') {
        return { value: 2, isActive: true }
      }
      return null
    })

    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/recompensas/partner_coupon/resgatar',
      headers: headers(),
    })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({
      redemptionId,
      rewardKey: 'partner_coupon',
      pointsSpent: 200,
      balance: 50,
      accumulated: 400,
    })
    expect(db.pointLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          delta: -200,
          affectsAccumulated: false,
          reason: 'REDEMPTION',
        }),
      }),
    )
  })

  it('bloqueia resgate sem relatos validados suficientes', async () => {
    db.report.count.mockResolvedValue(1)
    db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === 'partner_coupon') {
        return { key: 'partner_coupon', kind: 'REWARD', isActive: true, value: 200, unit: 'points' }
      }
      if (where.key === 'redemption_validated_reports') {
        return { value: 2, isActive: true }
      }
      return null
    })

    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/recompensas/partner_coupon/resgatar',
      headers: headers(),
    })
    expect(r.statusCode).toBe(422)
    expect(r.json()).toMatchObject({ code: 'VALIDATED_REPORTS_REQUIRED' })
    expect(db.rewardRedemption.create).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/convidar', () => {
  it('devolve código e estatísticas de convite', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/convidar', headers: headers() })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      inviteCode: 'ABCD1234',
      inviteLimit: 10,
      stats: {
        registeredCount: 2,
        module0CompletedCount: 1,
        pointsFromInvites: 50,
        rewardedInviteCount: 1,
      },
    })
  })
})

describe('POST /api/v1/convidar/atribuir', () => {
  it('liga o código do convidante ao usuário autenticado', async () => {
    db.user.findFirst.mockResolvedValue({ id: otherUserId })
    db.inviteAttribution.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ inviteCode: 'INVITE99' })

    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/convidar/atribuir',
      headers: headers(),
      payload: { inviteCode: 'INVITE99' },
    })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toEqual({ attributed: true, inviteCode: 'INVITE99' })
    expect(db.inviteAttribution.create).toHaveBeenCalled()
  })
})

describe('GET /api/v1/perfil', () => {
  it('monta perfil consistente com pontos e selos', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/perfil', headers: headers() })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      name: 'Ana Guardiã',
      neighborhood: 'Cohama',
      accumulated: 165,
      balance: 120,
      canReport: true,
      level: { code: 'BRONZE' },
      badges: { modulesCompleted: 1, modulesPublished: 2 },
      reportsCount: 2,
      shortcuts: {
        ranking: '/ranking',
        rewards: '/recompensas',
        invite: '/convidar',
        reports: '/relatos',
      },
    })
  })

  it('expõe canReport false antes de concluir o módulo inicial', async () => {
    db.trail.findFirst.mockResolvedValue({
      modules: [{ id: 'm0', progressRecords: [] }],
    })
    const r = await app.inject({ method: 'GET', url: '/api/v1/perfil', headers: headers() })
    expect(r.statusCode).toBe(200)
    expect(r.json().canReport).toBe(false)
  })
})

describe('PATCH /api/v1/perfil', () => {
  it('atualiza nome e bairro e devolve o perfil', async () => {
    db.user.update.mockResolvedValue({})
    db.user.findUnique
      .mockResolvedValueOnce({
        id: userId,
        role: 'USER',
        name: 'Ana Guardiã',
        neighborhood: 'Cohama',
        inviteCode: 'ABCD1234',
      })
      .mockResolvedValueOnce({ name: 'Ana Silva', neighborhood: 'Centro' })

    const r = await app.inject({
      method: 'PATCH',
      url: '/api/v1/perfil',
      headers: headers(),
      payload: { name: 'Ana Silva', neighborhood: 'Centro' },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ name: 'Ana Silva', neighborhood: 'Centro', canReport: true })
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { name: 'Ana Silva', neighborhood: 'Centro', neighborhoodId: null },
    })
  })

  it('rejeita bairro de catálogo inválido', async () => {
    db.neighborhood.findUnique.mockResolvedValue(null)
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/v1/perfil',
      headers: headers(),
      payload: { neighborhoodId: 'bairro-inexistente' },
    })
    expect(r.statusCode).toBe(400)
    expect(r.json()).toMatchObject({ code: 'INVALID_NEIGHBORHOOD' })
    expect(db.user.update).not.toHaveBeenCalled()
  })
})

describe('crédito vs resgate no livro', () => {
  it('propaga INSUFFICIENT_BALANCE do ledger no resgate', async () => {
    db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === 'partner_coupon') {
        return { key: 'partner_coupon', kind: 'REWARD', isActive: true, value: 200, unit: 'points' }
      }
      if (where.key === 'redemption_validated_reports') {
        return { value: 2, isActive: true }
      }
      return null
    })
    db.$transaction.mockImplementation(async () => {
      throw new PointsLedgerError('INSUFFICIENT_BALANCE', 'Saldo insuficiente para esta operação.')
    })

    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/recompensas/partner_coupon/resgatar',
      headers: headers(),
    })
    expect(r.statusCode).toBe(422)
    expect(r.json()).toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
  })
})
