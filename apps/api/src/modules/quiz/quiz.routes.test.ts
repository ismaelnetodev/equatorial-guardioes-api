import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

describe('quiz routes', () => {
  let app: FastifyInstance
  beforeAll(async () => { app = await buildApp({ logger: false }) })
  afterAll(async () => { await app.close() })

  it('validates module identifiers before accessing the database', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/modules/invalid/learn' })
    expect(response.statusCode).toBe(400)
  })

  it('documents the learn flow routes in OpenAPI', () => {
    const document = app.swagger() as { paths: Record<string, unknown> }
    expect(document.paths).toHaveProperty('/api/v1/modules/{moduleId}/learn')
    expect(document.paths).toHaveProperty('/api/v1/modules/{moduleId}/quiz/pre')
    expect(document.paths).toHaveProperty('/api/v1/modules/{moduleId}/quiz/pre/resultado')
    expect(document.paths).toHaveProperty('/api/v1/modules/{moduleId}/training')
    expect(document.paths).toHaveProperty('/api/v1/modules/{moduleId}/training/complete')
    expect(document.paths).toHaveProperty('/api/v1/modules/{moduleId}/quiz/pos')
    expect(document.paths).toHaveProperty('/api/v1/modules/{moduleId}/quiz/pos/answers')
    expect(document.paths).toHaveProperty('/api/v1/modules/{moduleId}/quiz/pos/finish')
    expect(document.paths).toHaveProperty('/api/v1/modules/{moduleId}/quiz/pos/resultado')
  })
})
