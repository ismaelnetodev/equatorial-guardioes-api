import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
let app: FastifyInstance
beforeEach(async () => { app = await buildApp({ logger: false }) })
afterEach(async () => { vi.restoreAllMocks(); await app.close() })

for (const [path, max] of [['entrar', 10], ['cadastrar', 5]] as const) {
  describe('rate limit ' + path, () => {
    const url = '/api/v1/' + path
    const send = (remoteAddress = '192.0.2.1', forwarded = '203.0.113.1') => app.inject({ method: 'POST', url, payload: {}, remoteAddress, headers: { 'x-forwarded-for': forwarded } })
    it('limita inclusive entradas inválidas antes de acessar o banco', async () => {
      for (let i = 0; i < max; i++) expect((await send()).statusCode).toBe(400)
      const blocked = await send()
      expect(blocked.statusCode).toBe(429)
      expect(blocked.json()).toEqual({ code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Aguarde antes de tentar novamente.' })
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
      expect((await send('192.0.2.1', '203.0.113.2')).statusCode).toBe(429)
      expect((await send('192.0.2.2')).statusCode).toBe(400)
      expect((await app.inject({ method: 'POST', url: '/api/v1/' + (path === 'entrar' ? 'cadastrar' : 'entrar'), payload: {}, remoteAddress: '192.0.2.1' })).statusCode).toBe(400)
      const now = Date.now()
      vi.spyOn(Date, 'now').mockReturnValue(now + 15 * 60 * 1000 + 1)
      expect((await send()).statusCode).toBe(400)
    })
  })
}
