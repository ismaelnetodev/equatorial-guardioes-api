import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'

describe('trail routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp({ logger: false })
  })

  afterAll(async () => {
    await app.close()
  })

  it('validates the trail identifier before accessing the database', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/trails/invalid/modules' })

    expect(response.statusCode).toBe(400)
  })

  it('documents the trail queries in OpenAPI', () => {
    const document = app.swagger() as { paths: Record<string, unknown> }

    expect(document.paths).toHaveProperty('/api/v1/trails/')
    expect(document.paths).toHaveProperty('/api/v1/trails/{trailId}')
    expect(document.paths).toHaveProperty('/api/v1/trails/{trailId}/modules')
  })
})
