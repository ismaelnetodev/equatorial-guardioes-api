import { Type } from 'typebox'
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { getAuthenticatedUser, AuthenticationError } from '../../lib/auth-user.js'
import { LearningError } from './learning-rules.service.js'
import { QuizError } from './quiz.service.js'
import { getFinalExam, submitFinalExam } from './final-exam.service.js'
import { errorResponseSchema, publicQuizQuestionSchema, submitPreTestSchema } from './quiz.schemas.js'

const uuid = Type.String({ format: 'uuid' })
const result = { trailId: uuid, totalCount: Type.Integer({ minimum: 1 }), minimumCorrect: Type.Integer({ minimum: 0 }) }
export const finalExamRoutes: FastifyPluginAsyncTypebox = async app => {
  const common = { tags: ['Quiz'], security: [{ bearerAuth: [] }], params: Type.Object({ trailId: uuid }), response: { 400: errorResponseSchema, 401: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema, 422: errorResponseSchema } }
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AuthenticationError) return reply.status(401).send({ code: 'UNAUTHENTICATED', message: error.message })
    if (error instanceof LearningError) return reply.status(409).send({ code: error.code, message: error.message })
    if (error instanceof QuizError) return reply.status(error.code === 'MODULE_NOT_FOUND' ? 404 : 422).send({ code: error.code, message: error.message })
    throw error
  })
  app.get('/:trailId/final-exam', { schema: { ...common, summary: 'Lista a prova final da trilha sem gabarito', response: { ...common.response, 200: Type.Object({ ...result, questions: Type.Array(publicQuizQuestionSchema) }, { additionalProperties: false }) } } }, async request => {
    const user = await getAuthenticatedUser(request.headers.authorization)
    return getFinalExam(user.id, request.params.trailId)
  })
  app.post('/:trailId/final-exam', { schema: { ...common, summary: 'Corrige a prova final e concede pontos uma única vez', body: submitPreTestSchema, response: { ...common.response, 200: Type.Object({ ...result, attemptId: uuid, correctCount: Type.Integer({ minimum: 0 }), isApproved: Type.Boolean(), pointsAwarded: Type.Integer({ minimum: 0 }) }, { additionalProperties: false }) } } }, async request => {
    const user = await getAuthenticatedUser(request.headers.authorization)
    return submitFinalExam(user.id, request.params.trailId, request.body)
  })
}
