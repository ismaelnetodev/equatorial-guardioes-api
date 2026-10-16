import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'
import { Prisma } from '../../generated/prisma/client.js'
import type { ContentStatus } from './admin.schemas.js'

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, trail: { findMany: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn(), create: vi.fn(), update: vi.fn() }, trailModule: { findMany: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() }, moduleProgress: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() }, $transaction: vi.fn() }))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))
type TrailRow = { id: string; title: string; description: string; order: number; publicationStatus: ContentStatus }
type ModuleRow = TrailRow & { trailId: string; content: string; isActive: boolean; durationMinutes: number | null; requiresQuiz: boolean }
type Where = Record<string, unknown>
type Query = { where?: Where; data?: Record<string, unknown>; select?: Record<string, unknown>; orderBy?: unknown }
const userId = '11111111-1111-4111-8111-111111111111'
const trailId = '22222222-2222-4222-8222-222222222222'
const otherTrailId = '66666666-6666-4666-8666-666666666666'
const moduleId = '33333333-3333-4333-8333-333333333333'
const nextModuleId = '44444444-4444-4444-8444-444444444444'
const hiddenModuleId = '55555555-5555-4555-8555-555555555555'
const otherModuleId = '77777777-7777-4777-8777-777777777777'
let trails: TrailRow[]
let modules: ModuleRow[]
let completed: Set<string>
let role: 'USER' | 'ADMIN'
let app: FastifyInstance
const headers = () => ({ authorization: 'Bearer ' + createSessionToken(userId) })
const base = '/api/v1/admin/trails'
const moduleBase = base + '/' + trailId + '/modules'
function matches(row: object, where: Where = {}): boolean {
  const values = row as Record<string, unknown>
  return Object.entries(where).every(([key, value]) => {
    if (key === 'trail') return matches(trails.find(t => t.id === values['trailId']) ?? {}, value as Where)
    if (value && typeof value === 'object' && 'not' in value) return values[key] !== value.not
    return values[key] === value
  })
}
const sorted = <T extends { order: number }>(rows: T[]) => [...rows].sort((a, b) => a.order - b.order)
const uniqueError = () => new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '7.10.0' })

beforeEach(async () => {
  vi.resetAllMocks()
  role = 'ADMIN'
  completed = new Set()
  trails = [{ id: trailId, title: 'Trilha', description: 'Descrição', order: 1, publicationStatus: 'PUBLISHED' }, { id: otherTrailId, title: 'Outra', description: 'Descrição', order: 2, publicationStatus: 'PUBLISHED' }]
  const item = { title: 'Módulo', description: 'Descrição', content: 'Conteúdo completo', durationMinutes: null, isActive: true, requiresQuiz: false, publicationStatus: 'PUBLISHED' as const }
  modules = [{ ...item, id: moduleId, trailId, order: 1 }, { ...item, id: nextModuleId, trailId, order: 2 }, { ...item, id: hiddenModuleId, trailId, order: 3, publicationStatus: 'DRAFT' }, { ...item, id: otherModuleId, trailId: otherTrailId, order: 1 }]
  db.user.findUnique.mockImplementation(async () => ({ id: userId, role }))
  const withProgress = (m: ModuleRow) => ({ ...m, progressRecords: completed.has(m.id) ? [{ startedAt: new Date(), completedAt: new Date() }] : [] })
  db.trail.findMany.mockImplementation(async ({ where }: Query = {}) => sorted(trails.filter(t => matches(t, where))))
  db.trail.findUnique.mockImplementation(async ({ where, select }: Query) => {
    const trail = trails.find(t => matches(t, where))
    if (!trail) return null
    if (!select?.['modules']) return { ...trail }
    const selection = select['modules'] as { where?: Where }
    return { ...trail, modules: sorted(modules.filter(m => m.trailId === trail.id && matches(m, selection.where))).map(withProgress) }
  })
  db.trail.aggregate.mockImplementation(async () => ({ _max: { order: trails.length ? Math.max(...trails.map(t => t.order)) : null } }))
  db.trail.create.mockImplementation(async ({ data }: Query) => { const row = { id: randomUUID(), publicationStatus: 'DRAFT', ...data } as TrailRow; trails.push(row); return { ...row } })
  db.trail.update.mockImplementation(async ({ where, data }: Query) => {
    const row = trails.find(t => matches(t, where))!
    if (data?.['order'] !== undefined && trails.some(t => t.id !== row.id && t.order === data['order'])) throw uniqueError()
    Object.assign(row, data); return { ...row }
  })
  db.trailModule.findMany.mockImplementation(async ({ where }: Query) => sorted(modules.filter(m => matches(m, where))))
  db.trailModule.findUnique.mockImplementation(async ({ where }: Query) => { const m = modules.find(m => matches(m, where)); return m ? { ...m } : null })
  db.trailModule.aggregate.mockImplementation(async ({ where }: Query) => { const rows = modules.filter(m => matches(m, where)); return { _max: { order: rows.length ? Math.max(...rows.map(m => m.order)) : null } } })
  db.trailModule.count.mockImplementation(async ({ where }: Query) => modules.filter(m => matches(m, where)).length)
  db.trailModule.create.mockImplementation(async ({ data }: Query) => { const row = { id: randomUUID(), publicationStatus: 'DRAFT', isActive: true, ...data } as ModuleRow; modules.push(row); return { ...row } })
  db.trailModule.update.mockImplementation(async ({ where, data }: Query) => {
    const row = modules.find(m => matches(m, where))!
    if (data?.['order'] !== undefined && modules.some(m => m.id !== row.id && m.trailId === row.trailId && m.order === data['order'])) throw uniqueError()
    Object.assign(row, data); return { ...row }
  })
  db.$transaction.mockImplementation(async (operation: (tx: typeof db) => Promise<unknown>) => {
    const snapshot = structuredClone({ trails, modules })
    try { return await operation(db) } catch (error) { trails = snapshot.trails; modules = snapshot.modules; throw error }
  })
  app = await buildApp({ logger: false })
  await app.ready()
})
afterEach(async () => { await app.close() })
const get = (url: string) => app.inject({ url, headers: headers() })
const post = (url: string, payload: object) => app.inject({ method: 'POST', url, payload, headers: headers() })
const patch = (url: string, payload: object) => app.inject({ method: 'PATCH', url, payload, headers: headers() })
const reorder = (url: string, ids: string[]) => app.inject({ method: 'PUT', url, payload: { ids }, headers: headers() })

describe('autorização administrativa', () => {
  const operations = [
    ['GET', base, undefined], ['GET', base + '/' + trailId, undefined],
    ['POST', base, { title: 'Nova', description: 'Descrição' }],
    ['PATCH', base + '/' + trailId, { title: 'Editada' }],
    ['PATCH', base + '/' + trailId + '/status', { status: 'ARCHIVED' }],
    ['PUT', base + '/order', { ids: [otherTrailId, trailId] }],
    ['POST', moduleBase, { title: 'Novo', description: 'Descrição' }],
    ['PATCH', moduleBase + '/' + moduleId, { content: 'Novo conteúdo' }],
    ['PATCH', moduleBase + '/' + moduleId + '/status', { status: 'DISABLED' }],
    ['PUT', moduleBase + '/order', { ids: [nextModuleId, moduleId, hiddenModuleId] }],
  ] as const
  it('protege todas as operações antes de consultar ou alterar conteúdo', async () => {
    for (const [method, url, payload] of operations) {
      for (const userRole of [undefined, 'USER'] as const) {
        role = userRole ?? 'ADMIN'
        const r = await app.inject({ method, url, ...(payload ? { payload } : {}), ...(userRole ? { headers: headers() } : {}) })
        expect(r.statusCode).toBe(userRole ? 403 : 401)
      }
    }
    expect(db.trail.findMany).not.toHaveBeenCalled()
    expect(db.trail.findUnique).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it('rejeita usuário excluído e token com segmentos adicionais', async () => {
    db.user.findUnique.mockResolvedValue(null)
    expect((await get(base)).statusCode).toBe(401)
    expect((await app.inject({ url: base, headers: { authorization: headers().authorization + '.extra' } })).statusCode).toBe(401)
  })
})

describe('administração de conteúdo', () => {
  it('cadastra e publica módulo e trilha sem expor rascunhos', async () => {
    const created = await post(base, { title: ' Nova trilha ', description: ' Descrição ' })
    expect(created.statusCode).toBe(201)
    const trail = created.json()
    expect(trail).toMatchObject({ title: 'Nova trilha', order: 3, publicationStatus: 'DRAFT' })
    expect((await patch(base + '/' + trail.id + '/status', { status: 'PUBLISHED' })).statusCode).toBe(422)
    const m = await post(base + '/' + trail.id + '/modules', { title: 'Módulo novo', description: 'Descrição', content: 'Conteúdo' })
    expect(m.statusCode).toBe(201)
    expect(m.json()).toMatchObject({ order: 1, publicationStatus: 'DRAFT' })
    expect((await patch(base + '/' + trail.id + '/modules/' + m.json().id + '/status', { status: 'PUBLISHED' })).statusCode).toBe(200)
    expect((await app.inject({ url: '/api/v1/trails/' + trail.id })).statusCode).toBe(404)
    expect((await patch(base + '/' + trail.id + '/status', { status: 'PUBLISHED' })).statusCode).toBe(200)
    expect((await app.inject({ url: '/api/v1/trails/' + trail.id })).statusCode).toBe(200)
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
  })
  it('permite editar textos e conteúdo preservando o vínculo e a ordem', async () => {
    expect((await patch(base + '/' + trailId, { title: 'Renomeada', description: 'Nova descrição' })).json()).toMatchObject({ title: 'Renomeada', order: 1 })
    expect((await patch(moduleBase + '/' + moduleId, { content: 'Novo conteúdo', durationMinutes: 15, requiresQuiz: true })).json()).toMatchObject({ content: 'Novo conteúdo', durationMinutes: 15, requiresQuiz: true, trailId, order: 1 })
  })
  it('lista rascunhos e conteúdo completo para revisão administrativa', async () => {
    expect((await get(base)).json()).toHaveLength(2)
    const r = await get(base + '/' + trailId)
    expect(r.statusCode).toBe(200)
    expect(r.json().modules).toHaveLength(3)
    expect(r.json().modules[2]).toMatchObject({ publicationStatus: 'DRAFT', content: 'Conteúdo completo' })
  })
  it('não permite publicar módulo sem conteúdo nem esvaziar um publicado', async () => {
    modules.find(m => m.id === hiddenModuleId)!.content = '   '
    expect((await patch(moduleBase + '/' + hiddenModuleId + '/status', { status: 'PUBLISHED' })).statusCode).toBe(422)
    expect((await patch(moduleBase + '/' + moduleId, { content: ' ' })).statusCode).toBe(422)
    expect(modules.find(m => m.id === moduleId)!.content).toBe('Conteúdo completo')
  })
  it('não permite retirar o último módulo publicado de uma trilha pública', async () => {
    expect((await patch(moduleBase + '/' + moduleId + '/status', { status: 'ARCHIVED' })).statusCode).toBe(200)
    expect((await patch(moduleBase + '/' + nextModuleId + '/status', { status: 'DISABLED' })).statusCode).toBe(422)
    expect((await patch(base + '/' + trailId + '/status', { status: 'ARCHIVED' })).statusCode).toBe(200)
    expect((await patch(moduleBase + '/' + nextModuleId + '/status', { status: 'DISABLED' })).statusCode).toBe(200)
    expect(modules.find(m => m.id === nextModuleId)).toMatchObject({ publicationStatus: 'DISABLED', isActive: false })
  })
  it('republicar um módulo desativado também o reativa', async () => {
    expect((await patch(moduleBase + '/' + moduleId + '/status', { status: 'DISABLED' })).statusCode).toBe(200)
    expect((await patch(moduleBase + '/' + moduleId + '/status', { status: 'PUBLISHED' })).statusCode).toBe(200)
    expect(modules.find(m => m.id === moduleId)).toMatchObject({ publicationStatus: 'PUBLISHED', isActive: true })
  })
  it('retorna 404 para referências inexistentes e módulos de outra trilha', async () => {
    expect((await post(base + '/' + userId + '/modules', { title: 'Novo', description: 'Descrição' })).statusCode).toBe(404)
    expect((await patch(moduleBase + '/' + otherModuleId, { title: 'Indevido' })).statusCode).toBe(404)
    expect((await patch(moduleBase + '/' + userId + '/status', { status: 'PUBLISHED' })).statusCode).toBe(404)
  })
  it('valida entradas vazias, texto em branco, duração e estados inválidos', async () => {
    for (const body of [{}, { title: '   ', description: 'Descrição' }, { title: 'x'.repeat(201), description: 'Descrição' }]) expect((await post(base, body)).statusCode).toBe(400)
    expect((await patch(base + '/' + trailId, {})).statusCode).toBe(400)
    expect((await patch(moduleBase + '/' + moduleId, { durationMinutes: -1 })).statusCode).toBe(400)
    expect((await patch(base + '/' + trailId + '/status', { status: 'INVALID' })).statusCode).toBe(400)
  })
  it('reordena trilhas e módulos sem colisões de unicidade', async () => {
    const t = await reorder(base + '/order', [otherTrailId, trailId])
    expect(t.statusCode).toBe(200)
    expect(t.json().map((v: TrailRow) => [v.id, v.order])).toEqual([[otherTrailId, 1], [trailId, 2]])
    const m = await reorder(moduleBase + '/order', [hiddenModuleId, nextModuleId, moduleId])
    expect(m.statusCode).toBe(200)
    expect(m.json().map((v: ModuleRow) => [v.id, v.order])).toEqual([[hiddenModuleId, 1], [nextModuleId, 2], [moduleId, 3]])
    expect(modules.find(m => m.id === otherModuleId)!.order).toBe(1)
  })
  it('rejeita ordenação incompleta, duplicada ou com IDs externos sem alterações', async () => {
    expect((await reorder(moduleBase + '/order', [moduleId, moduleId, hiddenModuleId])).statusCode).toBe(400)
    expect((await reorder(moduleBase + '/order', [moduleId])).statusCode).toBe(422)
    expect((await reorder(moduleBase + '/order', [moduleId, nextModuleId, otherModuleId])).statusCode).toBe(422)
    expect((await reorder(base + '/order', [trailId])).statusCode).toBe(422)
    expect(modules.filter(m => m.trailId === trailId).map(m => m.order)).toEqual([1, 2, 3])
    expect(db.trailModule.update).not.toHaveBeenCalled()
  })
  it('não deixa uma reordenação parcial quando uma atualização falha', async () => {
    const update = db.trailModule.update.getMockImplementation()!
    db.trailModule.update.mockImplementationOnce(update).mockRejectedValueOnce(uniqueError())
    expect((await reorder(moduleBase + '/order', [nextModuleId, moduleId, hiddenModuleId])).statusCode).toBe(409)
    expect(modules.filter(m => m.trailId === trailId).map(m => m.order)).toEqual([1, 2, 3])
  })
  it('ignora campos fora do contrato sem alterar vínculo, posição ou publicação', async () => {
    expect((await patch(moduleBase + '/' + moduleId, { trailId: otherTrailId, order: 100, publicationStatus: 'DISABLED', isActive: false })).statusCode).toBe(200)
    expect(modules.find(m => m.id === moduleId)).toMatchObject({ trailId, order: 1, publicationStatus: 'PUBLISHED', isActive: true })
  })
  it('cadastra em rascunho mesmo se o cliente tentar antecipar a publicação', async () => {
    const r = await post(base, { title: 'Nova', description: 'Descrição', publicationStatus: 'PUBLISHED', order: 1 })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({ publicationStatus: 'DRAFT', order: 3 })
  })
  it('retorna conflito recuperável em transações concorrentes', async () => {
    db.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('write conflict', { code: 'P2034', clientVersion: '7.10.0' }))
    expect((await post(base, { title: 'Nova', description: 'Descrição' })).statusCode).toBe(409)
    expect(trails).toHaveLength(2)
  })
})

describe('visibilidade pública e progresso', () => {
  for (const status of ['DRAFT', 'ARCHIVED', 'DISABLED'] as const) {
    it('oculta trilhas ' + status + ' de consultas públicas e progresso', async () => {
      trails[0]!.publicationStatus = status
      role = 'USER'
      const list = await app.inject({ url: '/api/v1/trails/' })
      expect(list.json().map((t: TrailRow) => t.id)).toEqual([otherTrailId])
      for (const suffix of ['', '/modules']) expect((await get('/api/v1/trails/' + trailId + suffix)).statusCode).toBe(404)
      expect((await get('/api/v1/progress/trails/' + trailId)).statusCode).toBe(404)
      expect((await post('/api/v1/progress/modules/' + moduleId + '/start', {})).statusCode).toBe(404)
      expect((await post('/api/v1/progress/modules/' + moduleId + '/complete', {})).statusCode).toBe(404)
    })
    it('oculta módulos ' + status + ' de consultas públicas e progresso', async () => {
      modules[0]!.publicationStatus = status
      role = 'USER'
      for (const suffix of ['', '/modules']) {
        const r = await get('/api/v1/trails/' + trailId + suffix)
        const items = suffix ? r.json() : r.json().modules
        expect(items.map((m: ModuleRow) => m.id)).toEqual([nextModuleId])
        expect(items[0]).toMatchObject({ status: 'available', content: 'Conteúdo completo' })
      }
      expect((await get('/api/v1/progress/trails/' + trailId)).json().modules.map((m: { moduleId: string }) => m.moduleId)).toEqual([nextModuleId])
      expect((await post('/api/v1/progress/modules/' + moduleId + '/start', {})).statusCode).toBe(404)
    })
  }
  it('mantém os módulos futuros visíveis sem entregar conteúdo bloqueado', async () => {
    role = 'USER'
    const url = '/api/v1/trails/' + trailId + '/modules'
    const first = await get(url)
    expect(first.json().map((m: { status: string; content: string | null }) => [m.status, m.content])).toEqual([['available', 'Conteúdo completo'], ['blocked', null]])
    completed.add(moduleId)
    expect((await get(url)).json()[1]).toMatchObject({ status: 'available', content: 'Conteúdo completo' })
  })
  it('aplica a nova ordem ao desbloqueio dos módulos', async () => {
    expect((await reorder(moduleBase + '/order', [nextModuleId, moduleId, hiddenModuleId])).statusCode).toBe(200)
    role = 'USER'
    const r = await get('/api/v1/trails/' + trailId + '/modules')
    expect(r.json().map((m: { id: string; status: string }) => [m.id, m.status])).toEqual([[nextModuleId, 'available'], [moduleId, 'blocked']])
  })
  it('documenta todas as operações administrativas com Bearer', () => {
    const document = app.swagger()
    expect(document).toHaveProperty(['paths', '/api/v1/admin/trails', 'post', 'security'], [{ bearerAuth: [] }])
    expect(document.paths).toHaveProperty('/api/v1/admin/trails/{trailId}/modules/{moduleId}/status')
    expect(document.paths).toHaveProperty('/api/v1/admin/trails/{trailId}/modules/order')
  })
})
