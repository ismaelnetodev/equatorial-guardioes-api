import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() }, trail: { findUnique: vi.fn() },
  finalExamAttempt: { findFirst: vi.fn() }, programConfiguration: { findUnique: vi.fn() },
  trailCertificate: { findUnique: vi.fn(), create: vi.fn() }, $transaction: vi.fn(),
}))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))
const userId = '11111111-1111-4111-8111-111111111111'
const trailId = '22222222-2222-4222-8222-222222222222'
const id = '33333333-3333-4333-8333-333333333333'
const base = '/api/v1/trails/' + trailId
let completedAt: Date | null
let approved: boolean
let active: boolean
let app: FastifyInstance
beforeEach(async () => {
  vi.resetAllMocks()
  completedAt = new Date(Date.now() - 48 * 3600000); approved = false; active = true
  db.user.findUnique.mockResolvedValue({ id: userId, role: 'USER' })
  db.user.findUniqueOrThrow.mockResolvedValue({ name: 'Guardião Teste' })
  db.trail.findUnique.mockImplementation(async () => ({ id: trailId, title: 'Trilha', modules: [{ id, progressRecords: [{ completedAt }], _count: { quizQuestions: 3 } }] }))
  db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => ({ key: where.key, kind: where.key === 'certificate' ? 'REWARD' : 'LIMIT', value: ({ final_exam_delay: 24, quiz_pass_score: 80, quiz_retry_interval: 30 } as Record<string, number>)[where.key] ?? null, isActive: where.key === 'certificate' ? active : true }))
  db.finalExamAttempt.findFirst.mockImplementation(async () => approved ? { id, submittedAt: new Date(), isApproved: true, correctCount: 3, totalCount: 3, minimumCorrect: 3, pointsAwarded: 10 } : null)
  db.trailCertificate.findUnique.mockResolvedValue(null)
  db.trailCertificate.create.mockImplementation(async ({ data }: { data: object }) => ({ id, ...data, issuedAt: new Date() }))
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db))
  app = await buildApp({ logger: false })
})
afterEach(async () => { await app.close() })
const headers = () => ({ authorization: 'Bearer ' + createSessionToken(userId) })
const issue = () => app.inject({ method: 'POST', url: base + '/certificate', headers: headers() })
const state = () => app.inject({ url: base + '/completion', headers: headers() })
it('exige autenticação para consultar conclusão e emitir certificado', async () => {
  expect((await app.inject({ url: base + '/completion' })).statusCode).toBe(401)
  expect((await app.inject({ method: 'POST', url: base + '/certificate' })).statusCode).toBe(401)
  expect(db.trail.findUnique).not.toHaveBeenCalled()
})
it('informa módulos pendentes, espera de 24 horas e prova disponível', async () => {
  completedAt = null
  expect((await state()).json().finalExam.status).toBe('MODULES_PENDING')
  completedAt = new Date()
  expect((await state()).json().finalExam.status).toBe('WAITING')
  completedAt = new Date(Date.now() - 24 * 3600000)
  expect((await state()).json().finalExam.status).toBe('AVAILABLE')
})
it('não emite apenas por concluir módulos e não usa saldo como critério', async () => {
  expect((await issue()).statusCode).toBe(409)
  approved = true
  const response = await issue()
  expect(response.statusCode).toBe(200)
  expect(response.json()).toMatchObject({ holderName: 'Guardião Teste', trailTitle: 'Trilha', badge: 'Guardião da Energia' })
  expect(db.trailCertificate.create).toHaveBeenCalledWith({ data: { userId, trailId, holderName: 'Guardião Teste', trailTitle: 'Trilha' } })
})
it('exige todos os módulos mesmo se existir aprovação de uma versão antiga', async () => {
  approved = true; completedAt = null
  expect((await issue()).statusCode).toBe(409)
  expect(db.trailCertificate.create).not.toHaveBeenCalled()
})
it('respeita ativação do certificado e preserva certificados já emitidos', async () => {
  approved = true; active = false
  expect((await issue()).statusCode).toBe(409)
  db.trailCertificate.findUnique.mockResolvedValue({ id, holderName: 'Nome original', trailTitle: 'Título original', issuedAt: new Date('2026-10-17T12:00:00Z') })
  expect((await issue()).json()).toMatchObject({ id, holderName: 'Nome original', trailTitle: 'Título original', issuedAt: '2026-10-17T12:00:00.000Z' })
  expect(db.trailCertificate.create).not.toHaveBeenCalled()
})
