/**
 * Real Postgres E2E (runs in CI with DATABASE_URL). Skips locally without DB.
 */
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'
import { getPrisma } from '../../lib/prisma.js'
import { hashPassword } from '../auth/auth.service.js'
import { learningDayStart } from '../quiz/learning-rules.service.js'

const runE2E = Boolean(process.env['DATABASE_URL'])
const suite = runE2E ? describe : describe.skip

const COHAMA_ID = 'slz-26257835feac3369'
const PREFIX = `e2e-rank-${Date.now()}`

suite('E2E ranking trail + daily cap queue', () => {
  let app: FastifyInstance
  let trailId: string
  let moduleId: string
  let userId: string
  let neighborUserId: string
  let preQ: string
  let preCorrect: string
  let postQ: string
  let postCorrect: string
  let postWrong: string
  let token: string

  async function upsertConfig(key: string, kind: 'RULE' | 'LIMIT', value: number | null, isActive = true) {
    const db = getPrisma()
    await db.programConfiguration.upsert({
      where: { key },
      create: {
        key,
        kind,
        name: key,
        description: 'e2e',
        value,
        unit: kind === 'RULE' ? 'points' : 'limit',
        isActive,
      },
      update: { value, isActive, kind },
    })
  }

  beforeAll(async () => {
    process.env['AUTH_TOKEN_SECRET'] ??= 'e2e-auth-token-secret'
    const db = getPrisma()
    await upsertConfig('training_completion', 'RULE', 3, true)
    await upsertConfig('module_quiz', 'RULE', 4, true)
    await upsertConfig('module_completion', 'RULE', 2, true)
    await upsertConfig('post_test_improvement', 'RULE', 6, false)
    await upsertConfig('training_modules_daily', 'LIMIT', 2, true)
    await upsertConfig('training_points_daily', 'LIMIT', 10, true)
    await upsertConfig('module_minimum_time', 'LIMIT', 70, false)
    await upsertConfig('quiz_pass_score', 'LIMIT', 80, true)
    await upsertConfig('quiz_retry_interval', 'LIMIT', 0, false)

    const trail = await db.trail.create({
      data: {
        title: `${PREFIX}-trail`,
        description: 'e2e',
        order: 90_000 + Math.floor(Math.random() * 1000),
        publicationStatus: 'PUBLISHED',
        modules: {
          create: {
            title: `${PREFIX}-module`,
            description: 'e2e',
            content: 'conteudo e2e',
            order: 1,
            isActive: true,
            requiresQuiz: true,
            publicationStatus: 'PUBLISHED',
            durationMinutes: 1,
          },
        },
      },
      select: { id: true, modules: { select: { id: true } } },
    })
    trailId = trail.id
    moduleId = trail.modules[0]!.id

    preQ = randomUUID()
    preCorrect = randomUUID()
    postQ = randomUUID()
    postCorrect = randomUUID()
    postWrong = randomUUID()

    await db.quizQuestion.create({
      data: {
        id: preQ,
        moduleId,
        phase: 'PRE',
        statement: 'Pre e2e?',
        order: 1,
        explanationTitle: 'ok',
        explanationBody: 'ok',
        isActive: true,
        options: {
          create: [
            { id: preCorrect, text: 'certo', isCorrect: true },
            { id: randomUUID(), text: 'errado', isCorrect: false },
          ],
        },
      },
    })
    await db.quizQuestion.create({
      data: {
        id: postQ,
        moduleId,
        phase: 'POST',
        statement: 'Post e2e?',
        order: 2,
        explanationTitle: 'ok',
        explanationBody: 'ok',
        isActive: true,
        options: {
          create: [
            { id: postCorrect, text: 'certo', isCorrect: true },
            { id: postWrong, text: 'errado', isCorrect: false },
          ],
        },
      },
    })

    const passwordHash = await hashPassword('senha-e2e-segura')
    const main = await db.user.create({
      data: {
        name: `${PREFIX}-user`,
        email: `${PREFIX}@example.com`,
        passwordHash,
        neighborhood: 'Cohama',
        neighborhoodId: COHAMA_ID,
        termsAcceptedAt: new Date(),
        pointAccount: { create: { accumulated: 100, balance: 100 } },
      },
      select: { id: true },
    })
    userId = main.id
    token = createSessionToken(userId)

    const neighbor = await db.user.create({
      data: {
        name: `${PREFIX}-neighbor`,
        email: `${PREFIX}-n@example.com`,
        passwordHash,
        neighborhood: 'Cohama',
        neighborhoodId: COHAMA_ID,
        termsAcceptedAt: new Date(),
        pointAccount: { create: { accumulated: 50, balance: 50 } },
      },
      select: { id: true },
    })
    neighborUserId = neighbor.id

    app = await buildApp({ logger: false })
  }, 60_000)

  afterAll(async () => {
    await app?.close()
    const db = getPrisma()
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined)
    if (neighborUserId) await db.user.delete({ where: { id: neighborUserId } }).catch(() => undefined)
    if (trailId) await db.trail.delete({ where: { id: trailId } }).catch(() => undefined)
    await db.$disconnect()
  })

  const headers = () => ({ authorization: `Bearer ${token}` })

  it('percorre a trilha e o ranking do bairro sobe pela soma esperada', async () => {
    const expected = 3 + 4 + 2 // training_completion + module_quiz + module_completion

    const before = await app.inject({ method: 'GET', url: '/api/v1/ranking', headers: headers() })
    expect(before.statusCode).toBe(200)
    const beforeCohama = before.json().neighborhoods.find(
      (item: { neighborhood: string }) => item.neighborhood === 'Cohama',
    )
    expect(beforeCohama.accumulatedPoints).toBe(150)

    expect((await app.inject({
      method: 'POST',
      url: `/api/v1/progress/modules/${moduleId}/start`,
      headers: headers(),
    })).statusCode).toBe(200)

    const pre = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${moduleId}/quiz/pre`,
      headers: headers(),
      payload: { answers: [{ questionId: preQ, optionId: preCorrect }] },
    })
    expect(pre.statusCode).toBe(200)

    const training = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${moduleId}/training/complete`,
      headers: headers(),
    })
    expect(training.statusCode).toBe(200)
    expect(training.json()).toMatchObject({
      completed: true,
      pointsAwarded: 3,
      pointsCapped: false,
    })

    const pos = await app.inject({
      method: 'GET',
      url: `/api/v1/modules/${moduleId}/quiz/pos`,
      headers: headers(),
    })
    expect(pos.statusCode).toBe(200)
    const attemptId = pos.json().attemptId as string

    const answer = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${moduleId}/quiz/pos/answers`,
      headers: headers(),
      payload: { attemptId, questionId: postQ, optionId: postCorrect },
    })
    expect(answer.statusCode).toBe(200)

    const finish = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${moduleId}/quiz/pos/finish`,
      headers: headers(),
      payload: { attemptId },
    })
    expect(finish.statusCode).toBe(200)
    expect(finish.json()).toMatchObject({ isApproved: true, pointsAwarded: 4 })

    const complete = await app.inject({
      method: 'POST',
      url: `/api/v1/progress/modules/${moduleId}/complete`,
      headers: headers(),
    })
    expect(complete.statusCode).toBe(200)
    expect(complete.json()).toMatchObject({
      status: 'completed',
      pointsCapped: false,
    })

    const after = await app.inject({ method: 'GET', url: '/api/v1/ranking', headers: headers() })
    expect(after.statusCode).toBe(200)
    const afterCohama = after.json().neighborhoods.find(
      (item: { neighborhood: string }) => item.neighborhood === 'Cohama',
    )
    expect(afterCohama.accumulatedPoints).toBe(150 + expected)
  }, 60_000)

  it('com limite diário atingido informa pointsCapped e credita depois via claim', async () => {
    const db = getPrisma()
    const capUser = await db.user.create({
      data: {
        name: `${PREFIX}-cap`,
        email: `${PREFIX}-cap@example.com`,
        passwordHash: await hashPassword('senha-e2e-segura'),
        neighborhood: 'Cohama',
        neighborhoodId: COHAMA_ID,
        termsAcceptedAt: new Date(),
        pointAccount: { create: { accumulated: 0, balance: 0 } },
      },
      select: { id: true },
    })
    const capToken = createSessionToken(capUser.id)
    const capHeaders = { authorization: `Bearer ${capToken}` }

    const capTrail = await db.trail.create({
      data: {
        title: `${PREFIX}-cap-trail`,
        description: 'e2e',
        order: 91_000 + Math.floor(Math.random() * 1000),
        publicationStatus: 'PUBLISHED',
        modules: {
          create: {
            title: `${PREFIX}-cap-module`,
            description: 'e2e',
            content: 'conteudo',
            order: 1,
            isActive: true,
            requiresQuiz: false,
            publicationStatus: 'PUBLISHED',
            durationMinutes: 1,
          },
        },
      },
      select: { id: true, modules: { select: { id: true } } },
    })
    const capModuleId = capTrail.modules[0]!.id

    await upsertConfig('training_points_daily', 'LIMIT', 0, true)
    await upsertConfig('training_completion', 'RULE', 3, true)

    await db.moduleProgress.create({
      data: {
        userId: capUser.id,
        moduleId: capModuleId,
        startedAt: new Date(Date.now() - 60_000),
        preTestCompletedAt: new Date(),
      },
    })

    const training = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${capModuleId}/training/complete`,
      headers: capHeaders,
    })
    expect(training.statusCode).toBe(200)
    expect(training.json()).toMatchObject({
      pointsAwarded: 0,
      pointsCapped: true,
      capReason: 'DAILY_LIMIT',
      pendingPoints: 3,
    })

    const accountBefore = await db.pointAccount.findUniqueOrThrow({ where: { userId: capUser.id } })
    expect(accountBefore.accumulated).toBe(0)

    await upsertConfig('training_points_daily', 'LIMIT', 10, true)
    // Move award creation to previous learning-day so release can grant on a fresh day bucket.
    const award = await db.learningAward.findUniqueOrThrow({
      where: {
        userId_ruleKey_sourceId: {
          userId: capUser.id,
          ruleKey: 'training_completion',
          sourceId: capModuleId,
        },
      },
    })
    const yesterday = new Date(learningDayStart(new Date()).getTime() - 86_400_000)
    await db.learningAward.update({
      where: { id: award.id },
      data: { createdAt: yesterday },
    })

    const claim = await app.inject({
      method: 'POST',
      url: '/api/v1/progress/learning-awards/claim',
      headers: capHeaders,
    })
    expect(claim.statusCode).toBe(200)
    expect(claim.json()).toMatchObject({ pointsReleased: 3 })

    const accountAfter = await db.pointAccount.findUniqueOrThrow({ where: { userId: capUser.id } })
    expect(accountAfter.accumulated).toBe(3)

    await db.user.delete({ where: { id: capUser.id } })
    await db.trail.delete({ where: { id: capTrail.id } })
    await upsertConfig('training_points_daily', 'LIMIT', 10, true)
  }, 60_000)
})
