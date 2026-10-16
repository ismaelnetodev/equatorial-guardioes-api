import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

const db = vi.hoisted(() => ({ neighborhood: { findMany: vi.fn(), findUnique: vi.fn() }, user: { findFirst: vi.fn(), create: vi.fn() } }))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))
let app: FastifyInstance
const neighborhood = { id: 'slz-cohama', name: 'Cohama', municipalityCode: '2111300', municipalityName: 'São Luís', state: 'MA', source: 'Prefeitura de São Luís / SEMGOP 2022' }
const credentials = { name: 'Maria', email: 'maria@example.com', password: 'senha-segura-123', neighborhood: 'Nome adulterado', neighborhoodId: neighborhood.id, acceptedTerms: true }
beforeEach(async () => { vi.resetAllMocks(); app = await buildApp({ logger: false }) })
afterEach(async () => { await app.close() })

it('lista apenas São Luís por padrão e preserva a fonte municipal', async () => {
  db.neighborhood.findMany.mockResolvedValue([neighborhood])
  const response = await app.inject('/api/v1/neighborhoods/')
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ neighborhoods: [neighborhood] })
  expect(db.neighborhood.findMany.mock.calls[0]![0].where).toEqual({ municipalityCode: '2111300' })
})
it('permite consultar separadamente municípios importados do IBGE', async () => {
  db.neighborhood.findMany.mockResolvedValue([])
  expect((await app.inject('/api/v1/neighborhoods/?municipalityCode=2111201')).statusCode).toBe(200)
  expect(db.neighborhood.findMany.mock.calls[0]![0].where).toEqual({ municipalityCode: '2111201' })
})
it('rejeita um código de município inválido antes de acessar o banco', async () => {
  expect((await app.inject('/api/v1/neighborhoods/?municipalityCode=abc')).statusCode).toBe(400)
  expect(db.neighborhood.findMany).not.toHaveBeenCalled()
})
for (const record of [null, { ...neighborhood, municipalityCode: '2111201' }]) {
  it('rejeita bairro inexistente ou de outro município no cadastro', async () => {
    db.neighborhood.findUnique.mockResolvedValue(record)
    const response = await app.inject({ method: 'POST', url: '/api/v1/cadastrar', payload: credentials })
    expect(response.statusCode).toBe(400)
    expect(response.json().code).toBe('INVALID_NEIGHBORHOOD')
    expect(db.user.create).not.toHaveBeenCalled()
  })
}
it('vincula o bairro pelo ID e usa o nome do catálogo no cadastro', async () => {
  db.neighborhood.findUnique.mockResolvedValue(neighborhood)
  db.user.findFirst.mockResolvedValue(null)
  db.user.create.mockImplementation(async ({ data }) => ({ id: '11111111-1111-4111-8111-111111111111', ...data }))
  const response = await app.inject({ method: 'POST', url: '/api/v1/cadastrar', payload: credentials })
  expect(response.statusCode).toBe(201)
  expect(response.json().user.neighborhood).toBe('Cohama')
  expect(db.user.create.mock.calls[0]![0].data.neighborhoodId).toBe(neighborhood.id)
  expect(response.json().user).not.toHaveProperty('passwordHash')
})
it('aceita Outro bairro sem inserir nomes livres no catálogo oficial', async () => {
  db.user.findFirst.mockResolvedValue(null)
  db.user.create.mockImplementation(async ({ data }) => ({ id: '11111111-1111-4111-8111-111111111111', ...data }))
  const { neighborhoodId: _, ...other } = credentials
  const response = await app.inject({ method: 'POST', url: '/api/v1/cadastrar', payload: { ...other, neighborhood: 'Meu bairro' } })
  expect(response.statusCode).toBe(201)
  expect(db.neighborhood.findUnique).not.toHaveBeenCalled()
  expect(db.user.create.mock.calls[0]![0].data.neighborhoodId).toBe(null)
})
