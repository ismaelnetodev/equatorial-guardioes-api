import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'
import { hashPassword, passwordsMatch } from '../auth/auth.service.js'

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() } }))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))
const id = '11111111-1111-4111-8111-111111111111'
const url = '/api/v1/admin/password'
let app: FastifyInstance
let hash: string
beforeEach(async () => {
  vi.resetAllMocks()
  hash = await hashPassword('1234')
  db.user.findUnique.mockImplementation(async ({ select }: { select: { passwordHash?: boolean } }) => select.passwordHash ? { passwordHash: hash } : { id, role: 'ADMIN' })
  db.user.updateMany.mockResolvedValue({ count: 1 })
  app = await buildApp({ logger: false })
})
afterEach(async () => { await app.close() })
const patch = (payload: object) => app.inject({ method: 'PATCH', url, headers: { authorization: 'Bearer ' + createSessionToken(id) }, payload })

it('permite login com senha temporária sem relaxar o cadastro público', async () => {
  db.user.findFirst.mockResolvedValue({ id, name: 'Admin', email: 'admin@teste.com', cellphone: null, neighborhood: 'Centro', passwordHash: hash })
  const response = await app.inject({ method: 'POST', url: '/api/v1/entrar', payload: { email: 'admin@teste.com', password: '1234' } })
  expect(response.statusCode).toBe(200)
  expect(response.json().accessToken).toBeTruthy()
  expect(response.json().user).not.toHaveProperty('passwordHash')
  expect((await app.inject({ method: 'POST', url: '/api/v1/entrar', payload: { email: 'admin@teste.com', password: 'errada' } })).statusCode).toBe(401)
  expect((await app.inject({ method: 'POST', url: '/api/v1/cadastrar', payload: { name: 'Conta', email: 'outro@teste.com', password: '1234', neighborhood: 'Centro', acceptedTerms: true } })).statusCode).toBe(400)
  expect(db.user.create).not.toHaveBeenCalled()
})

it('exige ADMIN e autenticação antes da troca de senha', async () => {
  expect((await app.inject({ method: 'PATCH', url, payload: { currentPassword: '1234', newPassword: 'novasenha123' } })).statusCode).toBe(401)
  db.user.findUnique.mockResolvedValue({ id, role: 'USER' })
  expect((await patch({ currentPassword: '1234', newPassword: 'novasenha123' })).statusCode).toBe(403)
  expect(db.user.updateMany).not.toHaveBeenCalled()
})

it('verifica a senha atual e exige ao menos oito caracteres na nova', async () => {
  expect((await patch({ currentPassword: 'incorreta', newPassword: 'novasenha123' })).statusCode).toBe(422)
  expect((await patch({ currentPassword: '1234', newPassword: 'curta' })).statusCode).toBe(400)
  expect(db.user.updateMany).not.toHaveBeenCalled()
})

it('troca somente a senha do administrador autenticado e guarda hash scrypt', async () => {
  const response = await patch({ currentPassword: '1234', newPassword: 'novasenha123', userId: 'outra-conta' })
  expect(response.statusCode).toBe(200)
  const call = db.user.updateMany.mock.calls[0]![0] as { where: { id: string; role: string; passwordHash: string }; data: { passwordHash: string } }
  expect(call.where).toEqual({ id, role: 'ADMIN', passwordHash: hash })
  expect(call.data.passwordHash).not.toBe('novasenha123')
  expect(await passwordsMatch('novasenha123', call.data.passwordHash)).toBe(true)
  expect(await passwordsMatch('1234', call.data.passwordHash)).toBe(false)
  expect(response.json()).not.toHaveProperty('passwordHash')
})

it('retorna conflito se outra troca de senha ocorrer simultaneamente', async () => {
  db.user.updateMany.mockResolvedValue({ count: 0 })
  expect((await patch({ currentPassword: '1234', newPassword: 'novasenha123' })).statusCode).toBe(409)
})
