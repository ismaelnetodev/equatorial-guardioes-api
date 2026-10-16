import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

describe('rotas de autenticação', () => {
  let app: FastifyInstance
  beforeAll(async () => { app = await buildApp({ logger: false }) })
  afterAll(async () => { await app.close() })

  it('exige o aceite dos termos para criar a conta', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/cadastrar', payload: { name: 'João Pereira', email: 'joao@exemplo.com', password: 'senha-segura-123', neighborhood: 'Meireles', acceptedTerms: false } })
    expect(response.statusCode).toBe(400)
  })

  it('exige e-mail ou celular no login antes de acessar o banco', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/entrar', payload: { password: 'senha-segura-123' } })
    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ code: 'CONTACT_REQUIRED', message: 'Informe ao menos um e-mail ou celular.' })
  })

  it('documenta as rotas de cadastro e login', () => {
    const document = app.swagger() as { paths: Record<string, unknown> }
    expect(document.paths).toHaveProperty('/api/v1/cadastrar')
    expect(document.paths).toHaveProperty('/api/v1/entrar')
  })
})
