import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'
import * as quiz from '../quiz/quiz.service.js'

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, trail: { findUnique: vi.fn() }, trailModule: { findUnique: vi.fn() }, moduleProgress: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() } }))
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
  db.trailModule.findUnique.mockImplementation(async () => ({ id: moduleId, trailId, isActive: true, requiresQuiz }))
  db.trail.findUnique.mockImplementation(async () => ({ id: trailId, modules: [{ id: moduleId, title: 'Módulo', order: 1, requiresQuiz, progressRecords: [{ startedAt: new Date(), completedAt: null }] }] }))
  db.moduleProgress.upsert.mockResolvedValue({ id: moduleId })
  db.moduleProgress.findUnique.mockResolvedValue({ id: moduleId })
  db.moduleProgress.update.mockResolvedValue({ completedAt: new Date() })
  app = await buildApp({ logger: false })
})
afterEach(async () => { vi.restoreAllMocks(); await app.close() })

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

describe('base de integração do quiz', () => {
  it('não oferece mais o endpoint de respostas', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/v1/progress/modules/' + moduleId + '/quiz-attempts', headers: headers(), payload: { answers: [] } })
    expect(r.statusCode).toBe(404)
  })
  it('impede a conclusão enquanto a integração não está implementada', async () => {
    requiresQuiz = true
    const r = await app.inject({ method: 'POST', url: completeUrl, headers: headers() })
    expect(r.statusCode).toBe(501)
    expect(r.json()).toMatchObject({ code: 'QUIZ_NOT_IMPLEMENTED' })
    expect(db.moduleProgress.update).not.toHaveBeenCalled()
  })
  it('não permite que aprovação enviada pelo cliente substitua a integração', async () => {
    requiresQuiz = true
    const r = await app.inject({ method: 'POST', url: completeUrl, headers: headers(), payload: { approved: true, score: 100 } })
    expect(r.statusCode).toBe(501)
    expect(db.moduleProgress.update).not.toHaveBeenCalled()
  })
  it('conclui sem consultar o quiz quando o módulo não exige aprovação', async () => {
    const integration = vi.spyOn(quiz, 'getQuizCompletionStatus')
    expect((await app.inject({ method: 'POST', url: completeUrl, headers: headers() })).statusCode).toBe(200)
    expect(integration).not.toHaveBeenCalled()
  })
  it('permite a futura integração aprovar o usuário e módulo corretos', async () => {
    requiresQuiz = true
    const integration = vi.spyOn(quiz, 'getQuizCompletionStatus').mockResolvedValue('approved')
    expect((await app.inject({ method: 'POST', url: completeUrl, headers: headers() })).statusCode).toBe(200)
    expect(integration).toHaveBeenCalledWith({ userId, moduleId })
    expect(db.moduleProgress.update).toHaveBeenCalledTimes(1)
  })
  it('mantém o módulo em andamento quando a integração informa reprovação', async () => {
    requiresQuiz = true
    vi.spyOn(quiz, 'getQuizCompletionStatus').mockResolvedValue('not_approved')
    const r = await app.inject({ method: 'POST', url: completeUrl, headers: headers() })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toMatchObject({ code: 'QUIZ_REQUIRED' })
    expect(db.moduleProgress.update).not.toHaveBeenCalled()
  })
})
