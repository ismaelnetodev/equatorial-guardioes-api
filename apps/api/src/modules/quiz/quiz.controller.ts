import type { FastifyReply, FastifyRequest } from 'fastify'
import { AuthenticationError, getAuthenticatedUser } from '../../lib/auth-user.js'
import type {
  ModuleParams,
  SubmitPostAnswer,
  SubmitPreTest,
} from './quiz.schemas.js'
import { QuizError, completeTraining, finishPostTest, getLearnState, getPostTestQuestions, getPostTestResult, getPreTestQuestions, getPreTestResult, getTraining, submitPostAnswer, submitPreTest } from './quiz.service.js'

function statusFor(code: QuizError['code']): number {
  if (code === 'MODULE_NOT_FOUND' || code === 'ATTEMPT_NOT_FOUND') return 404
  if (code === 'QUIZ_EMPTY') return 422
  return 409
}

function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthenticationError) {
    return reply.status(401).send({ code: 'UNAUTHENTICATED', message: error.message })
  }
  if (error instanceof QuizError) {
    return reply.status(statusFor(error.code)).send({ code: error.code, message: error.message })
  }
  throw error
}

async function withAuth<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  operation: (userId: string) => Promise<T>,
  status = 200,
) {
  try {
    const user = await getAuthenticatedUser(request.headers.authorization)
    return reply.status(status).send(await operation(user.id))
  } catch (error) {
    return sendError(reply, error)
  }
}

export async function getLearnStateController(request: FastifyRequest<{ Params: ModuleParams }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => getLearnState(userId, request.params.moduleId))
}

export async function getPreTestQuestionsController(request: FastifyRequest<{ Params: ModuleParams }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => getPreTestQuestions(userId, request.params.moduleId))
}

export async function submitPreTestController(request: FastifyRequest<{ Params: ModuleParams; Body: SubmitPreTest }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => submitPreTest(userId, request.params.moduleId, request.body))
}

export async function getPreTestResultController(request: FastifyRequest<{ Params: ModuleParams }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => getPreTestResult(userId, request.params.moduleId))
}

export async function getTrainingController(request: FastifyRequest<{ Params: ModuleParams }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => getTraining(userId, request.params.moduleId))
}

export async function completeTrainingController(request: FastifyRequest<{ Params: ModuleParams }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => completeTraining(userId, request.params.moduleId))
}

export async function getPostTestQuestionsController(request: FastifyRequest<{ Params: ModuleParams }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => getPostTestQuestions(userId, request.params.moduleId))
}

export async function submitPostAnswerController(request: FastifyRequest<{ Params: ModuleParams; Body: SubmitPostAnswer }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => submitPostAnswer(userId, request.params.moduleId, request.body))
}

export async function finishPostTestController(request: FastifyRequest<{ Params: ModuleParams }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => finishPostTest(userId, request.params.moduleId))
}

export async function getPostTestResultController(request: FastifyRequest<{ Params: ModuleParams }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => getPostTestResult(userId, request.params.moduleId))
}
