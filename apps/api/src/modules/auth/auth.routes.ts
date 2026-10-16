import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { loginController, registerController } from './auth.controller.js'
import { authResponseSchema, credentialsSchema, errorResponseSchema, loginSchema } from './auth.schemas.js'

export const authRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post('/cadastrar', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: {
      tags: ['Auth'], summary: 'Cadastra um usuário', body: credentialsSchema,
      response: { 201: authResponseSchema, 400: errorResponseSchema, 429: errorResponseSchema, 409: errorResponseSchema },
    },
  }, registerController)

  app.post('/entrar', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: {
      tags: ['Auth'], summary: 'Autentica um usuário', body: loginSchema,
      response: { 200: authResponseSchema, 400: errorResponseSchema, 429: errorResponseSchema, 401: errorResponseSchema },
    },
  }, loginController)
}
