import { expect, it } from 'vitest'
import { buildApp } from './app.js'

it('responde à sonda de vida sem acessar o banco nem exigir autenticação', async () => {
  const app = await buildApp({ logger: false })
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
    expect(app.swagger().paths).toHaveProperty('/api/v1/health')
  } finally { await app.close() }
})
