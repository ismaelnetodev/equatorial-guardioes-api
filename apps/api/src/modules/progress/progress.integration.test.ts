import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'
import * as quiz from '../quiz/quiz.service.js'

const db = vi.hoisted(() => ({
  learningAward: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  user: { findUnique: vi.fn() },
  trail: { findUnique: vi.fn(), findFirst: vi.fn() },
  trailModule: { findUnique: vi.fn() },
  moduleProgress: { findUniqueOrThrow: vi.fn(), upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  inviteAttribution: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
  programConfiguration: { findUnique: vi.fn() },
  pointAccount: { upsert: vi.fn(), update: vi.fn() },
  pointLedgerEntry: { create: vi.fn(), findFirst: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))
const userId = '11111111-1111-4111-8111-111111111111'
const trailId = '22222222-2222-4222-8222-222222222222'
const moduleId = '33333333-3333-4333-8333-333333333333'
let app: FastifyInstance
let token: string
let requiresQuiz: boolean
const headers = () => ({ authorization: 'Bearer ' + token })
const completeUrl = '/api/v1/progress/modules/' + moduleId + '/complete'

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
  requiresQuiz = false
  token = createSessionToken(userId)
  db.user.findUnique.mockResolvedValue({ id: userId, role: 'USER' })
  db.trailModule.findUnique.mockImplementation(async () => ({ id: moduleId, trailId, isActive: true, requiresQuiz, durationMinutes: 3 }))
  db.trail.findUnique.mockImplementation(async () => ({ id: trailId, modules: [{ id: moduleId, title: 'Módulo', order: 1, requiresQuiz, progressRecords: [{ startedAt: new Date(), completedAt: null }] }] }))
  db.moduleProgress.upsert.mockResolvedValue({ id: moduleId })
  db.moduleProgress.findUnique.mockResolvedValue({ id: moduleId })
  db.moduleProgress.update.mockResolvedValue({ completedAt: new Date() })
  db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => ({
    key: where.key, kind: ['module_completion', 'module_quiz', 'post_test_improvement', 'final_exam', 'training_completion'].includes(where.key) ? 'RULE' : 'LIMIT',
    value: ({ module_completion: 2, module_quiz: 0, post_test_improvement: 6, training_completion: 3, quiz_pass_score: 80, training_modules_daily: 2, training_points_daily: 4, module_minimum_time: 70, post_test_improvement_awards: 1, final_exam: 10, final_exam_delay: 24, final_exam_awards: 1 } as Record<string, number>)[where.key] ?? null,
    isActive: true,
  }))
  db.learningAward.findMany.mockResolvedValue([])
  db.learningAward.findUnique.mockResolvedValue(null)
  db.learningAward.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'award-1', grantedAt: null, ...data }))
  db.learningAward.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'award-1', ...data }))
  db.learningAward.count.mockResolvedValue(0)
  db.moduleProgress.findUniqueOrThrow.mockImplementation(async () => ({ id: '33333333-3333-4333-8333-333333333333', startedAt: new Date(Date.now() - 3600000), completedAt: null, preTestCompletedAt: new Date(), trainingCompletedAt: null }))
  db.trail.findFirst.mockResolvedValue({ modules: [{ id: moduleId }] })
  db.inviteAttribution.findUnique.mockResolvedValue(null)
  db.$transaction.mockImplementation(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db))
  app = await buildApp({ logger: false })
})
afterEach(async () => { vi.useRealTimers(); vi.restoreAllMocks(); await app.close() })

it('calcula o bloqueio pelo texto e permite concluir ao atingir o tempo de leitura mínimo', async () => {
  const now = Date.now()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  db.trailModule.findUnique.mockResolvedValue({ id: moduleId, trailId, isActive: true, requiresQuiz: false, durationMinutes: 100, content: 'palavra '.repeat(200), trainingSteps: [] })
  db.moduleProgress.findUniqueOrThrow.mockResolvedValue({ id: moduleId, startedAt: new Date(now - 41000), completedAt: null })
  const early = await app.inject({ method: 'POST', url: completeUrl, headers: headers() })
  expect(early.statusCode).toBe(409)
  expect(early.json()).toMatchObject({ code: 'MINIMUM_TIME_REQUIRED', message: expect.stringContaining('1 s') })
  expect(db.moduleProgress.update).not.toHaveBeenCalled()
  db.moduleProgress.findUniqueOrThrow.mockResolvedValue({ id: moduleId, startedAt: new Date(now - 42000), completedAt: null })
  const finished = await app.inject({ method: 'POST', url: completeUrl, headers: headers() })
  expect(finished.statusCode).toBe(200)
  expect(finished.json().status).toBe('completed')
  vi.useRealTimers()
})

for (const [method, url] of [
  ['GET', '/api/v1/progress/trails/' + trailId],
  ['POST', '/api/v1/progress/modules/' + moduleId + '/start'],
  ['POST', completeUrl],
] as const) {
  describe(method + ' ' + url, () => {
    it('invalida o mesmo token na requisição seguinte à exclusão do usuário', async () => {
      expect((await app.inject({ method, url, headers: headers() })).statusCode).toBe(200)
      const queries = db.trail.findUnique.mock.calls.length
      const writes = db.moduleProgress.update.mock.calls.length + db.moduleProgress.upsert.mock.calls.length
      db.user.findUnique.mockResolvedValue(null)
      const r = await app.inject({ method, url, headers: headers() })
      expect(r.statusCode).toBe(401)
      expect(r.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
      expect(db.trail.findUnique).toHaveBeenCalledTimes(queries)
      expect(db.moduleProgress.update.mock.calls.length + db.moduleProgress.upsert.mock.calls.length).toBe(writes)
      expect(db.user.findUnique).toHaveBeenCalledTimes(2)
    })
    it('rejeita tokens ausentes, expirados e com segmentos extras antes de consultar o banco', async () => {
      const now = Date.now()
      vi.spyOn(Date, 'now').mockReturnValue(now - 2 * 24 * 60 * 60 * 1000)
      const expired = createSessionToken(userId)
      vi.restoreAllMocks()
      for (const value of [undefined, 'Bearer invalid', 'Bearer ' + token + '.extra', 'Bearer ' + expired]) {
        const r = await app.inject({ method, url, headers: value ? { authorization: value } : {} })
        expect(r.statusCode).toBe(401)
      }
      expect(db.user.findUnique).not.toHaveBeenCalled()
      expect(db.trail.findUnique).not.toHaveBeenCalled()
    })
  })
}

describe('integração do quiz', () => {
  it('não expõe mais o endpoint legado de respostas no progresso', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/v1/progress/modules/' + moduleId + '/quiz-attempts', headers: headers(), payload: { answers: [] } })
    expect(r.statusCode).toBe(404)
  })
  it('impede a conclusão sem pós-teste aprovado no servidor', async () => {
    requiresQuiz = true
    vi.spyOn(quiz, 'getQuizCompletionStatus').mockResolvedValue('not_approved')
    const r = await app.inject({ method: 'POST', url: completeUrl, headers: headers() })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toMatchObject({ code: 'QUIZ_REQUIRED' })
    expect(db.moduleProgress.update).not.toHaveBeenCalled()
  })
  it('não permite que aprovação enviada pelo cliente substitua a consulta no servidor', async () => {
    requiresQuiz = true
    vi.spyOn(quiz, 'getQuizCompletionStatus').mockResolvedValue('not_approved')
    const r = await app.inject({ method: 'POST', url: completeUrl, headers: headers(), payload: { approved: true, score: 100 } })
    expect(r.statusCode).toBe(409)
    expect(db.moduleProgress.update).not.toHaveBeenCalled()
  })
  it('conclui sem consultar o quiz quando o módulo não exige aprovação', async () => {
    const integration = vi.spyOn(quiz, 'getQuizCompletionStatus')
    expect((await app.inject({ method: 'POST', url: completeUrl, headers: headers() })).statusCode).toBe(200)
    expect(integration).not.toHaveBeenCalled()
  })

  it('expõe canReport no progresso da trilha', async () => {
    db.trail.findFirst.mockResolvedValue({
      modules: [{ id: moduleId, progressRecords: [{ completedAt: new Date() }] }],
    })
    const r = await app.inject({ method: 'GET', url: '/api/v1/progress/trails/' + trailId, headers: headers() })
    expect(r.statusCode).toBe(200)
    expect(r.json().canReport).toBe(true)
  })
  it('conclui quando o pós-teste está aprovado para o usuário e módulo', async () => {
    requiresQuiz = true
    const integration = vi.spyOn(quiz, 'getQuizCompletionStatus').mockResolvedValue('approved')
    expect((await app.inject({ method: 'POST', url: completeUrl, headers: headers() })).statusCode).toBe(200)
    expect(integration).toHaveBeenCalledWith({ userId, moduleId })
    expect(db.moduleProgress.update).toHaveBeenCalledTimes(1)
  })
  it('mantém o módulo em andamento quando o pós-teste não está aprovado', async () => {
    requiresQuiz = true
    vi.spyOn(quiz, 'getQuizCompletionStatus').mockResolvedValue('not_approved')
    const r = await app.inject({ method: 'POST', url: completeUrl, headers: headers() })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toMatchObject({ code: 'QUIZ_REQUIRED' })
    expect(db.moduleProgress.update).not.toHaveBeenCalled()
  })
  it('credita o convite ao concluir o módulo 0 e alimenta o ranking do bairro', async () => {
    const inviterId = '22222222-2222-4222-8222-222222222222'
    const attributionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    db.inviteAttribution.findUnique.mockResolvedValue({
      id: attributionId,
      inviterId,
      module0CompletedAt: null,
      pointsAwarded: 0,
    })
    db.inviteAttribution.count.mockResolvedValue(0)
    db.inviteAttribution.update.mockResolvedValue({})
    db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      const values: Record<string, number> = {
        module_completion: 2,
        module_quiz: 0,
        post_test_improvement: 6,
        training_completion: 3,
        quiz_pass_score: 80,
        training_modules_daily: 2,
        training_points_daily: 4,
        module_minimum_time: 70,
        post_test_improvement_awards: 1,
        final_exam: 10,
        final_exam_delay: 24,
        final_exam_awards: 1,
        invite_module0_reward: 50,
        invite_reward_limit: 10,
      }
      return {
        key: where.key,
        kind: ['module_completion', 'module_quiz', 'post_test_improvement', 'final_exam', 'training_completion'].includes(where.key) ? 'RULE' : 'LIMIT',
        value: values[where.key] ?? null,
        isActive: true,
      }
    })
    db.pointAccount.upsert.mockResolvedValue({ userId: inviterId, accumulated: 0, balance: 0 })
    db.pointAccount.update.mockResolvedValue({ userId: inviterId, accumulated: 50, balance: 50 })
    db.pointLedgerEntry.create.mockResolvedValue({ id: 'ledger-invite' })

    const r = await app.inject({ method: 'POST', url: completeUrl, headers: headers() })
    expect(r.statusCode).toBe(200)
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

  it('conclui 2 módulos no mesmo dia com teto 10 sem pointsCapped', async () => {
    const moduleA = moduleId
    const moduleB = '44444444-4444-4444-8444-444444444444'
    type AwardRow = {
      id: string
      userId: string
      ruleKey: string
      sourceId: string
      points: number
      grantedAt: Date | null
      createdAt: Date
    }
    const awards: AwardRow[] = []
    const now = new Date()
    db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => ({
      key: where.key,
      kind: ['module_completion', 'training_completion', 'module_quiz', 'post_test_improvement', 'final_exam'].includes(where.key)
        ? 'RULE'
        : 'LIMIT',
      value: ({
        module_completion: 2,
        training_completion: 3,
        training_modules_daily: 2,
        training_points_daily: 10,
        module_minimum_time: 0,
      } as Record<string, number>)[where.key] ?? 0,
      isActive: where.key === 'module_minimum_time' ? false : true,
    }))
    db.learningAward.create.mockImplementation(async ({ data }: { data: Omit<AwardRow, 'id' | 'createdAt' | 'grantedAt'> & { grantedAt?: Date | null } }) => {
      const row: AwardRow = {
        ...data,
        id: `a${awards.length}`,
        createdAt: now,
        grantedAt: data.grantedAt ?? null,
      }
      awards.push(row)
      return row
    })
    db.learningAward.findMany.mockImplementation(async ({ where }: { where: { grantedAt: null | { gte: Date; lt: Date }; ruleKey?: { in: string[] }; points?: { gt: number } } }) => {
      const keys = where.ruleKey?.in
      return awards.filter((row) => {
        if (keys && !keys.includes(row.ruleKey)) return false
        if (where.grantedAt === null) return !row.grantedAt
        if (where.points?.gt != null && !(row.points > where.points.gt)) return false
        return Boolean(row.grantedAt && row.grantedAt >= where.grantedAt.gte && row.grantedAt < where.grantedAt.lt)
      })
    })
    db.learningAward.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: { grantedAt: Date } }) => {
      const row = awards.find((item) => item.id === where.id)!
      row.grantedAt = data.grantedAt
      return row
    })
    db.learningAward.findUnique.mockImplementation(async ({ where }: { where: { userId_ruleKey_sourceId: { sourceId: string; ruleKey: string } } }) => {
      const row = awards.find(
        (item) =>
          item.ruleKey === where.userId_ruleKey_sourceId.ruleKey &&
          item.sourceId === where.userId_ruleKey_sourceId.sourceId,
      )
      return row ? { id: row.id, points: row.points, grantedAt: row.grantedAt } : null
    })
    db.pointAccount.upsert.mockResolvedValue({ userId, accumulated: 0, balance: 0 })
    db.pointAccount.update.mockResolvedValue({ userId, accumulated: 1, balance: 1 })
    db.pointLedgerEntry.create.mockResolvedValue({ id: 'ledger' })
    db.pointLedgerEntry.findFirst.mockResolvedValue(null)

    for (const id of [moduleA, moduleB]) {
      db.trailModule.findUnique.mockResolvedValueOnce({
        id,
        trailId,
        isActive: true,
        requiresQuiz: false,
        durationMinutes: 1,
        content: 'ok',
        trainingSteps: [],
      })
      db.trail.findUnique.mockResolvedValueOnce({
        id: trailId,
        modules: [
          { id: moduleA, title: 'A', order: 1, requiresQuiz: false, progressRecords: [{ startedAt: now, completedAt: id === moduleB ? now : null }] },
          { id: moduleB, title: 'B', order: 2, requiresQuiz: false, progressRecords: id === moduleB ? [{ startedAt: now, completedAt: null }] : [] },
        ],
      })
      db.moduleProgress.findUnique.mockResolvedValueOnce({ id })
      db.moduleProgress.findUniqueOrThrow.mockResolvedValueOnce({
        id,
        startedAt: new Date(now.getTime() - 3_600_000),
        completedAt: null,
      })
      db.moduleProgress.update.mockResolvedValueOnce({ completedAt: now })
      // Prefill training award so completeModule only queues module_completion (3+2)×2 = 10
      await db.learningAward.create({
        data: { userId, ruleKey: 'training_completion', sourceId: id, points: 3, moduleId: id, trailId },
      })
      const response = await app.inject({ method: 'POST', url: `/api/v1/progress/modules/${id}/complete`, headers: headers() })
      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({ status: 'completed', pointsCapped: false, capReason: null })
    }
    expect(awards.filter((row) => row.ruleKey === 'module_completion' && row.grantedAt)).toHaveLength(2)
    expect(awards.filter((row) => row.ruleKey === 'training_completion' && row.grantedAt)).toHaveLength(2)
  })
})
