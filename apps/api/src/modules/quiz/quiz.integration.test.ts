import { Prisma } from '../../generated/prisma/client.js'
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
  trail: { findUnique: vi.fn(), findFirst: vi.fn() },
  trailModule: { findUnique: vi.fn() },
  programConfiguration: { findUnique: vi.fn() },
  learningAward: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  moduleProgress: { findUniqueOrThrow: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  quizAttempt: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  quizAnswer: { create: vi.fn() },
  trainingStep: { findMany: vi.fn() },
  pointAccount: { upsert: vi.fn(), update: vi.fn() },
  pointLedgerEntry: { create: vi.fn(), findFirst: vi.fn() },
  inviteAttribution: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
  programConfiguration: { findUnique: vi.fn() },
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
let settings: Record<string, { value: number | null; isActive: boolean }>
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
  settings = {}
  db.user.findUnique.mockResolvedValue({ id: userId, role: 'USER' })
  db.trailModule.findUnique.mockImplementation(async () => ({
    id: moduleId,
    trailId,
    isActive: true,
    requiresQuiz: true,
    quizMinimumScore: 0.7,
    durationMinutes: 3,
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
    trainingPointsAwarded: 0,
  }))
  db.moduleProgress.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: progressRecordId,
    trainingPointsAwarded: data['trainingPointsAwarded'] ?? 0,
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
      return { id: attemptId, correctCount: 1, totalCount: 2, score: 0.5, isApproved: true, pointsAwarded: 0, finishedAt: new Date(), submittedAt: new Date() }
    }
    if (where['phase'] === 'POST' && where['finishedAt'] !== null) {
      return { id: attemptId, correctCount: 2, totalCount: 2, score: 1, isApproved: true, pointsAwarded: 6, finishedAt: new Date(), submittedAt: new Date() }
    }
    if (where['phase'] === 'POST') {
      return { id: attemptId, correctCount: 2, totalCount: 2, score: 1, isApproved: true, pointsAwarded: 6, finishedAt: new Date(), submittedAt: new Date() }
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
  db.pointAccount.upsert.mockResolvedValue({ userId, accumulated: 0, balance: 0 })
  db.pointAccount.update.mockResolvedValue({ userId, accumulated: 5, balance: 5 })
  db.pointLedgerEntry.create.mockResolvedValue({ id: '66666666-6666-4666-8666-666666666666' })
  db.pointLedgerEntry.findFirst.mockResolvedValue(null)
  db.trail.findFirst.mockResolvedValue({ modules: [{ id: moduleId }] })
  db.inviteAttribution.findUnique.mockResolvedValue(null)
  db.$transaction.mockImplementation(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db))
  db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => ({
    key: where.key, kind: ['module_completion', 'module_quiz', 'post_test_improvement', 'final_exam'].includes(where.key) ? 'RULE' : 'LIMIT',
    value: ({ module_completion: 2, module_quiz: 0, post_test_improvement: 6, quiz_pass_score: 80, training_modules_daily: 2, training_points_daily: 4, module_minimum_time: 70, post_test_improvement_awards: 1, final_exam: 10, final_exam_delay: 24, final_exam_awards: 1 } as Record<string, number>)[where.key] ?? null,
    isActive: true,
    ...settings[where.key],
  }))
  db.learningAward.findMany.mockResolvedValue([])
  db.learningAward.findUnique.mockResolvedValue(null)
  db.learningAward.count.mockResolvedValue(0)
  db.moduleProgress.findUniqueOrThrow.mockImplementation(async () => ({ id: '88888888-8888-4888-8888-888888888888', startedAt: new Date(Date.now() - 3600000), completedAt: null, preTestCompletedAt: preCompleted ? new Date() : null, trainingCompletedAt: null }))
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

  it('registra o pré-teste sem devolver gabarito e sem conceder pontos', async () => {
    preCompleted = false
    trainingCompleted = false
    db.quizAttempt.create.mockResolvedValue({ id: attemptId, correctCount: 1, totalCount: 2, pointsAwarded: 0 })
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
      pointsAwarded: 0,
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
      payload: { attemptId, questionId: q1, optionId: o1Wrong },
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

  it('aprova com o percentual administrativo de 80%', async () => {
    openPostAnswers = [
      { questionId: q1, optionId: o1Correct, isCorrect: true },
      { questionId: q2, optionId: o2Correct, isCorrect: true },
    ]
    const r = await app.inject({ method: 'POST', url: `/api/v1/modules/${moduleId}/quiz/pos/finish`, headers: headers(), payload: { attemptId } })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      isApproved: true,
      correctCount: 2,
      totalCount: 2,
      minimumCorrect: 2,
      pointsAwarded: 6,
    })
  })

  it('reprova abaixo da nota mínima e sugere revisar o treino', async () => {
    openPostAnswers = [
      { questionId: q1, optionId: o1Wrong, isCorrect: false },
      { questionId: q2, optionId: o2Wrong, isCorrect: false },
    ]
    const r = await app.inject({ method: 'POST', url: `/api/v1/modules/${moduleId}/quiz/pos/finish`, headers: headers(), payload: { attemptId } })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      isApproved: false,
      correctCount: 0,
      minimumCorrect: 2,
      title: 'Quase lá!',
    })
    expect(r.json().reviewHint).toContain('Revise o treinamento')
  })
})

describe('conclusão do módulo', () => {
  it('permite concluir após pós-teste aprovado', async () => {
    db.quizAttempt.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where['phase'] === 'POST' && where['finishedAt'] !== null) {
        return { id: attemptId }
      }
      return null
    })
    const r = await app.inject({ method: 'POST', url: `/api/v1/progress/modules/${moduleId}/complete`, headers: headers() })
    expect(r.statusCode).toBe(200)
    expect(db.moduleProgress.update).toHaveBeenCalled()
    expect(db.quizAttempt.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ score: { gte: 0.8 } }) }))
  })

  it('impede concluir sem pós-teste aprovado', async () => {
    db.quizAttempt.findFirst.mockResolvedValue(null)
    const r = await app.inject({ method: 'POST', url: `/api/v1/progress/modules/${moduleId}/complete`, headers: headers() })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toMatchObject({ code: 'QUIZ_REQUIRED' })
  })
})

describe('configuração v2 do aprendizado', () => {
  const finish = () => app.inject({ method: 'POST', url: '/api/v1/modules/' + moduleId + '/quiz/pos/finish', headers: headers(), payload: { attemptId } })
  const tenQuestions = (correct: number) => {
    db.trailModule.findUnique.mockResolvedValue({ id: moduleId, trailId, isActive: true, requiresQuiz: true, quizMinimumScore: 0.7, quizQuestions: Array.from({ length: 10 }, (_, index) => ({ ...questions[0], id: String(index) })) })
    openPostAnswers = Array.from({ length: 10 }, (_, index) => ({ questionId: String(index), optionId: o1Correct, isCorrect: index < correct }))
  }
  it('reprova 7/10 apesar do limiar legado de 70% no módulo', async () => {
    tenQuestions(7)
    const response = await finish()
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ isApproved: false, minimumCorrect: 8, pointsAwarded: 6 })
    expect(db.quizAttempt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ minimumCorrect: 8, pointsAwarded: 6 }) }))
    expect(db.learningAward.create).toHaveBeenCalledTimes(1)
    expect(db.learningAward.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ruleKey: 'post_test_improvement', sourceId: 'once', points: 6 }) }))
  })
  it('reflete alterações do percentual e dos pontos administrativos', async () => {
    tenQuestions(8)
    settings.quiz_pass_score = { value: 90, isActive: true }
    settings.post_test_improvement = { value: 3, isActive: true }
    expect((await finish()).json()).toMatchObject({ isApproved: false, minimumCorrect: 9, pointsAwarded: 3 })
  })
  it('não pontua melhoria quando a regra está desativada', async () => {
    tenQuestions(10)
    settings.post_test_improvement = { value: 6, isActive: false }
    expect((await finish()).json()).toMatchObject({ isApproved: true, pointsAwarded: 0 })
    expect(db.learningAward.create).not.toHaveBeenCalled()
  })
  it('não pontua novamente uma melhoria já concedida', async () => {
    tenQuestions(10)
    db.learningAward.findUnique.mockResolvedValue({ points: 6 })
    expect((await finish()).json()).toMatchObject({ pointsAwarded: 0 })
    expect(db.learningAward.create).not.toHaveBeenCalled()
  })
  it('não pontua quando não houve melhoria mensurável', async () => {
    tenQuestions(4)
    expect((await finish()).json()).toMatchObject({ pointsAwarded: 0 })
    expect(db.learningAward.create).not.toHaveBeenCalled()
  })
  it('aplica regra configurável do quiz sem repeti-la por módulo', async () => {
    tenQuestions(10)
    settings.module_quiz = { value: 4, isActive: true }
    settings.post_test_improvement = { value: 6, isActive: false }
    expect((await finish()).json()).toMatchObject({ pointsAwarded: 4 })
    expect(db.learningAward.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ruleKey: 'module_quiz', sourceId: moduleId, points: 4 }) }))
  })
  it('conclui treinamento sem pontos', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/modules/' + moduleId + '/training/complete', headers: headers() })
    expect(response.json()).toMatchObject({ completed: true, pointsAwarded: 0 })
    expect(db.learningAward.create).not.toHaveBeenCalled()
  })
  it('não permite substituir o pré-teste inicial', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/modules/' + moduleId + '/quiz/pre', headers: headers(), payload: { answers: [{ questionId: q1, optionId: o1Correct }, { questionId: q2, optionId: o2Correct }] } })
    expect(response.statusCode).toBe(409)
    expect(db.quizAttempt.create).not.toHaveBeenCalled()
  })
  it('bloqueia repetição quando o intervalo está pendente', async () => {
    db.quizAttempt.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => where.finishedAt === null ? null : { finishedAt: new Date() })
    const response = await app.inject({ url: '/api/v1/modules/' + moduleId + '/quiz/pos', headers: headers() })
    expect(response.statusCode).toBe(409)
    expect(response.json().code).toBe('LEARNING_CONFIGURATION_PENDING')
    expect(response.json().message).toBe('Esta etapa está temporariamente indisponível. Tente novamente mais tarde.')
    expect(response.body).not.toContain('quiz_retry_interval')
    expect(db.quizAttempt.create).not.toHaveBeenCalled()
  })
  it('mostra o tempo restante sem iniciar outra tentativa durante o intervalo', async () => {
    settings.quiz_retry_interval = { value: 30, isActive: true }
    db.quizAttempt.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => where.finishedAt === null ? null : { finishedAt: new Date() })
    const response = await app.inject({ url: '/api/v1/modules/' + moduleId + '/quiz/pos', headers: headers() })
    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'RETRY_NOT_AVAILABLE', message: expect.stringContaining('segundos para tentar novamente') })
    expect(db.quizAttempt.create).not.toHaveBeenCalled()
  })
  it('inicia nova tentativa após o intervalo de 30 segundos', async () => {
    settings.quiz_retry_interval = { value: 30, isActive: true }
    db.quizAttempt.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => where.finishedAt === null ? null : { finishedAt: new Date(Date.now() - 31000) })
    const response = await app.inject({ url: '/api/v1/modules/' + moduleId + '/quiz/pos', headers: headers() })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ phase: 'POST', answeredCount: 0 })
    expect(db.quizAttempt.create).toHaveBeenCalledOnce()
  })
  it('retorna reprovação explícita com dois de três acertos e mínimo administrativo de 80%', async () => {
    db.trailModule.findUnique.mockResolvedValue({ id: moduleId, trailId, isActive: true, requiresQuiz: true, quizQuestions: Array.from({ length: 3 }, (_, index) => ({ ...questions[0], id: String(index) })) })
    openPostAnswers = Array.from({ length: 3 }, (_, index) => ({ questionId: String(index), optionId: o1Correct, isCorrect: index < 2 }))
    const response = await finish()
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ correctCount: 2, totalCount: 3, minimumCorrect: 3, isApproved: false })
  })
})

describe('transação da tentativa contra edição concorrente', () => {
  it.each(['pre', 'pos', 'answer'] as const)('consulta perguntas e inicia %s na mesma transação serializável', async phase => {
    preCompleted = false
    if (phase !== 'pre') preCompleted = true
    // Somente consultas executadas pelo callback recebem um cliente funcional.
    const tx = { ...db, trailModule: { findUnique: vi.fn().mockResolvedValue({ id: moduleId, trailId, isActive: true, quizQuestions: questions }) } }
    db.trailModule.findUnique.mockRejectedValue(new Error('leitura fora da transação'))
    db.$transaction.mockImplementation(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx))
    // Primeira tentativa do pós-teste: não há anterior nem tentativa aberta.
    if (phase === 'pos') db.quizAttempt.findFirst.mockResolvedValue(null)
    db.quizAttempt.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: attemptId, ...data, answers: [] }))
    const response = phase === 'pos'
      ? await app.inject({ url: '/api/v1/modules/' + moduleId + '/quiz/pos', headers: headers() })
      : await app.inject({ method: 'POST', url: '/api/v1/modules/' + moduleId + (phase === 'pre' ? '/quiz/pre' : '/quiz/pos/answers'), headers: headers(), payload: phase === 'pre' ? { answers: [{ questionId: q1, optionId: o1Correct }, { questionId: q2, optionId: o2Correct }] } : { attemptId, questionId: q1, optionId: o1Correct } })
    expect(response.statusCode).toBe(200)
    expect(tx.trailModule.findUnique).toHaveBeenCalled()
    expect(db.trailModule.findUnique).not.toHaveBeenCalled()
    expect(db.quizAttempt.create).toHaveBeenCalledTimes(phase === 'answer' ? 0 : 1)
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
  })
  it.each(['P2034', 'P2003'])('traduz disputa com a edição (%s) para 409', async code => {
    db.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('conflito', { code, clientVersion: '7.10.1' }))
    const response = await app.inject({ url: '/api/v1/modules/' + moduleId + '/quiz/pos', headers: headers() })
    expect(response.statusCode).toBe(409)
    expect(response.json().code).toBe('LEARNING_CONFLICT')
    expect(db.quizAttempt.create).not.toHaveBeenCalled()
  })
})

describe('identidade e unicidade da tentativa de pós-teste', () => {
  const answer = (id = attemptId) => app.inject({ method: 'POST', url: '/api/v1/modules/' + moduleId + '/quiz/pos/answers', headers: headers(), payload: { attemptId: id, questionId: q1, optionId: o1Correct } })
  const finish = (id = attemptId) => app.inject({ method: 'POST', url: '/api/v1/modules/' + moduleId + '/quiz/pos/finish', headers: headers(), payload: { attemptId: id } })
  it.each(['answers', 'finish'])('exige attemptId em %s', async suffix => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/modules/' + moduleId + '/quiz/pos/' + suffix, headers: headers(), payload: suffix === 'answers' ? { questionId: q1, optionId: o1Correct } : {} })
    expect(response.statusCode).toBe(400)
    expect(db.quizAttempt.create).not.toHaveBeenCalled()
    expect(db.quizAnswer.create).not.toHaveBeenCalled()
    expect(db.quizAttempt.update).not.toHaveBeenCalled()
  })
  it('associa a resposta ao ID exibido, sem procurar ou criar outra tentativa', async () => {
    const response = await answer()
    expect(response.statusCode).toBe(200)
    expect(response.json().attemptId).toBe(attemptId)
    expect(db.quizAttempt.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: attemptId, progressId: progressRecordId, phase: 'POST', finishedAt: null, supersededAt: null } }))
    expect(db.quizAnswer.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ attemptId }) }))
    expect(db.quizAttempt.create).not.toHaveBeenCalled()
  })
  it('finaliza somente o ID enviado pelo cliente', async () => {
    openPostAnswers = [{ questionId: q1, optionId: o1Correct, isCorrect: true }, { questionId: q2, optionId: o2Correct, isCorrect: true }]
    expect((await finish()).statusCode).toBe(200)
    expect(db.quizAttempt.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: attemptId, progressId: progressRecordId, phase: 'POST', finishedAt: null, supersededAt: null } }))
    expect(db.quizAttempt.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: attemptId } }))
  })
  it.each(['encerrada', 'outro usuário', 'outro módulo', 'pré-teste', 'reconciliada'])('recusa tentativa %s sem criar substituta', async kind => {
    const row = { id: attemptId, progressId: kind === 'outro usuário' || kind === 'outro módulo' ? moduleId : progressRecordId, phase: kind === 'pré-teste' ? 'PRE' : 'POST', finishedAt: kind === 'encerrada' ? new Date() : null, supersededAt: kind === 'reconciliada' ? new Date() : null }
    db.quizAttempt.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => Object.entries(where).every(([key, value]) => row[key as keyof typeof row] === value) ? { ...row, answers: [] } : null)
    expect((await answer()).statusCode).toBe(404)
    expect((await finish()).statusCode).toBe(404)
    expect(db.quizAttempt.create).not.toHaveBeenCalled()
    expect(db.quizAnswer.create).not.toHaveBeenCalled()
    expect(db.quizAttempt.update).not.toHaveBeenCalled()
  })
  it('trata duas aberturas simultâneas sem aceitar uma segunda tentativa', async () => {
    let reads = 0
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    let stored: { id: string; correctCount: number; totalCount: number; answers: [] } | null = null
    db.quizAttempt.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.finishedAt !== null) return null
      if (stored) return stored
      reads++
      if (reads === 2) release()
      await barrier
      return null
    })
    db.quizAttempt.create.mockImplementation(async () => {
      if (stored) throw new Prisma.PrismaClientKnownRequestError('one_open_post', { code: 'P2002', clientVersion: '7.10.1' })
      stored = { id: attemptId, correctCount: 0, totalCount: 2, answers: [] }
      return stored
    })
    const open = () => app.inject({ url: '/api/v1/modules/' + moduleId + '/quiz/pos', headers: headers() })
    const responses = await Promise.all([open(), open()])
    expect(responses.map(response => response.statusCode).sort()).toEqual([200, 409])
    expect(responses.find(response => response.statusCode === 409)!.json().code).toBe('LEARNING_CONFLICT')
    expect((await open()).json().attemptId).toBe(attemptId)
  })
  it('exclui tentativas reconciliadas do resultado e da liberação do módulo', async () => {
    await app.inject({ url: '/api/v1/modules/' + moduleId + '/quiz/pos/resultado', headers: headers() })
    expect(db.quizAttempt.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ phase: 'POST', supersededAt: null }) }))
  })
})
