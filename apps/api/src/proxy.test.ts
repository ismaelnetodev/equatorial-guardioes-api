import { afterEach, expect, it, vi } from 'vitest'
import { buildApp } from './app.js'

afterEach(() => { vi.unstubAllEnvs() })

it.each([['0', '127.0.0.1'], ['1', '198.51.100.10']])(
  'com %s proxies confiáveis, usa o IP %s sem confiar no prefixo forjado',
  async (hops, expectedIp) => {
    vi.stubEnv('TRUST_PROXY_HOPS', hops)
    const app = await buildApp({ logger: false })
    app.get('/test-ip', async request => ({ ip: request.ip }))
    try {
      const response = await app.inject({
        method: 'GET', url: '/test-ip', remoteAddress: '127.0.0.1',
        headers: { 'x-forwarded-for': '203.0.113.99, 198.51.100.10' },
      })
      expect(response.json()).toEqual({ ip: expectedIp })
    } finally { await app.close() }
  },
)

it.each(['true', '-1', '1.5'])('recusa TRUST_PROXY_HOPS inválido: %s', async value => {
  vi.stubEnv('TRUST_PROXY_HOPS', value)
  await expect(buildApp({ logger: false })).rejects.toThrow('TRUST_PROXY_HOPS')
})
