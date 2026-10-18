import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '../../generated/prisma/client.js'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'

const userId = '11111111-1111-4111-8111-111111111111'
const reportId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const moduleId = '33333333-3333-4333-8333-333333333333'

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  neighborhood: { findUnique: vi.fn(), findFirst: vi.fn() },
  trail: { findFirst: vi.fn() },
  programConfiguration: { findMany: vi.fn() },
  report: { count: vi.fn(), create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  reportTimelineEvent: { create: vi.fn() },
  pointAccount: { upsert: vi.fn(), update: vi.fn() },
  pointLedgerEntry: { create: vi.fn(), findFirst: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))

let app: FastifyInstance
let token: string
let module0Completed: boolean
const headers = () => ({ authorization: 'Bearer ' + token })

describe('avaliação administrativa de emergência', () => {
  const url = '/api/v1/admin/relatos/' + reportId + '/emergency'
  it('exige login e papel administrativo', async () => {
    expect((await app.inject({ method: 'PATCH', url, payload: { requiresEmergencyTeam: true } })).statusCode).toBe(401)
    expect((await app.inject({ method: 'PATCH', url, headers: headers(), payload: { requiresEmergencyTeam: true } })).statusCode).toBe(403)
    expect(db.report.update).not.toHaveBeenCalled()
  })
  it.each([true, false, null])('salva a decisão %s sem alterar status, risco ou pontos', async decision => {
    db.user.findUnique.mockResolvedValue({ id: userId, role: 'ADMIN' })
    db.report.update.mockResolvedValue({ id: reportId, requiresEmergencyTeam: decision })
    const response = await app.inject({ method: 'PATCH', url, headers: headers(), payload: { requiresEmergencyTeam: decision } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ id: reportId, requiresEmergencyTeam: decision })
    expect(db.report.update).toHaveBeenCalledWith({ where: { id: reportId }, data: { requiresEmergencyTeam: decision }, select: { id: true, requiresEmergencyTeam: true } })
    expect(db.reportTimelineEvent.create).not.toHaveBeenCalled()
    expect(db.pointLedgerEntry.create).not.toHaveBeenCalled()
  })
  it.each([{}, { requiresEmergencyTeam: 'true' }])('rejeita uma decisão inválida', async payload => {
    db.user.findUnique.mockResolvedValue({ id: userId, role: 'ADMIN' })
    expect((await app.inject({ method: 'PATCH', url, headers: headers(), payload })).statusCode).toBe(400)
    expect(db.report.update).not.toHaveBeenCalled()
  })
  it('retorna 404 para relato inexistente', async () => {
    db.user.findUnique.mockResolvedValue({ id: userId, role: 'ADMIN' })
    db.report.update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('missing', { code: 'P2025', clientVersion: '7.10.1' }))
    expect((await app.inject({ method: 'PATCH', url, headers: headers(), payload: { requiresEmergencyTeam: true } })).statusCode).toBe(404)
  })
})

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
  token = createSessionToken(userId)
  module0Completed = true
  db.user.findUnique.mockResolvedValue({ id: userId, role: 'USER' })
  db.trail.findFirst.mockImplementation(async () => ({
    modules: [{
      id: moduleId,
      progressRecords: module0Completed ? [{ completedAt: new Date() }] : [],
    }],
  }))
  db.pointAccount.upsert.mockResolvedValue({ userId, accumulated: 0, balance: 0 })
  db.pointAccount.update.mockResolvedValue({ userId, accumulated: 10, balance: 10 })
  db.pointLedgerEntry.create.mockResolvedValue({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })
  db.pointLedgerEntry.findFirst.mockResolvedValue(null)
  db.neighborhood.findFirst.mockImplementation(async ({ where }: { where?: { name?: { equals?: string } } }) => {
    const name = where?.name?.equals
    if (!name) return null
    const known: Record<string, string> = {
      Cohama: 'Cohama',
      cohama: 'Cohama',
      Turú: 'Turú',
      'Turú': 'Turú',
    }
    const matched = known[name] ?? Object.entries(known).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1]
    return matched ? { name: matched } : null
  })
  db.neighborhood.findUnique.mockResolvedValue(null)
  db.$transaction.mockImplementation(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db))
  db.programConfiguration.findMany.mockResolvedValue([
    ...['low', 'medium', 'high'].map((risk, i) => ({ key: 'report_' + risk, kind: 'RULE', value: [10, 25, 50][i], isActive: true })),
    { key: 'reports_daily', kind: 'LIMIT', value: 2, isActive: true },
    { key: 'reports_monthly', kind: 'LIMIT', value: 10, isActive: true },
  ])
  db.report.count.mockResolvedValue(0)
  app = await buildApp({ logger: false })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await app.close()
})

describe('criação de relatos', () => {
  it('bloqueia criação sem módulo 0 concluído', async () => {
    module0Completed = false
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/relatos',
      headers: headers(),
      payload: {
        title: 'Pipa na rede',
        description: 'Linha presa no fio',
        address: 'Rua 7',
        neighborhood: 'Cohama',
      },
    })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toMatchObject({ code: 'REPORTS_LOCKED' })
    expect(db.report.create).not.toHaveBeenCalled()
  })

  it('cria relato com status enviado, timeline e zero pontos', async () => {
    const submittedAt = new Date('2026-10-16T12:00:00.000Z')
    db.report.create.mockResolvedValue({
      id: reportId,
      title: 'Pipa na rede',
      description: 'Linha presa no fio',
      address: 'Rua 7',
      neighborhood: 'Cohama',
      photoUrl: null,
      latitude: null,
      longitude: null,
      status: 'SENT',
      urgency: 'MEDIUM',
      pointsAwarded: 0,
      submittedAt,
      timeline: [{ status: 'SENT', occurredAt: submittedAt }],
    })

    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/relatos',
      headers: headers(),
      payload: {
        title: 'Pipa na rede',
        description: 'Linha presa no fio',
        address: 'Rua 7',
        neighborhood: 'Cohama',
      },
    })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({
      id: reportId,
      neighborhood: 'Cohama',
      pointsAwarded: 0,
      status: { code: 'SENT', label: 'Enviado', iconHint: 'check' },
      urgency: { code: 'MEDIUM', label: 'Urgência média' },
    })
    expect(db.report.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId, neighborhood: 'Cohama', pointsAwarded: 0 }) }))
    expect(r.json().timeline[0]).toMatchObject({ pending: false, status: { code: 'SENT' } })
  })

  it('usa o bairro do cadastro quando o body omite o bairro', async () => {
    const submittedAt = new Date('2026-10-16T12:00:00.000Z')
    db.user.findUnique
      .mockResolvedValueOnce({ id: userId, role: 'USER' })
      .mockResolvedValueOnce({ neighborhood: 'Turú', neighborhoodId: null })
    db.report.create.mockResolvedValue({
      id: reportId,
      title: 'Poste inclinado',
      description: 'Risco na via',
      address: 'Rua A',
      neighborhood: 'Turú',
      photoUrl: null,
      latitude: null,
      longitude: null,
      status: 'SENT',
      urgency: 'MEDIUM',
      pointsAwarded: 0,
      submittedAt,
      timeline: [{ status: 'SENT', occurredAt: submittedAt }],
    })

    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/relatos',
      headers: headers(),
      payload: {
        title: 'Poste inclinado',
        description: 'Risco na via',
        address: 'Rua A',
      },
    })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({ neighborhood: 'Turú' })
    expect(db.report.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ neighborhood: 'Turú' }),
    }))
  })

  it.each(['', '   '])('trata neighborhood %j como ausente e usa o cadastro', async (neighborhood) => {
    const submittedAt = new Date('2026-10-16T12:00:00.000Z')
    db.user.findUnique
      .mockResolvedValueOnce({ id: userId, role: 'USER' })
      .mockResolvedValueOnce({ neighborhood: 'Cohama', neighborhoodId: 'nb-cohama' })
    db.neighborhood.findUnique.mockResolvedValue({
      id: 'nb-cohama',
      name: 'Cohama',
      municipalityCode: '2111300',
    })
    db.report.create.mockResolvedValue({
      id: reportId,
      title: 'Pipa na rede',
      description: 'Linha presa',
      address: 'Rua 7',
      neighborhood: 'Cohama',
      photoUrl: null,
      latitude: null,
      longitude: null,
      status: 'SENT',
      urgency: 'MEDIUM',
      pointsAwarded: 0,
      submittedAt,
      timeline: [{ status: 'SENT', occurredAt: submittedAt }],
    })

    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/relatos',
      headers: headers(),
      payload: {
        title: 'Pipa na rede',
        description: 'Linha presa',
        address: 'Rua 7',
        neighborhood,
      },
    })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({ neighborhood: 'Cohama' })
  })

  it('rejeita texto livre fora do catálogo', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/relatos',
      headers: headers(),
      payload: {
        title: 'Pipa na rede',
        description: 'Linha presa no fio',
        address: 'Rua 7',
        neighborhood: 'Bairro Inventado',
      },
    })
    expect(r.statusCode).toBe(400)
    expect(r.json()).toMatchObject({ code: 'INVALID_NEIGHBORHOOD' })
    expect(db.report.create).not.toHaveBeenCalled()
  })

  it('rejeita neighborhoodId inexistente', async () => {
    db.neighborhood.findUnique.mockResolvedValue(null)
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/relatos',
      headers: headers(),
      payload: {
        title: 'Pipa na rede',
        description: 'Linha presa no fio',
        address: 'Rua 7',
        neighborhoodId: 'bairro-invalido',
      },
    })
    expect(r.statusCode).toBe(400)
    expect(r.json()).toMatchObject({ code: 'INVALID_NEIGHBORHOOD' })
    expect(db.report.create).not.toHaveBeenCalled()
  })
})

describe('listagem e detalhe', () => {
  it('retorna resumo e lista com status semântico', async () => {
    db.report.findMany.mockResolvedValue([
      {
        id: reportId,
        title: 'Pipa na rede',
        address: 'Rua 7',
        neighborhood: 'Cohama',
        photoUrl: null,
        latitude: null,
        longitude: null,
        status: 'IN_ANALYSIS',
        urgency: 'MEDIUM',
        pointsAwarded: 0,
        submittedAt: new Date('2026-10-16T12:00:00.000Z'),
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        title: 'Poste inclinado',
        address: 'Av. Central',
        neighborhood: 'Cohama',
        photoUrl: null,
        latitude: null,
        longitude: null,
        status: 'RESOLVED',
        urgency: 'HIGH',
        pointsAwarded: 50,
        submittedAt: new Date('2026-10-12T12:00:00.000Z'),
      },
    ])

    const r = await app.inject({ method: 'GET', url: '/api/v1/relatos', headers: headers() })
    expect(r.statusCode).toBe(200)
    expect(db.report.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId } }))
    expect(r.json()).toMatchObject({
      summary: { sentCount: 2, resolvedCount: 1, totalPoints: 50 },
    })
    expect(r.json().reports[0].status).toMatchObject({ code: 'IN_ANALYSIS', label: 'Em análise', iconHint: 'clock' })
  })

  it('monta linha do tempo com etapas pendentes', async () => {
    const t1 = new Date('2026-10-16T12:00:00.000Z')
    const t2 = new Date('2026-10-16T12:40:00.000Z')
    db.report.findFirst.mockResolvedValue({
      id: reportId,
      title: 'Pipa na rede',
      description: 'Linha presa no fio',
      address: 'Rua 7',
      neighborhood: 'Cohama',
      photoUrl: null,
      latitude: null,
      longitude: null,
      status: 'IN_ANALYSIS',
      urgency: 'MEDIUM',
      pointsAwarded: 0,
      submittedAt: t1,
      timeline: [
        { status: 'SENT', occurredAt: t1 },
        { status: 'RECEIVED', occurredAt: t2 },
        { status: 'IN_ANALYSIS', occurredAt: new Date('2026-10-16T14:05:00.000Z') },
      ],
    })

    const r = await app.inject({ method: 'GET', url: `/api/v1/relatos/${reportId}`, headers: headers() })
    expect(r.statusCode).toBe(200)
    const timeline = r.json().timeline
    expect(timeline).toHaveLength(4)
    expect(timeline[2]).toMatchObject({ pending: false, status: { code: 'IN_ANALYSIS' } })
    expect(timeline[3]).toMatchObject({ pending: true, status: { code: 'RESOLVED' }, occurredAt: null })
  })
})

describe('impacto', () => {
  it('retorna mensagem pendente e marca como vista', async () => {
    db.report.findFirst.mockResolvedValue({
      id: reportId,
      title: 'Poste inclinado',
      neighborhood: 'Cohama',
      pointsAwarded: 50,
    })
    const pending = await app.inject({ method: 'GET', url: '/api/v1/relatos/impacto', headers: headers() })
    expect(pending.statusCode).toBe(200)
    expect(pending.json()).toMatchObject({
      reportId,
      title: 'Seu relato ajudou o seu bairro',
      pointsAwarded: 50,
    })

    db.report.findFirst.mockResolvedValue({ id: reportId, impactSeenAt: null })
    db.report.update.mockResolvedValue({ id: reportId })
    const seen = await app.inject({ method: 'POST', url: `/api/v1/relatos/${reportId}/impacto/visto`, headers: headers() })
    expect(seen.statusCode).toBe(200)
    expect(seen.json().reportId).toBe(reportId)
    expect(db.report.update).toHaveBeenCalled()
  })

  it('responde 200 com JSON null quando não há impacto pendente', async () => {
    db.report.findFirst.mockResolvedValue(null)
    const r = await app.inject({ method: 'GET', url: '/api/v1/relatos/impacto', headers: headers() })
    expect(r.statusCode).toBe(200)
    expect(r.headers['content-type']).toContain('application/json')
    expect(r.body).toBe('null')
    expect(r.json()).toBeNull()
  })
})

describe('admin status', () => {
  it('valida risco médio e concede o valor configurado', async () => {
    token = createSessionToken(userId)
    db.user.findUnique.mockResolvedValue({ id: userId, role: 'ADMIN' })
    db.report.findUnique.mockResolvedValue({
      id: reportId,
      userId,
      title: 'Pipa na rede',
      description: 'Linha presa',
      address: 'Rua 7',
      neighborhood: 'Cohama',
      photoUrl: null,
      latitude: null,
      longitude: null,
      status: 'IN_ANALYSIS',
      urgency: 'MEDIUM',
      pointsAwarded: 0,
      impactSeenAt: new Date(),
      submittedAt: new Date('2026-10-16T12:00:00.000Z'),
    })
    db.report.update.mockResolvedValue({
      id: reportId,
      userId,
      title: 'Pipa na rede',
      description: 'Linha presa',
      address: 'Rua 7',
      neighborhood: 'Cohama',
      photoUrl: null,
      latitude: null,
      longitude: null,
      status: 'RESOLVED',
      urgency: 'MEDIUM',
      pointsAwarded: 25,
      impactSeenAt: null,
      submittedAt: new Date('2026-10-16T12:00:00.000Z'),
    })
    db.reportTimelineEvent.create.mockResolvedValue({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })

    const r = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/relatos/${reportId}/status`,
      headers: headers(),
      payload: { status: 'RESOLVED', confirmedRisk: 'MEDIUM' },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      status: { code: 'RESOLVED', label: 'Resolvido' },
      pointsAwarded: 25,
      impactSeenAt: null,
    })
    expect(db.reportTimelineEvent.create).toHaveBeenCalled()
  })
})

describe('regras de concessão', () => {
  beforeEach(() => {
    db.user.findUnique.mockResolvedValue({ id: userId, role: 'ADMIN' })
    db.report.findUnique.mockResolvedValue({ id: reportId, userId, status: 'IN_ANALYSIS', pointsAwarded: 0 })
    db.report.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: reportId, userId, title: 'Relato', description: 'Risco', address: 'Rua', neighborhood: 'Centro', photoUrl: null,
      latitude: null, longitude: null, urgency: 'LOW', impactSeenAt: null, submittedAt: new Date(), ...data,
    }))
  })
  const resolve = (risk?: string) => app.inject({ method: 'PATCH', url: '/api/v1/admin/relatos/' + reportId + '/status', headers: headers(), payload: { status: 'RESOLVED', ...(risk ? { confirmedRisk: risk } : {}) } })
  it.each([['LOW', 10], ['MEDIUM', 25], ['HIGH', 50]])('usa classificação confirmada %s', async (risk, points) => {
    await resolve(risk as string)
    expect(db.report.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pointsAwarded: points, confirmedRisk: risk, validatedAt: expect.any(Date) }) }))
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
  })
  it('credita o extrato e o ranking ao resolver com pontos', async () => {
    await resolve('MEDIUM')
    expect(db.pointLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        delta: 25,
        reason: 'REPORT_CONFIRM',
        sourceType: 'Report',
        sourceId: reportId,
      }),
    })
    expect(db.pointAccount.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId },
      data: expect.objectContaining({ balance: { increment: 25 }, accumulated: { increment: 25 } }),
    }))
  })
  it('não credita o extrato quando a resolução não concede pontos', async () => {
    db.report.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0)
    await resolve('HIGH')
    expect(db.report.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pointsAwarded: 0 }) }))
    expect(db.pointLedgerEntry.create).not.toHaveBeenCalled()
  })
  it('exige classificação pela equipe', async () => {
    expect((await resolve()).statusCode).toBe(422)
    expect(db.report.update).not.toHaveBeenCalled()
  })
  it.each([[2, 0], [0, 10]])('não pontua ao atingir limite diário/mensal', async (daily, monthly) => {
    db.report.count.mockResolvedValueOnce(daily).mockResolvedValueOnce(monthly)
    await resolve('HIGH')
    expect(db.report.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pointsAwarded: 0 }) }))
  })
  it('consulta valores administrativos atuais', async () => {
    db.programConfiguration.findMany.mockResolvedValue([{ key: 'report_low', kind: 'RULE', value: 17, isActive: true }, { key: 'reports_daily', kind: 'LIMIT', value: 2, isActive: true }, { key: 'reports_monthly', kind: 'LIMIT', value: 10, isActive: true }])
    await resolve('LOW')
    expect(db.report.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pointsAwarded: 17 }) }))
  })
  it('não concede novamente ao repetir resolução', async () => {
    db.report.findUnique.mockResolvedValue({ id: reportId, userId, status: 'RESOLVED', pointsAwarded: 25 })
    await resolve()
    expect(db.programConfiguration.findMany).not.toHaveBeenCalled()
    expect(db.report.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pointsAwarded: 25 }) }))
  })
  it('zera relato não confirmado', async () => {
    db.report.findUnique.mockResolvedValue({ id: reportId, userId, status: 'SENT', pointsAwarded: 10 })
    await app.inject({ method: 'PATCH', url: '/api/v1/admin/relatos/' + reportId + '/status', headers: headers(), payload: { status: 'NOT_CONFIRMED' } })
    expect(db.report.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pointsAwarded: 0 }) }))
  })
  it('não concede pontos com regra inativa', async () => {
    db.programConfiguration.findMany.mockResolvedValue([{ key: 'report_low', kind: 'RULE', value: 10, isActive: false }, { key: 'reports_daily', kind: 'LIMIT', value: 2, isActive: true }, { key: 'reports_monthly', kind: 'LIMIT', value: 10, isActive: true }])
    expect((await resolve('LOW')).statusCode).toBe(200)
    expect(db.report.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pointsAwarded: 0 }) }))
  })
  it('bloqueia configuração pendente sem gravar', async () => {
    db.programConfiguration.findMany.mockResolvedValue([{ key: 'report_low', kind: 'RULE', value: 10, isActive: true }, { key: 'reports_daily', kind: 'LIMIT', value: null, isActive: true }, { key: 'reports_monthly', kind: 'LIMIT', value: 10, isActive: true }])
    expect((await resolve('LOW')).statusCode).toBe(422)
    expect(db.report.update).not.toHaveBeenCalled()
    expect(db.reportTimelineEvent.create).not.toHaveBeenCalled()
  })
  it('retorna conflito quando a transação perde uma disputa concorrente', async () => {
    db.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('serialization', { code: 'P2034', clientVersion: '7.10.1' }))
    expect((await resolve('LOW')).statusCode).toBe(409)
  })
  it('conta dia e mês no fuso de Fortaleza', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-01T02:30:00Z'))
    token = createSessionToken(userId)
    try {
      await resolve('LOW')
      expect(db.report.count).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ validatedAt: { gte: new Date('2026-10-31T03:00:00Z'), lt: new Date('2026-11-01T03:00:00Z') } }) }))
      expect(db.report.count).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: expect.objectContaining({ validatedAt: { gte: new Date('2026-10-01T03:00:00Z'), lt: new Date('2026-11-01T03:00:00Z') } }) }))
    } finally { vi.useRealTimers() }
  })

})
