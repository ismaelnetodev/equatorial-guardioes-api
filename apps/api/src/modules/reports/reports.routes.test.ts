import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

describe('reports routes', () => {
  let app: FastifyInstance
  beforeAll(async () => { app = await buildApp({ logger: false }) })
  afterAll(async () => { await app.close() })

  it('validates report identifiers before accessing the database', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/relatos/invalid' })
    expect(response.statusCode).toBe(400)
  })

  it('documents the reports routes in OpenAPI', () => {
    const document = app.swagger() as { paths: Record<string, unknown> }
    expect(document.paths).toHaveProperty('/api/v1/relatos/')
    expect(document.paths).toHaveProperty('/api/v1/relatos/impacto')
    expect(document.paths).toHaveProperty('/api/v1/relatos/{reportId}')
    expect(document.paths).toHaveProperty('/api/v1/relatos/{reportId}/impacto/visto')
    expect(document.paths).toHaveProperty('/api/v1/admin/relatos')
    expect(document.paths).toHaveProperty('/api/v1/admin/relatos/{reportId}/status')
  })

  it('documents absence of pending impact as nullable JSON with status 200', () => {
    const responses = app.swagger().paths?.['/api/v1/relatos/impacto']?.get?.responses
    expect(responses).toHaveProperty(['200', 'content', 'application/json', 'schema', 'nullable'], true)
    expect(responses).not.toHaveProperty('204')
  })
})
