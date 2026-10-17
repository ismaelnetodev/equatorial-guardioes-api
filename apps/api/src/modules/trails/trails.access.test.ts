import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'

const db = vi.hoisted(() => ({ $transaction: vi.fn(), programConfiguration: { findUnique: vi.fn() }, learningAward: { create: vi.fn(), findMany: vi.fn() }, user: { findUnique: vi.fn() }, trail: { findUnique: vi.fn() }, trailModule: { findUnique: vi.fn() }, moduleProgress: { findUniqueOrThrow: vi.fn(), upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() } }))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))
const userId = '11111111-1111-4111-8111-111111111111'
const trailId = '22222222-2222-4222-8222-222222222222'
const ids = ['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'] as const
const modules = ids.map((id, index) => ({ id, trailId, title: 'Módulo ' + index, description: 'Descrição', content: 'Conteúdo secreto ' + index, order: index + 1, durationMinutes: 5, isActive: index !== 1, requiresQuiz: false, quizMinimumScore: null }))
type Progress = { id: string; startedAt: Date; completedAt: Date | null; attempts: never[] }
let progress: Map<string, Progress>
let app: FastifyInstance
const authorization = () => ({ authorization: 'Bearer ' + createSessionToken(userId) })

beforeEach(async () => {
  vi.resetAllMocks()
  progress = new Map()
  db.user.findUnique.mockResolvedValue({ id: userId, role: 'USER' })
  db.trail.findUnique.mockImplementation(async ({ where, select }) => {
    if (where.id !== trailId) return null
    return { id: trailId, title: 'Trilha', description: 'Descrição', modules: modules.filter(m => !select.modules.where.isActive || m.isActive).map(m => ({ ...m, progressRecords: progress.has(m.id) ? [progress.get(m.id)] : [] })) }
  })
  db.trailModule.findUnique.mockImplementation(async ({ where }) => modules.find(m => m.id === where.id) ?? null)
  db.moduleProgress.upsert.mockImplementation(async ({ create }) => { const record = { id: create.moduleId, startedAt: new Date(), completedAt: null, attempts: [] as never[] }; progress.set(create.moduleId, record); return record })
  db.moduleProgress.findUnique.mockImplementation(async ({ where }) => progress.get(where.userId_moduleId.moduleId) ?? null)
  db.moduleProgress.update.mockImplementation(async ({ where, data }) => { const record = progress.get(where.id)!; record.completedAt = data.completedAt; return record })
  db.$transaction.mockImplementation(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db))
  db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => ({ key: where.key, kind: where.key === 'module_completion' ? 'RULE' : 'LIMIT', value: 0, isActive: false }))
  db.learningAward.findMany.mockResolvedValue([])
  db.moduleProgress.findUniqueOrThrow.mockResolvedValue({ id: ids[0], startedAt: new Date(), completedAt: null })
  app = await buildApp({ logger: false })
})
afterEach(async () => { await app.close() })

for (const suffix of ['', '/modules']) {
  describe('GET trail' + suffix, () => {
    const url = '/api/v1/trails/' + trailId + suffix
    const readModules = (body: unknown): Array<{ id: string; status: string; content: string | null }> => suffix ? body as Array<{ id: string; status: string; content: string | null }> : (body as { modules: Array<{ id: string; status: string; content: string | null }> }).modules
    it('mostra apenas metadados ativos ao visitante', async () => {
      const r = await app.inject({ url })
      expect(r.statusCode).toBe(200)
      const result = readModules(r.json())
      expect(result.map(m => m.id)).toEqual([ids[0], ids[2]])
      expect(result.every(m => m.status === 'blocked' && m.content === null)).toBe(true)
      expect(r.body).not.toContain('Conteúdo secreto')
      expect(db.user.findUnique).not.toHaveBeenCalled()
    })
    it('libera apenas o primeiro módulo ativo para o usuário', async () => {
      const r = await app.inject({ url, headers: authorization() })
      expect(r.statusCode).toBe(200)
      expect(readModules(r.json()).map(m => [m.status, m.content])).toEqual([['available', modules[0]!.content], ['blocked', null]])
      expect(db.user.findUnique).toHaveBeenCalledWith({ where: { id: userId }, select: { id: true, role: true } })
    })
    it('libera o seguinte após concluir o anterior, ignorando inativos', async () => {
      progress.set(ids[0], { id: ids[0], startedAt: new Date(), completedAt: new Date(), attempts: [] })
      const r = await app.inject({ url, headers: authorization() })
      expect(readModules(r.json()).map(m => m.status)).toEqual(['completed', 'available'])
      expect(readModules(r.json())[1]!.content).toBe(modules[2]!.content)
    })
    it('não libera módulo posterior com progresso inconsistente', async () => {
      progress.set(ids[2], { id: ids[2], startedAt: new Date(), completedAt: new Date(), attempts: [] })
      const r = await app.inject({ url, headers: authorization() })
      expect(readModules(r.json())[1]).toMatchObject({ status: 'blocked', content: null })
    })
    it('permite ao administrador visualizar inativos e seu conteúdo', async () => {
      db.user.findUnique.mockResolvedValue({ id: userId, role: 'ADMIN' })
      const r = await app.inject({ url, headers: authorization() })
      expect(r.statusCode).toBe(200)
      expect(readModules(r.json()).map(m => m.id)).toEqual([...ids])
      expect(readModules(r.json()).every(m => m.content !== null)).toBe(true)
    })
    it('rejeita token inválido, com sufixo e usuário excluído', async () => {
      for (const token of ['invalid', createSessionToken(userId) + '.extra']) {
        expect((await app.inject({ url, headers: { authorization: 'Bearer ' + token } })).statusCode).toBe(401)
      }
      db.user.findUnique.mockResolvedValue(null)
      expect((await app.inject({ url, headers: authorization() })).statusCode).toBe(401)
    })
    it('retorna 404 para trilha inexistente', async () => {
      expect((await app.inject({ url: url.replace(trailId, userId), headers: authorization() })).statusCode).toBe(404)
    })
  })
}

it('mantém o bloqueio nas operações e libera o conteúdo após a conclusão via API', async () => {
  const headers = authorization()
  const start = (id: string) => app.inject({ method: 'POST', url: '/api/v1/progress/modules/' + id + '/start', headers })
  expect((await start(ids[2])).statusCode).toBe(409)
  expect((await start(ids[1])).statusCode).toBe(404)
  expect((await start(ids[0])).statusCode).toBe(200)
  const completion = await app.inject({ method: 'POST', url: '/api/v1/progress/modules/' + ids[0] + '/complete', headers })
  expect(completion.statusCode).toBe(200)
  const r = await app.inject({ url: '/api/v1/trails/' + trailId + '/modules', headers })
  expect(r.json()[1]).toMatchObject({ id: ids[2], status: 'available', content: modules[2]!.content })
  expect((await start(ids[2])).statusCode).toBe(200)
})
