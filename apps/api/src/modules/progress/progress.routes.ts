import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { completeModuleController, getTrailProgressController, startModuleController } from './progress.controller.js'
import { errorResponseSchema, moduleProgressParamsSchema, moduleProgressSchema, trailProgressParamsSchema, trailProgressResponseSchema } from './progress.schemas.js'

export const progressRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/trails/:trailId', { schema: { tags: ['Progress'], security: [{ bearerAuth: [] }], summary: 'Consulta o progresso do usuário em uma trilha', params: trailProgressParamsSchema, response: { 401: errorResponseSchema, 200: trailProgressResponseSchema, 404: errorResponseSchema } } }, getTrailProgressController)
  app.post('/modules/:moduleId/start', { schema: { tags: ['Progress'], security: [{ bearerAuth: [] }], summary: 'Inicia um módulo disponível', params: moduleProgressParamsSchema, response: { 401: errorResponseSchema, 200: moduleProgressSchema, 404: errorResponseSchema, 409: errorResponseSchema } } }, startModuleController)
  app.post('/modules/:moduleId/complete', { schema: { tags: ['Progress'], security: [{ bearerAuth: [] }], summary: 'Conclui um módulo após cumprir seus requisitos', params: moduleProgressParamsSchema, response: { 401: errorResponseSchema, 200: moduleProgressSchema, 404: errorResponseSchema, 409: errorResponseSchema, 501: errorResponseSchema } } }, completeModuleController)
}
