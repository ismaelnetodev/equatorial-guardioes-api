import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { Prisma } from '../../generated/prisma/client.js'
import { registerUser } from './auth.service.js'

const db = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), create: vi.fn() },
  inviteAttribution: { create: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))
const duplicate = { code: 'CONTACT_ALREADY_REGISTERED', message: 'Este e-mail ou celular já está cadastrado.' }
const credentials = { name: 'Teste Cadastro', password: 'senha-segura-123', neighborhood: 'Centro', acceptedTerms: true as const }
const uniqueError = (field: string) => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '7.10.0', meta: { target: [field] } })
let app: FastifyInstance
beforeEach(async () => {
  vi.resetAllMocks()
  db.$transaction.mockImplementation(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db))
  db.inviteAttribution.create.mockResolvedValue({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  app = await buildApp({ logger: false })
})
afterEach(async () => { await app.close() })

it('aceita uma senha de exatamente 8 caracteres no cadastro e no login', async () => {
  db.user.findFirst.mockResolvedValue(null)
  db.user.create.mockImplementation(async ({ data }) => ({ id: '11111111-1111-4111-8111-111111111111', ...data }))
  const registration = await app.inject({ method: 'POST', url: '/api/v1/cadastrar', payload: { ...credentials, email: 'teste@example.com', password: '12345678' } })
  expect(registration.statusCode).toBe(201)
  const stored = db.user.create.mock.results[0]!
  db.user.findFirst.mockResolvedValue(await stored.value)
  const login = await app.inject({ method: 'POST', url: '/api/v1/entrar', payload: { email: 'teste@example.com', password: '12345678' } })
  expect(login.statusCode).toBe(200)
  expect(login.json().accessToken).toBeTruthy()
})

describe('conflitos no cadastro', () => {
  for (const contact of [{ email: 'teste@example.com' }, { cellphone: '+5585999999999' }]) {
    it('retorna 201 e 409 para cadastros concorrentes com o mesmo contato ' + Object.keys(contact)[0], async () => {
      let checks = 0
      let release!: () => void
      const bothChecked = new Promise<void>(resolve => { release = resolve })
      db.user.findFirst.mockImplementation(async () => { if (++checks === 2) release(); await bothChecked; return null })
      let inserted = false
      db.user.create.mockImplementation(async ({ data }) => {
        if (inserted) throw uniqueError(Object.keys(contact)[0]!)
        inserted = true
        return { id: '11111111-1111-4111-8111-111111111111', ...data }
      })
      const requests = await Promise.all([0, 1].map(() => app.inject({ method: 'POST', url: '/api/v1/cadastrar', payload: { ...credentials, ...contact } })))
      expect(requests.map(r => r.statusCode).sort()).toEqual([201, 409])
      expect(requests.find(r => r.statusCode === 409)!.json()).toEqual(duplicate)
      expect(db.user.create).toHaveBeenCalledTimes(2)
      expect(requests.find(r => r.statusCode === 201)!.json().user).not.toHaveProperty('passwordHash')
    })
  }
  it('mantém a resposta de duplicidade detectada antes da inserção', async () => {
    db.user.findFirst.mockResolvedValue({ id: 'existing' })
    const r = await app.inject({ method: 'POST', url: '/api/v1/cadastrar', payload: { ...credentials, email: 'teste@example.com' } })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toEqual(duplicate)
    expect(db.user.create).not.toHaveBeenCalled()
  })
  it('não converte falhas de banco sem relação com unicidade em cadastro existente', async () => {
    db.user.findFirst.mockResolvedValue(null)
    const failure = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: '7.10.0' })
    db.user.create.mockRejectedValue(failure)
    await expect(registerUser({ ...credentials, email: 'teste@example.com' })).rejects.toBe(failure)
  })
})
