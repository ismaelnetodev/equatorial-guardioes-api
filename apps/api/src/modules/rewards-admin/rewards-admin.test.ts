import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'
import { Prisma, type ProgramConfiguration } from '../../generated/prisma/client.js'

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  programConfiguration: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  programConfigurationChange: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))
const actorId = '11111111-1111-4111-8111-111111111111'
const base = '/api/v1/admin/points-rewards'
const headers = () => ({ authorization: 'Bearer ' + createSessionToken(actorId) })
let app: FastifyInstance
let row: ProgramConfiguration

beforeEach(async () => {
  vi.resetAllMocks()
  row = { key: 'report_low', kind: 'RULE', name: 'Relato baixo', description: 'Após validação', value: 10, unit: 'points', isActive: true, updatedAt: new Date('2026-10-16T12:00:00Z') }
  db.user.findUnique.mockResolvedValue({ id: actorId, role: 'ADMIN' })
  db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => where.key === row.key ? { ...row } : null)
  db.programConfiguration.findMany.mockImplementation(async () => [{ ...row }])
  db.programConfiguration.update.mockImplementation(async ({ data }: { data: Partial<ProgramConfiguration> }) => {
    row = { ...row, ...data, updatedAt: new Date('2026-10-16T13:00:00Z') }
    return { ...row }
  })
  db.programConfigurationChange.findMany.mockResolvedValue([])
  db.$transaction.mockImplementation(async (operation: (tx: typeof db) => Promise<unknown>) => {
    const snapshot = { ...row }
    try { return await operation(db) } catch (error) { row = snapshot; throw error }
  })
  app = await buildApp({ logger: false })
  await app.ready()
})
afterEach(async () => { await app.close() })
const patch = (path: string, payload: object) => app.inject({ method: 'PATCH', url: base + path, headers: headers(), payload })

describe('permissões das configurações do programa', () => {
  it('exige autenticação e ADMIN em todas as operações', async () => {
    for (const path of ['/rules', '/rewards', '/limits', '/history', '/rules/report_low', '/rewards/partner_coupon', '/limits/reports_daily']) {
      const method = path.split('/').length === 3 ? 'PATCH' : 'GET'
      const payload = method === 'PATCH' ? { value: 20 } : undefined
      const url = base + path
      expect((await app.inject({ method, url, ...(payload ? { payload } : {}) })).statusCode).toBe(401)
      db.user.findUnique.mockResolvedValue({ id: actorId, role: 'USER' })
      expect((await app.inject({ method, url, ...(payload ? { payload } : {}), headers: headers() })).statusCode).toBe(403)
    }
    expect(db.programConfiguration.findMany).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.programConfigurationChange.findMany).not.toHaveBeenCalled()
  })
  it('consulta o papel atual e rejeita conta excluída ou rebaixada', async () => {
    const auth = headers()
    expect((await app.inject({ url: base + '/rules', headers: auth })).statusCode).toBe(200)
    db.user.findUnique.mockResolvedValue({ id: actorId, role: 'USER' })
    expect((await app.inject({ url: base + '/rules', headers: auth })).statusCode).toBe(403)
    db.user.findUnique.mockResolvedValue(null)
    expect((await app.inject({ url: base + '/history', headers: auth })).statusCode).toBe(401)
  })
})

describe('alterações e auditoria', () => {
  it('altera pontos e ativação com snapshots e autor verificado', async () => {
    const response = await patch('/rules/report_low', { value: 25, isActive: false, reason: 'Revisão aprovada' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ value: 25, isActive: false })
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
    expect(db.programConfigurationChange.create).toHaveBeenCalledWith({ data: {
      key: 'report_low', kind: 'RULE', actorId, reason: 'Revisão aprovada',
      before: expect.objectContaining({ value: 10, isActive: true }),
      after: expect.objectContaining({ value: 25, isActive: false }),
    } })
    // A transação só acessa configuração e auditoria; não existe escrita de saldo.
    expect(db.programConfiguration.update).toHaveBeenCalledWith({ where: { key: 'report_low' }, data: { value: 25, isActive: false } })
  })
  it('reverte a alteração quando não consegue gravar auditoria', async () => {
    db.programConfigurationChange.create.mockRejectedValue(new Error('audit unavailable'))
    expect((await patch('/rules/report_low', { value: 50 })).statusCode).toBe(500)
    expect(row.value).toBe(10)
  })
  it('mantém limites desconhecidos sem assumir zero e permite defini-los', async () => {
    row = { ...row, key: 'campaign_budget', kind: 'LIMIT', value: null, unit: 'BRL_cents' }
    const result = await patch('/limits/campaign_budget', { value: 50000 })
    expect(result.statusCode).toBe(200)
    expect(result.json().value).toBe(50000)
  })
  it('permite alterar o custo e desativar recompensas', async () => {
    row = { ...row, key: 'partner_coupon', kind: 'REWARD', value: 200 }
    expect((await patch('/rewards/partner_coupon', { value: 250, isActive: false })).statusCode).toBe(200)
    expect(row).toMatchObject({ value: 250, isActive: false })
  })
  it('não audita chamadas sem mudança de estado', async () => {
    expect((await patch('/rules/report_low', { value: 10 })).statusCode).toBe(200)
    expect(db.programConfiguration.update).not.toHaveBeenCalled()
    expect(db.programConfigurationChange.create).not.toHaveBeenCalled()
  })
  it('retorna 404 para chave inexistente ou categoria incorreta', async () => {
    expect((await patch('/rules/missing', { value: 5 })).statusCode).toBe(404)
    expect((await patch('/rewards/report_low', { value: 5 })).statusCode).toBe(404)
    expect(db.programConfiguration.update).not.toHaveBeenCalled()
  })
  it('retorna conflito em alterações concorrentes', async () => {
    db.programConfiguration.update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: '7.10.0' }))
    expect((await patch('/rules/report_low', { value: 5 })).statusCode).toBe(409)
    expect(db.programConfigurationChange.create).not.toHaveBeenCalled()
  })
  it.each([{}, { reason: 'sem mudança' }, { value: -1 }, { value: 0.5 }, { value: 2147483648 }, { value: '25' }, { isActive: null }, { isActive: 'false' }, { value: 5, actorId: 'outro' }, { value: 5, balance: 900 }])('rejeita entrada inválida %j', async payload => {
    expect((await patch('/rules/report_low', payload)).statusCode).toBe(400)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it('rejeita remoção dos pontos e percentual acima de 100', async () => {
    expect((await patch('/rules/report_low', { value: null })).statusCode).toBe(422)
    row = { ...row, key: 'quiz_pass_score', kind: 'LIMIT', unit: 'percent', value: 80 }
    expect((await patch('/limits/quiz_pass_score', { value: 101 })).statusCode).toBe(422)
  })
  it('consulta histórico filtrado com paginação limitada', async () => {
    const response = await app.inject({ url: base + '/history?kind=RULE&key=report_low&offset=10&limit=20', headers: headers() })
    expect(response.statusCode).toBe(200)
    expect(db.programConfigurationChange.findMany).toHaveBeenCalledWith({ where: { kind: 'RULE', key: 'report_low' }, skip: 10, take: 20, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
    expect((await app.inject({ url: base + '/history?limit=101', headers: headers() })).statusCode).toBe(400)
  })
})
