import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => db }))
const id = '11111111-1111-4111-8111-111111111111'
let app: FastifyInstance
beforeEach(async () => { vi.resetAllMocks(); app = await buildApp({ logger: false }) })
afterEach(async () => { await app.close() })

it('rejeita sessão ausente ou inválida antes de consultar o banco', async () => {
  for (const authorization of [undefined, 'Bearer invalid']) {
    const response = await app.inject({ url: '/api/v1/me', headers: authorization ? { authorization } : {} })
    expect(response.statusCode).toBe(401)
  }
  expect(db.user.findUnique).not.toHaveBeenCalled()
})
it('retorna os dados atuais da conta sem expor senha nem papel administrativo', async () => {
  db.user.findUnique.mockResolvedValue({ id, name: 'Maria Costa', email: 'maria@example.com', cellphone: null, neighborhood: 'Cohama', passwordHash: 'secret', role: 'ADMIN' })
  const response = await app.inject({ url: '/api/v1/me', headers: { authorization: 'Bearer ' + createSessionToken(id) } })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ id, name: 'Maria Costa', email: 'maria@example.com', neighborhood: 'Cohama' })
  expect(db.user.findUnique).toHaveBeenCalledWith({ where: { id }, select: { id: true, name: true, email: true, cellphone: true, neighborhood: true } })
})
it('invalida a sessão de uma conta excluída', async () => {
  db.user.findUnique.mockResolvedValue(null)
  const response = await app.inject({ url: '/api/v1/me', headers: { authorization: 'Bearer ' + createSessionToken(id) } })
  expect(response.statusCode).toBe(401)
})
