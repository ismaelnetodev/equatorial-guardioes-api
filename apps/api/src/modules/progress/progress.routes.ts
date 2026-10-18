import { Type } from 'typebox'
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { claimLearningAwardsController, completeModuleController, getTrailProgressController, startModuleController, learningSummaryController, learningHistoryController } from './progress.controller.js'
import { errorResponseSchema, moduleProgressParamsSchema, moduleProgressSchema, trailProgressParamsSchema, trailProgressResponseSchema, learningSummarySchema, learningHistorySchema, learningHistoryQuerySchema } from './progress.schemas.js'

export const progressRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/learning', { schema: { tags: ['Progress'], security: [{ bearerAuth: [] }], summary: 'Saldo de pontos liberados e pendentes do aprendizado', response: { 200: learningSummarySchema, 401: errorResponseSchema } } }, learningSummaryController)
  app.get('/learning/history', { schema: { tags: ['Progress'], security: [{ bearerAuth: [] }], summary: 'Extrato de concessões do aprendizado do usuário', querystring: learningHistoryQuerySchema, response: { 200: learningHistorySchema, 401: errorResponseSchema } } }, learningHistoryController)
  app.post('/learning-awards/claim', {
    schema: {
      tags: ['Progress'],
      security: [{ bearerAuth: [] }],
      summary: 'Libera pontos pendentes de treino respeitando o teto diário',
      response: {
        200: Type.Object({
          pointsReleased: Type.Integer({ minimum: 0 }),
          pendingPoints: Type.Integer({ minimum: 0, description: 'Pontos que permaneceram na fila após o claim' }),
        }),
        401: errorResponseSchema,
        409: errorResponseSchema,
      },
    },
  }, claimLearningAwardsController)
  app.get('/trails/:trailId', { schema: { tags: ['Progress'], security: [{ bearerAuth: [] }], summary: 'Consulta o progresso do usuário em uma trilha', params: trailProgressParamsSchema, response: { 401: errorResponseSchema, 200: trailProgressResponseSchema, 404: errorResponseSchema } } }, getTrailProgressController)
  app.post('/modules/:moduleId/start', { schema: { tags: ['Progress'], security: [{ bearerAuth: [] }], summary: 'Inicia um módulo disponível', params: moduleProgressParamsSchema, response: { 401: errorResponseSchema, 200: moduleProgressSchema, 404: errorResponseSchema, 409: errorResponseSchema } } }, startModuleController)
  app.post('/modules/:moduleId/complete', { schema: { tags: ['Progress'], security: [{ bearerAuth: [] }], summary: 'Conclui um módulo após cumprir seus requisitos', params: moduleProgressParamsSchema, response: { 401: errorResponseSchema, 200: moduleProgressSchema, 404: errorResponseSchema, 409: errorResponseSchema, 501: errorResponseSchema } } }, completeModuleController)
}
