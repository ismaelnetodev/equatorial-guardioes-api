import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import * as controller from './quiz.controller.js'
import * as schema from './quiz.schemas.js'

export const quizRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const common = { tags: ['Quiz'], security: [{ bearerAuth: [] }] }
  const errors = {
    400: schema.errorResponseSchema,
    401: schema.errorResponseSchema,
    404: schema.errorResponseSchema,
    409: schema.errorResponseSchema,
    422: schema.errorResponseSchema,
  }

  app.get('/:moduleId/learn', {
    schema: {
      ...common,
      summary: 'Consulta o estado das etapas de aprendizado do módulo',
      params: schema.moduleParamsSchema,
      response: { 200: schema.learnStateSchema, ...errors },
    },
  }, controller.getLearnStateController)

  app.get('/:moduleId/quiz/pre', {
    schema: {
      ...common,
      summary: 'Lista perguntas do pré-teste sem gabarito',
      params: schema.moduleParamsSchema,
      response: { 200: schema.quizQuestionsResponseSchema, ...errors },
    },
  }, controller.getPreTestQuestionsController)

  app.post('/:moduleId/quiz/pre', {
    schema: {
      ...common,
      summary: 'Envia respostas do pré-teste e registra o ponto de partida',
      params: schema.moduleParamsSchema,
      body: schema.submitPreTestSchema,
      response: { 200: schema.preTestResultSchema, ...errors },
    },
  }, controller.submitPreTestController)

  app.get('/:moduleId/quiz/pre/resultado', {
    schema: {
      ...common,
      summary: 'Consulta o resultado do pré-teste',
      params: schema.moduleParamsSchema,
      response: { 200: schema.preTestResultSchema, ...errors },
    },
  }, controller.getPreTestResultController)

  app.get('/:moduleId/training', {
    schema: {
      ...common,
      summary: 'Lista as etapas do treinamento do módulo',
      params: schema.moduleParamsSchema,
      response: { 200: schema.trainingResponseSchema, ...errors },
    },
  }, controller.getTrainingController)

  app.post('/:moduleId/training/complete', {
    schema: {
      ...common,
      summary: 'Marca o treinamento como concluído',
      params: schema.moduleParamsSchema,
      response: { 200: schema.trainingCompleteResponseSchema, ...errors },
    },
  }, controller.completeTrainingController)

  app.get('/:moduleId/quiz/pos', {
    schema: {
      ...common,
      summary: 'Lista perguntas do pós-teste sem gabarito',
      params: schema.moduleParamsSchema,
      response: { 200: schema.quizQuestionsResponseSchema, ...errors },
    },
  }, controller.getPostTestQuestionsController)

  app.post('/:moduleId/quiz/pos/answers', {
    schema: {
      ...common,
      summary: 'Registra uma resposta do pós-teste com explicação',
      params: schema.moduleParamsSchema,
      body: schema.submitPostAnswerSchema,
      response: { 200: schema.postAnswerFeedbackSchema, ...errors },
    },
  }, controller.submitPostAnswerController)

  app.post('/:moduleId/quiz/pos/finish', {
    schema: {
      ...common,
      summary: 'Finaliza o pós-teste e calcula aprovação',
      params: schema.moduleParamsSchema,
      response: { 200: schema.postTestResultSchema, ...errors },
    },
  }, controller.finishPostTestController)

  app.get('/:moduleId/quiz/pos/resultado', {
    schema: {
      ...common,
      summary: 'Consulta o resultado do pós-teste',
      params: schema.moduleParamsSchema,
      response: { 200: schema.postTestResultSchema, ...errors },
    },
  }, controller.getPostTestResultController)
}
