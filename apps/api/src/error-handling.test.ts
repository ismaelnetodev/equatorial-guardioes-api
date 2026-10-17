import { describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

describe('Respostas de erro públicas', () => {
  it('oculta detalhes internos de falhas inesperadas', async () => {
    const app = await buildApp({ logger: false })
    app.get('/unexpected-error', async () => {
      throw new Error('Invalid getPrisma().moduleProgress.upsert(): C:\\private\\progress.service.ts trainingPointsAwarded password=secret')
    })
    try {
      const response = await app.inject('/unexpected-error')
      expect(response.statusCode).toBe(500)
      expect(response.json()).toEqual({ code: 'INTERNAL_SERVER_ERROR', message: 'Não foi possível concluir a solicitação. Tente novamente em instantes.' })
      expect(response.body).not.toMatch(/Prisma|private|trainingPointsAwarded|secret|stack/)
    } finally { await app.close() }
  })

  it('não expõe detalhes do validador em requisições inválidas', async () => {
    const app = await buildApp({ logger: false })
    try {
      const response = await app.inject({ method: 'POST', url: '/api/v1/entrar', payload: {} })
      expect(response.statusCode).toBe(400)
      expect(response.json()).toEqual({ code: 'VALIDATION_ERROR', message: 'Verifique os dados informados e tente novamente.' })
    } finally { await app.close() }
  })
})
