import { isIP } from 'node:net'
import type { FastifyCorsOptions } from '@fastify/cors'

function parseOrigin(value: string): URL | null {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash ? url : null
  } catch { return null }
}

function isLocalHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  if (isIP(hostname) !== 4) return false
  const [first, second] = hostname.split('.').map(Number)
  return first === 127 || first === 10 || (first === 192 && second === 168) || (first === 172 && second !== undefined && second >= 16 && second <= 31)
}

export function buildCorsOptions(env: NodeJS.ProcessEnv = process.env): FastifyCorsOptions {
  const production = env['NODE_ENV'] === 'production'
  const development = !env['NODE_ENV'] || env['NODE_ENV'] === 'development'
  const allowLocal = development && env['CORS_ALLOW_LOCAL_NETWORK'] !== 'false'
  const origins = new Set<string>()
  for (const entry of (env['CORS_ORIGINS'] ?? '').split(',').map(value => value.trim()).filter(Boolean)) {
    const url = parseOrigin(entry)
    if (!url || (production && url.protocol !== 'https:')) {
      throw new Error('CORS_ORIGINS deve conter origens HTTP(S) sem caminhos, credenciais ou curingas; em produção, use HTTPS.')
    }
    origins.add(url.origin)
  }
  if (production && origins.size === 0) throw new Error('Configure CORS_ORIGINS com as origens HTTPS do frontend antes de iniciar em produção.')

  return {
    origin(origin, callback) {
      // Clientes nativos e chamadas servidor-servidor não dependem de CORS.
      if (!origin) { callback(null, false); return }
      const url = parseOrigin(origin)
      callback(null, Boolean(url && origin === url.origin && (origins.has(url.origin) || (allowLocal && isLocalHostname(url.hostname)))))
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false,
    maxAge: 600,
    strictPreflight: true,
  }
}
