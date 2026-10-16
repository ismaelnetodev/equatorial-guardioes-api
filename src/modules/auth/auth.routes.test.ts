import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

describe('rotas de autenticação', () => {
  let app: FastifyInstance
  const user = {
    name: 'João Pereira',
    email: 'joao.pereira@exemplo.com',
    password: 'senha-segura-123',
    neighborhood: 'Meireles',
    acceptedTerms: true,
  }

  beforeAll(async () => { app = await buildApp({ logger: false }) })
  afterAll(async () => { await app.close() })

  it('cadastra e autentica um usuário sem banco de dados', async () => {
    const registration = await app.inject({ method: 'POST', url: '/api/v1/cadastrar', payload: user })
    expect(registration.statusCode).toBe(201)
    expect(registration.json()).toMatchObject({ message: 'Cadastro realizado com sucesso.', user: { name: user.name, email: user.email, neighborhood: user.neighborhood } })

    const login = await app.inject({ method: 'POST', url: '/api/v1/entrar', payload: { email: user.email, password: user.password } })
    expect(login.statusCode).toBe(200)
    expect(login.json()).toMatchObject({ message: 'Login realizado com sucesso.', user: { name: user.name, email: user.email } })
  })

  it('não expõe senha e recusa credenciais inválidas', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/entrar', payload: { email: 'maria.silva@exemplo.com', password: 'senha-incorreta' } })
    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' })
  })

  it('exige o aceite dos termos para criar a conta', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/cadastrar', payload: { ...user, email: 'sem.termos@exemplo.com', acceptedTerms: false } })
    expect(response.statusCode).toBe(400)
  })

  it('permite login somente com celular', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/entrar', payload: { cellphone: '+5585999990000', password: 'senha-ficticia-123' } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ user: { name: 'Maria da Silva', cellphone: '+5585999990000' } })
  })
})
