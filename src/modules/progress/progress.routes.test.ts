import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

describe('progress routes', () => {
  let app: FastifyInstance
  beforeAll(async () => { app = await buildApp({ logger: false }) })
  afterAll(async () => { await app.close() })

  it('validates route identifiers before accessing the database', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/progress/trails/invalid' })
    expect(response.statusCode).toBe(400)
  })

  it('documents the progress routes in OpenAPI', () => {
    const document = app.swagger() as { paths: Record<string, unknown> }
    expect(document.paths).toHaveProperty('/api/v1/progress/trails/{trailId}')
    expect(document.paths).toHaveProperty('/api/v1/progress/modules/{moduleId}/start')
    expect(document.paths).toHaveProperty('/api/v1/progress/modules/{moduleId}/quiz-attempts')
    expect(document.paths).toHaveProperty('/api/v1/progress/modules/{moduleId}/complete')
  })
})
