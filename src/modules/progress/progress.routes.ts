import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { completeModuleController, getTrailProgressController, startModuleController, submitQuizController } from './progress.controller.js'
import { errorResponseSchema, moduleProgressParamsSchema, moduleProgressSchema, quizAttemptResponseSchema, submitQuizSchema, trailProgressParamsSchema, trailProgressResponseSchema } from './progress.schemas.js'

export const progressRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/trails/:trailId', { schema: { tags: ['Progress'], summary: 'Consulta o progresso do usuário em uma trilha', params: trailProgressParamsSchema, response: { 200: trailProgressResponseSchema, 404: errorResponseSchema } } }, getTrailProgressController)
  app.post('/modules/:moduleId/start', { schema: { tags: ['Progress'], summary: 'Inicia um módulo disponível', params: moduleProgressParamsSchema, response: { 200: moduleProgressSchema, 404: errorResponseSchema, 409: errorResponseSchema } } }, startModuleController)
  app.post('/modules/:moduleId/quiz-attempts', { schema: { tags: ['Progress'], summary: 'Registra uma tentativa de quiz e calcula a nota no servidor', params: moduleProgressParamsSchema, body: submitQuizSchema, response: { 200: quizAttemptResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema, 422: errorResponseSchema } } }, submitQuizController)
  app.post('/modules/:moduleId/complete', { schema: { tags: ['Progress'], summary: 'Conclui um módulo após cumprir seus requisitos', params: moduleProgressParamsSchema, response: { 200: moduleProgressSchema, 404: errorResponseSchema, 409: errorResponseSchema } } }, completeModuleController)
}
