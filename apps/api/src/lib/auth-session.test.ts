import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSessionToken, getSessionUserId } from './auth-session.js'
const userId = '11111111-1111-4111-8111-111111111111'
afterEach(() => { vi.restoreAllMocks() })

describe('tokens de autenticação', () => {
  it('aceita apenas o token completo com assinatura válida', () => {
    const token = createSessionToken(userId)
    expect(getSessionUserId('Bearer ' + token)).toBe(userId)
    for (const invalid of [token + '.extra', token + '.', token + '..extra', token + 'x', token.split('.')[0]!, '.' + token.split('.')[1]]) {
      expect(getSessionUserId('Bearer ' + invalid)).toBeUndefined()
    }
    expect(getSessionUserId(undefined)).toBeUndefined()
  })
  it('rejeita tokens expirados', () => {
    const now = Date.now()
    const token = createSessionToken(userId)
    vi.spyOn(Date, 'now').mockReturnValue(now + 24 * 60 * 60 * 1000 + 1)
    expect(getSessionUserId('Bearer ' + token)).toBeUndefined()
  })
  it('rejeita identificadores que não podem representar um usuário no banco', () => {
    expect(getSessionUserId('Bearer ' + createSessionToken('invalid-user'))).toBeUndefined()
  })
})
