import process from 'node:process'
import { createHmac, timingSafeEqual } from 'node:crypto'

const tokenLifetimeMs = 24 * 60 * 60 * 1000

function getSecret(): string {
  const secret = process.env['AUTH_TOKEN_SECRET']
  if (secret) return secret
  if (process.env['NODE_ENV'] === 'production') throw new Error('AUTH_TOKEN_SECRET must be configured in production.')
  return 'development-only-auth-token-secret'
}

function signature(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + tokenLifetimeMs })).toString('base64url')
  return `${payload}.${signature(payload)}`
}

export function getSessionUserId(authorization: string | undefined): string | undefined {
  const token = authorization?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) return undefined
  const parts = token.split('.')
  if (parts.length !== 2) return undefined
  const [payload, receivedSignature] = parts
  if (!payload || !receivedSignature) return undefined
  const expectedSignature = signature(payload)
  const received = Buffer.from(receivedSignature)
  const expected = Buffer.from(expectedSignature)
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return undefined
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { userId?: unknown; expiresAt?: unknown }
    if (typeof data.userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.userId) || typeof data.expiresAt !== 'number' || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) return undefined
    return data.userId
  } catch { return undefined }
}
