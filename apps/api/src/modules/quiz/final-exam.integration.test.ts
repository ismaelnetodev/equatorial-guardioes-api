import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'
import { Prisma } from '../../generated/prisma/client.js'

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() }, trail: { findUnique: vi.fn() },
  programConfiguration: { findUnique: vi.fn() },
  learningAward: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
  pointLedgerEntry: { findFirst: vi.fn(), create: vi.fn() },
  pointAccount: { upsert: vi.fn(), update: vi.fn() },
  finalExamAttempt: { findFirst: vi.fn(), create: vi.fn() }, $transaction: vi.fn(),
}))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))
const userId = '11111111-1111-4111-8111-111111111111'
const trailId = '22222222-2222-4222-8222-222222222222'
const uuid = (index: number) => '33333333-3333-4333-8333-' + String(index).padStart(12, '0')
const questions = Array.from({ length: 10 }, (_, index) => ({ id: uuid(index), statement: 'Pergunta', order: index + 1, imageUrl: null, options: [{ id: uuid(index + 10), text: 'Certo', isCorrect: true }, { id: uuid(index + 20), text: 'Errado', isCorrect: false }] }))
let settings: Record<string, { value: number | null; isActive: boolean }>
let completedAt: Date | null
let app: FastifyInstance
const headers = () => ({ authorization: 'Bearer ' + createSessionToken(userId) })
const url = '/api/v1/trails/' + trailId + '/final-exam'
const submit = (correct = 10) => app.inject({ method: 'POST', url, headers: headers(), payload: { answers: questions.map((question, index) => ({ questionId: question.id, optionId: question.options[index < correct ? 0 : 1]!.id })) } })

beforeEach(async () => {
  vi.resetAllMocks()
  settings = {}
  completedAt = new Date(Date.now() - 48 * 3600000)
  db.user.findUnique.mockResolvedValue({ id: userId, role: 'USER' })
  db.trail.findUnique.mockImplementation(async () => ({ modules: [{ progressRecords: [{ completedAt }], quizQuestions: questions }] }))
  db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => ({ key: where.key, kind: where.key === 'final_exam' ? 'RULE' : 'LIMIT', value: ({ final_exam: 10, final_exam_delay: 24, final_exam_awards: 1, quiz_pass_score: 80 } as Record<string, number>)[where.key] ?? null, isActive: true, ...settings[where.key] }))
  db.learningAward.findUnique.mockResolvedValue(null)
  db.learningAward.count.mockResolvedValue(0)
  db.finalExamAttempt.findFirst.mockResolvedValue(null)
  db.finalExamAttempt.create.mockResolvedValue({ id: uuid(99) })
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db))
  app = await buildApp({ logger: false })
})
afterEach(async () => { await app.close() })

it('exige autenticação na consulta e no envio', async () => {
  expect((await app.inject({ url })).statusCode).toBe(401)
  expect((await app.inject({ method: 'POST', url, payload: { answers: [{ questionId: uuid(1), optionId: uuid(11) }] } })).statusCode).toBe(401)
  expect(db.trail.findUnique).not.toHaveBeenCalled()
})
it('consulta somente a trilha publicada e não expõe gabarito', async () => {
  const response = await app.inject({ url, headers: headers() })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toMatchObject({ totalCount: 10, minimumCorrect: 8 })
  expect(response.body).not.toContain('isCorrect')
  expect(db.trail.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: trailId, publicationStatus: 'PUBLISHED' }) }))
})
it('bloqueia antes da conclusão e durante a espera', async () => {
  completedAt = null
  expect((await submit()).statusCode).toBe(409)
  completedAt = new Date()
  expect((await submit()).statusCode).toBe(409)
  expect(db.finalExamAttempt.create).not.toHaveBeenCalled()
})
it('reprova 7/10 e concede a prova final somente após aprovação', async () => {
  expect((await submit(7)).json()).toMatchObject({ isApproved: false, pointsAwarded: 0, minimumCorrect: 8 })
  expect(db.learningAward.create).not.toHaveBeenCalled()
  expect((await submit(8)).json()).toMatchObject({ isApproved: true, pointsAwarded: 10 })
  expect(db.pointLedgerEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId, delta: 10, sourceType: 'LearningAward' }) })
  expect(db.pointAccount.update).toHaveBeenCalledWith(expect.objectContaining({ data: { balance: { increment: 10 }, accumulated: { increment: 10 } } }))
  expect(db.learningAward.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId, ruleKey: 'final_exam', sourceId: trailId, trailId, points: 10 }) }))
  expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
})
it('reflete valor e ativação da regra administrativa', async () => {
  settings.final_exam = { value: 17, isActive: true }
  expect((await submit()).json()).toMatchObject({ pointsAwarded: 17 })
  settings.final_exam.isActive = false
  expect((await submit()).json()).toMatchObject({ pointsAwarded: 0 })
})
it('não repete a concessão por usuário e trilha', async () => {
  db.learningAward.count.mockResolvedValue(1)
  expect((await submit()).json()).toMatchObject({ isApproved: true, pointsAwarded: 0 })
  expect(db.learningAward.create).not.toHaveBeenCalled()
})
it('bloqueia nova tentativa com intervalo pendente', async () => {
  db.finalExamAttempt.findFirst.mockResolvedValue({ submittedAt: new Date() })
  const response = await submit()
  expect(response.statusCode).toBe(409)
  expect(response.json().code).toBe('LEARNING_CONFIGURATION_PENDING')
})
it('não concede pontos em conflito concorrente', async () => {
  db.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: '7.10.1' }))
  expect((await submit()).statusCode).toBe(409)
  expect(db.learningAward.create).not.toHaveBeenCalled()
})
it('rejeita respostas repetidas sem gravar', async () => {
  const response = await app.inject({ method: 'POST', url, headers: headers(), payload: { answers: Array.from({ length: 10 }, () => ({ questionId: questions[0]!.id, optionId: questions[0]!.options[0]!.id })) } })
  expect(response.statusCode).toBe(422)
  expect(db.finalExamAttempt.create).not.toHaveBeenCalled()
})
