import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'

const q1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const q2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const o1Correct = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const o1Wrong = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const o2Correct = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const o2Wrong = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
const attemptId = '99999999-9999-4999-8999-999999999999'
const progressRecordId = '88888888-8888-4888-8888-888888888888'

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  trail: { findUnique: vi.fn() },
  trailModule: { findUnique: vi.fn() },
  moduleProgress: { findUnique: vi.fn(), update: vi.fn() },
  quizAttempt: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  quizAnswer: { create: vi.fn() },
  trainingStep: { findMany: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))

const userId = '11111111-1111-4111-8111-111111111111'
const trailId = '22222222-2222-4222-8222-222222222222'
const moduleId = '33333333-3333-4333-8333-333333333333'
let app: FastifyInstance
let token: string
let preCompleted: boolean
let trainingCompleted: boolean
let openPostAnswers: Array<{ questionId: string; optionId: string; isCorrect: boolean }>

const headers = () => ({ authorization: 'Bearer ' + token })
const questions = [
  {
    id: q1,
    statement: 'Pergunta 1',
    order: 1,
    explanationTitle: 'Quase! Evite o risco.',
    explanationBody: 'Afaste-se e avise a equipe técnica.',
    imageUrl: null,
    options: [
      { id: o1Correct, text: 'Certo', isCorrect: true },
      { id: o1Wrong, text: 'Errado', isCorrect: false },
    ],
  },
  {
    id: q2,
    statement: 'Pergunta 2',
    order: 2,
    explanationTitle: 'Boa escolha.',
    explanationBody: 'Fotografar de longe é o caminho seguro.',
    imageUrl: null,
    options: [
      { id: o2Correct, text: 'Certo', isCorrect: true },
      { id: o2Wrong, text: 'Errado', isCorrect: false },
    ],
  },
]

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
  token = createSessionToken(userId)
  preCompleted = true
  trainingCompleted = true
  openPostAnswers = []
  db.user.findUnique.mockResolvedValue({ id: userId, role: 'USER' })
  db.trailModule.findUnique.mockImplementation(async () => ({
    id: moduleId,
    trailId,
    isActive: true,
    requiresQuiz: true,
    quizMinimumScore: 0.7,
    quizQuestions: questions,
  }))
  db.trail.findUnique.mockImplementation(async () => ({
    id: trailId,
    modules: [{
      id: moduleId,
      title: 'Módulo',
      order: 1,
      requiresQuiz: true,
      progressRecords: [{ startedAt: new Date(), completedAt: null }],
    }],
  }))
  db.moduleProgress.findUnique.mockImplementation(async () => ({
    id: progressRecordId,
    startedAt: new Date(),
    completedAt: null,
    preTestCompletedAt: preCompleted ? new Date() : null,
    trainingCompletedAt: trainingCompleted ? new Date() : null,
    trainingPointsAwarded: trainingCompleted ? 10 : 0,
  }))
  db.moduleProgress.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: progressRecordId,
    trainingPointsAwarded: data['trainingPointsAwarded'] ?? 10,
    completedAt: data['completedAt'] instanceof Date ? data['completedAt'] : new Date(),
  }))
  db.trainingStep.findMany.mockResolvedValue([
    {
      id: '77777777-7777-4777-8777-777777777777',
      title: 'Reconheça os sinais',
      kind: 'RECOGNIZE',
      order: 1,
      durationMinutes: 3,
      introText: null,
      cards: [{ id: '66666666-6666-4666-8666-666666666666', title: 'Poste inclinado', description: 'Pende para um lado.', order: 1 }],
    },
  ])
  db.quizAttempt.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    if (where['finishedAt'] === null) {
      return { id: attemptId, correctCount: 0, totalCount: 2, answers: openPostAnswers }
    }
    if (where['phase'] === 'PRE') {
      return { id: attemptId, correctCount: 1, totalCount: 2, score: 0.5, isApproved: true, pointsAwarded: 5, finishedAt: new Date(), submittedAt: new Date() }
    }
    if (where['phase'] === 'POST' && where['isApproved'] === true) {
      return { id: attemptId, correctCount: 2, totalCount: 2, score: 1, isApproved: true, pointsAwarded: 20, finishedAt: new Date(), submittedAt: new Date() }
    }
    if (where['phase'] === 'POST') {
      return { id: attemptId, correctCount: 2, totalCount: 2, score: 1, isApproved: true, pointsAwarded: 20, finishedAt: new Date(), submittedAt: new Date() }
    }
    return null
  })
  db.quizAttempt.create.mockImplementation(async () => ({ id: attemptId, correctCount: 0, totalCount: 2, answers: [] }))
  db.quizAttempt.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: attemptId,
    correctCount: data['correctCount'],
    totalCount: data['totalCount'],
    isApproved: data['isApproved'],
    pointsAwarded: data['pointsAwarded'],
  }))
  db.quizAnswer.create.mockResolvedValue({ id: '55555555-5555-4555-8555-555555555555' })
  db.$transaction.mockImplementation(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db))
  app = await buildApp({ logger: false })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await app.close()
})

describe('pré-teste', () => {
  it('não vaza gabarito ao listar perguntas', async () => {
    const r = await app.inject({ method: 'GET', url: `/api/v1/modules/${moduleId}/quiz/pre`, headers: headers() })
    expect(r.statusCode).toBe(200)
    const body = r.json()
    expect(body.questions).toHaveLength(2)
    expect(JSON.stringify(body)).not.toContain('isCorrect')
    expect(JSON.stringify(body)).not.toContain('explanationTitle')
  })

  it('registra o pré-teste sem devolver gabarito e concede pontos', async () => {
    preCompleted = false
    trainingCompleted = false
    db.quizAttempt.create.mockResolvedValue({ id: attemptId, correctCount: 1, totalCount: 2, pointsAwarded: 5 })
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${moduleId}/quiz/pre`,
      headers: headers(),
      payload: {
        answers: [
          { questionId: q1, optionId: o1Correct },
          { questionId: q2, optionId: o2Wrong },
        ],
      },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      correctCount: 1,
      totalCount: 2,
      pointsAwarded: 5,
      hint: 'As respostas certas aparecem só no pós-teste.',
    })
    expect(JSON.stringify(r.json())).not.toContain('isCorrect')
    expect(JSON.stringify(r.json())).not.toContain(o1Correct)
  })
})

describe('ordem das etapas', () => {
  it('bloqueia o treinamento sem pré-teste', async () => {
    preCompleted = false
    trainingCompleted = false
    const r = await app.inject({ method: 'GET', url: `/api/v1/modules/${moduleId}/training`, headers: headers() })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toMatchObject({ code: 'PRE_TEST_REQUIRED' })
  })

  it('bloqueia o pós-teste sem treinamento', async () => {
    trainingCompleted = false
    const r = await app.inject({ method: 'GET', url: `/api/v1/modules/${moduleId}/quiz/pos`, headers: headers() })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toMatchObject({ code: 'TRAINING_REQUIRED' })
  })
})

describe('pós-teste', () => {
  it('explica a resposta sem culpar e marca feedback semântico', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${moduleId}/quiz/pos/answers`,
      headers: headers(),
      payload: { questionId: q1, optionId: o1Wrong },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      isCorrect: false,
      feedbackKind: 'incorrect',
      correctOptionId: o1Correct,
      selectedOptionId: o1Wrong,
      feedback: {
        title: 'Quase! Evite o risco.',
        body: 'Afaste-se e avise a equipe técnica.',
      },
    })
    expect(JSON.stringify(r.json()).toLowerCase()).not.toContain('vermelho')
  })

  it('aprova com nota mínima de 70%', async () => {
    openPostAnswers = [
      { questionId: q1, optionId: o1Correct, isCorrect: true },
      { questionId: q2, optionId: o2Correct, isCorrect: true },
    ]
    const r = await app.inject({ method: 'POST', url: `/api/v1/modules/${moduleId}/quiz/pos/finish`, headers: headers() })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      isApproved: true,
      correctCount: 2,
      totalCount: 2,
      minimumCorrect: 2,
      pointsAwarded: 20,
    })
  })

  it('reprova abaixo da nota mínima e sugere revisar o treino', async () => {
    openPostAnswers = [
      { questionId: q1, optionId: o1Wrong, isCorrect: false },
      { questionId: q2, optionId: o2Wrong, isCorrect: false },
    ]
    const r = await app.inject({ method: 'POST', url: `/api/v1/modules/${moduleId}/quiz/pos/finish`, headers: headers() })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      isApproved: false,
      correctCount: 0,
      minimumCorrect: 2,
      title: 'Quase lá!',
    })
    expect(r.json().reviewHint).toContain('NÃO fazer')
  })
})

describe('conclusão do módulo', () => {
  it('permite concluir após pós-teste aprovado', async () => {
    db.quizAttempt.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where['phase'] === 'POST' && where['isApproved'] === true) {
        return { id: attemptId }
      }
      return null
    })
    const r = await app.inject({ method: 'POST', url: `/api/v1/progress/modules/${moduleId}/complete`, headers: headers() })
    expect(r.statusCode).toBe(200)
    expect(db.moduleProgress.update).toHaveBeenCalled()
  })

  it('impede concluir sem pós-teste aprovado', async () => {
    db.quizAttempt.findFirst.mockResolvedValue(null)
    const r = await app.inject({ method: 'POST', url: `/api/v1/progress/modules/${moduleId}/complete`, headers: headers() })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toMatchObject({ code: 'QUIZ_REQUIRED' })
  })
})
