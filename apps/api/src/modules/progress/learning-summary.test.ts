import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, programConfiguration: { findMany: vi.fn() }, learningAward: { findMany: vi.fn() } }))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))
const userId = '11111111-1111-4111-8111-111111111111'
const id = '33333333-3333-4333-8333-333333333333'
let app: FastifyInstance
beforeEach(async () => {
  vi.resetAllMocks()
  db.user.findUnique.mockResolvedValue({ id: userId, role: 'USER' })
  db.programConfiguration.findMany.mockResolvedValue([{ key: 'module_completion', value: 2, isActive: true }, { key: 'training_modules_daily', value: 2, isActive: true }, { key: 'training_points_daily', value: 4, isActive: true }])
  db.learningAward.findMany.mockResolvedValue([{ id, userId, ruleKey: 'module_completion', moduleId: id, trailId: id, points: 2, createdAt: new Date(), grantedAt: new Date() }, { id: userId, userId, ruleKey: 'module_completion', moduleId: id, trailId: id, points: 2, createdAt: new Date(), grantedAt: null }])
  app = await buildApp({ logger: false })
})
afterEach(async () => { await app.close() })
const headers = () => ({ authorization: 'Bearer ' + createSessionToken(userId) })
it('protege saldo e extrato sem consultar pontos de outra conta', async () => {
  for (const url of ['/api/v1/progress/learning', '/api/v1/progress/learning/history']) expect((await app.inject({ url })).statusCode).toBe(401)
  expect(db.learningAward.findMany).not.toHaveBeenCalled()
})
it('separa pontos liberados de pendentes e expõe os limites vigentes', async () => {
  const response = await app.inject({ url: '/api/v1/progress/learning', headers: headers() })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toMatchObject({ totalPoints: 2, pendingPoints: 2, modulePoints: 2, dailyModuleLimit: 2, dailyPointsLimit: 4 })
  expect(response.json().nextReleaseAt).toBeTruthy()
  expect(db.learningAward.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId } }))
})
it('não promete liberação se a regra estiver suspensa ou não houver espaço nem em um dia vazio', async () => {
  db.programConfiguration.findMany.mockResolvedValue([{ key: 'module_completion', value: 2, isActive: false }])
  expect((await app.inject({ url: '/api/v1/progress/learning', headers: headers() })).json()).toMatchObject({ totalPoints: 2, modulePoints: 0, nextReleaseAt: null })
})
it('pagina o extrato com valores e datas originais', async () => {
  const response = await app.inject({ url: '/api/v1/progress/learning/history?offset=20&limit=10', headers: headers() })
  expect(response.statusCode).toBe(200)
  expect(response.json().map((row: { status: string }) => row.status)).toEqual(['GRANTED', 'PENDING'])
  expect(db.learningAward.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId }, skip: 20, take: 10 }))
  expect((await app.inject({ url: '/api/v1/progress/learning/history?limit=101', headers: headers() })).statusCode).toBe(400)
})
