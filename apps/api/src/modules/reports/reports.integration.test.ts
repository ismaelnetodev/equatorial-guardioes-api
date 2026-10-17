import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'

const userId = '11111111-1111-4111-8111-111111111111'
const reportId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const moduleId = '33333333-3333-4333-8333-333333333333'

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  trail: { findFirst: vi.fn() },
  report: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  reportTimelineEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))

let app: FastifyInstance
let token: string
let module0Completed: boolean
const headers = () => ({ authorization: 'Bearer ' + token })

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
  db.$transaction.mockImplementation(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db))
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

  it('cria relato com status enviado, timeline e +10 pontos', async () => {
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
      pointsAwarded: 10,
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
      pointsAwarded: 10,
      status: { code: 'SENT', label: 'Enviado', iconHint: 'check' },
      urgency: { code: 'MEDIUM', label: 'Urgência média' },
    })
    expect(r.json().timeline[0]).toMatchObject({ pending: false, status: { code: 'SENT' } })
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
        status: 'IN_ANALYSIS',
        urgency: 'MEDIUM',
        pointsAwarded: 10,
        submittedAt: new Date('2026-10-16T12:00:00.000Z'),
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        title: 'Poste inclinado',
        address: 'Av. Central',
        neighborhood: 'Cohama',
        photoUrl: null,
        status: 'RESOLVED',
        urgency: 'HIGH',
        pointsAwarded: 50,
        submittedAt: new Date('2026-10-12T12:00:00.000Z'),
      },
    ])

    const r = await app.inject({ method: 'GET', url: '/api/v1/relatos', headers: headers() })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      summary: { sentCount: 2, resolvedCount: 1, totalPoints: 60 },
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
      pointsAwarded: 10,
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
      pointsAwarded: 40,
    })

    db.report.findFirst.mockResolvedValue({ id: reportId, impactSeenAt: null })
    db.report.update.mockResolvedValue({ id: reportId })
    const seen = await app.inject({ method: 'POST', url: `/api/v1/relatos/${reportId}/impacto/visto`, headers: headers() })
    expect(seen.statusCode).toBe(200)
    expect(seen.json().reportId).toBe(reportId)
    expect(db.report.update).toHaveBeenCalled()
  })

  it('responde 204 quando não há impacto pendente', async () => {
    db.report.findFirst.mockResolvedValue(null)
    const r = await app.inject({ method: 'GET', url: '/api/v1/relatos/impacto', headers: headers() })
    expect(r.statusCode).toBe(204)
  })
})

describe('admin status', () => {
  it('avança para resolvido, soma +40 e libera impacto', async () => {
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
      status: 'IN_ANALYSIS',
      urgency: 'MEDIUM',
      pointsAwarded: 10,
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
      status: 'RESOLVED',
      urgency: 'MEDIUM',
      pointsAwarded: 50,
      impactSeenAt: null,
      submittedAt: new Date('2026-10-16T12:00:00.000Z'),
    })
    db.reportTimelineEvent.create.mockResolvedValue({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })

    const r = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/relatos/${reportId}/status`,
      headers: headers(),
      payload: { status: 'RESOLVED' },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      status: { code: 'RESOLVED', label: 'Resolvido' },
      pointsAwarded: 50,
      impactSeenAt: null,
    })
    expect(db.reportTimelineEvent.create).toHaveBeenCalled()
  })
})
