import Fastify from 'fastify'
import cors from '@fastify/cors'
import { describe, expect, it } from 'vitest'
import { buildCorsOptions } from './cors.js'

async function request(env: NodeJS.ProcessEnv, origin?: string, preflight = false) {
  const app = Fastify()
  try {
    await app.register(cors, buildCorsOptions(env))
    app.get('/check', async () => ({ ok: true }))
    return await app.inject({
      method: preflight ? 'OPTIONS' : 'GET', url: '/check',
      headers: {
        ...(origin ? { origin } : {}),
        ...(preflight ? { 'access-control-request-method': 'PATCH', 'access-control-request-headers': 'authorization,content-type' } : {}),
      },
    })
  } finally { await app.close() }
}

describe('CORS', () => {
  it.each(['http://localhost:8081', 'http://127.0.0.1:5173', 'http://[::1]:8081', 'http://192.168.15.6:8081', 'http://10.0.2.2:8081', 'http://172.16.0.3:8082', 'https://172.31.255.1'])('permite origem local em desenvolvimento: %s', async origin => {
    const response = await request({ NODE_ENV: 'development' }, origin)
    expect(response.headers['access-control-allow-origin']).toBe(origin)
    expect(response.headers.vary).toContain('Origin')
    expect(response.headers['access-control-allow-credentials']).toBeUndefined()
  })

  it.each(['http://192.168.1.1.evil.com:8081', 'http://localhost.evil.com', 'http://172.32.0.1', 'https://example.com', 'null', 'file:///tmp/app', 'http://localhost:8081/path', 'http://user:pass@localhost:8081'])('não libera origem inválida ou externa: %s', async origin => {
    const response = await request({ NODE_ENV: 'development' }, origin)
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('permite desativar o acesso automático pela rede local', async () => {
    const response = await request({ NODE_ENV: 'development', CORS_ALLOW_LOCAL_NETWORK: 'false', CORS_ORIGINS: 'http://localhost:8081' }, 'http://192.168.15.6:8081')
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  const production = { NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example.com, https://admin.example.com/' }
  it.each(['https://app.example.com', 'https://admin.example.com'])('permite somente a lista de produção: %s', async origin => {
    expect((await request(production, origin)).headers['access-control-allow-origin']).toBe(origin)
  })
  it.each(['http://localhost:8081', 'http://192.168.15.6:8081', 'https://app.example.com.evil.com', 'https://app.example.com:8443'])('bloqueia origem fora da lista em produção: %s', async origin => {
    expect((await request({ ...production, CORS_ALLOW_LOCAL_NETWORK: 'true' }, origin)).headers['access-control-allow-origin']).toBeUndefined()
  })
  it.each(['', '*', 'null', 'http://app.example.com', 'https://app.example.com/path', 'https://user:pass@app.example.com'])('recusa configuração insegura em produção: %s', origin => {
    expect(() => buildCorsOptions({ NODE_ENV: 'production', CORS_ORIGINS: origin })).toThrow(/CORS_ORIGINS/)
  })
  it('responde ao preflight para JSON e Bearer token', async () => {
    const response = await request(production, 'https://app.example.com', true)
    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-methods']).toContain('PATCH')
    expect(response.headers['access-control-allow-headers']).toContain('Authorization')
    expect(response.headers['access-control-allow-headers']).toContain('Content-Type')
    expect(response.headers['access-control-max-age']).toBe('600')
  })
  it('não fornece autorização CORS em preflight de origem bloqueada', async () => {
    expect((await request(production, 'https://evil.com', true)).headers['access-control-allow-origin']).toBeUndefined()
  })
  it('mantém clientes sem Origin funcionando', async () => {
    const response = await request(production)
    expect(response.statusCode).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})
